import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Fleet from '../pages/Fleet';
import FleetSelector from '../components/fleet/FleetSelector';
import useUiStore from '../store/uiStore';
import {
  listFleet, createFleet, updateFleet, deleteFleet, getFleetAvailability,
} from '../services/fleetService';
import { listUnits } from '../services/unitsService';

/* Sem rede: todos os servicos usados pela pagina e pelo seletor sao simulados */
vi.mock('../services/fleetService', () => ({
  listFleet: vi.fn(),
  createFleet: vi.fn(),
  updateFleet: vi.fn(),
  deleteFleet: vi.fn(),
  getFleetAvailability: vi.fn(),
}));
vi.mock('../services/unitsService', () => ({ listUnits: vi.fn() }));

/* ---- Dados ---- */

/* Datas de manutencao afastadas no passado e no futuro: o resultado nao depende do dia em que o teste corre */
const KIA = () => ({
  id: 'f1', name: 'Kia Sportage', plate: 'SL-12-AB', type: 'vehicle', status: 'available', capacity: 4,
  unit_id: 'u1', units: { name: 'Tour Vulcao' }, images: ['https://img.exemplo.cv/kia.png'],
  description: 'Bom estado', notes: 'nota interna',
  last_maintenance_at: '2025-01-10T00:00:00.000Z', next_maintenance_at: '2099-06-01T00:00:00.000Z',
});
const PRANCHA = () => ({
  id: 'f2', name: 'Prancha Kite 12m', type: 'equipment', status: 'in_use', capacity: null,
  next_maintenance_at: '2000-03-15T00:00:00.000Z',
});
const COLETE = () => ({ id: 'f3', name: 'Colete Salva-vidas', type: 'gear', status: 'maintenance', capacity: 0, images: [] });
const QUAD = () => ({ id: 'f4', name: 'Quad Velho', plate: '', type: 'vehicle', status: 'retired', capacity: 2, images: [] });
const BARCO = () => ({ id: 'f5', name: 'Barco Misterio', type: 'boat', status: 'weird', capacity: 6 });
const FROTA = () => [KIA(), PRANCHA(), COLETE(), QUAD(), BARCO()];

