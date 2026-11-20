/* sitemap.xml: alem das paginas fixas e dos operadores, cada experiencia do catalogo e cada
   ponto turistico, com URLs escapadas e sem rebentar se o catalogo ou os pontos falharem. */
jest.mock('../controllers/catalogImageController', () => ({ getCatalogImage: jest.fn() }));
jest.mock('../services/discoverCatalogService', () => ({ getDiscoverCatalog: jest.fn() }));

const estado = { landmarks: [], landmarksErro: null };

jest.mock('../config/supabase', () => {
  function construir(tabela) {
    const b = {};
    ['select', 'eq', 'order'].forEach((m) => { b[m] = jest.fn(() => b); });
    const resolver = () => {
      if (tabela === 'operators') return { data: [{ slug: 'demo', updated_at: '2026-11-01T10:00:00Z' }], error: null };
      if (tabela === 'cms_landmarks') return { data: estado.landmarksErro ? null : estado.landmarks, error: estado.landmarksErro };
      return { data: [], error: null };
    };
    b.then = (ok, ko) => Promise.resolve(resolver()).then(ok, ko);
    return b;
  }
  return { supabaseAdmin: { from: jest.fn((t) => construir(t)) } };
});

const router = require('../routes/seo');
const { getDiscoverCatalog } = require('../services/discoverCatalogService');

function handlerDe(caminho) {
  const camada = router.stack.find((l) => l.route && l.route.path === caminho);
  return camada.route.stack[0].handle;
}

async function sitemap() {
  let corpo = '';
  const res = { setHeader: jest.fn(), status: jest.fn(() => res), send: jest.fn((x) => { corpo = x; return res; }) };
  await handlerDe('/sitemap.xml')({}, res);
  return corpo;
}

beforeEach(() => {
  process.env.FRONTEND_URL = 'https://app.saldesk.cv';
  process.env.WEBSITE_URL = 'https://saldesk.cv';
  estado.landmarks = [{ slug: 'buracona', updated_at: '2026-11-10T09:00:00Z' }];
  estado.landmarksErro = null;
  getDiscoverCatalog.mockReset();
  getDiscoverCatalog.mockResolvedValue([{ operator_slug: 'demo', unit_id: 'u1' }]);
});

describe('sitemap.xml', () => {
  it('sitemap_inclui_experiencias_e_pontos', async () => {
    const xml = await sitemap();
    expect(xml).toContain('<loc>https://app.saldesk.cv/book/demo</loc>');
    expect(xml).toMatch(/<loc>https:\/\/app\.saldesk\.cv\/book\/demo\/servico\/u1<\/loc>\s*\n?\s*<priority>0\.7<\/priority>/);
    expect(xml).toMatch(/<loc>https:\/\/saldesk\.cv\/discover\/ponto\.html\?slug=buracona<\/loc>\s*\n?\s*<lastmod>2026-11-10<\/lastmod>\s*\n?\s*<priority>0\.6<\/priority>/);
  });

  it('sitemap_codifica_cada_parte_do_endereco', async () => {
    /* um & no nome partia o ?slug= em dois parametros; espacos e acentos tambem tem de ir codificados */
    estado.landmarks = [{ slug: 'a&b' }, { slug: 'praia ção' }];
    getDiscoverCatalog.mockResolvedValue([{ operator_slug: 'x"y', unit_id: 'u<1' }]);
    const xml = await sitemap();
    expect(xml).toContain('ponto.html?slug=a%26b</loc>');
    expect(xml).toContain('ponto.html?slug=praia%20%C3%A7%C3%A3o</loc>');
    expect(xml).toContain('/book/x%22y/servico/u%3C1</loc>');
    expect(xml).not.toContain('a&b');
    expect(xml).not.toContain('a&amp;b');
  });

  it('sitemap_sem_catalogo_continua', async () => {
    getDiscoverCatalog.mockRejectedValue(new Error('sem rede'));
    estado.landmarksErro = { message: 'falhou' };
    const xml = await sitemap();
    expect(xml).toContain('<loc>https://app.saldesk.cv/book/demo</loc>');
    expect(xml).toContain('<loc>https://saldesk.cv/discover/</loc>');
    expect(xml).not.toContain('/servico/');
    expect(xml).not.toContain('ponto.html');
  });

  it('experiencia_sem_slug_ou_id_fica_de_fora', async () => {
    getDiscoverCatalog.mockResolvedValue([{ operator_slug: 'demo' }, { unit_id: 'u2' }]);
    const xml = await sitemap();
    expect(xml).not.toContain('/servico/');
  });
});
