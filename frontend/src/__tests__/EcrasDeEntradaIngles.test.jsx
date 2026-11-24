/* Os dois ecras de passagem (entrada na demonstracao e entrada como operador, do fundador) seguem a lingua do painel. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DemoEntry from '../pages/DemoEntry';
import ImpersonateCallback from '../pages/ImpersonateCallback';
import useUiStore from '../store/uiStore';
import { demoLogin } from '../services/authService';
import { portuguesNoEcra, chavesCruas } from './helpers/portuguesNoEcra';

vi.mock('../services/authService', () => ({ demoLogin: vi.fn() }));
vi.mock('../lib/supabaseImpersonateClient', () => ({
  default: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}));

const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };
const noRouter = (el) => render(<MemoryRouter future={FUTURE}>{el}</MemoryRouter>);

beforeEach(() => {
  localStorage.removeItem('sd-lang');
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: true, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  localStorage.removeItem('sd-lang');
  useUiStore.setState({ lang: 'pt' });
});

describe('Entrada na demonstracao', () => {
  it('a preparar e o erro seguem a lingua do painel; em pt leem-se como antes', async () => {
    demoLogin.mockReturnValue(new Promise(() => {}));
    useUiStore.setState({ lang: 'pt' });
    noRouter(<DemoEntry />);
    expect(screen.getByText('A preparar a conta de demonstração...')).toBeInTheDocument();
    cleanup();

    demoLogin.mockReset().mockRejectedValue(new Error('x'));
    noRouter(<DemoEntry />);
    expect(await screen.findByText('Demonstração indisponível')).toBeInTheDocument();
    expect(screen.getByText('Voltar a saldesk.cv')).toBeInTheDocument();
    cleanup();

    useUiStore.setState({ lang: 'en' });
    noRouter(<DemoEntry />);
    expect(await screen.findByText('Demo unavailable')).toBeInTheDocument();
    expect(screen.getByText('The demo account could not be reached right now. Please try again shortly.')).toBeInTheDocument();
    expect(screen.getByText('Back to saldesk.cv')).toBeInTheDocument();
    expect(portuguesNoEcra()).toEqual([]);
    expect(chavesCruas(['demoEntry'])).toEqual([]);
  });

  it('quem escolheu ingles no site publico continua a ler ingles', async () => {
    localStorage.setItem('sd-lang', 'en');
    useUiStore.setState({ lang: 'pt' });
    demoLogin.mockReset().mockReturnValue(new Promise(() => {}));
    noRouter(<DemoEntry />);
    expect(screen.getByText('Preparing demo account...')).toBeInTheDocument();
  });
});

describe('Entrada como operador (fundador)', () => {
  it('mostra o aviso de entrada e, passado o tempo, o erro, na lingua do painel', async () => {
    vi.useFakeTimers();
    useUiStore.setState({ lang: 'en' });
    noRouter(<ImpersonateCallback />);
    expect(screen.getByText('Signing in as operator')).toBeInTheDocument();
    expect(screen.getByText('One moment…')).toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(12500); });
    expect(screen.getByText('Could not sign in')).toBeInTheDocument();
    expect(screen.getByText('Signing in took too long. Please try again.')).toBeInTheDocument();
    expect(screen.getByText('Back to login')).toBeInTheDocument();
    expect(chavesCruas(['impersonate'])).toEqual([]);
    cleanup();

    useUiStore.setState({ lang: 'pt' });
    noRouter(<ImpersonateCallback />);
    expect(screen.getByText('A entrar como operador')).toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(12500); });
    expect(screen.getByText('Não foi possível entrar')).toBeInTheDocument();
    expect(screen.getByText('O acesso demorou demasiado tempo. Tente novamente.')).toBeInTheDocument();
  });
});
