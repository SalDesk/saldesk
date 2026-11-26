/* Reservas de rent-a-car e de restaurante: no telemovel a tabela passa a cartoes (as mesmas colunas e accoes). */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import RentacarTable from '../pages/reservations/RentacarTable';
import RestaurantTable from '../pages/reservations/RestaurantTable';
import { changeStatus } from '../services/reservationsService';
import useUiStore from '../store/uiStore';

vi.mock('../services/reservationsService', () => ({ changeStatus: vi.fn() }));

/* matchMedia simulado: o teste liga/desliga o "telemovel" e dispara o evento change */
let movel;
let ouvintes;
function simularEcra(ehMovel) {
  movel = ehMovel;
  ouvintes = [];
  window.matchMedia = vi.fn((query) => ({
    get matches() { return query.includes('max-width') ? movel : !movel; },
    media: query,
    addEventListener: (_, fn) => ouvintes.push(fn),
    removeEventListener: (_, fn) => { ouvintes = ouvintes.filter((f) => f !== fn); },
  }));
}
function mudarParaMovel(valor) {
  movel = valor;
  act(() => { ouvintes.forEach((fn) => fn({ matches: valor })); });
}

const UNIDADES_CARRO = [{ id: 'u1', name: 'Jimny', description: JSON.stringify({ brand: 'Suzuki', model: 'Jimny', plate: 'ST-12-AB' }) }];
const UNIDADES_MESA = [{ id: 'm1', name: 'Mesa interior', description: JSON.stringify({ number: 3 }) }];

const CARROS = [
  { id: 'aaaaaaaa-1', unit_id: 'u1', status: 'confirmed', customer_name: 'Maria Teste', check_in: '2026-11-20', check_out: '2026-11-25', total_price: 250 },
  { id: 'bbbbbbbb-2', unit_id: 'u1', status: 'checked_in', customer_name: 'Rui Teste', check_in: '2026-11-18', check_out: '2026-11-22', total_price: 180 },
];
const MESAS = [
  { id: 'cccccccc-3', unit_id: 'm1', status: 'confirmed', customer_name: 'Ana Mesa', check_in: '2026-11-21', start_time: '20:30:00', guests: 4 },
];

function carros(extra = {}) {
  const props = { reservations: CARROS, units: UNIDADES_CARRO, onEdit: vi.fn(), onDelete: vi.fn(), onLevantamento: vi.fn(), onDevolucao: vi.fn(), onUpdate: vi.fn(), onView: vi.fn(), ...extra };
  render(<RentacarTable {...props} />);
  return props;
}
function mesas(extra = {}) {
  const props = { reservations: MESAS, units: UNIDADES_MESA, onEdit: vi.fn(), onDelete: vi.fn(), onDetails: vi.fn(), onUpdate: vi.fn(), onView: vi.fn(), ...extra };
  render(<RestaurantTable {...props} />);
  return props;
}

beforeEach(() => {
  useUiStore.setState({ lang: 'pt' });
  changeStatus.mockReset().mockResolvedValue({ id: 'cccccccc-3', status: 'checked_in' });
});
afterEach(() => {
  cleanup();
  delete window.matchMedia;
});

