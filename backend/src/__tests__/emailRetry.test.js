/* Reenvio automatico de emails e alertas. Nada aqui toca na rede nem na base de dados. */

jest.mock('../config/supabase', () => ({ supabaseAdmin: {} }));

const q = require('../helpers/emailQueue');
const { processarReenvios, verificarSaudeEmail, resumirEmails } = require('../services/emailRetryService');

const MIN = 60_000;
const HORA = 60 * MIN;

/* ───────── lógica pura ───────── */
describe('classificarErro', () => {
  const erro = (code) => Object.assign(new Error('x'), { code });

  test.each([
    [401, true], [403, true], [408, true], [429, true], [500, true], [502, true], [503, true],
    [400, false], [404, false], [413, false], [422, false],
  ])('HTTP %i -> repetir: %s', (code, repetir) => {
    expect(q.classificarErro(erro(code)).retryable).toBe(repetir);
  });

  test('sem codigo numerico (rede, timeout) repete-se', () => {
    for (const e of [new Error('ECONNRESET'), { code: 'ECONNREFUSED' }, {}, null, undefined]) {
      expect(q.classificarErro(e)).toEqual({ retryable: true, motivo: 'rede' });
    }
  });

  test('o estado tambem pode vir em response.statusCode', () => {
    expect(q.classificarErro({ response: { statusCode: 400 } }).retryable).toBe(false);
    expect(q.classificarErro({ response: { statusCode: 503 } }).retryable).toBe(true);
  });
});

describe('intervalos entre tentativas', () => {
  const agora = new Date('2026-11-02T12:00:00Z');

  test('crescem: 5 min, 15 min, 1 h, 3 h, 6 h, 12 h, 24 h', () => {
    const minutos = [1, 2, 3, 4, 5, 6, 7].map((n) => (q.proximaTentativa(n, agora) - agora) / MIN);
    expect(minutos).toEqual([5, 15, 60, 180, 360, 720, 1440]);
  });

  test('depois da 8.ª falha esgota-se', () => {
    expect(q.proximaTentativa(8, agora)).toBeNull();
    expect(q.proximaTentativa(20, agora)).toBeNull();
  });

  test('o total ronda 2 dias (8 tentativas)', () => {
    expect(q.BACKOFF_MIN).toHaveLength(7);
    expect(q.BACKOFF_MIN.reduce((a, b) => a + b, 0) / 60 / 24).toBeCloseTo(1.93, 1);
  });
});

describe('prazo de validade', () => {
  test('links de acesso e de password so valem 1 hora; o resto 48 h; os alertas 6 h', () => {
    for (const assunto of ['O seu acesso à SalDesk', 'Repor a sua password SalDesk', 'O seu código de verificação', 'Recuperação de conta']) {
      expect(q.ttlDoEmail({ assunto })).toBe(HORA);
    }
    expect(q.ttlDoEmail({ assunto: 'A sua reserva foi confirmada' })).toBe(48 * HORA);
    expect(q.ttlDoEmail({ assunto: 'O seu acesso', kind: 'alert' })).toBe(6 * HORA);
    expect(q.ttlDoEmail({})).toBe(48 * HORA);
  });

  test('expirado compara com a hora de criacao', () => {
    const criado = '2026-11-02T10:00:00Z';
    expect(q.expirado({ context: 'Repor a sua password', created_at: criado }, new Date('2026-11-02T10:59:00Z'))).toBe(false);
    expect(q.expirado({ context: 'Repor a sua password', created_at: criado }, new Date('2026-11-02T11:01:00Z'))).toBe(true);
    expect(q.expirado({ context: 'Reserva confirmada', created_at: criado }, new Date('2026-11-04T09:00:00Z'))).toBe(false);
    expect(q.expirado({ context: 'Reserva confirmada', created_at: criado }, new Date('2026-11-04T11:00:00Z'))).toBe(true);
  });
});

