/* Depois de mudar a password, as outras sessoes (tokens/refresh tokens) deixam de valer. Sem rede. */

const { revogarOutrasSessoes } = require('../helpers/sessoes');

const supabase = (signOut) => ({ auth: { admin: { signOut } } });

describe('revogarOutrasSessoes', () => {
  test('pede ao Supabase para terminar as outras sessoes, mantendo a do token dado', async () => {
    const signOut = jest.fn().mockResolvedValue({ data: null, error: null });
    await expect(revogarOutrasSessoes(supabase(signOut), 'jwt-actual')).resolves.toBe(true);
    expect(signOut).toHaveBeenCalledWith('jwt-actual', 'others');
  });

  test('erro devolvido pelo Supabase: false, sem lancar (a password ja foi mudada)', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const signOut = jest.fn().mockResolvedValue({ data: null, error: { message: 'x' } });
    await expect(revogarOutrasSessoes(supabase(signOut), 'jwt')).resolves.toBe(false);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  test('excepcao de rede: false, sem lancar', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const signOut = jest.fn().mockRejectedValue(new Error('ECONNRESET'));
    await expect(revogarOutrasSessoes(supabase(signOut), 'jwt')).resolves.toBe(false);
    spy.mockRestore();
  });

  test('sem token nao chama o Supabase e devolve false', async () => {
    const signOut = jest.fn();
    for (const token of ['', undefined, null]) {
      await expect(revogarOutrasSessoes(supabase(signOut), token)).resolves.toBe(false);
    }
    expect(signOut).not.toHaveBeenCalled();
  });
});
