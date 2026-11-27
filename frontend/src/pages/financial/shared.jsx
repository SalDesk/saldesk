import { formatarData, formatarNumero } from '../../utils/formatoLingua';

/* ── constants ── */
export const EUR_CVE = 110;
export const TOUR_COSTS_KEY = 'saldesk_tour_costs_v1';


/* Valores gravados ou comparados: 'Todos' e o valor do filtro "todos" das transaccoes; os metodos, os
   estados e os canais vem do servidor. Nunca mudam com a lingua: o rotulo mostrado vem das funcoes rotulo*. */
export const PAYMENT_METHODS = ['Todos', 'paypal', 'sisp', 'cash', 'transfer'];
export const PAYMENT_STATUS  = ['Todos', 'paid', 'pending', 'partial', 'refunded'];
/* Variante do Badge de cada estado de pagamento (o rotulo vem de rotuloEstadoPagamento) */
export const PS_VARIANT = { paid: 'confirmed', pending: 'pending', partial: 'info', refunded: 'default' };

/* Classes do estilo Mare partilhadas pelas paginas do Financeiro: cartao de pagina, caixa interior e titulo de cartao */
export const CARTAO = 'bg-white rounded-[18px] border border-mare-card p-[22px] min-w-0';
export const CAIXA = 'bg-mare-head rounded-[14px] border border-mare-card';
export const TITULO = 'font-display text-lg font-semibold text-ocean-900';
/* Valores numericos (dinheiro, datas, contagens): mono com algarismos alinhados */
export const NUM = 'font-mono tabular-nums';

/* Nomes de marcas: iguais em todas as linguas */
const MARCAS_PAGAMENTO = { paypal: 'PayPal', sisp: 'SISP' };
const MARCAS_CANAL = { booking_com: 'Booking', airbnb: 'Airbnb', viator: 'Viator', getyourguide: 'GYG' };
const METODOS_TRADUZIDOS = ['cash', 'transfer'];
const ESTADOS_PAGAMENTO = ['paid', 'pending', 'partial', 'refunded'];

/* Rotulos de metodo, estado e canal de pagamento; um valor desconhecido mostra-se tal e qual (ou o traco) */
export function rotuloMetodo(metodo, t) {
  if (MARCAS_PAGAMENTO[metodo]) return MARCAS_PAGAMENTO[metodo];
  if (METODOS_TRADUZIDOS.includes(metodo)) return t(`financial.paymentMethods.${metodo}`);
  return metodo || '—';
}
export function rotuloEstadoPagamento(estado, t) {
  return ESTADOS_PAGAMENTO.includes(estado) ? t(`financial.paymentStatus.${estado}`) : (estado || '—');
}
export function rotuloCanal(canal, t) {
  if (canal === 'direct' || canal === 'public') return t('financial.sources.direct');
  if (canal === 'manual') return t('financial.sources.manual');
  return MARCAS_CANAL[canal] || canal || '—';
}

/* Custos por tour guardados no localStorage (TOUR_COSTS_KEY) com estes ids; o rotulo vem de
   financial.costs.fields.<key> */
export const COST_FIELDS = ['guide', 'transport', 'tickets', 'meals', 'other'].map(key => ({ key }));

/* Categorias gravadas em cada despesa e receita manual (e comparadas no codigo): o valor nunca muda com a
   lingua. Em pt mostra-se o proprio valor, como sempre (alguns gravados sem acento); nas outras linguas vai a
   traducao de financial.expenseCategories / financial.revenueCategories. INPS e IUR sao nomes oficiais e
   ficam iguais em todas as linguas. Uma categoria que o mapa nao conhece mostra-se tal e qual. */
export const CATEGORIA_DESPESA_CHAVE = {
  'Salarios': 'salaries', 'Comissoes vendedores': 'sellerCommissions', 'Seguro viatura': 'vehicleInsurance',
  'Manutencao': 'maintenance', 'Combustivel': 'fuel', 'Renda': 'rent', 'Electricidade': 'electricity',
  'Internet': 'internet', 'Equipamento': 'equipment', 'Marketing': 'marketing', 'Subscricao SalDesk': 'saldeskSubscription',
  'INPS': 'inps', 'IUR': 'iur', 'Outro': 'other',
};
export const CATEGORIA_RECEITA_CHAVE = {
  'Venda ao balcao': 'counterSale', 'Comissao de parceiro': 'partnerCommission', 'Merchandising': 'merchandising',
  'Aluguer de equipamento': 'equipmentRental', 'Patrocinio': 'sponsorship', 'Evento privado': 'privateEvent', 'Outro': 'other',
};
export const EXPENSE_CATEGORIES = Object.keys(CATEGORIA_DESPESA_CHAVE);
export const MANUAL_REVENUE_CATEGORIES = Object.keys(CATEGORIA_RECEITA_CHAVE);

function rotuloGuardado(valor, mapa, prefixo, t, lang) {
  if (!valor || lang === 'pt' || !Object.prototype.hasOwnProperty.call(mapa, valor)) return valor;
  return t(`${prefixo}.${mapa[valor]}`);
}
export const rotuloCategoriaDespesa = (valor, t, lang) => rotuloGuardado(valor, CATEGORIA_DESPESA_CHAVE, 'financial.expenseCategories', t, lang);
export const rotuloCategoriaReceita = (valor, t, lang) => rotuloGuardado(valor, CATEGORIA_RECEITA_CHAVE, 'financial.revenueCategories', t, lang);

export const CAT_COLORS = [
  'var(--ocean-700)','var(--ocean-500)','var(--ocean-400)','var(--ocean-300)','var(--ocean-200)',
  'var(--sand-500)','var(--sand-300)','var(--success)','var(--error)','var(--sand-600)',
  'var(--warning)','var(--n700)','var(--n500)','var(--n400)',
];

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
  return formatarData(d, { day: '2-digit', month: 'short' });
}
export function fmtMoney(v, currency) {
  const n = Number(v || 0);
  if (currency === 'CVE') return `${formatarNumero(Math.round(n * EUR_CVE))} CVE`;
  return `€${formatarNumero(Math.round(n))}`;
}

/* Como fmtMoney, mas um valor em falta (null, undefined, texto, NaN) mostra o traco */
export function fmtMoneyOuTraco(v, currency) {
  const n = v == null ? NaN : Number(v);
  return Number.isFinite(n) ? fmtMoney(n, currency) : '—';
}

/* Formatos dos graficos: recebem valores JA na moeda escolhida (o grafico converte os dados antes). */
export function fmtEixo(v, currency) {
  const n = Math.round(Number(v || 0));
  const curto = n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`;
  return currency === 'CVE' ? `${curto} CVE` : `€${curto}`;
}
export function fmtDica(v, currency) {
  const n = Math.round(Number(v || 0));
  return currency === 'CVE' ? `${formatarNumero(n)} CVE` : `€${formatarNumero(n)}`;
}

export function loadCosts() {
  try { return JSON.parse(localStorage.getItem(TOUR_COSTS_KEY) || '{}'); } catch { return {}; }
}
export function saveCosts(c) { localStorage.setItem(TOUR_COSTS_KEY, JSON.stringify(c)); }
export function unitTotalCost(c) {
  if (!c) return 0;
  return COST_FIELDS.reduce((s, f) => s + Number(c[f.key] || 0), 0);
}
