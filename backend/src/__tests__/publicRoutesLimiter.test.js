/* Leituras da coluna de reserva da actividade (availability-month, quote) nao podem gastar o
   publicLimiter: e o mesmo balde de 100 pedidos / 15 min / IP das reservas, vouchers e
   pagamentos, e turistas no mesmo IP de hotel esgota-lo-iam so a abrir paginas (429 nas
   reservas). Ficam sem limitador, como slot-availability (ver server.js). */
jest.mock('../controllers/publicController', () => new Proxy({}, { get: (alvo, nome) => {
  if (!(nome in alvo)) alvo[nome] = jest.fn();
  return alvo[nome];
} }));
jest.mock('../controllers/paymentController', () => ({
  publicInitSisp: jest.fn(), publicPaypalClientId: jest.fn(), publicCreatePaypalIntent: jest.fn(), publicConfirmPaypalPayment: jest.fn(),
}));
jest.mock('../controllers/vouchersController', () => ({ validarVoucherPublico: jest.fn() }));
jest.mock('../controllers/affiliatesController', () => ({ portalLogin: jest.fn() }));

const router = require('../routes/public');
const { publicLimiter } = require('../middleware/rateLimiters');

function camadasDe(caminho) {
  const camada = router.stack.find((l) => l.route && l.route.path === caminho && l.route.methods.get);
  return camada.route.stack.map((s) => s.handle);
}

describe('rotas publicas de leitura da coluna de reserva', () => {
  it.each([
    '/:slug/units/:unitId/availability-month',
    '/:slug/units/:unitId/quote',
    '/:slug/units/:unitId/slot-availability',
  ])('%s nao usa o publicLimiter', (caminho) => {
    const camadas = camadasDe(caminho);
    expect(camadas).not.toContain(publicLimiter);
    expect(camadas).toHaveLength(1);
  });

  it('as escritas continuam com o publicLimiter', () => {
    const reservas = router.stack.find((l) => l.route && l.route.path === '/:slug/reservations' && l.route.methods.post);
    expect(reservas.route.stack[0].handle).toBe(publicLimiter);
  });
});
