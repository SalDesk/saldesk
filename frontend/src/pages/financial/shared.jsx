/* ── constants ── */
export const EUR_CVE = 110;
export const TOUR_COSTS_KEY = 'saldesk_tour_costs_v1';


export const PAYMENT_METHODS = ['Todos', 'paypal', 'sisp', 'cash', 'transfer'];
export const PAYMENT_STATUS  = ['Todos', 'paid', 'pending', 'partial', 'refunded'];
export const PM_LABEL  = { paypal: 'PayPal', sisp: 'SISP', cash: 'Dinheiro', transfer: 'Transferencia' };
export const PS_LABEL  = { paid: 'Pago', pending: 'Pendente', partial: 'Parcial', refunded: 'Reembolsado' };
export const PS_COLOR  = { paid: 'text-[var(--success)] bg-[var(--success-light)]', pending: 'text-[var(--warning)] bg-[var(--warning-light)]', partial: 'text-[var(--info)] bg-[var(--info-light)]', refunded: 'text-n-500 bg-n-100' };
export const SRC_LABEL = { direct: 'Directa', public: 'Directa', manual: 'Manual', booking_com: 'Booking', airbnb: 'Airbnb', viator: 'Viator', getyourguide: 'GYG' };

export const COST_FIELDS = [
  { key: 'guide',     label: 'Guia / Instrutor' },
  { key: 'transport', label: 'Transporte' },
  { key: 'tickets',   label: 'Bilhetes / Entrada' },
  { key: 'meals',     label: 'Refeicoes' },
  { key: 'other',     label: 'Outros' },
];

export const EXPENSE_CATEGORIES = [
  'Salarios', 'Comissoes vendedores', 'Seguro viatura',
  'Manutencao', 'Combustivel', 'Renda', 'Electricidade',
  'Internet', 'Equipamento', 'Marketing', 'Subscricao SalDesk',
  'INPS', 'IUR', 'Outro',
];

export const MANUAL_REVENUE_CATEGORIES = [
  'Venda ao balcao', 'Comissao de parceiro', 'Merchandising',
  'Aluguer de equipamento', 'Patrocinio', 'Evento privado', 'Outro',
];

export const CAT_COLORS = [
  '#0D5470','#1480A8','#3BA7CB','#6DC4E0','#9BCFE0',
  '#D4A82A','#EAD08A','#1A7A4A','#B91C1C','#7C3AED',
  '#D97706','#374151','#6B7280','#9BA3AF',
];

export const MONTHS_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

/* ── date helpers ── */
export function mesAtual() {
  const n = new Date(), y = n.getFullYear(), m = String(n.getMonth() + 1).padStart(2, '0');
  return { inicio: `${y}-${m}-01`, fim: `${y}-${m}-${new Date(y, n.getMonth() + 1, 0).getDate()}` };
}
export function mesAnterior() {
  const n = new Date(), mo = n.getMonth() === 0 ? 11 : n.getMonth() - 1;
  const y  = n.getMonth() === 0 ? n.getFullYear() - 1 : n.getFullYear();
  const ms = String(mo + 1).padStart(2, '0');
  return { inicio: `${y}-${ms}-01`, fim: `${y}-${ms}-${new Date(y, mo + 1, 0).getDate()}` };
}
export function esteAno() {
  const y = new Date().getFullYear();
  return { inicio: `${y}-01-01`, fim: `${y}-12-31` };
}
export function ultimos30() {
  const fim = new Date(); const inicio = new Date(); inicio.setDate(inicio.getDate() - 29);
  const fmt = d => d.toISOString().slice(0, 10);
  return { inicio: fmt(inicio), fim: fmt(fim) };
}

export function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00Z').toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', timeZone: 'UTC' });
}
export function fmtMoney(v, currency) {
  const n = Number(v || 0);
  if (currency === 'CVE') return `${Math.round(n * EUR_CVE).toLocaleString('pt-PT')} CVE`;
  return `€${Math.round(n).toLocaleString('pt-PT')}`;
}

export function loadCosts() {
  try { return JSON.parse(localStorage.getItem(TOUR_COSTS_KEY) || '{}'); } catch { return {}; }
}
export function saveCosts(c) { localStorage.setItem(TOUR_COSTS_KEY, JSON.stringify(c)); }
export function unitTotalCost(c) {
  if (!c) return 0;
  return COST_FIELDS.reduce((s, f) => s + Number(c[f.key] || 0), 0);
}
