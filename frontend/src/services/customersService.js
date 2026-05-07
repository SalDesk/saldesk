import api from './api';

export async function listCustomers(filtros = {}) {
  const { data } = await api.get('/customers', { params: filtros });
  return data.data;
}

export async function getCustomer(id) {
  const { data } = await api.get(`/customers/${id}`);
  return data.data;
}

export async function updateCustomer(id, dados) {
  const { data } = await api.put(`/customers/${id}`, dados);
  return data.data;
}

export async function getSegments() {
  const { data } = await api.get('/customers/segments');
  return data.data;
}

export async function exportCustomersCsv() {
  const response = await api.get('/customers/export', { responseType: 'blob' });
  const url = URL.createObjectURL(response.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `clientes-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
