import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Register from '../pages/Register';
import useUiStore from '../store/uiStore';
import { register } from '../services/authService';
import { getSiteStatus } from '../services/publicService';
import en from '../i18n/en.json';
import de from '../i18n/de.json';
import nl from '../i18n/nl.json';
import pt from '../i18n/pt.json';

vi.mock('../services/authService', () => ({ register: vi.fn(), login: vi.fn(), validateInvite: vi.fn() }));
vi.mock('../services/publicService', () => ({ getSiteStatus: vi.fn() }));

/* REGISTER_ERROR e o ramo em que o email NAO esta registado (esse e EMAIL_EXISTS): o texto do
   servidor e o do Supabase (password fraca, email invalido...). A traducao tem de ser generica. */
function montar() {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: true, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }));
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Register />
    </MemoryRouter>,
  );
}

async function submeter() {
  const { container } = montar();
  await act(async () => {});
  fireEvent.change(container.querySelector('input[type="text"]'), { target: { value: 'Ana Lopes' } });
  fireEvent.change(container.querySelector('input[type="email"]'), { target: { value: 'ana@exemplo.cv' } });
  const [pw, conf] = container.querySelectorAll('input[type="password"]');
  fireEvent.change(pw, { target: { value: 'Forte#2026x' } });
  fireEvent.change(conf, { target: { value: 'Forte#2026x' } });
  fireEvent.submit(container.querySelector('input[type="email"]').closest('form'));
}

beforeEach(() => {
  getSiteStatus.mockReset().mockResolvedValue({ invite_only: false });
  register.mockReset().mockRejectedValue({
    response: { status: 400, data: { error: 'Password should be at least 6 characters', code: 'REGISTER_ERROR' } },
  });
});
afterEach(() => {
  cleanup();
  useUiStore.setState({ lang: 'pt' });
});

describe('Registo: erro REGISTER_ERROR', () => {
  it('em ingles mostra o texto generico, nunca "ja registado"', async () => {
    useUiStore.setState({ lang: 'en' });
    await submeter();
    expect(await screen.findByText(en.errors.code.REGISTER_ERROR)).toBeInTheDocument();
    expect(en.errors.code.REGISTER_ERROR).not.toBe(en.errors.code.EMAIL_EXISTS);
    expect(en.errors.code.REGISTER_ERROR).not.toMatch(/already registered/i);
  });

  it('em pt mostra o texto do servidor', async () => {
    await submeter();
    expect(await screen.findByText('Password should be at least 6 characters')).toBeInTheDocument();
  });

  it('nenhuma lingua diz que o email ja esta registado', () => {
    for (const d of [pt, en, de, nl]) expect(d.errors.code.REGISTER_ERROR).not.toBe(d.errors.code.EMAIL_EXISTS);
    expect(pt.errors.code.REGISTER_ERROR).not.toMatch(/registado/i);
    expect(de.errors.code.REGISTER_ERROR).not.toMatch(/registriert/i);
    expect(nl.errors.code.REGISTER_ERROR).not.toMatch(/geregistreerd/i);
  });

  it('o erro de ligacao em alemao esta escrito correctamente', () => {
    expect(de.errors.network).toBe('Verbindungsfehler. Überprüfen Sie Ihre Internetverbindung.');
  });
});
