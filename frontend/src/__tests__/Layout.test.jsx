/* Layout: a moldura da app. Ecra demo, rastreio de rota, ligacao de presenca por socket com
   notificacao de mensagens, e sincronizacao periodica do operador. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import useAuthStore from '../store/authStore';
import useToastStore from '../store/toastStore';
import { getMe } from '../services/authService';
import { trackPageView } from '../utils/telemetry';
import { playNotificationSound } from '../utils/notificationSound';
import { io } from 'socket.io-client';

/* Os filhos pesados nao interessam aqui: so a moldura. */
vi.mock('../components/layout/Sidebar', () => ({ default: () => <nav>Barra lateral</nav> }));
vi.mock('../components/layout/Topbar', () => ({ default: () => <header>Topo</header> }));
vi.mock('../components/layout/BottomNav', () => ({ default: () => <div>Navegacao inferior</div> }));
vi.mock('../components/layout/MoreDrawer', () => ({ default: () => null }));
vi.mock('../components/tour/WelcomeTour', () => ({ default: () => null }));
vi.mock('../components/ui/Toast', () => ({ ToastContainer: () => null }));

vi.mock('../services/authService', () => ({ getMe: vi.fn() }));
vi.mock('../utils/telemetry', () => ({ trackPageView: vi.fn() }));
vi.mock('../utils/notificationSound', () => ({ playNotificationSound: vi.fn() }));

/* Socket falso: guarda os ouvintes para os testes os dispararem. */
let socket;
vi.mock('socket.io-client', () => ({ io: vi.fn() }));
function novoSocket() {
  const ouvintes = {};
  return {
    on: vi.fn((evento, fn) => { ouvintes[evento] = fn; }),
    disconnect: vi.fn(),
    emitir: (evento, dados) => ouvintes[evento](dados),
  };
}

let navegarPara;
function Navegador() { navegarPara = useNavigate(); return null; }

