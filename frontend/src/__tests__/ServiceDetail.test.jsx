/* Ficha de um servico na pagina publica (/book/:slug/servico/:id): carrega o servico, mostra o
   "nao encontrado", muda o titulo do separador e aplica a cor da marca do operador.
   O modo widget tem o seu ficheiro (ServiceDetailWidget.test.jsx): fica guardado no modulo. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ServiceDetail from '../pages/ServiceDetail';
import { TONS } from '../utils/brandPalette';

/* O mapa (react-leaflet) nao corre em jsdom: fica uma caixa simples */
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="mapa">{children}</div>,
  TileLayer: () => null,
  Marker: ({ children }) => <div data-testid="marcador">{children}</div>,
  Popup: ({ children }) => <div>{children}</div>,
}));

const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };
const raiz = () => document.documentElement;

const UNIDADE = {
  id: 'u1', name: 'Passeio de buggy', description: 'Descubra a ilha de buggy.', unit_type: 'tour', base_price: 45, capacity: 8,
  images: [], pricing_rules: [], created_at: '2020-01-01T00:00:00Z', status: 'active',
};
function operador(extra = {}) {
  return {
    id: 'op1', name: 'Sal Aventura', slug: 'demo', operator_type: 'activity', business_name: 'Sal Aventura', currency: 'EUR',
    cover_images: [], page_config: {}, ...extra,
  };
}

function resposta(corpo, ok = true) { return Promise.resolve({ ok, json: () => Promise.resolve(corpo) }); }

/* Rede falsa: a ficha, as avaliacoes e a sessao de viajante (sem sessao). */
function simularRede({ op = operador(), unit = UNIDADE, ficha } = {}) {
  global.fetch = vi.fn((url) => {
    const u = String(url);
    if (u.includes('/traveler-auth/session')) return resposta({}, false);
    if (u.endsWith('/units/u1/reviews')) return resposta({ data: [] });
    if (u.endsWith('/units/u1')) return resposta(ficha ?? { data: { unit, operator: op, related: [], recent_bookings: 0 } });
    return resposta({ data: [] });
  });
}

function montar() {
  return render(
    <MemoryRouter initialEntries={['/book/demo/servico/u1']} future={FUTURE}>
      <Routes><Route path="/book/:slug/servico/:id" element={<ServiceDetail />} /></Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('sd-lang', 'pt');
  Element.prototype.scrollTo = vi.fn();
  window.scrollTo = vi.fn();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  TONS.forEach((t) => raiz().style.removeProperty(`--brand-${t}-rgb`));
  vi.restoreAllMocks();
});

describe('ServiceDetail: ponto de encontro', () => {
  const comMeta = (meta, extra = {}) => ({ ...UNIDADE, description: JSON.stringify({ desc_pt: 'Passeio', ...meta }), ...extra });

  it('mostra_ponto_de_encontro_com_link_do_mapa', async () => {
    simularRede({ unit: comMeta({ meeting_point: 'Marina' }, { lat: 16.6, lng: -22.9 }) });
    montar();
    expect(await screen.findByText('Ponto de encontro')).toBeInTheDocument();
    expect(screen.getByText('Marina', { selector: 'p' })).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /Abrir no Google Maps/ });
    expect(link).toHaveAttribute('href', 'https://www.google.com/maps/search/?api=1&query=16.6,-22.9');
    expect(link).toHaveAttribute('target', '_blank');
    expect(screen.getByTestId('marcador')).toBeInTheDocument();
    /* com o ponto marcado, a seccao generica (morada do operador sobre uma foto) sai */
    expect(screen.queryByText('Localização')).toBeNull();
  });

  it('so_texto_sem_link', async () => {
    simularRede({ unit: comMeta({ meeting_point: 'Hotel Riu' }) });
    montar();
    expect(await screen.findByText('Ponto de encontro')).toBeInTheDocument();
    expect(screen.getByText('Hotel Riu')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Abrir no Google Maps/ })).toBeNull();
    expect(screen.queryByTestId('mapa')).toBeNull();
    expect(screen.getByText('Localização')).toBeInTheDocument();
  });

  it('so_coordenadas_sem_texto', async () => {
    simularRede({ unit: comMeta({}, { lat: 16.6, lng: -22.9 }) });
    montar();
    expect(await screen.findByText('Ponto de encontro', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Abrir no Google Maps/ })).toBeInTheDocument();
  });

  it('sem_nada_nao_mostra_seccao', async () => {
    simularRede({ unit: comMeta({}) });
    montar();
    expect(await screen.findByText('Passeio de buggy', { selector: 'h1' })).toBeInTheDocument();
    expect(screen.queryByText('Ponto de encontro')).toBeNull();
  });

  it('paragens_a_zero_nao_ganham_mapa', async () => {
    simularRede({ unit: comMeta({ stops: [{ name: 'Murdeira', lat: 0, lng: 0 }, { name: 'Espargos', lat: 0, lng: 0 }] }) });
    montar();
    expect(await screen.findByText('Murdeira')).toBeInTheDocument();
    expect(screen.queryByTestId('mapa')).toBeNull();
  });

  it('so_paragens_em_cabo_verde_no_mapa', async () => {
    simularRede({ unit: comMeta({ stops: [{ name: 'Murdeira', lat: 0, lng: 0 }, { name: 'Shark Bay', lat: 16.6, lng: -22.9 }] }) });
    montar();
    expect((await screen.findAllByText('Shark Bay')).length).toBeGreaterThan(0);
    expect(screen.getByTestId('mapa')).toBeInTheDocument();
    expect(screen.getAllByTestId('marcador')).toHaveLength(1);
  });

  it('em_ingles', async () => {
    localStorage.setItem('sd-lang', 'en');
    simularRede({ unit: comMeta({ meeting_point: 'Marina' }, { lat: 16.6, lng: -22.9 }) });
    montar();
    expect(await screen.findByText('Meeting point')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open in Google Maps/ })).toBeInTheDocument();
  });
});

