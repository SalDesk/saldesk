import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Customers from '../pages/Customers';
import useUiStore from '../store/uiStore';
import api from '../services/api';
import { listCustomers, exportCustomersCsv, createCustomer } from '../services/customersService';
import { portuguesNoEcra, chavesCruas } from './helpers/portuguesNoEcra';

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

  it('os botoes do cabecalho quebram linha no telemovel (com 44 px o Exportar saia do ecra)', async () => {
    await abre();
    const grupo = screen.getByRole('button', { name: /Exportar/ }).parentElement;
    expect(grupo.className.split(/\s+/)).toContain('flex-wrap');
  });

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
    return screen.getByText(rotulo).closest("article").querySelector("p.font-display").textContent;
  }

  it('lista os clientes com as colunas e o subtítulo', async () => {
    await abre();
    const cab = within(screen.getByRole('table')).getAllByRole('columnheader').map(c => c.textContent);
    expect(cab).toEqual(['Nome', 'Email', 'Nacionalidade', 'Visitas', 'Total gasto', 'Idioma', 'Preço acordado']);
    const linhas = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(linhas).toHaveLength(4);
    const c2 = within(linhas[1]).getAllByRole('cell').map(c => c.textContent);
    expect(c2).toEqual(['John Smith', 'john@x.com', 'GB', '6', '€650.00', 'en', '—']);
    expect(within(linhas[0]).getAllByRole('cell')[6].textContent).toBe('€45.00');
  });

  it('as métricas mostram total, receita, países e o primeiro cliente', async () => {
    await abre();
    expect(metrica('Total clientes')).toBe('4');
    expect(metrica('Receita total')).toBe('€810');
    expect(metrica('Países')).toBe('4');
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

  it('o botão de pesquisar só com ícone tem nome acessível', async () => {
    await abre();
    expect(screen.getByRole('button', { name: 'Pesquisar' })).toHaveAttribute('type', 'submit');
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

  it('exportar em portugues pede o ficheiro tal como o servidor o escreve (sem trocar o cabecalho)', async () => {
    await abre();
    fireEvent.click(screen.getByRole('button', { name: 'Exportar' }));
    await waitFor(() => expect(exportCustomersCsv).toHaveBeenCalledTimes(1));
    expect(exportCustomersCsv).toHaveBeenCalledWith(undefined);
  });

  it('novo cliente válida nome e email e não grava', async () => {
    await abre();
    fireEvent.click(screen.getByRole('button', { name: 'Novo Cliente' }));
    const dialogo = await screen.findByRole('dialog');
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Criar cliente' }));
    expect(await within(dialogo).findByText('Nome e email são obrigatórios')).toBeInTheDocument();
    expect(createCustomer).not.toHaveBeenCalled();
  });

  it('novo cliente chama createCustomer com o objeto do formulário e mostra o sucesso', async () => {
    await abre();
    const pedidos = listCustomers.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Novo Cliente' }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('Novo cliente')).toBeInTheDocument();
    fireEvent.change(campo(dialogo, 'Nome *'), { target: { value: 'Novo' } });
    fireEvent.change(campo(dialogo, 'Email *'), { target: { value: 'n@x.cv' } });
    fireEvent.change(campo(dialogo, 'Telefone'), { target: { value: '+238' } });
    fireEvent.change(campo(dialogo, 'País (código)'), { target: { value: 'CV' } });
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

  it('importar CSV envia o ficheiro e mostra o número de clientes importados', async () => {
    await abre();
    fireEvent.click(screen.getByRole('button', { name: 'Importar CSV' }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByRole('button', { name: 'Importar' })).toBeDisabled();
    const ficheiro = new File(['first_name,last_name,email\nA,B,a@b.cv'], 'clientes.csv', { type: 'text/csv' });
    fireEvent.change(dialogo.querySelector('input[type="file"]'), { target: { files: [ficheiro] } });
    expect(await within(dialogo).findByText('Pré-visualização (primeiras 2 linhas)')).toBeInTheDocument();
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

  it('os segmentos e os países são grupos de botões com aria-pressed', async () => {
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

  it('cliente sem etiquetas nem gasto numerico não rebenta e entra nos segmentos certos', async () => {
    listCustomers.mockResolvedValue([{ id: 'x', name: 'Sem Dados', email: '', country_code: null, total_visits: 0, total_spent: 0, language: 'pt' }]);
    render(
      <MemoryRouter future={FUTURE}>
        <Customers />
      </MemoryRouter>
    );
    expect(await screen.findByText('1 cliente(s) registado(s)')).toBeInTheDocument();
    expect(metrica('Países')).toBe('0');
    fireEvent.click(screen.getByRole('button', { name: 'Turistas' }));
    expect(nomes()).toEqual(['Sem Dados']);
    fireEvent.click(screen.getByRole('button', { name: 'VIP' }));
    expect(screen.getByText('Sem resultados')).toBeInTheDocument();
  });

  it('o cabeçalho traz o eyebrow Clientes', async () => {
    await abre();
    expect(document.querySelector('[data-eyebrow]')).toHaveTextContent('Clientes');
  });

  it('as quatro métricas são quadros MareStat com os mesmos valores e a pista do top cliente', async () => {
    await abre();
    for (const [rotulo, valor] of [['Total clientes', '4'], ['Receita total', '€810'], ['Países', '4'], ['Top cliente', 'Ana']]) {
      const quadro = screen.getByText(rotulo).closest('article');
      expect(quadro).toHaveClass('bg-white', 'border', 'border-mare-card', 'rounded-[18px]');
      expect(quadro).toHaveTextContent(valor);
    }
    expect(screen.getByText('Top cliente').closest('article')).toHaveTextContent('€120');
  });

  it('a tabela está num cartão Maré e dinheiro e contagens usam font-mono', async () => {
    await abre();
    const cartao = screen.getByRole('table').closest('.border-mare-card');
    expect(cartao).toHaveClass('bg-white', 'border', 'border-mare-card', 'rounded-[18px]', 'overflow-hidden');
    const linha = within(screen.getByRole('table')).getAllByRole('row')[2];
    const celulas = within(linha).getAllByRole('cell');
    for (const i of [3, 4]) {
      expect(celulas[i].querySelector('.font-mono') || celulas[i]).toHaveClass('font-mono', 'tabular-nums');
    }
    expect(within(within(screen.getByRole('table')).getAllByRole('row')[1]).getAllByRole('cell')[6].querySelector('.font-mono')).toBeTruthy();
  });

  it('a importação CSV usa caixas interiores Maré', async () => {
    await abre();
    fireEvent.click(screen.getByRole('button', { name: 'Importar CSV' }));
    const dialogo = await screen.findByRole('dialog');
    const dica = within(dialogo).getByText(/first_name/).parentElement;
    const zona = dialogo.querySelector('input[type="file"]').parentElement;
    for (const caixa of [dica, zona]) {
      expect(caixa).toHaveClass('rounded-[14px]', 'border-mare-card');
    }
  });
});

/* Painel em ingles: os rotulos mudam, o que se grava (etiquetas, filtros) fica igual */
describe('Customers em ingles', () => {
  /* nomes, emails e etiquetas dos clientes sao dados, nao texto do painel */
  const DADOS = ['Ana Silva', 'John Smith', 'Empresa Lda', 'Vip Cliente'];
  let errSpy;
  let warnSpy;

  beforeEach(() => {
    useUiStore.setState({ lang: 'en' });
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    listCustomers.mockReset().mockResolvedValue(CLIENTES);
    exportCustomersCsv.mockReset().mockResolvedValue();
    createCustomer.mockReset().mockImplementation(async (dados) => ({ id: 'novo', ...dados }));
    api.post.mockReset().mockResolvedValue({ data: { data: { imported: 3 } } });
  });

  afterEach(() => {
    cleanup();
    useUiStore.setState({ lang: 'pt' });
    const erros = errSpy.mock.calls.length;
    const avisos = warnSpy.mock.calls.length;
    errSpy.mockRestore();
    warnSpy.mockRestore();
    expect(erros).toBe(0);
    expect(avisos).toBe(0);
  });

  async function abreEn() {
    render(
      <MemoryRouter future={FUTURE}>
        <Customers />
      </MemoryRouter>
    );
    await screen.findByText('4 customer(s) registered');
  }
  function campo(dialogo, etiqueta) {
    const label = within(dialogo).getAllByText(etiqueta).find(e => e.tagName === 'LABEL');
    expect(label).toBeTruthy();
    return label.nextElementSibling;
  }
  function nomes() {
    return within(screen.getByRole('table')).getAllByRole('row').slice(1).map(l => within(l).getAllByRole('cell')[0].textContent);
  }

  it('mostra_colunas_metricas_e_segmentos_em_ingles_sem_portugues', async () => {
    await abreEn();
    expect(within(screen.getByRole('table')).getAllByRole('columnheader').map(c => c.textContent))
      .toEqual(['Name', 'Email', 'Nationality', 'Visits', 'Total spent', 'Language', 'Agreed price']);
    const c2 = within(within(screen.getByRole('table')).getAllByRole('row')[2]).getAllByRole('cell').map(c => c.textContent);
    expect(c2).toEqual(['John Smith', 'john@x.com', 'GB', '6', '€650.00', 'en', '—']);
    expect(screen.getByText('Total customers').closest("article").querySelector("p.font-display").textContent).toBe('4');
    expect(screen.getByText('Total revenue').closest("article").querySelector("p.font-display").textContent).toBe('€810');
    expect(screen.getByText('Top customer').closest("article").querySelector("p.font-display").textContent).toBe('Ana');
    ['Tourists', 'Locals', 'Groups', 'Corporate', 'VIP', 'New Customer', 'Import CSV', 'Export'].forEach((nome) => {
      expect(screen.getByRole('button', { name: nome })).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
    expect(portuguesNoEcra(DADOS)).toEqual([]);
    expect(chavesCruas(['customersPage', 'customers'])).toEqual([]);
  });

  it('os_segmentos_em_ingles_filtram_como_em_portugues', async () => {
    await abreEn();
    fireEvent.click(screen.getByRole('button', { name: 'Corporate' }));
    expect(nomes()).toEqual(['Empresa Lda']);
    fireEvent.click(screen.getByRole('button', { name: 'Locals' }));
    expect(nomes()).toEqual(['Ana Silva']);
  });

  it('exportar_em_ingles_troca_o_cabecalho_do_ficheiro_e_o_prefixo_do_nome', async () => {
    await abreEn();
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    await waitFor(() => expect(exportCustomersCsv).toHaveBeenCalledTimes(1));
    expect(exportCustomersCsv).toHaveBeenCalledWith({
      cabecalho: 'Name,Email,Phone,Country,Language,Visits,Total spent,Notes,Created on',
      prefixo: 'customers',
    });
  });

  it('o_novo_cliente_em_ingles_grava_as_etiquetas_guardadas_e_valida_em_ingles', async () => {
    await abreEn();
    fireEvent.click(screen.getByRole('button', { name: 'New Customer' }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('New customer')).toBeInTheDocument();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Create customer' }));
    expect(await within(dialogo).findByText('Name and email are required')).toBeInTheDocument();
    expect(createCustomer).not.toHaveBeenCalled();
    fireEvent.change(campo(dialogo, 'Name *'), { target: { value: 'Novo' } });
    fireEvent.change(campo(dialogo, 'Email *'), { target: { value: 'n@x.cv' } });
    fireEvent.change(campo(dialogo, 'Country (code)'), { target: { value: 'CV' } });
    expect(within(dialogo).getByPlaceholderText('E.g. CV, PT')).toBeInTheDocument();
    expect(within(dialogo).getByPlaceholderText('customer@email.com')).toBeInTheDocument();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Tourist' }));
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Corporate' }));
    fireEvent.change(campo(dialogo, 'Agreed price (optional)'), { target: { value: '45' } });
    expect(portuguesNoEcra(DADOS, dialogo)).toEqual([]);
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Create customer' }));
    await waitFor(() => expect(createCustomer).toHaveBeenCalledTimes(1));
    /* as etiquetas gravadas continuam a ser os valores de sempre */
    expect(createCustomer).toHaveBeenCalledWith(expect.objectContaining({ name: 'Novo', tags: ['turista', 'corporativo'], custom_price: '45' }));
    expect(await screen.findByText('Customer created successfully.')).toBeInTheDocument();
  });

  it('importar_csv_em_ingles_traduz_o_modal_e_mantem_o_formato_esperado', async () => {
    await abreEn();
    fireEvent.click(screen.getByRole('button', { name: 'Import CSV' }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('Expected format (header required):')).toBeInTheDocument();
    /* o cabecalho que a importacao le nao se traduz */
    expect(within(dialogo).getByText('first_name, last_name, email, phone, country_code, language')).toBeInTheDocument();
    const ficheiro = new File(['first_name,last_name,email\nA,B,a@b.cv'], 'clientes.csv', { type: 'text/csv' });
    fireEvent.change(dialogo.querySelector('input[type="file"]'), { target: { files: [ficheiro] } });
    expect(await within(dialogo).findByText('Preview (first 2 lines)')).toBeInTheDocument();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Import' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('3 customer(s) imported successfully.')).toBeInTheDocument();
  });
});
