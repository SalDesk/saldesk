import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CommandPalette from '../components/layout/CommandPalette';
import useAuthStore from '../store/authStore';

const navigate = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => navigate };
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

  it('nao renderiza fechado', () => {
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

  it('setas movem a selecao', () => {
    renderPalette();
    fireEvent.keyDown(campo(), { key: 'ArrowDown' });
    fireEvent.keyDown(campo(), { key: 'Enter' });
    expect(navigate).toHaveBeenCalledWith('/unidades');
  });

  it('clique abre o ecra', () => {
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

  it('bloqueado nao navega', () => {
    useAuthStore.setState({ operator: { operator_type: 'activity', plan: 'starter' } });
    renderPalette();
    escrever('automacoes');
    fireEvent.keyDown(campo(), { key: 'Enter' });
    expect(screen.getByText('Funcionalidade Pro')).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('sem resultados', () => {
    renderPalette();
    escrever('zzzz');
    expect(screen.getByText('Sem resultados')).toBeInTheDocument();
  });
});
