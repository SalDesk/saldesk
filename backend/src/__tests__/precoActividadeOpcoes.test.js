/* precoActividade com opcoes e suplemento de idioma. Sem opcoes o resultado tem de ser
   exactamente o de antes (instantaneo tirado do codigo anterior a esta alteracao). */
const { precoActividade } = require('../helpers/bookingHelpers');

const TIERS = { price_tiers: [{ pax_min: 1, pax_max: 2, price: 120 }, { pax_min: 3, pax_max: 4, price: 150 }] };
const ADULTOS = (q, t) => ({ type: 'tour', description: 'Adultos', quantity: q, total: t });
const CRIANCAS = (q, t) => ({ type: 'children', description: 'Crianças', quantity: q, total: t });
const PRIVADO = (q, t) => ({ type: 'tour', description: 'Tour privado', quantity: q, total: t });
const ERRO_LOTACAO = {
  code: 'CAPACITY_EXCEEDED',
  message_pt: 'Este grupo excede a lotação desta actividade',
  message_en: "This group exceeds this activity's capacity",
};

const parte = (r) => ({ total: r.total, lines: r.lines, error: r.error });

describe('precoActividade sem opcoes nada muda', () => {
  const casos = [
    ['por_pessoa', [{ base_price: 40 }, {}, { adults: 2, children: 0, mode: 'per_person' }],
      { total: 80, lines: [ADULTOS(2, 80)], error: null }],
    ['criancas', [{ base_price: 40 }, { price_child: 25 }, { adults: 2, children: 1, mode: 'per_person' }],
      { total: 105, lines: [ADULTOS(2, 80), CRIANCAS(1, 25)], error: null }],
    ['privado_por_escalao', [{ base_price: 40 }, TIERS, { adults: 3, children: 0, mode: 'private' }],
      { total: 150, lines: [PRIVADO(3, 150)], error: null }],
    ['privado_fora_dos_escaloes', [{ base_price: 40 }, TIERS, { adults: 5, children: 0, mode: 'private' }],
      { total: 0, lines: [PRIVADO(5, 0)], error: {
        code: 'NO_PRICE_FOR_GROUP',
        message_pt: 'Para este número de pessoas, contacte o operador',
        message_en: 'For this group size, please contact the operator',
      } }],
    ['privado_preco_fixo', [{ base_price: 40 }, { price_private: 300 }, { adults: 6, children: 1, mode: 'private' }],
      { total: 300, lines: [PRIVADO(7, 300)], error: null }],
    ['min_adultos', [{ base_price: 40 }, {}, { adults: 0, children: 2, mode: 'per_person' }],
      { total: 0, lines: [], error: { code: 'MIN_ADULTS', message_pt: 'É preciso pelo menos 1 adulto', message_en: 'At least 1 adult is required' } }],
    ['lotacao_excedida', [{ base_price: 40, capacity: 4 }, {}, { adults: 3, children: 2, mode: 'per_person' }],
      { total: 200, lines: [ADULTOS(3, 120), CRIANCAS(2, 80)], error: ERRO_LOTACAO }],
    ['lotacao_excedida_privado', [{ base_price: 40, capacity: 4 }, TIERS, { adults: 5, children: 0, mode: 'private' }],
      { total: 0, lines: [PRIVADO(5, 0)], error: ERRO_LOTACAO }],
    ['lista_de_opcoes_vazia', [{ base_price: 40 }, { options: [] }, { adults: 2, children: 0 }],
      { total: 80, lines: [ADULTOS(2, 80)], error: null }],
  ];

  it.each(casos)('%s', (_nome, args, esperado) => {
    expect(parte(precoActividade(...args))).toStrictEqual(esperado);
  });

  it('devolve_o_modo_sem_opcao_nem_veiculos', () => {
    const r = precoActividade({ base_price: 40 }, TIERS, { adults: 3, children: 0, mode: 'private' });
    expect(r.mode).toBe('private');
    expect(r.option).toBeNull();
    expect(r.vehicles).toBeNull();
    expect(precoActividade({ base_price: 40 }, {}, { adults: 1 }).mode).toBe('per_person');
  });
});

