import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Reviews from '../pages/Reviews';
import api from '../services/api';

/* Sem rede: so o cliente HTTP e simulado */
import useUiStore from '../store/uiStore';
import { portuguesNoEcra, chavesCruas } from './helpers/portuguesNoEcra';
vi.mock('../services/api', () => ({ default: { get: vi.fn(), put: vi.fn() } }));

const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };

function avaliacao(id, over) {
  return {
    id, rating: 5, comment: `Filler ${id}`, created_at: '2026-03-01T10:00:00Z', is_public: false, reply_text: null, replied_at: null,
    customers: { name: 'Cliente', country_code: 'PT' }, reservations: null, ...over,
  };
}

/* r1: publica sem resposta (a unica que conta como "sem resposta"); r2: respondida; r3: privada, sem cliente;
   r4: publica sem comentario; r5..r12: privadas de enchimento (5 estrelas) */
const R1 = avaliacao('r1', { rating: 5, comment: 'Excelente passeio', created_at: '2026-03-12T10:00:00Z', is_public: true,
  customers: { name: 'Ana', country_code: 'CV' }, reservations: { units: { id: 'u1', name: 'Buggy Tour' } } });
const R2 = avaliacao('r2', { rating: 4, comment: 'Muito bom', created_at: '2026-03-11T10:00:00Z', is_public: true,
  reply_text: 'Obrigado pela visita', replied_at: '2026-03-12T10:00:00Z', customers: { name: 'Joao', country_code: 'PT' },
  reservations: { units: { id: 'u2', name: 'Mergulho' } } });
const R3 = avaliacao('r3', { rating: 2, comment: 'Atraso', created_at: '2026-03-10T10:00:00Z', is_public: false, customers: null });
const R4 = avaliacao('r4', { rating: 3, comment: null, created_at: '2026-03-09T10:00:00Z', is_public: true });
const ENCHIMENTO = Array.from({ length: 8 }, (_, i) => avaliacao(`r${i + 5}`, { created_at: `2026-03-0${8 - i}T10:00:00Z` }));
const TODAS = [R1, R2, R3, R4, ...ENCHIMENTO];

const STATS = {
  average: 4.2, total: 12,
  distribution: [{ rating: 5, count: 9 }, { rating: 4, count: 1 }, { rating: 3, count: 1 }, { rating: 2, count: 1 }],
};
const UNIDADES = [{ id: 'u1', name: 'Buggy Tour' }, { id: 'u2', name: 'Mergulho' }];

