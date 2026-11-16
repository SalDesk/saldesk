const {
  validarConfig, foraDeHoras, textoDaResposta, deveResponder, TEXTO_PT, TEXTO_EN, JANELA_SILENCIO_HORAS,
} = require('../helpers/chatAutoReply');

const BASE = { enabled: true, days: [1, 2, 3, 4, 5], from: '09:00', to: '18:00', message_pt: '', message_en: '' };

/* Cabo Verde e UTC-1 sem horario de verao: 12:00 UTC = 11:00 em Cabo Verde */
const utc = (iso) => new Date(iso);

describe('validarConfig', () => {
  it('aceita uma configuracao completa e normaliza-a', () => {
    const r = validarConfig({ enabled: true, days: [5, 1, 1, 3], from: '09:00', to: '18:30', message_pt: '  Ola  ', message_en: 'Hi' });
    expect(r).toEqual({ ok: true, config: { enabled: true, days: [1, 3, 5], from: '09:00', to: '18:30', message_pt: 'Ola', message_en: 'Hi' } });
  });

  it('null ou vazio desliga a funcionalidade', () => {
    expect(validarConfig(null)).toEqual({ ok: true, config: null });
  });

  it('desligada com valores por omissao e valida', () => {
    expect(validarConfig({ enabled: false }).ok).toBe(true);
    expect(validarConfig({ enabled: false }).config.enabled).toBe(false);
  });

  it.each([
    ['formato que nao e objecto', 'sim'],
    ['array', [1, 2]],
    ['enabled que nao e booleano', { ...BASE, enabled: 'true' }],
    ['dia fora de 0-6', { ...BASE, days: [1, 7] }],
    ['dia nao inteiro', { ...BASE, days: [1.5] }],
    ['days que nao e lista', { ...BASE, days: '1,2' }],
    ['hora mal formada', { ...BASE, from: '9:00' }],
    ['hora impossivel', { ...BASE, to: '24:30' }],
    ['minutos impossiveis', { ...BASE, from: '09:60' }],
    ['fim igual ao inicio', { ...BASE, from: '09:00', to: '09:00' }],
    ['mensagem PT demasiado longa', { ...BASE, message_pt: 'x'.repeat(501) }],
    ['mensagem EN que nao e texto', { ...BASE, message_en: 42 }],
  ])('rejeita %s', (_, entrada) => {
    const r = validarConfig(entrada);
    expect(r.ok).toBe(false);
    expect(typeof r.error).toBe('string');
  });

  it('aceita um horario que atravessa a meia-noite (fecho anterior a abertura)', () => {
    const r = validarConfig({ ...BASE, from: '22:00', to: '06:00' });
    expect(r.ok).toBe(true);
    expect(r.config).toMatchObject({ from: '22:00', to: '06:00' });
  });

  it('sem dias escolhidos e invalido quando ligada (nunca estaria disponivel e responderia sempre)', () => {
    expect(validarConfig({ ...BASE, days: [] }).ok).toBe(false);
  });
});

