import api from './api';

/* ── Expenses ── */

export async function listExpenses() {
  try {
    const { data } = await api.get('/expenses');
    return data.data || [];
  } catch {
    return [];
  }
}

export async function addExpenseLocal(expense) {
  const { data } = await api.post('/expenses', expense);
  return data.data;
}

export async function updateExpenseLocal(id, patch) {
  const { data } = await api.put(`/expenses/${id}`, patch);
  return data.data;
}

export async function deleteExpenseLocal(id) {
  await api.delete(`/expenses/${id}`);
}

/* ── Salary configs ── */

export async function getSalaryConfig() {
  try {
    const { data } = await api.get('/expenses/salary-configs');
    return data.data || {};
  } catch {
    return {};
  }
}

export async function setSalaryConfig(staffId, config) {
  const { data } = await api.put(`/expenses/salary-configs/${staffId}`, config);
  return data.data;
}

/* ── Salary payments ── */

export async function getSalaryPayments() {
  try {
    const { data } = await api.get('/expenses/salary-payments');
    return data.data || [];
  } catch {
    return [];
  }
}

export async function addSalaryPayment(payment) {
  const { data } = await api.post('/expenses/salary-payments', payment);
  return data.data;
}

/* ── Obligations ── */

export async function getObligations() {
  try {
    const { data } = await api.get('/expenses/obligations');
    return data.data || {};
  } catch {
    return {};
  }
}

export async function setObligations(next) {
  const { data } = await api.put('/expenses/obligations', next);
  return data.data;
}