describe('ServiceDetail: carregamento', () => {
  it('injecta_e_remove_jsonld', async () => {
    simularRede();
    const { unmount } = montar();
    await waitFor(() => expect(document.getElementById('sd-jsonld')).not.toBeNull());
    const j = JSON.parse(document.getElementById('sd-jsonld').textContent);
    expect(j).toMatchObject({ '@type': 'Product', name: 'Passeio de buggy', offers: { price: 45, priceCurrency: 'EUR' } });
    expect(j.url).toMatch(/\/book\/demo\/servico\/u1$/);
    expect(j).not.toHaveProperty('aggregateRating');
    unmount();
    expect(document.getElementById('sd-jsonld')).toBeNull();
  });

  it('jsonld_so_usa_a_classificacao_propria_da_experiencia', async () => {
    simularRede();
    const base = global.fetch;
    /* avaliacoes de fallback do operador: ha lista, mas a experiencia nao tem classificacao propria */
    global.fetch = vi.fn((url) => String(url).endsWith('/units/u1/reviews')
      ? resposta({ data: [{ id: 'r1', rating: 5, comment: 'Otimo', created_at: '2026-11-01', author_name: 'Ana' }], scope: 'operator', unit_rating: null })
      : base(url));
    const { unmount } = montar();
    await waitFor(() => expect(document.getElementById('sd-jsonld')).not.toBeNull());
    expect(JSON.parse(document.getElementById('sd-jsonld').textContent)).not.toHaveProperty('aggregateRating');
    unmount();
    global.fetch = vi.fn((url) => String(url).endsWith('/units/u1/reviews')
      ? resposta({ data: [], scope: 'unit', unit_rating: { avg: 4.6, count: 25 } })
      : base(url));
    montar();
    await waitFor(() => expect(document.getElementById('sd-jsonld')).not.toBeNull());
    expect(JSON.parse(document.getElementById('sd-jsonld').textContent).aggregateRating).toEqual({ '@type': 'AggregateRating', ratingValue: 4.6, reviewCount: 25 });
  });

  it('servico_inexistente_nao_deixa_jsonld', async () => {
    simularRede({ ficha: { data: null } });
    montar();
    expect(await screen.findByText('Serviço não encontrado')).toBeInTheDocument();
    expect(document.getElementById('sd-jsonld')).toBeNull();
  });

  it('pede o servico e as avaliacoes certos e mostra o nome do servico', async () => {
    simularRede();
    montar();
    expect((await screen.findAllByText('Passeio de buggy')).length).toBeGreaterThan(0);
    const urls = global.fetch.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.endsWith('/public/demo/units/u1'))).toBe(true);
    expect(urls.some((u) => u.endsWith('/public/demo/units/u1/reviews'))).toBe(true);
  });

  it('o titulo do separador e "servico — operador · SalDesk"', async () => {
    simularRede();
    montar();
    await waitFor(() => expect(document.title).toBe('Passeio de buggy — Sal Aventura · SalDesk'));
  });

  it('um servico que nao existe mostra "Serviço não encontrado"', async () => {
    simularRede({ ficha: { data: {} } });
    montar();
    expect(await screen.findByText('Serviço não encontrado')).toBeInTheDocument();
  });

  it('se o pedido falhar tambem mostra "Serviço não encontrado" (sem rebentar)', async () => {
    global.fetch = vi.fn((url) => String(url).includes('/traveler-auth/session') ? resposta({}, false) : Promise.reject(new Error('sem rede')));
    montar();
    expect(await screen.findByText('Serviço não encontrado')).toBeInTheDocument();
  });

  it('na versao inglesa o "nao encontrado" fica em ingles', async () => {
    localStorage.setItem('sd-lang', 'en');
    simularRede({ ficha: { data: {} } });
    montar();
    expect(await screen.findByText('Service not found')).toBeInTheDocument();
  });

  it('fora do modo widget a ficha tem barra de navegacao e rodape', async () => {
    simularRede();
    montar();
    await screen.findAllByText('Passeio de buggy');
    expect(document.querySelector('nav')).not.toBeNull();
    expect(document.querySelector('footer')).not.toBeNull();
  });
});

describe('ServiceDetail: cor da marca', () => {
  it('aplica a cor do operador e remove-a ao sair da pagina', async () => {
    simularRede({ op: operador({ brand_color: '#c2410c' }) });
    const { unmount } = montar();
    await waitFor(() => expect(raiz().style.getPropertyValue('--brand-700-rgb')).toBe('194 65 12'));
    unmount();
    expect(raiz().style.getPropertyValue('--brand-700-rgb')).toBe('');
  });

  it('sem cor definida nao mexe nas variaveis', async () => {
    simularRede({ op: operador({ brand_color: null }) });
    montar();
    await screen.findAllByText('Passeio de buggy');
    expect(raiz().style.getPropertyValue('--brand-700-rgb')).toBe('');
  });
});
