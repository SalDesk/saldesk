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