describe('precoActividade com opcoes', () => {
  const OPCOES = {
    options: [
      { id: 'p', name_pt: '2 horas', type: 'per_person', price: 30, price_child: 20 },
      { id: 'g', name_pt: 'Grupo privado', type: 'per_group', price: 200 },
      { id: 'v', name_pt: 'Buggy', type: 'per_vehicle', price: 90, seats: 2 },
    ],
  };

  it('opcao_por_pessoa_com_preco_de_crianca', () => {
    const r = precoActividade({ base_price: 999 }, OPCOES, { adults: 2, children: 1, mode: 'private', optionId: 'p' });
    expect(r.error).toBeNull();
    expect(r.total).toBe(80);
    expect(r.mode).toBe('per_person');
    expect(r.option.id).toBe('p');
    expect(r.lines).toEqual([
      { type: 'option', description: '2 horas', quantity: 2, total: 60 },
      { type: 'children', description: 'Crianças', quantity: 1, total: 20 },
    ]);
  });

  it('opcao_por_pessoa_sem_preco_de_crianca_usa_o_preco', () => {
    const meta = { options: [{ id: 'x', name_pt: 'Manhã', type: 'per_person', price: 30 }] };
    const r = precoActividade({}, meta, { adults: 1, children: 2, optionId: 'x' });
    expect(r.total).toBe(90);
  });

  it('opcao_por_grupo_preco_unico_e_modo_privado', () => {
    const r = precoActividade({ base_price: 40 }, OPCOES, { adults: 4, children: 1, mode: 'per_person', optionId: 'g' });
    expect(r.error).toBeNull();
    expect(r.total).toBe(200);
    expect(r.mode).toBe('private');
    expect(r.lines).toEqual([{ type: 'option', description: 'Grupo privado', quantity: 5, total: 200 }]);
  });

  it('opcao_por_veiculo_corrige_o_numero_de_veiculos', () => {
    const r = precoActividade({}, OPCOES, { adults: 5, children: 0, optionId: 'v', vehicles: 1 });
    expect(r.error).toBeNull();
    expect(r.vehicles).toBe(3);
    expect(r.total).toBe(270);
    expect(r.mode).toBe('per_person');
    expect(r.lines).toEqual([{ type: 'vehicles', description: 'Buggy', quantity: 3, total: 270 }]);
  });

  it('opcao_por_veiculo_nunca_acima_das_pessoas', () => {
    const r = precoActividade({}, OPCOES, { adults: 2, children: 0, optionId: 'v', vehicles: 9 });
    expect(r.vehicles).toBe(2);
    expect(r.total).toBe(180);
  });

  it('opcao_desconhecida_ou_em_falta_recusa', () => {
    for (const optionId of ['zz', undefined, '']) {
      const r = precoActividade({ base_price: 40 }, OPCOES, { adults: 2, children: 0, optionId });
      expect(r.error.code).toBe('OPTION_REQUIRED');
      expect(r.error.message_pt).toBe('Escolha uma opção');
      expect(r.error.message_en).toBe('Choose an option');
      expect(r.total).toBe(0);
    }
  });

  it('min_adultos_continua_com_opcoes', () => {
    const r = precoActividade({}, OPCOES, { adults: 0, children: 2, optionId: 'p' });
    expect(r.error.code).toBe('MIN_ADULTS');
  });

  it('lotacao_conta_pessoas_com_opcoes', () => {
    const r = precoActividade({ capacity: 4 }, OPCOES, { adults: 5, children: 0, optionId: 'g' });
    expect(r.error.code).toBe('CAPACITY_EXCEEDED');
    expect(r.total).toBe(200);
  });
});

describe('precoActividade suplemento de idioma', () => {
  const META = { languages: ['PT', 'ES'], language_surcharges: { ES: 20 } };
  const LINHA = { type: 'language', description: 'Suplemento de idioma (ES)', quantity: 1, total: 20 };

  it('idioma_com_suplemento_acrescenta_linha', () => {
    const r = precoActividade({ base_price: 40 }, META, { adults: 2, children: 0, guideLanguage: 'ES' });
    expect(r.total).toBe(100);
    expect(r.guideLanguage).toBe('ES');
    expect(r.lines[r.lines.length - 1]).toEqual(LINHA);
  });

  it('sem_preferencia_nao_tem_suplemento', () => {
    const r = precoActividade({ base_price: 40 }, META, { adults: 2, children: 0, guideLanguage: '' });
    expect(r.total).toBe(80);
    expect(r.guideLanguage).toBeNull();
    expect(r.lines.some((l) => l.type === 'language')).toBe(false);
  });

  it('suplemento_tambem_com_opcoes', () => {
    const meta = { ...META, options: [{ id: 'g', name_pt: 'Privado', type: 'per_group', price: 200 }] };
    const r = precoActividade({}, meta, { adults: 2, optionId: 'g', guideLanguage: 'ES' });
    expect(r.total).toBe(220);
    expect(r.lines).toEqual([{ type: 'option', description: 'Privado', quantity: 2, total: 200 }, LINHA]);
  });

  it('suplemento_tambem_no_privado_por_tabela', () => {
    const r = precoActividade({}, { ...META, ...TIERS }, { adults: 2, mode: 'private', guideLanguage: 'ES' });
    expect(r.total).toBe(140);
  });

  it('lingua_unica_com_suplemento_e_aplicada_por_defeito', () => {
    const meta = { languages: ['ES'], language_surcharges: { ES: 20 } };
    const r = precoActividade({ base_price: 40 }, meta, { adults: 1 });
    expect(r.guideLanguage).toBe('ES');
    expect(r.total).toBe(60);
  });
});
