/* Os exemplos (placeholders) das politicas de cancelamento seguem a lingua do painel; em pt leem-se como antes. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PerfilPublicoTab from '../pages/settings/PerfilPublicoTab';
import useUiStore from '../store/uiStore';

vi.mock('../services/api', () => ({ default: { get: vi.fn().mockResolvedValue({ data: {} }) } }));
vi.mock('../services/authService', () => ({ updateOperator: vi.fn() }));
vi.mock('../components/shared/ImageUploader', () => ({ default: () => null }));

const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };
const montar = () => render(<MemoryRouter future={FUTURE}><PerfilPublicoTab operator={{ id: 'o', slug: 'demo' }} /></MemoryRouter>);

afterEach(() => { cleanup(); useUiStore.setState({ lang: 'pt' }); });

describe('Perfil publico: exemplos das politicas', () => {
  it('em pt os exemplos sao os de sempre', () => {
    useUiStore.setState({ lang: 'pt' });
    montar();
    expect(screen.getByPlaceholderText('Ex: Cancelamento gratuito até 48h antes. Após esse prazo, 50% do valor é retido...')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ex: Free cancellation up to 48h before. After that, 50% of the value is retained...')).toBeInTheDocument();
  });

  it('em ingles o exemplo da politica portuguesa vem em ingles', () => {
    useUiStore.setState({ lang: 'en' });
    montar();
    expect(screen.getByPlaceholderText('E.g. Free cancellation up to 48h before. After that, 50% of the amount is retained...')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Cancelamento gratuito/)).not.toBeInTheDocument();
  });
});