describe('guardar e recuperar o conteudo', () => {
  test('anexos vao em base64 e voltam a Buffer iguais', () => {
    const pdf = Buffer.from('%PDF-1.4 conteudo de teste');
    const { payload, anexosDescartados } = q.serializarPayload({ to: 'a@b.cv', subject: 'Recibo', html: '<p>x</p>', text: 'x', attachments: [{ filename: 'r.pdf', content: pdf, contentType: 'application/pdf' }] });
    expect(anexosDescartados).toBe(false);
    expect(JSON.parse(JSON.stringify(payload)).attachments[0].content_b64).toBe(pdf.toString('base64'));
    const volta = q.desserializarPayload(JSON.parse(JSON.stringify(payload)));
    expect(volta.to).toBe('a@b.cv');
    expect(volta.subject).toBe('Recibo');
    expect(volta.attachments[0].content.equals(pdf)).toBe(true);
    expect(volta.attachments[0]).toMatchObject({ filename: 'r.pdf', contentType: 'application/pdf' });
  });

  test('anexos demasiado grandes ficam de fora e avisa-se (o email nao iria completo)', () => {
    const grande = Buffer.alloc(q.MAX_ANEXOS_BYTES + 1, 1);
    const r = q.serializarPayload({ to: 'a@b.cv', subject: 's', attachments: [{ filename: 'g.bin', content: grande }] });
    expect(r.anexosDescartados).toBe(true);
    expect(r.payload.attachments).toEqual([]);
  });

  test('sem anexos, destinatario em lista e campos em falta', () => {
    const { payload } = q.serializarPayload({ to: ['a@b.cv', 'c@d.cv'], subject: undefined, html: undefined, text: 'so texto' });
    expect(payload).toEqual({ to: ['a@b.cv', 'c@d.cv'], subject: null, html: null, text: 'so texto', attachments: [] });
    expect(q.desserializarPayload(payload).html).toBeUndefined();
    expect(q.destinatarioEmTexto(['a@b.cv', 'c@d.cv'])).toBe('a@b.cv, c@d.cv');
    expect(q.destinatarioEmTexto('x@y.cv')).toBe('x@y.cv');
    expect(q.destinatarioEmTexto(undefined)).toBeNull();
  });
});

/* ───────── reenvio ───────── */
/* Repositorio em memoria com a mesma interface. */
function repoEmMemoria(linhas) {
  const estado = new Map(linhas.map((l) => [l.id, { status: 'pending', attempts: 1, kind: 'transactional', next_attempt_at: '2026-11-02T11:00:00Z', created_at: '2026-11-02T10:00:00Z', context: 'Reserva confirmada', to_email: 'x@y.cv', payload: { to: 'x@y.cv', subject: 'Reserva confirmada' }, ...l }]));
  const chamadas = { presos: 0, reivindicar: [] };
  return {
    estado, chamadas,
    async devolverPresos() { chamadas.presos++; },
    async listarDevidos(limite, agora) {
      return [...estado.values()].filter((r) => r.status === 'pending' && new Date(r.next_attempt_at) <= agora).slice(0, limite);
    },
    async reivindicar(id) {
      chamadas.reivindicar.push(id);
      const r = estado.get(id);
      if (r.conflito || r.status !== 'pending') return false;
      r.status = 'sending';
      return true;
    },
    async guardar(id, campos) { Object.assign(estado.get(id), campos); },
  };
}

