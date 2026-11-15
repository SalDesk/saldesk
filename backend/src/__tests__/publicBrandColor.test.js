/* Endpoints publicos do operador devolvem brand_color (cor da pagina publica e do widget). */
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

/* O falso devolve so as colunas pedidas no select (como a base de dados), para que o teste veja o que a API envia */
const estado = { operador: null, selectsDeOperadores: [] };

jest.mock('../config/supabase', () => {
  function colunasDe(sel) {
    const out = [];
    let nivel = 0; let atual = '';
    for (const ch of sel) {
      if (ch === '(') nivel += 1;
      if (ch === ')') nivel -= 1;
      if (ch === ',' && nivel === 0) { out.push(atual.trim()); atual = ''; } else atual += ch;
    }
    if (atual.trim()) out.push(atual.trim());
    return out.map((c) => c.split('(')[0].trim());
  }
  function construir(tabela) {
    const b = { tabela, colunas: null };
    ['eq', 'order', 'in', 'limit', 'or', 'gte'].forEach((m) => { b[m] = jest.fn(() => b); });
    b.select = jest.fn((sel) => {
      if (tabela === 'operators') estado.selectsDeOperadores.push(sel);
      b.colunas = colunasDe(sel || '*');
      return b;
    });
    const resolver = () => {
      if (tabela === 'operators') {
        const linha = {};
        (b.colunas || []).forEach((c) => { if (c in estado.operador) linha[c] = estado.operador[c]; });
        return { data: linha, error: null };
      }
      return { data: tabela === 'units' ? [] : null, error: null };
    };
    b.single = jest.fn(() => Promise.resolve(resolver()));
    b.maybeSingle = jest.fn(() => Promise.resolve(resolver()));
    b.then = (ok, ko) => Promise.resolve(resolver()).then(ok, ko);
    return b;
  }
  return { supabaseAdmin: { from: jest.fn((t) => construir(t)) } };
});

const { getOperador, getUnit } = require('../controllers/publicController');

function resposta() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

beforeEach(() => {
  estado.operador = { id: 'op1', name: 'Sal Aventura', slug: 'demo', onboarding_complete: true, brand_color: '#c2410c', custom_faqs: null };
  estado.selectsDeOperadores = [];
});

describe('endpoints publicos: brand_color', () => {
  it('GET /public/:slug devolve a cor do operador', async () => {
    const res = resposta();
    const next = jest.fn();
    await getOperador({ params: { slug: 'demo' } }, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.json.mock.calls[0][0].data.operator.brand_color).toBe('#c2410c');
  });

  it('GET /public/:slug sem cor definida devolve null (a pagina usa a cor original)', async () => {
    estado.operador.brand_color = null;
    const res = resposta();
    await getOperador({ params: { slug: 'demo' } }, res, jest.fn());
    expect(res.json.mock.calls[0][0].data.operator).toHaveProperty('brand_color', null);
  });

  it('GET do servico (getUnit) tambem pede a cor, para o checkout ficar com a mesma cor', async () => {
    await getUnit({ params: { slug: 'demo', unitId: 'u1' } }, resposta(), jest.fn());
    expect(estado.selectsDeOperadores[0]).toMatch(/\bbrand_color\b/);
  });
});
