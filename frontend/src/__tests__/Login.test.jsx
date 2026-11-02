import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from '../pages/Login';
import useAuthStore, { setRememberDevice } from '../store/authStore';
import useUiStore from '../store/uiStore';
import { login, forgotPassword } from '../services/authService';
import { getT } from '../i18n';

vi.mock('../services/authService');

/* So o setRememberDevice e simulado; o resto da store fica real */
vi.mock('../store/authStore', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, setRememberDevice: vi.fn() };
});

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => mockNavigate };
});

const t = getT('pt');

/* O AuthLayout le window.matchMedia (jsdom nao o implementa).
   matches: true => viewport desktop, logo o painel esquerdo da marca existe. */
function stubMatchMedia() {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: true,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

function renderLogin(rota = '/login') {
  return render(
    <MemoryRouter initialEntries={[rota]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Login />
    </MemoryRouter>
  );
}

function preencher(email = 'ana@hotel.cv', password = 'segredo123') {
  fireEvent.change(screen.getByLabelText(t('auth.email')), { target: { value: email } });
  fireEvent.change(screen.getByLabelText(t('auth.password')), { target: { value: password } });
}

function submeterLogin() {
  fireEvent.click(screen.getByRole('button', { name: t('auth.login') }));
}

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    stubMatchMedia();
    useAuthStore.setState({ token: null, refreshToken: null, user: null, operator: null });
    useUiStore.setState({ lang: 'pt' });
  });

  it('mostra os campos e as opcoes', () => {
    renderLogin();

    expect(screen.getByLabelText(t('auth.email'))).toBeInTheDocument();
    expect(screen.getByLabelText(t('auth.password'))).toBeInTheDocument();
    expect(screen.getByLabelText(t('auth.rememberDevice'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('auth.forgotPassword') })).toBeInTheDocument();
  });

  it('usa o layout dividido', () => {
    const { container } = renderLogin();

    expect(container.querySelector('[data-ui="app"]')).toBeInTheDocument();
    /* matchMedia simulado como desktop: o painel esquerdo da marca existe */
    expect(screen.getByText(t('auth.brandHeadline'))).toBeInTheDocument();
  });

  it('o rotulo de lembrar dispositivo nao e truncado e fica na mesma linha do link', () => {
    renderLogin();

    const texto = screen.getByText(t('auth.rememberDevice'));
    expect(texto.className).not.toContain('truncate');
    expect(texto.className).toContain('leading-snug');

    const linha = texto.closest('label').parentElement;
    const esqueci = screen.getByRole('button', { name: t('auth.forgotPassword') });
    expect(linha).toContainElement(esqueci);
    expect(linha.className).toContain('items-start');
    expect(esqueci.className).toContain('shrink-0');
  });

  it('o botao de mostrar password tem nome acessivel e alterna o tipo', () => {
    renderLogin();

    const campo = screen.getByLabelText(t('auth.password'));
    expect(campo).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar password' }));
    expect(campo).toHaveAttribute('type', 'text');

    const ocultar = screen.getByRole('button', { name: 'Ocultar password' });
    expect(ocultar).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(ocultar);
    expect(campo).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Mostrar password' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('recuperar password', async () => {
    forgotPassword.mockResolvedValue({});
    renderLogin();

    fireEvent.change(screen.getByLabelText(t('auth.email')), { target: { value: 'ana@hotel.cv' } });
    fireEvent.click(screen.getByRole('button', { name: t('auth.forgotPassword') }));

    expect(screen.getByText(t('auth.forgotTitle'))).toBeInTheDocument();
    /* O campo de recuperacao tambem tem nome acessivel e vem preenchido */
    expect(screen.getByLabelText(t('auth.email'))).toHaveValue('ana@hotel.cv');
    fireEvent.click(screen.getByRole('button', { name: t('auth.sendRecoveryLink') }));

    await waitFor(() => expect(forgotPassword).toHaveBeenCalledWith('ana@hotel.cv'));
    expect(await screen.findByText(t('auth.emailSentTitle'))).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: t('auth.backToLogin') }));
    expect(screen.getByText(t('auth.loginTitle'))).toBeInTheDocument();
  });

  it('erro de credenciais', async () => {
    login.mockRejectedValue({ response: { data: { attempts_remaining: 2 } } });
    renderLogin();

    preencher();
    submeterLogin();

    const erro = await screen.findByText(
      `${t('auth.invalidCredentials')} ${t('auth.attemptsRemaining', { n: 2 })}`
    );
    expect(erro).toBeInTheDocument();
    /* Faixa clara: nada de texto branco sobre fundo claro */
    expect(erro.className).not.toContain('text-white');
    expect(erro.closest('div').className).not.toContain('text-white');
    expect(erro.closest('div').className).toContain('text-red-800');
  });

  it('conta bloqueada', async () => {
    login.mockRejectedValue({ response: { data: { code: 'ACCOUNT_LOCKED', retry_after_seconds: 120 } } });
    renderLogin();

    preencher();
    submeterLogin();

    expect(await screen.findByText(t('auth.accessBlocked'))).toBeInTheDocument();
    expect(screen.getByText('2:00')).toBeInTheDocument();
  });

  it('login com sucesso vai para o painel', async () => {
    login.mockResolvedValue({
      access_token: 'tk', refresh_token: 'rt',
      user: { user_metadata: { role: 'OPERATOR' } },
      operator: { onboarding_complete: true },
    });
    renderLogin();

    preencher();
    fireEvent.click(screen.getByLabelText(t('auth.rememberDevice')));
    submeterLogin();

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard'));
    expect(login).toHaveBeenCalledWith('ana@hotel.cv', 'segredo123');
    expect(setRememberDevice).toHaveBeenCalledWith(true);
  });

  it('login com sucesso sem onboarding vai para o onboarding', async () => {
    login.mockResolvedValue({
      access_token: 'tk', refresh_token: 'rt',
      user: { user_metadata: { role: 'OPERATOR' } },
      operator: { onboarding_complete: false },
    });
    renderLogin();

    preencher();
    submeterLogin();

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/onboarding'));
    expect(setRememberDevice).toHaveBeenCalledWith(false);
  });
});
