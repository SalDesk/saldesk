import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import StaffPortal from '../pages/StaffPortal';
import useAuthStore from '../store/authStore';
import useUiStore from '../store/uiStore';
import useToastStore from '../store/toastStore';
import api from '../services/api';
import {
  getMyProfile, listLeave, createLeave, getLeaveBalance, listDocuments, listCertifications,
} from '../services/staffService';
import { FUTURE, dia } from './helpers/staffFixtures';
import { portuguesNoEcra, chavesCruas } from './helpers/portuguesNoEcra';

/* Sem rede: a api, os servicos do pessoal e o chat sao simulados */
vi.mock('../services/api', () => ({ default: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }));
vi.mock('../services/staffService', () => ({
  getMyProfile: vi.fn(), updateMyProfile: vi.fn(), setAvailability: vi.fn(),
  listLeave: vi.fn(), createLeave: vi.fn(), getLeaveBalance: vi.fn(), listDocuments: vi.fn(), listCertifications: vi.fn(),
}));
vi.mock('../services/authService', () => ({ forgotPassword: vi.fn() }));
vi.mock('../services/messagingService', () => ({ sendReservationMessage: vi.fn(), markMessageOpened: vi.fn() }));
vi.mock('../components/shared/StaffChat', () => ({ default: () => <p>CHAT DA EQUIPA</p> }));

const TRABALHOS = [
  { id: 'j1', status: 'pending', reservation_id: 'r1', notes_manager: 'Levar coletes',
    /* reserva pendente: os botoes de WhatsApp (componente partilhado, fora desta tarefa) nao aparecem */
    reservations: { check_in: '2099-12-01', check_out: '2099-12-01', customer_name: 'Maria Cliente', status: 'pending', units: { name: 'Buggy Tour' } } },
  { id: 'j2', status: 'completed', reservation_id: 'r2',
    reservations: { check_in: '2020-01-05', customer_name: 'Joao Antigo', units: { name: 'Quad' } } },
];
const PEDIDOS = [
  { id: 'l1', type: 'vacation', start_date: '2099-08-01', end_date: '2099-08-05', status: 'pending' },
  { id: 'l2', type: 'sick', start_date: '2099-02-01', end_date: '2099-02-01', status: 'approved' },
];
/* dados dos testes que ficam como estao em qualquer lingua */
const DADOS = ['Rui Lopes', 'Buggy Tour', 'Quad', 'Maria Cliente', 'Joao Antigo', 'Levar coletes', 'Contrato 2026', 'PADI', 'rui@x.cv', '+238'];

let spyErr; let spyWarn;
beforeEach(() => {
  spyErr = vi.spyOn(console, 'error').mockImplementation(() => {});
  spyWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  useUiStore.setState({ lang: 'pt' });
  useToastStore.setState({ toasts: [] });
  useAuthStore.setState({
    token: 'tok',
    user: { email: 'rui@x.cv', user_metadata: { staff_id: 's1', staff_role: 'Manutencao', name: 'Rui Lopes' } },
  });
  api.get.mockReset().mockResolvedValue({ data: { data: TRABALHOS } });
  api.put.mockReset().mockResolvedValue({ data: {} });
  getMyProfile.mockReset().mockResolvedValue({ id: 's1', role: 'Manutencao', phone: '+238 991', whatsapp: '' });
  listLeave.mockReset().mockResolvedValue(PEDIDOS);
  getLeaveBalance.mockReset().mockResolvedValue({ entitled_days: 22, used_days: 1, remaining_days: 21 });
  createLeave.mockReset().mockResolvedValue({});
  listDocuments.mockReset().mockResolvedValue([{ id: 'd1', name: 'Contrato 2026', file_url: 'http://x.test/c.pdf', expiry_date: dia(10) }]);
  listCertifications.mockReset().mockResolvedValue([{ id: 'c1', name: 'PADI', issuer: null, expiry_date: null }]);
});
afterEach(() => {
  const erros = spyErr.mock.calls.map(c => String(c[0]).slice(0, 200));
  const avisos = spyWarn.mock.calls.map(c => String(c[0]).slice(0, 200));
  cleanup();
  useUiStore.setState({ lang: 'pt' });
  useAuthStore.setState({ token: null, user: null });
  vi.restoreAllMocks();
  expect(erros).toEqual([]);
  expect(avisos).toEqual([]);
});

