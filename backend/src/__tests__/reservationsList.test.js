// Mocks dos modulos pesados que o controller importa (sem efeitos secundarios em jest)
jest.mock('../messaging/outbox', () => ({ cancelarPorReserva: jest.fn() }));
jest.mock('../helpers/bookingHelpers', () => ({}));
jest.mock('../helpers/customerHelper', () => ({}));
jest.mock('../helpers/emailHelper', () => ({ enviarEmail: jest.fn() }));
jest.mock('../helpers/emailTemplates', () => ({}));
jest.mock('../helpers/otaSyncHelper', () => ({ dispararSyncImediato: jest.fn() }));
jest.mock('../helpers/travelerNotificationHelper', () => ({ criarNotificacaoViajante: jest.fn() }));
jest.mock('../utils/urls', () => ({ frontendBase: jest.fn() }));

// Builder falso encadeavel: regista chamadas e resolve { data: [], error: null } ao fazer await
jest.mock('../config/supabase', () => {
  const builder = {
    from: jest.fn(() => builder),
    then: (resolve, reject) => Promise.resolve({ data: [], error: null }).then(resolve, reject),
  };
  ['select', 'eq', 'order', 'gte', 'lte', 'in', 'limit'].forEach((m) => {
    builder[m] = jest.fn(() => builder);
  });
  return { supabaseAdmin: builder };
});

const { supabaseAdmin } = require('../config/supabase');
const { listar } = require('../controllers/reservationsController');

function criarRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

async function chamar(query) {
  const req = { operator: { id: 'op1' }, query };
  const res = criarRes();
  const next = jest.fn();
  await listar(req, res, next);
  return { res, next };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /reservations (listar)', () => {
  it('stay_from e stay_to chegam ao builder como lte(check_in) e gte(check_out)', async () => {
    const { res } = await chamar({ stay_from: '2026-11-03', stay_to: '2026-11-05' });
    expect(supabaseAdmin.lte).toHaveBeenCalledWith('check_in', '2026-11-05');
    expect(supabaseAdmin.gte).toHaveBeenCalledWith('check_out', '2026-11-03');
    expect(res.json).toHaveBeenCalledWith({ data: [], message: 'Reservas listadas' });
  });

  it('payment_status aceita uma lista separada por virgulas e chega ao builder como in()', async () => {
    const { res } = await chamar({ payment_status: 'pending,partial' });
    expect(supabaseAdmin.in).toHaveBeenCalledWith('payment_status', ['pending', 'partial']);
    expect(res.json).toHaveBeenCalledWith({ data: [], message: 'Reservas listadas' });
  });

  it('payment_status com um so valor (e espacos a volta) tambem funciona', async () => {
    await chamar({ payment_status: ' paid ' });
    expect(supabaseAdmin.in).toHaveBeenCalledWith('payment_status', ['paid']);
  });

  it('sem payment_status nao ha filtro de pagamento', async () => {
    await chamar({ status: 'confirmed' });
    expect(supabaseAdmin.in).not.toHaveBeenCalled();
  });

  it('payment_status invalido responde 400 INVALID_PAYMENT_STATUS sem chamar a base de dados', async () => {
    for (const valor of ['pending;drop', 'pending,', 'a b', "x'y", ',,']) {
      jest.clearAllMocks();
      const { res, next } = await chamar({ payment_status: valor });
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_PAYMENT_STATUS' }));
      expect(supabaseAdmin.from).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    }
  });

  it('por omissao ordena por check_in decrescente e nao limita', async () => {
    await chamar({});
    expect(supabaseAdmin.order).toHaveBeenCalledWith('check_in', { ascending: false });
    expect(supabaseAdmin.limit).not.toHaveBeenCalled();
  });

  it('order_by=created_at ordena pelas mais recentemente criadas', async () => {
    await chamar({ order_by: 'created_at' });
    expect(supabaseAdmin.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(supabaseAdmin.order).not.toHaveBeenCalledWith('check_in', expect.anything());
  });

  it('limit chega ao builder como numero', async () => {
    await chamar({ order_by: 'created_at', limit: '5' });
    expect(supabaseAdmin.limit).toHaveBeenCalledWith(5);
  });

  it('order_by ou limit invalidos respondem 400 sem chamar a base de dados', async () => {
    const casos = [
      [{ order_by: 'customer_email' }, 'INVALID_ORDER_BY'],
      [{ order_by: 'created_at;drop' }, 'INVALID_ORDER_BY'],
      [{ limit: '0' }, 'INVALID_LIMIT'], [{ limit: '-3' }, 'INVALID_LIMIT'], [{ limit: 'abc' }, 'INVALID_LIMIT'],
      [{ limit: '5.5' }, 'INVALID_LIMIT'], [{ limit: '1000' }, 'INVALID_LIMIT'],
    ];
    for (const [query, codigo] of casos) {
      jest.clearAllMocks();
      const { res, next } = await chamar(query);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: codigo }));
      expect(supabaseAdmin.from).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    }
  });

  it('data invalida responde 400 INVALID_DATE sem chamar a base de dados', async () => {
    const { res, next } = await chamar({ stay_from: '2026-02-30' });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_DATE' }));
    expect(res.json.mock.calls[0][0].error).toContain('stay_from');
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('intervalo invertido responde 400 INVALID_RANGE', async () => {
    const { res } = await chamar({ stay_from: '2026-11-10', stay_to: '2026-11-03' });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_RANGE' }));
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('sem parametros de data so chama eq(operator_id) e order', async () => {
    await chamar({});
    expect(supabaseAdmin.eq.mock.calls).toEqual([['operator_id', 'op1']]);
    expect(supabaseAdmin.order).toHaveBeenCalledWith('check_in', { ascending: false });
    expect(supabaseAdmin.gte).not.toHaveBeenCalled();
    expect(supabaseAdmin.lte).not.toHaveBeenCalled();
  });

  it('from e to (usados por outras paginas) continuam ignorados', async () => {
    await chamar({ from: '2026-11-03', to: '2026-11-03' });
    expect(supabaseAdmin.gte).not.toHaveBeenCalled();
    expect(supabaseAdmin.lte).not.toHaveBeenCalled();
  });

  it('status e unit_id continuam a ser aplicados', async () => {
    await chamar({ status: 'confirmed', unit_id: 'u1', stay_to: '2026-11-03' });
    expect(supabaseAdmin.eq).toHaveBeenCalledWith('status', 'confirmed');
    expect(supabaseAdmin.eq).toHaveBeenCalledWith('unit_id', 'u1');
    expect(supabaseAdmin.lte).toHaveBeenCalledWith('check_in', '2026-11-03');
  });

  it('check_in_from e check_in_to continuam a funcionar', async () => {
    await chamar({ check_in_from: '2026-11-01', check_in_to: '2026-11-30' });
    expect(supabaseAdmin.gte).toHaveBeenCalledWith('check_in', '2026-11-01');
    expect(supabaseAdmin.lte).toHaveBeenCalledWith('check_in', '2026-11-30');
  });
});
