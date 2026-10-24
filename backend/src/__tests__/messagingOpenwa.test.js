/* Camada de mensagens, fase 2: OpenWA (so interno). Nada aqui toca na rede nem na base de dados:
   o fetch e simulado e o supabase e substituido. */

jest.mock('../config/supabase', () => ({ supabaseAdmin: {} }));
jest.mock('../helpers/emailHelper', () => ({ enviarEmail: jest.fn() }));

const crypto = require('crypto');
const openwa = require('../messaging/providers/openwa');
const { criarAlertador } = require('../messaging/alert');
const { resolveProvider, obterRegisto } = require('../messaging/router');
const { proximoEstado, ipInterno } = require('../messaging/inbound');

const CONFIG = { baseUrl: 'http://127.0.0.1:2785', apiKey: 'chave-de-teste', sessionId: 'sessao-1', webhookSecret: 'segredo-de-teste-123' };

/* fetch simulado: devolve uma resposta fixa e guarda o ultimo pedido. */
function fetchSimulado(status, corpo, cabecalhos = {}) {
  const f = jest.fn(async () => ({
    status,
    json: async () => { if (corpo === undefined) throw new Error('sem corpo'); return corpo; },
    headers: { get: (k) => cabecalhos[k.toLowerCase()] ?? null },
  }));
  return f;
}

function provider(fetchImpl, extra = {}) {
  const alertar = jest.fn(async () => true);
  return { p: openwa.criarOpenWaProvider({ ...CONFIG, fetchImpl, alertar, ...extra }), alertar };
}

const msg = { id: 'outbox-1', to: '+2389991234', text: 'Ola!' };

describe('configuracao do OpenWA', () => {
  const completa = { OPENWA_ENABLED: 'true', OPENWA_BASE_URL: 'http://127.0.0.1:2785/', OPENWA_API_KEY: 'k', OPENWA_SESSION_ID: 's' };

  test('so existe com o adapter ligado e tudo preenchido', () => {
    expect(openwa.configuracao(completa)).toMatchObject({ baseUrl: 'http://127.0.0.1:2785', apiKey: 'k', sessionId: 's' });
    expect(openwa.configuracao({ ...completa, OPENWA_ENABLED: undefined })).toBeNull();
    expect(openwa.configuracao({ ...completa, OPENWA_ENABLED: 'false' })).toBeNull();
    for (const falta of ['OPENWA_BASE_URL', 'OPENWA_API_KEY', 'OPENWA_SESSION_ID']) {
      expect(openwa.configuracao({ ...completa, [falta]: '' })).toBeNull();
    }
    expect(openwa.configuracao({})).toBeNull();
  });
});