describe('foraDeHoras (hora de Cabo Verde, UTC-1)', () => {
  it('dentro do horario num dia de atendimento: nao esta fora de horas', () => {
    /* quarta 2026-11-11, 12:00 UTC = 11:00 em CV */
    expect(foraDeHoras(BASE, utc('2026-11-11T12:00:00Z'))).toBe(false);
  });

  it('antes da abertura e fora de horas, na abertura ja nao', () => {
    expect(foraDeHoras(BASE, utc('2026-11-11T09:59:00Z'))).toBe(true);  // 08:59 CV
    expect(foraDeHoras(BASE, utc('2026-11-11T10:00:00Z'))).toBe(false); // 09:00 CV
  });

  it('o fecho exclui a hora final', () => {
    expect(foraDeHoras(BASE, utc('2026-11-11T18:59:00Z'))).toBe(false); // 17:59 CV
    expect(foraDeHoras(BASE, utc('2026-11-11T19:00:00Z'))).toBe(true);  // 18:00 CV
  });

  it('dia sem atendimento e sempre fora de horas', () => {
    /* sabado 2026-11-14 */
    expect(foraDeHoras(BASE, utc('2026-11-14T12:00:00Z'))).toBe(true);
  });

  it('usa o dia da semana de Cabo Verde e nao o do servidor (UTC)', () => {
    /* segunda 2026-11-09 00:30 UTC = domingo 23:30 em CV: domingo nao atende, mesmo sendo segunda em UTC */
    expect(foraDeHoras(BASE, utc('2026-11-09T00:30:00Z'))).toBe(true);
    /* terca 2026-11-10 00:30 UTC = segunda 23:30 em CV: dia de atendimento mas depois do fecho */
    expect(foraDeHoras(BASE, utc('2026-11-10T00:30:00Z'))).toBe(true);
    /* segunda 10:30 UTC = 09:30 CV: dentro */
    expect(foraDeHoras(BASE, utc('2026-11-09T10:30:00Z'))).toBe(false);
  });

  it('nao depende do fuso horario do processo', () => {
    const antes = process.env.TZ;
    try {
      for (const tz of ['Atlantic/Cape_Verde', 'UTC', 'Pacific/Auckland']) {
        process.env.TZ = tz;
        expect({ tz, fora: foraDeHoras(BASE, utc('2026-11-11T09:59:00Z')) }).toEqual({ tz, fora: true });
        expect({ tz, fora: foraDeHoras(BASE, utc('2026-11-11T10:00:00Z')) }).toEqual({ tz, fora: false });
      }
    } finally {
      if (antes === undefined) delete process.env.TZ; else process.env.TZ = antes;
    }
  });
});

describe('foraDeHoras: horario que atravessa a meia-noite (o dia conta pelo inicio do turno)', () => {
  /* turno de segunda a sexta das 22:00 as 06:00 (hora de Cabo Verde, UTC-1) */
  const NOITE = { enabled: true, days: [1, 2, 3, 4, 5], from: '22:00', to: '06:00', message_pt: '', message_en: '' };

  it('a noite de um dia de atendimento: aberto antes e depois da meia-noite', () => {
    expect(foraDeHoras(NOITE, utc('2026-11-09T23:00:00Z'))).toBe(false); // seg 22:00 CV
    expect(foraDeHoras(NOITE, utc('2026-11-10T00:30:00Z'))).toBe(false); // seg 23:30 CV
    expect(foraDeHoras(NOITE, utc('2026-11-10T04:00:00Z'))).toBe(false); // ter 03:00 CV (turno de segunda)
  });

  it('os limites: abre as 22:00, fecha as 06:00 (exclusivo)', () => {
    expect(foraDeHoras(NOITE, utc('2026-11-09T22:59:00Z'))).toBe(true);  // seg 21:59 CV
    expect(foraDeHoras(NOITE, utc('2026-11-09T23:00:00Z'))).toBe(false); // seg 22:00 CV
    expect(foraDeHoras(NOITE, utc('2026-11-10T06:59:00Z'))).toBe(false); // ter 05:59 CV
    expect(foraDeHoras(NOITE, utc('2026-11-10T07:00:00Z'))).toBe(true);  // ter 06:00 CV
  });

  it('de dia (entre as 06:00 e as 22:00) esta sempre fora de horas', () => {
    expect(foraDeHoras(NOITE, utc('2026-11-11T13:00:00Z'))).toBe(true); // qua 12:00 CV
  });

  it('a madrugada pertence ao turno do dia anterior: sabado de madrugada ainda e turno de sexta', () => {
    expect(foraDeHoras(NOITE, utc('2026-11-14T04:00:00Z'))).toBe(false); // sab 03:00 CV (turno de sexta)
    expect(foraDeHoras(NOITE, utc('2026-11-14T00:00:00Z'))).toBe(false); // sex 23:00 CV
  });

  it('sabado a noite e a madrugada de domingo e a de segunda ficam fora (sab e dom nao atendem)', () => {
    expect(foraDeHoras(NOITE, utc('2026-11-15T00:00:00Z'))).toBe(true); // sab 23:00 CV
    expect(foraDeHoras(NOITE, utc('2026-11-15T04:00:00Z'))).toBe(true); // dom 03:00 CV (turno de sabado)
    expect(foraDeHoras(NOITE, utc('2026-11-16T04:00:00Z'))).toBe(true); // seg 03:00 CV (turno de domingo)
  });

  it('um turno so de domingo atravessa para segunda de madrugada', () => {
    const DOMINGO = { ...NOITE, days: [0] };
    expect(foraDeHoras(DOMINGO, utc('2026-11-16T04:00:00Z'))).toBe(false); // seg 03:00 CV
    expect(foraDeHoras(DOMINGO, utc('2026-11-17T04:00:00Z'))).toBe(true);  // ter 03:00 CV
  });

  it('deveResponder respeita o turno nocturno', () => {
    expect(deveResponder({ config: NOITE, agora: utc('2026-11-10T04:00:00Z'), jaFalouRecentemente: false })).toBe(false);
    expect(deveResponder({ config: NOITE, agora: utc('2026-11-11T13:00:00Z'), jaFalouRecentemente: false })).toBe(true);
  });
});

