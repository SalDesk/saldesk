/* Pagina completa de actividade (/book/:slug/servico/:id com operator_type 'activity'): cabecalho,
   galeria, factos, menu de seccoes e seccoes so com dados reais. Alojamento fica como sempre.
   Spec: docs/superpowers/specs/2026-11-21-pagina-servico-completa-design.md */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ServiceDetail from '../pages/ServiceDetail';

/* O mapa (react-leaflet) nao corre em jsdom: fica uma caixa simples, como em ServiceDetail.test.jsx */
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="mapa">{children}</div>,
  TileLayer: () => null,
  Marker: ({ children }) => <div data-testid="marcador">{children}</div>,
  Popup: ({ children }) => <div>{children}</div>,
}));

const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };
const MENU = 'Secções da página';

const UNIDADE = {
  id: 'u1', name: 'Passeio de buggy', description: '', unit_type: 'tour', base_price: 45, capacity: null,
  images: [], pricing_rules: [], created_at: '2020-01-01T00:00:00Z', status: 'active',
};
function operador(extra = {}) {
  return {
    id: 'op1', name: 'Sal Aventura', slug: 'demo', operator_type: 'activity', currency: 'EUR',
    cover_images: [], page_config: {}, islands: { name: 'Sal', slug: 'sal' }, ...extra,
  };
}
const comMeta = (meta, extra = {}) => ({ ...UNIDADE, description: JSON.stringify(meta), ...extra });

function resposta(corpo, ok = true) { return Promise.resolve({ ok, json: () => Promise.resolve(corpo) }); }

