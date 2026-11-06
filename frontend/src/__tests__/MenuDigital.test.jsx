import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MenuDigital from '../pages/MenuDigital';
import useAuthStore from '../store/authStore';
import api from '../services/api';
import { listUnits, createUnit, updateUnit, deleteUnit, updateConectStatus } from '../services/unitsService';

/* Sem rede: so os servicos da pagina sao simulados */
vi.mock('../services/unitsService', () => ({
  listUnits: vi.fn(),
  createUnit: vi.fn(),
  updateUnit: vi.fn(),
  deleteUnit: vi.fn(),
  updateConectStatus: vi.fn(),
}));
vi.mock('../services/api', () => ({ default: { get: vi.fn() } }));
vi.mock('../components/shared/ImageUploader', () => ({ default: () => null }));
vi.mock('../components/shared/ConectRow', async () => {
  const React = await import('react');
  return {
    default: ({ unit, onSubmitConect }) =>
      React.createElement('button', { type: 'button', onClick: () => onSubmitConect(unit) }, `Conect ${unit.name}`),
  };
});

const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };
const HOJE_DIA = String(new Date().getDay());
const URL_MENU = 'https://saldesk.cv/book/sabor-do-sal';

function prato(id, name, meta, over) {
  return {
    id, name, unit_type: 'menu_item', base_price: 10, status: 'active', images: [], conect_status: 'draft',
    description: typeof meta === 'string' ? meta : JSON.stringify(meta), ...over,
  };
}

const D1 = prato('d1', 'Atum Grelhado', {
  name_en: 'Grilled Tuna', category: 'pratos_principais', allergens: ['peixe', 'soja', 'gluten'],
  diets: ['vegan', 'halal', 'sem_gluten'], featured: true, daily_special: { [HOJE_DIA]: true },
}, { base_price: 12.5 });
const D2 = prato('d2', 'Pudim', { category: 'sobremesas' }, { base_price: 4, status: 'inactive', conect_status: 'published' });
const D3 = prato('d3', 'Sopa', {});
const D4 = prato('d4', 'Quebrado', '{');
const T1 = {
  id: 't1', name: 'Menu Chef', unit_type: 'tasting_menu', base_price: 45, status: 'inactive', images: [], conect_status: 'draft',
  description: JSON.stringify({ desc_pt: 'Cinco momentos', items: [{ name_pt: 'Entrada' }, { name_pt: 'Peixe' }] }),
};
const TODOS = [D1, D2, D3, D4, T1];

