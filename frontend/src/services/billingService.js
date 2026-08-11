import api from './api';

export async function createCheckout(plan) {
  const { data } = await api.post('/billing/checkout', { plan });
  return data.data;
}

export async function confirmCheckout(orderId) {
  const { data } = await api.post('/billing/confirm', { order_id: orderId });
  return data.data;
}

export async function getBillingHistory() {
  try {
    const { data } = await api.get('/billing/history');
    return data.data || [];
  } catch {
    return [];
  }
}
