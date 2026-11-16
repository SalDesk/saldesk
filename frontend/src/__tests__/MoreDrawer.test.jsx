/* MoreDrawer (menu "Mais" da barra inferior do telemovel): teclado, foco e acessibilidade. */
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MoreDrawer from '../components/layout/MoreDrawer';
import useAuthStore from '../store/authStore';

const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <MemoryRouter future={FUTURE}>
      <button type="button" onClick={() => setOpen(true)}>Abrir menu</button>
      <MoreDrawer open={open} onClose={() => setOpen(false)} />
    </MemoryRouter>
  );
}

beforeEach(() => {
  useAuthStore.setState({ token: 't', operator: { id: 'op1', operator_type: 'hotel', plan: 'business', plan_status: 'active' } });
});
afterEach(() => {
  cleanup();
  useAuthStore.setState({ token: null, operator: null });
});

function abrir() {
  const botao = screen.getByRole('button', { name: 'Abrir menu' });
  botao.focus();
  fireEvent.click(botao);
  return botao;
}

describe('MoreDrawer: acessibilidade', () => {
  it('fechado nao expoe os botoes ao teclado nem a leitores de ecra', () => {
    render(<Harness />);
    expect(screen.queryByRole('dialog')).toBeNull();
    /* os botoes do menu existem no DOM mas estao inertes: nao focaveis e fora da arvore de acessibilidade */
    const sheet = document.querySelector('[aria-hidden="true"]');
    expect(sheet).not.toBeNull();
    expect(sheet.hasAttribute('inert')).toBe(true);
  });

  it('aberto e um dialogo modal com nome', () => {
    render(<Harness />);
    abrir();
    const dialogo = screen.getByRole('dialog', { name: 'Mais opcoes' });
    expect(dialogo).toHaveAttribute('aria-modal', 'true');
    expect(dialogo.hasAttribute('inert')).toBe(false);
    expect(dialogo).not.toHaveAttribute('aria-hidden');
  });

  it('ao abrir o foco vai para dentro do menu', () => {
    render(<Harness />);
    abrir();
    const dialogo = screen.getByRole('dialog', { name: 'Mais opcoes' });
    expect(dialogo.contains(document.activeElement)).toBe(true);
  });

  it('Escape fecha o menu e devolve o foco ao botao que o abriu', () => {
    render(<Harness />);
    const botao = abrir();
    const dialogo = screen.getByRole('dialog', { name: 'Mais opcoes' });
    expect(dialogo.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(botao);
  });

  it('um novo render do pai com o menu aberto nao rouba o foco ao utilizador', () => {
    const { rerender } = render(<Harness />);
    abrir();
    const dialogo = screen.getByRole('dialog', { name: 'Mais opcoes' });
    const botoes = within(dialogo).getAllByRole('button');
    const outro = botoes[botoes.length - 1];
    outro.focus();
    rerender(<Harness />); // o pai volta a renderizar e passa um onClose novo
    expect(document.activeElement).toBe(outro);
  });

  it('Escape com o menu fechado nao faz nada', () => {
    render(<Harness />);
    const antes = document.activeElement;
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.activeElement).toBe(antes);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('o botao Sair continua acessivel dentro do menu aberto', () => {
    render(<Harness />);
    abrir();
    expect(within(screen.getByRole('dialog', { name: 'Mais opcoes' })).getByRole('button', { name: 'Sair' })).toBeInTheDocument();
  });
});
