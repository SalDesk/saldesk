import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AffiliatePortal from '../pages/AffiliatePortal';
import { affiliatePortalLogin } from '../services/affiliatesService';
import useUiStore from '../store/uiStore';
import { portuguesNoEcra, chavesCruas } from './helpers/portuguesNoEcra';

vi.mock('../services/affiliatesService', () => ({ affiliatePortalLogin: vi.fn() }));

const AFILIADO = {
  name: 'Ana Costa', slug: 'sal', code: 'ANA1', commission_pct: 12, bookings_count: 7,
  commission_paid: 1250.4, commission_pending: 30.2,
  payments: [{ payment_date: '2026-11-03', amount: 80.5, note: 'Pago por transferencia' }],
};
const DADOS = ['Ana Costa', 'Pago por transferencia'];

/* o idioma do browser: navigator.languages manda em initialLang */
function browserEm(idioma) {
  Object.defineProperty(navigator, 'languages', { value: [idioma], configurable: true });
  Object.defineProperty(navigator, 'language', { value: idioma, configurable: true });
}

let spyErr; let spyWarn; let aberta;
beforeEach(() => {
  spyErr = vi.spyOn(console, 'error').mockImplementation(() => {});
  spyWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  aberta = vi.spyOn(window, 'open').mockImplementation(() => null);
  /* sem nenhuma escolha de idioma guardada: o estado volta ao valor de origem e o armazenamento fica vazio */
  useUiStore.setState({ lang: 'pt' });
  localStorage.clear();
  affiliatePortalLogin.mockReset().mockResolvedValue(AFILIADO);
});
afterEach(() => {
  /* ler as contagens ANTES de restaurar os espioes */
  const erros = spyErr.mock.calls.map(c => String(c[0]).slice(0, 200));
  const avisos = spyWarn.mock.calls.map(c => String(c[0]).slice(0, 200));
  cleanup();
  vi.restoreAllMocks();
  delete navigator.languages;
  delete navigator.language;
  useUiStore.setState({ lang: 'pt' });
  localStorage.clear();
  expect(erros).toEqual([]);
  expect(avisos).toEqual([]);
});

function abrirPortal() {
  return render(
    <MemoryRouter initialEntries={['/afiliado/ana1']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes><Route path="/afiliado/:codigo" element={<AffiliatePortal />} /></Routes>
    </MemoryRouter>,
  );
}
async function entrar(botao) {
  fireEvent.change(document.querySelector('input[type="email"]'), { target: { value: 'ana@x.cv' } });
  fireEvent.click(screen.getByRole('button', { name: botao }));
  await screen.findByText('Ana Costa');
}

describe('Portal do afiliado: idioma ao abrir', () => {
  it('browser_em_ingles_sem_escolha_guardada_abre_em_ingles', () => {
    browserEm('en-GB');
    abrirPortal();
    expect(screen.getByText('Sign in to the portal')).toBeInTheDocument();
    expect(screen.getByText('Affiliate portal')).toBeInTheDocument();
    expect(screen.getByText('Affiliate code:')).toBeInTheDocument();
    expect(screen.getByText('ANA1')).toBeInTheDocument();
    expect(screen.getByText('Registered email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('your@email.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByText('Not an affiliate yet? Contact the operator to get your credentials.')).toBeInTheDocument();
    expect(useUiStore.getState().lang).toBe('en');
    expect(portuguesNoEcra()).toEqual([]);
    expect(chavesCruas(['affiliatePortal'])).toEqual([]);
  });

  it('browser_em_portugues_sem_escolha_guardada_abre_em_portugues', () => {
    browserEm('pt-PT');
    abrirPortal();
    expect(screen.getByText('Entrar no portal')).toBeInTheDocument();
    expect(screen.getByText('Portal do Afiliado')).toBeInTheDocument();
    expect(screen.getByText('Código de afiliado:')).toBeInTheDocument();
    expect(screen.getByText('Email registado')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('o-seu@email.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
    expect(screen.getByText('Ainda não es afiliado? Contacta o operador para obter as tuas credenciais.')).toBeInTheDocument();
    expect(useUiStore.getState().lang).toBe('pt');
  });

  it('o_seletor_do_cabecalho_muda_o_idioma_e_a_escolha_passa_a_valer_ao_reabrir', () => {
    browserEm('en-GB');
    abrirPortal();
    expect(screen.getByText('Sign in to the portal')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'pt' }));
    expect(screen.getByText('Entrar no portal')).toBeInTheDocument();
    expect(screen.queryByText('Sign in to the portal')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'en' }));
    expect(screen.getByText('Sign in to the portal')).toBeInTheDocument();
    /* escolha explicita: PT guardado vence o browser em ingles na visita seguinte */
    fireEvent.click(screen.getByRole('button', { name: 'pt' }));
    cleanup();
    abrirPortal();
    expect(screen.getByText('Entrar no portal')).toBeInTheDocument();
  });

  it('o_idioma_escolhido_no_site_publico_vence_o_do_browser', () => {
    browserEm('en-GB');
    localStorage.setItem('sd-lang', 'pt');
    abrirPortal();
    expect(screen.getByText('Entrar no portal')).toBeInTheDocument();
  });

  it('um_idioma_ja_guardado_no_painel_nao_e_substituido_pelo_do_browser', () => {
    browserEm('en-GB');
    useUiStore.setState({ lang: 'de' });
    /* o Zustand ja gravou 'saldesk-ui'; o setItem so garante o formato lido pelo portal */
    localStorage.setItem('saldesk-ui', JSON.stringify({ state: { lang: 'de' }, version: 0 }));
    abrirPortal();
    expect(screen.getByText('Im Portal anmelden')).toBeInTheDocument();
  });
});