describe('processarReenvios', () => {
  const agora = () => new Date('2026-11-02T12:00:00Z');
  const erro = (code, msg = 'falhou') => Object.assign(new Error(msg), { code });

  test('sucesso: fica enviado, com a hora e o numero de tentativas', async () => {
    const repo = repoEmMemoria([{ id: 'a' }]);
    const enviar = jest.fn(async () => {});
    const r = await processarReenvios({ repo, enviar, agora });
    expect(r.enviados).toBe(1);
    expect(enviar).toHaveBeenCalledWith({ to: 'x@y.cv', subject: 'Reserva confirmada' });
    expect(repo.estado.get('a')).toMatchObject({ status: 'sent', attempts: 2, last_error: null, sent_at: '2026-11-02T12:00:00.000Z' });
    expect(repo.chamadas.presos).toBe(1);
  });

  test('falha temporaria: volta a fila com o intervalo seguinte e guarda o erro', async () => {
    const repo = repoEmMemoria([{ id: 'a', attempts: 1 }, { id: 'b', attempts: 3 }]);
    const enviar = jest.fn(async () => { throw erro(401, 'Unauthorized: Authenticated user is not authorized to send mail'); });
    const r = await processarReenvios({ repo, enviar, agora });
    expect(r.adiados).toBe(2);
    expect(repo.estado.get('a')).toMatchObject({ status: 'pending', attempts: 2, next_attempt_at: '2026-11-02T12:15:00.000Z' });   // 2.ª falha -> +15 min
    expect(repo.estado.get('b')).toMatchObject({ status: 'pending', attempts: 4, next_attempt_at: '2026-11-02T15:00:00.000Z' });   // 4.ª falha -> +3 h
    expect(repo.estado.get('a').last_error).toContain('not authorized to send mail');
  });

  test('erro permanente: nao se repete', async () => {
    const repo = repoEmMemoria([{ id: 'a' }]);
    const r = await processarReenvios({ repo, enviar: async () => { throw erro(400, 'Does not contain a valid address'); }, agora });
    expect(r.permanentes).toBe(1);
    expect(repo.estado.get('a')).toMatchObject({ status: 'permanent', next_attempt_at: null });
  });

  test('esgotadas as tentativas (a 8.ª falha): fica esgotado', async () => {
    const repo = repoEmMemoria([{ id: 'a', attempts: 7 }]);
    const r = await processarReenvios({ repo, enviar: async () => { throw erro(503); }, agora });
    expect(r.abandonados).toBe(1);
    expect(repo.estado.get('a')).toMatchObject({ status: 'abandoned', attempts: 8, next_attempt_at: null });
  });

  test('link que ja expirou: nao se envia, fica esgotado com o motivo', async () => {
    const repo = repoEmMemoria([{ id: 'a', context: 'O seu acesso à SalDesk', created_at: '2026-11-02T10:00:00Z' }]);
    const enviar = jest.fn(async () => {});
    const r = await processarReenvios({ repo, enviar, agora });
    expect(r.expirados).toBe(1);
    expect(enviar).not.toHaveBeenCalled();
    expect(repo.estado.get('a')).toMatchObject({ status: 'abandoned' });
    expect(repo.estado.get('a').last_error).toContain('expirou');
  });

  test('so o que ja venceu; e uma linha reservada por outro worker e ignorada', async () => {
    const repo = repoEmMemoria([
      { id: 'futuro', next_attempt_at: '2026-11-02T13:00:00Z' },
      { id: 'conflito', conflito: true },
      { id: 'devida' },
    ]);
    const enviar = jest.fn(async () => {});
    const r = await processarReenvios({ repo, enviar, agora });
    expect(r.enviados).toBe(1);
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(repo.estado.get('futuro').status).toBe('pending');
    expect(repo.estado.get('conflito').status).toBe('pending');
    expect(repo.chamadas.reivindicar).not.toContain('futuro');
  });

  test('uma falha nao impede os restantes', async () => {
    const repo = repoEmMemoria([{ id: 'a' }, { id: 'b' }]);
    let n = 0;
    const enviar = async () => { if (n++ === 0) throw erro(503); };
    const r = await processarReenvios({ repo, enviar, agora });
    expect(r).toMatchObject({ adiados: 1, enviados: 1 });
  });

  test('respeita o limite por ciclo', async () => {
    const repo = repoEmMemoria([...Array(5)].map((_, i) => ({ id: `e${i}` })));
    const r = await processarReenvios({ repo, enviar: async () => {}, agora, limite: 2 });
    expect(r.enviados).toBe(2);
  });
});

