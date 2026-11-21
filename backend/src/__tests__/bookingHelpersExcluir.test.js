/* Exclusao de reservas na verificacao de disponibilidade: um id, varios ids, ou nenhum. */
const { verificarDisponibilidade } = require('../helpers/bookingHelpers');

function mockSupabase() {
  const b = {};
  ['select', 'eq', 'in', 'lt', 'gte', 'neq', 'not'].forEach((m) => { b[m] = jest.fn(() => b); });
  b.then = (ok, ko) => Promise.resolve({ data: [], error: null }).then(ok, ko);
  return { b, sb: { from: jest.fn(() => b) } };
}

describe('verificarDisponibilidade: excluirReservaId', () => {
  test('lista de ids usa .not("id","in","(a,b)")', async () => {
    const { b, sb } = mockSupabase();
    await verificarDisponibilidade(sb, 'u1', '2026-12-01', '2026-12-01', ['a', 'b']);
    expect(b.not).toHaveBeenCalledWith('id', 'in', '(a,b)');
    expect(b.neq).not.toHaveBeenCalled();
  });

  test('um id usa .neq("id","a")', async () => {
    const { b, sb } = mockSupabase();
    await verificarDisponibilidade(sb, 'u1', '2026-12-01', '2026-12-01', 'a');
    expect(b.neq).toHaveBeenCalledWith('id', 'a');
    expect(b.not).not.toHaveBeenCalled();
  });

  test('lista vazia nao acrescenta filtro', async () => {
    const { b, sb } = mockSupabase();
    await verificarDisponibilidade(sb, 'u1', '2026-12-01', '2026-12-01', []);
    expect(b.neq).not.toHaveBeenCalled();
    expect(b.not).not.toHaveBeenCalled();
  });

  test('null nao acrescenta filtro', async () => {
    const { b, sb } = mockSupabase();
    await verificarDisponibilidade(sb, 'u1', '2026-12-01', '2026-12-01', null);
    expect(b.neq).not.toHaveBeenCalled();
    expect(b.not).not.toHaveBeenCalled();
  });
});
