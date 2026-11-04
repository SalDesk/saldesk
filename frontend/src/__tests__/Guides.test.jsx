import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Guides from '../pages/Guides';
import useAuthStore from '../store/authStore';
import useUiStore from '../store/uiStore';
import {
  listStaff, createStaff, updateStaff, deleteStaff, getStaffJobs, setAvailability,
} from '../services/staffService';
import { listUnits } from '../services/unitsService';
import { listReservations } from '../services/reservationsService';
import { createAssignment, createCompositeAssignment } from '../services/assignmentService';
import { listFleet } from '../services/fleetService';

/* Sem rede: todos os servicos usados pela pagina (e pelo modal de atribuicao composta) sao simulados */
vi.mock('../services/staffService', () => ({
  listStaff: vi.fn(),
  createStaff: vi.fn(),
  updateStaff: vi.fn(),
  deleteStaff: vi.fn(),
  getStaffJobs: vi.fn(),
  setAvailability: vi.fn(),
}));
vi.mock('../services/unitsService', () => ({ listUnits: vi.fn() }));
vi.mock('../services/reservationsService', () => ({ listReservations: vi.fn() }));
vi.mock('../services/assignmentService', () => ({
  createAssignment: vi.fn(),
  createCompositeAssignment: vi.fn(),
}));
vi.mock('../services/fleetService', () => ({ listFleet: vi.fn() }));

const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/* ---- Dados ---- */

function guia(over) {
  return {
    id: 'g1', name: 'Ana Lopes', role: 'Guia', status: 'active',
    phone: '+238 911 1111', email: 'ana@exemplo.cv', whatsapp: '+238 922 2222',
    languages: ['PT', 'EN'],
    certifications: ['PADI Open Water', 'Surf Coach', 'CPR / DAE', 'Curso Extra'],
    schedule: ['Seg', 'Ter'], tour_ids: ['u1'],
    average_rating: 4.5, total_jobs_completed: 12, bio: 'Guia desde 2015', photo_url: null,
    ...over,
  };
}
const ANA = () => guia();
const RUI = () => ({
  id: 'g2', name: 'Rui Costa', role: 'Instrutor', status: 'busy',
  photo_url: 'https://img.exemplo.cv/rui.png', skills: ['IKO Kitesurf'],
});
const SARA = () => ({ id: 'g3', name: 'Sara Dias', role: 'Assistente', status: 'day_off' });
const TIAGO = () => ({ id: 'g4', name: 'Tiago Vaz', role: 'Outro', status: 'inactive' });
const VENDEDOR = () => ({ id: 'g5', name: 'Beto Praia', role: 'Vendedor de Praia', status: 'active' });
const EQUIPA = () => [ANA(), RUI(), SARA(), TIAGO(), VENDEDOR()];

const UNIDADES = [
  { id: 'u1', name: 'Tour Vulcao', status: 'active' },
  { id: 'u2', name: 'Tour Sal', status: 'draft', is_active: true },
  { id: 'u3', name: 'Tour Oculto', status: 'inactive' },
];

/* Datas fixas no futuro e no passado distantes: o filtro "proximas" compara com o dia de hoje */
const RESERVAS = [
  { id: 'r1', status: 'pending', check_in: '2099-03-02', guests: 2, customer_name: 'Maria Silva', unit_id: 'u1', units: { name: 'Tour Vulcao' } },
  { id: 'r2', status: 'confirmed', check_in: '2099-01-05', guests: 4, unit_id: 'abcdef123456' },
  { id: 'r3', status: 'cancelled', check_in: '2099-02-01', guests: 1, customer_name: 'Cancelada', unit_id: 'u1' },
  { id: 'r4', status: 'pending', check_in: '2000-01-01', guests: 1, customer_name: 'Passada', unit_id: 'u1' },
  { id: 'r5', status: 'checked_in', check_in: '2099-04-01', guests: 1, customer_name: 'Em curso', unit_id: 'u1' },
];

function erroApi(mensagem) {
  return Object.assign(new Error('falha'), { response: { data: { error: mensagem } } });
}

function adiado() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function defineOperador(tipo) {
  useAuthStore.setState({ operator: tipo ? { operator_type: tipo, slug: 'op-teste' } : null });
}

/* Os servicos rejeitam formas de argumentos que a pagina nunca envia */
function carregaServicos({ equipa = EQUIPA(), unidades = UNIDADES, reservas = RESERVAS } = {}) {
  listStaff.mockReset().mockImplementation(async (...args) => {
    if (args.length) throw new Error('listStaff: argumentos inesperados');
    return equipa;
  });
  listUnits.mockReset().mockImplementation(async (...args) => {
    if (args.length) throw new Error('listUnits: argumentos inesperados');
    return unidades;
  });
  listReservations.mockReset().mockImplementation(async (filtros) => {
    if (!filtros || typeof filtros !== 'object' || Object.keys(filtros).length) throw new Error('listReservations: argumentos inesperados');
    return reservas;
  });
  createStaff.mockReset().mockImplementation(async (dados) => {
    if (!dados || typeof dados !== 'object' || typeof dados.name !== 'string') throw new Error('createStaff: argumentos inesperados');
    return { id: 'gNovo', ...dados };
  });
  updateStaff.mockReset().mockImplementation(async (id, dados) => {
    if (typeof id !== 'string' || !dados || typeof dados !== 'object') throw new Error('updateStaff: argumentos inesperados');
    return { ...equipa.find((g) => g.id === id), ...dados, id };
  });
  deleteStaff.mockReset().mockImplementation(async (id) => {
    if (typeof id !== 'string') throw new Error('deleteStaff: argumentos inesperados');
  });
  getStaffJobs.mockReset().mockImplementation(async (id) => {
    if (typeof id !== 'string') throw new Error('getStaffJobs: argumentos inesperados');
    return [];
  });
  setAvailability.mockReset().mockImplementation(async (id, dados) => {
    if (typeof id !== 'string' || !dados || !ISO.test(dados.date) || typeof dados.is_available !== 'boolean') {
      throw new Error('setAvailability: argumentos inesperados');
    }
    return { ok: true };
  });
  createAssignment.mockReset().mockImplementation(async (dados) => {
    if (!dados || typeof dados.staff_id !== 'string' || typeof dados.reservation_id !== 'string') throw new Error('createAssignment: argumentos inesperados');
    return { id: 'a1' };
  });
  createCompositeAssignment.mockReset().mockImplementation(async (dados) => {
    if (!dados || typeof dados.reservation_id !== 'string' || typeof dados.guide_id !== 'string') throw new Error('createCompositeAssignment: argumentos inesperados');
    return { id: 'a2' };
  });
  listFleet.mockReset().mockImplementation(async (filtros) => {
    if (!filtros || filtros.type !== 'vehicle' || filtros.status !== 'available') throw new Error('listFleet: argumentos inesperados');
    return [];
  });
}

/* ---- Consultas ---- */

function dialogo() {
  return screen.getByRole('dialog');
}

/* Cartao de um guia: o menor bloco que contem o nome e o seu proprio botao Historial */
function cartao(nome) {
  let el = screen.getByText(nome);
  while (el && within(el).queryAllByRole('button', { name: 'Historial' }).length !== 1) el = el.parentElement;
  if (!el) throw new Error(`Cartao nao encontrado: ${nome}`);
  return el;
}

/* Botoes so com icone do cartao, por ordem: [editar, eliminar] */
function botoesIcone(c) {
  return within(c).getAllByRole('button').filter((b) => b.textContent.trim() === '');
}

function abrirEditar(nome) {
  fireEvent.click(botoesIcone(cartao(nome))[0]);
}

function abrirEliminar(nome) {
  fireEvent.click(botoesIcone(cartao(nome))[1]);
}

/* O campo que esta por baixo de uma etiqueta do desenho do sistema (partilham o mesmo bloco) */
function campo(texto, raiz = dialogo()) {
  const etiqueta = within(raiz).getByText(texto, { selector: 'label' });
  return etiqueta.parentElement.querySelector('input, select, textarea');
}

function temEtiquetaPorCima(textos) {
  for (const texto of textos) {
    const etiqueta = within(dialogo()).getByText(texto, { selector: 'label' });
    expect(etiqueta.nextElementSibling).toBe(campo(texto));
  }
}

function botaoDoDialogo(nome) {
  return within(dialogo()).getByRole('button', { name: nome });
}

function separador(nome) {
  return screen.getByText(nome, { selector: 'button' });
}

/* O interruptor "Criar conta /staff": o botao no mesmo bloco do texto */
function botaoConta() {
  let el = screen.getByText('Criar conta /staff');
  while (el && within(el).queryAllByRole('button').length === 0) el = el.parentElement;
  return within(el).getAllByRole('button')[0];
}

