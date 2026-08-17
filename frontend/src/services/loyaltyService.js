import api from './api';

export async function getLoyaltyConfig() {
  const { data } = await api.get('/loyalty/config');
  return data.data;
}

export async function updateLoyaltyConfig(dados) {
  const { data } = await api.put('/loyalty/config', dados);
  return data.data;
}

export async function getCustomerLoyaltyHistory(customerId) {
  const { data } = await api.get(`/loyalty/customers/${customerId}/history`);
  return data.data;
}

export async function adjustCustomerPoints(customerId, delta, reason) {
  const { data } = await api.post(`/loyalty/customers/${customerId}/adjust`, { delta, reason });
  return data.data;
}

export async function redeemCustomerPoints(customerId) {
  const { data } = await api.post(`/loyalty/customers/${customerId}/redeem`);
  return data.data;
}
