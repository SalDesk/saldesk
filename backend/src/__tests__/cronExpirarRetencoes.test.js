/* Cron: expirarRetencoes chama a expiracao e nunca deixa o erro escapar. */
jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('../services/pedidoAvaliacaoService', () => ({ enviarPedidosAutomaticos: jest.fn() }));
jest.mock('../config/supabase', () => ({ supabaseAdmin: {} }));
jest.mock('../helpers/emailHelper', () => ({ enviarEmail: jest.fn() }));
jest.mock('../messaging/service', () => ({ enfileirarAutomacao: jest.fn() }));
jest.mock('../messaging/context', () => ({ nomeDoGuia: jest.fn() }));
jest.mock('../helpers/lugarRetido', () => ({ expirarReservasNaoPagas: jest.fn() }));

const cron = require('node-cron');
const { expirarReservasNaoPagas } = require('../helpers/lugarRetido');
const { expirarRetencoes, iniciarCron } = require('../services/cronService');

beforeEach(() => { jest.clearAllMocks(); });

test('expirarRetencoes chama expirarReservasNaoPagas', async () => {
  expirarReservasNaoPagas.mockResolvedValue(0);
  await expirarRetencoes();
  expect(expirarReservasNaoPagas).toHaveBeenCalledTimes(1);
});

test('expirarRetencoes engole o erro', async () => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  expirarReservasNaoPagas.mockRejectedValue(new Error('falhou'));
  await expect(expirarRetencoes()).resolves.toBeUndefined();
  spy.mockRestore();
});

test('esta agendada de 5 em 5 minutos', () => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  iniciarCron();
  expect(cron.schedule).toHaveBeenCalledWith('*/5 * * * *', expirarRetencoes, { timezone: 'Atlantic/Cape_Verde' });
});
