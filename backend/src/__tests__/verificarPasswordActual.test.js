/* Verificacao da password actual antes de a alterar (operador e viajante). Nada aqui toca na rede. */

const { verificarPasswordActual } = require('../helpers/passwordAtual');
const logStore = require('../services/logStore');

const EMAIL = 'op@example.test';
const ok = () => jest.fn().mockResolvedValue({ access_token: 'tok', user: { id: 'u1' } });
const falha = () => jest.fn().mockResolvedValue({ error: 'invalid_grant', error_description: 'Invalid login credentials' });

beforeEach(() => { logStore.clearLoginLock(EMAIL); });

describe('verificarPasswordActual', () => {
  test('password certa: ok, pede o token com o email e a password dadas e limpa as tentativas', async () => {
    logStore.recordFailedLoginAttempt(EMAIL);
    const tokenRequest = ok();
    const r = await verificarPasswordActual({ email: EMAIL, password: 'Certa1!x', ip: '1.1.1.1', tokenRequest });
    expect(r).toEqual({ ok: true });
    expect(tokenRequest).toHaveBeenCalledWith('password', { email: EMAIL, password: 'Certa1!x' });
    expect(logStore.getLoginLockState(EMAIL).count).toBe(0);
  });

  test('password errada: 403 INVALID_CURRENT_PASSWORD com as tentativas que restam e regista a falha', async () => {
    const r = await verificarPasswordActual({ email: EMAIL, password: 'errada', ip: '1.1.1.1', tokenRequest: falha() });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(403);
    expect(r.body).toEqual({ error: 'Password actual incorrecta', code: 'INVALID_CURRENT_PASSWORD', attempts_remaining: logStore.MAX_LOGIN_ATTEMPTS - 1 });
    expect(logStore.getLoginLockState(EMAIL).count).toBe(1);
    expect(logStore.getFailedLogins(1)[0]).toMatchObject({ email: EMAIL, ip: '1.1.1.1' });
  });

  test('resposta sem access_token conta como falha', async () => {
    const r = await verificarPasswordActual({ email: EMAIL, password: 'x', ip: '', tokenRequest: jest.fn().mockResolvedValue({}) });
    expect(r.status).toBe(403);
  });

  test('ao fim de MAX tentativas falhadas a conta bloqueia (423) e deixa de consultar o Supabase', async () => {
    const tokenRequest = falha();
    let r;
    for (let i = 0; i < logStore.MAX_LOGIN_ATTEMPTS; i += 1) {
      r = await verificarPasswordActual({ email: EMAIL, password: 'errada', ip: '', tokenRequest });
    }
    expect(r.status).toBe(423);
    expect(r.body.code).toBe('ACCOUNT_LOCKED');
    expect(r.body.retry_after_seconds).toBeGreaterThan(0);
    tokenRequest.mockClear();
    const bloqueada = await verificarPasswordActual({ email: EMAIL, password: 'Certa1!x', ip: '', tokenRequest: ok() });
    expect(bloqueada.status).toBe(423);
    expect(tokenRequest).not.toHaveBeenCalled();
  });

  test('sem password actual (vazia ou em falta) falha sem chamar o Supabase', async () => {
    for (const password of ['', undefined, null]) {
      const tokenRequest = ok();
      const r = await verificarPasswordActual({ email: EMAIL, password, ip: '', tokenRequest });
      expect(r.ok).toBe(false);
      expect(r.status).toBe(403);
      expect(tokenRequest).not.toHaveBeenCalled();
    }
  });

  test('o email com maiusculas e espacos cai no mesmo bloqueio que o login normalizado', async () => {
    for (let i = 0; i < logStore.MAX_LOGIN_ATTEMPTS; i += 1) {
      await verificarPasswordActual({ email: '  OP@Example.TEST ', password: 'errada', ip: '', tokenRequest: falha() });
    }
    expect(logStore.getLoginLockState(EMAIL).lockedUntil).toBeGreaterThan(Date.now());
    const r = await verificarPasswordActual({ email: EMAIL, password: 'Certa1!x', ip: '', tokenRequest: ok() });
    expect(r.status).toBe(423);
  });

  test('um erro de rede propaga-se (o controlador devolve 500 pelo errorHandler)', async () => {
    await expect(verificarPasswordActual({ email: EMAIL, password: 'x', ip: '', tokenRequest: jest.fn().mockRejectedValue(new Error('ECONNRESET')) })).rejects.toThrow('ECONNRESET');
  });
});