function montar(caminho = '/staff/jobs') {
  return render(
    <MemoryRouter future={FUTURE} initialEntries={[caminho]}>
      <Routes>
        <Route path="/staff/*" element={<StaffPortal />} />
        <Route path="/login" element={<p>LOGIN</p>} />
      </Routes>
    </MemoryRouter>,
  );
}
const cabecalho = () => screen.getByRole('banner');
const navegacao = () => screen.getByRole('navigation');

describe('Portal do pessoal em português (como hoje)', () => {
  it('cabecalho_trabalhos_e_navegacao', async () => {
    montar();
    expect(await screen.findByText('Buggy Tour', { selector: 'p.text-base' })).toBeInTheDocument();
    expect(within(cabecalho()).getByText('Olá, Rui Lopes')).toBeInTheDocument();
    expect(within(cabecalho()).getByText('Manutencao')).toBeInTheDocument();
    expect(screen.getByText('Próximo trabalho')).toBeInTheDocument();
    expect(screen.getByText('Próximos trabalhos')).toBeInTheDocument();
    expect(screen.getByText('Histórico recente')).toBeInTheDocument();
    expect(screen.getAllByText('Pendente').length).toBeGreaterThan(0);
    expect(screen.getByText('Concluído')).toBeInTheDocument();
    ['Trabalhos', 'Calendário', 'Disponib.', 'Chat', 'Perfil'].forEach(r => expect(within(navegacao()).getByText(r)).toBeInTheDocument());
  });

  it('perfil_com_ferias_e_documentos', async () => {
    montar('/staff/perfil');
    expect(await screen.findByText('Definido pelo operador')).toBeInTheDocument();
    expect(await screen.findByText('As minhas férias')).toBeInTheDocument();
    expect(screen.getByText('Férias')).toBeInTheDocument();
    expect(screen.getByText('Doença')).toBeInTheDocument();
    expect(screen.getByText('Pedir férias')).toBeInTheDocument();
    expect(await screen.findByText('Os meus documentos')).toBeInTheDocument();
    expect(screen.getByText(`${dia(10)} (expira em breve)`)).toBeInTheDocument();
    expect(screen.getByText('Alterar password')).toBeInTheDocument();
    expect(screen.getByText('Guardar alterações')).toBeInTheDocument();
  });
});

