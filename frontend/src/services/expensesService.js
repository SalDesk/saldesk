import api from './api';

/* ── localStorage keys ── */
const EXP_KEY  = 'saldesk_expenses_v1';
const SAL_CONF = 'saldesk_salary_config_v1';
const SAL_PAY  = 'saldesk_salary_payments_v1';
const OBL_KEY  = 'saldesk_obligations_v1';

function loadList(k)  { try { return JSON.parse(localStorage.getItem(k) || '[]'); }  catch { return []; }  }
function loadObj(k)   { try { return JSON.parse(localStorage.getItem(k) || '{}'); }  catch { return {}; }  }
function saveKey(k,v) { localStorage.setItem(k, JSON.stringify(v)); }

/* ── Expenses ── */

export async function listExpenses() {
  try {
    const { data } = await api.get('/expenses');
    return data.data || [];
  } catch {
    return loadList(EXP_KEY);
  }
}

export function addExpenseLocal(expense) {
  const list = loadList(EXP_KEY);
  const item = {
    ...expense,
    id:         Date.now().toString(),
    created_at: new Date().toISOString(),
  };
  saveKey(EXP_KEY, [...list, item]);
  return item;
}

export function updateExpenseLocal(id, data) {
  const list = loadList(EXP_KEY).map(e => e.id === id ? { ...e, ...data } : e);
  saveKey(EXP_KEY, list);
}

export function deleteExpenseLocal(id) {
  saveKey(EXP_KEY, loadList(EXP_KEY).filter(e => e.id !== id));
}

/* ── Salary configs ── */

export function getSalaryConfig() { return loadObj(SAL_CONF); }

export function setSalaryConfig(staffId, config) {
  const all = loadObj(SAL_CONF);
  saveKey(SAL_CONF, { ...all, [staffId]: config });
}

/* ── Salary payments ── */

export function getSalaryPayments() { return loadList(SAL_PAY); }

export function addSalaryPayment(payment) {
  const list = loadList(SAL_PAY);
  const item = { ...payment, id: Date.now().toString(), paid_at: new Date().toISOString() };
  saveKey(SAL_PAY, [...list, item]);
  return item;
}

export function isMonthPaid(staffId, month, year) {
  return loadList(SAL_PAY).some(p => p.staffId === staffId && p.month === month && p.year === year);
}

/* ── Obligations ── */

export function getObligations() {
  return loadObj(OBL_KEY);
}

export function setObligations(data) {
  saveKey(OBL_KEY, data);
}
