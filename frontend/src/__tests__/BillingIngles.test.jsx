/* As paginas de retorno do pagamento seguem a lingua do painel (pt, en, de, nl) e em pt leem como antes. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BillingSuccess from '../pages/BillingSuccess';
import BillingCancel from '../pages/BillingCancel';
import api from '../services/api';
import { confirmSubscription } from '../services/billingService';
import useUiStore from '../store/uiStore';
import { portuguesNoEcra, chavesCruas } from './helpers/portuguesNoEcra';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), put: vi.fn() } }));
vi.mock('../services/billingService', () => ({ confirmSubscription: vi.fn() }));

const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };
function montarSucesso(lang, url) {
  useUiStore.setState({ lang });
  return render(<MemoryRouter future={FUTURE} initialEntries={[url]}><BillingSuccess /></MemoryRouter>);
}

beforeEach(() => {
  api.get.mockReset().mockResolvedValue({ data: { data: { operator: { id: 'op1' } } } });
  confirmSubscription.mockReset().mockResolvedValue({});
});
afterEach(() => {
  cleanup();
  useUiStore.setState({ lang: 'pt' });
});

describe('Pagamento concluido', () => {
  it('em pt le como antes', async () => {
    montarSucesso('pt', '/billing/success?gateway=sisp');
    expect(await screen.findByText('Pagamento confirmado!')).toBeInTheDocument();
    expect(screen.getByText('A tua subscrição SalDesk está agora activa.')).toBeInTheDocument();
    expect(screen.getByText('Voltar a Facturação')).toBeInTheDocument();
  });

  it('em ingles, alemao e neerlandes nao deixa portugues', async () => {
    montarSucesso('en', '/billing/success?gateway=sisp');
    expect(await screen.findByText('Payment confirmed!')).toBeInTheDocument();
    expect(screen.getByText('Back to Billing')).toBeInTheDocument();
    expect(portuguesNoEcra()).toEqual([]);
    cleanup();
    montarSucesso('de', '/billing/success?gateway=sisp');
    expect(await screen.findByText('Zahlung bestätigt!')).toBeInTheDocument();
    expect(chavesCruas(['billingResult'])).toEqual([]);
    cleanup();
    montarSucesso('nl', '/billing/success?gateway=sisp');
    expect(await screen.findByText('Betaling bevestigd!')).toBeInTheDocument();
  });

  it('o erro tambem segue a lingua', async () => {
    montarSucesso('en', '/billing/success');
    expect(await screen.findByText('Could not confirm payment')).toBeInTheDocument();
    expect(screen.getByText('If the payment was completed, it will be applied shortly. Otherwise, try again.')).toBeInTheDocument();
    expect(portuguesNoEcra()).toEqual([]);
    cleanup();
    montarSucesso('pt', '/billing/success');
    expect(await screen.findByText('Não foi possível confirmar o pagamento')).toBeInTheDocument();
  });

  it('segue a lingua do painel e nao so o localStorage', async () => {
    localStorage.setItem('sd-lang', 'pt');
    montarSucesso('en', '/billing/success?gateway=sisp');
    expect(await screen.findByText('Payment confirmed!')).toBeInTheDocument();
    localStorage.removeItem('sd-lang');
  });
});

describe('Pagamento nao concluido', () => {
  function montarCancel(lang) {
    useUiStore.setState({ lang });
    return render(<MemoryRouter future={FUTURE}><BillingCancel /></MemoryRouter>);
  }

  it('em pt le como antes', () => {
    montarCancel('pt');
    expect(screen.getByText('Pagamento não concluído')).toBeInTheDocument();
    expect(screen.getByText('Cancelaste o pagamento. Não houve qualquer cobrança e o teu plano não foi alterado.')).toBeInTheDocument();
    expect(screen.getByText('Voltar a Facturação')).toBeInTheDocument();
  });

  it('em ingles, alemao e neerlandes nao deixa portugues', () => {
    montarCancel('en');
    expect(screen.getByText('Payment not completed')).toBeInTheDocument();
    expect(portuguesNoEcra()).toEqual([]);
    cleanup();
    montarCancel('de');
    expect(screen.getByText('Zahlung nicht abgeschlossen')).toBeInTheDocument();
    cleanup();
    montarCancel('nl');
    expect(screen.getByText('Betaling niet voltooid')).toBeInTheDocument();
    expect(chavesCruas(['billingResult'])).toEqual([]);
  });
});