function nomesNaGrelha() {
  return screen.getAllByText(/^(Ana Lopes|Rui Costa|Sara Dias|Tiago Vaz|Novo Guia|Nova Guia)$/).map((e) => e.textContent);
}

describe('Guias', () => {
  let errSpy;
  let warnSpy;
  let esperaErros;

  beforeEach(() => {
    useUiStore.setState({ lang: 'pt' });
    defineOperador('hotel');
    carregaServicos();
    esperaErros = false;
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    /* nenhum erro ou aviso no consolo, salvo nos casos em que o servico falha de proposito */
    const erros = errSpy.mock.calls.length;
    const avisos = warnSpy.mock.calls.length;
    errSpy.mockRestore();
    warnSpy.mockRestore();
    if (!esperaErros) expect(erros).toBe(0);
    expect(avisos).toBe(0);
  });

  function paginaJsx() {
    return (
      <MemoryRouter future={FUTURE}>
        <Guides />
      </MemoryRouter>
    );
  }

  async function esperaCarregar() {
    await waitFor(() => expect(listReservations).toHaveBeenCalled());
    await waitFor(() => expect(document.querySelector('.animate-spin')).toBeNull());
  }

  async function renderPagina(opcoes = {}, tipo = 'hotel') {
    defineOperador(tipo);
    carregaServicos(opcoes);
    const r = render(paginaJsx());
    await esperaCarregar();
    return r;
  }

  describe('pagina e lista', () => {
    it('titulo, subtitulo, botao de criar e filtros', async () => {
      await renderPagina();
      expect(screen.getByRole('heading', { level: 1, name: 'Guias' })).toBeInTheDocument();
      expect(screen.getByText('1 disponivel(is) · 4 total')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Adicionar guia' })).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Pesquisar guia...')).toBeInTheDocument();
      for (const nome of ['Todos', 'Disponivel', 'Ocupado', 'Folga', 'Inactivo']) {
        expect(screen.getByRole('button', { name: nome })).toBeInTheDocument();
      }
    });

    it('carrega com os servicos certos e sem argumentos extra', async () => {
      await renderPagina();
      expect(listStaff).toHaveBeenCalledTimes(1);
      expect(listStaff).toHaveBeenCalledWith();
      expect(listUnits).toHaveBeenCalledTimes(1);
      expect(listUnits).toHaveBeenCalledWith();
      expect(listReservations).toHaveBeenCalledTimes(1);
      expect(listReservations).toHaveBeenCalledWith({});
    });

    it('lista os guias (sem os vendedores de praia) pela ordem do servidor', async () => {
      await renderPagina();
      expect(nomesNaGrelha()).toEqual(['Ana Lopes', 'Rui Costa', 'Sara Dias', 'Tiago Vaz']);
      expect(screen.queryByText('Beto Praia')).not.toBeInTheDocument();
    });

    it('cartao completo: funcao, estado, avaliacao, tours, idiomas, certificacoes (3 + resto) e bio', async () => {
      await renderPagina();
      const c = cartao('Ana Lopes');
      expect(within(c).getByText('Guia')).toBeInTheDocument();
      expect(within(c).getByText('Disponivel')).toBeInTheDocument();
      expect(c.textContent).toContain('4.5');
      expect(c.textContent).toContain('12 tours');
      expect(within(c).getByText('PT')).toBeInTheDocument();
      expect(within(c).getByText('EN')).toBeInTheDocument();
      expect(within(c).getByText('PADI Open Water')).toBeInTheDocument();
      expect(within(c).getByText('Surf Coach')).toBeInTheDocument();
      expect(within(c).getByText('CPR / DAE')).toBeInTheDocument();
      expect(within(c).queryByText('Curso Extra')).not.toBeInTheDocument();
      expect(within(c).getByText('+1')).toBeInTheDocument();
      expect(within(c).getByText('Guia desde 2015')).toBeInTheDocument();
      expect(within(c).getByText('Idiomas')).toBeInTheDocument();
      expect(within(c).getByText('Certificacoes')).toBeInTheDocument();
      expect(within(c).getByRole('button', { name: /Atribuir/ })).toBeInTheDocument();
      expect(within(c).getByRole('button', { name: 'Historial' })).toBeInTheDocument();
    });

    it('iniciais do avatar quando nao ha foto e imagem quando ha', async () => {
      await renderPagina();
      expect(within(cartao('Ana Lopes')).getByText('AL')).toBeInTheDocument();
      expect(within(cartao('Ana Lopes')).queryByRole('img')).not.toBeInTheDocument();
      const foto = within(cartao('Rui Costa')).getByRole('img', { name: 'Rui Costa' });
      expect(foto).toHaveAttribute('src', 'https://img.exemplo.cv/rui.png');
    });

    it('cartao sem avaliacao nem listas mostra 0 tours e usa skills como certificacoes', async () => {
      await renderPagina();
      const c = cartao('Rui Costa');
      expect(within(c).getByText('Instrutor')).toBeInTheDocument();
      expect(within(c).getByText('Ocupado')).toBeInTheDocument();
      expect(c.textContent).toContain('0 tours');
      expect(c.textContent).not.toContain('4.5');
      expect(within(c).queryByText('Idiomas')).not.toBeInTheDocument();
      expect(within(c).getByText('Certificacoes')).toBeInTheDocument();
      expect(within(c).getByText('IKO Kitesurf')).toBeInTheDocument();
      expect(within(c).queryByText(/^\+\d/)).not.toBeInTheDocument();
    });

    it('rotulo do estado de cada guia, e estado desconhecido cai em Inactivo', async () => {
      await renderPagina({ equipa: [...EQUIPA(), { id: 'g6', name: 'Zeca Novo', role: 'Guia', status: 'xyz' }] });
      expect(within(cartao('Sara Dias')).getByText('Folga')).toBeInTheDocument();
      expect(within(cartao('Tiago Vaz')).getByText('Inactivo')).toBeInTheDocument();
      expect(within(cartao('Zeca Novo')).getByText('Inactivo')).toBeInTheDocument();
    });

    it('nome de uma so palavra e funcao em falta nao rebentam', async () => {
      await renderPagina({ equipa: [{ id: 'g9', name: 'Madonna', status: 'active' }] });
      expect(within(cartao('Madonna')).getByText('M')).toBeInTheDocument();
    });

    it('sem guias mostra o estado vazio compacto', async () => {
      await renderPagina({ equipa: [] });
      expect(screen.getByText('Sem guias registados')).toBeInTheDocument();
      expect(screen.getByText('Adicione os guias da sua equipa e associe-os aos tours que conduzem')).toBeInTheDocument();
      expect(screen.getByText('0 disponivel(is) · 0 total')).toBeInTheDocument();
    });

    it('so vendedores de praia tambem mostra o estado vazio', async () => {
      await renderPagina({ equipa: [VENDEDOR()] });
      expect(screen.getByText('Sem guias registados')).toBeInTheDocument();
    });

    it('lista de guias nula nao rebenta', async () => {
      await renderPagina({ equipa: null });
      expect(screen.getByText('Sem guias registados')).toBeInTheDocument();
    });

    it('enquanto carrega nao mostra o vazio nem os cartoes, e depois mostra', async () => {
      const espera = adiado();
      listStaff.mockReset().mockReturnValue(espera.promise);
      listUnits.mockReset().mockResolvedValue(UNIDADES);
      listReservations.mockReset().mockResolvedValue(RESERVAS);
      render(paginaJsx());
      expect(document.querySelector('.animate-spin')).not.toBeNull();
      expect(screen.queryByText('Sem guias registados')).not.toBeInTheDocument();
      expect(screen.getByText('0 disponivel(is) · 0 total')).toBeInTheDocument();
      espera.resolve([ANA()]);
      expect(await screen.findByText('Ana Lopes')).toBeInTheDocument();
      expect(screen.queryByText('Sem guias registados')).not.toBeInTheDocument();
    });

    for (const [nome, falha] of [
      ['listStaff', () => listStaff.mockReset().mockRejectedValue(new Error('rede'))],
      ['listUnits', () => listUnits.mockReset().mockRejectedValue(new Error('rede'))],
      ['listReservations', () => listReservations.mockReset().mockRejectedValue(new Error('rede'))],
    ]) {
      it(`${nome} a falhar nao rebenta: regista o erro e mostra a pagina vazia`, async () => {
        esperaErros = true;
        carregaServicos();
        falha();
        render(paginaJsx());
        expect(await screen.findByText('Sem guias registados')).toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 1, name: 'Guias' })).toBeInTheDocument();
        expect(errSpy).toHaveBeenCalledTimes(1);
        expect(errSpy.mock.calls[0][0]).toBeInstanceOf(Error);
        expect(errSpy.mock.calls[0][0].message).toBe('rede');
      });
    }
  });

  describe('pesquisa e filtro por estado', () => {
    it('pesquisa pelo nome sem distinguir maiusculas', async () => {
      await renderPagina();
      fireEvent.change(screen.getByPlaceholderText('Pesquisar guia...'), { target: { value: 'rUi' } });
      expect(nomesNaGrelha()).toEqual(['Rui Costa']);
    });

    it('pesquisa tambem pela funcao', async () => {
      await renderPagina();
      fireEvent.change(screen.getByPlaceholderText('Pesquisar guia...'), { target: { value: 'assist' } });
      expect(nomesNaGrelha()).toEqual(['Sara Dias']);
    });

    it('pesquisa sem resultados deixa a grelha vazia, sem o aviso de "sem guias registados"', async () => {
      await renderPagina();
      fireEvent.change(screen.getByPlaceholderText('Pesquisar guia...'), { target: { value: 'zzz' } });
      expect(screen.queryByText('Ana Lopes')).not.toBeInTheDocument();
      expect(screen.queryByText('Sem guias registados')).not.toBeInTheDocument();
    });

    it('filtra por estado e Todos repoe a lista', async () => {
      await renderPagina();
      fireEvent.click(screen.getByRole('button', { name: 'Ocupado' }));
      expect(nomesNaGrelha()).toEqual(['Rui Costa']);
      fireEvent.click(screen.getByRole('button', { name: 'Inactivo' }));
      expect(nomesNaGrelha()).toEqual(['Tiago Vaz']);
      fireEvent.click(screen.getByRole('button', { name: 'Folga' }));
      expect(nomesNaGrelha()).toEqual(['Sara Dias']);
      fireEvent.click(screen.getByRole('button', { name: 'Disponivel' }));
      expect(nomesNaGrelha()).toEqual(['Ana Lopes']);
      fireEvent.click(screen.getByRole('button', { name: 'Todos' }));
      expect(nomesNaGrelha()).toEqual(['Ana Lopes', 'Rui Costa', 'Sara Dias', 'Tiago Vaz']);
    });

    it('pesquisa e estado combinam-se; sem correspondencia a grelha fica vazia sem aviso', async () => {
      await renderPagina();
      fireEvent.change(screen.getByPlaceholderText('Pesquisar guia...'), { target: { value: 'a' } });
      fireEvent.click(screen.getByRole('button', { name: 'Ocupado' }));
      expect(nomesNaGrelha()).toEqual(['Rui Costa']);
      fireEvent.change(screen.getByPlaceholderText('Pesquisar guia...'), { target: { value: 'sara' } });
      expect(screen.queryByText('Rui Costa')).not.toBeInTheDocument();
      expect(screen.queryByText('Sara Dias')).not.toBeInTheDocument();
      expect(screen.queryByText('Sem guias registados')).not.toBeInTheDocument();
    });
  });

  describe('criar guia', () => {
    async function abrirCriar() {
      await renderPagina();
      fireEvent.click(screen.getByRole('button', { name: 'Adicionar guia' }));
      return dialogo();
    }

    it('abre o formulario vazio com os valores por omissao e sem o campo Estado', async () => {
      const d = await abrirCriar();
      expect(within(d).getByRole('heading', { name: 'Novo guia' })).toBeInTheDocument();
      expect(campo('Nome completo')).toHaveValue('');
      expect(campo('Nome completo')).toHaveAttribute('placeholder', 'Nome e apelido');
      expect(campo('Funcao')).toHaveValue('Guia');
      expect([...campo('Funcao').options].map((o) => o.value)).toEqual(['Guia', 'Instrutor', 'Guia-Instrutor', 'Assistente', 'Outro']);
      expect(campo('Telefone')).toHaveValue('');
      expect(campo('Telefone')).toHaveAttribute('type', 'tel');
      expect(campo('WhatsApp')).toHaveAttribute('type', 'tel');
      expect(campo('Email')).toHaveAttribute('type', 'email');
      expect(campo('Bio curta')).toHaveValue('');
      expect(campo('Bio curta').tagName).toBe('TEXTAREA');
      expect(within(d).queryByText('Estado', { selector: 'label' })).not.toBeInTheDocument();
      expect(within(d).getByText('Foto do guia')).toBeInTheDocument();
      expect(within(d).getByText('JPG, PNG ate 2MB')).toBeInTheDocument();
      expect(within(d).getByText('Criar conta /staff')).toBeInTheDocument();
      expect(botaoDoDialogo('Cancelar')).toBeInTheDocument();
      expect(botaoDoDialogo('Adicionar guia')).toHaveAttribute('type', 'submit');
    });

    it('cada campo traz a etiqueta logo por cima', async () => {
      await abrirCriar();
      temEtiquetaPorCima(['Nome completo', 'Funcao', 'Telefone', 'WhatsApp', 'Email', 'Bio curta']);
    });

    it('so o nome preenchido envia o objeto de hoje, com todas as chaves e valores vazios', async () => {
      await abrirCriar();
      fireEvent.change(campo('Nome completo'), { target: { value: 'Novo Guia' } });
      fireEvent.click(botaoDoDialogo('Adicionar guia'));
      await waitFor(() => expect(createStaff).toHaveBeenCalledTimes(1));
      expect(createStaff.mock.calls[0]).toStrictEqual([{
        name: 'Novo Guia', role: 'Guia', phone: '', email: '', whatsapp: '', status: 'active', bio: '',
        photo_url: null,
        languages: [], certifications: [], skills: [], schedule: [], tour_ids: [],
        create_access: false,
        guide_meta: '{"bio":"","languages":[],"certifications":[],"schedule":[],"tour_ids":[]}',
      }]);
      expect(updateStaff).not.toHaveBeenCalled();
    });

    it('formulario completo envia todos os campos tal como hoje', async () => {
      const d = await abrirCriar();
      fireEvent.change(campo('Nome completo'), { target: { value: 'Novo Guia' } });
      fireEvent.change(campo('Funcao'), { target: { value: 'Guia-Instrutor' } });
      fireEvent.change(campo('Telefone'), { target: { value: '+238 900 0001' } });
      fireEvent.change(campo('WhatsApp'), { target: { value: '+238 900 0002' } });
      fireEvent.change(campo('Email'), { target: { value: 'novo@exemplo.cv' } });
      fireEvent.click(within(d).getByLabelText('EN'));
      fireEvent.click(within(d).getByLabelText('PT'));
      fireEvent.click(within(d).getByLabelText('DE'));
      fireEvent.click(within(d).getByRole('button', { name: 'Surf Coach' }));
      fireEvent.click(within(d).getByRole('button', { name: 'PADI Open Water' }));
      const outra = within(d).getByPlaceholderText('Outra certificacao + Enter');
      fireEvent.change(outra, { target: { value: '  Meu Curso  ' } });
      fireEvent.keyDown(outra, { key: 'Enter' });
      fireEvent.click(within(d).getByLabelText('Tour Sal'));
      fireEvent.click(within(d).getByLabelText('Tour Vulcao'));
      fireEvent.click(within(d).getByRole('button', { name: 'Qua' }));
      fireEvent.click(within(d).getByRole('button', { name: 'Seg' }));
      fireEvent.change(campo('Bio curta'), { target: { value: 'Experiente' } });
      fireEvent.click(botaoConta());
      fireEvent.click(botaoDoDialogo('Adicionar guia'));
      await waitFor(() => expect(createStaff).toHaveBeenCalledTimes(1));
      const certs = ['Surf Coach', 'PADI Open Water', 'Meu Curso'];
      expect(createStaff.mock.calls[0]).toStrictEqual([{
        name: 'Novo Guia', role: 'Guia-Instrutor', phone: '+238 900 0001', email: 'novo@exemplo.cv',
        whatsapp: '+238 900 0002', status: 'active', bio: 'Experiente',
        photo_url: null,
        languages: ['EN', 'PT', 'DE'],
        certifications: certs,
        skills: certs,
        schedule: ['Qua', 'Seg'],
        tour_ids: ['u2', 'u1'],
        create_access: true,
        guide_meta: JSON.stringify({
          bio: 'Experiente', languages: ['EN', 'PT', 'DE'], certifications: certs,
          schedule: ['Qua', 'Seg'], tour_ids: ['u2', 'u1'],
        }),
      }]);
    });

    it('sem validacao nativa: nome vazio tambem se envia (como hoje)', async () => {
      await abrirCriar();
      fireEvent.click(botaoDoDialogo('Adicionar guia'));
      await waitFor(() => expect(createStaff).toHaveBeenCalledTimes(1));
      expect(createStaff.mock.calls[0][0].name).toBe('');
    });

    it('sucesso: fecha o modal e o guia novo fica no topo da lista', async () => {
      await abrirCriar();
      fireEvent.change(campo('Nome completo'), { target: { value: 'Novo Guia' } });
      fireEvent.click(botaoDoDialogo('Adicionar guia'));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(nomesNaGrelha()).toEqual(['Novo Guia', 'Ana Lopes', 'Rui Costa', 'Sara Dias', 'Tiago Vaz']);
      expect(screen.getByText('2 disponivel(is) · 5 total')).toBeInTheDocument();
    });

    it('enquanto grava o botao fica bloqueado e depois fecha', async () => {
      await abrirCriar();
      const espera = adiado();
      createStaff.mockReset().mockReturnValue(espera.promise);
      fireEvent.change(campo('Nome completo'), { target: { value: 'Novo Guia' } });
      fireEvent.click(botaoDoDialogo('Adicionar guia'));
      await waitFor(() => expect(botaoDoDialogo('Adicionar guia')).toBeDisabled());
      espera.resolve({ id: 'gNovo', name: 'Novo Guia', role: 'Guia', status: 'active' });
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('erro do servidor mostra a mensagem, mantem o modal e os dados', async () => {
      await abrirCriar();
      createStaff.mockReset().mockRejectedValue(erroApi('Nome duplicado'));
      fireEvent.change(campo('Nome completo'), { target: { value: 'Novo Guia' } });
      fireEvent.click(botaoDoDialogo('Adicionar guia'));
      expect(await screen.findByText('Nome duplicado')).toBeInTheDocument();
      expect(dialogo()).toBeInTheDocument();
      expect(campo('Nome completo')).toHaveValue('Novo Guia');
      expect(botaoDoDialogo('Adicionar guia')).not.toBeDisabled();
    });

    it('erro sem mensagem usa "Erro ao guardar" e reabrir limpa o erro', async () => {
      await abrirCriar();
      createStaff.mockReset().mockRejectedValue(new Error('rede'));
      fireEvent.click(botaoDoDialogo('Adicionar guia'));
      expect(await screen.findByText('Erro ao guardar')).toBeInTheDocument();
      fireEvent.click(botaoDoDialogo('Cancelar'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Adicionar guia' }));
      expect(screen.queryByText('Erro ao guardar')).not.toBeInTheDocument();
    });

    it('Cancelar, o X e Escape fecham sem chamar servicos de escrita', async () => {
      await abrirCriar();
      fireEvent.click(botaoDoDialogo('Cancelar'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Adicionar guia' }));
      fireEvent.click(botaoDoDialogo('Fechar'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Adicionar guia' }));
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(createStaff).not.toHaveBeenCalled();
      expect(updateStaff).not.toHaveBeenCalled();
    });

    it('so lista os tours activos e esconde a seccao quando nao ha nenhum', async () => {
      const d = await abrirCriar();
      expect(within(d).getByText('Tours que pode conduzir')).toBeInTheDocument();
      expect(within(d).getByLabelText('Tour Vulcao')).toBeInTheDocument();
      expect(within(d).getByLabelText('Tour Sal')).toBeInTheDocument();
      expect(within(d).queryByLabelText('Tour Oculto')).not.toBeInTheDocument();
      cleanup();
      await renderPagina({ unidades: [UNIDADES[2]] });
      fireEvent.click(screen.getByRole('button', { name: 'Adicionar guia' }));
      expect(within(dialogo()).queryByText('Tours que pode conduzir')).not.toBeInTheDocument();
    });

    it('idiomas, certificacoes e dias alternam: ligar e desligar deixa as listas vazias', async () => {
      const d = await abrirCriar();
      fireEvent.click(within(d).getByLabelText('FR'));
      fireEvent.click(within(d).getByLabelText('FR'));
      fireEvent.click(within(d).getByRole('button', { name: 'IKO Kitesurf' }));
      fireEvent.click(within(d).getByRole('button', { name: 'IKO Kitesurf' }));
      fireEvent.click(within(d).getByRole('button', { name: 'Dom' }));
      fireEvent.click(within(d).getByRole('button', { name: 'Dom' }));
      fireEvent.click(within(d).getByLabelText('Tour Vulcao'));
      fireEvent.click(within(d).getByLabelText('Tour Vulcao'));
      fireEvent.change(campo('Nome completo'), { target: { value: 'X' } });
      fireEvent.click(botaoDoDialogo('Adicionar guia'));
      await waitFor(() => expect(createStaff).toHaveBeenCalledTimes(1));
      const dados = createStaff.mock.calls[0][0];
      expect(dados.languages).toEqual([]);
      expect(dados.certifications).toEqual([]);
      expect(dados.schedule).toEqual([]);
      expect(dados.tour_ids).toEqual([]);
    });

    it('certificacao propria: Enter adiciona sem submeter, ignora vazias e repetidas, limpa o campo e remove-se', async () => {
      const d = await abrirCriar();
      const outra = within(d).getByPlaceholderText('Outra certificacao + Enter');
      fireEvent.change(outra, { target: { value: 'Meu Curso' } });
      const naoCancelado = fireEvent.keyDown(outra, { key: 'Enter' });
      expect(naoCancelado).toBe(false);
      expect(outra).toHaveValue('');
      expect(within(d).getByText('Meu Curso')).toBeInTheDocument();
      /* repetida: nao duplica, mas o campo limpa-se */
      fireEvent.change(outra, { target: { value: 'Meu Curso' } });
      fireEvent.keyDown(outra, { key: 'Enter' });
      expect(outra).toHaveValue('');
      expect(within(d).getAllByText('Meu Curso')).toHaveLength(1);
      /* so espacos: ignorada e o campo mantem-se */
      fireEvent.change(outra, { target: { value: '   ' } });
      const cancelado = fireEvent.keyDown(outra, { key: 'Enter' });
      expect(cancelado).toBe(true);
      expect(outra).toHaveValue('   ');
      /* outra tecla nao adiciona */
      fireEvent.change(outra, { target: { value: 'Outro Curso' } });
      fireEvent.keyDown(outra, { key: 'a' });
      expect(within(d).queryByText('Outro Curso')).not.toBeInTheDocument();
      /* remover */
      fireEvent.click(within(d).getByText('Meu Curso').querySelector('button'));
      expect(within(d).queryByText('Meu Curso')).not.toBeInTheDocument();
      fireEvent.change(campo('Nome completo'), { target: { value: 'X' } });
      fireEvent.click(botaoDoDialogo('Adicionar guia'));
      await waitFor(() => expect(createStaff).toHaveBeenCalledTimes(1));
      expect(createStaff.mock.calls[0][0].certifications).toEqual([]);
    });

    it('certificacao predefinida escolhida nao aparece como chip proprio', async () => {
      const d = await abrirCriar();
      fireEvent.click(within(d).getByRole('button', { name: 'Surf Coach' }));
      /* so o botao predefinido existe com esse texto */
      expect(within(d).getAllByText('Surf Coach')).toHaveLength(1);
    });

    it('interruptor da conta /staff mostra e esconde o aviso', async () => {
      const d = await abrirCriar();
      const aviso = /Sera criada uma conta de acesso ao portal \/staff/;
      expect(within(d).queryByText(aviso)).not.toBeInTheDocument();
      fireEvent.click(botaoConta());
      expect(within(d).getByText(aviso)).toBeInTheDocument();
      fireEvent.click(botaoConta());
      expect(within(d).queryByText(aviso)).not.toBeInTheDocument();
    });

    it('foto: o botao abre o seletor de ficheiros e o ficheiro escolhido aparece e segue no pedido', async () => {
      const d = await abrirCriar();
      const entrada = d.querySelector('input[type="file"]');
      expect(entrada).toHaveAttribute('accept', 'image/*');
      const aoClicar = vi.fn((e) => e.preventDefault());
      entrada.addEventListener('click', aoClicar);
      fireEvent.click(entrada.parentElement.querySelector('button'));
      expect(aoClicar).toHaveBeenCalledTimes(1);
      expect(d.querySelector('img')).toBeNull();
      /* sem ficheiro nada muda */
      fireEvent.change(entrada, { target: { files: [] } });
      expect(d.querySelector('img')).toBeNull();
      fireEvent.change(entrada, { target: { files: [new File(['x'], 'foto.png', { type: 'image/png' })] } });
      await waitFor(() => expect(d.querySelector('img')).not.toBeNull());
      expect(d.querySelector('img').getAttribute('src')).toBe('data:image/png;base64,eA==');
      fireEvent.change(campo('Nome completo'), { target: { value: 'X' } });
      fireEvent.click(botaoDoDialogo('Adicionar guia'));
      await waitFor(() => expect(createStaff).toHaveBeenCalledTimes(1));
      expect(createStaff.mock.calls[0][0].photo_url).toBe('data:image/png;base64,eA==');
    });
  });

  describe('editar guia', () => {
    it('abre com os dados do guia e traz o campo Estado, sem a conta /staff', async () => {
      await renderPagina();
      abrirEditar('Ana Lopes');
      const d = dialogo();
      expect(within(d).getByRole('heading', { name: 'Editar: Ana Lopes' })).toBeInTheDocument();
      expect(campo('Nome completo')).toHaveValue('Ana Lopes');
      expect(campo('Funcao')).toHaveValue('Guia');
      expect(campo('Telefone')).toHaveValue('+238 911 1111');
      expect(campo('WhatsApp')).toHaveValue('+238 922 2222');
      expect(campo('Email')).toHaveValue('ana@exemplo.cv');
      expect(campo('Bio curta')).toHaveValue('Guia desde 2015');
      expect(campo('Estado')).toHaveValue('active');
      expect([...campo('Estado').options].map((o) => [o.value, o.textContent])).toEqual([
        ['active', 'Disponivel'], ['busy', 'Ocupado'], ['day_off', 'Folga'], ['inactive', 'Inactivo'],
      ]);
      expect(within(d).getByLabelText('PT')).toBeChecked();
      expect(within(d).getByLabelText('EN')).toBeChecked();
      expect(within(d).getByLabelText('DE')).not.toBeChecked();
      expect(within(d).getByLabelText('Tour Vulcao')).toBeChecked();
      expect(within(d).getByLabelText('Tour Sal')).not.toBeChecked();
      expect(within(d).getByText('Curso Extra')).toBeInTheDocument();
    });

    it('cada campo traz a etiqueta logo por cima', async () => {
      await renderPagina();
      abrirEditar('Ana Lopes');
      temEtiquetaPorCima(['Nome completo', 'Funcao', 'Telefone', 'WhatsApp', 'Email', 'Bio curta', 'Estado']);
    });

    it('sem alterar nada, guarda o mesmo objeto (com o guia e o estado) e substitui o cartao na mesma posicao', async () => {
      await renderPagina();
      abrirEditar('Rui Costa');
      fireEvent.click(botaoDoDialogo('Guardar alteracoes'));
      await waitFor(() => expect(updateStaff).toHaveBeenCalledTimes(1));
      expect(updateStaff.mock.calls[0]).toStrictEqual(['g2', {
        name: 'Rui Costa', role: 'Instrutor', phone: '', email: '', whatsapp: '', status: 'busy', bio: '',
        photo_url: 'https://img.exemplo.cv/rui.png',
        languages: [], certifications: ['IKO Kitesurf'], skills: ['IKO Kitesurf'], schedule: [], tour_ids: [],
        create_access: false,
        guide_meta: '{"bio":"","languages":[],"certifications":["IKO Kitesurf"],"schedule":[],"tour_ids":[]}',
      }]);
      expect(createStaff).not.toHaveBeenCalled();
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(nomesNaGrelha()).toEqual(['Ana Lopes', 'Rui Costa', 'Sara Dias', 'Tiago Vaz']);
    });

    it('alterar campos, estado, idiomas e dias envia os novos valores e actualiza o cartao', async () => {
      await renderPagina();
      abrirEditar('Ana Lopes');
      const d = dialogo();
      fireEvent.change(campo('Nome completo'), { target: { value: 'Ana L. Lopes' } });
      fireEvent.change(campo('Funcao'), { target: { value: 'Instrutor' } });
      fireEvent.change(campo('Estado'), { target: { value: 'busy' } });
      fireEvent.change(campo('Bio curta'), { target: { value: 'Nova bio' } });
      fireEvent.click(within(d).getByLabelText('EN'));
      fireEvent.click(within(d).getByLabelText('FR'));
      fireEvent.click(within(d).getByRole('button', { name: 'Seg' }));
      fireEvent.click(within(d).getByRole('button', { name: 'Dom' }));
      fireEvent.click(within(d).getByRole('button', { name: 'Surf Coach' }));
      fireEvent.click(within(d).getByLabelText('Tour Vulcao'));
      fireEvent.click(within(d).getByLabelText('Tour Sal'));
      fireEvent.click(botaoDoDialogo('Guardar alteracoes'));
      await waitFor(() => expect(updateStaff).toHaveBeenCalledTimes(1));
      const certs = ['PADI Open Water', 'CPR / DAE', 'Curso Extra'];
      expect(updateStaff.mock.calls[0]).toStrictEqual(['g1', {
        name: 'Ana L. Lopes', role: 'Instrutor', phone: '+238 911 1111', email: 'ana@exemplo.cv',
        whatsapp: '+238 922 2222', status: 'busy', bio: 'Nova bio',
        photo_url: null,
        languages: ['PT', 'FR'],
        certifications: certs,
        skills: certs,
        schedule: ['Ter', 'Dom'],
        tour_ids: ['u2'],
        create_access: false,
        guide_meta: JSON.stringify({
          bio: 'Nova bio', languages: ['PT', 'FR'], certifications: certs,
          schedule: ['Ter', 'Dom'], tour_ids: ['u2'],
        }),
      }]);
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(within(cartao('Ana L. Lopes')).getByText('Ocupado')).toBeInTheDocument();
      expect(screen.queryByText('Ana Lopes')).not.toBeInTheDocument();
    });

    it('guia sem listas directas le os dados de guide_meta (JSON)', async () => {
      const meta = guia({
        languages: undefined, certifications: undefined, skills: undefined, schedule: undefined,
        tour_ids: undefined, bio: undefined,
        guide_meta: JSON.stringify({ bio: 'Bio meta', languages: ['FR'], certifications: ['Meta Cert'], schedule: ['Qua'], tour_ids: ['u2'] }),
      });
      await renderPagina({ equipa: [meta] });
      abrirEditar('Ana Lopes');
      expect(campo('Bio curta')).toHaveValue('Bio meta');
      expect(within(dialogo()).getByText('Meta Cert')).toBeInTheDocument();
      expect(within(dialogo()).getByLabelText('FR')).toBeChecked();
      fireEvent.click(botaoDoDialogo('Guardar alteracoes'));
      await waitFor(() => expect(updateStaff).toHaveBeenCalledTimes(1));
      const dados = updateStaff.mock.calls[0][1];
      expect(dados.bio).toBe('Bio meta');
      expect(dados.languages).toEqual(['FR']);
      expect(dados.certifications).toEqual(['Meta Cert']);
      expect(dados.skills).toEqual(['Meta Cert']);
      expect(dados.schedule).toEqual(['Qua']);
      expect(dados.tour_ids).toEqual(['u2']);
      expect(dados.guide_meta).toBe('{"bio":"Bio meta","languages":["FR"],"certifications":["Meta Cert"],"schedule":["Qua"],"tour_ids":["u2"]}');
    });

    it('os campos directos tem prioridade sobre guide_meta', async () => {
      const g = guia({
        languages: ['DE'], bio: 'Bio directa',
        guide_meta: JSON.stringify({ bio: 'Bio meta', languages: ['FR'] }),
      });
      await renderPagina({ equipa: [g] });
      abrirEditar('Ana Lopes');
      expect(campo('Bio curta')).toHaveValue('Bio directa');
      fireEvent.click(botaoDoDialogo('Guardar alteracoes'));
      await waitFor(() => expect(updateStaff).toHaveBeenCalledTimes(1));
      expect(updateStaff.mock.calls[0][1].languages).toEqual(['DE']);
    });

    it('guide_meta invalido nao rebenta e usa os valores por omissao', async () => {
      const g = guia({
        languages: undefined, certifications: undefined, skills: undefined, schedule: undefined,
        tour_ids: undefined, bio: undefined, guide_meta: 'isto nao e json',
      });
      await renderPagina({ equipa: [g] });
      abrirEditar('Ana Lopes');
      expect(campo('Bio curta')).toHaveValue('');
      fireEvent.click(botaoDoDialogo('Guardar alteracoes'));
      await waitFor(() => expect(updateStaff).toHaveBeenCalledTimes(1));
      expect(updateStaff.mock.calls[0][1].languages).toEqual([]);
      expect(updateStaff.mock.calls[0][1].guide_meta).toBe('{"bio":"","languages":[],"certifications":[],"schedule":[],"tour_ids":[]}');
    });

    it('mostra a foto actual do guia', async () => {
      await renderPagina();
      abrirEditar('Rui Costa');
      expect(dialogo().querySelector('img').getAttribute('src')).toBe('https://img.exemplo.cv/rui.png');
    });

    it('erro do servidor mostra a mensagem e mantem o modal; sem mensagem usa "Erro ao guardar"', async () => {
      await renderPagina();
      abrirEditar('Ana Lopes');
      updateStaff.mockReset().mockRejectedValue(erroApi('Sem permissao'));
      fireEvent.click(botaoDoDialogo('Guardar alteracoes'));
      expect(await screen.findByText('Sem permissao')).toBeInTheDocument();
      updateStaff.mockReset().mockRejectedValue(new Error('rede'));
      fireEvent.click(botaoDoDialogo('Guardar alteracoes'));
      expect(await screen.findByText('Erro ao guardar')).toBeInTheDocument();
      expect(screen.queryByText('Sem permissao')).not.toBeInTheDocument();
      expect(dialogo()).toBeInTheDocument();
    });

    it('Cancelar fecha sem guardar', async () => {
      await renderPagina();
      abrirEditar('Ana Lopes');
      fireEvent.click(botaoDoDialogo('Cancelar'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(updateStaff).not.toHaveBeenCalled();
    });
  });

  describe('eliminar guia', () => {
    it('pede confirmacao com o nome do guia; Cancelar nao chama o servico', async () => {
      await renderPagina();
      abrirEliminar('Sara Dias');
      const d = dialogo();
      expect(within(d).getByRole('heading', { name: 'Confirmar' })).toBeInTheDocument();
      expect(d.textContent).toContain('Eliminar o guia "Sara Dias"? Esta accao nao pode ser desfeita.');
      fireEvent.click(botaoDoDialogo('Cancelar'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(deleteStaff).not.toHaveBeenCalled();
      expect(screen.getByText('Sara Dias')).toBeInTheDocument();
    });

    it('Eliminar chama deleteStaff com o id, tira o guia da lista e fecha', async () => {
      await renderPagina();
      abrirEliminar('Sara Dias');
      fireEvent.click(botaoDoDialogo('Eliminar'));
      await waitFor(() => expect(screen.queryByText('Sara Dias')).not.toBeInTheDocument());
      expect(deleteStaff).toHaveBeenCalledTimes(1);
      expect(deleteStaff).toHaveBeenCalledWith('g3');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByText('1 disponivel(is) · 3 total')).toBeInTheDocument();
    });

    it('servico a falhar regista o erro, fecha o modal e o guia continua na lista', async () => {
      esperaErros = true;
      await renderPagina();
      deleteStaff.mockReset().mockRejectedValue(new Error('rede'));
      abrirEliminar('Sara Dias');
      fireEvent.click(botaoDoDialogo('Eliminar'));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(screen.getByText('Sara Dias')).toBeInTheDocument();
      expect(errSpy).toHaveBeenCalledTimes(1);
      expect(errSpy.mock.calls[0][0].message).toBe('rede');
    });
  });

  describe('historial', () => {
    const j1 = { id: 'j1', status: 'completed', reservations: { units: { name: 'Tour Vulcao' } }, assigned_at: new Date(2026, 4, 10, 12, 0, 0).toISOString(), earnings_amount: 25 };
    const j2 = { id: 'j2', status: 'pending', reservation_id: 'abcdef123456', assigned_at: null, earnings_amount: 0 };
    const j3 = { id: 'j3', status: 'completed', reservations: { units: { name: 'Tour Sal' } }, assigned_at: new Date(2026, 4, 11, 12, 0, 0).toISOString(), earnings_amount: '10.5' };
    const j4 = { id: 'j4', status: 'weird' };
    const j5 = { id: 'j5', status: 'cancelled', reservations: { units: { name: 'Tour Cancelado' } }, earnings_amount: 99 };

    function abrirHistorial(nome) {
      fireEvent.click(within(cartao(nome)).getByRole('button', { name: 'Historial' }));
    }

    it('chama getStaffJobs com o id e mostra o titulo com o nome do guia', async () => {
      await renderPagina();
      abrirHistorial('Ana Lopes');
      expect(within(dialogo()).getByRole('heading', { name: 'Historial — Ana Lopes' })).toBeInTheDocument();
      await waitFor(() => expect(getStaffJobs).toHaveBeenCalledTimes(1));
      expect(getStaffJobs).toHaveBeenCalledWith('g1');
    });

    it('enquanto carrega mostra o indicador e depois a lista', async () => {
      await renderPagina();
      const espera = adiado();
      getStaffJobs.mockReset().mockReturnValue(espera.promise);
      abrirHistorial('Ana Lopes');
      expect(dialogo().querySelector('.animate-spin')).not.toBeNull();
      expect(within(dialogo()).queryByText('Sem tours registados')).not.toBeInTheDocument();
      espera.resolve([j1]);
      expect(await within(dialogo()).findByText('Tour Vulcao')).toBeInTheDocument();
      expect(dialogo().querySelector('.animate-spin')).toBeNull();
    });

    it('sem tours mostra o aviso', async () => {
      await renderPagina();
      abrirHistorial('Ana Lopes');
      expect(await within(dialogo()).findByText('Sem tours registados')).toBeInTheDocument();
      expect(within(dialogo()).queryByText('Total ganho')).not.toBeInTheDocument();
    });

    it('servico a falhar cai no aviso de "sem tours" sem regista erro', async () => {
      await renderPagina();
      getStaffJobs.mockReset().mockRejectedValue(new Error('rede'));
      abrirHistorial('Ana Lopes');
      expect(await within(dialogo()).findByText('Sem tours registados')).toBeInTheDocument();
    });

    it('lista cada tour com nome, data local, ganhos e estado; o total so soma os concluidos', async () => {
      await renderPagina();
      getStaffJobs.mockReset().mockResolvedValue([j1, j2, j3, j4, j5]);
      abrirHistorial('Ana Lopes');
      const d = dialogo();
      expect(await within(d).findByText('Tour Vulcao')).toBeInTheDocument();
      expect(within(d).getByText('Total ganho')).toBeInTheDocument();
      expect(within(d).getByText('€35.50')).toBeInTheDocument();
      expect(within(d).getByText('10/05/2026')).toBeInTheDocument();
      expect(within(d).getByText('11/05/2026')).toBeInTheDocument();
      expect(within(d).getByText('€25.00')).toBeInTheDocument();
      expect(within(d).getByText('€10.50')).toBeInTheDocument();
      expect(within(d).getByText('€99.00')).toBeInTheDocument();
      /* nome por omissao: 8 primeiros caracteres da reserva, ou traco */
      expect(within(d).getByText('abcdef12')).toBeInTheDocument();
      expect(within(d).getByText('Tour Sal')).toBeInTheDocument();
      expect(within(d).getByText('Tour Cancelado')).toBeInTheDocument();
      /* sem data, o traco */
      expect(within(d).getAllByText('—').length).toBeGreaterThanOrEqual(2);
      /* rotulos de estado, e o desconhecido aparece tal como vem */
      expect(within(d).getAllByText('Concluido')).toHaveLength(2);
      expect(within(d).getByText('Pendente')).toBeInTheDocument();
      expect(within(d).getByText('Cancelado')).toBeInTheDocument();
      expect(within(d).getByText('weird')).toBeInTheDocument();
    });

    it('os outros estados tem rotulo proprio', async () => {
      await renderPagina();
      getStaffJobs.mockReset().mockResolvedValue([
        { id: 'a', status: 'confirmed', reservations: { units: { name: 'T1' } } },
        { id: 'b', status: 'in_progress', reservations: { units: { name: 'T2' } } },
      ]);
      abrirHistorial('Ana Lopes');
      expect(await within(dialogo()).findByText('Confirmado')).toBeInTheDocument();
      expect(within(dialogo()).getByText('Em progresso')).toBeInTheDocument();
    });

    it('sem ganhos concluidos nao mostra o total', async () => {
      await renderPagina();
      getStaffJobs.mockReset().mockResolvedValue([j2, j5]);
      abrirHistorial('Ana Lopes');
      expect(await within(dialogo()).findByText('Tour Cancelado')).toBeInTheDocument();
      expect(within(dialogo()).queryByText('Total ganho')).not.toBeInTheDocument();
    });

    it('o X fecha o historial', async () => {
      await renderPagina();
      abrirHistorial('Ana Lopes');
      await within(dialogo()).findByText('Sem tours registados');
      fireEvent.click(botaoDoDialogo('Fechar'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('atribuir (operador que nao e de actividades)', () => {
    function abrirAtribuir(nome) {
      fireEvent.click(within(cartao(nome)).getByRole('button', { name: /Atribuir/ }));
    }

    for (const tipo of ['hotel', 'rentacar', null]) {
      it(`operador ${tipo} abre "Atribuir a" com as reservas proximas por ordem de data`, async () => {
        await renderPagina({}, tipo);
        abrirAtribuir('Ana Lopes');
        const d = dialogo();
        expect(within(d).getByRole('heading', { name: 'Atribuir a — Ana Lopes' })).toBeInTheDocument();
        const radios = within(d).getAllByRole('radio');
        expect(radios.map((r) => r.value)).toEqual(['r2', 'r1']);
        expect(within(d).getByText('abcdef12')).toBeInTheDocument();
        expect(within(d).getByText('2099-01-05 · 4 pax · —')).toBeInTheDocument();
        expect(within(d).getByText('Tour Vulcao')).toBeInTheDocument();
        expect(within(d).getByText('2099-03-02 · 2 pax · Maria Silva')).toBeInTheDocument();
        /* passada, cancelada e em curso ficam de fora */
        expect(within(d).queryByText(/Passada|Cancelada|Em curso/)).not.toBeInTheDocument();
        expect(listFleet).not.toHaveBeenCalled();
      });
    }

    it('Atribuir fica bloqueado ate escolher; depois chama createAssignment e fecha', async () => {
      await renderPagina();
      abrirAtribuir('Ana Lopes');
      const d = dialogo();
      expect(botaoDoDialogo('Atribuir')).toBeDisabled();
      fireEvent.click(within(d).getByText('2099-03-02 · 2 pax · Maria Silva'));
      expect(within(d).getByRole('radio', { checked: true }).value).toBe('r1');
      fireEvent.click(within(d).getByRole('radio', { name: /abcdef12/ }));
      expect(within(d).getByRole('radio', { checked: true }).value).toBe('r2');
      expect(botaoDoDialogo('Atribuir')).not.toBeDisabled();
      fireEvent.click(botaoDoDialogo('Atribuir'));
      await waitFor(() => expect(createAssignment).toHaveBeenCalledTimes(1));
      expect(createAssignment).toHaveBeenCalledWith({ staff_id: 'g1', reservation_id: 'r2' });
      expect(createCompositeAssignment).not.toHaveBeenCalled();
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('atribui ao guia do cartao em que se carregou', async () => {
      await renderPagina();
      abrirAtribuir('Rui Costa');
      fireEvent.click(within(dialogo()).getAllByRole('radio')[1]);
      fireEvent.click(botaoDoDialogo('Atribuir'));
      await waitFor(() => expect(createAssignment).toHaveBeenCalledWith({ staff_id: 'g2', reservation_id: 'r1' }));
    });

    it('enquanto grava o botao fica bloqueado', async () => {
      await renderPagina();
      const espera = adiado();
      createAssignment.mockReset().mockReturnValue(espera.promise);
      abrirAtribuir('Ana Lopes');
      fireEvent.click(within(dialogo()).getAllByRole('radio')[0]);
      fireEvent.click(botaoDoDialogo('Atribuir'));
      await waitFor(() => expect(botaoDoDialogo('Atribuir')).toBeDisabled());
      espera.resolve({ id: 'a1' });
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('erro do servidor mostra a mensagem e mantem o modal; sem mensagem usa "Erro ao atribuir"', async () => {
      await renderPagina();
      abrirAtribuir('Ana Lopes');
      fireEvent.click(within(dialogo()).getAllByRole('radio')[0]);
      createAssignment.mockReset().mockRejectedValue(erroApi('Guia ocupado nesse dia'));
      fireEvent.click(botaoDoDialogo('Atribuir'));
      expect(await screen.findByText('Guia ocupado nesse dia')).toBeInTheDocument();
      createAssignment.mockReset().mockRejectedValue(new Error('rede'));
      fireEvent.click(botaoDoDialogo('Atribuir'));
      expect(await screen.findByText('Erro ao atribuir')).toBeInTheDocument();
      expect(dialogo()).toBeInTheDocument();
    });

    it('sem reservas proximas mostra o aviso e nao deixa atribuir', async () => {
      await renderPagina({ reservas: [RESERVAS[2], RESERVAS[3]] });
      abrirAtribuir('Ana Lopes');
      expect(within(dialogo()).getByText('Sem reservas proximas pendentes.')).toBeInTheDocument();
      expect(within(dialogo()).queryAllByRole('radio')).toHaveLength(0);
      expect(botaoDoDialogo('Atribuir')).toBeDisabled();
    });

    it('Cancelar e o X fecham sem chamar o servico', async () => {
      await renderPagina();
      abrirAtribuir('Ana Lopes');
      fireEvent.click(botaoDoDialogo('Cancelar'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      abrirAtribuir('Ana Lopes');
      fireEvent.click(botaoDoDialogo('Fechar'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(createAssignment).not.toHaveBeenCalled();
    });
  });

  describe('atribuir (operador de actividades)', () => {
    it('abre a atribuicao de equipa com o guia do cartao e todos os guias na lista', async () => {
      await renderPagina({}, 'activity');
      fireEvent.click(within(cartao('Rui Costa')).getByRole('button', { name: /Atribuir/ }));
      const d = dialogo();
      expect(within(d).getByRole('heading', { name: 'Atribuir equipa' })).toBeInTheDocument();
      await waitFor(() => expect(listFleet).toHaveBeenCalledTimes(1));
      expect(listFleet).toHaveBeenCalledWith({ type: 'vehicle', status: 'available' });
      expect(campo('Guia')).toHaveValue('g2');
      expect([...campo('Guia').options].map((o) => o.value)).toEqual(['', 'g1', 'g2', 'g3', 'g4']);
    });

    it('escolhe a reserva e atribui com o objecto composto; depois fecha', async () => {
      await renderPagina({}, 'activity');
      fireEvent.click(within(cartao('Rui Costa')).getByRole('button', { name: /Atribuir/ }));
      const d = dialogo();
      await waitFor(() => expect(listFleet).toHaveBeenCalled());
      expect(within(d).getAllByRole('radio').map((r) => r.value)).toEqual(['r2', 'r1']);
      fireEvent.click(within(d).getAllByRole('radio')[1]);
      fireEvent.click(botaoDoDialogo('Atribuir'));
      await waitFor(() => expect(createCompositeAssignment).toHaveBeenCalledTimes(1));
      expect(createCompositeAssignment).toHaveBeenCalledWith({
        reservation_id: 'r1', vehicle_id: null, guide_id: 'g2', driver_id: 'g2',
      });
      expect(createAssignment).not.toHaveBeenCalled();
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('Cancelar fecha sem atribuir', async () => {
      await renderPagina({}, 'activity');
      fireEvent.click(within(cartao('Ana Lopes')).getByRole('button', { name: /Atribuir/ }));
      await waitFor(() => expect(listFleet).toHaveBeenCalled());
      fireEvent.click(botaoDoDialogo('Cancelar'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(createCompositeAssignment).not.toHaveBeenCalled();
    });
  });

  describe('separadores e disponibilidade semanal', () => {
    /* Quarta-feira, 17 de Junho de 2026 ao meio-dia, hora local: a semana vai de 15 a 21 */
    const SEMANA = ['2026-06-15', '2026-06-16', '2026-06-17', '2026-06-18', '2026-06-19', '2026-06-20', '2026-06-21'];

    async function renderComSemana(opcoes = {}) {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 5, 17, 12, 0, 0));
      await renderPagina(opcoes);
      fireEvent.click(separador('Disponibilidade'));
    }

    function linha(primeiroNome) {
      return screen.getByText(primeiroNome).closest('tr');
    }

    function celulas(primeiroNome) {
      return within(linha(primeiroNome)).getAllByRole('button');
    }

    it('os dois separadores existem e a lista e o separador inicial', async () => {
      await renderPagina();
      expect(separador('Guias')).toBeInTheDocument();
      expect(separador('Disponibilidade')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Adicionar guia' })).toBeInTheDocument();
      expect(screen.getByText('Ana Lopes')).toBeInTheDocument();
    });

    it('no separador de disponibilidade desaparecem o botao de criar e os filtros; voltar repoe-nos', async () => {
      await renderPagina();
      fireEvent.click(separador('Disponibilidade'));
      expect(screen.queryByRole('button', { name: 'Adicionar guia' })).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText('Pesquisar guia...')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Todos' })).not.toBeInTheDocument();
      expect(screen.queryByText('Guia desde 2015')).not.toBeInTheDocument();
      fireEvent.click(separador('Guias'));
      expect(screen.getByRole('button', { name: 'Adicionar guia' })).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Pesquisar guia...')).toBeInTheDocument();
      expect(screen.getByText('Guia desde 2015')).toBeInTheDocument();
    });

    it('cabecalho com o guia e os sete dias da semana (dia do mes + abreviatura)', async () => {
      await renderComSemana();
      const cabecalhos = screen.getAllByRole('columnheader').map((c) => c.textContent);
      expect(cabecalhos).toEqual(['Guia', '15Seg', '16Ter', '17Qua', '18Qui', '19Sex', '20Sab', '21Dom']);
    });

    it('uma linha por guia nao inactivo, com o primeiro nome e a funcao', async () => {
      await renderComSemana();
      expect(within(linha('Ana')).getByText('Guia')).toBeInTheDocument();
      expect(within(linha('Rui')).getByText('Instrutor')).toBeInTheDocument();
      expect(within(linha('Sara')).getByText('Assistente')).toBeInTheDocument();
      expect(screen.queryByText('Tiago')).not.toBeInTheDocument();
      expect(screen.queryByText('Beto')).not.toBeInTheDocument();
      expect(screen.getAllByRole('row')).toHaveLength(1 + 3);
      expect(within(linha('Ana')).getByText('AL')).toBeInTheDocument();
    });

    it('sete botoes por linha, todos disponiveis ao inicio, com a dica de como alternar', async () => {
      await renderComSemana();
      for (const nome of ['Ana', 'Rui', 'Sara']) {
        const botoes = celulas(nome);
        expect(botoes).toHaveLength(7);
        for (const b of botoes) {
          expect(b).toHaveAttribute('title', 'Disponivel — clicar para marcar indisponivel');
          expect(b).not.toBeDisabled();
        }
      }
    });

    it('legenda e dica por baixo da tabela', async () => {
      await renderComSemana();
      expect(screen.getAllByText('Disponivel').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Indisponivel')).toBeInTheDocument();
      expect(screen.getByText('Clicar para alternar')).toBeInTheDocument();
    });

    it('clicar chama setAvailability com o guia e a data (hora local) e alterna a dica', async () => {
      await renderComSemana();
      const botao = celulas('Ana')[2];
      fireEvent.click(botao);
      await waitFor(() => expect(botao).toHaveAttribute('title', 'Indisponivel — clicar para marcar disponivel'));
      expect(setAvailability).toHaveBeenCalledTimes(1);
      expect(setAvailability).toHaveBeenCalledWith('g1', { date: SEMANA[2], is_available: false });
      /* os outros dias e os outros guias nao mudam */
      expect(celulas('Ana')[1]).toHaveAttribute('title', 'Disponivel — clicar para marcar indisponivel');
      expect(celulas('Rui')[2]).toHaveAttribute('title', 'Disponivel — clicar para marcar indisponivel');
      /* clicar de novo volta a marcar disponivel */
      fireEvent.click(botao);
      await waitFor(() => expect(botao).toHaveAttribute('title', 'Disponivel — clicar para marcar indisponivel'));
      expect(setAvailability).toHaveBeenCalledTimes(2);
      expect(setAvailability).toHaveBeenLastCalledWith('g1', { date: SEMANA[2], is_available: true });
    });

    it('cada coluna corresponde ao dia certo da semana', async () => {
      await renderComSemana();
      const botoes = celulas('Rui');
      for (let i = 0; i < 7; i += 1) fireEvent.click(botoes[i]);
      await waitFor(() => expect(setAvailability).toHaveBeenCalledTimes(7));
      expect(setAvailability.mock.calls).toStrictEqual(
        SEMANA.map((data) => ['g2', { date: data, is_available: false }]),
      );
    });

    it('enquanto grava, so esse botao fica bloqueado', async () => {
      await renderComSemana();
      const espera = adiado();
      setAvailability.mockReset().mockReturnValue(espera.promise);
      const botao = celulas('Sara')[0];
      fireEvent.click(botao);
      await waitFor(() => expect(botao).toBeDisabled());
      expect(celulas('Sara')[1]).not.toBeDisabled();
      expect(celulas('Ana')[0]).not.toBeDisabled();
      espera.resolve({ ok: true });
      await waitFor(() => expect(botao).not.toBeDisabled());
      expect(botao).toHaveAttribute('title', 'Indisponivel — clicar para marcar disponivel');
    });

    it('servico a falhar e silencioso: o botao volta a ficar livre e o estado nao muda', async () => {
      await renderComSemana();
      setAvailability.mockReset().mockRejectedValue(new Error('rede'));
      const botao = celulas('Ana')[0];
      fireEvent.click(botao);
      await waitFor(() => expect(setAvailability).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(botao).not.toBeDisabled());
      expect(botao).toHaveAttribute('title', 'Disponivel — clicar para marcar indisponivel');
    });

    it('sem guias nao inactivos mostra o vazio compacto', async () => {
      await renderComSemana({ equipa: [TIAGO()] });
      expect(screen.getByText('Sem guias para mostrar disponibilidade')).toBeInTheDocument();
      expect(screen.queryAllByRole('columnheader')).toHaveLength(0);
    });

    it('sem nenhum guia mostra o vazio compacto', async () => {
      await renderComSemana({ equipa: [] });
      expect(screen.getByText('Sem guias para mostrar disponibilidade')).toBeInTheDocument();
    });

    it('trocar de separador e voltar perde as marcacoes locais (como hoje)', async () => {
      await renderComSemana();
      const botao = celulas('Ana')[0];
      fireEvent.click(botao);
      await waitFor(() => expect(botao).toHaveAttribute('title', 'Indisponivel — clicar para marcar disponivel'));
      fireEvent.click(separador('Guias'));
      fireEvent.click(separador('Disponibilidade'));
      expect(celulas('Ana')[0]).toHaveAttribute('title', 'Disponivel — clicar para marcar indisponivel');
    });

    it('a semana acompanha o dia de hoje: numa segunda-feira comeca nesse dia, num domingo acaba nele', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 5, 15, 12, 0, 0));
      await renderPagina();
      fireEvent.click(separador('Disponibilidade'));
      expect(screen.getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Guia', '15Seg', '16Ter', '17Qua', '18Qui', '19Sex', '20Sab', '21Dom']);
      cleanup();
      vi.setSystemTime(new Date(2026, 5, 21, 12, 0, 0));
      await renderPagina();
      fireEvent.click(separador('Disponibilidade'));
      expect(screen.getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Guia', '15Seg', '16Ter', '17Qua', '18Qui', '19Sex', '20Sab', '21Dom']);
    });
  });
});

/* Novos com o desenho do sistema: nomes acessiveis nos botoes so com icone, separadores e chips.
   (Nao fazem parte da rede de seguranca anterior a migracao.) */
describe('Guias (desenho do sistema)', () => {
  let errSpy;
  let warnSpy;

  beforeEach(() => {
    useUiStore.setState({ lang: 'pt' });
    defineOperador('hotel');
    carregaServicos();
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    const erros = errSpy.mock.calls.length;
    const avisos = warnSpy.mock.calls.length;
    errSpy.mockRestore();
    warnSpy.mockRestore();
    expect(erros).toBe(0);
    expect(avisos).toBe(0);
  });

  async function renderPagina() {
    render(
      <MemoryRouter future={FUTURE}>
        <Guides />
      </MemoryRouter>,
    );
    await waitFor(() => expect(listReservations).toHaveBeenCalled());
    await waitFor(() => expect(document.querySelector('.animate-spin')).toBeNull());
  }

  it('editar e eliminar de cada cartao tem nome acessivel', async () => {
    await renderPagina();
    expect(screen.getAllByRole('button', { name: 'Editar' })).toHaveLength(4);
    expect(screen.getAllByRole('button', { name: 'Eliminar' })).toHaveLength(4);
    const c = cartao('Rui Costa');
    expect(within(c).getByRole('button', { name: 'Editar' })).toBe(botoesIcone(c)[0]);
    expect(within(c).getByRole('button', { name: 'Eliminar' })).toBe(botoesIcone(c)[1]);
  });

  it('o formulario nomeia os botoes so com icone', async () => {
    await renderPagina();
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar guia' }));
    const d = dialogo();
    expect(within(d).getByRole('button', { name: 'Carregar foto' })).toBeInTheDocument();
    expect(within(d).getByRole('button', { name: 'Criar conta /staff' })).toBeInTheDocument();
    const outra = within(d).getByPlaceholderText('Outra certificacao + Enter');
    fireEvent.change(outra, { target: { value: 'Meu Curso' } });
    fireEvent.keyDown(outra, { key: 'Enter' });
    expect(within(d).getByRole('button', { name: 'Remover' })).toBeInTheDocument();
  });

  it('os separadores sao um tablist com o activo marcado', async () => {
    await renderPagina();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['Guias', 'Disponibilidade']);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(tabs[1]);
    expect(screen.getAllByRole('tab')[0]).toHaveAttribute('aria-selected', 'false');
    expect(screen.getAllByRole('tab')[1]).toHaveAttribute('aria-selected', 'true');
  });

  it('os chips de estado marcam o escolhido', async () => {
    await renderPagina();
    expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Ocupado' }));
    expect(screen.getByRole('button', { name: 'Ocupado' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('a disponibilidade e uma tabela com cabecalhos de coluna', async () => {
    await renderPagina();
    fireEvent.click(screen.getByText('Disponibilidade', { selector: 'button' }));
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader')).toHaveLength(8);
  });
});