describe('Portal do afiliado: painel apos entrar', () => {
  it('em_ingles_mostra_os_valores_nos_formatos_do_ingles_e_o_texto_do_cliente_em_portugues', async () => {
    browserEm('en-GB');
    abrirPortal();
    await entrar('Sign in');
    expect(affiliatePortalLogin).toHaveBeenCalledWith('ana1', 'ana@x.cv');
    expect(screen.getByText('Welcome')).toBeInTheDocument();
    expect(screen.getByText('12% commission per booking')).toBeInTheDocument();
    const valor = (rotulo) => screen.getByText(rotulo).previousSibling.textContent;
    expect(valor('Bookings generated')).toBe('7');
    expect(valor('Commission paid')).toBe('€1,250');
    expect(valor('Commission pending')).toBe('€30');
    expect(valor('Estimated total')).toBe('€1,281');
    expect(screen.getByText('Your affiliate link')).toBeInTheDocument();
    expect(screen.getByText('https://saldesk.cv/book/sal?ref=ANA1')).toBeInTheDocument();
    expect(screen.getByText('Payment history')).toBeInTheDocument();
    expect(screen.getByText('03/11/2026')).toBeInTheDocument();
    expect(screen.getByText('€80.50')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    expect(portuguesNoEcra(DADOS)).toEqual([]);
    expect(chavesCruas(['affiliatePortal'])).toEqual([]);
    /* a mensagem para os contactos do afiliado e texto para clientes: fica em portugues */
    fireEvent.click(screen.getByRole('button', { name: 'WhatsApp' }));
    expect(aberta).toHaveBeenCalledWith(
      `https://wa.me/?text=${encodeURIComponent('Reserve o seu tour com desconto: https://saldesk.cv/book/sal?ref=ANA1')}`,
      '_blank', 'noopener',
    );
  });

  it('em_portugues_continua_como_sempre_foi', async () => {
    browserEm('pt-PT');
    abrirPortal();
    await entrar('Entrar');
    expect(screen.getByText('Bem-vindo')).toBeInTheDocument();
    expect(screen.getByText('12% de comissão por reserva')).toBeInTheDocument();
    const valor = (rotulo) => screen.getByText(rotulo).previousSibling.textContent;
    expect(valor('Reservas geradas')).toBe('7');
    expect(valor('Comissão paga')).toBe('€1250');
    expect(valor('Comissão pendente')).toBe('€30');
    expect(valor('Total estimado')).toBe('€1281');
    expect(screen.getByText('O teu link de afiliado')).toBeInTheDocument();
    expect(screen.getByText('Histórico de pagamentos')).toBeInTheDocument();
    expect(screen.getByText('03/11/2026')).toBeInTheDocument();
    expect(screen.getByText('€80.50')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copiar link' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'WhatsApp' }));
    expect(aberta).toHaveBeenCalledWith(
      `https://wa.me/?text=${encodeURIComponent('Reserve o seu tour com desconto: https://saldesk.cv/book/sal?ref=ANA1')}`,
      '_blank', 'noopener',
    );
  });

  it('credenciais_erradas_mostram_o_erro_no_idioma_do_ecra', async () => {
    browserEm('en-GB');
    affiliatePortalLogin.mockRejectedValue(new Error('401'));
    abrirPortal();
    fireEvent.change(document.querySelector('input[type="email"]'), { target: { value: 'x@x.cv' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Invalid email or code. Check your details and try again.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'pt' }));
    expect(screen.getByText('Email ou código inválido. Verifique os dados e tente novamente.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Entrar' })).not.toBeDisabled());
  });
});
