import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Pedidos from '../pages/Pedidos';
import { listOrders, changeOrderStatus } from '../services/ordersService';
import { listUnits } from '../services/unitsService';

/* Sem rede: so os servicos da pagina sao simulados */
vi.mock('../services/ordersService', () => ({
  listOrders: vi.fn(),
  changeOrderStatus: vi.fn(),
}));
vi.mock('../services/unitsService', () => ({
  listUnits: vi.fn(),
}));

const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };
const CRIADO = '2026-03-10T12:34:00';

function hora(iso) {
  return new Date(iso).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}

function pedido(over) {
  return {
    id: 'aaaaaaaa-0001',
    status: 'received',
    total_price: 37.5,
    notes: 'Alergia a marisco',
    created_at: CRIADO,
    units: { name: 'Mesa A', description: '{"number":4}' },
    order_items: [
      { id: 'i1', quantity: 2, unit_name: 'Bacalhau', unit_price: 15, notes: 'sem sal' },
      { id: 'i2', quantity: 1, unit_name: 'Agua', unit_price: 7.5 },
    ],
    ...over,
  };
}

const CINCO = [
  pedido({ id: 'aaaaaaaa-0001', status: 'received' }),
  pedido({ id: 'bbbbbbbb-0002', status: 'preparing', units: { name: 'Mesa B', description: '{"number":7}' }, order_items: [{ id: 'i3', quantity: 3, unit_name: 'Sumo', unit_price: 3 }], total_price: 9 }),
  pedido({ id: 'cccccccc-0003', status: 'ready', units: { name: 'Esplanada', description: '{}' }, order_items: [], total_price: 0 }),
  pedido({ id: 'dddddddd-0004', status: 'delivered', units: null }),
  pedido({ id: 'eeeeeeee-0005', status: 'cancelled' }),
];

const MESAS = [
  { id: 'u1', name: 'Mesa 4', unit_type: 'table' },
  { id: 'u2', name: 'Bacalhau', unit_type: 'menu_item' },
  { id: 'u3', name: 'Degustacao', unit_type: 'tasting_menu' },
];

