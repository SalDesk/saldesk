/* As reservas do painel seguem a lingua do painel: rotulos traduzidos, valores gravados (estados, origens,
   combustivel, turno, ocasiao, caucao) iguais aos de sempre, e numeros e datas pelo locale da lingua. Em pt
   tudo le exactamente como antes. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Reservations from '../pages/Reservations';
import ManifestoModal from '../pages/reservations/ManifestoModal';
import LevantamentoModal from '../pages/reservations/LevantamentoModal';
import DevolucaoModal from '../pages/reservations/DevolucaoModal';
import RestaurantCreateModal from '../pages/reservations/RestaurantCreateModal';
import RentacarTable from '../pages/reservations/RentacarTable';
import RestaurantTable from '../pages/reservations/RestaurantTable';
import {
  FUEL_LEVELS, rotuloNivelCombustivel, rotuloOrigem, rotuloMetodoReserva, eurosDecimais, eurosInteiros,
} from '../pages/reservations/shared';
import ReservationForm from '../components/reservations/ReservationForm';
import ReservationDetailModal from '../components/reservations/ReservationDetailModal';
import ReservationCard from '../components/reservations/ReservationCard';
import StatusBadge from '../components/reservations/StatusBadge';
import AssignCompositeModal from '../components/assignments/AssignCompositeModal';
import useAuthStore from '../store/authStore';
import useUiStore from '../store/uiStore';
import { getT } from '../i18n';
import {
  listReservations, changeStatus, getReservation, updateReservation,
} from '../services/reservationsService';
import { listUnits } from '../services/unitsService';
import { listStaff } from '../services/staffService';
import { createCompositeAssignment } from '../services/assignmentService';
import { listFleet, getFleetAvailability } from '../services/fleetService';
import { portuguesNoEcra, chavesCruas } from './helpers/portuguesNoEcra';

vi.mock('../services/reservationsService', () => ({
  listReservations: vi.fn(),
  createReservation: vi.fn(),
  updateReservation: vi.fn(),
  changeStatus: vi.fn(),
  deleteReservation: vi.fn(),
  getReservation: vi.fn(),
}));
vi.mock('../services/unitsService', () => ({ listUnits: vi.fn() }));
vi.mock('../services/staffService', () => ({ listStaff: vi.fn() }));
vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../services/fleetService', () => ({
  listFleet: vi.fn().mockResolvedValue([]),
  getFleetAvailability: vi.fn().mockResolvedValue([]),
}));
vi.mock('../services/assignmentService', () => ({ createCompositeAssignment: vi.fn() }));
vi.mock('../services/messagingService', () => ({
  sendReservationMessage: vi.fn(),
  markMessageOpened: vi.fn(),
}));

const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };
const PREFIXOS = ['reservations', 'common', 'customers', 'auth', 'nav', 'errors', 'opcoesActividade', 'staff'];

/* Datas locais relativas a hoje, nunca fixas nem em UTC */
function dataLocal(dias = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toLocaleDateString('en-CA');
}
const HOJE = dataLocal(0);
const AMANHA = dataLocal(1);
const DEPOIS = dataLocal(2);

/* dados dos testes que podem parecer portugueses (nomes, unidades, notas) */
const DADOS = ['Tour Pedra de Lume', 'Cliente Alfa', 'Cliente Beta', 'Joao Guia', 'Mesa interior', 'Suzuki Jimny', 'Quarto 1', 'Buggy 1'];

function semPortugues(extra = []) {
  expect(portuguesNoEcra([...DADOS, ...extra])).toEqual([]);
  expect(chavesCruas(PREFIXOS)).toEqual([]);
}

function campo(texto) {
  return screen.getByText(texto).parentElement.querySelector('input, select, textarea');
}
const botao = (nome) => screen.getByRole('button', { name: nome });

function unidade(over) {
  return { id: 'u1', name: 'Tour Pedra de Lume', unit_type: 'tour', status: 'active', ...over };
}
function reserva(over) {
  return {
    id: 'aaaaaaaa-0001', unit_id: 'u1', status: 'pending', guests: 2, source: 'direct',
    check_in: HOJE, check_out: AMANHA, customer_name: 'Cliente Alfa', total_price: 100,
    notes_guest: '{}', units: { name: 'Tour Pedra de Lume' },
    ...over,
  };
}

let spyErr;
let spyWarn;
beforeEach(() => {
  useUiStore.setState({ lang: 'en' });
  spyErr = vi.spyOn(console, 'error').mockImplementation(() => {});
  spyWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  updateReservation.mockReset().mockResolvedValue({});
  changeStatus.mockReset().mockImplementation(async (id, status) => ({ ...reserva({ id }), status }));
  /* a disponibilidade de buggys nunca responde: nenhuma actualizacao fora do teste */
  getFleetAvailability.mockReset().mockImplementation(() => new Promise(() => {}));
  listFleet.mockReset().mockResolvedValue([]);
});
afterEach(() => {
  cleanup();
  expect(spyErr).not.toHaveBeenCalled();
  expect(spyWarn).not.toHaveBeenCalled();
  spyErr.mockRestore();
  spyWarn.mockRestore();
  useUiStore.setState({ lang: 'pt' });
  useAuthStore.setState({ operator: null });
});

