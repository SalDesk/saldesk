/* Dados e formatadores comuns aos testes de Colaboradores (as formulas sao as das paginas) */
export const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };

/* data local relativa a hoje, AAAA-MM-DD (Cabo Verde e UTC-1: usar sempre margem de dias) */
export function dia(n = 0) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString('en-CA');
}

export const COLABORADORES = [
  { id: 's1', name: 'Rui Lopes', role: 'Guia', status: 'active', phone: '+238 991 1111', email: 'rui@x.cv', user_id: 'u1', total_jobs_completed: 12, average_rating: 4.5 },
  { id: 's2', name: 'Ana Tavares', role: 'Instrutor', status: 'inactive', phone: null, email: null, total_jobs_completed: 0, average_rating: 0 },
  { id: 's3', name: 'Vera Mendes', role: 'Vendedor de Praia', status: 'active', email: 'vera@x.cv', commission_pct: 12, seller_zone: 'Espargos' },
];

export const meta = (o) => JSON.stringify(o);
export const ATRIBUICOES = [
  { id: 'a1', status: 'pending', staff_id: 's1', notes_manager: meta({ title: 'Briefing', priority: 'high', due: dia(5), checklist: ['Material', 'Agua'] }) },
  { id: 'a2', status: 'in_progress', staff_id: 's3', notes_manager: meta({ title: 'Levar equipamento', priority: 'low' }) },
  { id: 'a3', status: 'confirmed', staff_id: null, notes_manager: 'Texto simples sem JSON' },
  { id: 'a4', status: 'completed', staff_id: 's1', notes_manager: meta({ title: 'Tarefa feita', priority: 'urgent', due: dia(-5) }) },
  { id: 'a5', status: 'cancelled', staff_id: 's1', notes_manager: meta({ title: 'Tarefa bloqueada', priority: 'medium', due: dia(-5) }) },
  { id: 'a6', status: 'pending', staff_id: 's1', notes_manager: meta({ title: 'Tarefa atrasada', priority: 'medium', due: dia(-4) }) },
];
export const RESERVAS = [
  { id: 'r1', customer_name: 'Maria Cliente', units: { name: 'Buggy Tour' }, check_in: '2026-12-01', status: 'confirmed' },
  { id: 'r2', customer_name: 'Joao Cancelado', units: { name: 'Quad' }, check_in: '2026-12-02', status: 'cancelled' },
  { id: 'r3', customer_name: 'Sem Unidade', units: null, check_in: '2026-12-03', status: 'pending' },
];
export const GRUPOS = [{ id: 'g1', name: 'Equipa Campo' }];
export const AGORA = new Date().toISOString();
export const MENSAGENS = [
  { id: 'm1', sender_id: 's1', content: 'Ola equipa', created_at: AGORA },
  { id: 'm2', sender_id: 'op1', content: 'Bom dia', created_at: AGORA, reply_to_id: 'm1' },
];
