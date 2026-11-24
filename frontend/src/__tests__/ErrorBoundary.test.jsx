/* O ecra de erro da aplicacao segue a lingua do painel; em pt le como antes. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import ErrorBoundary from '../components/ErrorBoundary';
import useUiStore from '../store/uiStore';
import { portuguesNoEcra } from './helpers/portuguesNoEcra';

function Rebenta() {
  throw new Error('Boom interno');
}

beforeEach(() => {
  /* o React regista o erro apanhado; aqui e esperado */
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  useUiStore.setState({ lang: 'pt' });
});

describe('ErrorBoundary', () => {
  it('em pt le como antes', () => {
    useUiStore.setState({ lang: 'pt' });
    render(<ErrorBoundary><Rebenta /></ErrorBoundary>);
    expect(screen.getByText('Algo correu mal')).toBeInTheDocument();
    expect(screen.getByText('Ocorreu um erro inesperado na aplicação.')).toBeInTheDocument();
    expect(screen.getByText('Boom interno')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recarregar a página' })).toBeInTheDocument();
  });

  it('em ingles nao deixa portugues; a mensagem tecnica do erro fica como veio', () => {
    useUiStore.setState({ lang: 'en' });
    render(<ErrorBoundary><Rebenta /></ErrorBoundary>);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('An unexpected error occurred in the application.')).toBeInTheDocument();
    expect(screen.getByText('Boom interno')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload the page' })).toBeInTheDocument();
    expect(portuguesNoEcra(['Boom interno'])).toEqual([]);
  });

  it('sem erro mostra os filhos', () => {
    render(<ErrorBoundary><p>tudo bem</p></ErrorBoundary>);
    expect(screen.getByText('tudo bem')).toBeInTheDocument();
  });
});