describe('rent-a-car: tabela no ecrã grande, cartões no telemóvel', () => {
  it('no ecrã grande continua a ser uma tabela', () => {
    simularEcra(false);
    carros();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('no telemóvel mostra um cartão por reserva, sem tabela', () => {
    simularEcra(true);
    carros();
    expect(screen.queryByRole('table')).toBeNull();
    const cartoes = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(cartoes).toHaveLength(2);
    const primeiro = within(cartoes[0]);
    expect(primeiro.getByText('Suzuki Jimny')).toBeInTheDocument();
    expect(primeiro.getByText('ST-12-AB')).toBeInTheDocument();
    expect(primeiro.getByText('Maria Teste')).toBeInTheDocument();
    expect(primeiro.getByText('€250')).toBeInTheDocument();
    expect(primeiro.getByText('Levantamento', { selector: 'span' })).toBeInTheDocument(); // etiqueta da coluna
  });

  it('as acções de cada cartão funcionam: Levantamento, Devolução, Ver, Editar e Eliminar', () => {
    simularEcra(true);
    const p = carros();
    const [c1, c2] = within(screen.getByRole('list')).getAllByRole('listitem');
    fireEvent.click(within(c1).getByRole('button', { name: /Levantamento/ }));
    expect(p.onLevantamento).toHaveBeenCalledWith(CARROS[0]);
    fireEvent.click(within(c2).getByRole('button', { name: /Devolução/ }));
    expect(p.onDevolucao).toHaveBeenCalledWith(CARROS[1]);
    fireEvent.click(within(c1).getByRole('button', { name: 'Editar' }));
    expect(p.onEdit).toHaveBeenCalledWith(CARROS[0]);
    fireEvent.click(within(c1).getByRole('button', { name: 'Eliminar' }));
    expect(p.onDelete).toHaveBeenCalledWith(CARROS[0]);
    fireEvent.click(within(c2).getByRole('button', { name: 'Ver' }));
    expect(p.onView).toHaveBeenCalledWith(CARROS[1]);
  });

  it('muda de tabela para cartões quando o ecrã passa a ser de telemóvel', () => {
    simularEcra(false);
    carros();
    expect(screen.getByRole('table')).toBeInTheDocument();
    mudarParaMovel(true);
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByRole('list')).toBeInTheDocument();
    mudarParaMovel(false);
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('sem reservas mostra o vazio nos dois formatos', () => {
    simularEcra(true);
    carros({ reservations: [] });
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.getByText('Sem resultados')).toBeInTheDocument();
  });
});

describe('restaurante: tabela no ecrã grande, cartões no telemóvel', () => {
  it('no telemóvel mostra a mesa, a hora, os pax e as acções do cartão', async () => {
    simularEcra(true);
    const p = mesas();
    expect(screen.queryByRole('table')).toBeNull();
    const cartao = within(within(screen.getByRole('list')).getByRole('listitem'));
    expect(cartao.getByText('Mesa 3')).toBeInTheDocument();
    expect(cartao.getByText('20:30')).toBeInTheDocument();
    expect(cartao.getByText('Ana Mesa')).toBeInTheDocument();
    expect(cartao.getByText('4')).toBeInTheDocument();
    fireEvent.click(cartao.getByRole('button', { name: /Sentar/ }));
    await vi.waitFor(() => expect(changeStatus).toHaveBeenCalledWith('cccccccc-3', 'checked_in'));
    await vi.waitFor(() => expect(p.onUpdate).toHaveBeenCalled());
    fireEvent.click(cartao.getByRole('button', { name: 'Eliminar' }));
    expect(p.onDelete).toHaveBeenCalledWith(MESAS[0]);
    fireEvent.click(cartao.getByRole('button', { name: 'Editar' }));
    expect(p.onEdit).toHaveBeenCalledWith(MESAS[0]);
  });

  it('no ecrã grande continua a ser uma tabela', () => {
    simularEcra(false);
    mesas();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.queryByRole('list')).toBeNull();
  });
});

describe('cartoes do telemovel: estilo Mare', () => {
  it('rent-a-car e restaurante usam as classes de cartao Mare', () => {
    simularEcra(true);
    carros();
    let item = screen.getAllByRole('listitem')[0];
    expect(item).toHaveClass('bg-white', 'border', 'border-mare-card', 'rounded-[18px]');
    expect(item.className).not.toMatch(/border-n-200|shadow-sm/);
    cleanup();
    simularEcra(true);
    mesas();
    item = screen.getAllByRole('listitem')[0];
    expect(item).toHaveClass('bg-white', 'border', 'border-mare-card', 'rounded-[18px]');
  });
});

describe('cartoes do telemovel: alvos de toque', () => {
  it('os botoes de accao do cartao tem 44 px de altura minima', () => {
    simularEcra(true);
    carros();
    const botao = screen.getByRole('button', { name: 'Levantamento' });
    expect(botao).toHaveClass('min-h-11');
  });
});