describe('Reviews', () => {
  let errSpy;
  let warnSpy;

  beforeEach(() => {
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    servicos();
    api.put.mockReset().mockImplementation(async (url, corpo) => ({
      data: { data: { ...R1, ...corpo, replied_at: '2026-03-13T10:00:00Z' } },
    }));
  });

  afterEach(() => {
    cleanup();
    /* a guarda conta ANTES de restaurar os espioes */
    const erros = errSpy.mock.calls.length;
    const avisos = warnSpy.mock.calls.length;
    errSpy.mockRestore();
    warnSpy.mockRestore();
    expect(erros).toBe(0);
    expect(avisos).toBe(0);
  });

  function servicos({ reviews = TODAS, stats = STATS, units = UNIDADES, unitsFalha = false } = {}) {
    api.get.mockReset().mockImplementation(async (url) => {
      if (url === '/reviews') return { data: { data: reviews } };
      if (url === '/reviews/stats') return { data: { data: stats } };
      if (url === '/units') {
        if (unitsFalha) throw new Error('rede');
        return { data: { data: units } };
      }
      throw new Error(`pedido inesperado: ${url}`);
    });
  }

  async function abre(subtitulo = '12 no total · 1 sem resposta') {
    render(
      <MemoryRouter future={FUTURE}>
        <Reviews />
      </MemoryRouter>
    );
    await screen.findByText(subtitulo);
  }

  /* "a precede b" no documento */
  function antes(a, b) {
    return !!(screen.getByText(a).compareDocumentPosition(screen.getByText(b)) & Node.DOCUMENT_POSITION_FOLLOWING);
  }
  function estrelas(n) {
    return screen.getByRole('button', { name: n === 0 ? 'Todas' : `${n}★` });
  }

  it('o subtítulo e as estatísticas mostram total, média, distribuição, respondidas e públicas', async () => {
    await abre();
    expect(screen.getByText('4.2')).toBeInTheDocument();
    expect(screen.getByText('12 avaliações')).toBeInTheDocument();
    /* "Respondidas" tambem e uma opcao do filtro: o rotulo das estatisticas e o <span> */
    const rotulo = (texto) => screen.getAllByText(texto).find(e => e.tagName === 'SPAN');
    expect(rotulo('Respondidas').nextElementSibling.textContent).toBe('1/ 12');
    expect(rotulo('Públicas').nextElementSibling.textContent).toBe('3');
    expect(screen.getAllByText('Sem resposta').some(e => e.closest('article'))).toBe(true);
    expect(screen.getByText('9')).toBeInTheDocument();
  });

  it('cada avaliação mostra privacidade, serviço, cliente, comentário e resposta', async () => {
    await abre();
    expect(screen.getAllByText('Pública').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Privada').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Buggy Tour').some(e => e.tagName === 'SPAN')).toBe(true);
    expect(screen.getByText('Ana · CV')).toBeInTheDocument();
    expect(screen.getByText('Cliente anonimo')).toBeInTheDocument();
    expect(screen.getByText('Sem comentário')).toBeInTheDocument();
    expect(screen.getByText('Resposta do operador')).toBeInTheDocument();
    expect(screen.getByText('Obrigado pela visita')).toBeInTheDocument();
  });

  it('por omissao ordena das mais recentes e as outras ordenacoes funcionam', async () => {
    await abre();
    expect(antes('Excelente passeio', 'Atraso')).toBe(true);
    const ordenar = screen.getByDisplayValue('Mais recentes');
    expect([...ordenar.options].map(o => o.textContent)).toEqual(['Mais recentes', 'Mais antigas', 'Melhor nota', 'Pior nota']);
    fireEvent.change(ordenar, { target: { value: 'worst' } });
    expect(antes('Atraso', 'Excelente passeio')).toBe(true);
    /* por melhor nota a de 2 estrelas fica em 12.o lugar, fora da primeira pagina */
    fireEvent.change(ordenar, { target: { value: 'best' } });
    expect(screen.getByText('Excelente passeio')).toBeInTheDocument();
    expect(screen.queryByText('Atraso')).not.toBeInTheDocument();
  });

  it('o filtro de estrelas mostra só essa nota e a contagem acompanha', async () => {
    await abre();
    expect(screen.getByText('12 resultado(s)')).toBeInTheDocument();
    fireEvent.click(estrelas(2));
    expect(screen.getByText('1 resultado(s)')).toBeInTheDocument();
    expect(screen.getByText('Atraso')).toBeInTheDocument();
    expect(screen.queryByText('Excelente passeio')).not.toBeInTheDocument();
    fireEvent.click(estrelas(5));
    expect(screen.getByText('9 resultado(s)')).toBeInTheDocument();
    fireEvent.click(estrelas(0));
    expect(screen.getByText('12 resultado(s)')).toBeInTheDocument();
  });

  it('o filtro de estrelas e um grupo de botões com aria-pressed', async () => {
    await abre();
    expect(estrelas(0)).toHaveAttribute('aria-pressed', 'true');
    expect(estrelas(5)).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(estrelas(5));
    expect(estrelas(5)).toHaveAttribute('aria-pressed', 'true');
    expect(estrelas(0)).toHaveAttribute('aria-pressed', 'false');
  });

  it('o filtro de serviço lista os serviços e filtra pela unidade da reserva', async () => {
    await abre();
    const sel = screen.getByDisplayValue('Todos os serviços');
    expect([...sel.options].map(o => o.textContent)).toEqual(['Todos os serviços', 'Buggy Tour', 'Mergulho']);
    fireEvent.change(sel, { target: { value: 'u1' } });
    expect(screen.getByText('1 resultado(s)')).toBeInTheDocument();
    expect(screen.getByText('Excelente passeio')).toBeInTheDocument();
  });

  it('sem serviços (ou se o pedido falhar) não ha filtro de serviço', async () => {
    servicos({ unitsFalha: true });
    await abre();
    expect(screen.queryByDisplayValue('Todos os serviços')).not.toBeInTheDocument();
  });

  it('o filtro de resposta mostra as sem resposta (públicas) ou as respondidas', async () => {
    await abre();
    const sel = screen.getByDisplayValue('Todas');
    expect([...sel.options].map(o => o.textContent)).toEqual(['Todas', 'Sem resposta', 'Respondidas']);
    fireEvent.change(sel, { target: { value: 'pending' } });
    expect(screen.getByText('2 resultado(s)')).toBeInTheDocument();
    expect(screen.getByText('Excelente passeio')).toBeInTheDocument();
    fireEvent.change(sel, { target: { value: 'replied' } });
    expect(screen.getByText('1 resultado(s)')).toBeInTheDocument();
    expect(screen.getByText('Muito bom')).toBeInTheDocument();
  });

  it('"Ver agora" filtra as sem resposta', async () => {
    await abre();
    fireEvent.click(screen.getByRole('button', { name: 'Ver agora' }));
    expect(screen.getByDisplayValue('Sem resposta')).toBeInTheDocument();
    expect(screen.getByText('2 resultado(s)')).toBeInTheDocument();
  });

  it('a pesquisa procura no comentário e no nome do cliente', async () => {
    await abre();
    const campo = screen.getByPlaceholderText('Pesquisar...');
    fireEvent.change(campo, { target: { value: 'atraso' } });
    expect(screen.getByText('1 resultado(s)')).toBeInTheDocument();
    fireEvent.change(campo, { target: { value: 'joao' } });
    expect(screen.getByText('Muito bom')).toBeInTheDocument();
    expect(screen.getByText('1 resultado(s)')).toBeInTheDocument();
  });

  it('página de 10 em 10: "Carregar mais" mostra o resto e mudar um filtro volta a primeira página', async () => {
    await abre();
    expect(screen.getByRole('button', { name: 'Carregar mais (2 restantes)' })).toBeInTheDocument();
    expect(screen.queryByText('Filler r12')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Carregar mais (2 restantes)' }));
    expect(screen.getByText('Filler r12')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Carregar mais/ })).not.toBeInTheDocument();
    fireEvent.click(estrelas(5));
    fireEvent.click(estrelas(0));
    expect(screen.getByRole('button', { name: 'Carregar mais (2 restantes)' })).toBeInTheDocument();
  });

  it('"Responder" só aparece nas públicas sem resposta', async () => {
    await abre();
    expect(screen.getAllByRole('button', { name: 'Responder' })).toHaveLength(2);
  });

  it('responder envia a resposta e actualiza o cartão e a contagem', async () => {
    await abre();
    fireEvent.click(screen.getAllByRole('button', { name: 'Responder' })[0]);
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('Responder avaliação')).toBeInTheDocument();
    expect(within(dialogo).getByText('Excelente passeio')).toBeInTheDocument();
    const form = dialogo.querySelector('form');
    fireEvent.submit(form);
    expect(api.put).not.toHaveBeenCalled();
    fireEvent.change(within(dialogo).getByPlaceholderText(/Obrigado pela sua visita/), { target: { value: 'Obrigado!' } });
    fireEvent.submit(form);
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/reviews/r1/reply', { reply_text: 'Obrigado!' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText('Obrigado!')).toBeInTheDocument();
    expect(screen.getByText('12 no total · 0 sem resposta')).toBeInTheDocument();
    expect(screen.getByText('Todas respondidas')).toBeInTheDocument();
  });

  it('cancelar a resposta fecha o modal sem enviar', async () => {
    await abre();
    fireEvent.click(screen.getAllByRole('button', { name: 'Responder' })[0]);
    const dialogo = await screen.findByRole('dialog');
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.put).not.toHaveBeenCalled();
  });

  it('sem resultados mostra o vazio e "Limpar filtros" repoe a lista', async () => {
    await abre();
    const campo = screen.getByPlaceholderText('Pesquisar...');
    fireEvent.change(campo, { target: { value: 'zzz' } });
    expect(screen.getByText('Nenhuma avaliação encontrada')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(screen.getByText('12 resultado(s)')).toBeInTheDocument();
    expect(campo.value).toBe('');
  });

  it('sem nenhuma avaliação mostra o vazio sem "Limpar filtros"', async () => {
    servicos({ reviews: [], stats: { average: 0, total: 0, distribution: [] } });
    await abre('0 no total · 0 sem resposta');
    expect(screen.getByText('Nenhuma avaliação encontrada')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Limpar filtros' })).not.toBeInTheDocument();
    expect(screen.getByText('Todas respondidas')).toBeInTheDocument();
  });

  describe('estilo Mare', () => {
    it('o cabeçalho traz o eyebrow Clientes', async () => {
      await abre();
      expect(document.querySelector('[data-eyebrow]')).toHaveTextContent('Clientes');
    });

    it('o botão Responder e o Limpar filtros têm 44 px no telemóvel', async () => {
      await abre();
      for (const b of screen.getAllByRole('button', { name: 'Responder' })) {
        expect(b).toHaveClass('min-h-11', 'md:min-h-0', 'shrink-0');
      }
      fireEvent.change(screen.getByPlaceholderText(/Pesquisar/), { target: { value: 'zzzzzz' } });
      expect(await screen.findByRole('button', { name: 'Limpar filtros' })).toHaveClass('min-h-11', 'md:min-h-0');
    });

    it('o quadro de pendentes é um MareStat com o mesmo valor e o botão "Ver agora"', async () => {
      await abre();
      const quadro = screen.getAllByText('Sem resposta').map(e => e.closest('article')).find(Boolean);
      expect(quadro).toBeTruthy();
      expect(quadro).toHaveClass('bg-white', 'border', 'border-mare-card', 'rounded-[18px]');
      expect(quadro.querySelector('p.font-display').textContent).toBe('1');
      expect(within(quadro).getByRole('button', { name: 'Ver agora' })).toBeInTheDocument();
    });

    it('a média com a distribuição e as respondidas ficam em cartões Mare', async () => {
      await abre();
      const media = screen.getByText('4.2').closest('.border-mare-card');
      expect(media).toHaveClass('bg-white', 'border', 'border-mare-card', 'rounded-[18px]');
      expect(media.querySelector('.bg-sand-500')).not.toBeNull();
      const rotulo = screen.getAllByText('Respondidas').find(e => e.tagName === 'SPAN');
      expect(rotulo.closest('.border-mare-card')).toHaveClass('bg-white', 'rounded-[18px]');
    });

    it('cada avaliação é um cartão Mare, com datas em font-mono', async () => {
      await abre();
      const cartao = screen.getByText('Excelente passeio').closest('.border-mare-card');
      expect(cartao).toHaveClass('bg-white', 'border', 'border-mare-card', 'rounded-[18px]');
      const data = [...cartao.querySelectorAll('span')].find(s => /2026/.test(s.textContent));
      expect(data).toHaveClass('font-mono', 'tabular-nums');
      const resposta = screen.getByText('Obrigado pela visita').closest('.rounded-\\[14px\\]');
      expect(resposta).toHaveClass('bg-mare-head', 'border-mare-card');
      expect(within(resposta).getByText(/2026/)).toHaveClass('font-mono', 'tabular-nums');
    });

    it('a etiqueta pública/privada continua a ser Badge e o número da média usa font-mono', async () => {
      await abre();
      expect(screen.getAllByText('Pública')[0].closest('span')).toHaveClass('inline-flex', 'font-semibold');
      expect(screen.getByText('4.2')).toHaveClass('font-mono', 'tabular-nums');
    });

    it('sem avaliações todas as barras da distribuição ficam a 0%', async () => {
      servicos({ reviews: [], stats: { average: 0, total: 0, distribution: [] } });
      await abre('0 no total · 0 sem resposta');
      const barras = [...document.querySelectorAll('div.h-full.bg-sand-500')];
      expect(barras).toHaveLength(5);
      barras.forEach(b => expect(b.style.width).toBe('0%'));
    });

    it('o vazio fica num cartão Mare', async () => {
      servicos({ reviews: [], stats: { average: 0, total: 0, distribution: [] } });
      await abre('0 no total · 0 sem resposta');
      const vazio = screen.getByText('Nenhuma avaliação encontrada').closest('.border-mare-card');
      expect(vazio).toHaveClass('bg-white', 'rounded-[18px]');
    });
  });
});

