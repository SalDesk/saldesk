/* unreadCount: so conta mensagens recebidas. As do operador (manager) e as enviadas pelo sistema em nome dele
   (resposta automatica do chat do site, sender_type 'system') nunca contam como nao lidas.
   A base de dados e um falso em memoria que aplica os filtros a sério. */
const linhas = [];

jest.mock('../config/supabase', () => {
  function construir() {
    const filtros = [];
    const b = {};
    b.select = jest.fn(() => b);
    b.eq = jest.fn((col, v) => { filtros.push((r) => r[col] === v); return b; });
    b.neq = jest.fn((col, v) => { filtros.push((r) => r[col] !== v); return b; });
    b.not = jest.fn((col, op, lista) => {
      const valores = String(lista).replace(/[()]/g, '').split(',');
      filtros.push((r) => !(op === 'in' && valores.includes(String(r[col]))));
      return b;
    });
    b.then = (ok, ko) => Promise.resolve({ count: linhas.filter((r) => filtros.every((f) => f(r))).length, error: null }).then(ok, ko);
    return b;
  }
  return { supabaseAdmin: { from: jest.fn(() => construir()) } };
});

const { unreadCount } = require('../controllers/messageController');

function resposta() {
  const res = {};
  res.json = jest.fn(() => res);
  return res;
}

async function contar() {
  const res = resposta();
  const next = jest.fn();
  await unreadCount({ operator: { id: 'op1' } }, res, next);
  expect(next).not.toHaveBeenCalled();
  return res.json.mock.calls[0][0].data.count;
}

beforeEach(() => {
  linhas.length = 0;
});

describe('unreadCount', () => {
  it('conta as mensagens recebidas nao lidas (visitante e equipa)', async () => {
    linhas.push(
      { operator_id: 'op1', is_read: false, sender_type: 'guest' },
      { operator_id: 'op1', is_read: false, sender_type: 'staff' },
      { operator_id: 'op1', is_read: true, sender_type: 'guest' },
      { operator_id: 'op2', is_read: false, sender_type: 'guest' },
    );
    expect(await contar()).toBe(2);
  });

  it('ignora as mensagens do proprio operador', async () => {
    linhas.push({ operator_id: 'op1', is_read: false, sender_type: 'manager' });
    expect(await contar()).toBe(0);
  });

  it('ignora a resposta automatica do chat do site (sender_type system)', async () => {
    linhas.push(
      { operator_id: 'op1', is_read: false, sender_type: 'system' },
      { operator_id: 'op1', is_read: false, sender_type: 'guest' },
    );
    expect(await contar()).toBe(1);
  });
});