function montar(rota = '/inicio') {
  return render(
    <MemoryRouter initialEntries={[rota]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Navegador />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/inicio" element={<p>Pagina inicio</p>} />
          <Route path="/reservas" element={<p>Pagina reservas</p>} />
          <Route path="/mensagens" element={<p>Pagina mensagens</p>} />
          <Route path="/mensagens-saldesk" element={<p>Pagina mensagens saldesk</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  socket = novoSocket();
  io.mockReset().mockReturnValue(socket);
  getMe.mockReset().mockResolvedValue({ operator: { id: 'op1', plan: 'business' } });
  trackPageView.mockReset();
  playNotificationSound.mockReset();
  useToastStore.setState({ toasts: [] });
  useAuthStore.setState({ token: 'tok123', operator: { id: 'op1', plan: 'pro', is_demo: false } });
});
afterEach(() => { vi.useRealTimers(); });

describe('Layout: moldura', () => {
  it('mostra a pagina da rota dentro da moldura, com barra lateral, topo e navegacao inferior', () => {
    montar();
    expect(screen.getByText('Pagina inicio')).toBeInTheDocument();
    expect(screen.getByText('Barra lateral')).toBeInTheDocument();
    expect(screen.getByText('Topo')).toBeInTheDocument();
    expect(screen.getByText('Navegacao inferior')).toBeInTheDocument();
  });

  it('a faixa de demonstracao so aparece nas contas demo', () => {
    const { unmount } = montar();
    expect(screen.queryByText(/Modo demonstração/)).toBeNull();
    unmount();
    useAuthStore.setState({ operator: { id: 'op1', is_demo: true } });
    montar();
    expect(screen.getByText(/Modo demonstração/)).toBeInTheDocument();
  });

  it('regista a visita a rota ao entrar e a cada mudanca de rota', () => {
    montar('/inicio');
    expect(trackPageView).toHaveBeenLastCalledWith('/inicio');
    act(() => navegarPara('/reservas'));
    expect(screen.getByText('Pagina reservas')).toBeInTheDocument();
    expect(trackPageView).toHaveBeenLastCalledWith('/reservas');
    expect(trackPageView).toHaveBeenCalledTimes(2);
  });
});

describe('Layout: ligacao em tempo real', () => {
  it('liga o socket com o token da sessao e desliga ao sair', () => {
    const { unmount } = montar();
    expect(io).toHaveBeenCalledTimes(1);
    expect(io.mock.calls[0][1]).toEqual({ auth: { token: 'tok123' } });
    expect(io.mock.calls[0][0]).not.toMatch(/\/api\/v1/);
    unmount();
    expect(socket.disconnect).toHaveBeenCalledTimes(1);
  });

  it('sem sessao nao liga nenhum socket', () => {
    useAuthStore.setState({ token: null });
    montar();
    expect(io).not.toHaveBeenCalled();
  });

  it('mensagem de um cliente: som e aviso "Novo cliente"; clicar no aviso abre as mensagens', () => {
    montar();
    act(() => socket.emitir('message:new', { sender_type: 'guest', content: 'Ola, ha vagas?' }));
    expect(playNotificationSound).toHaveBeenCalledTimes(1);
    const [aviso] = useToastStore.getState().toasts;
    expect(aviso).toMatchObject({ title: 'Novo cliente', message: 'Ola, ha vagas?' });
    act(() => aviso.onClick());
    expect(screen.getByText('Pagina mensagens')).toBeInTheDocument();
  });

  it('mensagem de outra pessoa da equipa: titulo "Mensagem da equipa"', () => {
    montar();
    act(() => socket.emitir('message:new', { sender_type: 'staff', sender_id: 'outro', content: 'Turno trocado' }));
    expect(useToastStore.getState().toasts[0]).toMatchObject({ title: 'Mensagem da equipa' });
  });

  it('o que o proprio operador escreveu (ou a resposta automatica do sistema) nao toca nem avisa', () => {
    montar();
    act(() => socket.emitir('message:new', { sender_type: 'manager', sender_id: 'op1', content: 'Eu escrevi' }));
    act(() => socket.emitir('message:new', { sender_type: 'system', sender_id: 'op1', content: 'Resposta automatica' }));
    expect(playNotificationSound).not.toHaveBeenCalled();
    expect(useToastStore.getState().toasts).toEqual([]);
  });

  it('mensagem do fundador: som, aviso "Mensagem do SalDesk" e clicar abre as mensagens do SalDesk', () => {
    montar();
    act(() => socket.emitir('admin:message:new', { content: 'Manutencao amanha' }));
    expect(playNotificationSound).toHaveBeenCalledTimes(1);
    const [aviso] = useToastStore.getState().toasts;
    expect(aviso).toMatchObject({ title: 'Mensagem do SalDesk', message: 'Manutencao amanha' });
    act(() => aviso.onClick());
    expect(screen.getByText('Pagina mensagens saldesk')).toBeInTheDocument();
  });
});

describe('Layout: sincronizacao do operador', () => {
  it('de minuto a minuto vai buscar o operador e actualiza o plano na sessao', async () => {
    vi.useFakeTimers();
    montar();
    expect(getMe).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(60 * 1000); });
    expect(getMe).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().operator).toMatchObject({ id: 'op1', plan: 'business' });
  });

  it('ao voltar o foco a janela sincroniza logo', async () => {
    montar();
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    expect(getMe).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().operator.plan).toBe('business');
  });

  it('um pedido falhado nao deixa erro nem mexe no operador', async () => {
    getMe.mockRejectedValue(new Error('sem rede'));
    montar();
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    expect(useAuthStore.getState().operator.plan).toBe('pro');
  });

  it('depois de sair da moldura deixa de sincronizar', async () => {
    const { unmount } = montar();
    unmount();
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    expect(getMe).not.toHaveBeenCalled();
  });
});