/* ───────────────────────── painel em ingles ───────────────────────── */

describe('Reviews: painel em inglês', () => {
  let errSpy;
  let warnSpy;
  /* comentarios dos clientes e nomes dos testes: mostram-se tal e qual */
  const DADOS = ['Excelente passeio', 'Muito bom', 'Obrigado pela visita', 'Atraso', 'Cliente', 'Joao', 'Buggy Tour', 'Mergulho', 'Filler'];

  beforeEach(() => {
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    useUiStore.setState({ lang: 'en' });
    api.get.mockReset().mockImplementation(async (url) => {
      if (url === '/reviews') return { data: { data: TODAS } };
      if (url === '/reviews/stats') return { data: { data: STATS } };
      if (url === '/units') return { data: { data: UNIDADES } };
      throw new Error(`pedido inesperado: ${url}`);
    });
    api.put.mockReset().mockImplementation(async (url, corpo) => ({
      data: { data: { ...R1, ...corpo, replied_at: '2026-03-13T10:00:00Z' } },
    }));
  });

  afterEach(() => {
    cleanup();
    useUiStore.setState({ lang: 'pt' });
    const erros = errSpy.mock.calls.length;
    const avisos = warnSpy.mock.calls.length;
    errSpy.mockRestore();
    warnSpy.mockRestore();
    expect(erros).toBe(0);
    expect(avisos).toBe(0);
  });

  async function abreEn(subtitulo = '12 in total · 1 unanswered') {
    render(
      <MemoryRouter future={FUTURE}>
        <Reviews />
      </MemoryRouter>
    );
    await screen.findByText(subtitulo);
  }

  it('mostra_titulo_estatisticas_filtros_e_cartoes_em_ingles_sem_portugues', async () => {
    await abreEn();
    expect(screen.getByRole('heading', { name: 'Reviews' })).toBeInTheDocument();
    expect(screen.getByText('4.2')).toBeInTheDocument();
    expect(screen.getByText('12 reviews')).toBeInTheDocument();
    expect(screen.getAllByText('Answered')).toHaveLength(2);
    expect(screen.getByText('View now')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'All services' })).toBeInTheDocument();
    expect(screen.getAllByRole('option').map(o => o.textContent)).toEqual(expect.arrayContaining([
      'Unanswered', 'Answered', 'Most recent', 'Oldest', 'Highest rating', 'Lowest rating',
    ]));
    expect(screen.getByText('12 result(s)')).toBeInTheDocument();
    expect(screen.getAllByText('Public').length).toBeGreaterThan(1);
    expect(screen.getAllByText('Private').length).toBeGreaterThan(0);
    expect(screen.getByText('Operator reply')).toBeInTheDocument();
    expect(screen.getByText('No comment')).toBeInTheDocument();
    expect(screen.getAllByText('Reply')).toHaveLength(2);
    /* data em formato ingles; o comentario do cliente aparece tal e qual */
    expect(screen.getAllByText('12 Mar 2026').length).toBeGreaterThan(0);
    expect(screen.getByText('Excelente passeio')).toBeInTheDocument();
    expect(portuguesNoEcra(DADOS)).toEqual([]);
    expect(chavesCruas(['reviewsPage'])).toEqual([]);
  });

  it('a_nota_media_usa_o_separador_decimal_da_lingua', async () => {
    useUiStore.setState({ lang: 'de' });
    await abreEn('12 insgesamt · 1 unbeantwortet');
    expect(screen.getByText('4,2')).toBeInTheDocument();
  });

  it('responder_em_ingles_traduz_o_modal_mantem_a_sugestao_em_portugues_e_envia_o_texto_escrito', async () => {
    await abreEn();
    fireEvent.click(screen.getAllByRole('button', { name: 'Reply' })[0]);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Reply to review')).toBeInTheDocument();
    const caixa = screen.getByLabelText(/^Your reply \(will be published\)/);
    expect(caixa.placeholder).toBe('Thank you for your visit and for your comment...');
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    fireEvent.change(caixa, { target: { value: 'Thank you for visiting' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publish reply' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/reviews/r1/reply', { reply_text: 'Thank you for visiting' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('sem_resultados_e_limpar_filtros_em_ingles', async () => {
    await abreEn();
    fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: 'zzz' } });
    expect(screen.getByText('No reviews found')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByText('12 result(s)')).toBeInTheDocument();
  });

  it('carregar_mais_em_ingles', async () => {
    await abreEn();
    expect(screen.getByRole('button', { name: 'Load more (2 remaining)' })).toBeInTheDocument();
  });
});
