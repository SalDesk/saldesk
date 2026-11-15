/* Pagina publica de reservas: aplica a cor da marca do operador (e so enquanto esta montada). */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import PublicBooking from '../pages/PublicBooking';
import { TONS } from '../utils/brandPalette';

const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };
const raiz = () => document.documentElement;

function operador(extra = {}) {
  return {
    id: 'op1', name: 'Sal Aventura', slug: 'demo', operator_type: 'activity', business_name: 'Sal Aventura', tagline: 'Passeios', description: 'Descricao',
    currency: 'EUR', cover_images: [], page_config: {}, onboarding_complete: true, ...extra,
  };
}

function simularRede(op, units = []) {
  global.fetch = vi.fn((url) => {
    const u = String(url);
    if (u.endsWith('/public/demo')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: { operator: op, units } }) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) });
  });
}

function montar() {
  return render(
    <MemoryRouter initialEntries={['/book/demo']} future={FUTURE}>
      <Routes><Route path="/book/:slug" element={<PublicBooking />} /></Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  Element.prototype.scrollTo = vi.fn();
  window.scrollTo = vi.fn();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  TONS.forEach((t) => raiz().style.removeProperty(`--brand-${t}-rgb`));
  vi.restoreAllMocks();
});

describe('PublicBooking: cor da marca', () => {
  it('aplica a cor do operador quando a pagina carrega e remove-a ao sair', async () => {
    simularRede(operador({ brand_color: '#c2410c' }));
    const { unmount } = montar();
    await waitFor(() => expect(raiz().style.getPropertyValue('--brand-700-rgb')).toBe('194 65 12'));
    unmount();
    expect(raiz().style.getPropertyValue('--brand-700-rgb')).toBe('');
  });

  it('sem ?widget=1 a pagina continua completa (nav, servicos com filtros, rodape e chat)', async () => {
    localStorage.setItem('sd-lang', 'pt');
    simularRede(operador({ brand_color: null }), [
      { id: 'u1', name: 'Passeio de buggy', description: 'x', unit_type: 'tour', base_price: 45, capacity: 8, images: [], pricing_rules: [], created_at: '2020-01-01T00:00:00Z' },
    ]);
    montar();
    expect(await screen.findByText('Os Nossos Serviços')).toBeInTheDocument();
    expect(document.querySelector('nav')).not.toBeNull();
    expect(document.querySelector('footer')).not.toBeNull();
    expect(screen.getByText('Filtrar')).toBeInTheDocument();
    expect(document.querySelector('button.rounded-full')).not.toBeNull(); // chat
  });

  it('sem cor definida nao define variaveis (a pagina fica com a cor original)', async () => {
    simularRede(operador({ brand_color: null }));
    montar();
    await waitFor(() => expect(screen.getAllByText('Sal Aventura').length).toBeGreaterThan(0));
    expect(raiz().style.getPropertyValue('--brand-700-rgb')).toBe('');
  });
});
