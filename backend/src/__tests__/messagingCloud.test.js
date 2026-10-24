/* Camada de mensagens, fase 3: WhatsApp Cloud API. Nada aqui toca na rede nem na base de dados:
   o fetch e simulado e o supabase e substituido. */

jest.mock('../config/supabase', () => ({ supabaseAdmin: {} }));
jest.mock('../helpers/emailHelper', () => ({ enviarEmail: jest.fn() }));

const crypto = require('crypto');
const secrets = require('../messaging/secrets');
const meta = require('../messaging/metaTemplates');
const cloud = require('../messaging/providers/cloudApi');
const { escolherProvider } = require('../messaging/outbox');
const { repartirPorOperador, decidirQualidade } = require('../messaging/worker');
const { resolveProvider, obterRegisto } = require('../messaging/router');
const wame = require('../messaging/providers/wame');
const { idDoEvento } = require('../controllers/messagingCloudWebhookController');

/* ───────── segredos ───────── */
describe('segredos cifrados (AES-256-GCM)', () => {
  const chave = crypto.randomBytes(32);
  const ref = 'cloud-token:op-1';

  test('cifrar e decifrar devolvem o original, e o texto cifrado nao o contem', () => {
    const c = secrets.cifrar('EAAGm0PX4ZCpsBA-token-secreto', chave, ref);
    expect(c).toMatch(/^v1\.[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(c).not.toContain('token-secreto');
    expect(secrets.decifrar(c, chave, ref)).toBe('EAAGm0PX4ZCpsBA-token-secreto');
  });

  test('cada cifra e diferente (iv aleatorio)', () => {
    expect(secrets.cifrar('x', chave, ref)).not.toBe(secrets.cifrar('x', chave, ref));
  });

  test('recusa chave errada, texto alterado, ref trocado (outro operador) e formato desconhecido', () => {
    const c = secrets.cifrar('segredo', chave, ref);
    expect(() => secrets.decifrar(c, crypto.randomBytes(32), ref)).toThrow(/decifrar/);
    expect(() => secrets.decifrar(c, chave, 'cloud-token:op-2')).toThrow(/decifrar/);
    const partes = c.split('.');
    partes[3] = Buffer.from('adulterado').toString('base64url');
    expect(() => secrets.decifrar(partes.join('.'), chave, ref)).toThrow(/decifrar/);
    expect(() => secrets.decifrar('lixo', chave, ref)).toThrow(/Formato/);
    expect(() => secrets.decifrar(undefined, chave, ref)).toThrow(/Formato/);
  });

  test('a chave do ambiente tem de existir e ter 32 bytes', () => {
    expect(() => secrets.chaveDoAmbiente({})).toThrow(/nao esta definida/);
    expect(() => secrets.chaveDoAmbiente({ MESSAGING_ENCRYPTION_KEY: Buffer.alloc(16).toString('base64') })).toThrow(/32 bytes/);
    expect(secrets.chaveDoAmbiente({ MESSAGING_ENCRYPTION_KEY: chave.toString('base64') }).equals(chave)).toBe(true);
  });

  test('o ref depende do operador', () => {
    expect(secrets.refDoToken('abc')).toBe('cloud-token:abc');
  });
});

/* ───────── biblioteca de templates da Meta ───────── */
describe('templates da Meta', () => {
  const casos = meta.DEFINICOES.flatMap((d) => Object.keys(d.locales).map((l) => [d.name, d, l]));

  test.each(casos)('%s (%s) cumpre as regras da Meta', (nome, def, locale) => {
    const l = def.locales[locale];
    expect(meta.problemasDoTexto(l.body, def.params.length, l.exemplos.length)).toEqual([]);
  });

  test('o detector de problemas apanha o que a Meta recusaria', () => {
    expect(meta.problemasDoTexto('{{1}} comeca', 1, 1)).toContain('comeca numa variavel');
    expect(meta.problemasDoTexto('acaba {{1}}', 1, 1)).toContain('acaba numa variavel');
    expect(meta.problemasDoTexto('a {{2}} b {{1}} c', 2, 2).some((p) => p.includes('fora de ordem'))).toBe(true);
    expect(meta.problemasDoTexto('a {{1}} {{2}} b', 2, 2)).toContain('duas variaveis seguidas');
    expect(meta.problemasDoTexto('a {{1}} b', 2, 2).some((p) => p.includes('variaveis'))).toBe(true);
    expect(meta.problemasDoTexto('a {{1}} b', 1, 0).some((p) => p.includes('exemplos'))).toBe(true);
  });

  test('nomes validos para a Meta (minusculas, numeros e _) e unicos', () => {
    const nomes = meta.DEFINICOES.map((d) => d.name);
    for (const n of nomes) expect(n).toMatch(/^[a-z0-9_]+$/);
    expect(new Set(nomes).size).toBe(nomes.length);
  });

  test('as avaliacoes sao MARKETING e o resto UTILITY', () => {
    expect(meta.definicaoDoGatilho('review_request').category).toBe('MARKETING');
    expect(meta.definicaoDoGatilho('booking_confirmed').category).toBe('UTILITY');
    expect(meta.definicaoDoGatilho('reminder_d1').category).toBe('UTILITY');
    expect(meta.definicaoDoGatilho('xpto')).toBeNull();
  });

  test('os parametros saem pela ordem do template, a partir dos mesmos dados', () => {
    const dados = { customer_name: 'Ana', unit_name: 'Buggy Tour', check_in: '2026-10-20', start_time: '09:00:00', operator_name: 'Logan Tours', review_link: 'https://x.cv/r/1' };
    expect(meta.paramsPara('booking_confirmed', dados, 'pt')).toEqual(['Ana', 'Buggy Tour', '20/10/2026', '09:00', 'Logan Tours']);
    expect(meta.paramsPara('reminder_d1', dados, 'pt')).toEqual(['Ana', '20/10/2026', 'Buggy Tour', '09:00']);
    expect(meta.paramsPara('review_request', dados, 'en')).toEqual(['Ana', 'Buggy Tour', 'https://x.cv/r/1', 'Logan Tours']);
    expect(meta.paramsPara('xpto', dados)).toBeNull();
  });

  test('sem hora, o parametro nao fica vazio (a Meta recusaria)', () => {
    const dados = { customer_name: 'Ana', unit_name: 'T', check_in: '2026-10-20', operator_name: 'O' };
    expect(meta.paramsPara('booking_confirmed', dados, 'pt')[3]).toBe('a combinar');
    expect(meta.paramsPara('booking_confirmed', dados, 'en')[3]).toBe('to be confirmed');
  });

  test('sanitizacao: sem quebras de linha, tabulacoes, 5+ espacos nem vazios', () => {
    expect(meta.sanitizarParametro('a\nb\tc')).toBe('a b c');
    expect(meta.sanitizarParametro('a        b')).toBe('a    b');
    expect(meta.sanitizarParametro('')).toBe('-');
    expect(meta.sanitizarParametro(null)).toBe('-');
    expect(meta.sanitizarParametro('x'.repeat(2000)).length).toBe(1024);
  });

  test('o pedido de criacao tem nome, idioma, categoria e exemplos', () => {
    const def = meta.definicaoDoGatilho('booking_confirmed');
    const p = meta.paraSubmeter(def, 'pt');
    expect(p).toMatchObject({ name: 'saldesk_confirmacao_reserva_v1', language: 'pt_PT', category: 'UTILITY' });
    expect(p.components[0]).toMatchObject({ type: 'BODY' });
    expect(p.components[0].example.body_text[0]).toHaveLength(5);
    expect(meta.paraSubmeter(def, 'en').language).toBe('en');
    expect(meta.paraSubmeter(def, 'de')).toBeNull();
  });
});

/* ───────── adaptador ───────── */
function respostaMeta(status, corpo) {
  return jest.fn(async () => ({ status, json: async () => { if (corpo === undefined) throw new Error('sem corpo'); return corpo; } }));
}

function criar({ fetchImpl, janela = false, template = { meta_name: 'saldesk_confirmacao_reserva_v1', meta_language: 'pt_PT', meta_status: 'approved' }, cred = { phoneNumberId: '1234567890', token: 'tok-secreto' }, ...extra } = {}) {
  const alertar = jest.fn(async () => {});
  const p = cloud.criarCloudApiProvider({
    fetchImpl,
    obterCredenciais: async () => cred,
    janelaAberta: async () => janela,
    obterTemplate: async () => template,
    alertar,
    ...extra,
  });
  return { p, alertar };
}

const msg = { id: 'outbox-uuid-1', operatorId: 'op-1', to: '+2389991234', locale: 'pt', text: 'Ola Ana!', context: { trigger: 'booking_confirmed' }, templateParams: ['Ana', 'Buggy Tour', '20/10/2026', '09:00', 'Logan Tours'] };

describe('CloudApiProvider.send', () => {
  test('dentro da janela de 24 h: texto livre, com o id da outbox para reconciliar', async () => {
    const f = respostaMeta(200, { messages: [{ id: 'wamid.ABC' }] });
    const { p } = criar({ fetchImpl: f, janela: true });
    expect(await p.send(msg)).toEqual({ status: 'sent', providerMessageId: 'wamid.ABC' });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://graph.facebook.com/v21.0/1234567890/messages');
    expect(init.headers.Authorization).toBe('Bearer tok-secreto');
    const corpo = JSON.parse(init.body);
    expect(corpo).toMatchObject({ messaging_product: 'whatsapp', to: '2389991234', type: 'text', biz_opaque_callback_data: 'outbox-uuid-1' });
    expect(corpo.text).toEqual({ preview_url: false, body: 'Ola Ana!' });
  });

  test('fora da janela: template aprovado, com os parametros pela ordem', async () => {
    const f = respostaMeta(200, { messages: [{ id: 'wamid.T' }] });
    const { p } = criar({ fetchImpl: f, janela: false });
    expect((await p.send(msg)).status).toBe('sent');
    const corpo = JSON.parse(f.mock.calls[0][1].body);
    expect(corpo.type).toBe('template');
    expect(corpo.template.name).toBe('saldesk_confirmacao_reserva_v1');
    expect(corpo.template.language).toEqual({ code: 'pt_PT' });
    expect(corpo.template.components).toEqual([{ type: 'body', parameters: msg.templateParams.map((text) => ({ type: 'text', text })) }]);
    expect(corpo.biz_opaque_callback_data).toBe('outbox-uuid-1');
  });

  test('fora da janela sem template aprovado: falha com motivo explicito, sem chamar a Meta', async () => {
    for (const template of [null, { meta_name: 'x', meta_language: 'pt_PT', meta_status: 'pending' }, { meta_name: 'x', meta_language: 'pt_PT', meta_status: 'rejected' }]) {
      const f = respostaMeta(200, { messages: [{ id: 'x' }] });
      const { p } = criar({ fetchImpl: f, template });
      expect(await p.send(msg)).toEqual({ status: 'failed', reason: 'fora_da_janela_sem_template_aprovado', permanent: true });
      expect(f).not.toHaveBeenCalled();
    }
    // template aprovado mas sem parametros calculados (ex.: texto livre de uma automacao)
    const f = respostaMeta(200, {});
    const r = await criar({ fetchImpl: f }).p.send({ ...msg, templateParams: undefined });
    expect(r.reason).toBe('fora_da_janela_sem_template_aprovado');
    expect(f).not.toHaveBeenCalled();
  });

  test('validacoes sem rede: numero, texto vazio, texto longo', async () => {
    const f = respostaMeta(200, {});
    const { p } = criar({ fetchImpl: f, janela: true });
    expect(await p.send({ ...msg, to: '123' })).toEqual({ status: 'failed', reason: 'numero_invalido', permanent: true });
    expect(await p.send({ ...msg, text: ' ' })).toEqual({ status: 'failed', reason: 'mensagem_vazia', permanent: true });
    expect((await p.send({ ...msg, text: 'a'.repeat(4097) })).reason).toBe('mensagem_demasiado_longa');
    expect(f).not.toHaveBeenCalled();
  });

  test('sem credenciais: retry longo com alerta (nunca silencioso)', async () => {
    const { p, alertar } = criar({ fetchImpl: respostaMeta(200, {}), cred: null, janela: true });
    expect(await p.send(msg)).toMatchObject({ status: 'retry', reason: 'credenciais_em_falta', retryAfterMs: cloud.RETRY_LONGO_MS });
    expect(alertar).toHaveBeenCalled();
  });

  test.each([
    // [codigo, tipo, alerta]
    [190, 'retry', true], [10, 'retry', true], [131048, 'retry', true], [131031, 'retry', true],
    [130429, 'retry', false], [131056, 'retry', false], [80007, 'retry', false], [131000, 'retry', false],
    [131047, 'failed', false], [131026, 'failed', false], [131030, 'failed', false],
    [132000, 'failed', false], [132001, 'failed', false], [132007, 'failed', false], [132015, 'failed', false], [100, 'failed', false],
  ])('erro %i da Meta -> %s (alerta: %s)', async (codigo, tipo, alerta) => {
    const { p, alertar } = criar({ fetchImpl: respostaMeta(400, { error: { code: codigo, message: 'x' } }), janela: true });
    const r = await p.send(msg);
    expect(r.status).toBe(tipo);
    if (tipo === 'failed') expect(r.permanent).toBe(true);
    expect(alertar).toHaveBeenCalledTimes(alerta ? 1 : 0);
  });

  test('HTTP sem codigo conhecido: 401 alerta, 429 e 5xx tentam de novo, 4xx desconhecido falha', async () => {
    let { p, alertar } = criar({ fetchImpl: respostaMeta(401, undefined), janela: true });
    expect(await p.send(msg)).toMatchObject({ status: 'retry', reason: 'token_recusado (401)' });
    expect(alertar).toHaveBeenCalled();
    expect((await criar({ fetchImpl: respostaMeta(429, undefined), janela: true }).p.send(msg)).status).toBe('retry');
    for (const s of [500, 502, 503]) expect((await criar({ fetchImpl: respostaMeta(s, undefined), janela: true }).p.send(msg)).status).toBe('retry');
    expect((await criar({ fetchImpl: respostaMeta(404, { error: { message: 'nao existe' } }), janela: true }).p.send(msg)).status).toBe('failed');
  });

  test('200 sem id, rede em baixo e timeout: retry, sem excepcao', async () => {
    expect(await criar({ fetchImpl: respostaMeta(200, {}), janela: true }).p.send(msg)).toEqual({ status: 'retry', reason: 'resposta_sem_id' });
    const rede = jest.fn(async () => { throw new Error('ECONNRESET'); });
    expect(await criar({ fetchImpl: rede, janela: true }).p.send(msg)).toMatchObject({ status: 'retry', reason: 'rede: ECONNRESET' });
    const lento = jest.fn((url, init) => new Promise((_, rej) => init.signal.addEventListener('abort', () => { const e = new Error('x'); e.name = 'AbortError'; rej(e); })));
    expect(await criar({ fetchImpl: lento, janela: true, timeoutMs: 20 }).p.send(msg)).toMatchObject({ status: 'retry', reason: 'timeout' });
  });

  test('a versao da Graph API e configuravel', async () => {
    const f = respostaMeta(200, { messages: [{ id: 'x' }] });
    await criar({ fetchImpl: f, janela: true, graphVersion: 'v23.0' }).p.send(msg);
    expect(f.mock.calls[0][0]).toContain('/v23.0/');
  });
});

describe('estado do numero e templates (chamadas a Meta)', () => {
  const cred = { phoneNumberId: '99', wabaId: 'W1', token: 't' };

  test('estadoNumero devolve qualidade e estado, ou o erro', async () => {
    const f = respostaMeta(200, { display_phone_number: '+238 999 4119', quality_rating: 'GREEN', status: 'CONNECTED', messaging_limit_tier: 'TIER_250' });
    const n = await criar({ fetchImpl: f }).p.estadoNumero(cred);
    expect(n).toMatchObject({ ok: true, quality_rating: 'GREEN', status: 'CONNECTED' });
    expect(f.mock.calls[0][0]).toContain('/99?fields=');
    const mau = await criar({ fetchImpl: respostaMeta(400, { error: { code: 190, message: 'Invalid OAuth' } }) }).p.estadoNumero(cred);
    expect(mau).toMatchObject({ ok: false, httpStatus: 400, codigo: 190 });
    expect((await criar({ fetchImpl: jest.fn(async () => { throw new Error('x'); }) }).p.estadoNumero(cred)).ok).toBe(false);
  });

  test('submeter e listar templates, e subscrever a app', async () => {
    const def = meta.paraSubmeter(meta.definicaoDoGatilho('booking_confirmed'), 'pt');
    const f1 = respostaMeta(200, { id: '555', status: 'PENDING' });
    expect(await criar({ fetchImpl: f1 }).p.submeterTemplate(cred, def)).toMatchObject({ ok: true });
    expect(f1.mock.calls[0][0]).toBe('https://graph.facebook.com/v21.0/W1/message_templates');
    expect(JSON.parse(f1.mock.calls[0][1].body).name).toBe('saldesk_confirmacao_reserva_v1');
    const f2 = respostaMeta(200, { data: [{ name: 'a', language: 'pt_PT', status: 'APPROVED', id: '1' }] });
    expect((await criar({ fetchImpl: f2 }).p.listarTemplates(cred)).templates).toHaveLength(1);
    const f3 = respostaMeta(200, { success: true });
    expect((await criar({ fetchImpl: f3 }).p.subscreverApp(cred)).ok).toBe(true);
    expect(f3.mock.calls[0][0]).toBe('https://graph.facebook.com/v21.0/W1/subscribed_apps');
    expect(f3.mock.calls[0][1].method).toBe('POST');
  });
});

/* ───────── webhook ───────── */
describe('webhook da Meta', () => {
  const segredo = 'segredo-da-app-meta';
  const corpo = Buffer.from(JSON.stringify({ object: 'whatsapp_business_account', entry: [] }));
  const assinar = (buf, s = segredo) => `sha256=${crypto.createHmac('sha256', s).update(buf).digest('hex')}`;

  test('assinatura X-Hub-Signature-256 sobre o corpo em bruto', () => {
    expect(cloud.verificarAssinaturaMeta(corpo, { 'X-Hub-Signature-256': assinar(corpo) }, segredo)).toBe(true);
    expect(cloud.verificarAssinaturaMeta(corpo, { 'x-hub-signature-256': assinar(corpo) }, segredo)).toBe(true);
  });

  test('recusa assinatura errada, corpo alterado, formato errado e ausencia de segredo ou corpo', () => {
    const boa = assinar(corpo);
    expect(cloud.verificarAssinaturaMeta(Buffer.from(corpo.toString() + ' '), { 'x-hub-signature-256': boa }, segredo)).toBe(false);
    expect(cloud.verificarAssinaturaMeta(corpo, { 'x-hub-signature-256': assinar(corpo, 'outro') }, segredo)).toBe(false);
    expect(cloud.verificarAssinaturaMeta(corpo, { 'x-hub-signature-256': boa.slice(7) }, segredo)).toBe(false);
    expect(cloud.verificarAssinaturaMeta(corpo, { 'x-hub-signature-256': 'sha256=zz' }, segredo)).toBe(false);
    expect(cloud.verificarAssinaturaMeta(corpo, {}, segredo)).toBe(false);
    expect(cloud.verificarAssinaturaMeta(corpo, { 'x-hub-signature-256': boa }, '')).toBe(false);
    expect(cloud.verificarAssinaturaMeta(null, { 'x-hub-signature-256': boa }, segredo)).toBe(false);
    expect(cloud.verificarAssinaturaMeta(corpo, undefined, segredo)).toBe(false);
  });

  const envelope = (field, value, id = 'WABA1') => ({ object: 'whatsapp_business_account', entry: [{ id, changes: [{ field, value }] }] });

  test('estados de entrega, com o id da outbox e o erro quando falha', () => {
    const r = cloud.parseWebhook(envelope('messages', {
      metadata: { phone_number_id: 'PN1' },
      statuses: [
        { id: 'wamid.1', status: 'delivered', timestamp: '1790000000', biz_opaque_callback_data: 'outbox-1' },
        { id: 'wamid.2', status: 'failed', timestamp: '1790000001', errors: [{ code: 131047, title: 'Re-engagement message' }] },
        { id: 'wamid.3', status: 'deleted' },
      ],
    }));
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ type: 'status', phoneNumberId: 'PN1', providerMessageId: 'wamid.1', status: 'delivered', outboxId: 'outbox-1', wabaId: 'WABA1' });
    expect(r[0].at).toEqual(new Date(1790000000 * 1000));
    expect(r[1]).toMatchObject({ status: 'failed', error: 'meta_131047: Re-engagement message' });
  });

  test('mensagens recebidas', () => {
    const r = cloud.parseWebhook(envelope('messages', {
      metadata: { phone_number_id: 'PN1' },
      messages: [{ id: 'wamid.in1', from: '2389991234', timestamp: '1790000000', type: 'text', text: { body: 'Ola' } }, { id: 'wamid.in2', from: '2389991234', type: 'image' }, { from: '1' }],
    }));
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ type: 'message', from: '+2389991234', text: 'Ola', phoneNumberId: 'PN1' });
    expect(r[1]).toMatchObject({ messageType: 'image', text: undefined });
  });

  test('estado de um template', () => {
    const r = cloud.parseWebhook(envelope('message_template_status_update', {
      event: 'REJECTED', message_template_id: 777, message_template_name: 'saldesk_x_v1', message_template_language: 'pt_PT', reason: 'INVALID_FORMAT',
    }));
    expect(r).toEqual([{ type: 'template', wabaId: 'WABA1', phoneNumberId: null, event: 'REJECTED', templateId: '777', name: 'saldesk_x_v1', language: 'pt_PT', reason: 'INVALID_FORMAT' }]);
    expect(cloud.parseWebhook(envelope('message_template_status_update', { event: 'APPROVED', message_template_name: 'n', reason: 'NONE' }))[0].reason).toBeNull();
  });

  test('o que nao interessa devolve vazio', () => {
    for (const x of [null, undefined, {}, 'x', { object: 'page', entry: [] }, { object: 'whatsapp_business_account' }, envelope('account_update', {})]) {
      expect(cloud.parseWebhook(x)).toEqual([]);
    }
  });

  test('estados dos templates da Meta', () => {
    expect(cloud.estadoDoTemplate('approved')).toBe('approved');
    expect(cloud.estadoDoTemplate('REJECTED')).toBe('rejected');
    expect(cloud.estadoDoTemplate('PAUSED')).toBe('paused');
    expect(cloud.estadoDoTemplate('DISABLED')).toBe('disabled');
    expect(cloud.estadoDoTemplate('IN_APPEAL')).toBe('pending');
    expect(cloud.estadoDoTemplate('XPTO')).toBeNull();
  });

  test('o id do evento e estavel (a Meta reenvia) e distingue estados do mesmo envio', () => {
    expect(idDoEvento({ type: 'status', providerMessageId: 'w1', status: 'sent' })).toBe('w1:sent');
    expect(idDoEvento({ type: 'status', providerMessageId: 'w1', status: 'read' })).not.toBe(idDoEvento({ type: 'status', providerMessageId: 'w1', status: 'delivered' }));
    expect(idDoEvento({ type: 'message', providerMessageId: 'm1' })).toBe('in:m1');
    expect(idDoEvento({ type: 'template', templateId: '7', event: 'APPROVED', language: 'pt_PT' })).toBe('tpl:7:APPROVED:pt_PT');
  });
});

