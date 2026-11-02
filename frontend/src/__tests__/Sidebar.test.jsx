import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import useAuthStore from '../store/authStore';
import useUiStore from '../store/uiStore';
import { useNavCounters } from '../hooks/useNavCounters';

vi.mock('../hooks/useNavCounters', () => ({ useNavCounters: vi.fn() }));

/* Mostra a rota atual, para confirmar que um clique nao navegou */
function LocalAtual() {
  return <div data-testid="rota">{useLocation().pathname}</div>;
}

function renderSidebar(rota = '/') {
  return render(
    <MemoryRouter initialEntries={[rota]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Sidebar />
      <LocalAtual />
    </MemoryRouter>
  );
}

function operador(extra = {}) {
  return { operator_type: 'activity', plan: 'starter', slug: 'kawa', name: 'Kawa tour', ...extra };
}

describe('Sidebar agrupada', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ operator: operador() });
    useUiStore.setState({ navCollapsed: {} });
    useNavCounters.mockReturnValue({});
  });

  it('mostra as cinco seccoes', () => {
    renderSidebar();
    for (const nome of ['Operação', 'Clientes', 'Gestão', 'Crescimento', 'Configuração']) {
      expect(screen.getByRole('button', { name: nome })).toBeInTheDocument();
    }
  });

  it('crescimento e configuracao comecam recolhidas', () => {
    renderSidebar();

    expect(screen.queryByText('Marketing')).not.toBeInTheDocument();
    const cabecalho = screen.getByRole('button', { name: 'Crescimento' });
    expect(cabecalho).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(cabecalho);

    expect(screen.getByText('Marketing')).toBeInTheDocument();
    expect(cabecalho).toHaveAttribute('aria-expanded', 'true');
    expect(useUiStore.getState().navCollapsed.crescimento).toBe(false);
  });

  it('seccao da rota ativa abre sozinha', () => {
    renderSidebar('/automacoes');
    expect(screen.getByText('Automações')).toBeInTheDocument();
  });

  it('item bloqueado', () => {
    renderSidebar('/automacoes');

    const item = screen.getByRole('button', { name: /Automações/ });
    expect(within(item).getByText('Pro')).toBeInTheDocument();

    fireEvent.click(item);

    expect(screen.getByText('Funcionalidade Pro')).toBeInTheDocument();
    expect(screen.getByTestId('rota')).toHaveTextContent('/automacoes');
  });

  it('item bloqueado depois de expandir a seccao', () => {
    renderSidebar();

    fireEvent.click(screen.getByRole('button', { name: 'Crescimento' }));
    const item = screen.getByRole('button', { name: /Automações/ });
    expect(within(item).getByText('Pro')).toBeInTheDocument();

    fireEvent.click(item);

    expect(screen.getByText('Funcionalidade Pro')).toBeInTheDocument();
    expect(screen.getByTestId('rota')).toHaveTextContent('/');
  });

  it('rodape', () => {
    renderSidebar();
    expect(screen.getByRole('link', { name: /Ver o meu site/ })).toHaveAttribute(
      'href',
      'https://app.saldesk.cv/book/kawa'
    );
    expect(screen.queryByText('Perfil')).not.toBeInTheDocument();
    expect(screen.queryByText('Sair')).not.toBeInTheDocument();
  });

  it('contador', () => {
    useNavCounters.mockReturnValue({ '/reservas': 12 });
    renderSidebar();
    const item = screen.getByRole('link', { name: /Reservas/ });
    expect(within(item).getByText('9+')).toBeInTheDocument();
  });

  it('contador pequeno mostra o numero', () => {
    useNavCounters.mockReturnValue({ '/reservas': 3 });
    renderSidebar();
    const item = screen.getByRole('link', { name: /Reservas/ });
    expect(within(item).getByText('3')).toBeInTheDocument();
  });

  it('tipo restaurante', () => {
    useAuthStore.setState({ operator: operador({ operator_type: 'restaurant' }) });
    renderSidebar();
    expect(screen.getByText('Mesas')).toBeInTheDocument();
  });

  it('ancoras do tour', () => {
    renderSidebar();
    expect(document.querySelector('[data-tour="nav-dashboard"]')).toBeInTheDocument();
    expect(document.querySelector('[data-tour="nav-unidades"]')).toBeInTheDocument();
    expect(document.querySelector('[data-tour="nav-reservas"]')).toBeInTheDocument();
    expect(document.querySelector('[data-tour="nav-financeiro"]')).toBeInTheDocument();
    expect(document.querySelector('[data-tour="nav-site"]')).toBeInTheDocument();
  });
});