describe('OpenWAProvider.send', () => {
  test('envio aceite: 201 com messageId, chave de API e idempotencia no pedido', async () => {
    const f = fetchSimulado(201, { messageId: 'wamid-1', timestamp: 1 });
    const { p } = provider(f);
    expect(await p.send(msg)).toEqual({ status: 'sent', providerMessageId: 'wamid-1' });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('http://127.0.0.1:2785/api/sessions/sessao-1/messages/send-text');
    expect(init.method).toBe('POST');
    expect(init.headers['X-API-Key']).toBe('chave-de-teste');
    expect(init.headers['Idempotency-Key']).toBe('outbox-1');
    expect(JSON.parse(init.body)).toEqual({ chatId: '2389991234@c.us', text: 'Ola!' });
  });

  test('erros esperados sem rede: numero, texto vazio e texto demasiado longo', async () => {
    const f = fetchSimulado(201, { messageId: 'x' });
    const { p } = provider(f);
    expect(await p.send({ ...msg, to: '123' })).toEqual({ status: 'failed', reason: 'numero_invalido', permanent: true });
    expect(await p.send({ ...msg, text: '  ' })).toEqual({ status: 'failed', reason: 'mensagem_vazia', permanent: true });
    expect((await p.send({ ...msg, text: 'a'.repeat(4097) })).reason).toBe('mensagem_demasiado_longa');
    expect(f).not.toHaveBeenCalled();
  });

  test('429 respeita retryAfterSeconds (com limites)', async () => {
    let r = await provider(fetchSimulado(429, { code: 'SEND_PACING_LIMITED', retryAfterSeconds: 42 })).p.send(msg);
    expect(r).toEqual({ status: 'retry', reason: 'SEND_PACING_LIMITED', retryAfterMs: 42_000 });
    r = await provider(fetchSimulado(429, {}, { 'retry-after': '1' })).p.send(msg);
    expect(r.retryAfterMs).toBe(5_000); // minimo 5 s
    r = await provider(fetchSimulado(429, { retryAfterSeconds: 999999 })).p.send(msg);
    expect(r.retryAfterMs).toBe(3_600_000); // maximo 1 h
  });

  test('400 de numero recusado e definitivo; 400 de sessao tenta de novo e alerta', async () => {
    let r = await provider(fetchSimulado(400, { message: 'Recipient number is not on WhatsApp' })).p.send(msg);
    expect(r).toEqual({ status: 'failed', reason: 'recusada: Recipient number is not on WhatsApp', permanent: true });

    const { p, alertar } = provider(fetchSimulado(400, { message: 'Session is not active' }));
    r = await p.send(msg);
    expect(r.status).toBe('retry');
    expect(r.retryAfterMs).toBe(openwa.RETRY_LONGO_MS);
    expect(alertar).toHaveBeenCalledTimes(1);
  });

  test.each([
    [404, { message: "Session 'x' not found" }, openwa.RETRY_LONGO_MS],
    [409, { message: 'engine not ready' }, openwa.RETRY_MOTOR_MS],
    [502, {}, openwa.RETRY_LONGO_MS],
    [503, {}, openwa.RETRY_LONGO_MS],
    [504, {}, openwa.RETRY_LONGO_MS],
  ])('HTTP %i: sessao/motor em baixo = retry com atraso e alerta (nunca falha em silencio)', async (status, corpo, esperado) => {
    const { p, alertar } = provider(fetchSimulado(status, corpo));
    const r = await p.send(msg);
    expect(r.status).toBe('retry');
    expect(r.retryAfterMs).toBe(esperado);
    expect(alertar).toHaveBeenCalled();
  });

  test('401/403: chave recusada = retry longo com alerta', async () => {
    const { p, alertar } = provider(fetchSimulado(401, { message: 'Unauthorized' }));
    const r = await p.send(msg);
    expect(r).toMatchObject({ status: 'retry', reason: 'auth_401', retryAfterMs: openwa.RETRY_LONGO_MS });
    expect(alertar).toHaveBeenCalled();
  });

  test('500 e resposta sem messageId: retry normal (backoff da outbox)', async () => {
    let r = await provider(fetchSimulado(500, { message: 'send failed' })).p.send(msg);
    expect(r.status).toBe('retry');
    expect(r.retryAfterMs).toBeUndefined();
    r = await provider(fetchSimulado(201, {})).p.send(msg);
    expect(r).toEqual({ status: 'retry', reason: 'resposta_sem_messageId' });
  });

  test('falha de rede e timeout: retry longo com alerta, sem excepcao', async () => {
    const rede = jest.fn(async () => { throw new Error('ECONNREFUSED'); });
    let { p, alertar } = provider(rede);
    let r = await p.send(msg);
    expect(r).toMatchObject({ status: 'retry', retryAfterMs: openwa.RETRY_LONGO_MS });
    expect(r.reason).toContain('ECONNREFUSED');
    expect(alertar).toHaveBeenCalled();

    const lento = jest.fn((url, init) => new Promise((_, rej) => {
      init.signal.addEventListener('abort', () => { const e = new Error('abortado'); e.name = 'AbortError'; rej(e); });
    }));
    ({ p, alertar } = provider(lento, { timeoutMs: 20 }));
    r = await p.send(msg);
    expect(r).toMatchObject({ status: 'retry', reason: 'timeout' });
  });
});

