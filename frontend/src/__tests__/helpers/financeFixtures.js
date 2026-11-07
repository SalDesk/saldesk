/* Dados e formatadores comuns aos testes do Financeiro (as formulas sao as da pagina) */
export const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };

export const MES = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`; })();
export const ANO = new Date().getFullYear();

/* o Intl usa espacos finos; o Testing Library normaliza-os para espaco simples */
export const norm = (t) => t.replace(/\s/g, ' ');
export const eur = (n) => norm(`€${Math.round(n).toLocaleString('pt-PT')}`);
export const cve = (n) => norm(`${Math.round(n * 110).toLocaleString('pt-PT')} CVE`);
export function fmtDate(d) {
  return norm(new Date(d + 'T00:00:00Z').toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', timeZone: 'UTC' }));
}
export function ultimos30() {
  const fim = new Date(); const inicio = new Date(); inicio.setDate(inicio.getDate() - 29);
  const fmt = d => d.toISOString().slice(0, 10);
  return { inicio: fmt(inicio), fim: fmt(fim) };
}

export const RESUMO = {
  atual: { receita: 1000, num_reservas: 10, taxa_ocupacao: 50 },
  anterior: { receita: 800, num_reservas: 8, taxa_ocupacao: 40 },
  variacao: { receita: 25, num_reservas: 25, taxa_ocupacao: 10 },
};
export const RECEITA = [
  { periodo: `${MES}-01`, receita: 300, num_reservas: 3 },
  { periodo: `${MES}-02`, receita: 700, num_reservas: 7 },
];
export const UNIDADES = [
  { unit_id: 'u1', name: 'Tour Ilha', receita: 600, num_reservas: 6 },
  { unit_id: 'u2', name: 'Mergulho', receita: 400, num_reservas: 4 },
];
export const CLIENTES = [
  { customer_email: 'ana@x.cv', customer_name: 'Ana Silva', total_gasto: 500 },
  { customer_email: 'bruno@x.cv', customer_name: 'Bruno Costa', total_gasto: 300 },
];
export const CANAIS = [
  { source: 'direct', num_reservas: 6, receita: 600 },
  { source: 'viator', num_reservas: 4, receita: 400 },
];
export const TRANSACOES = [
  { id: 't1', check_in: `${MES}-03`, customer_name: 'Ana Silva', units: { name: 'Tour Ilha' }, source: 'direct', payment_method: 'paypal', payment_status: 'paid', total_price: 200 },
  { id: 't2', check_in: `${MES}-04`, customer_name: 'Bruno Costa', units: { name: 'Mergulho' }, source: 'viator', payment_method: 'cash', payment_status: 'paid', total_price: 150 },
  { id: 't3', check_in: `${MES}-05`, customer_name: 'Carla Dias', units: { name: 'Tour Ilha' }, source: 'manual', payment_method: 'cash', payment_status: 'pending', total_price: 80 },
];
export const FORECAST = {
  confirmed_future_revenue: 500, same_period_last_year: 700, historical_avg: 900,
  weeks: [{ week_label: 'Semana 1', num_reservas: 2, receita: 250 }],
};
export const DESPESAS = [{ id: 'e1', category: 'Renda', amount: 300, date: `${MES}-01`, staff_id: '', is_recurring: false, notes: 'Escritorio' }];
export const MANUAIS = [{ id: 'r1', category: 'Venda ao balcao', amount: 120, date: `${MES}-01`, notes: 'Feira' }];
export const STAFF = [
  { id: 's1', name: 'Rui Lopes', role: 'Guia', status: 'active' },
  { id: 's2', name: 'Vera Mendes', role: 'Vendedor de Praia', status: 'active' },
];
export const COMISSOES = [
  { id: 'c1', amount: 20, status: 'pending', created_at: `${MES}-05T10:00:00Z`, reservations: { units: { name: 'Tour Ilha' } } },
  { id: 'c2', amount: 30, status: 'paid', created_at: `${MES}-06T10:00:00Z`, reservations: { units: { name: 'Mergulho' } } },
];