describe('Pedidos', () => {
  let errSpy;
  let warnSpy;
  let esperaErros;

  beforeEach(() => {
    esperaErros = false;
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    listOrders.mockReset().mockResolvedValue(CINCO);
    changeOrderStatus.mockReset().mockImplementation(async (id, status) => ({ ...CINCO.find(o => o.id === id), status }));
    listUnits.mockReset().mockResolvedValue(MESAS);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    if (!esperaErros) expect(errSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
    warnSpy.mockRestore();
  });

  async function abre() {
    render(
      <MemoryRouter future={FUTURE}>
        <Pedidos />
      </MemoryRouter>
    );
    await screen.findByText('5 pedido(s)');
  }

  function linhas() {
    return within(screen.getByRole('table')).getAllByRole('row').slice(1);
  }
  function celulas(linha) {
    return within(linha).getAllByRole('cell').map(c => c.textContent);
  }
  /* o chip de filtro e sempre o primeiro botao com esse nome (vem antes da tabela) */
  function chip(nome) {
    return screen.getAllByRole('button', { name: nome })[0];
  }

  it('lista os pedidos com mesa, itens, total, estado e hora', async () => {
    await abre();
    const [l1, l2, l3, l4] = linhas();
    expect(celulas(l1).slice(0, 6)).toEqual(['aaaaaaaa', 'Mesa 4', '2x Bacalhau, 1x Agua', '€37.50', 'Recebido', hora(CRIADO)]);
    /* mesa sem numero mostra o nome da unidade; sem unidade mostra o travessao */
    expect(celulas(l3)[1]).toBe('Esplanada');
    expect(celulas(l4)[1]).toBe('—');
    expect(celulas(l2)[1]).toBe('Mesa 7');
  });

  it('o subtitulo conta os pedidos', async () => {
    await abre();
    expect(screen.getByText('5 pedido(s)')).toBeInTheDocument();
  });

  it('o chip de estado pede a lista com status e "Todos" pede sem filtro', async () => {
    await abre();
    expect(listOrders).toHaveBeenLastCalledWith({});
    fireEvent.click(chip('Pronto'));
    await waitFor(() => expect(listOrders).toHaveBeenLastCalledWith({ status: 'ready' }));
    fireEvent.click(chip('Todos'));
    await waitFor(() => expect(listOrders).toHaveBeenLastCalledWith({}));
  });

  it('o filtro de estado e um grupo de botoes com aria-pressed', async () => {
    await abre();
    expect(chip('Todos')).toHaveAttribute('aria-pressed', 'true');
    expect(chip('Recebido')).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(chip('Recebido'));
    await waitFor(() => expect(chip('Recebido')).toHaveAttribute('aria-pressed', 'true'));
    expect(chip('Todos')).toHaveAttribute('aria-pressed', 'false');
  });

  it('o filtro de mesa envia unit_id e a lista de mesas exclui pratos e menus', async () => {
    await abre();
    const sel = screen.getByDisplayValue('Todas as mesas');
    expect([...sel.options].map(o => o.textContent)).toEqual(['Todas as mesas', 'Mesa 4']);
    fireEvent.change(sel, { target: { value: 'u1' } });
    await waitFor(() => expect(listOrders).toHaveBeenLastCalledWith({ unit_id: 'u1' }));
  });

  it.each([
    ['received', 'Preparar', 'preparing'],
    ['preparing', 'Pronto', 'ready'],
    ['ready', 'Entregar', 'delivered'],
  ])('avancar de %s: o botao %s chama changeOrderStatus com %s e substitui a linha', async (estado, rotulo, proximo) => {
    await abre();
    const antes = linhas().length;
    const linha = linhas().find(l => celulas(l)[4] === { received: 'Recebido', preparing: 'Em preparação', ready: 'Pronto' }[estado]);
    const botao = within(linha).getByRole('button', { name: rotulo });
    fireEvent.click(botao);
    const id = CINCO.find(o => o.status === estado).id;
    await waitFor(() => expect(changeOrderStatus).toHaveBeenCalledWith(id, proximo));
    await waitFor(() => expect(linhas().some(l => celulas(l)[0] === id.slice(0, 8) && celulas(l)[4] === { preparing: 'Em preparação', ready: 'Pronto', delivered: 'Entregue' }[proximo])).toBe(true));
    expect(linhas()).toHaveLength(antes);
  });

  it('cancelar envia cancelled, so nos estados recebido, em preparacao e pronto', async () => {
    await abre();
    const todas = linhas();
    const comCancelar = todas.filter(l => within(l).queryByRole('button', { name: 'Cancelar' }));
    expect(comCancelar.map(l => celulas(l)[4])).toEqual(['Recebido', 'Em preparação', 'Pronto']);
    fireEvent.click(within(comCancelar[0]).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(changeOrderStatus).toHaveBeenCalledWith('aaaaaaaa-0001', 'cancelled'));
    await waitFor(() => expect(celulas(linhas()[0])[4]).toBe('Cancelado'));
  });

  it('entregue e cancelado nao tem avancar nem cancelar', async () => {
    await abre();
    for (const l of linhas().filter(l => ['Entregue', 'Cancelado'].includes(celulas(l)[4]))) {
      expect(within(l).queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument();
      for (const nome of ['Preparar', 'Pronto', 'Entregar']) {
        expect(within(l).queryByRole('button', { name: nome })).not.toBeInTheDocument();
      }
    }
  });

  it('ver detalhes abre o modal com itens, notas e total', async () => {
    await abre();
    fireEvent.click(within(linhas()[0]).getByRole('button', { name: 'Ver detalhes' }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('Pedido — Mesa 4')).toBeInTheDocument();
    expect(within(dialogo).getByText('2x Bacalhau')).toBeInTheDocument();
    expect(within(dialogo).getByText('sem sal')).toBeInTheDocument();
    expect(within(dialogo).getByText('€30.00')).toBeInTheDocument();
    expect(within(dialogo).getByText('Notas do pedido')).toBeInTheDocument();
    expect(within(dialogo).getByText('Alergia a marisco')).toBeInTheDocument();
    expect(within(dialogo).getByText('Total')).toBeInTheDocument();
    expect(within(dialogo).getByText('€37.50')).toBeInTheDocument();
  });

  it('recarrega a cada 15 s com o mesmo filtro', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    render(
      <MemoryRouter future={FUTURE}>
        <Pedidos />
      </MemoryRouter>
    );
    await act(async () => {});
    expect(listOrders).toHaveBeenCalledTimes(1);
    fireEvent.click(chip('Entregue'));
    await act(async () => {});
    expect(listOrders).toHaveBeenLastCalledWith({ status: 'delivered' });
    const antes = listOrders.mock.calls.length;
    await act(async () => { vi.advanceTimersByTime(15000); });
    expect(listOrders.mock.calls.length).toBe(antes + 1);
    expect(listOrders).toHaveBeenLastCalledWith({ status: 'delivered' });
  });

  it('sem pedidos mostra o vazio', async () => {
    listOrders.mockResolvedValue([]);
    render(
      <MemoryRouter future={FUTURE}>
        <Pedidos />
      </MemoryRouter>
    );
    expect(await screen.findByText('Sem pedidos.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('servicos a falhar nao rebentam', async () => {
    esperaErros = true;
    listOrders.mockRejectedValue(new Error('rede'));
    listUnits.mockRejectedValue(new Error('rede'));
    render(
      <MemoryRouter future={FUTURE}>
        <Pedidos />
      </MemoryRouter>
    );
    expect(await screen.findByText('Sem pedidos.')).toBeInTheDocument();
    expect(errSpy).toHaveBeenCalled();
  });
});
