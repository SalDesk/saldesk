/* Ficha de um servico em modo widget (?widget=1). Ficheiro proprio: o modo widget fica guardado numa
   variavel do modulo e contaminaria os testes da ficha normal (ServiceDetail.test.jsx). */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ServiceDetail from '../pages/ServiceDetail';

const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };
const UNIDADE = {
  id: 'u1', name: 'Passeio de buggy', description: 'Descubra a ilha de buggy.', unit_type: 'tour', base_price: 45, capacity: 8,
  images: [], pricing_rules: [], created_at: '2020-01-01T00:00:00Z', status: 'active',
};
const OPERADOR = { id: 'op1', name: 'Sal Aventura', slug: 'demo', operator_type: 'activity', currency: 'EUR', cover_images: [], page_config: {} };
function resposta(corpo, ok = true) { return Promise.resolve({ ok, json: () => Promise.resolve(corpo) }); }

beforeEach(() => {
  localStorage.setItem('sd-lang', 'pt');
  Element.prototype.scrollTo = vi.fn();
  window.scrollTo = vi.fn();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  global.fetch = vi.fn((url) => {
    const u = String(url);
    if (u.includes('/traveler-auth/session')) return resposta({}, false);
    if (u.endsWith('/units/u1/reviews')) return resposta({ data: [] });
    if (u.endsWith('/units/u1')) return resposta({ data: { unit: UNIDADE, operator: OPERADOR, related: [], recent_bookings: 0 } });
    return resposta({ data: [] });
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('ServiceDetail em modo widget', () => {
  it('sem navegacao nem rodape do site: so o servico, o botao Reservar Agora e a assinatura SalDesk', async () => {
    render(
      <MemoryRouter initialEntries={['/book/demo/servico/u1?widget=1']} future={FUTURE}>
        <Routes><Route path="/book/:slug/servico/:id" element={<ServiceDetail />} /></Routes>
      </MemoryRouter>
    );
    expect((await screen.findAllByText('Passeio de buggy')).length).toBeGreaterThan(0);
    expect(document.querySelector('nav')).toBeNull();
    expect(document.querySelector('footer')).toBeNull();
    expect(screen.getAllByRole('button', { name: /Reservar Agora/ }).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'SalDesk' })).toHaveAttribute('href', 'https://saldesk.cv');
  });
});
