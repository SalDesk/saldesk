import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Customers from '../pages/Customers';
import useUiStore from '../store/uiStore';
import api from '../services/api';
import { listCustomers, exportCustomersCsv, createCustomer } from '../services/customersService';

/* Sem rede: so os servicos da pagina sao simulados; a gaveta do cliente tem testes proprios */
vi.mock('../services/customersService', () => ({
  listCustomers: vi.fn(),
  exportCustomersCsv: vi.fn(),
  createCustomer: vi.fn(),
}));
vi.mock('../services/api', () => ({ default: { post: vi.fn() } }));
vi.mock('../components/crm/CustomerDetail', async () => {
  const React = await import('react');
  return {
    default: ({ customerId, onClose }) =>
      React.createElement('div', null,
        React.createElement('span', null, `Detalhe ${customerId}`),
        React.createElement('button', { type: 'button', onClick: onClose }, 'Fechar detalhe')),
  };
});

const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };

/* c1 local; c2 turista, grupo (6 visitas) e VIP por gasto, sem etiquetas e com gasto em texto;
   c3 corporativo; c4 VIP por etiqueta */
const CLIENTES = [
  { id: 'c1', name: 'Ana Silva', email: 'ana@x.cv', country_code: 'CV', nationality: 'CV', total_visits: 2, total_spent: 120, language: 'pt', custom_price: 45, tags: ['local'] },
  { id: 'c2', name: 'John Smith', email: 'john@x.com', country_code: 'GB', nationality: 'GB', total_visits: 6, total_spent: '650', language: 'en', custom_price: null },
  { id: 'c3', name: 'Empresa Lda', email: 'e@x.cv', country_code: 'PT', nationality: 'PT', total_visits: 1, total_spent: 30, language: 'pt', custom_price: null, tags: ['corporativo'] },
  { id: 'c4', name: 'Vip Cliente', email: 'v@x.cv', country_code: 'FR', total_visits: 1, total_spent: 10, language: 'fr', custom_price: null, tags: ['VIP'] },
];

