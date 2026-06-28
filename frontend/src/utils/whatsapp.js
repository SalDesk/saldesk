export function buildWhatsAppLink(phone, message) {
  if (!phone) return null;
  const cleaned = phone.replace(/[^\d+]/g, '');
  const numero = cleaned.startsWith('+') ? cleaned.slice(1) : cleaned;
  return `https://wa.me/${numero}?text=${encodeURIComponent(message)}`;
}
