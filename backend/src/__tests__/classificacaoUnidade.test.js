/* Classificacao propria de cada experiencia (unidade): media e contagem das avaliacoes
   publicas das reservas dessa unidade. Nunca mistura com as de outras unidades. */
const { classificacaoPorUnidade } = require('../helpers/classificacaoUnidade');

const RESERVAS = [{ id: 'r1', unit_id: 'u1' }, { id: 'r2', unit_id: 'u1' }, { id: 'r3', unit_id: 'u2' }];

describe('classificacaoPorUnidade', () => {
  it('media_e_contagem_por_unidade', () => {
    const c = classificacaoPorUnidade(
      [{ rating: 5, reservation_id: 'r1' }, { rating: 4, reservation_id: 'r2' }, { rating: 4, reservation_id: 'r1' }, { rating: 3, reservation_id: 'r3' }],
      RESERVAS,
    );
    expect(c).toEqual({ u1: { avg: 4.3, count: 3 }, u2: { avg: 3, count: 1 } });
  });

  it('avaliacao_sem_reserva_nao_conta', () => {
    const c = classificacaoPorUnidade(
      [{ rating: 5, reservation_id: null }, { rating: 1, reservation_id: 'apagada' }, { rating: 4, reservation_id: 'r3' }],
      RESERVAS,
    );
    expect(c).toEqual({ u2: { avg: 4, count: 1 } });
  });

  it('notas_invalidas_ignoradas', () => {
    const c = classificacaoPorUnidade(
      [{ rating: null, reservation_id: 'r1' }, { rating: 0, reservation_id: 'r1' }, { rating: 6, reservation_id: 'r1' }, { rating: '5', reservation_id: 'r1' }],
      RESERVAS,
    );
    expect(c).toEqual({ u1: { avg: 5, count: 1 } });
  });

  it('sem_avaliacoes_devolve_vazio', () => {
    expect(classificacaoPorUnidade([], RESERVAS)).toEqual({});
    expect(classificacaoPorUnidade(null, null)).toEqual({});
  });
});

/* Leitura das avaliacoes publicas para as estrelas: por paginas (o PostgREST corta em 1000
   linhas) e com a unidade vinda da reserva na mesma consulta (sem listas enormes no URL) */
const { lerAvaliacoesPublicas, classificacaoDaUnidade } = require('../helpers/classificacaoUnidade');

function falsoSupabase(linhas, { erroNaPagina } = {}) {
  const chamadas = [];
  return {
    chamadas,
    from(tabela) {
      const q = { tabela, filtros: {} };
      q.select = (s) => { q.sel = s; return q; };
      q.in = (k, v) => { q.filtros[k] = v; return q; };
      q.eq = (k, v) => { q.filtros[k] = v; return q; };
      q.not = () => q;
      q.order = () => q;
      q.range = (de, ate) => {
        chamadas.push({ tabela, sel: q.sel, filtros: q.filtros, de, ate });
        const pagina = Math.floor(de / 1000);
        if (erroNaPagina === pagina) return Promise.resolve({ data: null, error: { message: 'falhou' } });
        return Promise.resolve({ data: linhas.slice(de, ate + 1), error: null });
      };
      return q;
    },
  };
}

describe('lerAvaliacoesPublicas', () => {
  const linha = (i, unit) => ({ operator_id: 'op1', rating: 5, reservation_id: `r${i}`, reservations: { unit_id: unit } });

  it('le_todas_as_paginas_e_traz_a_unidade', async () => {
    const linhas = Array.from({ length: 1001 }, (_, i) => linha(i, i === 1000 ? 'u2' : 'u1'));
    const sb = falsoSupabase(linhas);
    const av = await lerAvaliacoesPublicas(sb, ['op1']);
    expect(av).toHaveLength(1001);
    expect(av[1000]).toEqual({ operator_id: 'op1', rating: 5, reservation_id: 'r1000', unit_id: 'u2' });
    expect(sb.chamadas).toHaveLength(2);
    expect(sb.chamadas[0].sel).toContain('reservations(unit_id)');
    expect(sb.chamadas[0].filtros).toMatchObject({ operator_id: ['op1'], is_public: true });
    expect(classificacaoDaUnidade(av, 'u1')).toEqual({ avg: 5, count: 1000 });
    expect(classificacaoDaUnidade(av, 'u2')).toEqual({ avg: 5, count: 1 });
    expect(classificacaoDaUnidade(av, 'u3')).toBeNull();
  });

  it('erro_regista_e_devolve_o_que_leu', async () => {
    const aviso = jest.spyOn(console, 'error').mockImplementation(() => {});
    const linhas = Array.from({ length: 1500 }, (_, i) => linha(i, 'u1'));
    const av = await lerAvaliacoesPublicas(falsoSupabase(linhas, { erroNaPagina: 1 }), ['op1']);
    expect(av).toHaveLength(1000);
    expect(aviso).toHaveBeenCalled();
    aviso.mockRestore();
  });

  it('sem_operadores_nao_consulta', async () => {
    const sb = falsoSupabase([]);
    expect(await lerAvaliacoesPublicas(sb, [])).toEqual([]);
    expect(sb.chamadas).toHaveLength(0);
  });
});
