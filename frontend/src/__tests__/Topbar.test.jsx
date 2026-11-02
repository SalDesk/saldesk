import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Topbar from '../components/layout/Topbar';
import useAuthStore from '../store/authStore';

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
