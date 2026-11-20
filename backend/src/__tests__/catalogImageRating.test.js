/* Imagem do feed de catalogo (Meta/Google): o selo de estrelas e o da propria experiencia,
   nunca a media do operador. Sem avaliacoes proprias, sem selo. */
jest.mock('fs', () => ({ existsSync: jest.fn(() => false), mkdirSync: jest.fn(), writeFileSync: jest.fn(), statSync: jest.fn() }));
jest.mock('axios', () => ({ get: jest.fn(() => Promise.resolve({ data: Buffer.from('img') })) }));

const capturado = { svg: '' };
jest.mock('sharp', () => jest.fn(() => {
  const c = {};
  c.resize = () => c;
  c.toBuffer = () => Promise.resolve(Buffer.from('x'));
  c.composite = (camadas) => { capturado.svg = camadas[0].input.toString(); return c; };
  c.jpeg = () => c;
  return c;
}));

const estado = { avaliacoes: [] };
jest.mock('../config/supabase', () => {
  function construir(tabela) {
    const q = {};
    ['select', 'eq', 'in', 'not', 'order', 'gte'].forEach((m) => { q[m] = jest.fn(() => q); });
    q.maybeSingle = jest.fn(() => Promise.resolve({
      data: tabela === 'units'
        ? { id: 'u1', name: 'Volta a ilha', images: ['https://x/a.jpg'], operator_id: 'op1', base_price: 40, description: '{}', duration_minutes: 240 }
        : { id: 'op1', name: 'Sal Aventura', currency: 'EUR', address: null, islands: { name: 'Sal' } },
      error: null,
    }));
    q.range = jest.fn((de, ate) => Promise.resolve({ data: estado.avaliacoes.slice(de, ate + 1), error: null }));
    q.then = (ok, ko) => Promise.resolve({ count: 0, data: [], error: null }).then(ok, ko);
    return q;
  }
  return { supabaseAdmin: { from: jest.fn((t) => construir(t)) } };
});

const { getCatalogImage } = require('../controllers/catalogImageController');

async function gerar() {
  const res = { setHeader: jest.fn(), status: jest.fn(() => res), end: jest.fn(), send: jest.fn() };
  const next = jest.fn();
  capturado.svg = '';
  await getCatalogImage({ params: { unitId: 'u1' } }, res, next);
  expect(next).not.toHaveBeenCalled();
  return capturado.svg;
}

const av = (rating, unit) => ({ operator_id: 'op1', rating, reservation_id: `r-${unit}-${rating}-${Math.random()}`, reservations: { unit_id: unit } });

describe('getCatalogImage: estrelas da propria experiencia', () => {
  it('selo_com_a_classificacao_da_unidade', async () => {
    estado.avaliacoes = [av(5, 'u1'), av(4, 'u1'), av(1, 'u2'), av(1, 'u2'), av(1, 'u2')];
    const svg = await gerar();
    expect(svg).toContain('★ 4.5 (2)');
  });

  it('sem_avaliacoes_proprias_sem_selo_mesmo_com_as_do_operador', async () => {
    estado.avaliacoes = [av(5, 'u2'), av(5, 'u3')];
    const svg = await gerar();
    expect(svg).not.toContain('★');
  });
});
