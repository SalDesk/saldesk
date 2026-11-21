/* createOrder leva o id da reserva em custom_id: o webhook encontra a reserva mesmo
   quando a ordem capturada ja nao e a ultima guardada (paypal_order_id). */
jest.mock('axios', () => ({ post: jest.fn() }));

const axios = require('axios');
const { createOrder } = require('../services/paypalService');

beforeEach(() => {
  axios.post.mockReset();
  axios.post.mockImplementation(async (url) => (
    url.endsWith('/v1/oauth2/token')
      ? { data: { access_token: 'TOKEN' } }
      : { data: { id: 'ORDER1', status: 'CREATED' } }
  ));
});

const corpoDaOrdem = () => axios.post.mock.calls.find(([url]) => url.endsWith('/v2/checkout/orders'))[1];

describe('createOrder', () => {
  it('com customId envia purchase_units[0].custom_id', async () => {
    const ordem = await createOrder('cid', 'csec', '200', 'EUR', 'Reserva SalDesk r1', 'r1');
    expect(ordem).toEqual({ id: 'ORDER1', status: 'CREATED' });
    expect(corpoDaOrdem().purchase_units[0]).toEqual({
      amount: { currency_code: 'EUR', value: '200.00' },
      description: 'Reserva SalDesk r1',
      custom_id: 'r1',
    });
  });

  it('sem customId nao envia custom_id', async () => {
    await createOrder('cid', 'csec', 50);
    expect(corpoDaOrdem().purchase_units[0]).toEqual({
      amount: { currency_code: 'EUR', value: '50.00' },
      description: 'SalDesk Reservation',
    });
  });
});
