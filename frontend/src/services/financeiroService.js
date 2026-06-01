import api from './api';

export async function getResumo(inicio, fim) {
  const { data } = await api.get('/financial/resumo', { params: { inicio, fim } });
  return data.data;
}

export async function getReceita(inicio, fim, granularidade = 'week') {
  const { data } = await api.get('/financial/receita', { params: { inicio, fim, granularidade } });
  return data.data;
}

export async function getUnidades(inicio, fim) {
  const { data } = await api.get('/financial/unidades', { params: { inicio, fim } });
  return data.data;
}

export async function getTopClientes(inicio, fim) {
  const { data } = await api.get('/financial/clientes', { params: { inicio, fim } });
  return data.data;
}

export async function getCanais(inicio, fim) {
  const { data } = await api.get('/financial/canais', { params: { inicio, fim } });
  return data.data;
}

export async function exportExcel(inicio, fim) {
  const response = await api.get('/financial/export', {
    params: { inicio, fim },
    responseType: 'blob',
  });
  const url = URL.createObjectURL(response.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `saldesk-${inicio}-${fim}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function getTransacoes(inicio, fim, params = {}) {
  const { data } = await api.get('/financial/transacoes', { params: { inicio, fim, ...params } });
  return data.data;
}

export async function exportPdf(inicio, fim) {
  const response = await api.get('/financial/export-pdf', {
    params: { inicio, fim },
    responseType: 'blob',
  });
  const url = URL.createObjectURL(response.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `saldesk-${inicio}-${fim}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function getByTour(inicio, fim) {
  const { data } = await api.get('/financial/by-tour', { params: { inicio, fim } });
  return data.data;
}

export async function getForecast() {
  const { data } = await api.get('/financial/forecast');
  return data.data;
}

export async function getStats() {
  const { data } = await api.get('/financial/stats');
  return data.data;
}