/* ───────── decisoes (consentimento, automacoes, taxa, qualidade) ───────── */
describe('consentimento e automacoes', () => {
  const nuvem = { id: 'cloud_api' };

  test('Cloud API so com opt-in da reserva; sem ele, o wa.me', () => {
    expect(escolherProvider(nuvem, { trigger: 'booking_confirmed', optIn: true }).provider).toBe(nuvem);
    for (const optIn of [false, undefined, null, 'true', 1]) {
      const r = escolherProvider(nuvem, { trigger: 'booking_confirmed', optIn });
      expect(r.provider).toBe(wame);
      expect(r.motivo).toBe('sem_opt_in');
    }
  });

  test('automacoes (texto livre do operador) nao tem template: wa.me, mesmo com opt-in', () => {
    const r = escolherProvider(nuvem, { trigger: 'automation', optIn: true });
    expect(r.provider).toBe(wame);
    expect(r.motivo).toBe('automacao_sem_template');
  });

  test('os outros adapters nao sao afectados', () => {
    const ow = { id: 'openwa' };
    expect(escolherProvider(ow, { trigger: 'automation', optIn: false }).provider).toBe(ow);
    expect(escolherProvider(wame, { trigger: 'booking_confirmed', optIn: false }).provider).toBe(wame);
  });
});

