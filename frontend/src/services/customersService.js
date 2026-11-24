import api from './api';

export async function listCustomers(filtros = {}) {
  const { data } = await api.get('/customers', { params: filtros });
  return data.data;
}

export async function createCustomer(dados) {
  const { data } = await api.post('/customers', dados);
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

/* Le o texto de um Blob (o jsdom dos testes ainda nao tem blob.text()) */
function lerTexto(blob) {
  if (typeof blob.text === 'function') return blob.text();
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result));
    leitor.onerror = () => reject(leitor.error);
    leitor.readAsText(blob);
  });
}

/* Sem opcoes o ficheiro descarrega-se tal como o servidor o escreveu (cabecalho em portugues).
   Com { cabecalho, prefixo } troca-se a primeira linha pelo cabecalho da lingua do painel (a ordem das
   colunas e a mesma) e o nome do ficheiro leva o prefixo da lingua. Ler o texto descarta o BOM, e o
   Excel precisa dele para abrir os acentos, por isso volta a por-se (o servidor escreve-o sempre). */
export async function exportCustomersCsv(opcoes) {
  const response = await api.get('/customers/export', { responseType: 'blob' });
  let ficheiro = response.data;
  if (opcoes?.cabecalho) {
    const texto = (await lerTexto(ficheiro)).replace(/^\uFEFF/, '');
    const fim = texto.indexOf('\n');
    const corpo = fim === -1 ? '' : texto.slice(fim);
    ficheiro = new Blob(['\uFEFF' + opcoes.cabecalho + corpo], { type: 'text/csv;charset=utf-8' });
  }
  const url = URL.createObjectURL(ficheiro);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${opcoes?.prefixo || 'clientes'}-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
