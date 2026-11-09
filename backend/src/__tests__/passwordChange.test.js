/* PUT /auth/password e PUT /traveler-auth/password: exigem e verificam a password actual. Sem rede nem base de dados. */

jest.mock('../config/supabase', () => ({
  supabaseAdmin: { auth: { admin: { updateUserById: jest.fn() } } },
  supabaseAnon: {},
}));
jest.mock('../helpers/passwordAtual', () => ({ verificarPasswordActual: jest.fn() }));
jest.mock('../helpers/emailHelper', () => ({ enviarEmail: jest.fn() }));

const { supabaseAdmin } = require('../config/supabase');
const { verificarPasswordActual } = require('../helpers/passwordAtual');
const { schemas } = require('../middleware/validation');
const { authLimiter } = require('../middleware/rateLimiters');
const operadorCtrl = require('../controllers/authController');
const viajanteCtrl = require('../controllers/travelerAuthController');
const operadorRoutes = require('../routes/auth');
const viajanteRoutes = require('../routes/travelerAuth');

const updateUserById = supabaseAdmin.auth.admin.updateUserById;
const resMock = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };
const pedido = () => ({ user: { id: 'u1', email: 'a@x.test' }, ip: '9.9.9.9', body: { current_password: 'Actual1!x', password: 'Nova1234!' } });

beforeEach(() => {
  verificarPasswordActual.mockReset();
  updateUserById.mockReset();
});

describe.each([['operador', operadorCtrl], ['viajante', viajanteCtrl]])('changePassword (%s)', (_, ctrl) => {
  test('verifica a password actual com o email do utilizador e so depois altera a password', async () => {
    verificarPasswordActual.mockResolvedValue({ ok: true });
    updateUserById.mockResolvedValue({ error: null });
    const res = resMock(); const next = jest.fn();
    await ctrl.changePassword(pedido(), res, next);
    expect(verificarPasswordActual).toHaveBeenCalledWith({ email: 'a@x.test', password: 'Actual1!x', ip: '9.9.9.9', tokenRequest: expect.any(Function) });
    expect(updateUserById).toHaveBeenCalledWith('u1', { password: 'Nova1234!' });
    expect(res.json).toHaveBeenCalledWith({ data: null, message: 'Password alterada com sucesso' });
    expect(next).not.toHaveBeenCalled();
  });

  test('password actual errada ou conta bloqueada: devolve o estado e o corpo da verificacao e NAO altera nada', async () => {
    verificarPasswordActual.mockResolvedValue({ ok: false, status: 403, body: { error: 'Password actual incorrecta', code: 'INVALID_CURRENT_PASSWORD' } });
    const res = resMock();
    await ctrl.changePassword(pedido(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Password actual incorrecta', code: 'INVALID_CURRENT_PASSWORD' });
    expect(updateUserById).not.toHaveBeenCalled();
    verificarPasswordActual.mockResolvedValue({ ok: false, status: 423, body: { code: 'ACCOUNT_LOCKED' } });
    const res2 = resMock();
    await ctrl.changePassword(pedido(), res2, jest.fn());
    expect(res2.status).toHaveBeenCalledWith(423);
    expect(updateUserById).not.toHaveBeenCalled();
  });

  test('erro do Supabase ao actualizar: 400 PASSWORD_ERROR', async () => {
    verificarPasswordActual.mockResolvedValue({ ok: true });
    updateUserById.mockResolvedValue({ error: { message: 'fraca' } });
    const res = resMock();
    await ctrl.changePassword(pedido(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'fraca', code: 'PASSWORD_ERROR' });
  });

  test('erro de rede na verificacao vai para o errorHandler e nao altera nada', async () => {
    const erro = new Error('ECONNRESET');
    verificarPasswordActual.mockRejectedValue(erro);
    const next = jest.fn();
    await ctrl.changePassword(pedido(), resMock(), next);
    expect(next).toHaveBeenCalledWith(erro);
    expect(updateUserById).not.toHaveBeenCalled();
  });
});

describe('schema e rotas', () => {
  test('o schema exige current_password alem da password forte', () => {
    expect(schemas.changePassword.validate({ password: 'Nova1234!' }).error).toBeTruthy();
    expect(schemas.changePassword.validate({ current_password: '', password: 'Nova1234!' }).error).toBeTruthy();
    expect(schemas.changePassword.validate({ current_password: 'x', password: 'fraca' }).error).toBeTruthy();
    expect(schemas.changePassword.validate({ current_password: 'x', password: 'Nova1234!' }).error).toBeUndefined();
  });

  test.each([[['a']], [{ a: 1 }], [123], [null], [true]])('o schema recusa current_password que nao seja texto (%j)', (valor) => {
    expect(schemas.changePassword.validate({ current_password: valor, password: 'Nova1234!' }).error).toBeTruthy();
  });

  test('campos a mais (ex.: email) sao descartados e so current_password e password chegam ao controlador', () => {
    const { error, value } = schemas.changePassword.validate({ current_password: 'x', password: 'Nova1234!', email: 'outro@x.test', user_id: 'u9' }, { stripUnknown: true });
    expect(error).toBeUndefined();
    expect(value).toEqual({ current_password: 'x', password: 'Nova1234!' });
  });

  test.each([['operador', operadorRoutes], ['viajante', viajanteRoutes]])('a rota PUT /password do %s leva o authLimiter primeiro', (_, router) => {
    const camada = router.stack.find(l => l.route && l.route.path === '/password' && l.route.methods.put);
    expect(camada).toBeTruthy();
    expect(camada.route.stack[0].handle).toBe(authLimiter);
  });
});