describe('MenuDigital', () => {
  let errSpy;
  let warnSpy;

  beforeEach(() => {
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    useAuthStore.setState({ operator: { slug: 'sabor-do-sal' } });
    listUnits.mockReset().mockResolvedValue(TODOS);
    createUnit.mockReset().mockImplementation(async (dados) => ({ id: 'novo', images: [], ...dados }));
    updateUnit.mockReset().mockImplementation(async (id, dados) => ({ ...TODOS.find(u => u.id === id), ...dados }));
    deleteUnit.mockReset().mockResolvedValue({});
    updateConectStatus.mockReset().mockImplementation(async (id, estado) => ({ ...TODOS.find(u => u.id === id), conect_status: estado }));
    api.get.mockReset().mockResolvedValue({ data: new Blob(['x']) });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    useAuthStore.setState({ operator: null });
    expect(errSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  async function abre() {
    render(
      <MemoryRouter future={FUTURE}>
        <MenuDigital />
      </MemoryRouter>
    );
    await screen.findByText(/prato\(s\)/);
  }

  /* O cartao de um prato: o ascendente do nome que tem os tres botoes de icone */
  function cartao(nome) {
    let el = screen.getByText(nome);
    while (el.parentElement && within(el).queryAllByRole('button').length < 3) el = el.parentElement;
    return el;
  }
  /* botoes de icone do cartao, pela ordem: disponibilidade, editar, eliminar (a seguir o do Conect) */
  function botoesDe(nome) {
    return within(cartao(nome)).getAllByRole('button');
  }
  function nomesNaGrelha() {
    return ['Atum Grelhado', 'Pudim', 'Sopa', 'Quebrado'].filter(n => screen.queryByText(n));
  }
  function chip(nome) {
    return screen.getByRole('button', { name: nome });
  }
  function campo(dialogo, etiqueta) {
    const label = within(dialogo).getAllByText(etiqueta).find(e => e.tagName === 'LABEL');
    expect(label).toBeTruthy();
    return label.nextElementSibling;
  }
  function caixa(dialogo, texto) {
    return within(dialogo).getByText(texto).closest('label').querySelector('input');
  }

  it('o subtitulo e os rotulos contam pratos e menus', async () => {
    await abre();
    expect(screen.getByText('4 prato(s) · 1 menu(s) degustacao')).toBeInTheDocument();
    for (const r of ['Todos (4)', 'Entradas (0)', 'Pratos Principais (1)', 'Sobremesas (1)', 'Bebidas (0)', 'Outros (0)']) {
      expect(chip(r)).toBeInTheDocument();
    }
  });

  it('o separador de categoria filtra e um prato sem categoria so aparece em Todos', async () => {
    await abre();
    expect(nomesNaGrelha()).toEqual(['Atum Grelhado', 'Pudim', 'Sopa', 'Quebrado']);
    fireEvent.click(chip('Pratos Principais (1)'));
    expect(nomesNaGrelha()).toEqual(['Atum Grelhado']);
    fireEvent.click(chip('Sobremesas (1)'));
    expect(nomesNaGrelha()).toEqual(['Pudim']);
    fireEvent.click(chip('Entradas (0)'));
    expect(screen.getByText('Nenhum prato nesta categoria.')).toBeInTheDocument();
    fireEvent.click(chip('Todos (4)'));
    expect(nomesNaGrelha()).toHaveLength(4);
  });

  it('o cartao mostra preco, as duas primeiras etiquetas de dieta e alergenio e o prato do dia', async () => {
    await abre();
    const c = cartao('Atum Grelhado');
    expect(within(c).getByText('€12.50')).toBeInTheDocument();
    expect(within(c).getByText('Pratos Principais')).toBeInTheDocument();
    for (const t of ['Vegan', 'Halal', 'Peixe', 'Soja']) expect(within(c).getByText(t)).toBeInTheDocument();
    expect(within(c).queryByText('Sem gluten')).not.toBeInTheDocument();
    expect(within(c).queryByText('Gluten')).not.toBeInTheDocument();
    expect(within(c).getByText('Prato do dia')).toBeInTheDocument();
    expect(within(cartao('Pudim')).queryByText('Prato do dia')).not.toBeInTheDocument();
  });

  it('descricao invalida ou sem categoria nao rebenta e mostra o prato', async () => {
    await abre();
    expect(screen.getByText('Quebrado')).toBeInTheDocument();
    expect(screen.getByText('Sopa')).toBeInTheDocument();
  });

  it('novo prato chama createUnit com o payload de buildDishPayload e entra no topo', async () => {
    await abre();
    fireEvent.click(screen.getByRole('button', { name: 'Novo Prato' }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('Novo Prato')).toBeInTheDocument();
    fireEvent.change(campo(dialogo, 'Nome PT'), { target: { value: 'Bacalhau' } });
    fireEvent.change(campo(dialogo, 'Preco (€)'), { target: { value: '9.9' } });
    fireEvent.change(campo(dialogo, 'Categoria'), { target: { value: 'sobremesas' } });
    fireEvent.click(caixa(dialogo, 'Peixe'));
    fireEvent.click(caixa(dialogo, 'Destaque (landing page)'));
    fireEvent.click(caixa(dialogo, 'Seg'));
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Adicionar prato' }));
    await waitFor(() => expect(createUnit).toHaveBeenCalledTimes(1));
    const dados = createUnit.mock.calls[0][0];
    expect(Object.keys(dados).sort()).toEqual(
      ['base_price', 'capacity', 'description', 'images', 'is_active', 'name', 'price_unit', 'status', 'unit_type'],
    );
    expect(dados).toMatchObject({
      name: 'Bacalhau', unit_type: 'menu_item', base_price: 9.9, price_unit: 'person', capacity: 1,
      is_active: true, status: 'active', images: [],
    });
    expect(JSON.parse(dados.description)).toEqual({
      name_en: null, desc_pt: null, desc_en: null, category: 'sobremesas',
      allergens: ['peixe'], diets: [], featured: true, daily_special: { 1: true },
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText('5 prato(s) · 1 menu(s) degustacao')).toBeInTheDocument();
    expect(nomesNaGrelha()).toHaveLength(4);
    expect(screen.getByText('Bacalhau')).toBeInTheDocument();
  });

  it('se gravar falhar mostra o erro do servidor, ou o texto por omissao', async () => {
    createUnit.mockRejectedValueOnce({ response: { data: { error: 'Nome invalido' } } });
    await abre();
    fireEvent.click(screen.getByRole('button', { name: 'Novo Prato' }));
    const dialogo = await screen.findByRole('dialog');
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Adicionar prato' }));
    expect(await within(dialogo).findByText('Nome invalido')).toBeInTheDocument();
    createUnit.mockRejectedValueOnce(new Error('rede'));
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Adicionar prato' }));
    expect(await within(dialogo).findByText('Erro ao guardar')).toBeInTheDocument();
  });

  it('editar abre o formulario preenchido e chama updateUnit com o id', async () => {
    await abre();
    fireEvent.click(botoesDe('Atum Grelhado')[1]);
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('Editar Prato')).toBeInTheDocument();
    expect(campo(dialogo, 'Nome PT').value).toBe('Atum Grelhado');
    expect(campo(dialogo, 'Nome EN').value).toBe('Grilled Tuna');
    expect(campo(dialogo, 'Preco (€)').value).toBe('12.5');
    expect(campo(dialogo, 'Categoria').value).toBe('pratos_principais');
    fireEvent.change(campo(dialogo, 'Preco (€)'), { target: { value: '20' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar alteracoes' }));
    await waitFor(() => expect(updateUnit).toHaveBeenCalledTimes(1));
    const [id, dados] = updateUnit.mock.calls[0];
    expect(id).toBe('d1');
    expect(dados.base_price).toBe(20);
    expect(dados.name).toBe('Atum Grelhado');
    expect(JSON.parse(dados.description)).toMatchObject({ name_en: 'Grilled Tuna', category: 'pratos_principais', featured: true });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(within(cartao('Atum Grelhado')).getByText('€20.00')).toBeInTheDocument();
  });

  it('eliminar pede confirmacao e chama deleteUnit', async () => {
    await abre();
    fireEvent.click(botoesDe('Atum Grelhado')[2]);
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('Confirmar eliminacao')).toBeInTheDocument();
    expect(within(dialogo).getByText('Atum Grelhado')).toBeInTheDocument();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    expect(deleteUnit).not.toHaveBeenCalled();

    fireEvent.click(botoesDe('Atum Grelhado')[2]);
    const dialogo2 = await screen.findByRole('dialog');
    fireEvent.click(within(dialogo2).getByRole('button', { name: 'Eliminar' }));
    await waitFor(() => expect(deleteUnit).toHaveBeenCalledWith('d1'));
    await waitFor(() => expect(screen.queryByText('Atum Grelhado')).not.toBeInTheDocument());
  });

  it('alternar a disponibilidade envia status e is_active', async () => {
    await abre();
    fireEvent.click(botoesDe('Atum Grelhado')[0]);
    await waitFor(() => expect(updateUnit).toHaveBeenCalledWith('d1', { status: 'inactive', is_active: false }));
    fireEvent.click(botoesDe('Pudim')[0]);
    await waitFor(() => expect(updateUnit).toHaveBeenCalledWith('d2', { status: 'active', is_active: true }));
  });

  it('submeter ao Conect envia pending_review, ou draft se ja estiver publicado', async () => {
    await abre();
    fireEvent.click(screen.getByRole('button', { name: 'Conect Atum Grelhado' }));
    await waitFor(() => expect(updateConectStatus).toHaveBeenCalledWith('d1', 'pending_review'));
    fireEvent.click(screen.getByRole('button', { name: 'Conect Pudim' }));
    await waitFor(() => expect(updateConectStatus).toHaveBeenCalledWith('d2', 'draft'));
  });

  it('mostra o menu de degustacao com preco, estado, descricao e pratos', async () => {
    await abre();
    expect(screen.getByText('Menus Degustacao')).toBeInTheDocument();
    expect(screen.getByText('Menu Chef')).toBeInTheDocument();
    expect(screen.getByText('€45.00')).toBeInTheDocument();
    expect(screen.getByText('Inactivo')).toBeInTheDocument();
    expect(screen.getByText('Cinco momentos')).toBeInTheDocument();
    expect(screen.getByText('Entrada · Peixe')).toBeInTheDocument();
  });

  it('criar um menu de degustacao chama createUnit com o payload do menu', async () => {
    await abre();
    fireEvent.click(screen.getByRole('button', { name: 'Menu Degustacao' }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('Novo Menu Degustacao')).toBeInTheDocument();
    fireEvent.change(campo(dialogo, 'Nome do menu'), { target: { value: 'Menu Mar' } });
    fireEvent.change(campo(dialogo, 'Preco por pessoa (€)'), { target: { value: '30' } });
    fireEvent.change(within(dialogo).getByPlaceholderText('Nome do prato'), { target: { value: 'Ceviche' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Criar menu' }));
    await waitFor(() => expect(createUnit).toHaveBeenCalledTimes(1));
    const dados = createUnit.mock.calls[0][0];
    expect(dados).toMatchObject({
      name: 'Menu Mar', unit_type: 'tasting_menu', base_price: 30, price_unit: 'person', capacity: 1, status: 'active', images: [],
    });
    expect(JSON.parse(dados.description)).toEqual({ desc_pt: null, desc_en: null, items: [{ name_pt: 'Ceviche', price: '' }] });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText('Menu Mar')).toBeInTheDocument();
  });

  it('copiar o URL escreve a ligacao do menu na area de transferencia', async () => {
    const escrever = vi.fn().mockResolvedValue();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: escrever }, configurable: true });
    await abre();
    const botao = screen.getByText(URL_MENU).parentElement.querySelector('button');
    fireEvent.click(botao);
    await waitFor(() => expect(escrever).toHaveBeenCalledWith(URL_MENU));
  });

  it('descarregar o QR pede o blob ao servidor', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await abre();
    fireEvent.click(screen.getByRole('button', { name: 'Descarregar QR Code' }));
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/marketing/qrcode', { responseType: 'blob' }));
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:x'));
  });

  it('sem slug mostra o aviso em vez do QR', async () => {
    useAuthStore.setState({ operator: { slug: null } });
    await abre();
    expect(screen.getByText('Configure o link do restaurante nas Definicoes para gerar o QR Code.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Descarregar QR Code' })).not.toBeInTheDocument();
  });

  it('sem pratos mostra o vazio com a acao de adicionar', async () => {
    listUnits.mockResolvedValue([]);
    await abre();
    expect(screen.getByText('Nenhum prato nesta categoria.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar prato' }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('Novo Prato')).toBeInTheDocument();
  });

  it('os separadores de categoria sao um grupo de botoes com aria-pressed', async () => {
    await abre();
    expect(chip('Todos (4)')).toHaveAttribute('aria-pressed', 'true');
    expect(chip('Sobremesas (1)')).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(chip('Sobremesas (1)'));
    expect(chip('Sobremesas (1)')).toHaveAttribute('aria-pressed', 'true');
    expect(chip('Todos (4)')).toHaveAttribute('aria-pressed', 'false');
  });

  it('os botoes de icone do cartao tem nome acessivel', async () => {
    await abre();
    const c = cartao('Atum Grelhado');
    expect(within(c).getByRole('button', { name: 'Alternar disponibilidade' })).toBeInTheDocument();
    expect(within(c).getByRole('button', { name: 'Editar' })).toBeInTheDocument();
    expect(within(c).getByRole('button', { name: 'Eliminar' })).toBeInTheDocument();
  });

  it('nenhuma cor em hexadecimal sobra no HTML (pagina, formulario de prato e de menu)', async () => {
    await abre();
    expect(document.body.innerHTML).not.toContain('[#');
    fireEvent.click(screen.getByRole('button', { name: 'Novo Prato' }));
    const dialogo = await screen.findByRole('dialog');
    fireEvent.click(caixa(dialogo, 'Peixe'));
    fireEvent.click(caixa(dialogo, 'Vegan'));
    expect(document.body.innerHTML).not.toContain('[#');
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Menu Degustacao' }));
    await screen.findByRole('dialog');
    expect(document.body.innerHTML).not.toContain('[#');
  });

  it('servicos a falhar nao rebentam', async () => {
    listUnits.mockRejectedValue(new Error('rede'));
    await abre();
    expect(screen.getByText('Nenhum prato nesta categoria.')).toBeInTheDocument();
  });
});
