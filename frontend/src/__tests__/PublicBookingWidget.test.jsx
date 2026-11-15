/* Widget embebido (?widget=1): so o nome do operador e a lista de servicos com "Reservar" (ou, num
   restaurante, o formulario de reserva de mesa). Ficheiro proprio: o modo widget fica guardado no
   modulo e nao pode contaminar os testes da pagina normal. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import PublicBooking from '../pages/PublicBooking';

const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };

const UNIDADES = [
  { id: 'u1', name: 'Passeio de buggy', description: 'Descubra a ilha de buggy.', unit_type: 'tour', base_price: 45, capacity: 8, images: [], pricing_rules: [], created_at: '2020-01-01T00:00:00Z' },
  { id: 'u2', name: 'Mergulho', description: 'Mergulho com instrutor.', unit_type: 'tour', base_price: 60, capacity: 4, images: [], pricing_rules: [], created_at: '2020-01-01T00:00:00Z' },
];

function operador(extra = {}) {
  return {
    id: 'op1', name: 'Sal Aventura', slug: 'demo', operator_type: 'activity', business_name: 'Sal Aventura', tagline: 'Passeios e aventura no Sal',
    description: 'Operador de actividades na ilha do Sal.', whatsapp: '+2389999999', email: 'ola@demo.cv', phone: '+238999',
    currency: 'EUR', cover_images: [], page_config: {}, onboarding_complete: true, brand_color: null, ...extra,
  };
}

function simularRede(op, units) {
  global.fetch = vi.fn((url) => {
    const u = String(url);
    if (u.endsWith('/public/demo')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: { operator: op, units } }) });
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) });
  });
}

function montar() {
  return render(
    <MemoryRouter initialEntries={['/book/demo?widget=1']} future={FUTURE}>
      <Routes>
        <Route path="/book/:slug" element={<PublicBooking />} />
        <Route path="/book/:slug/servico/:id" element={<p>PAGINA DO SERVICO</p>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('sd-lang', 'pt'); /* sem isto o idioma segue o do browser do teste (ingles) */
  Element.prototype.scrollTo = vi.fn();
  window.scrollTo = vi.fn();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('PublicBooking em modo widget', () => {
  it('mostra o nome do operador e um cartao por servico com os botoes Reservar', async () => {
    simularRede(operador(), UNIDADES);
    montar();
    expect(await screen.findByRole('heading', { name: 'Sal Aventura' })).toBeInTheDocument();
    expect(screen.getByText('Passeio de buggy')).toBeInTheDocument();
    expect(screen.getByText('Mergulho')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Reservar/ })).toHaveLength(2);
  });

  it('Reservar abre a pagina do servico escolhido', async () => {
    simularRede(operador(), UNIDADES);
    montar();
    const cartao = (await screen.findByText('Mergulho')).closest('div.bg-white');
    fireEvent.click(within(cartao).getByRole('button', { name: /Reservar/ }));
    expect(await screen.findByText('PAGINA DO SERVICO')).toBeInTheDocument();
  });

  it('nao mostra hero, galeria, avaliacoes, FAQ, contacto, chat nem WhatsApp', async () => {
    simularRede(operador(), UNIDADES);
    montar();
    await screen.findByText('Passeio de buggy');
    ['Galeria', 'Avaliações', 'Contacto', 'Perguntas Frequentes', 'Reservar Agora', 'Sobre Nós', 'Os Nossos Serviços'].forEach((t) => {
      expect(screen.queryByText(t)).not.toBeInTheDocument();
    });
    expect(document.querySelector('a[href*="wa.me"]')).toBeNull();
    expect(document.querySelector('.fixed')).toBeNull(); // sem chat nem botoes flutuantes
    expect(document.querySelector('nav')).toBeNull();
    expect(document.querySelector('section#galeria, section#avaliacoes, section#contacto')).toBeNull();
  });

  it('mantem o rodape "Tecnologia SalDesk"', async () => {
    simularRede(operador(), UNIDADES);
    montar();
    await screen.findByText('Passeio de buggy');
    expect(screen.getByRole('link', { name: 'SalDesk' })).toHaveAttribute('href', 'https://saldesk.cv');
  });

  it('o seletor de moeda muda os precos e o de idioma muda o texto dos botoes', async () => {
    simularRede(operador(), UNIDADES);
    montar();
    await screen.findByText('Passeio de buggy');
    expect(screen.getByText('€45')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'CVE' }));
    expect(screen.queryByText('€45')).not.toBeInTheDocument();
    expect(screen.getAllByText(/CVE/).length).toBeGreaterThan(1);
    fireEvent.click(screen.getByRole('button', { name: 'EN' }));
    expect(screen.getAllByRole('button', { name: /Book/ })).toHaveLength(2);
  });

  it('sem servicos mostra uma mensagem em vez de uma lista vazia', async () => {
    simularRede(operador(), []);
    montar();
    expect(await screen.findByText('De momento não há serviços disponíveis.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reservar/ })).not.toBeInTheDocument();
  });

  it('um restaurante mostra o formulario de reserva de mesa e nao a grelha de servicos', async () => {
    simularRede(operador({ operator_type: 'restaurant', name: 'Bar do Porto' }), UNIDADES);
    montar();
    expect(await screen.findByRole('heading', { name: 'Bar do Porto' })).toBeInTheDocument();
    expect(await screen.findByText('Reservar mesa')).toBeInTheDocument();
    expect(screen.queryByText('Passeio de buggy')).not.toBeInTheDocument();
  });
});