const UNIDADES = [
  { id: 'u1', name: 'Tour Vulcao' },
  { id: 'u2', name: 'Tour Sal' },
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

/* Os servicos rejeitam formas de argumentos que a pagina nunca envia */
function carregaServicos({ frota = FROTA(), unidades = UNIDADES } = {}) {
  listFleet.mockReset().mockImplementation(async (...args) => {
    if (args.length) throw new Error('listFleet: argumentos inesperados');
    return frota;
  });
  listUnits.mockReset().mockImplementation(async (...args) => {
    if (args.length) throw new Error('listUnits: argumentos inesperados');
    return unidades;
  });
  createFleet.mockReset().mockImplementation(async (dados) => {
    if (!dados || typeof dados !== 'object' || typeof dados.name !== 'string') throw new Error('createFleet: argumentos inesperados');
    return { id: 'fNovo', ...dados };
  });
  updateFleet.mockReset().mockImplementation(async (id, dados) => {
    if (typeof id !== 'string' || !dados || typeof dados !== 'object') throw new Error('updateFleet: argumentos inesperados');
    return { ...frota.find((i) => i.id === id), ...dados, id };
  });
  deleteFleet.mockReset().mockImplementation(async (id) => {
    if (typeof id !== 'string') throw new Error('deleteFleet: argumentos inesperados');
  });
  getFleetAvailability.mockReset().mockImplementation(async (unitId, data) => {
    if (typeof unitId !== 'string' || typeof data !== 'string') throw new Error('getFleetAvailability: argumentos inesperados');
    return [];
  });
}

/* ---- Consultas ---- */

function dialogo() {
  return screen.getByRole('dialog');
}

/* Cartao de um item: o maior bloco que contem o nome e so o seu proprio botao Editar */
function cartao(nome) {
  let el = screen.getByText(nome);
  while (el && within(el).queryAllByRole('button', { name: 'Editar' }).length !== 1) el = el.parentElement;
  if (!el) throw new Error(`Cartao nao encontrado: ${nome}`);
  while (el.parentElement && within(el.parentElement).queryAllByRole('button', { name: 'Editar' }).length === 1) el = el.parentElement;
  return el;
}

function abrirEditar(nome) {
  fireEvent.click(within(cartao(nome)).getByRole('button', { name: 'Editar' }));
}

function abrirEliminar(nome) {
  fireEvent.click(within(cartao(nome)).getByRole('button', { name: 'Eliminar' }));
}

/* O campo que esta por baixo de uma etiqueta do desenho do sistema (partilham o mesmo bloco) */
function campo(texto) {
  const etiqueta = within(dialogo()).getByText(texto, { selector: 'label' });
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

function nomesNaGrelha() {
  return screen.getAllByText(/^(Kia Sportage|Prancha Kite 12m|Colete Salva-vidas|Quad Velho|Barco Misterio|Novo Item)$/).map((e) => e.textContent);
}

describe('Frota', () => {
  let errSpy;
  let warnSpy;

  beforeEach(() => {
    useUiStore.setState({ lang: 'pt' });
    carregaServicos();
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    /* nenhum erro ou aviso no consolo */
    const erros = errSpy.mock.calls.length;
    const avisos = warnSpy.mock.calls.length;
    errSpy.mockRestore();
    warnSpy.mockRestore();
    expect(erros).toBe(0);
    expect(avisos).toBe(0);
  });

  async function renderPagina(opcoes = {}) {
    carregaServicos(opcoes);
    const r = render(<Fleet />);
    await waitFor(() => expect(listFleet).toHaveBeenCalled());
    await waitFor(() => expect(document.querySelector('.animate-spin')).toBeNull());
    return r;
  }

  describe('pagina e lista', () => {
    it('titulo, subtitulo "N disponivel(is) de M" e botao de criar', async () => {
      await renderPagina();
      expect(screen.getByRole('heading', { level: 1, name: 'Frota e Equipamento' })).toBeInTheDocument();
      expect(screen.getByText('1 disponivel(is) de 5')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Novo item' })).toBeInTheDocument();
    });

    it('o subtitulo conta so os itens disponiveis', async () => {
      await renderPagina({ frota: [KIA(), { ...KIA(), id: 'f9', name: 'Outro Kia' }, PRANCHA()] });
      expect(screen.getByText('2 disponivel(is) de 3')).toBeInTheDocument();
    });

    it('carrega frota e tours sem argumentos', async () => {
      await renderPagina();
      expect(listFleet).toHaveBeenCalledTimes(1);
      expect(listFleet).toHaveBeenCalledWith();
      expect(listUnits).toHaveBeenCalledTimes(1);
      expect(listUnits).toHaveBeenCalledWith();
    });

    it('lista todos os itens pela ordem do servidor', async () => {
      await renderPagina();
      expect(nomesNaGrelha()).toEqual(['Kia Sportage', 'Prancha Kite 12m', 'Colete Salva-vidas', 'Quad Velho', 'Barco Misterio']);
    });

    it('cartao completo: matricula, estado, lugares, tour associado, foto e manutencao futura', async () => {
      await renderPagina();
      const c = cartao('Kia Sportage');
      expect(within(c).getByText('SL-12-AB')).toBeInTheDocument();
      expect(within(c).getByText('Disponivel')).toBeInTheDocument();
      expect(within(c).getByText('4 lugares')).toBeInTheDocument();
      expect(within(c).getByText('Tour Vulcao')).toBeInTheDocument();
      expect(within(c).getByRole('img', { name: 'Kia Sportage' })).toHaveAttribute('src', 'https://img.exemplo.cv/kia.png');
      expect(c.textContent).toContain('Manutencao: 2099-06-01');
      expect(c.textContent).not.toContain('atrasada');
    });

    it('manutencao atrasada fica assinalada com a data (sem a hora)', async () => {
      await renderPagina();
      const c = cartao('Prancha Kite 12m');
      expect(c.textContent).toContain('Manutencao atrasada: 2000-03-15 (atrasada)');
    });

    it('sem data de manutencao, matricula, lugares, tour ou foto nada disso aparece', async () => {
      await renderPagina();
      const c = cartao('Colete Salva-vidas');
      expect(c.textContent).not.toContain('Manutencao:');
      expect(c.textContent).not.toContain('lugares');
      expect(within(c).queryByRole('img')).not.toBeInTheDocument();
      expect(c.textContent).not.toContain('Tour');
      const q = cartao('Quad Velho');
      expect(q.textContent).toContain('2 lugares');
      expect(q.textContent).not.toMatch(/SL-/);
    });

    it('rotulo do estado de cada item', async () => {
      await renderPagina();
      expect(within(cartao('Prancha Kite 12m')).getByText('Em uso')).toBeInTheDocument();
      expect(within(cartao('Colete Salva-vidas')).getByText('Manutencao')).toBeInTheDocument();
      expect(within(cartao('Quad Velho')).getByText('Retirado')).toBeInTheDocument();
    });

    it('tipo e estado desconhecidos nao rebentam (estado sem rotulo)', async () => {
      await renderPagina();
      const c = cartao('Barco Misterio');
      expect(c.textContent).toContain('6 lugares');
      expect(within(c).getByRole('button', { name: 'Editar' })).toBeInTheDocument();
    });

    it('sem itens mostra o estado vazio e o subtitulo a zero', async () => {
      await renderPagina({ frota: [] });
      expect(screen.getByText('Sem itens de frota registados')).toBeInTheDocument();
      expect(screen.getByText('0 disponivel(is) de 0')).toBeInTheDocument();
    });

    it('enquanto carrega mostra o indicador, sem vazio nem cartoes; depois a lista', async () => {
      const espera = adiado();
      listFleet.mockReset().mockReturnValue(espera.promise);
      listUnits.mockReset().mockResolvedValue(UNIDADES);
      render(<Fleet />);
      expect(document.querySelector('.animate-spin')).not.toBeNull();
      expect(screen.queryByText('Sem itens de frota registados')).not.toBeInTheDocument();
      espera.resolve([KIA()]);
      expect(await screen.findByText('Kia Sportage')).toBeInTheDocument();
      expect(document.querySelector('.animate-spin')).toBeNull();
    });

    it('lista de tours nula nao rebenta (o formulario fica sem tours)', async () => {
      await renderPagina({ unidades: null });
      fireEvent.click(screen.getByRole('button', { name: 'Novo item' }));
      expect([...campo('Tour associado').options].map((o) => o.value)).toEqual(['']);
    });

    /* O servico a falhar nao tem tratamento na pagina (so ha finally): a promessa rejeitada nao e
       apanhada. O teste engole essa rejeicao para ver apenas o que a pagina mostra. */
    it('frota a falhar deixa a pagina a mostrar o vazio, sem registar erro no consolo', async () => {
      const ouvintes = process.listeners('unhandledRejection');
      process.removeAllListeners('unhandledRejection');
      process.on('unhandledRejection', () => {});
      try {
        carregaServicos();
        listFleet.mockReset().mockRejectedValue(new Error('rede'));
        render(<Fleet />);
        expect(await screen.findByText('Sem itens de frota registados')).toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 1, name: 'Frota e Equipamento' })).toBeInTheDocument();
        /* deixa passar o ciclo em que o Node assinala a rejeicao */
        await new Promise((r) => setTimeout(r, 20));
      } finally {
        process.removeAllListeners('unhandledRejection');
        ouvintes.forEach((l) => process.on('unhandledRejection', l));
      }
    });
  });

  describe('criar item', () => {
    async function abrirCriar(opcoes) {
      await renderPagina(opcoes);
      fireEvent.click(screen.getByRole('button', { name: 'Novo item' }));
      return dialogo();
    }

    it('abre o formulario com os valores por omissao e sem o campo Estado', async () => {
      const d = await abrirCriar();
      expect(within(d).getByRole('heading', { name: 'Novo item' })).toBeInTheDocument();
      expect(campo('Nome')).toHaveValue('');
      expect(campo('Nome')).toHaveAttribute('placeholder', 'Ex: Kia Sportage, Prancha Kite 12m');
      expect(campo('Matricula')).toHaveValue('');
      expect(campo('Matricula')).toHaveAttribute('placeholder', 'SL-00-AA');
      expect(campo('Tipo')).toHaveValue('vehicle');
      expect([...campo('Tipo').options].map((o) => [o.value, o.textContent])).toEqual([
        ['vehicle', 'Viatura'], ['equipment', 'Equipamento'], ['gear', 'Material'],
      ]);
      expect(within(d).queryByText('Estado', { selector: 'label' })).not.toBeInTheDocument();
      expect(campo('Capacidade (lugares)')).toHaveValue('2');
      expect([...campo('Capacidade (lugares)').options].map((o) => [o.value, o.textContent])).toEqual([
        ['2', '2 lugares'], ['4', '4 lugares'], ['6', '6 lugares'], ['8', '8 lugares'], ['10', '10 lugares'], ['12', '12 lugares'],
      ]);
      expect(campo('Tour associado')).toHaveValue('');
      expect([...campo('Tour associado').options].map((o) => [o.value, o.textContent])).toEqual([
        ['', 'Nenhum (generico)'], ['u1', 'Tour Vulcao'], ['u2', 'Tour Sal'],
      ]);
      expect(campo('Descricao').tagName).toBe('TEXTAREA');
      expect(campo('Ultima manutencao')).toHaveAttribute('type', 'date');
      expect(campo('Proxima manutencao')).toHaveAttribute('type', 'date');
      expect(within(d).getByText('Foto da viatura')).toBeInTheDocument();
      expect(d.querySelector('input[type="file"]')).toHaveAttribute('accept', 'image/*');
      expect(botaoDoDialogo('Cancelar')).toBeInTheDocument();
      expect(botaoDoDialogo('Criar item')).toHaveAttribute('type', 'submit');
    });

    it('cada campo traz a etiqueta logo por cima', async () => {
      await abrirCriar();
      temEtiquetaPorCima(['Nome', 'Matricula', 'Tipo', 'Capacidade (lugares)', 'Tour associado', 'Descricao', 'Ultima manutencao', 'Proxima manutencao']);
    });

    it('so o nome preenchido envia o objeto de hoje com todas as chaves', async () => {
      await abrirCriar();
      fireEvent.change(campo('Nome'), { target: { value: 'Novo Item' } });
      fireEvent.click(botaoDoDialogo('Criar item'));
      await waitFor(() => expect(createFleet).toHaveBeenCalledTimes(1));
      expect(createFleet.mock.calls[0]).toStrictEqual([{
        name: 'Novo Item', plate: '', type: 'vehicle', description: '', notes: '', status: 'available',
        last_maintenance_at: '', next_maintenance_at: '', capacity: 2, unit_id: null, photo: '', images: [],
      }]);
      expect(updateFleet).not.toHaveBeenCalled();
    });

    it('formulario completo envia todos os campos, com a capacidade como numero', async () => {
      await abrirCriar();
      fireEvent.change(campo('Nome'), { target: { value: 'Novo Item' } });
      fireEvent.change(campo('Matricula'), { target: { value: 'SL-99-ZZ' } });
      fireEvent.change(campo('Tipo'), { target: { value: 'equipment' } });
      fireEvent.change(campo('Capacidade (lugares)'), { target: { value: '8' } });
      fireEvent.change(campo('Tour associado'), { target: { value: 'u2' } });
      fireEvent.change(campo('Descricao'), { target: { value: 'Equipamento novo' } });
      fireEvent.change(campo('Ultima manutencao'), { target: { value: '2026-03-01' } });
      fireEvent.change(campo('Proxima manutencao'), { target: { value: '2026-09-01' } });
      fireEvent.click(botaoDoDialogo('Criar item'));
      await waitFor(() => expect(createFleet).toHaveBeenCalledTimes(1));
      expect(createFleet.mock.calls[0]).toStrictEqual([{
        name: 'Novo Item', plate: 'SL-99-ZZ', type: 'equipment', description: 'Equipamento novo', notes: '',
        status: 'available', last_maintenance_at: '2026-03-01', next_maintenance_at: '2026-09-01',
        capacity: 8, unit_id: 'u2', photo: '', images: [],
      }]);
      expect(typeof createFleet.mock.calls[0][0].capacity).toBe('number');
    });

    it('sem validacao nativa: nome vazio tambem se envia (como hoje)', async () => {
      await abrirCriar();
      fireEvent.click(botaoDoDialogo('Criar item'));
      await waitFor(() => expect(createFleet).toHaveBeenCalledTimes(1));
      expect(createFleet.mock.calls[0][0].name).toBe('');
    });

    it('foto: o ficheiro escolhido aparece na pre-visualizacao e segue em photo e images', async () => {
      const d = await abrirCriar();
      const entrada = d.querySelector('input[type="file"]');
      expect(within(d).queryByRole('img', { name: 'Viatura' })).not.toBeInTheDocument();
      /* sem ficheiro nada muda */
      fireEvent.change(entrada, { target: { files: [] } });
      expect(within(d).queryByRole('img', { name: 'Viatura' })).not.toBeInTheDocument();
      fireEvent.change(entrada, { target: { files: [new File(['x'], 'foto.png', { type: 'image/png' })] } });
      const img = await within(d).findByRole('img', { name: 'Viatura' });
      expect(img.getAttribute('src')).toBe('data:image/png;base64,eA==');
      fireEvent.change(campo('Nome'), { target: { value: 'Novo Item' } });
      fireEvent.click(botaoDoDialogo('Criar item'));
      await waitFor(() => expect(createFleet).toHaveBeenCalledTimes(1));
      const dados = createFleet.mock.calls[0][0];
      expect(dados.photo).toBe('data:image/png;base64,eA==');
      expect(dados.images).toEqual(['data:image/png;base64,eA==']);
    });

    it('sucesso: fecha o modal, o item novo fica no topo e o subtitulo actualiza', async () => {
      await abrirCriar();
      fireEvent.change(campo('Nome'), { target: { value: 'Novo Item' } });
      fireEvent.click(botaoDoDialogo('Criar item'));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(nomesNaGrelha()).toEqual(['Novo Item', 'Kia Sportage', 'Prancha Kite 12m', 'Colete Salva-vidas', 'Quad Velho', 'Barco Misterio']);
      expect(screen.getByText('2 disponivel(is) de 6')).toBeInTheDocument();
    });

    it('enquanto grava o botao fica bloqueado e depois fecha', async () => {
      await abrirCriar();
      const espera = adiado();
      createFleet.mockReset().mockReturnValue(espera.promise);
      fireEvent.change(campo('Nome'), { target: { value: 'Novo Item' } });
      fireEvent.click(botaoDoDialogo('Criar item'));
      await waitFor(() => expect(botaoDoDialogo('Criar item')).toBeDisabled());
      espera.resolve({ id: 'fNovo', name: 'Novo Item', status: 'available', type: 'vehicle' });
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('erro do servidor mostra a mensagem, mantem o modal e os dados', async () => {
      await abrirCriar();
      createFleet.mockReset().mockRejectedValue(erroApi('Matricula repetida'));
      fireEvent.change(campo('Nome'), { target: { value: 'Novo Item' } });
      fireEvent.click(botaoDoDialogo('Criar item'));
      expect(await screen.findByText('Matricula repetida')).toBeInTheDocument();
      expect(campo('Nome')).toHaveValue('Novo Item');
      expect(botaoDoDialogo('Criar item')).not.toBeDisabled();
    });

    it('erro sem mensagem usa "Erro ao guardar" e reabrir limpa o erro', async () => {
      await abrirCriar();
      createFleet.mockReset().mockRejectedValue(new Error('rede'));
      fireEvent.click(botaoDoDialogo('Criar item'));
      expect(await screen.findByText('Erro ao guardar')).toBeInTheDocument();
      fireEvent.click(botaoDoDialogo('Cancelar'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Novo item' }));
      expect(screen.queryByText('Erro ao guardar')).not.toBeInTheDocument();
    });

    it('Cancelar, o X e Escape fecham sem chamar servicos de escrita', async () => {
      await abrirCriar();
      fireEvent.click(botaoDoDialogo('Cancelar'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Novo item' }));
      fireEvent.click(botaoDoDialogo('Fechar'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Novo item' }));
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(createFleet).not.toHaveBeenCalled();
      expect(updateFleet).not.toHaveBeenCalled();
    });
  });

  describe('editar item', () => {
    it('abre com os dados do item, com Estado e datas sem a hora', async () => {
      await renderPagina();
      abrirEditar('Kia Sportage');
      const d = dialogo();
      expect(within(d).getByRole('heading', { name: 'Editar: Kia Sportage' })).toBeInTheDocument();
      expect(campo('Nome')).toHaveValue('Kia Sportage');
      expect(campo('Matricula')).toHaveValue('SL-12-AB');
      expect(campo('Tipo')).toHaveValue('vehicle');
      expect(campo('Estado')).toHaveValue('available');
      expect([...campo('Estado').options].map((o) => [o.value, o.textContent])).toEqual([
        ['available', 'Disponivel'], ['in_use', 'Em uso'], ['maintenance', 'Manutencao'], ['retired', 'Retirado'],
      ]);
      expect(campo('Capacidade (lugares)')).toHaveValue('4');
      expect(campo('Tour associado')).toHaveValue('u1');
      expect(campo('Descricao')).toHaveValue('Bom estado');
      expect(campo('Ultima manutencao')).toHaveValue('2025-01-10');
      expect(campo('Proxima manutencao')).toHaveValue('2099-06-01');
      expect(within(d).getByRole('img', { name: 'Viatura' })).toHaveAttribute('src', 'https://img.exemplo.cv/kia.png');
      expect(botaoDoDialogo('Guardar')).toHaveAttribute('type', 'submit');
    });

    it('cada campo traz a etiqueta logo por cima', async () => {
      await renderPagina();
      abrirEditar('Kia Sportage');
      temEtiquetaPorCima(['Nome', 'Matricula', 'Tipo', 'Estado', 'Capacidade (lugares)', 'Tour associado', 'Descricao', 'Ultima manutencao', 'Proxima manutencao']);
    });

    it('sem alterar nada, guarda o mesmo objeto (com notas, estado e imagens) e substitui o cartao na mesma posicao', async () => {
      await renderPagina();
      abrirEditar('Kia Sportage');
      fireEvent.click(botaoDoDialogo('Guardar'));
      await waitFor(() => expect(updateFleet).toHaveBeenCalledTimes(1));
      expect(updateFleet.mock.calls[0]).toStrictEqual(['f1', {
        name: 'Kia Sportage', plate: 'SL-12-AB', type: 'vehicle', description: 'Bom estado', notes: 'nota interna',
        status: 'available', last_maintenance_at: '2025-01-10', next_maintenance_at: '2099-06-01',
        capacity: 4, unit_id: 'u1', photo: 'https://img.exemplo.cv/kia.png', images: ['https://img.exemplo.cv/kia.png'],
      }]);
      expect(createFleet).not.toHaveBeenCalled();
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(nomesNaGrelha()).toEqual(['Kia Sportage', 'Prancha Kite 12m', 'Colete Salva-vidas', 'Quad Velho', 'Barco Misterio']);
    });

    it('alterar campos envia os novos valores e actualiza o cartao e o subtitulo', async () => {
      await renderPagina();
      abrirEditar('Kia Sportage');
      fireEvent.change(campo('Nome'), { target: { value: 'Kia Novo' } });
      fireEvent.change(campo('Matricula'), { target: { value: 'SL-00-ZZ' } });
      fireEvent.change(campo('Tipo'), { target: { value: 'gear' } });
      fireEvent.change(campo('Estado'), { target: { value: 'in_use' } });
      fireEvent.change(campo('Capacidade (lugares)'), { target: { value: '10' } });
      fireEvent.change(campo('Tour associado'), { target: { value: '' } });
      fireEvent.change(campo('Descricao'), { target: { value: 'Outra descricao' } });
      fireEvent.change(campo('Ultima manutencao'), { target: { value: '2026-01-02' } });
      fireEvent.change(campo('Proxima manutencao'), { target: { value: '2026-12-31' } });
      fireEvent.click(botaoDoDialogo('Guardar'));
      await waitFor(() => expect(updateFleet).toHaveBeenCalledTimes(1));
      expect(updateFleet.mock.calls[0]).toStrictEqual(['f1', {
        name: 'Kia Novo', plate: 'SL-00-ZZ', type: 'gear', description: 'Outra descricao', notes: 'nota interna',
        status: 'in_use', last_maintenance_at: '2026-01-02', next_maintenance_at: '2026-12-31',
        capacity: 10, unit_id: null, photo: 'https://img.exemplo.cv/kia.png', images: ['https://img.exemplo.cv/kia.png'],
      }]);
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(within(cartao('Kia Novo')).getByText('Em uso')).toBeInTheDocument();
      expect(screen.queryByText('Kia Sportage')).not.toBeInTheDocument();
      expect(screen.getByText('0 disponivel(is) de 5')).toBeInTheDocument();
    });

    it('item sem foto, datas, tour nem capacidade: valores por omissao e images vazio', async () => {
      await renderPagina();
      abrirEditar('Prancha Kite 12m');
      expect(campo('Matricula')).toHaveValue('');
      expect(campo('Capacidade (lugares)')).toHaveValue('2');
      expect(campo('Tour associado')).toHaveValue('');
      expect(campo('Ultima manutencao')).toHaveValue('');
      expect(campo('Proxima manutencao')).toHaveValue('2000-03-15');
      expect(within(dialogo()).queryByRole('img', { name: 'Viatura' })).not.toBeInTheDocument();
      fireEvent.click(botaoDoDialogo('Guardar'));
      await waitFor(() => expect(updateFleet).toHaveBeenCalledTimes(1));
      expect(updateFleet.mock.calls[0]).toStrictEqual(['f2', {
        name: 'Prancha Kite 12m', plate: '', type: 'equipment', description: '', notes: '', status: 'in_use',
        last_maintenance_at: '', next_maintenance_at: '2000-03-15', capacity: 2, unit_id: null, photo: '', images: [],
      }]);
    });

    it('com varias imagens guardadas, so a primeira segue em images (como hoje)', async () => {
      await renderPagina({ frota: [{ ...KIA(), images: ['a.png', 'b.png'] }] });
      abrirEditar('Kia Sportage');
      fireEvent.click(botaoDoDialogo('Guardar'));
      await waitFor(() => expect(updateFleet).toHaveBeenCalledTimes(1));
      expect(updateFleet.mock.calls[0][1].images).toEqual(['a.png']);
      expect(updateFleet.mock.calls[0][1].photo).toBe('a.png');
    });

    it('trocar a foto substitui a primeira imagem', async () => {
      await renderPagina();
      abrirEditar('Kia Sportage');
      const d = dialogo();
      fireEvent.change(d.querySelector('input[type="file"]'), { target: { files: [new File(['x'], 'nova.png', { type: 'image/png' })] } });
      await waitFor(() => expect(within(d).getByRole('img', { name: 'Viatura' }).getAttribute('src')).toBe('data:image/png;base64,eA=='));
      fireEvent.click(botaoDoDialogo('Guardar'));
      await waitFor(() => expect(updateFleet).toHaveBeenCalledTimes(1));
      expect(updateFleet.mock.calls[0][1].images).toEqual(['data:image/png;base64,eA==']);
    });

    it('erro do servidor mostra a mensagem e mantem o modal; sem mensagem usa "Erro ao guardar"', async () => {
      await renderPagina();
      abrirEditar('Kia Sportage');
      updateFleet.mockReset().mockRejectedValue(erroApi('Sem permissao'));
      fireEvent.click(botaoDoDialogo('Guardar'));
      expect(await screen.findByText('Sem permissao')).toBeInTheDocument();
      updateFleet.mockReset().mockRejectedValue(new Error('rede'));
      fireEvent.click(botaoDoDialogo('Guardar'));
      expect(await screen.findByText('Erro ao guardar')).toBeInTheDocument();
      expect(screen.queryByText('Sem permissao')).not.toBeInTheDocument();
      expect(dialogo()).toBeInTheDocument();
    });

    it('Cancelar fecha sem guardar', async () => {
      await renderPagina();
      abrirEditar('Kia Sportage');
      fireEvent.click(botaoDoDialogo('Cancelar'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(updateFleet).not.toHaveBeenCalled();
    });
  });

  describe('eliminar item', () => {
    it('pede confirmacao com o nome do item; Cancelar nao chama o servico', async () => {
      await renderPagina();
      abrirEliminar('Quad Velho');
      const d = dialogo();
      expect(within(d).getByRole('heading', { name: 'Confirmar' })).toBeInTheDocument();
      expect(d.textContent).toContain('Eliminar "Quad Velho"?');
      fireEvent.click(botaoDoDialogo('Cancelar'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(deleteFleet).not.toHaveBeenCalled();
      expect(screen.getByText('Quad Velho')).toBeInTheDocument();
    });

    it('Eliminar chama deleteFleet com o id, tira o item da lista e fecha', async () => {
      await renderPagina();
      abrirEliminar('Kia Sportage');
      fireEvent.click(botaoDoDialogo('Eliminar'));
      await waitFor(() => expect(screen.queryByText('Kia Sportage')).not.toBeInTheDocument());
      expect(deleteFleet).toHaveBeenCalledTimes(1);
      expect(deleteFleet).toHaveBeenCalledWith('f1');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByText('0 disponivel(is) de 4')).toBeInTheDocument();
    });

    it('eliminar o ultimo item mostra o vazio', async () => {
      await renderPagina({ frota: [QUAD()] });
      abrirEliminar('Quad Velho');
      fireEvent.click(botaoDoDialogo('Eliminar'));
      expect(await screen.findByText('Sem itens de frota registados')).toBeInTheDocument();
    });

    it('o X e Escape fecham a confirmacao sem eliminar', async () => {
      await renderPagina();
      abrirEliminar('Quad Velho');
      fireEvent.click(botaoDoDialogo('Fechar'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      abrirEliminar('Quad Velho');
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(deleteFleet).not.toHaveBeenCalled();
    });
  });
});

describe('FleetSelector', () => {
  let errSpy;
  let warnSpy;

  const BUGGYS = () => [
    { id: 'v1', name: 'Buggy 1', capacity: 4, available: true },
    { id: 'v2', name: 'Buggy 2', capacity: 2, available: false },
    { id: 'v3', name: 'Buggy 3', capacity: 6, available: true },
  ];

  beforeEach(() => {
    getFleetAvailability.mockReset().mockImplementation(async (unitId, data) => {
      if (typeof unitId !== 'string' || typeof data !== 'string') throw new Error('getFleetAvailability: argumentos inesperados');
      return BUGGYS();
    });
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

  function props(over) {
    return { unitId: 't1', date: '2099-01-15', value: null, onChange: vi.fn(), onLoad: vi.fn(), ...over };
  }

  async function renderSeletor(over) {
    const p = props(over);
    const r = render(<FleetSelector {...p} />);
    await waitFor(() => expect(p.onLoad).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText('A verificar disponibilidade de buggys...')).not.toBeInTheDocument());
    return { ...r, p };
  }

  it('sem tour ou sem data nao pede nada, nao mostra nada e avisa com lista vazia', async () => {
    const a = props({ unitId: undefined });
    const { container, rerender } = render(<FleetSelector {...a} />);
    expect(container).toBeEmptyDOMElement();
    expect(a.onLoad).toHaveBeenCalledTimes(1);
    expect(a.onLoad).toHaveBeenCalledWith([]);
    rerender(<FleetSelector {...props({ unitId: 't1', date: '' })} />);
    expect(container).toBeEmptyDOMElement();
    expect(getFleetAvailability).not.toHaveBeenCalled();
  });

  it('funciona sem onLoad', async () => {
    const { container } = render(<FleetSelector unitId="" date="" onChange={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('pede a disponibilidade do tour nessa data, mostra o aviso enquanto espera e depois a lista', async () => {
    const espera = adiado();
    getFleetAvailability.mockReset().mockReturnValue(espera.promise);
    const p = props();
    render(<FleetSelector {...p} />);
    expect(screen.getByText('A verificar disponibilidade de buggys...')).toBeInTheDocument();
    expect(getFleetAvailability).toHaveBeenCalledTimes(1);
    expect(getFleetAvailability).toHaveBeenCalledWith('t1', '2099-01-15');
    espera.resolve(BUGGYS());
    expect(await screen.findByText('Escolha o buggy')).toBeInTheDocument();
    expect(screen.queryByText('A verificar disponibilidade de buggys...')).not.toBeInTheDocument();
  });

  it('mostra cada buggy com nome, lugares e Livre/Ocupado, e avisa onLoad com os dados', async () => {
    const { p } = await renderSeletor();
    expect(screen.getByText('Escolha o buggy')).toBeInTheDocument();
    const b1 = screen.getByRole('button', { name: /Buggy 1/ });
    expect(within(b1).getByText('4 lugares')).toBeInTheDocument();
    expect(within(b1).getByText('Livre')).toBeInTheDocument();
    const b2 = screen.getByRole('button', { name: /Buggy 2/ });
    expect(within(b2).getByText('2 lugares')).toBeInTheDocument();
    expect(within(b2).getByText('Ocupado')).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(3);
    expect(p.onLoad).toHaveBeenCalledTimes(1);
    expect(p.onLoad).toHaveBeenCalledWith(BUGGYS());
  });

  it('os botoes sao do tipo button (nao submetem formularios) e o ocupado esta desactivado', async () => {
    await renderSeletor();
    for (const b of screen.getAllByRole('button')) expect(b).toHaveAttribute('type', 'button');
    expect(screen.getByRole('button', { name: /Buggy 1/ })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /Buggy 2/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Buggy 3/ })).not.toBeDisabled();
  });

  it('escolher um buggy livre chama onChange com o id', async () => {
    const { p } = await renderSeletor();
    fireEvent.click(screen.getByRole('button', { name: /Buggy 3/ }));
    expect(p.onChange).toHaveBeenCalledTimes(1);
    expect(p.onChange).toHaveBeenCalledWith('v3');
  });

  it('o buggy ocupado nao chama onChange', async () => {
    const { p } = await renderSeletor();
    fireEvent.click(screen.getByRole('button', { name: /Buggy 2/ }));
    expect(p.onChange).not.toHaveBeenCalled();
  });

  it('escolher o ja escolhido volta a chamar onChange (o pai decide)', async () => {
    const { p } = await renderSeletor({ value: 'v1' });
    fireEvent.click(screen.getByRole('button', { name: /Buggy 1/ }));
    expect(p.onChange).toHaveBeenCalledWith('v1');
  });

  it('sem buggys nao mostra nada e avisa com lista vazia', async () => {
    getFleetAvailability.mockReset().mockResolvedValue([]);
    const p = props();
    const { container } = render(<FleetSelector {...p} />);
    await waitFor(() => expect(p.onLoad).toHaveBeenCalledWith([]));
    expect(container).toBeEmptyDOMElement();
  });

  it('resposta nula trata-se como lista vazia', async () => {
    getFleetAvailability.mockReset().mockResolvedValue(null);
    const p = props();
    const { container } = render(<FleetSelector {...p} />);
    await waitFor(() => expect(p.onLoad).toHaveBeenCalledWith([]));
    expect(container).toBeEmptyDOMElement();
  });

  it('servico a falhar e silencioso: nao mostra nada e avisa com lista vazia', async () => {
    getFleetAvailability.mockReset().mockRejectedValue(new Error('rede'));
    const p = props();
    const { container } = render(<FleetSelector {...p} />);
    await waitFor(() => expect(p.onLoad).toHaveBeenCalledWith([]));
    await waitFor(() => expect(screen.queryByText('A verificar disponibilidade de buggys...')).not.toBeInTheDocument());
    expect(container).toBeEmptyDOMElement();
  });

  it('muda de tour ou de data: volta a pedir; sem data limpa a lista', async () => {
    const { rerender, p } = await renderSeletor();
    expect(screen.getByRole('button', { name: /Buggy 1/ })).toBeInTheDocument();
    rerender(<FleetSelector {...p} date="2099-02-20" />);
    await waitFor(() => expect(getFleetAvailability).toHaveBeenCalledTimes(2));
    expect(getFleetAvailability).toHaveBeenLastCalledWith('t1', '2099-02-20');
    await waitFor(() => expect(p.onLoad).toHaveBeenCalledTimes(2));
    rerender(<FleetSelector {...p} date="2099-02-20" unitId="t2" />);
    await waitFor(() => expect(getFleetAvailability).toHaveBeenCalledTimes(3));
    expect(getFleetAvailability).toHaveBeenLastCalledWith('t2', '2099-02-20');
    await waitFor(() => expect(p.onLoad).toHaveBeenCalledTimes(3));
    rerender(<FleetSelector {...p} date="" unitId="t2" />);
    await waitFor(() => expect(screen.queryByRole('button', { name: /Buggy 1/ })).not.toBeInTheDocument());
    expect(getFleetAvailability).toHaveBeenCalledTimes(3);
    expect(p.onLoad).toHaveBeenLastCalledWith([]);
  });

  it('mudar so value ou onChange nao volta a pedir a disponibilidade', async () => {
    const { rerender, p } = await renderSeletor();
    rerender(<FleetSelector {...p} value="v1" onChange={vi.fn()} />);
    expect(getFleetAvailability).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /Buggy 1/ })).toBeInTheDocument();
  });

  it('a classe recebida vai para o bloco da lista e para o aviso de espera', async () => {
    const espera = adiado();
    getFleetAvailability.mockReset().mockReturnValue(espera.promise);
    const p = props({ className: 'mt-3' });
    const { container } = render(<FleetSelector {...p} />);
    expect(container.firstChild.className).toContain('mt-3');
    espera.resolve(BUGGYS());
    await screen.findByText('Escolha o buggy');
    expect(container.firstChild.className).toContain('mt-3');
  });
});

/* Novos com o desenho do sistema (nao fazem parte da rede de seguranca anterior a migracao) */
describe('Frota (desenho do sistema)', () => {
  let errSpy;
  let warnSpy;

  beforeEach(() => {
    useUiStore.setState({ lang: 'pt' });
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

  it('o seletor marca com aria-pressed o buggy escolhido', async () => {
    getFleetAvailability.mockReset().mockResolvedValue([
      { id: 'v1', name: 'Buggy 1', capacity: 4, available: true },
      { id: 'v2', name: 'Buggy 2', capacity: 2, available: false },
    ]);
    const onLoad = vi.fn();
    render(<FleetSelector unitId="t1" date="2099-01-15" value="v1" onChange={() => {}} onLoad={onLoad} />);
    await waitFor(() => expect(onLoad).toHaveBeenCalled());
    expect(await screen.findByRole('button', { name: /Buggy 1/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Buggy 2/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('a etiqueta da foto aponta para o campo de ficheiro', async () => {
    render(<Fleet />);
    await waitFor(() => expect(document.querySelector('.animate-spin')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Novo item' }));
    const etiqueta = within(dialogo()).getByText('Foto da viatura');
    expect(etiqueta.control).toBe(dialogo().querySelector('input[type="file"]'));
  });

  it('o estado de cada item tem um aspecto proprio (verde, azul, ambar, neutro)', async () => {
    render(<Fleet />);
    await waitFor(() => expect(document.querySelector('.animate-spin')).toBeNull());
    const classe = (nome, rotulo) => within(cartao(nome)).getByText(rotulo).className;
    expect(classe('Kia Sportage', 'Disponivel')).toContain('--success');
    expect(classe('Prancha Kite 12m', 'Em uso')).toContain('ocean');
    expect(classe('Colete Salva-vidas', 'Manutencao')).toContain('--warning');
    expect(classe('Quad Velho', 'Retirado')).toContain('n-100');
  });
});
