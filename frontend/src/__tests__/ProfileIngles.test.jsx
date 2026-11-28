/* O perfil do operador segue a lingua do painel; em pt le exactamente como antes e os valores
   gravados (idioma, moeda, fuso) nao mudam com o rotulo. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Profile from '../pages/Profile';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import useUiStore from '../store/uiStore';
import { portuguesNoEcra, chavesCruas } from './helpers/portuguesNoEcra';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), put: vi.fn() } }));
vi.mock('../services/uploadService', () => ({
  uploadImage: vi.fn(), validateImageFile: vi.fn(), ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
}));

const OPERADOR = {
  id: 'op1', name: 'Sal Aventura', business_name: 'Sal Tours', language: 'pt', currency: 'EUR',
  timezone: 'Europe/Lisbon', logo_url: null, cover_images: [],
};

beforeEach(() => {
  api.put.mockReset().mockResolvedValue({ data: { data: { ...OPERADOR } } });
  useAuthStore.setState({ token: 'tok', operator: OPERADOR });
});
afterEach(() => {
  cleanup();
  useAuthStore.setState({ token: null, operator: null });
  useUiStore.setState({ lang: 'pt' });
});

function montar(lang) {
  useUiStore.setState({ lang });
  return render(<Profile />);
}

describe('Perfil do operador', () => {
  it('em ingles nao deixa portugues nem chaves por traduzir', () => {
    montar('en');
    expect(screen.getByText('Operator Profile')).toBeInTheDocument();
    expect(screen.getByText('Cover Photos')).toBeInTheDocument();
    expect(screen.getByText('Business information')).toBeInTheDocument();
    expect(screen.getByText('Save changes')).toBeInTheDocument();
    expect(screen.getByText('Time zone')).toBeInTheDocument();
    expect(portuguesNoEcra(['Português', 'Nederlands', 'Deutsch', 'Escudo', 'Sal Aventura'])).toEqual([]);
    expect(chavesCruas(['profile', 'accountOptions', 'imageUploader'])).toEqual([]);
  });

  it('em alemao e neerlandes mostra os textos da lingua', () => {
    montar('de');
    expect(screen.getByText('Betreiberprofil')).toBeInTheDocument();
    cleanup();
    montar('nl');
    expect(screen.getByText('Operatorprofiel')).toBeInTheDocument();
    expect(chavesCruas(['profile', 'accountOptions'])).toEqual([]);
  });

  it('em pt le como antes', () => {
    montar('pt');
    for (const txt of ['Perfil do Operador', 'Informações públicas do seu negócio', 'Logotipo', 'Fotos de Capa',
      'Informações do negócio', 'Configurações', 'Idioma padrão', 'Moeda', 'Fuso horário', 'Guardar alterações',
      'EUR — Euro', 'CVE — Escudo', 'USD — Dolar', 'Cabo Verde (UTC-1)', 'Lisboa (UTC+0/+1)', 'Londres (UTC+0/+1)',
      'Português', 'English', 'Deutsch', 'Nederlands', 'JPG, PNG, WebP — max 5MB']) {
      expect(screen.getByText(txt)).toBeInTheDocument();
    }
    expect(screen.getByText('Nome legal')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ex: Zy Tours Sal')).toBeInTheDocument();
  });

  it('em ingles grava os valores de sempre: idioma, moeda e fuso nao mudam com o rotulo', async () => {
    const { container } = montar('en');
    const selects = container.querySelectorAll('select');
    expect([...selects[0].options].map((o) => o.value)).toEqual(['pt', 'en', 'de', 'nl']);
    expect([...selects[1].options].map((o) => o.value)).toEqual(['EUR', 'CVE', 'USD']);
    expect([...selects[2].options].map((o) => o.value)).toEqual(['Atlantic/Cape_Verde', 'Europe/Lisbon', 'Europe/London']);
    expect([...selects[1].options].map((o) => o.textContent)).toEqual(['EUR — Euro', 'CVE — Escudo', 'USD — Dollar']);
    fireEvent.change(selects[1], { target: { value: 'USD' } });
    fireEvent.click(screen.getByText('Save changes'));
    await waitFor(() => expect(api.put).toHaveBeenCalled());
    const corpo = api.put.mock.calls[0][1];
    expect(corpo).toMatchObject({ currency: 'USD', language: 'pt', timezone: 'Europe/Lisbon' });
    expect(await screen.findByText('Saved!')).toBeInTheDocument();
  });
});

describe('Perfil do operador: estilo Mare', () => {
  const fichas = (el) => el.className.split(/\s+/);

  it('mostra_o_eyebrow_da_area_Configuracao', () => {
    const { container } = montar('pt');
    expect(container.querySelector('[data-eyebrow]')).toHaveTextContent('Configuração');
  });

  it('os_blocos_sao_cartoes_Mare_com_titulo_h2', () => {
    montar('pt');
    ['Logotipo', 'Fotos de Capa', 'Informações do negócio', 'Configurações'].forEach((t) => {
      const h2 = screen.getByText(t, { selector: 'h2' });
      const cartao = h2.closest('section');
      ['bg-white', 'rounded-[18px]', 'border', 'border-mare-card', 'min-w-0'].forEach((c) => expect(fichas(cartao)).toContain(c));
      ['font-display', 'text-lg', 'font-semibold', 'text-ocean-900'].forEach((c) => expect(fichas(h2)).toContain(c));
    });
    expect(screen.queryAllByRole('heading', { level: 3 })).toHaveLength(0);
  });

  it('os_campos_continuam_ligados_as_etiquetas_e_a_grelha_tem_recurso_para_o_telemovel', () => {
    montar('pt');
    [/^Nome legal/, 'Telefone', 'Idioma padrão', 'Moeda', 'Fuso horário'].forEach((n) => expect(screen.getByLabelText(n)).toBeInTheDocument());
    expect(fichas(screen.getByLabelText('Telefone').closest('.grid'))).toEqual(expect.arrayContaining(['grid-cols-1', 'sm:grid-cols-2']));
    expect(fichas(screen.getByLabelText('Moeda').closest('.grid'))).toEqual(expect.arrayContaining(['grid-cols-1', 'sm:grid-cols-3']));
  });

  it('o_botao_da_camara_tem_44px_no_telemovel_e_anel_de_foco', () => {
    const { container } = montar('pt');
    const camara = container.querySelector('button.rounded-full');
    expect(fichas(camara)).toEqual(expect.arrayContaining(['w-11', 'h-11', 'md:w-8', 'md:h-8', 'focus-visible:ring-sand-500']));
  });
});