/* ───────── alertas ───────── */
describe('verificarSaudeEmail', () => {
  const base = new Date('2026-11-02T12:00:00Z');
  const pend = (minutosAtras, extra = {}) => ({ context: 'Reserva confirmada', to_email: 'cliente@x.cv', created_at: new Date(base.getTime() - minutosAtras * MIN).toISOString(), last_error: 'Unauthorized', ...extra });

  function cenario({ pendentes = [], esgotados = [] } = {}) {
    const marcados = [];
    const repo = { estatisticas: async () => ({ pendentes, esgotados }), marcarAlertados: async (ids) => marcados.push(...ids) };
    const alertas = [];
    return { repo, marcados, alertas, alertar: async (texto, tipo) => alertas.push({ texto, tipo }) };
  }

  test('nao avisa por uma falha recente (pode ser so um soluco)', async () => {
    const c = cenario({ pendentes: [pend(5)] });
    const estado = { alertando: false, ultimoAlerta: null };
    expect(await verificarSaudeEmail({ ...c, estado, agora: () => base })).toEqual([]);
    expect(c.alertas).toHaveLength(0);
  });

  test('avisa quando ha emails por entregar ha 15+ minutos, com assunto, destinatario e erro', async () => {
    const c = cenario({ pendentes: [pend(30), pend(10, { context: 'Booking confirmed', to_email: 'jan@x.cv' })] });
    const estado = { alertando: false, ultimoAlerta: null };
    expect(await verificarSaudeEmail({ ...c, estado, agora: () => base })).toEqual(['falha']);
    expect(c.alertas[0].tipo).toBe('falha');
    expect(c.alertas[0].texto).toContain('2 email(s) por entregar');
    expect(c.alertas[0].texto).toContain('ha 30 min');
    expect(c.alertas[0].texto).toContain('"Reserva confirmada" para cliente@x.cv');
    expect(c.alertas[0].texto).toContain('continua a tentar sozinho');
    expect(estado.alertando).toBe(true);
  });

  test('nao repete o aviso a cada ciclo; repete de 6 em 6 horas enquanto durar', async () => {
    const estado = { alertando: false, ultimoAlerta: null };
    const c = cenario({ pendentes: [pend(30)] });
    await verificarSaudeEmail({ ...c, estado, agora: () => base });
    await verificarSaudeEmail({ ...c, estado, agora: () => new Date(base.getTime() + 5 * MIN) });
    await verificarSaudeEmail({ ...c, estado, agora: () => new Date(base.getTime() + 5 * HORA) });
    expect(c.alertas).toHaveLength(1);
    await verificarSaudeEmail({ ...c, estado, agora: () => new Date(base.getTime() + 6 * HORA + MIN) });
    expect(c.alertas).toHaveLength(2);
  });

  test('avisa quando tudo volta ao normal, uma so vez', async () => {
    const estado = { alertando: true, ultimoAlerta: base.getTime() };
    const c = cenario({ pendentes: [] });
    expect(await verificarSaudeEmail({ ...c, estado, agora: () => base })).toEqual(['recuperado']);
    expect(c.alertas[0].tipo).toBe('recuperado');
    expect(estado).toEqual({ alertando: false, ultimoAlerta: null });
    expect(await verificarSaudeEmail({ ...c, estado, agora: () => base })).toEqual([]);
    expect(c.alertas).toHaveLength(1);
  });

  test('sem problemas e sem aviso anterior: silencio', async () => {
    const c = cenario();
    expect(await verificarSaudeEmail({ ...c, estado: { alertando: false, ultimoAlerta: null }, agora: () => base })).toEqual([]);
    expect(c.alertas).toHaveLength(0);
  });

  test('emails esgotados: avisa e marca-os para nao avisar outra vez', async () => {
    const c = cenario({ esgotados: [{ id: 'e1', context: 'A sua reserva foi confirmada', to_email: 'cliente@x.cv', last_error: 'Unauthorized' }, { id: 'e2', context: 'Nova reserva', to_email: 'op@x.cv', last_error: 'Unauthorized' }] });
    const estado = { alertando: false, ultimoAlerta: null };
    expect(await verificarSaudeEmail({ ...c, estado, agora: () => base })).toEqual(['esgotado']);
    expect(c.alertas[0].texto).toContain('2 email(s) NAO foram entregues');
    expect(c.marcados).toEqual(['e1', 'e2']);
  });

  test('resumirEmails limita a lista e conta o resto', () => {
    const lista = [...Array(7)].map((_, i) => ({ context: `Assunto ${i}`, to_email: `u${i}@x.cv` }));
    const t = resumirEmails(lista, 3);
    expect(t).toContain('"Assunto 0" para u0@x.cv');
    expect(t).toContain('e mais 4');
    expect(t).not.toContain('Assunto 3');
    expect(resumirEmails([{ context: null, to_email: null }])).toBe('"sem assunto" para ?');
  });
});
