/* A recuperacao de password segue a lingua do painel: titulo, campos, validacoes e o ecra de link invalido.
   Em pt le como antes. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ResetPassword from '../pages/ResetPassword';
import useUiStore from '../store/uiStore';
import { resetPassword } from '../services/authService';
import { portuguesNoEcra, chavesCruas } from './helpers/portuguesNoEcra';

vi.mock('../services/authService', () => ({ resetPassword: vi.fn(), login: vi.fn() }));

const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };

async function montar(lang, hash = '#access_token=abc&type=recovery') {
  useUiStore.setState({ lang });
  window.location.hash = hash;
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: true, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }));
  const r = render(<MemoryRouter future={FUTURE}><ResetPassword /></MemoryRouter>);
  await act(async () => {});
  return r;
}

/* O AuthLayout tem textos de marca que pertencem ao ecra de entrada; filtra so o que e deste ecra */
const doEcra = (x) => /password|Passwords|link|Link|login|Repor|Escolhe/i.test(x);

beforeEach(() => { resetPassword.mockReset(); });
afterEach(() => {
  cleanup();
  useUiStore.setState({ lang: 'pt' });
  window.location.hash = '';
});

describe('Repor password', () => {
  it('em pt le como antes', async () => {
    await montar('pt');
    expect(screen.getByText('Nova password', { selector: 'h1' })).toBeInTheDocument();
    expect(screen.getByText('Escolhe uma password forte para a tua conta.')).toBeInTheDocument();
    expect(screen.getByText('Confirmar password', { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Repor password' })).toBeInTheDocument();
  });

  it('em ingles o formulario nao deixa portugues nem chaves cruas', async () => {
    await montar('en');
    expect(screen.getByText('New password', { selector: 'h1' })).toBeInTheDocument();
    expect(screen.getByText('Choose a strong password for your account.')).toBeInTheDocument();
    expect(screen.getByText('Confirm password', { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset password' })).toBeInTheDocument();
    expect(portuguesNoEcra().filter(doEcra)).toEqual([]);
    expect(chavesCruas(['resetPassword'])).toEqual([]);
  });

  it('em ingles as validacoes seguem a lingua', async () => {
    const { container } = await montar('en');
    const [a, b] = container.querySelectorAll('input[type="password"]');
    fireEvent.change(a, { target: { value: 'abc' } });
    fireEvent.change(b, { target: { value: 'xyz' } });
    expect(screen.getByText('The passwords do not match.')).toBeInTheDocument();
    fireEvent.submit(container.querySelector('form'));
    expect(await screen.findByText('The password must be strong: 8+ characters, an uppercase letter, a number and a special character.')).toBeInTheDocument();
    expect(resetPassword).not.toHaveBeenCalled();
    fireEvent.change(a, { target: { value: 'Forte#2026' } });
    fireEvent.submit(container.querySelector('form'));
    expect((await screen.findAllByText('The passwords do not match.')).length).toBeGreaterThan(0);
  });

  it('em ingles um link falhado mostra o texto por omissao em ingles', async () => {
    resetPassword.mockRejectedValue(new Error('rede'));
    const { container } = await montar('en');
    const [a, b] = container.querySelectorAll('input[type="password"]');
    fireEvent.change(a, { target: { value: 'Forte#2026' } });
    fireEvent.change(b, { target: { value: 'Forte#2026' } });
    fireEvent.submit(container.querySelector('form'));
    expect(await screen.findByText('The link has expired or is invalid. Request a new recovery link.')).toBeInTheDocument();
    expect(resetPassword).toHaveBeenCalledWith('abc', 'Forte#2026');
  });

  it('o ecra de link invalido segue a lingua', async () => {
    await montar('en', '');
    expect(screen.getByText('Invalid or expired link')).toBeInTheDocument();
    expect(screen.getByText('This recovery link is no longer valid. Request a new one.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to login' })).toBeInTheDocument();
    expect(portuguesNoEcra().filter(doEcra)).toEqual([]);
    cleanup();
    await montar('pt', '');
    expect(screen.getByText('Link inválido ou expirado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Voltar ao login' })).toBeInTheDocument();
  });
});
