/* O assistente de boas-vindas segue a lingua do painel; em pt le como antes e os valores gravados
   (tipo de operador, idioma, moeda, fuso) nao mudam com o rotulo. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Onboarding from '../pages/Onboarding';
import Step3Complete from '../components/onboarding/Step3Complete';
import useAuthStore from '../store/authStore';
import useUiStore from '../store/uiStore';
import { createOperator, updateOperator } from '../services/authService';
import { listIslands } from '../services/islandsService';
import { portuguesNoEcra, chavesCruas } from './helpers/portuguesNoEcra';

vi.mock('../services/authService', () => ({ createOperator: vi.fn(), updateOperator: vi.fn() }));
vi.mock('../services/islandsService', () => ({ listIslands: vi.fn() }));

async function montar(lang) {
  useUiStore.setState({ lang });
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: true, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }));
  const r = render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Onboarding /></MemoryRouter>,
  );
  await act(async () => {});
  return r;
}
/* Textos de marca do AuthLayout ficam fora desta tarefa; so conta o que e do assistente */
const ignorar = ['Português', 'Cabo Verde', 'Sal', 'Orgulhosamente', 'Sistema desenvolvido'];
const proximo = (nome) => fireEvent.click(screen.getByRole('button', { name: nome }));

beforeEach(() => {
  listIslands.mockReset().mockResolvedValue([{ id: 'i1', name: 'Sal' }]);
  createOperator.mockReset().mockImplementation(async (d) => ({ id: 'op1', ...d }));
  updateOperator.mockReset().mockImplementation(async (d) => ({ id: 'op1', ...d }));
  useAuthStore.setState({ token: 'tok', user: { id: 'u1' }, operator: null });
});
afterEach(() => {
  cleanup();
  useAuthStore.setState({ token: null, user: null, operator: null });
  useUiStore.setState({ lang: 'pt' });
});

describe('Assistente de boas-vindas', () => {
  it('em ingles percorre os passos sem portugues e grava os valores de sempre', async () => {
    await montar('en');
    expect(screen.getByText('Business type')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Hotel / Guesthouse'));
    proximo('Continue');
    expect(await screen.findByText('Business details')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('E.g. Sal Kite Center')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Santa Maria, Sal Island')).toBeInTheDocument();
    expect(portuguesNoEcra(ignorar)).toEqual([]);
    fireEvent.change(screen.getByPlaceholderText('E.g. Sal Kite Center'), { target: { value: 'Sal Kite' } });
    proximo('Continue');
    await waitFor(() => expect(createOperator).toHaveBeenCalled());
    expect(createOperator.mock.calls[0][0]).toMatchObject({ operator_type: 'hotel', name: 'Sal Kite', user_id: 'u1' });

    expect(await screen.findByText('Identity')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Describe your business in 2-3 sentences...')).toBeInTheDocument();
    expect(screen.getByText('PNG, JPG, WebP — max 2MB')).toBeInTheDocument();
    expect(portuguesNoEcra(ignorar)).toEqual([]);
    proximo('Continue');

    expect(await screen.findByText('Language, currency and booking link')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('o-meu-negocio')).toBeInTheDocument();
    expect(screen.getByText(/o-seu-negocio/)).toBeInTheDocument();
    expect(portuguesNoEcra(ignorar)).toEqual([]);
    const moeda = screen.getByText('Currency').closest('div').querySelector('select');
    expect([...moeda.options].map((o) => o.value)).toEqual(['EUR', 'CVE', 'USD']);
    expect([...moeda.options].map((o) => o.textContent)).toEqual(['EUR — Euro', 'CVE — Escudo', 'USD — Dollar']);
    fireEvent.change(screen.getByPlaceholderText('o-meu-negocio'), { target: { value: 'sal-kite' } });
    proximo('Continue');

    expect(await screen.findByText('All set!')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getAllByText('Hotel / Guesthouse').length).toBeGreaterThan(0);
    expect(portuguesNoEcra(ignorar)).toEqual([]);
    expect(chavesCruas(['onboarding', 'accountOptions', 'register'])).toEqual([]);
    proximo('Go to Dashboard');
    await waitFor(() => expect(updateOperator).toHaveBeenCalledTimes(3));
    expect(updateOperator.mock.calls[2][0]).toMatchObject({ onboarding_complete: true, operator_type: 'hotel', currency: 'EUR', language: 'pt', timezone: 'Atlantic/Cape_Verde', slug: 'sal-kite' });
  });

  it('o erro do logotipo (ficheiro grande) segue a lingua', async () => {
    const { container } = await montar('en');
    fireEvent.click(screen.getByText('Hotel / Guesthouse'));
    proximo('Continue');
    await screen.findByText('Business details');
    proximo('Continue');
    await screen.findByText('Identity');
    const grande = new File([new Uint8Array(3 * 1024 * 1024)], 'a.png', { type: 'image/png' });
    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [grande] } });
    expect(await screen.findByText('The logo must be smaller than 2MB')).toBeInTheDocument();
  });

  it('em pt le como antes', async () => {
    await montar('pt');
    expect(screen.getByText('Tipo de negócio')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Hotel / Pensão'));
    proximo('Continuar');
    await screen.findByText('Dados do negócio');
    expect(screen.getByPlaceholderText('Ex: Sal Kite Center')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Santa Maria, Ilha do Sal')).toBeInTheDocument();
    proximo('Continuar');
    await screen.findByText('Identidade');
    expect(screen.getByPlaceholderText('Descreva o seu negócio em 2-3 frases...')).toBeInTheDocument();
    expect(screen.getByText('PNG, JPG, WebP — max 2MB')).toBeInTheDocument();
    proximo('Continuar');
    await screen.findByText('Idioma, moeda e link de reserva');
    expect(screen.getByPlaceholderText('o-meu-negocio')).toBeInTheDocument();
    expect(screen.getByText(/o-seu-negocio/)).toBeInTheDocument();
    expect(screen.getByText('USD — Dolar')).toBeInTheDocument();
    expect(screen.getByText('Português')).toBeInTheDocument();
    expect(screen.getByText('Atlantic/Cape Verde (UTC-1)')).toBeInTheDocument();
    proximo('Continuar');
    await screen.findByText('Tudo pronto!');
    expect(screen.getByText('Tipo')).toBeInTheDocument();
  });
});

describe('Passo de conclusao (Step3Complete)', () => {
  it('segue a lingua e em pt le como antes', () => {
    useUiStore.setState({ lang: 'pt' });
    render(<Step3Complete onContinue={() => {}} />);
    expect(screen.getByText('Tudo pronto!')).toBeInTheDocument();
    expect(screen.getByText('O seu perfil de operador foi criado com sucesso. Comece por adicionar as suas unidades.')).toBeInTheDocument();
    expect(screen.getByText('Ir para o dashboard')).toBeInTheDocument();
    cleanup();
    useUiStore.setState({ lang: 'en' });
    render(<Step3Complete onContinue={() => {}} />);
    expect(screen.getByText('Go to the dashboard')).toBeInTheDocument();
    expect(portuguesNoEcra()).toEqual([]);
  });
});