function simularRede({ op = operador(), unit = UNIDADE, reviews = [], related = [] } = {}) {
  global.fetch = vi.fn((url) => {
    const u = String(url);
    if (u.includes('/traveler-auth/session')) return resposta({}, false);
    if (u.endsWith('/units/u1/reviews')) return resposta({ data: reviews });
    if (u.endsWith('/units/u1')) return resposta({ data: { unit, operator: op, related, recent_bookings: 0 } });
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

const titulosDasSeccoes = () => within(screen.getByTestId('seccoes-actividade'))
  .getAllByRole('heading', { level: 2 }).map((h) => h.textContent);

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('sd-lang', 'pt');
  Element.prototype.scrollTo = vi.fn();
  window.scrollTo = vi.fn();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Pagina de actividade', () => {
  it('seccoes_sem_dados_nao_aparecem', async () => {
    simularRede();
    montar();
    expect(await screen.findByRole('heading', { level: 1, name: 'Passeio de buggy' })).toBeInTheDocument();
    for (const nome of ['Destaques', 'O que levar', 'Perguntas frequentes']) {
      expect(screen.queryByRole('heading', { name: nome })).toBeNull();
      expect(screen.queryByRole('link', { name: nome })).toBeNull();
    }
  });

  it('todas_as_seccoes_com_dados', async () => {
    const meta = {
      desc_pt: 'Um dia inteiro pela ilha.',
      highlights_pt: 'Salinas de Pedra de Lume\nOlho Azul',
      included_items: [{ label: 'Almoço', included: true }, { label: 'Bebidas', included: false }],
      stops: [{ name: 'Pedra de Lume', desc: 'Salinas na cratera' }],
      what_to_bring_pt: 'Protector solar',
      meeting_point: 'Marina de Santa Maria',
    };
    simularRede({
      unit: comMeta(meta),
      op: operador({
        free_cancellation_hours: 24,
        custom_faqs: [{ question_pt: 'Há transporte?', answer_pt: 'Sim, desde o hotel.' }],
      }),
      reviews: [{ id: 'r1', rating: 5, comment: 'Excelente', created_at: '2026-11-01', author_name: 'Ana' }],
      related: [{ id: 'u2', name: 'Mergulho na Baía', images: [], base_price: 60 }],
    });
    montar();
    await screen.findByRole('heading', { level: 1, name: 'Passeio de buggy' });
    const ordem = ['Destaques', 'Descrição', 'O que está incluído', 'Itinerário', 'O que levar',
      'Ponto de encontro', 'Políticas', 'Avaliações', 'Perguntas frequentes', 'Outros serviços'];
    expect(titulosDasSeccoes()).toEqual(ordem);
    const menu = screen.getByRole('navigation', { name: MENU });
    const links = within(menu).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(ordem);
    expect(links.map((l) => l.getAttribute('href'))).toEqual(
      ['#destaques', '#descricao', '#incluido', '#itinerario', '#levar', '#encontro', '#politicas', '#avaliacoes', '#perguntas', '#outros']);
    expect(document.getElementById('destaques')).not.toBeNull();
    expect(screen.getByText('Olho Azul')).toBeInTheDocument();
    expect(screen.getByText('Bebidas')).toBeInTheDocument();
    expect(screen.getByText('Protector solar')).toBeInTheDocument();
  });

  it('factos_mostram_saidas_e_grupo', async () => {
    simularRede({ unit: comMeta({ time_slots: [{ time: '09:00' }, { time: '14:00' }] }, { capacity: 20 }) });
    montar();
    expect(await screen.findByText('09:00 · 14:00')).toBeInTheDocument();
    expect(screen.getByText('Até 20 pessoas')).toBeInTheDocument();
    expect(screen.getByText('Saídas')).toBeInTheDocument();
  });

  it('ler_tudo_abre_descricao_longa', async () => {
    simularRede({ unit: comMeta({ desc_pt: 'Um passeio longo pela costa da ilha. '.repeat(30) }) });
    montar();
    const botao = await screen.findByRole('button', { name: 'Ler tudo' });
    expect(botao).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(botao);
    expect(screen.getByRole('button', { name: 'Ler menos' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('descricao_curta_sem_ler_tudo', async () => {
    simularRede({ unit: comMeta({ desc_pt: 'Curto.' }) });
    montar();
    expect(await screen.findByRole('heading', { name: 'Descrição' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ler tudo' })).toBeNull();
  });

  it('galeria_abre_e_fecha_com_esc', async () => {
    simularRede({ unit: { ...UNIDADE, images: ['a.jpg', 'b.jpg', 'c.jpg'] } });
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir foto 1 de 3' }));
    const visor = screen.getByRole('dialog');
    expect(within(visor).getByText('1 / 3')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(within(visor).getByText('2 / 3')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('galeria_mostra_mais_fotos_na_ultima', async () => {
    simularRede({ unit: { ...UNIDADE, images: ['1.jpg', '2.jpg', '3.jpg', '4.jpg', '5.jpg', '6.jpg', '7.jpg'] } });
    montar();
    expect(await screen.findByText('+2 fotos')).toBeInTheDocument();
  });

  it('hotel_continua_igual', async () => {
    simularRede({
      op: operador({ operator_type: 'hotel' }),
      unit: { ...UNIDADE, name: 'Quarto duplo', description: 'Quarto com vista mar.', capacity: 2 },
    });
    montar();
    expect(await screen.findByRole('heading', { level: 1, name: 'Quarto duplo' })).toBeInTheDocument();
    expect(screen.getByText('Sobre este serviço')).toBeInTheDocument();
    expect(screen.getByText('Política de cancelamento', { selector: 'p' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: MENU })).toBeNull();
    expect(screen.queryByTestId('seccoes-actividade')).toBeNull();
  });

  it('perguntas_do_operador', async () => {
    simularRede({
      op: operador({
        custom_faqs: [
          { question_pt: 'Há transporte?', answer_pt: 'Sim, desde o hotel.', question_en: 'Is there transport?', answer_en: 'Yes.' },
          { question_pt: 'Posso levar crianças?', answer_pt: 'A partir dos 6 anos.' },
        ],
      }),
    });
    montar();
    expect(await screen.findByRole('heading', { name: 'Perguntas frequentes' })).toBeInTheDocument();
    const pergunta = screen.getByRole('button', { name: 'Há transporte?' });
    expect(pergunta).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Sim, desde o hotel.')).not.toBeVisible();
    fireEvent.click(pergunta);
    expect(pergunta).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Sim, desde o hotel.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Posso levar crianças?' })).toBeInTheDocument();
  });

  it('cabecalho_com_ilha_classificacao_propria_e_chips', async () => {
    simularRede({
      unit: comMeta({ duration: 4, pickup_included: true, short_pt: 'A ilha numa manhã.' }),
      op: operador({ free_cancellation_hours: 48, auto_confirm_bookings: true }),
    });
    const base = global.fetch;
    global.fetch = vi.fn((url) => (String(url).endsWith('/units/u1/reviews')
      ? resposta({ data: [], scope: 'unit', unit_rating: { avg: 4.6, count: 25 } })
      : base(url)));
    montar();
    await screen.findByRole('heading', { level: 1, name: 'Passeio de buggy' });
    const migalhas = screen.getByRole('navigation', { name: 'Caminho' });
    expect(within(migalhas).getByRole('link', { name: 'Discover' })).toHaveAttribute('href', 'https://saldesk.cv/discover/');
    expect(within(migalhas).getByText('Sal')).toBeInTheDocument();
    expect(screen.getByText('A ilha numa manhã.')).toBeInTheDocument();
    expect(screen.getByText('(25 avaliações)')).toBeInTheDocument();
    expect(screen.getByText('Cancelamento grátis até 48 h antes')).toBeInTheDocument();
    expect(screen.getByText('Confirmação imediata')).toBeInTheDocument();
    expect(screen.getByText('Recolha no hotel incluída')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Partilhar/ })).toBeInTheDocument();
  });

  it('coluna_de_reserva_abre_o_modal_de_hoje', async () => {
    simularRede();
    montar();
    const coluna = await screen.findByTestId('coluna-reserva');
    fireEvent.click(within(coluna).getByRole('button', { name: /Ver disponibilidade/ }));
    expect(await screen.findByText('Passo 1 de 3')).toBeInTheDocument();
  });

  it('em_ingles_usa_titulos_e_nome_em_ingles', async () => {
    localStorage.setItem('sd-lang', 'en');
    simularRede({ unit: comMeta({ name_en: 'Buggy tour', desc_pt: 'Passeio', desc_en: 'A ride', highlights_en: 'Blue Eye' }) });
    montar();
    expect(await screen.findByRole('heading', { level: 1, name: 'Buggy tour' })).toBeInTheDocument();
    expect(titulosDasSeccoes()).toEqual(['Highlights', 'Description']);
    expect(screen.getByRole('navigation', { name: 'Page sections' })).toBeInTheDocument();
  });
});
