/* O registo segue a lingua do painel: porta do convite, validacoes e textos fixos. Em pt le como antes. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Register from '../pages/Register';
import useUiStore from '../store/uiStore';
import { register, validateInvite } from '../services/authService';
import { getSiteStatus } from '../services/publicService';
import { portuguesNoEcra, chavesCruas } from './helpers/portuguesNoEcra';

vi.mock('../services/authService', () => ({ register: vi.fn(), login: vi.fn(), validateInvite: vi.fn() }));
vi.mock('../services/publicService', () => ({ getSiteStatus: vi.fn() }));

async function montar(lang, conviteObrigatorio) {
  useUiStore.setState({ lang });
  getSiteStatus.mockReset().mockResolvedValue({ invite_only: conviteObrigatorio });
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: true, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }));
  const r = render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Register /></MemoryRouter>,
  );
  await act(async () => {});
  return r;
}
/* O AuthLayout tem textos de marca que pertencem ao ecra de entrada (tarefa fora desta); filtra so o que e do registo */
const doRegisto = (x) => /convite|código|password|Passwords|Ligação|Já tem|Criar conta/i.test(x);

beforeEach(() => { register.mockReset(); validateInvite.mockReset(); });
afterEach(() => { cleanup(); useUiStore.setState({ lang: 'pt' }); });

describe('Registo: porta do convite', () => {
  it('em pt le como antes', async () => {
    await montar('pt', true);
    expect(screen.getByText('Acesso por convite')).toBeInTheDocument();
    expect(screen.getByText('A SalDesk está em fase de lançamento. Necessitas de um código de convite.')).toBeInTheDocument();
    expect(screen.getByText('Código de convite')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ex: SALDESK2026')).toBeInTheDocument();
    expect(screen.getByText('Validar código')).toBeInTheDocument();
    expect(screen.getByText('Pede acesso antecipado')).toBeInTheDocument();
  });

  it('em ingles nao deixa portugues e traduz a mensagem de codigo em falta e invalido', async () => {
    const { container } = await montar('en', true);
    expect(screen.getByText('Invitation-only access')).toBeInTheDocument();
    expect(screen.getByText('Validate code')).toBeInTheDocument();
    expect(portuguesNoEcra().filter(doRegisto)).toEqual([]);
    fireEvent.submit(container.querySelector('form'));
    expect(await screen.findByText('Enter your invitation code.')).toBeInTheDocument();
    validateInvite.mockResolvedValue({ data: { valid: false } });
    fireEvent.change(container.querySelector('input[type="text"]'), { target: { value: 'abc' } });
    fireEvent.submit(container.querySelector('form'));
    expect(await screen.findByText('Invalid or expired code. Check the code and try again.')).toBeInTheDocument();
  });
});

describe('Registo: formulario', () => {
  async function preencher(container, pw, conf) {
    fireEvent.change(container.querySelector('input[type="text"]'), { target: { value: 'Ana' } });
    fireEvent.change(container.querySelector('input[type="email"]'), { target: { value: 'ana@x.cv' } });
    const [a, b] = container.querySelectorAll('input[type="password"]');
    fireEvent.change(a, { target: { value: pw } });
    fireEvent.change(b, { target: { value: conf } });
    fireEvent.submit(container.querySelector('form'));
  }

  it('em ingles as validacoes seguem a lingua', async () => {
    const { container } = await montar('en', false);
    await preencher(container, 'abc', 'xyz');
    expect(await screen.findByText('The password must be strong: 8+ characters, an uppercase letter, a number and a special character.')).toBeInTheDocument();
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText('John Smith')).toBeInTheDocument();
    expect(screen.getByText('Secure SSL connection')).toBeInTheDocument();
    expect(portuguesNoEcra().filter(doRegisto)).toEqual([]);
    expect(chavesCruas(['register', 'auth'])).toEqual([]);
  });

  it('em alemao e neerlandes as validacoes seguem a lingua', async () => {
    let r = await montar('de', false);
    await preencher(r.container, 'abc', 'xyz');
    expect(await screen.findByText('Die Passwörter stimmen nicht überein')).toBeInTheDocument();
    cleanup();
    r = await montar('nl', false);
    await preencher(r.container, 'abc', 'xyz');
    expect(await screen.findByText('Wachtwoorden komen niet overeen')).toBeInTheDocument();
  });

  it('em pt as validacoes leem como antes', async () => {
    const { container } = await montar('pt', false);
    await preencher(container, 'abc', 'xyz');
    expect(await screen.findByText('A password deve ser forte: 8+ caracteres, maiúscula, número e especial.')).toBeInTheDocument();
    expect(screen.getByText('Passwords não coincidem')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('João Silva')).toBeInTheDocument();
    expect(screen.getByText('Ligação segura SSL')).toBeInTheDocument();
  });

  it('o codigo validado aparece na lingua e com o codigo em maiusculas', async () => {
    const { container } = await montar('en', true);
    validateInvite.mockResolvedValue({ data: { valid: true } });
    fireEvent.change(container.querySelector('input[type="text"]'), { target: { value: 'abc' } });
    fireEvent.submit(container.querySelector('form'));
    const p = await screen.findByText(/validated\./);
    expect(p.textContent.replace(/\s+/g, ' ').trim()).toBe('Code ABC validated.');
  });
});