describe('OpenWAProvider.estadoSessao', () => {
  test('devolve o estado da sessao', async () => {
    const { p } = provider(fetchSimulado(200, { status: 'ready', phone: '2389990000' }));
    expect(await p.estadoSessao()).toMatchObject({ status: 'ready', phone: '2389990000' });
  });
  test('sem resposta ou erro devolve status null (o worker alerta)', async () => {
    expect((await provider(fetchSimulado(503, {})).p.estadoSessao()).status).toBeNull();
    expect((await provider(jest.fn(async () => { throw new Error('x'); })).p.estadoSessao()).status).toBeNull();
  });
});

describe('verificacao da assinatura do webhook', () => {
  const corpo = Buffer.from(JSON.stringify({ event: 'message.ack', data: { id: 'a' } }));
  const assinar = (buf, segredo) => `sha256=${crypto.createHmac('sha256', segredo).update(buf).digest('hex')}`;
  const { p } = provider(fetchSimulado(200, {}));

  test('aceita a assinatura correcta sobre o corpo em bruto', () => {
    expect(p.verifyWebhook(corpo, { 'X-OpenWA-Signature': assinar(corpo, CONFIG.webhookSecret) })).toBe(true);
    expect(p.verifyWebhook(corpo, { 'x-openwa-signature': assinar(corpo, CONFIG.webhookSecret) })).toBe(true);
  });

  test('recusa corpo alterado, segredo errado, formato errado e ausencia de segredo', () => {
    const boa = assinar(corpo, CONFIG.webhookSecret);
    expect(p.verifyWebhook(Buffer.from(corpo.toString() + ' '), { 'x-openwa-signature': boa })).toBe(false);
    expect(p.verifyWebhook(corpo, { 'x-openwa-signature': assinar(corpo, 'outro-segredo-qualquer') })).toBe(false);
    expect(p.verifyWebhook(corpo, { 'x-openwa-signature': boa.replace('sha256=', '') })).toBe(false);
    expect(p.verifyWebhook(corpo, { 'x-openwa-signature': 'sha256=zz' })).toBe(false);
    expect(p.verifyWebhook(corpo, { 'x-openwa-signature': 'sha256=' })).toBe(false);
    expect(p.verifyWebhook(corpo, {})).toBe(false);
    expect(p.verifyWebhook(corpo, undefined)).toBe(false);
    expect(p.verifyWebhook(corpo, { 'x-openwa-signature': boa }, null)).toBe(false);
  });
});

describe('parseWebhook (envelope do OpenWA)', () => {
  const env = (event, data, extra = {}) => ({ event, timestamp: '2026-10-23T12:00:00.000Z', sessionId: 's', idempotencyKey: 'k', data, ...extra });

  test('mensagem recebida de um turista', () => {
    const r = openwa.parseWebhook(env('message.received', { id: 'm1', from: '2389991234@c.us', chatId: '2389991234@c.us', body: 'Ola', fromMe: false, isGroup: false, timestamp: 1790000000 }), { operatorId: 'op' });
    expect(r).toEqual([{ type: 'message', operatorId: 'op', from: '+2389991234', providerMessageId: 'm1', text: 'Ola', receivedAt: new Date(1790000000 * 1000) }]);
  });

  test('ignora mensagens proprias e de grupos', () => {
    expect(openwa.parseWebhook(env('message.received', { id: 'm1', from: '1@c.us', fromMe: true }))).toEqual([]);
    expect(openwa.parseWebhook(env('message.received', { id: 'm1', from: '1@g.us', isGroup: true }))).toEqual([]);
    expect(openwa.parseWebhook(env('message.received', { from: '2389991234@c.us' }))).toEqual([]); // sem id
  });

  test('estados de entrega', () => {
    const r = openwa.parseWebhook(env('message.ack', { id: 'a', messageId: 'wamid-1', status: 'delivered' }));
    expect(r).toEqual([{ type: 'status', providerMessageId: 'wamid-1', alternativeIds: ['a'], status: 'delivered', at: new Date('2026-10-23T12:00:00.000Z'), error: undefined }]);
    expect(openwa.parseWebhook(env('message.ack', { id: 'a', status: 'pending' }))).toEqual([]);
    expect(openwa.parseWebhook(env('message.ack', { status: 'read' }))).toEqual([]);
    const f = openwa.parseWebhook(env('message.failed', { id: 'a', messageId: 'wamid-1', status: 'failed', ack: -1 }));
    expect(f[0]).toMatchObject({ type: 'status', status: 'failed', error: 'message.failed' });
  });

  test('eventos de sessao e o resto', () => {
    expect(openwa.parseWebhook(env('session.disconnected', { status: 'disconnected' }))[0]).toMatchObject({ type: 'session', event: 'session.disconnected', status: 'disconnected' });
    expect(openwa.parseWebhook(env('session.restriction', {}))[0]).toMatchObject({ type: 'session', event: 'session.restriction' });
    for (const lixo of [env('call.received', {}), env('presence.update', {}), null, undefined, 'x', {}]) {
      expect(openwa.parseWebhook(lixo)).toEqual([]);
    }
  });
});

