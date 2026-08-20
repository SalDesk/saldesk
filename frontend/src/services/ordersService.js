import api from './api';

export async function listOrders(filtros = {}) {
  const { data } = await api.get('/orders', { params: filtros });
  return data.data;
}

export async function changeOrderStatus(id, status) {
  const { data } = await api.put(`/orders/${id}/status`, { status });
  return data.data;
}