describe('Customers', () => {
  let errSpy;
  let warnSpy;

  beforeEach(() => {
    useUiStore.setState({ lang: 'pt' });
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    listCustomers.mockReset().mockResolvedValue(CLIENTES);
    exportCustomersCsv.mockReset().mockResolvedValue();
    createCustomer.mockReset().mockImplementation(async (dados) => ({ id: 'novo', ...dados }));
    api.post.mockReset().mockResolvedValue({ data: { data: { imported: 3 } } });
  });

  afterEach(() => {
    cleanup();
    /* a guarda tem de contar ANTES de restaurar os espioes: restaurar limpa os registos */
    const erros = errSpy.mock.calls.length;
    const avisos = warnSpy.mock.calls.length;
    errSpy.mockRestore();
    warnSpy.mockRestore();
    expect(erros).toBe(0);
    expect(avisos).toBe(0);
  });

  async function abre() {
    render(
      <MemoryRouter future={FUTURE}>
        <Customers />
      </MemoryRouter>
    );
    await screen.findByText('4 cliente(s) registado(s)');
  }

  function nomes() {
    const tabela = screen.getByRole('table');
    return within(tabela).getAllByRole('row').slice(1).map(l => within(l).getAllByRole('cell')[0].textContent);
  }
  /* o primeiro "Todos" e o do segmento; o segundo, o dos paises */
  function todos(i) {
    return screen.getAllByRole('button', { name: 'Todos' })[i];
  }
  function campo(dialogo, etiqueta) {
    const label = within(dialogo).getAllByText(etiqueta).find(e => e.tagName === 'LABEL');
    expect(label).toBeTruthy();
    return label.nextElementSibling;
  }
  function metrica(rotulo) {
    return screen.getByText(rotulo).previousElementSibling.textContent;
  }

  it('lista os clientes com as colunas e o subtitulo', async () => {
    await abre();
    const cab = within(screen.getByRole('table')).getAllByRole('columnheader').map(c => c.textContent);
    expect(cab).toEqual(['Nome', 'Email', 'Nacionalidade', 'Visitas', 'Total gasto', 'Idioma', 'Preço acordado']);
    const linhas = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(linhas).toHaveLength(4);
    const c2 = within(linhas[1]).getAllByRole('cell').map(c => c.textContent);
    expect(c2).toEqual(['John Smith', 'john@x.com', 'GB', '6', '€650.00', 'en', '—']);
    expect(within(linhas[0]).getAllByRole('cell')[6].textContent).toBe('€45.00');
  });

  it('as metricas mostram total, receita, paises e o primeiro cliente', async () => {
    await abre();
    expect(metrica('Total clientes')).toBe('4');
    expect(metrica('Receita total')).toBe('€810');
    expect(metrica('Paises')).toBe('4');
    expect(metrica('Top cliente')).toBe('Ana');
    expect(screen.getByText('€120')).toBeInTheDocument();
  });

  it('os segmentos filtram localmente, sem novos pedidos ao servidor', async () => {
    await abre();
    const pedidos = listCustomers.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'VIP' }));
    expect(nomes()).toEqual(['John Smith', 'Vip Cliente']);
    fireEvent.click(screen.getByRole('button', { name: 'Turistas' }));
    expect(nomes()).toEqual(['John Smith', 'Empresa Lda', 'Vip Cliente']);
    fireEvent.click(screen.getByRole('button', { name: 'Locais' }));
    expect(nomes()).toEqual(['Ana Silva']);
    fireEvent.click(screen.getByRole('button', { name: 'Grupos' }));
    expect(nomes()).toEqual(['John Smith']);
    fireEvent.click(screen.getByRole('button', { name: 'Corporativos' }));
    expect(nomes()).toEqual(['Empresa Lda']);
    fireEvent.click(todos(0));
    expect(nomes()).toHaveLength(4);
    expect(listCustomers.mock.calls.length).toBe(pedidos);
  });

  it('a pesquisa envia search e o filtro de pais envia country_code', async () => {
    await abre();
    expect(listCustomers).toHaveBeenLastCalledWith({});
    const campoPesquisa = screen.getByPlaceholderText('Pesquisar...');
    fireEvent.change(campoPesquisa, { target: { value: 'ana' } });
    fireEvent.submit(campoPesquisa.closest('form'));
    await waitFor(() => expect(listCustomers).toHaveBeenLastCalledWith({ search: 'ana' }));
    fireEvent.click(screen.getByRole('button', { name: 'GB' }));
    await waitFor(() => expect(listCustomers).toHaveBeenLastCalledWith({ search: 'ana', country_code: 'GB' }));
    fireEvent.click(todos(1));
    await waitFor(() => expect(listCustomers).toHaveBeenLastCalledWith({ search: 'ana' }));
  });

  it('exportar chama exportCustomersCsv', async () => {
    await abre();
    fireEvent.click(screen.getByRole('button', { name: 'Exportar' }));
    await waitFor(() => expect(exportCustomersCsv).toHaveBeenCalledTimes(1));
  });

  it('novo cliente valida nome e email e nao grava', async () => {
    await abre();
    fireEvent.click(screen.getByRole('button', { name: 'Novo Cliente' }));
    const dialogo = await screen.findByRole('dialog');
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Criar cliente' }));
    expect(await within(dialogo).findByText('Nome e email sao obrigatorios')).toBeInTheDocument();
    expect(createCustomer).not.toHaveBeenCalled();
  });

  it('novo cliente chama createCustomer com o objeto do formulario e mostra o sucesso', async () => {
    await abre();
    const pedidos = listCustomers.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Novo Cliente' }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('Novo cliente')).toBeInTheDocument();
    fireEvent.change(campo(dialogo, 'Nome *'), { target: { value: 'Novo' } });
    fireEvent.change(campo(dialogo, 'Email *'), { target: { value: 'n@x.cv' } });
    fireEvent.change(campo(dialogo, 'Telefone'), { target: { value: '+238' } });
    fireEvent.change(campo(dialogo, 'Pais (codigo)'), { target: { value: 'CV' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'VIP' }));
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Local' }));
    fireEvent.change(campo(dialogo, 'Preço acordado (opcional)'), { target: { value: '45' } });
    fireEvent.change(campo(dialogo, 'Notas'), { target: { value: 'x' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Criar cliente' }));
    await waitFor(() => expect(createCustomer).toHaveBeenCalledTimes(1));
    expect(createCustomer).toHaveBeenCalledWith({
      name: 'Novo', email: 'n@x.cv', phone: '+238', country_code: 'CV', notes: 'x', tags: ['VIP', 'local'], custom_price: '45',
    });
    expect(await screen.findByText('Cliente criado com sucesso.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(listCustomers.mock.calls.length).toBe(pedidos + 1);
  });

  it('a categoria do novo cliente alterna e um erro do servidor aparece no modal', async () => {
    createCustomer.mockRejectedValueOnce({ response: { data: { error: 'Duplicado' } } });
    await abre();
    fireEvent.click(screen.getByRole('button', { name: 'Novo Cliente' }));
    const dialogo = await screen.findByRole('dialog');
    fireEvent.change(campo(dialogo, 'Nome *'), { target: { value: 'A' } });
    fireEvent.change(campo(dialogo, 'Email *'), { target: { value: 'a@x.cv' } });
    const grupo = within(dialogo).getByRole('button', { name: 'Grupo' });
    fireEvent.click(grupo);
    fireEvent.click(grupo);
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Criar cliente' }));
    expect(await within(dialogo).findByText('Duplicado')).toBeInTheDocument();
    expect(createCustomer.mock.calls[0][0].tags).toEqual([]);
    createCustomer.mockRejectedValueOnce(new Error('rede'));
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Criar cliente' }));
    expect(await within(dialogo).findByText('Erro ao criar cliente')).toBeInTheDocument();
  });

  it('importar CSV envia o ficheiro e mostra o numero de clientes importados', async () => {
    await abre();
    fireEvent.click(screen.getByRole('button', { name: 'Importar CSV' }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByRole('button', { name: 'Importar' })).toBeDisabled();
    const ficheiro = new File(['first_name,last_name,email\nA,B,a@b.cv'], 'clientes.csv', { type: 'text/csv' });
    fireEvent.change(dialogo.querySelector('input[type="file"]'), { target: { files: [ficheiro] } });
    expect(await within(dialogo).findByText('Pre-visualizacao (primeiras 2 linhas)')).toBeInTheDocument();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Importar' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    const [url, corpo] = api.post.mock.calls[0];
    expect(url).toBe('/customers/import');
    expect(corpo).toBeInstanceOf(FormData);
    expect(corpo.get('file').name).toBe('clientes.csv');
    expect(await screen.findByText('3 cliente(s) importado(s) com sucesso.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('clicar no nome abre a gaveta do cliente e fecha-a', async () => {
    await abre();
    fireEvent.click(screen.getByRole('button', { name: 'Ana Silva' }));
    expect(screen.getByText('Detalhe c1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar detalhe' }));
    expect(screen.queryByText('Detalhe c1')).not.toBeInTheDocument();
  });

  it('os segmentos e os paises sao grupos de botoes com aria-pressed', async () => {
    await abre();
    expect(todos(0)).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'VIP' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'VIP' }));
    expect(screen.getByRole('button', { name: 'VIP' })).toHaveAttribute('aria-pressed', 'true');
    expect(todos(0)).toHaveAttribute('aria-pressed', 'false');
    expect(todos(1)).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'GB' }));
    expect(screen.getByRole('button', { name: 'GB' })).toHaveAttribute('aria-pressed', 'true');
    expect(todos(1)).toHaveAttribute('aria-pressed', 'false');
    /* o filtro de pais pede de novo a lista; espera que acabe para nao deixar estado por assentar */
    await screen.findByRole('table');
  });

  it('nenhuma cor em hexadecimal sobra no HTML (faixa de sucesso e modais)', async () => {
    await abre();
    expect(document.body.innerHTML).not.toContain('[#');
    fireEvent.click(screen.getByRole('button', { name: 'Novo Cliente' }));
    const dialogo = await screen.findByRole('dialog');
    fireEvent.change(campo(dialogo, 'Nome *'), { target: { value: 'N' } });
    fireEvent.change(campo(dialogo, 'Email *'), { target: { value: 'n@x.cv' } });
    expect(document.body.innerHTML).not.toContain('[#');
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Criar cliente' }));
    await screen.findByText('Cliente criado com sucesso.');
    expect(document.body.innerHTML).not.toContain('[#');
  });

  it('cliente sem etiquetas nem gasto numerico nao rebenta e entra nos segmentos certos', async () => {
    listCustomers.mockResolvedValue([{ id: 'x', name: 'Sem Dados', email: '', country_code: null, total_visits: 0, total_spent: 0, language: 'pt' }]);
    render(
      <MemoryRouter future={FUTURE}>
        <Customers />
      </MemoryRouter>
    );
    expect(await screen.findByText('1 cliente(s) registado(s)')).toBeInTheDocument();
    expect(metrica('Paises')).toBe('0');
    fireEvent.click(screen.getByRole('button', { name: 'Turistas' }));
    expect(nomes()).toEqual(['Sem Dados']);
    fireEvent.click(screen.getByRole('button', { name: 'VIP' }));
    expect(screen.getByText('Sem resultados')).toBeInTheDocument();
  });
});
