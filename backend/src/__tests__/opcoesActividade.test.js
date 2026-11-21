/* Helpers puros das opcoes de actividade, suplemento de idioma e ofertas automaticas. */
const {
  opcoesDaActividade, opcaoEscolhida, opcaoMaisBarata, limitarVeiculos,
  idiomaEfectivo, suplementoIdioma, melhorOferta, ofertaActual,
  nomeOpcao, linhasNotasOpcao,
} = require('../helpers/opcoesActividade');

describe('limitarVeiculos', () => {
  it('sobe_ao_minimo_de_lugares', () => {
    expect(limitarVeiculos(2, 5, 1)).toBe(3);
  });

  it('desce_ao_maximo_de_pessoas', () => {
    expect(limitarVeiculos(2, 5, 9)).toBe(5);
  });

  it('sem_pedido_usa_o_minimo', () => {
    expect(limitarVeiculos(2, 4, undefined)).toBe(2);
  });

  it('pedido_dentro_dos_limites_fica', () => {
    expect(limitarVeiculos(2, 2, 2)).toBe(2);
  });
});

describe('opcoesDaActividade', () => {
  it('so_devolve_opcoes_validas_com_numeros', () => {
    const meta = {
      options: [
        { id: 'a', name_pt: 'Buggy', type: 'per_vehicle', price: 50 },
        { id: 'b', name_pt: 'Gratis', type: 'per_person', price: 0 },
        { id: 'c', name_pt: '2 horas', type: 'per_person', price: '30', price_child: '20' },
        { id: 'd', name_pt: 'Jipe', type: 'per_vehicle', price: '90', seats: '4' },
        { id: 'e', name_pt: 'Estranha', type: 'outra', price: 10 },
      ],
    };
    const r = opcoesDaActividade(meta);
    expect(r.map((o) => o.id)).toEqual(['c', 'd']);
    expect(r[0].price).toBe(30);
    expect(r[0].price_child).toBe(20);
    expect(r[1].seats).toBe(4);
  });

  it('sem_opcoes_lista_vazia', () => {
    expect(opcoesDaActividade({})).toEqual([]);
    expect(opcoesDaActividade(null)).toEqual([]);
  });
});

describe('opcaoEscolhida e opcaoMaisBarata', () => {
  const meta = {
    options: [
      { id: 'a', name_pt: '3 horas', type: 'per_person', price: 45 },
      { id: 'b', name_pt: '2 horas', type: 'per_person', price: 30 },
      { id: 'c', name_pt: 'Privado', type: 'per_group', price: 200 },
    ],
  };

  it('escolhe_pelo_id', () => {
    expect(opcaoEscolhida(meta, 'c').name_pt).toBe('Privado');
    expect(opcaoEscolhida(meta, 'zz')).toBeNull();
    expect(opcaoEscolhida(meta, undefined)).toBeNull();
  });

  it('mais_barata_tem_o_preco_mais_baixo', () => {
    expect(opcaoMaisBarata(meta).id).toBe('b');
    expect(opcaoMaisBarata({})).toBeNull();
  });
});

describe('idioma', () => {
  it('lingua_unica_com_suplemento_e_o_padrao', () => {
    expect(idiomaEfectivo({ languages: ['ES'], language_surcharges: { ES: 20 } }, '')).toBe('ES');
  });

  it('codigo_desconhecido_conta_como_sem_preferencia', () => {
    expect(idiomaEfectivo({ languages: ['PT', 'ES'] }, 'XX')).toBeNull();
  });

  it('codigo_oferecido_fica', () => {
    expect(idiomaEfectivo({ languages: ['PT', 'ES'] }, 'ES')).toBe('ES');
    expect(idiomaEfectivo({ languages: ['PT', 'ES'] }, '')).toBeNull();
  });

  it('suplemento_fixo_por_reserva', () => {
    expect(suplementoIdioma({ language_surcharges: { ES: 20 } }, 'ES')).toBe(20);
    expect(suplementoIdioma({ language_surcharges: { ES: 20 } }, 'PT')).toBe(0);
    expect(suplementoIdioma({}, 'ES')).toBe(0);
    expect(suplementoIdioma({ language_surcharges: { ES: 20 } }, null)).toBe(0);
  });
});

describe('ofertas', () => {
  const meta = {
    offers: [
      { percent: 10, from: '2026-12-01', to: '2026-12-15' },
      { percent: 25, from: '2026-12-05', to: '2026-12-20' },
      { percent: 50, from: '2026-11-01', to: '2026-12-04' },
    ],
  };

  it('melhor_oferta_e_a_de_maior_percentagem', () => {
    expect(melhorOferta(meta, '2026-12-05').percent).toBe(25);
  });

  it('oferta_que_acabou_na_vespera_nao_aplica', () => {
    expect(melhorOferta({ offers: [{ percent: 30, from: '2026-12-01', to: '2026-12-04' }] }, '2026-12-05')).toBeNull();
  });

  it('datas_inclusivas', () => {
    const m = { offers: [{ percent: 15, from: '2026-12-01', to: '2026-12-15' }] };
    expect(melhorOferta(m, '2026-12-01').percent).toBe(15);
    expect(melhorOferta(m, '2026-12-15').percent).toBe(15);
    expect(melhorOferta(m, '2026-11-30')).toBeNull();
    expect(melhorOferta(m, '2026-12-16')).toBeNull();
  });

  it('sem_data_ou_oferta_invalida_nao_aplica', () => {
    expect(melhorOferta(meta, '')).toBeNull();
    expect(melhorOferta({ offers: [{ percent: 95, from: '2026-12-01', to: '2026-12-15' }] }, '2026-12-05')).toBeNull();
    expect(melhorOferta({ offers: [{ percent: 20, from: '2026-12-15', to: '2026-12-01' }] }, '2026-12-05')).toBeNull();
  });

  it('oferta_actual_ignora_a_que_ja_acabou_e_escolhe_a_que_acaba_primeiro', () => {
    const r = ofertaActual(meta, '2026-12-05');
    expect(r.percent).toBe(10);
    expect(r.to).toBe('2026-12-15');
  });

  it('oferta_que_acaba_hoje_ainda_e_actual', () => {
    expect(ofertaActual(meta, '2026-12-04').percent).toBe(50);
    expect(ofertaActual(meta, '2026-12-21')).toBeNull();
  });
});

describe('nomeOpcao e linhasNotasOpcao', () => {
  it('nome_pt_com_recurso_ao_en', () => {
    expect(nomeOpcao({ option: { name_pt: ' Buggy 2h ' } })).toBe('Buggy 2h');
    expect(nomeOpcao({ option: { name_pt: '', name_en: 'Buggy' } })).toBe('Buggy');
    expect(nomeOpcao({ option: null })).toBeNull();
    expect(nomeOpcao(null)).toBeNull();
  });

  it('linhas_das_notas_da_opcao_e_dos_veiculos', () => {
    expect(linhasNotasOpcao({ option: { name_pt: 'Buggy 2h', type: 'per_vehicle' }, vehicles: 3 }))
      .toEqual(['Opção: Buggy 2h', 'Veículos: 3']);
    expect(linhasNotasOpcao({ option: { name_pt: 'Privado', type: 'per_group' }, vehicles: null }))
      .toEqual(['Opção: Privado']);
    expect(linhasNotasOpcao({ option: null })).toEqual([]);
    expect(linhasNotasOpcao(null)).toEqual([]);
  });
});
