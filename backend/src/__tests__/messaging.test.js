/* Camada de mensagens (MessagingProvider), fase 1. Nada aqui toca na rede nem na base de dados. */

jest.mock('../config/supabase', () => ({ supabaseAdmin: {} }));

const { paraE164, soDigitos } = require('../messaging/phone');
const { emHorasSilenciosas, proximoEnvioPermitido, quandoEnviar } = require('../messaging/quietHours');
const wame = require('../messaging/providers/wame');
const { resolveProvider } = require('../messaging/router');
const { planoParaResultado, MAX_TENTATIVAS } = require('../messaging/outbox');
const { POR_OMISSAO, GATILHOS, ESTADOS_PERMITIDOS, idiomaValido, validarTexto } = require('../messaging/templates');
const { renderTemplate, variaveisDesconhecidas, usaVariavel, VARIAVEIS_CONHECIDAS } = require('../helpers/automationTemplate');

describe('paraE164', () => {
  test('aceita E.164 e formatos livres com indicativo', () => {
    expect(paraE164('+238 999 1234')).toBe('+2389991234');
    expect(paraE164('+351 (912) 345-678')).toBe('+351912345678');
    expect(paraE164('00238 9991234')).toBe('+2389991234');
    expect(paraE164('whatsapp:+2389991234')).toBe('+2389991234');
  });

  test('7 digitos sem indicativo = numero de Cabo Verde', () => {
    expect(paraE164('999 1234')).toBe('+2389991234');
  });

  test('8 a 15 digitos sem "+" assume que ja traz o indicativo', () => {
    expect(paraE164('351912345678')).toBe('+351912345678');
  });

  test('rejeita o que nao serve', () => {
    for (const mau of [null, undefined, '', '   ', 'abc', '123', '12345', '1'.repeat(16), '+12']) {
      expect(paraE164(mau)).toBeNull();
    }
  });

  test('soDigitos tira o "+"', () => {
    expect(soDigitos('+2389991234')).toBe('2389991234');
  });
});

describe('horas silenciosas (Cabo Verde = UTC-1)', () => {
  test('22h as 8h locais sao silenciosas', () => {
    // 23:00 UTC = 22:00 locais
    expect(emHorasSilenciosas(new Date('2026-10-20T23:00:00Z'))).toBe(true);
    expect(emHorasSilenciosas(new Date('2026-10-21T03:00:00Z'))).toBe(true);
    // 08:59 UTC = 07:59 locais
    expect(emHorasSilenciosas(new Date('2026-10-21T08:59:00Z'))).toBe(true);
  });

  test('o resto do dia nao', () => {
    expect(emHorasSilenciosas(new Date('2026-10-21T09:00:00Z'))).toBe(false); // 08:00 locais
    expect(emHorasSilenciosas(new Date('2026-10-21T15:00:00Z'))).toBe(false);
    expect(emHorasSilenciosas(new Date('2026-10-21T22:59:00Z'))).toBe(false); // 21:59 locais
  });

  test('de madrugada espera pelas 08:00 locais do mesmo dia', () => {
    const r = proximoEnvioPermitido(new Date('2026-10-21T03:30:00Z'));
    expect(r.toISOString()).toBe('2026-10-21T09:00:00.000Z');
  });

  test('depois das 22h locais espera pelas 08:00 do dia seguinte', () => {
    const r = proximoEnvioPermitido(new Date('2026-10-20T23:30:00Z')); // 22:30 locais
    expect(r.toISOString()).toBe('2026-10-21T09:00:00.000Z');
    const meiaNoite = proximoEnvioPermitido(new Date('2026-10-21T00:30:00Z')); // 23:30 locais
    expect(meiaNoite.toISOString()).toBe('2026-10-21T09:00:00.000Z');
  });

  test('fora das horas silenciosas envia ja', () => {
    const agora = new Date('2026-10-21T15:00:00Z');
    expect(proximoEnvioPermitido(agora).toISOString()).toBe(agora.toISOString());
  });

  test('so lembretes, avaliacoes e automacoes respeitam o silencio; confirmacoes nao', () => {
    const noite = new Date('2026-10-21T03:30:00Z');
    expect(quandoEnviar('booking_confirmed', noite).toISOString()).toBe(noite.toISOString());
    for (const g of ['reminder_d1', 'review_request', 'automation']) {
      expect(quandoEnviar(g, noite).toISOString()).toBe('2026-10-21T09:00:00.000Z');
    }
  });
});

