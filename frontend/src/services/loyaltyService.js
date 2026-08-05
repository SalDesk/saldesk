import api from './api';

export async function getLoyaltyConfig() {
  const { data } = await api.get('/loyalty/config');
  return data.data;
}

export async function updateLoyaltyConfig(dados) {
  const { data } = await api.put('/loyalty/config', dados);
  return data.data;
}
