import api from './api';

export async function listVouchers() {
  const { data } = await api.get('/vouchers');
  return data.data;
}

export async function createVoucher(dados) {
  const { data } = await api.post('/vouchers', dados);
  return data.data;
}

export async function updateVoucher(id, dados) {
  const { data } = await api.put(`/vouchers/${id}`, dados);
  return data.data;
}

export async function deleteVoucher(id) {
  await api.delete(`/vouchers/${id}`);
}
