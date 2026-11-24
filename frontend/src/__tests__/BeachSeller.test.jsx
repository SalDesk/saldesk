import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BeachSeller from '../pages/BeachSeller';
import VendedorPerfil from '../pages/VendedorPerfil';
import { listReservations } from '../services/reservationsService';
import { listSellerCommissions } from '../services/sellerService';
import { getMyProfile } from '../services/staffService';
import useUiStore from '../store/uiStore';
import useAuthStore from '../store/authStore';
import { portuguesNoEcra, chavesCruas } from './helpers/portuguesNoEcra';

vi.mock('../services/reservationsService', () => ({ listReservations: vi.fn() }));
vi.mock('../services/sellerService', () => ({
  listSellerCommissions: vi.fn(),
  getSellerCommissionPct: vi.fn().mockReturnValue(10),
}));
vi.mock('../services/staffService', () => ({ getMyProfile: vi.fn(), updateMyProfile: vi.fn() }));
vi.mock('../services/authService', () => ({ forgotPassword: vi.fn() }));
vi.mock('../components/shared/StaffChat', () => ({ default: () => <div>chat</div> }));

const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };
const AGORA = new Date().toISOString();
const MES = new Date().toLocaleDateString('en-CA').slice(0, 7);

const RESERVAS = [
  { id: 'r1', customer_name: 'Ana Lima', unit_name: 'Buggy Tour', guests: 2, status: 'confirmed', total_price: 1234, created_at: AGORA, check_in: '2026-12-05', customer_phone: '+238 900 0000' },
];
const COMISSOES = [
  { id: 'c1', tour_name: 'Buggy Tour', amount: 123, percentage: 10, status: 'pending', created_at: `${MES}-02T10:00:00Z`, reservations: { total_price: 1234 } },
];
const DADOS = ['Ana Lima', 'Buggy Tour', 'Zy'];

function ver(ui) {
  return render(<MemoryRouter future={FUTURE}>{ui}</MemoryRouter>);
}

beforeEach(() => {
  useUiStore.setState({ lang: 'pt' });
  useAuthStore.setState({ user: { id: 's1', email: 'zy@x.cv', user_metadata: { name: 'Zy', staff_id: 's1' } } });
  listReservations.mockReset().mockResolvedValue(RESERVAS);
  listSellerCommissions.mockReset().mockResolvedValue(COMISSOES);
  getMyProfile.mockReset().mockResolvedValue({ commission_pct: 10, seller_zone: 'Praia de Santa Maria' });
});
afterEach(() => {
  cleanup();
  useUiStore.setState({ lang: 'pt' });
});

describe('BeachSeller', () => {
  it('em portugues fica como sempre, com euros sem separador', async () => {
    ver(<BeachSeller />);
    expect(await screen.findByText('Olá, Zy')).toBeTruthy();
    expect(screen.getByText('Fim de Turno')).toBeTruthy();
    expect(screen.getByText('Minhas Comissões')).toBeTruthy();
    expect(screen.getAllByText('€1234').length).toBeGreaterThan(0);
    expect(screen.getByText('Passeio: 2026-12-05')).toBeTruthy();
    expect(screen.getByText('Confirmado')).toBeTruthy();
  });

  it('em ingles mostra tudo em ingles, com euros do ingles e sem portugues', async () => {
    useUiStore.setState({ lang: 'en' });
    ver(<BeachSeller />);
    expect(await screen.findByText('Hello, Zy')).toBeTruthy();
    expect(screen.getAllByText('€1,234').length).toBeGreaterThan(0);
    expect(screen.getByText('Confirmed')).toBeTruthy();
    expect(screen.getByText('Personal goal')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'End of shift' }));
    expect(screen.getByText("Today's sales")).toBeTruthy();
    expect(portuguesNoEcra(DADOS)).toEqual([]);
    expect(chavesCruas(['beachSeller', 'staff'])).toEqual([]);
  });

  it('a aba de comissoes e o mes seguem a lingua', async () => {
    useUiStore.setState({ lang: 'en' });
    ver(<BeachSeller />);
    fireEvent.click(await screen.findByRole('button', { name: 'My commissions' }));
    expect(await screen.findByText('Waiting for the operator to confirm')).toBeTruthy();
    expect(screen.getByText(/10% of €1,234/)).toBeTruthy();
    const mes = new Date().toLocaleDateString('en-GB', { month: 'short' });
    expect(screen.getByText(new RegExp(`History — ${mes}`))).toBeTruthy();
    expect(portuguesNoEcra(DADOS)).toEqual([]);
  });

  it('em portugues o mes tem os mesmos nomes de sempre', async () => {
    ver(<BeachSeller />);
    fireEvent.click(await screen.findByRole('button', { name: 'Minhas Comissões' }));
    const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    expect(await screen.findByText(`Histórico — ${MESES[new Date().getMonth()]}`)).toBeTruthy();
    expect(screen.getByText(`${MESES[new Date().getMonth()]} ${new Date().getFullYear()}`)).toBeTruthy();
  });

  it('o botao de lingua do cabecalho muda o ecra para ingles', async () => {
    ver(<BeachSeller />);
    expect(await screen.findByText('Olá, Zy')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'en' }));
    await waitFor(() => expect(screen.getByText('Hello, Zy')).toBeTruthy());
    expect(useUiStore.getState().lang).toBe('en');
  });
});

describe('VendedorPerfil', () => {
  it('em portugues fica como sempre', async () => {
    ver(<VendedorPerfil />);
    expect(await screen.findByText('Definido pelo operador')).toBeTruthy();
    expect(screen.getByText('Praia de Santa Maria')).toBeTruthy();
    expect(screen.getByText('Guardar alterações')).toBeTruthy();
  });

  it('em ingles mostra tudo em ingles, zona incluida, e o botao de lingua muda o ecra', async () => {
    ver(<VendedorPerfil />);
    await screen.findByText('Definido pelo operador');
    fireEvent.click(screen.getByRole('button', { name: 'en' }));
    expect(await screen.findByText('Set by the operator')).toBeTruthy();
    expect(screen.getByText('Santa Maria Beach')).toBeTruthy();
    expect(screen.getByText('Save changes')).toBeTruthy();
    expect(portuguesNoEcra(['Zy', 'zy@x.cv'])).toEqual([]);
    expect(chavesCruas(['beachSeller', 'staff'])).toEqual([]);
  });
});