describe('WameProvider', () => {
  test('devolve sempre handoff com o link wa.me e o texto codificado', async () => {
    const r = await wame.send({ to: '+2389991234', text: 'Olá Ana! 1 & 2?' });
    expect(r.status).toBe('handoff');
    expect(r.url).toBe(`https://wa.me/2389991234?text=${encodeURIComponent('Olá Ana! 1 & 2?')}`);
  });

  test('erros esperados sao "failed" permanente, nunca excepcao', async () => {
    expect(await wame.send({ to: '123', text: 'x' })).toEqual({ status: 'failed', reason: 'numero_invalido', permanent: true });
    expect(await wame.send({ to: '+2389991234', text: '   ' })).toEqual({ status: 'failed', reason: 'mensagem_vazia', permanent: true });
    expect((await wame.send({ to: '+2389991234', text: 'a'.repeat(3001) })).reason).toBe('mensagem_demasiado_longa');
    expect((await wame.send(undefined)).status).toBe('failed');
  });

  test('capacidades: sem envio automatico, com texto livre', () => {
    expect(wame.capabilities.automatedSend).toBe(false);
    expect(wame.capabilities.freeformOutside24h).toBe(true);
    expect(wame.capabilities.templates).toBe(false);
  });
});

describe('resolveProvider', () => {
  const providers = { wame: { id: 'wame' }, cloud_api: { id: 'cloud_api' }, openwa: { id: 'openwa' } };

  test('por omissao e sempre o wa.me', () => {
    expect(resolveProvider(undefined).id).toBe('wame');
    expect(resolveProvider({ provider: 'wame' }).id).toBe('wame');
  });

  test('na fase 1 so o wa.me esta registado: cloud_api e openwa caem nele', () => {
    expect(resolveProvider({ provider: 'cloud_api', cloud_status: 'active' }).id).toBe('wame');
    expect(resolveProvider({ provider: 'openwa', operator_id: 'x' }, { env: { OPENWA_ENABLED: 'true', WANDR_INTERNAL_OPERATOR_ID: 'x' } }).id).toBe('wame');
  });

  test('cloud_api so quando esta activa', () => {
    expect(resolveProvider({ provider: 'cloud_api', cloud_status: 'active' }, { providers }).id).toBe('cloud_api');
    expect(resolveProvider({ provider: 'cloud_api', cloud_status: 'pending' }, { providers }).id).toBe('wame');
  });

  test('OpenWA nunca para um operador cliente, mesmo que a configuracao o peca', () => {
    const env = { OPENWA_ENABLED: 'true', WANDR_INTERNAL_OPERATOR_ID: 'wandr' };
    expect(resolveProvider({ provider: 'openwa', operator_id: 'cliente' }, { providers, env }).id).toBe('wame');
    expect(resolveProvider({ provider: 'openwa', operator_id: 'wandr' }, { providers, env }).id).toBe('openwa');
    expect(resolveProvider({ provider: 'openwa', operator_id: 'wandr' }, { providers, env: { WANDR_INTERNAL_OPERATOR_ID: 'wandr' } }).id).toBe('wame');
    expect(resolveProvider({ provider: 'openwa', operator_id: 'wandr' }, { providers, env: { OPENWA_ENABLED: 'true' } }).id).toBe('wame');
  });
});

describe('planoParaResultado', () => {
  const agora = new Date('2026-10-21T12:00:00Z');
  const row = (attempts) => ({ id: 'r1', attempts });
  const opts = { agora, backoff: () => 90_000 };

  test('handoff: awaiting_human com o link', () => {
    const p = planoParaResultado(row(1), 'wame', { status: 'handoff', url: 'https://wa.me/1' }, opts);
    expect(p).toMatchObject({ status: 'awaiting_human', handoff_url: 'https://wa.me/1', provider: 'wame', last_error: null });
  });

  test('sent: guarda o id do fornecedor', () => {
    const p = planoParaResultado(row(1), 'cloud_api', { status: 'sent', providerMessageId: 'wamid.1' }, opts);
    expect(p).toMatchObject({ status: 'sent', provider_message_id: 'wamid.1' });
  });

  test('retry: volta a fila com backoff, ou retryAfterMs se o adapter o pedir', () => {
    const a = planoParaResultado(row(2), 'wame', { status: 'retry', reason: '5xx' }, opts);
    expect(a.status).toBe('queued');
    expect(a.next_attempt_at).toBe(new Date(agora.getTime() + 90_000).toISOString());
    const b = planoParaResultado(row(2), 'openwa', { status: 'retry', reason: 'sessao', retryAfterMs: 600_000 }, opts);
    expect(b.next_attempt_at).toBe(new Date(agora.getTime() + 600_000).toISOString());
  });

  test('retry no limite de tentativas falha de vez', () => {
    const p = planoParaResultado(row(MAX_TENTATIVAS), 'wame', { status: 'retry', reason: '5xx' }, opts);
    expect(p).toMatchObject({ status: 'failed', last_error: 'max_attempts: 5xx' });
  });

  test('failed e resultado desconhecido param', () => {
    expect(planoParaResultado(row(1), 'wame', { status: 'failed', reason: 'numero_invalido', permanent: true }, opts))
      .toMatchObject({ status: 'failed', last_error: 'numero_invalido' });
    expect(planoParaResultado(row(1), 'wame', undefined, opts)).toMatchObject({ status: 'failed', last_error: 'resultado_desconhecido' });
  });
});