describe('limite por operador e qualidade do numero', () => {
  const linha = (operator_id, provider = 'cloud_api', n = 0) => ({ id: `${operator_id}-${n}`, operator_id, provider });

  test('um operador nao ocupa o ciclo todo: o excesso adia-se, os outros passam', () => {
    const linhas = [...Array(8)].map((_, i) => linha('A', 'cloud_api', i)).concat([linha('B'), linha('B', 'cloud_api', 1)]);
    const { processar, adiar } = repartirPorOperador(linhas, 5);
    expect(processar.filter((l) => l.operator_id === 'A')).toHaveLength(5);
    expect(adiar).toHaveLength(3);
    expect(adiar.every((l) => l.operator_id === 'A')).toBe(true);
    expect(processar.filter((l) => l.operator_id === 'B')).toHaveLength(2);
  });

  test('o wa.me nao tem limite (so devolve um link)', () => {
    const linhas = [...Array(30)].map((_, i) => linha('A', 'wame', i));
    expect(repartirPorOperador(linhas, 5)).toEqual({ processar: linhas, adiar: [] });
  });

  test.each([
    [{ quality_rating: 'GREEN', status: 'CONNECTED' }, 'ok'],
    [{ quality_rating: 'YELLOW', status: 'CONNECTED' }, 'avisar'],
    [{ quality_rating: 'GREEN', status: 'PENDING' }, 'avisar'],
    [{ quality_rating: 'RED', status: 'CONNECTED' }, 'suspender'],
    [{ quality_rating: 'GREEN', status: 'FLAGGED' }, 'suspender'],
    [{ quality_rating: 'GREEN', status: 'RESTRICTED' }, 'suspender'],
    [{ quality_rating: 'GREEN', status: 'BANNED' }, 'suspender'],
    [{ quality_rating: 'GREEN', status: 'DISCONNECTED' }, 'suspender'],
    [{ quality_rating: 'red', status: 'connected' }, 'suspender'],
    [{}, 'ok'],
    [undefined, 'ok'],
  ])('qualidade %j -> %s', (estado, accao) => {
    expect(decidirQualidade(estado)).toBe(accao);
  });
});

