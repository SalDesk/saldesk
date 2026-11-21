/* Desconto de uma actividade: a oferta automatica e o codigo nunca somam, ganha o maior. */
jest.mock('../controllers/vouchersController', () => ({
  validarVoucher: jest.fn(),
  registarUsoVoucher: jest.fn(),
}));

const { escolherDesconto } = require('../helpers/descontoActividade');
const { validarVoucher, registarUsoVoucher } = require('../controllers/vouchersController');

const OFERTA = { offers: [{ percent: 25, from: '2026-12-01', to: '2026-12-15' }] };
const base = { operatorId: 'op1', unitId: 'u1', total: 290, date: '2026-12-05' };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('escolherDesconto', () => {
  it('oferta de 25% sobre 290: 217.5, antes 290, linha da oferta', async () => {
    const d = await escolherDesconto({ ...base, meta: OFERTA });
    expect(d.total).toBe(217.5);
    expect(d.before).toBe(290);
    expect(d.line).toEqual({ type: 'discount', source: 'offer', description: 'Oferta especial (-25%)', quantity: 1, total: -72.5 });
    expect(d.voucherId).toBeNull();
    expect(d.voucherIgnored).toBe(false);
    expect(d.error).toBeNull();
    expect(validarVoucher).not.toHaveBeenCalled();
  });

  it('a etiqueta da oferta substitui o texto por omissao', async () => {
    const meta = { offers: [{ ...OFERTA.offers[0], label_pt: 'Oferta de época baixa', label_en: 'Low season' }] };
    const d = await escolherDesconto({ ...base, meta });
    expect(d.line.description).toBe('Oferta de época baixa');
  });

  it('fora das datas da oferta e sem codigo: sem desconto', async () => {
    const d = await escolherDesconto({ ...base, meta: OFERTA, date: '2026-12-16' });
    expect(d).toEqual({ total: 290, before: null, line: null, voucherId: null, voucherIgnored: false, error: null });
  });

  it('codigo de 100 contra oferta de 72.5: ganha o codigo', async () => {
    validarVoucher.mockResolvedValue({ valid: true, discount: 100, voucherId: 'v1' });
    const d = await escolherDesconto({ ...base, meta: OFERTA, voucherCode: ' menos100 ' });
    expect(validarVoucher).toHaveBeenCalledWith('op1', 'menos100', 'u1', 290);
    expect(d.total).toBe(190);
    expect(d.before).toBe(290);
    expect(d.line).toEqual({ type: 'discount', source: 'voucher', description: 'Código MENOS100', quantity: 1, total: -100 });
    expect(d.voucherId).toBe('v1');
    expect(d.voucherIgnored).toBe(false);
    expect(d.error).toBeNull();
  });

  it('codigo de 50 contra a mesma oferta: ganha a oferta e o codigo e ignorado', async () => {
    validarVoucher.mockResolvedValue({ valid: true, discount: 50, voucherId: 'v1' });
    const d = await escolherDesconto({ ...base, meta: OFERTA, voucherCode: 'MENOS50' });
    expect(d.total).toBe(217.5);
    expect(d.line.source).toBe('offer');
    expect(d.voucherIgnored).toBe(true);
    expect(d.voucherId).toBeNull();
    expect(d.error).toBeNull();
  });

  it('codigo esgotado com oferta: ganha a oferta sem erro', async () => {
    validarVoucher.mockResolvedValue({ valid: false, error: 'Codigo esgotado' });
    const d = await escolherDesconto({ ...base, meta: OFERTA, voucherCode: 'ESGOTADO' });
    expect(d.total).toBe(217.5);
    expect(d.line.source).toBe('offer');
    expect(d.voucherIgnored).toBe(true);
    expect(d.voucherId).toBeNull();
    expect(d.error).toBeNull();
  });

  it('codigo esgotado sem oferta: INVALID_VOUCHER e o total fica igual', async () => {
    validarVoucher.mockResolvedValue({ valid: false, error: 'Codigo esgotado' });
    const d = await escolherDesconto({ ...base, meta: {}, voucherCode: 'ESGOTADO' });
    expect(d.error).toEqual({ code: 'INVALID_VOUCHER', message_pt: 'Codigo esgotado', message_en: 'Invalid code' });
    expect(d.total).toBe(290);
    expect(d.before).toBeNull();
    expect(d.line).toBeNull();
    expect(d.voucherId).toBeNull();
  });

  it('codigo valido sem oferta: aplica o codigo como hoje', async () => {
    validarVoucher.mockResolvedValue({ valid: true, discount: 10.5, voucherId: 'v2' });
    const d = await escolherDesconto({ ...base, total: 105, meta: {}, date: null, voucherCode: 'BEMVINDO' });
    expect(d.total).toBe(94.5);
    expect(d.before).toBe(105);
    expect(d.voucherId).toBe('v2');
  });

  it('nunca regista o uso do codigo', async () => {
    validarVoucher.mockResolvedValue({ valid: true, discount: 100, voucherId: 'v1' });
    await escolherDesconto({ ...base, meta: OFERTA, voucherCode: 'MENOS100' });
    expect(registarUsoVoucher).not.toHaveBeenCalled();
  });
});
