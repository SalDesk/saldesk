import api from './api';

export async function listUnits() {
  const { data } = await api.get('/units');
  return data.data;
}

export async function getUnit(id) {
  const { data } = await api.get(`/units/${id}`);
  return data.data;
}

export async function createUnit(dados) {
  const { data } = await api.post('/units', dados);
  return data.data;
}

export async function updateUnit(id, dados) {
  const { data } = await api.put(`/units/${id}`, dados);
  return data.data;
}

export async function deleteUnit(id) {
  await api.delete(`/units/${id}`);
}

export async function createPricingRule(unitId, dados) {
  const { data } = await api.post(`/units/${unitId}/pricing-rules`, dados);
  return data.data;
}

export async function updatePricingRule(unitId, ruleId, dados) {
  const { data } = await api.put(`/units/${unitId}/pricing-rules/${ruleId}`, dados);
  return data.data;
}

export async function deletePricingRule(unitId, ruleId) {
  await api.delete(`/units/${unitId}/pricing-rules/${ruleId}`);
}

export async function toggleUnitStatus(id, status) {
  const { data } = await api.put(`/units/${id}`, { status });
  return data.data;
}
