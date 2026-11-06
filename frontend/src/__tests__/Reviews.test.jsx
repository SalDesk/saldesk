import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Reviews from '../pages/Reviews';
import api from '../services/api';

/* Sem rede: so o cliente HTTP e simulado */
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

  it('o subtitulo e as estatisticas mostram total, media, distribuicao, respondidas e publicas', async () => {
    await abre();
    expect(screen.getByText('4.2')).toBeInTheDocument();
    expect(screen.getByText('12 avaliacoes')).toBeInTheDocument();
    /* "Respondidas" tambem e uma opcao do filtro: o rotulo das estatisticas e o <span> */
    const rotulo = (texto) => screen.getAllByText(texto).find(e => e.tagName === 'SPAN');
    expect(rotulo('Respondidas').nextElementSibling.textContent).toBe('1/ 12');
    expect(rotulo('Publicas').nextElementSibling.textContent).toBe('3');
    expect(screen.getByText('sem resposta')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
  });

  it('cada avaliacao mostra privacidade, servico, cliente, comentario e resposta', async () => {
    await abre();
    expect(screen.getAllByText('Publica').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Privada').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Buggy Tour').some(e => e.tagName === 'SPAN')).toBe(true);
    expect(screen.getByText('Ana · CV')).toBeInTheDocument();
    expect(screen.getByText('Cliente anonimo')).toBeInTheDocument();
    expect(screen.getByText('Sem comentario')).toBeInTheDocument();
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

  it('o filtro de estrelas mostra so essa nota e a contagem acompanha', async () => {
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

  it('o filtro de estrelas e um grupo de botoes com aria-pressed', async () => {
    await abre();
    expect(estrelas(0)).toHaveAttribute('aria-pressed', 'true');
    expect(estrelas(5)).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(estrelas(5));
    expect(estrelas(5)).toHaveAttribute('aria-pressed', 'true');
    expect(estrelas(0)).toHaveAttribute('aria-pressed', 'false');
  });

  it('o filtro de servico lista os servicos e filtra pela unidade da reserva', async () => {
    await abre();
    const sel = screen.getByDisplayValue('Todos os servicos');
    expect([...sel.options].map(o => o.textContent)).toEqual(['Todos os servicos', 'Buggy Tour', 'Mergulho']);
    fireEvent.change(sel, { target: { value: 'u1' } });
    expect(screen.getByText('1 resultado(s)')).toBeInTheDocument();
    expect(screen.getByText('Excelente passeio')).toBeInTheDocument();
  });

  it('sem servicos (ou se o pedido falhar) nao ha filtro de servico', async () => {
    servicos({ unitsFalha: true });
    await abre();
    expect(screen.queryByDisplayValue('Todos os servicos')).not.toBeInTheDocument();
  });

  it('o filtro de resposta mostra as sem resposta (publicas) ou as respondidas', async () => {
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

  it('a pesquisa procura no comentario e no nome do cliente', async () => {
    await abre();
    const campo = screen.getByPlaceholderText('Pesquisar...');
    fireEvent.change(campo, { target: { value: 'atraso' } });
    expect(screen.getByText('1 resultado(s)')).toBeInTheDocument();
    fireEvent.change(campo, { target: { value: 'joao' } });
    expect(screen.getByText('Muito bom')).toBeInTheDocument();
    expect(screen.getByText('1 resultado(s)')).toBeInTheDocument();
  });

  it('pagina de 10 em 10: "Carregar mais" mostra o resto e mudar um filtro volta a primeira pagina', async () => {
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

  it('"Responder" so aparece nas publicas sem resposta', async () => {
    await abre();
    expect(screen.getAllByRole('button', { name: 'Responder' })).toHaveLength(2);
  });

  it('responder envia a resposta e actualiza o cartao e a contagem', async () => {
    await abre();
    fireEvent.click(screen.getAllByRole('button', { name: 'Responder' })[0]);
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('Responder avaliacao')).toBeInTheDocument();
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
    expect(screen.getByText('Nenhuma avaliacao encontrada')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(screen.getByText('12 resultado(s)')).toBeInTheDocument();
    expect(campo.value).toBe('');
  });

  it('sem nenhuma avaliacao mostra o vazio sem "Limpar filtros"', async () => {
    servicos({ reviews: [], stats: { average: 0, total: 0, distribution: [] } });
    await abre('0 no total · 0 sem resposta');
    expect(screen.getByText('Nenhuma avaliacao encontrada')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Limpar filtros' })).not.toBeInTheDocument();
    expect(screen.getByText('Todas respondidas')).toBeInTheDocument();
  });
});
