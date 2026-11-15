/* PUT /onboarding/operator (updateOperator): validacao e gravacao de brand_color. */
jest.mock('../helpers/emailHelper', () => ({ enviarEmail: jest.fn() }));
jest.mock('../helpers/emailTemplates', () => ({ operatorWelcomeEmail: jest.fn() }));

const estado = { atualizacao: null };
jest.mock('../config/supabase', () => {
  const b = {};
  ['from', 'eq', 'select'].forEach((m) => { b[m] = jest.fn(() => b); });
  b.update = jest.fn((valores) => { estado.atualizacao = valores; return b; });
  b.single = jest.fn(() => Promise.resolve({ data: { id: 'op1', ...estado.atualizacao }, error: null }));
  return { supabaseAdmin: b };
});

const { supabaseAdmin } = require('../config/supabase');
const { updateOperator } = require('../controllers/onboardingController');

function resposta() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

async function guardar(corpo) {
  const req = { operator: { id: 'op1', name: 'Sal Aventura', slug: 'sal-aventura' }, body: corpo };
  const res = resposta();
  const next = jest.fn();
  await updateOperator(req, res, next);
  return { res, next };
}

beforeEach(() => {
  jest.clearAllMocks();
  estado.atualizacao = null;
});

describe('updateOperator: brand_color', () => {
  it('guarda a cor normalizada em minusculas', async () => {
    const { res } = await guardar({ brand_color: '#C2410C' });
    expect(supabaseAdmin.update).toHaveBeenCalledTimes(1);
    expect(estado.atualizacao.brand_color).toBe('#c2410c');
    expect(res.status).not.toHaveBeenCalled();
  });

  it('null ou texto vazio repoe a cor original (grava null)', async () => {
    await guardar({ brand_color: null });
    expect(estado.atualizacao).toHaveProperty('brand_color', null);
    await guardar({ brand_color: '' });
    expect(estado.atualizacao).toHaveProperty('brand_color', null);
  });

  it('sem o campo nao mexe na cor existente', async () => {
    await guardar({ tagline: 'Novo' });
    expect(estado.atualizacao).not.toHaveProperty('brand_color');
  });

  it.each([
    ['formato invalido', 'azul'],
    ['css a mais', '#0d5470;background:red'],
    ['demasiado clara', '#ffe680'],
    ['nao e texto', 12345],
  ])('recusa com 400 INVALID_BRAND_COLOR e nao grava: %s', async (_nome, valor) => {
    const { res, next } = await guardar({ brand_color: valor });
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_BRAND_COLOR' }));
    expect(supabaseAdmin.update).not.toHaveBeenCalled();
  });
});