describe('textoDaResposta', () => {
  it('usa o texto do operador no idioma pedido', () => {
    const c = { ...BASE, message_pt: 'Voltamos amanha.', message_en: 'Back tomorrow.' };
    expect(textoDaResposta(c, 'pt')).toBe('Voltamos amanha.');
    expect(textoDaResposta(c, 'en')).toBe('Back tomorrow.');
  });

  it('texto vazio cai para o texto por omissao do idioma', () => {
    expect(textoDaResposta(BASE, 'pt')).toBe(TEXTO_PT);
    expect(textoDaResposta(BASE, 'en')).toBe(TEXTO_EN);
  });

  it('idioma desconhecido ou em falta usa portugues', () => {
    const c = { ...BASE, message_pt: 'PT', message_en: 'EN' };
    expect(textoDaResposta(c, undefined)).toBe('PT');
    expect(textoDaResposta(c, 'de')).toBe('PT');
    expect(textoDaResposta(c, 'EN-US')).toBe('PT');
  });

  it('os textos por omissao nao tem emojis nem prometem hora de resposta', () => {
    for (const t of [TEXTO_PT, TEXTO_EN]) {
      expect(t.length).toBeGreaterThan(20);
      expect(/\p{Extended_Pictographic}/u.test(t)).toBe(false);
    }
  });
});

describe('deveResponder', () => {
  const FORA = utc('2026-11-14T12:00:00Z'); // sabado
  const DENTRO = utc('2026-11-11T12:00:00Z');

  it('responde fora de horas se ninguem falou recentemente', () => {
    expect(deveResponder({ config: BASE, agora: FORA, jaFalouRecentemente: false })).toBe(true);
  });

  it('nao responde dentro do horario', () => {
    expect(deveResponder({ config: BASE, agora: DENTRO, jaFalouRecentemente: false })).toBe(false);
  });

  it('nao responde se ja falou recentemente (resposta automatica anterior ou do operador)', () => {
    expect(deveResponder({ config: BASE, agora: FORA, jaFalouRecentemente: true })).toBe(false);
  });

  it('nao responde se esta desligada ou sem configuracao', () => {
    expect(deveResponder({ config: { ...BASE, enabled: false }, agora: FORA, jaFalouRecentemente: false })).toBe(false);
    expect(deveResponder({ config: null, agora: FORA, jaFalouRecentemente: false })).toBe(false);
    expect(deveResponder({ config: undefined, agora: FORA, jaFalouRecentemente: false })).toBe(false);
  });

  it('configuracao corrompida na base de dados nunca responde nem rebenta', () => {
    expect(deveResponder({ config: { enabled: true, days: 'x' }, agora: FORA, jaFalouRecentemente: false })).toBe(false);
    expect(deveResponder({ config: { enabled: true, from: '9h', to: '18:00' }, agora: FORA, jaFalouRecentemente: false })).toBe(false);
    expect(deveResponder({ config: 'x', agora: FORA, jaFalouRecentemente: false })).toBe(false);
  });

  it('configuracao ligada sem mais campos usa os valores por omissao (dias uteis, 09:00 a 18:00)', () => {
    expect(deveResponder({ config: { enabled: true }, agora: FORA, jaFalouRecentemente: false })).toBe(true);
    expect(deveResponder({ config: { enabled: true }, agora: DENTRO, jaFalouRecentemente: false })).toBe(false);
  });

  it('a janela de silencio e de 12 horas', () => {
    expect(JANELA_SILENCIO_HORAS).toBe(12);
  });
});
