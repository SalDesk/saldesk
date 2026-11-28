/* A pagina Definicoes segue a lingua escolhida pelo operador (pt, en, de, nl):
   cada separador mostra os textos traduzidos e nunca uma chave de i18n por traduzir. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Settings from '../pages/Settings';
import api from '../services/api';
import { getBillingHistory } from '../services/billingService';
import { validateImageFile } from '../services/uploadService';
import useAuthStore from '../store/authStore';
import useUiStore from '../store/uiStore';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), put: vi.fn() } }));
vi.mock('../services/authService', () => ({ updateOperator: vi.fn(), changePassword: vi.fn() }));
vi.mock('../services/billingService', () => ({
  createSubscription: vi.fn(), cancelSubscription: vi.fn(), getBillingHistory: vi.fn(), createSispCheckout: vi.fn(),
}));
vi.mock('../services/uploadService', () => ({
  uploadImage: vi.fn(), validateImageFile: vi.fn(), ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
}));
vi.mock('../components/messaging/TemplatesEditor', () => ({ default: () => <div>EDITOR MENSAGENS</div> }));

const dia = (n) => new Date(Date.now() + n * 86400000).toISOString();

/* Operador com tudo o que abre blocos condicionais: chat ligado, FAQ, prazo de cancelamento, subscricao activa */
const OPERADOR = {
  id: 'op1', name: 'Sal Aventura', email: 'a@x.test', phone: '+238 111', whatsapp: '+238 222', address: 'Rua 1',
  language: 'pt', currency: 'EUR', timezone: 'Europe/Lisbon', slug: 'demo',
  plan: 'pro', plan_status: 'active', plan_paid_until: dia(20), paypal_subscription_id: 'I-1',
  description: 'Desc', cancellation_policy_pt: '', cancellation_policy_en: '', free_cancellation_hours: 48,
  custom_faqs: [{ question_pt: 'P1', question_en: 'Q1', answer_pt: 'R1', answer_en: 'A1' }],
  chat_auto_reply: { enabled: true, days: [1, 2], from: '22:00', to: '06:00', message_pt: '', message_en: '' },
  logo_url: null, notification_prefs: {}, notif_channel: 'both',
};

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  validateImageFile.mockReset().mockReturnValue(null);
  const respostas = {
    '/marketing/booking-link': { data: { data: { url: 'https://saldesk.cv/book/demo' } } },
    '/marketing/widget-code': { data: { data: { html: '<script data-slug="demo"></script>' } } },
    '/marketing/payment-settings': { data: { data: { has_paypal: true, has_paypal_webhook: false, has_sisp: false } } },
  };
  api.get.mockReset().mockImplementation(async (url) => { if (url in respostas) return respostas[url]; throw new Error('sem rota ' + url); });
  getBillingHistory.mockReset().mockResolvedValue([
    { id: 'h1', plan: 'pro', created_at: '2026-10-01T10:00:00Z', amount_eur: 69, status: 'completed' },
  ]);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  useAuthStore.setState({ token: null, operator: null });
  useUiStore.setState({ lang: 'pt' });
});

function montar(lang) {
  useUiStore.setState({ lang });
  useAuthStore.setState({ token: 'tok', operator: OPERADOR });
  return render(
    <MemoryRouter initialEntries={['/definicoes']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/definicoes" element={<Settings />} />
      </Routes>
    </MemoryRouter>,
  );
}

const separador = (rotulo) => screen.getByRole('tab', { name: rotulo });
const abrir = async (rotulo, ancora) => { fireEvent.click(separador(rotulo)); await screen.findAllByText(ancora); };

/* Nenhuma chave crua no texto visivel nem nos atributos lidos pelo utilizador ou por leitores de ecra */
function chavesCruas() {
  const textos = [document.body.textContent];
  document.body.querySelectorAll('*').forEach((el) => {
    ['aria-label', 'placeholder', 'title', 'alt'].forEach((a) => { if (el.hasAttribute(a)) textos.push(el.getAttribute(a)); });
  });
  return textos.filter((t) => /\bsettings\.[a-z]/.test(t));
}

describe('Definicoes em ingles', () => {
  it('os separadores e o titulo estao em ingles', () => {
    montar('en');
    expect(screen.getByText('Settings')).toBeInTheDocument();
    for (const rotulo of ['Account', 'Public profile', 'Payments', 'Billing', 'Notifications', 'Messages', 'Security']) {
      expect(separador(rotulo)).toBeInTheDocument();
    }
  });

  it('cada separador mostra os seus textos em ingles e nenhuma chave crua', async () => {
    montar('en');
    /* Conta (aberta por omissao) */
    expect(screen.getByText('Company details')).toBeInTheDocument();
    expect(screen.getByLabelText('Company name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Replay tour' })).toBeInTheDocument();
    expect(chavesCruas()).toEqual([]);

    await abrir('Public profile', 'Cover photos');
    expect(screen.getByText('Cancellation policy')).toBeInTheDocument();
    expect(screen.getByText('Custom FAQ')).toBeInTheDocument();
    expect(screen.getByText('Question 1')).toBeInTheDocument();
    expect(screen.getByText('Mon')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save profile' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add question' })).toBeInTheDocument();
    expect(chavesCruas()).toEqual([]);

    await abrir('Payments', 'Save credentials');
    expect(await screen.findAllByText('Configured')).not.toHaveLength(0);
    expect(screen.getAllByText('Not configured')).toHaveLength(2);
    expect(chavesCruas()).toEqual([]);

    await abrir('Billing', 'Current subscription');
    expect(screen.getByText('Payment history')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel subscription' })).toBeInTheDocument();
    expect(await screen.findByText('Paid')).toBeInTheDocument();
    expect(chavesCruas()).toEqual([]);

    await abrir('Notifications', 'Notification channel');
    expect(screen.getByText('New booking')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Both' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save preferences' })).toBeInTheDocument();
    expect(chavesCruas()).toEqual([]);

    await abrir('Messages', 'EDITOR MENSAGENS');

    await abrir('Security', 'Current password');
    expect(screen.getByText('Change password', { selector: 'h2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change password' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show new password' })).toBeInTheDocument();
    expect(chavesCruas()).toEqual([]);
  });
});

describe.each(['de', 'nl'])('Definicoes em %s', (lang) => {
  it('Conta e Perfil Publico sem chaves cruas', async () => {
    montar(lang);
    expect(screen.queryByText('Dados da empresa')).not.toBeInTheDocument();
    expect(chavesCruas()).toEqual([]);
    fireEvent.click(screen.getAllByRole('tab')[1]);
    await screen.findByTestId('previa-cor');
    expect(screen.queryByText('Fotos de capa')).not.toBeInTheDocument();
    expect(chavesCruas()).toEqual([]);
  });
});