/* ------------------------------------------------------------------ */
describe('Reservations page em ingles', () => {
  function servicos({ reservas, units = [unidade()], staff = [] }) {
    listReservations.mockReset().mockResolvedValue(reservas);
    listUnits.mockReset().mockResolvedValue(units);
    listStaff.mockReset().mockResolvedValue(staff);
    getReservation.mockReset().mockResolvedValue(reserva({ customer_email: 'alfa@exemplo.cv' }));
  }
  function renderPagina(tipo) {
    useAuthStore.setState({ operator: { operator_type: tipo } });
    return render(<MemoryRouter future={FUTURE}><Reservations /></MemoryRouter>);
  }

  it('actividade: titulo, filtros, colunas e botoes em ingles; estados e origens gravados nao mudam', async () => {
    servicos({
      reservas: [reserva(), reserva({ id: 'bbbbbbbb-0002', status: 'confirmed', source: 'booking_com', customer_name: 'Cliente Beta' })],
      staff: [{ id: 'g1', name: 'Joao Guia', role: 'Guia' }],
    });
    renderPagina('activity');
    await screen.findAllByText('Cliente Alfa');
    expect(screen.getByRole('heading', { name: 'Bookings' })).toBeInTheDocument();
    expect(screen.getByText('2 result(s)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Manifest' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New Booking' })).toBeInTheDocument();
    const cabecalhos = within(screen.getByRole('table')).getAllByRole('columnheader').map((th) => th.textContent);
    expect(cabecalhos).toEqual(['Ref', 'Tour', 'Date', 'Customer', 'Guests', 'Source', 'Status', 'Total', '']);
    expect(screen.getAllByRole('button', { name: /All|Pending|Confirmed|Checked In|Checked Out|Cancelled|Payment not completed/ }).map((b) => b.textContent))
      .toEqual(['All', 'Pending', 'Confirmed', 'Checked In', 'Checked Out', 'Cancelled', 'Payment not completed']);
    /* o filtro de origem mostra rotulos ingleses mas o valor e o gravado */
    const origens = within(screen.getByDisplayValue('All sources')).getAllByRole('option').map((o) => [o.value, o.textContent]);
    expect(origens).toEqual([
      ['', 'All sources'], ['direct', 'Direct'], ['public', 'Public page'], ['booking_com', 'Booking.com'],
      ['airbnb', 'Airbnb'], ['viator', 'Viator'], ['getyourguide', 'GetYourGuide'], ['manual', 'Manual'],
    ]);
    semPortugues();
  });

  it('actividade: o botao de avancar fala ingles mas envia o estado gravado', async () => {
    servicos({ reservas: [reserva()] });
    renderPagina('activity');
    await screen.findAllByText('Cliente Alfa');
    const tabela = within(screen.getByRole('table'));
    fireEvent.click(tabela.getByRole('button', { name: /^Confirm/ }));
    await waitFor(() => expect(changeStatus).toHaveBeenCalledWith('aaaaaaaa-0001', 'confirmed'));
  });

  it('actividade: menu da linha, reagendar, no-show, atribuir equipa e manifesto sem portugues', async () => {
    servicos({ reservas: [reserva()], staff: [{ id: 'g1', name: 'Joao Guia', role: 'Guia' }] });
    renderPagina('activity');
    await screen.findAllByText('Cliente Alfa');
    const linha = within(screen.getByRole('table')).getAllByRole('row')[1];

    fireEvent.click(within(linha).getByRole('button', { name: 'More actions' }));
    expect(screen.getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['Reschedule', 'Send voucher', 'No-show', 'Assign team', 'Delete']);
    semPortugues();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Reschedule' }));
    expect(screen.getByRole('heading', { name: 'Reschedule booking' })).toBeInTheDocument();
    expect(screen.getByText('Booking for')).toBeInTheDocument();
    semPortugues();
    fireEvent.click(botao('Cancel'));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Reschedule booking' })).not.toBeInTheDocument());

    fireEvent.click(within(linha).getByRole('button', { name: 'More actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'No-show' }));
    expect(screen.getByRole('heading', { name: 'Record No-show' })).toBeInTheDocument();
    expect(screen.getByText(/Mark/)).toHaveTextContent('Mark Cliente Alfa as a no-show?');
    semPortugues();
    fireEvent.click(botao('Cancel'));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Record No-show' })).not.toBeInTheDocument());

    fireEvent.click(within(linha).getByRole('button', { name: 'More actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Assign team' }));
    expect(screen.getByRole('heading', { name: 'Assign team' })).toBeInTheDocument();
    await act(async () => {});
    /* o cargo gravado 'Guia' le-se 'Guide', o id enviado e o do colaborador */
    expect(screen.getAllByRole('option', { name: 'Joao Guia (Guide)' }).length).toBeGreaterThan(0);
    semPortugues();
  });

  it('actividade: o manifesto abre em ingles', async () => {
    servicos({ reservas: [reserva()] });
    renderPagina('activity');
    await screen.findAllByText('Cliente Alfa');
    fireEvent.click(screen.getByRole('button', { name: 'Manifest' }));
    expect(screen.getByRole('heading', { name: 'Participant Manifest' })).toBeInTheDocument();
    expect(screen.getByText('Select a tour and/or a date to see the manifest.')).toBeInTheDocument();
    semPortugues();
  });

  it('actividade: ver, editar e criar reserva em ingles', async () => {
    servicos({ reservas: [reserva()], staff: [] });
    renderPagina('activity');
    await screen.findAllByText('Cliente Alfa');
    const linha = within(screen.getByRole('table')).getAllByRole('row')[1];

    fireEvent.click(within(linha).getByRole('button', { name: 'View' }));
    expect(await screen.findByRole('heading', { name: 'Booking details' })).toBeInTheDocument();
    await screen.findByText('alfa@exemplo.cv');
    semPortugues(['alfa@exemplo.cv']);
    fireEvent.click(botao('Close'));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Booking details' })).not.toBeInTheDocument());

    fireEvent.click(within(linha).getByRole('button', { name: 'Edit' }));
    expect(screen.getByRole('heading', { name: 'Edit Booking' })).toBeInTheDocument();
    semPortugues();
  });

  it('actividade: Delete pede a confirmacao em ingles', async () => {
    servicos({ reservas: [reserva()] });
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderPagina('activity');
    await screen.findAllByText('Cliente Alfa');
    const linha = within(screen.getByRole('table')).getAllByRole('row')[1];
    fireEvent.click(within(linha).getByRole('button', { name: 'More actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(confirmar).toHaveBeenCalledWith('Delete this booking? This action cannot be undone.');
    confirmar.mockRestore();
  });

  it('rent-a-car: colunas, accoes e filtros em ingles; o valor do levantamento segue a lingua', async () => {
    const viatura = { id: 'v1', name: 'Jimny', description: JSON.stringify({ brand: 'Suzuki', model: 'Jimny', plate: 'ST-12-AB' }), status: 'active' };
    servicos({
      reservas: [
        reserva({ unit_id: 'v1', status: 'confirmed', total_price: 1234, notes_internal: JSON.stringify({ rentacar: { km_out: 12500, km_in: 13750 } }) }),
        reserva({ id: 'bbbbbbbb-0002', unit_id: 'v1', status: 'checked_in', customer_name: 'Cliente Beta', total_price: 80 }),
      ],
      units: [viatura],
    });
    renderPagina('rentacar');
    await screen.findByText('Cliente Alfa');
    const cabecalhos = within(screen.getByRole('table')).getAllByRole('columnheader').map((th) => th.textContent);
    expect(cabecalhos).toEqual(['Ref', 'Vehicle', 'Pick-up', 'Drop-off', 'Customer', 'Status', 'Total', '']);
    const c = within(screen.getAllByRole('row')[1]).getAllByRole('cell');
    expect(c[2]).toHaveTextContent('12,500 km');
    expect(c[3]).toHaveTextContent('13,750 km');
    expect(c[6].textContent).toBe('€1,234');
    expect(within(screen.getAllByRole('row')[1]).getByRole('button', { name: 'Pick-up' })).toBeInTheDocument();
    expect(within(screen.getAllByRole('row')[2]).getByRole('button', { name: 'Drop-off' })).toBeInTheDocument();
    semPortugues();
  });

  it('restaurante: colunas, turno, ocasiao e accoes em ingles', async () => {
    const mesa = { id: 'm1', name: 'Mesa interior', description: JSON.stringify({ number: 3 }), status: 'active' };
    servicos({
      reservas: [
        reserva({ unit_id: 'm1', status: 'confirmed', start_time: null, notes_guest: JSON.stringify({ turno: 'almoco', ocasiao: 'lua_de_mel', lista_espera: true }) }),
        reserva({ id: 'bbbbbbbb-0002', unit_id: 'm1', status: 'checked_in', customer_name: 'Cliente Beta', start_time: '20:30:00' }),
      ],
      units: [mesa],
    });
    renderPagina('restaurant');
    await screen.findByText('Cliente Alfa');
    const cabecalhos = within(screen.getByRole('table')).getAllByRole('columnheader').map((th) => th.textContent);
    expect(cabecalhos).toEqual(['Ref', 'Table', 'Shift', 'Guests', 'Customer', 'Occasion', 'Status', '']);
    expect(screen.getAllByText('Table 3').length).toBe(2);
    expect(screen.getByText('Waiting list')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('Lunch')).toBeInTheDocument();
    expect(screen.getByText('Honeymoon')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Seat' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Free table' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^(All shifts|Lunch|Dinner)$/ }).map((b) => b.textContent)).toEqual(['All shifts', 'Lunch', 'Dinner']);
    semPortugues();
    fireEvent.click(screen.getByRole('button', { name: 'Seat' }));
    await waitFor(() => expect(changeStatus).toHaveBeenCalledWith('aaaaaaaa-0001', 'checked_in'));
  });

  it('hotel: lista de cartoes em ingles', async () => {
    servicos({ reservas: [reserva({ units: { name: 'Quarto 1' }, fleet: { name: 'Buggy 1', capacity: 4 }, total_price: 1234.5 })] });
    renderPagina('hotel');
    await screen.findByText('Cliente Alfa');
    expect(screen.getByText('2 guests')).toBeInTheDocument();
    expect(screen.getByText('€1,234.50')).toBeInTheDocument();
    expect(screen.getByText('Buggy 1 (4 seats)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
    semPortugues();
  });

  it('em pt a pagina de actividade le como sempre', async () => {
    useUiStore.setState({ lang: 'pt' });
    servicos({ reservas: [reserva({ total_price: 1234 })] });
    renderPagina('activity');
    await screen.findAllByText('Cliente Alfa');
    expect(screen.getByText('1 resultado(s)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Manifesto' })).toBeInTheDocument();
    const cabecalhos = within(screen.getByRole('table')).getAllByRole('columnheader').map((th) => th.textContent);
    expect(cabecalhos).toEqual(['Ref', 'Tour', 'Data', 'Cliente', 'Pax', 'Origem', 'Estado', 'Total', '']);
    expect(screen.getAllByText('€1234').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Directo').length).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
describe('Modais do rent-a-car', () => {
  const UNITS = [{ id: 'u1', name: 'Carro 1', description: '{"brand":"Fiat","model":"Panda","plate":"S-01-AB"}' }];
  function props(over = {}) {
    return {
      reservation: {
        id: 'r1', unit_id: 'u1', customer_name: 'Cliente Alfa', check_in: HOJE, check_out: AMANHA,
        notes_internal: JSON.stringify({ foo: 'bar', rentacar: { km_out: 12000, fuel_out: 4 } }),
      },
      units: UNITS, open: true, onClose: vi.fn(), onDone: vi.fn(), ...over,
    };
  }

  it('devolucao: tudo em ingles e o combustivel "Full" grava o numero 4', async () => {
    const p = props();
    render(<DevolucaoModal {...p} />);
    expect(screen.getByRole('heading', { name: 'Car drop-off' })).toBeInTheDocument();
    expect(screen.getByText('Out: 12,000 km')).toBeInTheDocument();
    expect(screen.getAllByRole('button').filter((b) => ['Empty', '1/4', '1/2', '3/4', 'Full'].includes(b.textContent)).map((b) => b.textContent))
      .toEqual(['Empty', '1/4', '1/2', '3/4', 'Full']);
    semPortugues();
    fireEvent.click(botao('1/4'));
    fireEvent.click(botao('Full'));
    fireEvent.change(campo('Mileage in'), { target: { value: '12500' } });
    expect(screen.getByText('500 km driven')).toBeInTheDocument();
    fireEvent.click(botao('Partly retained'));
    fireEvent.change(campo('Amount retained (€)'), { target: { value: '40.5' } });
    semPortugues();
    fireEvent.click(botao('Confirm drop-off'));
    await waitFor(() => expect(p.onDone).toHaveBeenCalledTimes(1));
    expect(updateReservation).toHaveBeenCalledWith('r1', {
      notes_internal: JSON.stringify({
        foo: 'bar',
        rentacar: {
          km_out: 12000, fuel_out: 4,
          fuel_in: 4, km_in: 12500, damages_in: '', caucao_retained: 40.5, caucao_status: 'retained',
        },
      }),
    });
    expect(changeStatus).toHaveBeenCalledWith('r1', 'checked_out');
  });

  it('devolucao: o combustivel "Empty" grava 0 e a caucao total grava full', async () => {
    const p = props();
    render(<DevolucaoModal {...p} />);
    fireEvent.click(botao('Empty'));
    fireEvent.click(botao('Fully retained'));
    fireEvent.click(botao('Confirm drop-off'));
    await waitFor(() => expect(p.onDone).toHaveBeenCalledTimes(1));
    const gravado = JSON.parse(updateReservation.mock.calls[0][1].notes_internal).rentacar;
    expect(gravado.fuel_in).toBe(0);
    expect(gravado.caucao_status).toBe('full');
  });

  it('levantamento: tudo em ingles e grava combustivel, km e caucao como sempre', async () => {
    const p = props();
    render(<LevantamentoModal {...p} />);
    expect(screen.getByRole('heading', { name: 'Car pick-up' })).toBeInTheDocument();
    semPortugues();
    fireEvent.click(botao('1/2'));
    fireEvent.change(campo('Mileage out'), { target: { value: '12345' } });
    fireEvent.change(campo('Deposit (€)'), { target: { value: '150.5' } });
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByText('Paid')).toBeInTheDocument();
    fireEvent.click(botao('Confirm pick-up'));
    await waitFor(() => expect(p.onDone).toHaveBeenCalledTimes(1));
    expect(updateReservation).toHaveBeenCalledWith('r1', {
      notes_internal: JSON.stringify({
        foo: 'bar',
        rentacar: { km_out: 12345, fuel_out: 2, damages_out: '', caucao: '150.5', caucao_paid: true },
      }),
    });
    expect(changeStatus).toHaveBeenCalledWith('r1', 'checked_in');
  });

  it('os niveis de combustivel mantem os valores numericos e o rotulo segue a lingua', () => {
    expect(FUEL_LEVELS.map((n) => n.value)).toEqual([0, 1, 2, 3, 4]);
    const en = getT('en');
    const pt = getT('pt');
    expect(FUEL_LEVELS.map((n) => rotuloNivelCombustivel(n.value, en))).toEqual(['Empty', '1/4', '1/2', '3/4', 'Full']);
    expect(FUEL_LEVELS.map((n) => rotuloNivelCombustivel(n.value, pt))).toEqual(['Vazio', '1/4', '1/2', '3/4', 'Cheio']);
  });
});

/* ------------------------------------------------------------------ */
describe('Modal de detalhes do restaurante', () => {
  const MESAS = [{ id: 'm1', name: 'Mesa interior' }];
  function renderModal() {
    const p = {
      reservation: { id: 'r1', unit_id: 'm1', customer_name: 'Cliente Alfa', guests: 4, notes_guest: '{"phone":"+238 999"}' },
      units: MESAS, open: true, onClose: vi.fn(), onDone: vi.fn(),
    };
    render(<RestaurantCreateModal {...p} />);
    return p;
  }

  it('em ingles: textos ingleses e turno e ocasiao gravados como sempre', async () => {
    const p = renderModal();
    expect(screen.getByRole('heading', { name: 'Booking details' })).toBeInTheDocument();
    expect(screen.getByText('4 guests · Mesa interior')).toBeInTheDocument();
    expect(within(campo('Special occasion')).getAllByRole('option').map((o) => [o.value, o.textContent])).toEqual([
      ['', 'None'], ['aniversario', 'Birthday'], ['lua_de_mel', 'Honeymoon'], ['negocios', 'Business'], ['outro', 'Other'],
    ]);
    semPortugues();
    fireEvent.click(botao('Lunch · 12:00-15:00'));
    fireEvent.change(campo('Special occasion'), { target: { value: 'lua_de_mel' } });
    fireEvent.change(campo('Special requests'), { target: { value: 'No gluten' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(botao('Save details'));
    await waitFor(() => expect(p.onDone).toHaveBeenCalledTimes(1));
    expect(updateReservation).toHaveBeenCalledWith('r1', {
      notes_guest: JSON.stringify({
        phone: '+238 999', turno: 'almoco', ocasiao: 'lua_de_mel', pedidos_especiais: 'No gluten', lista_espera: true,
      }),
    });
  });

  it('sem mesa mostra "No table"', () => {
    render(<RestaurantCreateModal reservation={{ id: 'r1', unit_id: 'x', customer_name: 'Cliente Alfa', guests: 2 }} units={[]} open onClose={vi.fn()} onDone={vi.fn()} />);
    expect(screen.getByText('2 guests · No table')).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ */
describe('ManifestoModal (o que se imprime segue a lingua do painel)', () => {
  const UNITS = [{ id: 't1', name: 'Tour Pedra de Lume' }];
  const RESERVAS = [
    {
      id: 'a', unit_id: 't1', status: 'confirmed', check_in: '2026-11-24', guests: 2, customer_name: 'Cliente Alfa',
      customer_phone: '+238 111', total_price: 1234, notes_guest: JSON.stringify({ hotel: 'Hotel Sal', room: '12' }),
    },
    { id: 'b', unit_id: 't1', status: 'checked_in', check_in: '2026-11-24', guests: 1, customer_name: 'Cliente Beta', total_price: 66 },
  ];
  function abrir() {
    render(<ManifestoModal open onClose={vi.fn()} reservations={RESERVAS} units={UNITS} />);
    fireEvent.change(campo('Date'), { target: { value: '2026-11-24' } });
  }

  it('em ingles: titulo, cabecalhos, estados, totais e data em en-GB', () => {
    const spy = vi.spyOn(Date.prototype, 'toLocaleDateString');
    abrir();
    expect(screen.getByRole('heading', { name: 'Participant Manifest' })).toBeInTheDocument();
    const cabecalhos = within(screen.getByRole('table')).getAllByRole('columnheader').map((th) => th.textContent);
    expect(cabecalhos).toEqual(['#', 'Name', 'Phone', 'Hotel / Room', 'Emergency contact', 'Special reqs.', 'Guests', 'Status', 'Total']);
    expect(screen.getByText('All tours · 24/11/2026')).toBeInTheDocument();
    expect(screen.getByText('2 bookings · 3 participants')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export PDF' })).toBeInTheDocument();
    const celulas = within(screen.getByRole('table')).getAllByRole('row').map((l) => within(l).queryAllByRole('cell').map((c) => c.textContent));
    expect(celulas[1][7]).toBe('Confirmed');
    expect(celulas[2][7]).toBe('Checked In');
    expect(celulas[1][8]).toBe('€1,234');
    expect(celulas[3].at(-1)).toBe('€1,300');
    const locais = spy.mock.calls.map((c) => c[0]);
    expect(locais).toContain('en-GB');
    expect(locais).not.toContain('pt-PT');
    semPortugues();
    spy.mockRestore();
  });

  it('em pt: titulo e datas como sempre, em pt-PT, e estados em portugues', () => {
    useUiStore.setState({ lang: 'pt' });
    const spy = vi.spyOn(Date.prototype, 'toLocaleDateString');
    render(<ManifestoModal open onClose={vi.fn()} reservations={RESERVAS} units={UNITS} />);
    fireEvent.change(campo('Data'), { target: { value: '2026-11-24' } });
    expect(screen.getByRole('heading', { name: 'Manifesto de Participantes' })).toBeInTheDocument();
    expect(screen.getByText('Todos os tours · 24/11/2026')).toBeInTheDocument();
    expect(screen.getByText('2 reservas · 3 participantes')).toBeInTheDocument();
    const celulas = within(screen.getByRole('table')).getAllByRole('row').map((l) => within(l).queryAllByRole('cell').map((c) => c.textContent));
    expect(celulas[1][8]).toBe('€1234');
    const locais = spy.mock.calls.map((c) => c[0]);
    expect(locais).toContain('pt-PT');
    expect(locais).not.toContain('en-GB');
    spy.mockRestore();
  });

  it('em alemao a data segue o locale alemao', () => {
    useUiStore.setState({ lang: 'de' });
    render(<ManifestoModal open onClose={vi.fn()} reservations={RESERVAS} units={UNITS} />);
    fireEvent.change(campo('Datum'), { target: { value: '2026-11-24' } });
    expect(screen.getByText('Alle Touren · 24.11.2026')).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ */
describe('Detalhe, cartao e formulario da reserva', () => {
  const COMPLETA = {
    id: 'abcdef12-3456-7890', status: 'confirmed', source: 'public',
    units: { name: 'Tour Pedra de Lume', unit_type: 'tour' },
    total_price: 1234, amount_paid: 500.5,
    check_in: '2026-11-24', check_out: '2026-11-27', start_time: '19:30:00', guests: 3,
    payment_status: 'paid', payment_method: 'transfer',
    customer_name: 'Cliente Alfa', customer_email: 'alfa@exemplo.cv', customer_phone: '+238 900 0000', customer_country: 'PT',
    fleet: { name: 'Buggy 1', capacity: 4 }, notes: 'Chega tarde',
    created_at: '2026-11-20T10:30:00Z',
  };
  const DADOS_DETALHE = ['alfa@exemplo.cv', 'Chega tarde'];

  async function abrirDetalhe() {
    getReservation.mockReset().mockResolvedValue(COMPLETA);
    render(<ReservationDetailModal reservationId="abcdef12-3456-7890" open onClose={vi.fn()} />);
    await screen.findByText('Cliente Alfa');
  }

  it('em ingles: o valor e as datas seguem o en-GB e os rotulos sao ingleses', async () => {
    await abrirDetalhe();
    expect(screen.getByText('€1,234.00')).toBeInTheDocument();
    expect(screen.getByText('Paid: €500.50')).toBeInTheDocument();
    expect(screen.getByText('24/11/2026')).toBeInTheDocument();
    expect(screen.getByText('27/11/2026')).toBeInTheDocument();
    expect(screen.getByText('Public page')).toBeInTheDocument();
    expect(screen.getByText('Paid')).toBeInTheDocument();
    expect(screen.getByText('Bank transfer')).toBeInTheDocument();
    expect(screen.getByText('Buggy 1 (4 seats)')).toBeInTheDocument();
    expect(screen.getByText('Country')).toBeInTheDocument();
    expect(screen.getByText('Phone')).toBeInTheDocument();
    expect(screen.getByText(new Date(COMPLETA.created_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }))).toBeInTheDocument();
    /* "Confirmação" e o botao do WhatsApp (mensagens, fase 3), fora desta tarefa */
    semPortugues([...DADOS_DETALHE, 'Confirmação']);
  });

  it('em pt o detalhe le como sempre', async () => {
    useUiStore.setState({ lang: 'pt' });
    await abrirDetalhe();
    expect(screen.getByText('€1234.00')).toBeInTheDocument();
    expect(screen.getByText('Pago: €500.50')).toBeInTheDocument();
    expect(screen.getByText('24/11/2026')).toBeInTheDocument();
    expect(screen.getByText('Pag. Pública')).toBeInTheDocument();
    expect(screen.getByText('TRANSFER')).toBeInTheDocument();
    expect(screen.getByText('Buggy 1 (4 lugares)')).toBeInTheDocument();
    expect(screen.getByText('País')).toBeInTheDocument();
    expect(screen.getByText(new Date(COMPLETA.created_at).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' }))).toBeInTheDocument();
  });

  it('em ingles: o cartao mostra o valor e o avanco em ingles e envia o estado gravado', async () => {
    const onUpdate = vi.fn();
    render(<ReservationCard reservation={reserva({ total_price: 1234.5, status: 'confirmed' })} onUpdate={onUpdate} onEdit={vi.fn()} onView={vi.fn()} />);
    expect(screen.getByText('€1,234.50')).toBeInTheDocument();
    expect(screen.getByText('2 guests')).toBeInTheDocument();
    fireEvent.click(botao('Check-in'));
    await waitFor(() => expect(changeStatus).toHaveBeenCalledWith('aaaaaaaa-0001', 'checked_in'));
    semPortugues();
  });

  it('o rotulo do estado segue a lingua e um estado desconhecido mostra-se tal e qual', () => {
    render(<><StatusBadge status="cancelled" /><StatusBadge status="xyz" /></>);
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    expect(screen.getByText('xyz')).toBeInTheDocument();
  });

  it('formulario de actividade em ingles; origem e hora gravadas como sempre', () => {
    const onSave = vi.fn();
    const unidades = [{
      id: 't2', name: 'Tour Pedra de Lume', base_price: 25,
      description: JSON.stringify({ time_slots: [{ time: '09:00', capacity: 8 }] }),
    }];
    render(<ReservationForm units={unidades} operatorType="activity" onSave={onSave} onCancel={vi.fn()} loading={false} error="" />);
    fireEvent.change(campo('Tour / Activity'), { target: { value: 't2' } });
    expect(screen.getByRole('option', { name: '09:00 (8 seats)' })).toBeInTheDocument();
    fireEvent.change(campo('Tour date'), { target: { value: AMANHA } });
    expect(screen.getByText('1 guest(s)')).toBeInTheDocument();
    expect(screen.getByText('€25.00')).toBeInTheDocument();
    fireEvent.change(campo('Time slot'), { target: { value: '09:00' } });
    fireEvent.change(campo('Customer'), { target: { value: 'Cliente Alfa' } });
    fireEvent.change(campo('Email'), { target: { value: 'alfa@exemplo.cv' } });
    expect(screen.getByPlaceholderText('email@example.com')).toBeInTheDocument();
    expect(screen.getByText('ISO 2 code')).toBeInTheDocument();
    expect(within(campo('Source')).getAllByRole('option').map((o) => [o.value, o.textContent])).toEqual([
      ['direct', 'Direct'], ['booking_com', 'Booking.com'], ['airbnb', 'Airbnb'], ['viator', 'Viator'], ['getyourguide', 'GetYourGuide'], ['manual', 'Manual'],
    ]);
    fireEvent.change(campo('Source'), { target: { value: 'airbnb' } });
    semPortugues(['alfa@exemplo.cv']);
    fireEvent.click(botao('New Booking'));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ unit_id: 't2', source: 'airbnb', start_time: '09:00', notes: 'Hora: 09:00' }));
  });

  it('formularios de hotel e restaurante em ingles', () => {
    const { unmount } = render(<ReservationForm units={[{ id: 'u1', name: 'Quarto 1', base_price: 50 }]} operatorType="hotel" onSave={vi.fn()} onCancel={vi.fn()} loading={false} error="" />);
    fireEvent.change(campo('Unit'), { target: { value: 'u1' } });
    fireEvent.change(campo('Check-in'), { target: { value: AMANHA } });
    fireEvent.change(campo('Check-out'), { target: { value: DEPOIS } });
    expect(screen.getByText('1 night(s)')).toBeInTheDocument();
    expect(screen.getByText('€50.00')).toBeInTheDocument();
    expect(screen.getByText('The customer agreed to receive messages about this booking on WhatsApp')).toBeInTheDocument();
    semPortugues();
    unmount();
    render(<ReservationForm units={[{ id: 'm1', name: 'Mesa interior', base_price: 0 }]} operatorType="restaurant" onSave={vi.fn()} onCancel={vi.fn()} loading={false} error="" />);
    expect(screen.getByText('Booking date')).toBeInTheDocument();
    semPortugues();
  });
});

/* ------------------------------------------------------------------ */
describe('Atribuir equipa', () => {
  it('em ingles: textos ingleses, cargo traduzido e ids enviados como sempre', async () => {
    const onDone = vi.fn();
    createCompositeAssignment.mockReset().mockResolvedValue({});
    render(
      <MemoryRouter future={FUTURE}>
        <AssignCompositeModal
          reservation={reserva({ guests: 3 })}
          guides={[{ id: 'g1', name: 'Joao Guia', role: 'Guia' }, { id: 'g2', name: 'Rui Condutor', role: 'Condutor' }]}
          onClose={vi.fn()} onDone={onDone}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText(`${HOJE} · 3 guests · Cliente Alfa`)).toBeInTheDocument();
    expect(screen.getByText('Is the guide also the driver?')).toBeInTheDocument();
    expect(await screen.findByText((_, el) => el?.tagName === 'P' && el.textContent === 'No vehicles registered — you can add them under Fleet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Fleet' })).toBeInTheDocument();
    expect(screen.getAllByRole('option', { name: 'Rui Condutor (Driver)' }).length).toBeGreaterThan(0);
    semPortugues(['Rui Condutor']);
    fireEvent.change(campo('Guide'), { target: { value: 'g1' } });
    fireEvent.click(botao('Assign'));
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(createCompositeAssignment).toHaveBeenCalledWith({
      reservation_id: 'aaaaaaaa-0001', vehicle_id: null, guide_id: 'g1', driver_id: 'g1',
    });
  });

  it('em pt le como sempre', async () => {
    useUiStore.setState({ lang: 'pt' });
    render(
      <MemoryRouter future={FUTURE}>
        <AssignCompositeModal reservation={reserva({ guests: 3 })} guides={[{ id: 'g1', name: 'Joao Guia', role: 'Guia' }]} onClose={vi.fn()} onDone={vi.fn()} />
      </MemoryRouter>,
    );
    await act(async () => {});
    expect(screen.getByText(`${HOJE} · 3 pax · Cliente Alfa`)).toBeInTheDocument();
    expect(screen.getAllByRole('option', { name: 'Joao Guia (Guia)' }).length).toBeGreaterThan(0);
    expect(botao('Atribuir')).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ */
describe('Helpers de formato', () => {
  it('euros: pt como sempre, en com separadores en-GB', () => {
    expect(eurosInteiros(1234.4, 'pt')).toBe('€1234');
    expect(eurosInteiros(1234.4, 'en')).toBe('€1,234');
    expect(eurosInteiros(undefined, 'en')).toBe('€0');
    expect(eurosDecimais(1234, 'pt')).toBe('€1234.00');
    expect(eurosDecimais(1234, 'en')).toBe('€1,234.00');
    expect(eurosDecimais(1234.5, 'en')).toBe('€1,234.50');
  });

  it('origem e metodo: o valor gravado manda, o rotulo muda; desconhecido mostra-se tal e qual', () => {
    const en = getT('en');
    expect(rotuloOrigem('public', en)).toBe('Public page');
    expect(rotuloOrigem('public', getT('pt'))).toBe('Pag. Pública');
    expect(rotuloOrigem('booking_com', en)).toBe('Booking.com');
    expect(rotuloOrigem('outra', en)).toBe('outra');
    expect(rotuloMetodoReserva('cash', en, 'en')).toBe('Cash');
    expect(rotuloMetodoReserva('paypal', en, 'en')).toBe('PayPal');
    expect(rotuloMetodoReserva('vinti4', en, 'en')).toBe('VINTI4');
    expect(rotuloMetodoReserva('cash', getT('pt'), 'pt')).toBe('CASH');
  });
});

/* ------------------------------------------------------------------ */
describe('Cartoes do telemovel em ingles', () => {
  beforeEach(() => {
    window.matchMedia = vi.fn((query) => ({
      matches: query.includes('max-width'), media: query, addEventListener: () => {}, removeEventListener: () => {},
    }));
  });
  afterEach(() => { delete window.matchMedia; });

  it('rent-a-car: etiquetas inglesas nos cartoes', () => {
    const unidades = [{ id: 'u1', name: 'Jimny', description: JSON.stringify({ brand: 'Suzuki', model: 'Jimny', plate: 'ST-12-AB' }) }];
    render(
      <RentacarTable
        reservations={[reserva({ unit_id: 'u1', status: 'confirmed', notes_internal: '{}' })]} units={unidades}
        onEdit={vi.fn()} onDelete={vi.fn()} onLevantamento={vi.fn()} onDevolucao={vi.fn()} onUpdate={vi.fn()} onView={vi.fn()}
      />,
    );
    const cartao = within(screen.getByRole('list'));
    ['Vehicle', 'Pick-up', 'Drop-off', 'Customer', 'Status', 'Total'].forEach((e) => expect(cartao.getAllByText(e).length).toBeGreaterThan(0));
    expect(cartao.getByRole('button', { name: 'Pick-up' })).toBeInTheDocument();
    semPortugues();
  });

  it('restaurante: etiquetas inglesas nos cartoes', () => {
    const mesas = [{ id: 'm1', name: 'Mesa interior', description: JSON.stringify({ number: 3 }) }];
    render(
      <RestaurantTable
        reservations={[reserva({ unit_id: 'm1', status: 'pending', notes_guest: JSON.stringify({ turno: 'jantar', ocasiao: 'negocios' }) })]} units={mesas}
        onEdit={vi.fn()} onDelete={vi.fn()} onDetails={vi.fn()} onUpdate={vi.fn()} onView={vi.fn()}
      />,
    );
    const cartao = within(screen.getByRole('list'));
    expect(cartao.getByText('Table 3')).toBeInTheDocument();
    expect(cartao.getByText('Dinner')).toBeInTheDocument();
    expect(cartao.getByText('Business')).toBeInTheDocument();
    expect(cartao.getByRole('button', { name: /^Confirm/ })).toBeInTheDocument();
    semPortugues();
  });
});
