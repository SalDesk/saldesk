import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AppLoader } from '../App';
import useUiStore from '../store/uiStore';

describe('App: ecra de arranque', () => {
  afterEach(() => {
    cleanup();
    useUiStore.setState({ lang: 'pt' });
  });

  it('em portugues o indicador de carregamento diz "A carregar"', () => {
    useUiStore.setState({ lang: 'pt' });
    render(<AppLoader />);
    expect(screen.getByRole('status', { name: 'A carregar' })).toBeInTheDocument();
  });

  it('em ingles o indicador de carregamento diz "Loading"', () => {
    useUiStore.setState({ lang: 'en' });
    render(<AppLoader />);
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });
});
