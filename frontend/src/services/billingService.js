import api from './api';

export async function createSubscription(plan) {
  const { data } = await api.post('/billing/subscribe', { plan });
  return data.data;
}

export async function confirmSubscription(subscriptionId) {
  const { data } = await api.post('/billing/subscription/confirm', { subscription_id: subscriptionId });
  return data.data;
}

export async function cancelSubscription() {
  const { data } = await api.post('/billing/subscription/cancel');
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