describe('Portal do pessoal em inglês', () => {
  beforeEach(() => { useUiStore.setState({ lang: 'en' }); });

  it('trabalhos_cabecalho_e_navegacao_em_ingles_sem_portugues', async () => {
    montar();
    expect(await screen.findByText('Buggy Tour', { selector: 'p.text-base' })).toBeInTheDocument();
    expect(within(cabecalho()).getByText('Hello, Rui Lopes')).toBeInTheDocument();
    /* o cargo gravado em portugues aparece em ingles */
    expect(within(cabecalho()).getByText('Maintenance')).toBeInTheDocument();
    expect(screen.getByText('Next job')).toBeInTheDocument();
    expect(screen.getByText('Upcoming jobs')).toBeInTheDocument();
    expect(screen.getByText('Recent history')).toBeInTheDocument();
    expect(screen.getAllByText('Pending').length).toBeGreaterThan(0);
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getAllByText(/01 Dec 2099/).length).toBeGreaterThan(0);
    ['Jobs', 'Calendar', 'Availab.', 'Chat', 'Profile'].forEach(r => expect(within(navegacao()).getByText(r)).toBeInTheDocument());
    expect(portuguesNoEcra(DADOS)).toEqual([]);
    expect(chavesCruas(['staffPortal', 'staff', 'hr'])).toEqual([]);
  });

  it('detalhe_do_trabalho_em_ingles', async () => {
    montar('/staff/jobs/j1');
    expect(await screen.findByText('Manager notes')).toBeInTheDocument();
    expect(screen.getByText('Back')).toBeInTheDocument();
    expect(screen.getByText('Customer')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirm job/ })).toBeInTheDocument();
    expect(portuguesNoEcra(DADOS)).toEqual([]);
  });

  it('calendario_e_disponibilidade_em_ingles', async () => {
    montar('/staff/calendario');
    expect(await screen.findByText('Mon')).toBeInTheDocument();
    ['Sun', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(d => expect(screen.getByText(d)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Previous month' })).toBeInTheDocument();
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(portuguesNoEcra(DADOS)).toEqual([]);
    fireEvent.click(within(navegacao()).getByText('Availab.'));
    expect(await screen.findByText(/Tap a day to mark it as unavailable/)).toBeInTheDocument();
    expect(screen.getByText('Available')).toBeInTheDocument();
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(portuguesNoEcra(DADOS)).toEqual([]);
  });

  it('perfil_em_ingles_e_pedir_ferias_grava_o_tipo_sick', async () => {
    montar('/staff/perfil');
    expect(await screen.findByText('Set by the operator')).toBeInTheDocument();
    expect(await screen.findByText('My leave')).toBeInTheDocument();
    expect(screen.getByText('Annual leave')).toBeInTheDocument();
    expect(screen.getByText('Sick leave')).toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.getByText('Entitlement')).toBeInTheDocument();
    expect(await screen.findByText('My documents')).toBeInTheDocument();
    expect(screen.getByText(`${dia(10)} (expires soon)`)).toBeInTheDocument();
    expect(screen.getByText('My certifications')).toBeInTheDocument();
    expect(screen.getByText('Role')).toBeInTheDocument();
    expect(screen.getAllByText('Maintenance').length).toBeGreaterThan(0);
    expect(screen.getByText('Change password')).toBeInTheDocument();
    expect(screen.getByText('Save changes')).toBeInTheDocument();
    expect(portuguesNoEcra(DADOS)).toEqual([]);

    fireEvent.click(screen.getByText('Request leave'));
    const tipo = screen.getByRole('combobox');
    const opcao = within(tipo).getByRole('option', { name: 'Sick leave' });
    expect(opcao.value).toBe('sick');
    fireEvent.change(tipo, { target: { value: opcao.value } });
    const [inicio, fim] = document.querySelectorAll('input[type="date"]');
    fireEvent.change(inicio, { target: { value: '2099-03-01' } });
    fireEvent.change(fim, { target: { value: '2099-03-02' } });
    fireEvent.click(screen.getByText('Send request'));
    await waitFor(() => expect(createLeave).toHaveBeenCalledWith('s1', expect.objectContaining({ type: 'sick', start_date: '2099-03-01' })));
    await waitFor(() => expect(useToastStore.getState().toasts.map(t => t.message)).toContain('Request sent for approval'));
  });
});

describe('Portal do pessoal: troca de língua no cabeçalho', () => {
  it('o_botao_EN_do_cabecalho_passa_o_portal_para_ingles_e_PT_volta', async () => {
    montar();
    expect(await screen.findByText('Próximo trabalho')).toBeInTheDocument();
    fireEvent.click(within(cabecalho()).getByRole('button', { name: 'en' }));
    expect(await screen.findByText('Next job')).toBeInTheDocument();
    expect(useUiStore.getState().lang).toBe('en');
    expect(within(navegacao()).getByText('Jobs')).toBeInTheDocument();
    expect(within(cabecalho()).getByText('Hello, Rui Lopes')).toBeInTheDocument();
    expect(portuguesNoEcra(DADOS)).toEqual([]);
    fireEvent.click(within(cabecalho()).getByRole('button', { name: 'pt' }));
    expect(await screen.findByText('Próximo trabalho')).toBeInTheDocument();
    expect(within(navegacao()).getByText('Trabalhos')).toBeInTheDocument();
  });
});