describe('router com a Cloud API', () => {
  const env = { CLOUD_API_ENABLED: 'true' };
  const cfg = (o = {}) => ({ provider: 'cloud_api', cloud_status: 'active', operator_id: 'op', ...o });

  test('so entra no registo com CLOUD_API_ENABLED=true', () => {
    expect(obterRegisto({}).cloud_api).toBeUndefined();
    expect(obterRegisto({ CLOUD_API_ENABLED: 'false' }).cloud_api).toBeUndefined();
    expect(obterRegisto(env).cloud_api.id).toBe('cloud_api');
  });

  test('so um canal activo usa a Cloud API; pendente, suspenso ou sem registo cai no wa.me', () => {
    expect(resolveProvider(cfg(), { env }).id).toBe('cloud_api');
    for (const cloud_status of ['pending', 'suspended', 'none', undefined]) {
      expect(resolveProvider(cfg({ cloud_status }), { env }).id).toBe('wame');
    }
    expect(resolveProvider(cfg(), { env: {} }).id).toBe('wame');
  });

  test('o OpenWA continua restrito ao operador interno com a Cloud API ligada', () => {
    const e = { ...env, OPENWA_ENABLED: 'true', OPENWA_BASE_URL: 'http://x', OPENWA_API_KEY: 'k', OPENWA_SESSION_ID: 's', WANDR_INTERNAL_OPERATOR_ID: 'interno' };
    expect(resolveProvider({ provider: 'openwa', operator_id: 'cliente' }, { env: e }).id).toBe('wame');
    expect(resolveProvider({ provider: 'openwa', operator_id: 'interno' }, { env: e }).id).toBe('openwa');
  });
});
