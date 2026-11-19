/* Politica de cancelamento mostrada ao turista (pagina de servico, caixa de aceitacao antes de
   pagar e rodape de conformidade). Ordem: texto escrito pelo operador nessa lingua > texto escrito
   na outra lingua > texto gerado pelo prazo (free_cancellation_hours) > null (aviso "ainda nao
   definiu"). O gerado so entra sem texto escrito, para nunca haver duas politicas diferentes.
   Spec: docs/superpowers/specs/2026-11-19-cancelamento-confirmacao-recolha-design.md */

const COM_PRAZO = {
  pt: (prazo) => `Cancelamento gratuito até ${prazo} antes do início. Depois desse prazo, o valor pago não é reembolsado.`,
  en: (prazo) => `Free cancellation up to ${prazo} before the start. After that, the amount paid is not refunded.`,
};
const SEM_CANCELAMENTO = {
  pt: 'Esta reserva não tem cancelamento gratuito: o valor pago não é reembolsado em caso de cancelamento.',
  en: 'This booking has no free cancellation: the amount paid is not refunded if you cancel.',
};

export function textoPoliticaGerada(horas, lang) {
  const l = lang === 'en' ? 'en' : 'pt';
  if (horas === 0) return SEM_CANCELAMENTO[l];
  if (horas === 168) return COM_PRAZO[l](l === 'en' ? '7 days' : '7 dias');
  if ([24, 48, 72].includes(horas)) return COM_PRAZO[l](l === 'en' ? `${horas} hours` : `${horas} horas`);
  return null;
}

function escrito(texto) {
  return typeof texto === 'string' && texto.trim() ? texto : null;
}

export function textoPoliticaCancelamento(op, lang) {
  if (!op) return null;
  const pt = escrito(op.cancellation_policy_pt);
  const en = escrito(op.cancellation_policy_en);
  const propria = lang === 'en' ? (en || pt) : (pt || en);
  return propria || textoPoliticaGerada(op.free_cancellation_hours, lang);
}