describe('estados so avancam', () => {
  test('sent < delivered < read', () => {
    expect(proximoEstado('sent', 'delivered')).toBe('delivered');
    expect(proximoEstado('sent', 'read')).toBe('read');
    expect(proximoEstado('delivered', 'read')).toBe('read');
    expect(proximoEstado('sending', 'sent')).toBe('sent');
  });
  test('a ordem de chegada dos webhooks nao faz recuar', () => {
    expect(proximoEstado('read', 'delivered')).toBeNull();
    expect(proximoEstado('delivered', 'delivered')).toBeNull();
    expect(proximoEstado('read', 'sent')).toBeNull();
  });
  test('failed so apanha o que ainda nao foi entregue', () => {
    expect(proximoEstado('sent', 'failed')).toBe('failed');
    expect(proximoEstado('queued', 'failed')).toBe('failed');
    expect(proximoEstado('delivered', 'failed')).toBeNull();
    expect(proximoEstado('read', 'failed')).toBeNull();
  });
  test('estados desconhecidos ou terminais sao ignorados', () => {
    expect(proximoEstado('awaiting_human', 'delivered')).toBeNull();
    expect(proximoEstado('cancelled', 'sent')).toBeNull();
    expect(proximoEstado('sent', 'pending')).toBeNull();
  });
});

describe('so aceita webhooks da rede interna', () => {
  test('loopback e rede privada do Docker', () => {
    for (const ip of ['127.0.0.1', '127.1.2.3', '::1', '::ffff:127.0.0.1', '172.17.0.2', '172.16.5.5', '172.31.255.1', '::ffff:172.18.0.3']) {
      expect(ipInterno(ip)).toBe(true);
    }
  });
  test('o resto e recusado', () => {
    for (const ip of ['8.8.8.8', '76.13.248.135', '172.15.0.1', '172.32.0.1', '10.0.0.5', '192.168.1.1', '1.127.0.0', '', null, undefined, 'abc']) {
      expect(ipInterno(ip)).toBe(false);
    }
  });
});

describe('alertas', () => {
  test('um email por intervalo, mas o log e sempre', async () => {
    const enviar = jest.fn(async () => {});
    const registar = jest.fn();
    let t = 1_000_000;
    const alertar = criarAlertador({ enviar, para: 'fundador@x.cv', intervaloMs: 3_600_000, agora: () => t, registar });
    expect(await alertar('sessao caiu')).toBe(true);
    t += 60_000;
    expect(await alertar('continua em baixo')).toBe(false);
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(registar).toHaveBeenCalledTimes(2);
    t += 3_600_000;
    expect(await alertar('de novo')).toBe(true);
    expect(enviar).toHaveBeenCalledTimes(2);
    expect(enviar.mock.calls[0][0]).toMatchObject({ to: 'fundador@x.cv' });
  });

  test('uma falha do email nunca rebenta (e nao conta como enviado)', async () => {
    const registar = jest.fn();
    const alertar = criarAlertador({ enviar: async () => { throw new Error('sendgrid em baixo'); }, para: 'x@y.cv', registar });
    await expect(alertar('x')).resolves.toBe(false);
  });

  test('sem destinatario so regista', async () => {
    const registar = jest.fn();
    expect(await criarAlertador({ registar })('x')).toBe(false);
    expect(registar).toHaveBeenCalled();
  });
});

