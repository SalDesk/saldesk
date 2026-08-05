import api from './api';

export async function listAffiliates() {
  const { data } = await api.get('/affiliates');
  return data.data;
}

export async function createAffiliate(dados) {
  const { data } = await api.post('/affiliates', dados);
  return data.data;
}

export async function updateAffiliate(id, dados) {
  const { data } = await api.put(`/affiliates/${id}`, dados);
  return data.data;
}

export async function deleteAffiliate(id) {
  await api.delete(`/affiliates/${id}`);
}

export async function createAffiliatePayment(affiliateId, dados) {
  const { data } = await api.post(`/affiliates/${affiliateId}/payments`, dados);
  return data.data;
}

export async function getAffiliateConfig() {
  const { data } = await api.get('/affiliates/config');
  return data.data;
}

export async function updateAffiliateConfig(dados) {
  const { data } = await api.put('/affiliates/config', dados);
  return data.data;
}

export async function affiliatePortalLogin(code, email) {
  const { data } = await api.post('/public/affiliates/login', { code, email });
  return data.data;
}
