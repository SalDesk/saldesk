/* Desconto de uma reserva: a oferta automatica da actividade (meta.offers) ou o codigo
   (voucher), nunca os dois. Ganha o que der o maior desconto; num empate fica a oferta,
   que nao gasta o codigo. Partilhado pela cotacao (cotarActividade) e pela reserva
   publica (criarReserva), para o valor mostrado ser o cobrado. Nunca regista o uso do
   codigo: isso fica com criarReserva (logo em dinheiro, no pagamento com cartao). */
const { validarVoucher } = require('../controllers/vouchersController');
const { melhorOferta } = require('./opcoesActividade');

const arred = (n) => Math.round(n * 100) / 100;

async function escolherDesconto({ operatorId, unitId, meta, total, date, voucherCode } = {}) {
  const base = Number(total) || 0;
  const codigo = voucherCode === undefined || voucherCode === null ? '' : String(voucherCode).trim();
  const semDesconto = { total: base, before: null, line: null, voucherId: null, voucherIgnored: false, error: null };

  const oferta = melhorOferta(meta || {}, date);
  const descontoOferta = oferta ? arred(base * oferta.percent / 100) : 0;
  const comOferta = descontoOferta > 0 ? {
    total: arred(Math.max(0, base - descontoOferta)),
    before: base,
    line: {
      type: 'discount',
      source: 'offer',
      description: oferta.label_pt || `Oferta especial (-${oferta.percent}%)`,
      quantity: 1,
      total: -descontoOferta,
    },
    voucherId: null,
    voucherIgnored: false,
    error: null,
  } : null;

  if (!codigo) return comOferta || semDesconto;

  const resultado = await validarVoucher(operatorId, codigo, unitId, base);
  const descontoCodigo = resultado && resultado.valid ? Number(resultado.discount) || 0 : 0;

  // Codigo valido e melhor que a oferta (ou sem oferta): aplica o codigo
  if (resultado && resultado.valid && (!comOferta || descontoCodigo > descontoOferta)) {
    return {
      total: arred(Math.max(0, base - descontoCodigo)),
      before: base,
      line: { type: 'discount', source: 'voucher', description: `Código ${codigo.toUpperCase()}`, quantity: 1, total: -descontoCodigo },
      voucherId: resultado.voucherId,
      voucherIgnored: false,
      error: null,
    };
  }

  // A oferta ganha: o codigo e ignorado por completo, mesmo invalido ou esgotado
  if (comOferta) return { ...comOferta, voucherIgnored: true };

  return {
    ...semDesconto,
    error: { code: 'INVALID_VOUCHER', message_pt: (resultado && resultado.error) || 'Código inválido', message_en: 'Invalid code' },
  };
}

module.exports = { escolherDesconto };
