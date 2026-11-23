import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CommandPalette from '../components/layout/CommandPalette';
import useAuthStore from '../store/authStore';
import useUiStore from '../store/uiStore';

const navigate = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  /* Regista a chamada mas navega mesmo, para o router mudar de local */
  return {
    ...actual,
    useNavigate: () => {
      const real = actual.useNavigate();
      return (...args) => { navigate(...args); return real(...args); };
    },
  };
});

function renderPalette({ open = true, onClose = vi.fn() } = {}) {
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <CommandPalette open={open} onClose={onClose} />
    </MemoryRouter>
  );
  return onClose;
}

function campo() {
  return screen.getByPlaceholderText('Pesquisar…');
}

function escrever(texto) {
  fireEvent.change(campo(), { target: { value: texto } });
}

describe('CommandPalette', () => {
  beforeEach(() => {
    navigate.mockClear();
    useAuthStore.setState({ operator: { operator_type: 'activity', plan: 'pro' } });
  });

  it('não renderiza fechado', () => {
    renderPalette({ open: false });
    expect(screen.queryByPlaceholderText('Pesquisar…')).not.toBeInTheDocument();
  });

  it('abre com o campo focado e papeis de acessibilidade', () => {
    renderPalette();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    expect(campo()).toHaveFocus();
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('filtra sem acentos', () => {
    renderPalette();
    escrever('calendario');
    expect(screen.getByText('Calendário')).toBeInTheDocument();
    expect(screen.queryByText('Reservas')).not.toBeInTheDocument();
  });

  it('Enter navega', () => {
    const onClose = renderPalette();
    escrever('financeiro');
    fireEvent.keyDown(campo(), { key: 'Enter' });
    expect(navigate).toHaveBeenCalledWith('/financeiro');
    expect(onClose).toHaveBeenCalled();
  });

  it('setas movem a seleção', () => {
    renderPalette();
    fireEvent.keyDown(campo(), { key: 'ArrowDown' });
    fireEvent.keyDown(campo(), { key: 'Enter' });
    expect(navigate).toHaveBeenCalledWith('/unidades');
  });

  it('clique abre o ecrã', () => {
    const onClose = renderPalette();
    fireEvent.click(screen.getByRole('option', { name: /Calendário/ }));
    expect(navigate).toHaveBeenCalledWith('/calendario');
    expect(onClose).toHaveBeenCalled();
  });

  it('Esc fecha', () => {
    const onClose = renderPalette();
    fireEvent.keyDown(campo(), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('bloqueado não navega', () => {
    useAuthStore.setState({ operator: { operator_type: 'activity', plan: 'starter' } });
    renderPalette();
    escrever('automacoes');
    fireEvent.keyDown(campo(), { key: 'Enter' });
    expect(screen.getByText('Funcionalidade Pro')).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  describe('ecrã bloqueado (modal de upgrade)', () => {
    beforeEach(() => {
      useAuthStore.setState({ operator: { operator_type: 'activity', plan: 'starter' } });
    });

    function abrirBloqueado() {
      const onClose = renderPalette();
      escrever('automacoes');
      fireEvent.keyDown(campo(), { key: 'Enter' });
      expect(screen.getByText('Funcionalidade Pro')).toBeInTheDocument();
      return onClose;
    }

    it('Ver planos fecha o modal e a palette', () => {
      const onClose = abrirBloqueado();
      fireEvent.click(screen.getByRole('button', { name: /Ver planos de subscrição/ }));

      expect(navigate).toHaveBeenCalledWith('/definicoes?tab=facturacao');
      expect(screen.queryByText('Funcionalidade Pro')).not.toBeInTheDocument();
      expect(onClose).toHaveBeenCalled();
    });

    it('Esc fecha primeiro o modal e só depois a palette', () => {
      const onClose = abrirBloqueado();

      fireEvent.keyDown(campo(), { key: 'Escape' });
      expect(screen.queryByText('Funcionalidade Pro')).not.toBeInTheDocument();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
      expect(campo()).toHaveFocus();

      fireEvent.keyDown(campo(), { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('sem resultados', () => {
    renderPalette();
    escrever('zzzz');
    expect(screen.getByText('Sem resultados')).toBeInTheDocument();
  });
});

describe('CommandPalette em ingles', () => {
  beforeEach(() => {
    useAuthStore.setState({ operator: { operator_type: 'activity', plan: 'pro' } });
    useUiStore.setState({ lang: 'en' });
  });

  /* Desmonta antes de repor a lingua, para a mudanca nao re-renderizar fora de act */
  afterEach(() => {
    cleanup();
    useUiStore.setState({ lang: 'pt' });
  });

  it('encontra Bookings pelo nome ingles e nao pelo portugues', () => {
    renderPalette();
    const input = screen.getByPlaceholderText('Search…');
    expect(screen.getByRole('dialog', { name: 'Search screens' })).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'book' } });
    expect(screen.getByRole('option', { name: 'Bookings' })).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'reservas' } });
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
    expect(screen.getByText('No results')).toBeInTheDocument();
  });
});
