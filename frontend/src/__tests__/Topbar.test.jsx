import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Topbar from '../components/layout/Topbar';
import useAuthStore from '../store/authStore';
import useUiStore from '../store/uiStore';
import api from '../services/api';

/* Sem rede: as notificacoes chegam vazias */
vi.mock('../services/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { data: [] } }),
    put: vi.fn().mockResolvedValue({}),
  },
}));

/* act assincrono: deixa assentar o pedido das notificacoes */
async function renderTopbar() {
  await act(async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Topbar />
      </MemoryRouter>
    );
  });
}

function atalho() {
  fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
}

describe('Topbar atalho Ctrl+K', () => {
  beforeEach(() => {
    useAuthStore.setState({ operator: { operator_type: 'activity', plan: 'pro', name: 'Operador' } });
  });

  afterEach(() => {
    document.querySelectorAll('[data-teste-modal]').forEach((el) => el.remove());
  });

  it('abre a palette', async () => {
    await renderTopbar();
    expect(screen.queryByPlaceholderText('Pesquisar…')).not.toBeInTheDocument();

    atalho();
    expect(screen.getByPlaceholderText('Pesquisar…')).toBeInTheDocument();
  });

  it('nao abre a palette com outro modal aberto', async () => {
    const modal = document.createElement('div');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('data-teste-modal', '');
    document.body.appendChild(modal);

    await renderTopbar();
    atalho();
    expect(screen.queryByPlaceholderText('Pesquisar…')).not.toBeInTheDocument();
  });

  it('com a palette ja aberta mantem-na aberta', async () => {
    await renderTopbar();
    atalho();
    atalho();
    expect(screen.getByPlaceholderText('Pesquisar…')).toBeInTheDocument();
  });
});

describe('Topbar por lingua', () => {
  beforeEach(() => {
    useAuthStore.setState({ operator: { operator_type: 'activity', plan: 'pro', name: 'Operador' } });
    api.get.mockResolvedValueOnce({
      data: { data: [{ id: 1, notification_type: 'new_booking', content: 'Ana, 2 pessoas', is_read: false, created_at: new Date().toISOString() }] },
    });
  });

  /* Desmonta antes de repor a lingua, para a mudanca nao re-renderizar fora de act */
  afterEach(() => {
    cleanup();
    useUiStore.setState({ lang: 'pt' });
  });

  it('em ingles: pesquisa, notificacoes, perfil e menu da pesquisa sem portugues', async () => {
    useUiStore.setState({ lang: 'en' });
    await renderTopbar();

    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(screen.getByText('New booking')).toBeInTheDocument();
    expect(screen.getByText('1 unread')).toBeInTheDocument();
    expect(screen.getByText('View all')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Operador'));
    expect(screen.getByText('View profile')).toBeInTheDocument();
    expect(screen.getByText('Sign out')).toBeInTheDocument();

    atalho();
    expect(screen.getByPlaceholderText('Search…')).toBeInTheDocument();
    for (const nome of ['Bookings', 'Customers', 'Settings']) {
      expect(screen.getByRole('option', { name: nome })).toBeInTheDocument();
    }
    for (const nome of ['Reservas', 'Clientes', 'Definições', 'Mensagens', 'Operação']) {
      expect(screen.queryByText(nome)).not.toBeInTheDocument();
    }
  });

  it('em portugues: os textos de hoje', async () => {
    await renderTopbar();

    expect(screen.getByRole('button', { name: 'Pesquisar' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Notificações' }));
    expect(screen.getByText('Nova reserva')).toBeInTheDocument();
    expect(screen.getByText('1 não lida')).toBeInTheDocument();
    expect(screen.getByText('Ver todas')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Operador'));
    expect(screen.getByText('Ver perfil')).toBeInTheDocument();
    expect(screen.getByText('Sair')).toBeInTheDocument();

    atalho();
    expect(screen.getByPlaceholderText('Pesquisar…')).toBeInTheDocument();
    for (const nome of ['Reservas', 'Clientes', 'Definições']) {
      expect(screen.getByRole('option', { name: nome })).toBeInTheDocument();
    }
  });
});
