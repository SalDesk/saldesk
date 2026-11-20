/* GET /public/:slug/units/:unitId/reviews: diz se as avaliacoes sao da experiencia ou do operador
   (fallback) e devolve a classificacao propria da experiencia sobre TODAS as suas avaliacoes. */
jest.mock('../helpers/bookingHelpers', () => ({}));
jest.mock('../helpers/customerHelper', () => ({ obterOuCriarCliente: jest.fn() }));
jest.mock('../helpers/emailHelper', () => ({ enviarEmail: jest.fn() }));
jest.mock('../helpers/languageHelper', () => ({ detectarIdioma: jest.fn() }));
jest.mock('../helpers/emailTemplates', () => ({}));
jest.mock('../controllers/vouchersController', () => ({}));
jest.mock('../controllers/affiliatesController', () => ({}));
jest.mock('../helpers/otaSyncHelper', () => ({ dispararSyncImediato: jest.fn() }));
jest.mock('../services/discoverCatalogService', () => ({ getDiscoverCatalog: jest.fn() }));
jest.mock('../services/pushService', () => ({ notifyOperator: jest.fn() }));
jest.mock('../services/socketService', () => ({ emitToOperator: jest.fn() }));

const estado = { reservas: [], daUnidade: [], doOperador: [] };

jest.mock('../config/supabase', () => {
  function construir(tabela) {
    const b = { filtros: {}, sel: '' };
    ['order', 'limit'].forEach((m) => { b[m] = jest.fn(() => b); });
    b.select = jest.fn((s) => { b.sel = s; return b; });
    b.eq = jest.fn((k, v) => { b.filtros[k] = v; return b; });
    b.in = jest.fn((k, v) => { b.filtros[k] = v; return b; });
    const resolver = () => {
      if (tabela === 'operators') return { data: { id: 'op1' }, error: null };
      if (tabela === 'reservations') return { data: estado.reservas, error: null };
      if (tabela === 'customers') return { data: [], error: null };
      if (tabela === 'reviews') {
        if (b.filtros.reservation_id) {
          /* a lista e limitada a 20; a contagem de notas (select so de rating) nao */
          return { data: b.sel === 'rating' ? estado.daUnidade : estado.daUnidade.slice(0, 20), error: null };
        }
        return { data: estado.doOperador, error: null };
      }
      return { data: null, error: null };
    };
    b.single = jest.fn(() => Promise.resolve(resolver()));
    b.then = (ok, ko) => Promise.resolve(resolver()).then(ok, ko);
    return b;
  }
  return { supabaseAdmin: { from: jest.fn((t) => construir(t)) } };
});

const { getUnitReviews } = require('../controllers/publicController');

async function pedir() {
  const res = { status: jest.fn(() => res), json: jest.fn(() => res) };
  const next = jest.fn();
  await getUnitReviews({ params: { slug: 'demo', unitId: 'u1' } }, res, next);
  expect(next).not.toHaveBeenCalled();
  return res.json.mock.calls[0][0];
}

const rev = (rating, i) => ({ id: `r${i}`, rating, comment: 'x', created_at: '2026-11-01', customer_id: null });

beforeEach(() => {
  estado.reservas = [{ id: 'res1' }];
  estado.daUnidade = [];
  estado.doOperador = [];
});

describe('getUnitReviews: ambito e classificacao propria', () => {
  it('avaliacoes_da_unidade_dao_classificacao_sobre_todas', async () => {
    estado.daUnidade = [...Array(20).fill(0).map((_, i) => rev(5, i)), ...Array(5).fill(0).map((_, i) => rev(2, 20 + i))];
    const corpo = await pedir();
    expect(corpo.scope).toBe('unit');
    expect(corpo.data).toHaveLength(20);
    expect(corpo.unit_rating).toEqual({ avg: 4.4, count: 25 });
  });

  it('fallback_do_operador_nao_conta_como_classificacao_da_unidade', async () => {
    estado.doOperador = [rev(5, 1), rev(4, 2)];
    const corpo = await pedir();
    expect(corpo.scope).toBe('operator');
    expect(corpo.data).toHaveLength(2);
    expect(corpo.unit_rating).toBeNull();
  });

  it('sem_avaliacoes_nenhumas', async () => {
    estado.reservas = [];
    const corpo = await pedir();
    expect(corpo.scope).toBeNull();
    expect(corpo.data).toEqual([]);
    expect(corpo.unit_rating).toBeNull();
  });
});