describe('router: o OpenWA nunca chega a um operador cliente', () => {
  const INTERNO = 'op-wandr-interno';
  const env = {
    OPENWA_ENABLED: 'true', OPENWA_BASE_URL: 'http://127.0.0.1:2785', OPENWA_API_KEY: 'k',
    OPENWA_SESSION_ID: 's', WANDR_INTERNAL_OPERATOR_ID: INTERNO,
  };

  test('o operador interno recebe o OpenWA quando a configuracao o pede', () => {
    expect(resolveProvider({ provider: 'openwa', operator_id: INTERNO }, { env }).id).toBe('openwa');
  });

  test('qualquer outro operador cai no wa.me, mesmo que a configuracao peca openwa', () => {
    for (const op of ['cliente-1', 'cliente-2', undefined, '', INTERNO + ' ', INTERNO.toUpperCase()]) {
      expect(resolveProvider({ provider: 'openwa', operator_id: op }, { env }).id).toBe('wame');
    }
  });

  test('o operador interno so usa OpenWA se a configuracao o pedir', () => {
    expect(resolveProvider({ provider: 'wame', operator_id: INTERNO }, { env }).id).toBe('wame');
    expect(resolveProvider(undefined, { env }).id).toBe('wame');
  });

  test('desligado, incompleto ou sem operador interno definido: wa.me', () => {
    const cfg = { provider: 'openwa', operator_id: INTERNO };
    expect(resolveProvider(cfg, { env: { ...env, OPENWA_ENABLED: 'false' } }).id).toBe('wame');
    expect(resolveProvider(cfg, { env: { ...env, OPENWA_API_KEY: '' } }).id).toBe('wame');
    expect(resolveProvider(cfg, { env: { ...env, WANDR_INTERNAL_OPERATOR_ID: '' } }).id).toBe('wame');
    expect(resolveProvider({ provider: 'openwa', operator_id: '' }, { env: { ...env, WANDR_INTERNAL_OPERATOR_ID: '' } }).id).toBe('wame');
  });

  test('o registo so tem OpenWA com tudo configurado, e acompanha mudancas do ambiente', () => {
    expect(obterRegisto({}).openwa).toBeUndefined();
    expect(obterRegisto(env).openwa.id).toBe('openwa');
    expect(obterRegisto({ ...env, OPENWA_ENABLED: 'false' }).openwa).toBeUndefined();
  });
});

describe('sessao: arranque e o que fazer em cada estado', () => {
  test('iniciarSessao chama o start da sessao', async () => {
    const f = fetchSimulado(201, { status: 'initializing' });
    const { p } = provider(f);
    expect(await p.iniciarSessao()).toEqual({ ok: true, httpStatus: 201, status: 'initializing' });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('http://127.0.0.1:2785/api/sessions/sessao-1/start');
    expect(init.method).toBe('POST');
    expect(init.headers['X-API-Key']).toBe('chave-de-teste');
  });

  test('iniciarSessao nunca lanca: erro de rede ou HTTP de erro', async () => {
    expect((await provider(fetchSimulado(409, { message: 'already started' })).p.iniciarSessao()).ok).toBe(false);
    expect(await provider(jest.fn(async () => { throw new Error('ECONNREFUSED'); })).p.iniciarSessao()).toEqual({ ok: false, httpStatus: 0, status: null });
  });

  test.each([
    ['ready', 'ok'],
    ['authenticating', 'aguardar'],
    ['initializing', 'aguardar'],
    ['disconnected', 'reiniciar'],
    ['created', 'reiniciar'],
    ['qr_ready', 'humano'],
    ['action_required', 'humano'],
    ['failed', 'humano'],
    [null, 'humano'],
    [undefined, 'humano'],
  ])('estado %s -> %s', (estado, accao) => {
    expect(openwa.accaoParaEstado(estado)).toBe(accao);
  });
});