describe('templates por omissao', () => {
  const dados = {
    customer_name: 'Ana', unit_name: 'Buggy Tour', check_in: '2026-10-20', start_time: '09:00:00',
    operator_name: 'Logan Tours', guide_name: 'Joao', review_link: 'https://app.saldesk.cv/review/abc',
  };

  test('todos os gatilhos tem PT e EN', () => {
    for (const g of GATILHOS) {
      for (const l of ['pt', 'en']) expect(typeof POR_OMISSAO[g][l]).toBe('string');
      expect(ESTADOS_PERMITIDOS[g].length).toBeGreaterThan(0);
    }
  });

  test('renderizam sem chavetas por preencher, em PT e EN', () => {
    for (const g of GATILHOS) {
      for (const l of ['pt', 'en']) {
        const out = renderTemplate(POR_OMISSAO[g][l], dados);
        expect(out).not.toMatch(/[{}]/);
        expect(out).toContain('Ana');
      }
    }
  });

  test('confirmacao sem guia nem ponto de encontro continua legivel', () => {
    const out = renderTemplate(POR_OMISSAO.booking_confirmed.pt, { ...dados, guide_name: '' });
    expect(out).toContain('A sua reserva de Buggy Tour em 20/10/2026 às 09:00 está confirmada.');
    expect(out).not.toMatch(/Guia|Ponto de encontro|[{}]/);
    expect(out).toContain('Obrigado por escolher Logan Tours!');
  });

  test('sem hora tira o "às"', () => {
    const out = renderTemplate(POR_OMISSAO.booking_confirmed.pt, { ...dados, start_time: null });
    expect(out).toContain('em 20/10/2026 está confirmada.');
  });

  test('pedido de avaliacao leva o link', () => {
    expect(renderTemplate(POR_OMISSAO.review_request.en, dados)).toContain('https://app.saldesk.cv/review/abc');
  });

  test('a avaliacao so se pede depois da actividade concluida', () => {
    expect(ESTADOS_PERMITIDOS.review_request).toEqual(['checked_out']);
    expect(ESTADOS_PERMITIDOS.booking_confirmed).not.toContain('cancelled');
  });

  test('idiomaValido cai em PT para o que nao suportamos ainda', () => {
    expect(idiomaValido('en')).toBe('en');
    for (const l of ['de', 'nl', 'fr', undefined, null, '']) expect(idiomaValido(l)).toBe('pt');
  });
});

describe('validacao dos templates do operador', () => {
  test('os textos por omissao passam a validacao', () => {
    for (const g of GATILHOS) {
      for (const l of ['pt', 'en']) expect(() => validarTexto(g, POR_OMISSAO[g][l])).not.toThrow();
    }
  });

  test('variavel com erro de escrita e recusada (nao chega ao cliente por preencher)', () => {
    expect(variaveisDesconhecidas('Ola {nome_clinte}, {nome_tour} {{xpto}}')).toEqual(['{nome_clinte}', '{{xpto}}']);
    try {
      validarTexto('booking_confirmed', 'Ola {nome_clinte}!');
      throw new Error('devia recusar');
    } catch (e) {
      expect(e.status).toBe(400);
      expect(e.code).toBe('UNKNOWN_VARIABLE');
      expect(e.variables).toEqual(['{nome_clinte}']);
    }
  });

  test('aceita as variaveis dos dois vocabularios, em qualquer caixa e com espacos', () => {
    expect(variaveisDesconhecidas('{nome_cliente} {NOME_TOUR} {{ nome }} {{unidade}} {check_in} {operador}')).toEqual([]);
    expect(VARIAVEIS_CONHECIDAS).toEqual(expect.arrayContaining(['nome_cliente', 'nome_tour', 'data', 'hora', 'guia', 'ponto_encontro', 'operador', 'link_avaliacao']));
  });

  test('texto sem chavetas e valido', () => {
    expect(variaveisDesconhecidas('Obrigado pela visita!')).toEqual([]);
    expect(variaveisDesconhecidas('')).toEqual([]);
    expect(variaveisDesconhecidas(null)).toEqual([]);
  });

  test('o pedido de avaliacao tem de incluir o link', () => {
    expect(() => validarTexto('review_request', 'Obrigado {nome_cliente}!')).toThrow('link_avaliacao');
    try { validarTexto('review_request', 'Obrigado!'); } catch (e) { expect(e.code).toBe('MISSING_REVIEW_LINK'); }
    expect(() => validarTexto('review_request', 'Avalie: {link_avaliacao}')).not.toThrow();
    expect(() => validarTexto('review_request', 'Avalie: {{link_avaliacao}}')).not.toThrow();
    // os outros gatilhos nao precisam de link
    expect(() => validarTexto('booking_confirmed', 'Ola!')).not.toThrow();
  });

  test('usaVariavel reconhece as duas formas', () => {
    expect(usaVariavel('a {guia} b', 'guia')).toBe(true);
    expect(usaVariavel('a {{ guia }} b', 'guia')).toBe(true);
    expect(usaVariavel('a b', 'guia')).toBe(false);
  });
});
