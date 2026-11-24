import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Feedback from '../pages/Feedback';
import api from '../services/api';
import { listReservations } from '../services/reservationsService';

/* Sem rede: so o cliente HTTP e as reservas sao simulados */
import useUiStore from '../store/uiStore';
import { portuguesNoEcra, chavesCruas } from './helpers/portuguesNoEcra';
vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
vi.mock('../services/reservationsService', () => ({ listReservations: vi.fn() }));

const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };

function dia(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString('en-CA');
}

function reserva(id, unitId, nome, checkOut, over) {
  return { id, unit_id: unitId, units: { name: nome }, customers: { name: `Cliente ${id}` }, check_out: checkOut, ...over };
}

/* u1 Buggy Tour: 2 reservas, 1 avaliada (50%); u2 Mergulho: 4 reservas, 1 avaliada (25%); u3 Kitesurf: 5 sem avaliacao (0%) */
const RESERVAS = [
  reserva('a1', 'u1', 'Buggy Tour', dia(-12)),
  reserva('a2', 'u1', 'Buggy Tour', dia(-2), { customers: null, customer_name: 'Rui Direto' }),
  reserva('a3', 'u2', 'Mergulho', dia(-8)),
  reserva('a4', 'u2', 'Mergulho', dia(-5)),
  reserva('a5', 'u2', 'Mergulho', dia(-10)),
  reserva('a6', 'u2', 'Mergulho', dia(-1)),
  ...[7, 8, 9, 10, 11].map(i => reserva(`a${i}`, 'u3', 'Kitesurf', dia(-20 - i))),
];
const AVALIACOES = [
  { id: 'v1', reservation_id: 'a1', rating: 5 },
  { id: 'v2', reservation_id: 'a3', rating: 4 },
];

describe('Feedback', () => {
  let errSpy;
  let warnSpy;

  beforeEach(() => {
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    listReservations.mockReset().mockResolvedValue(RESERVAS);
    api.post.mockReset().mockResolvedValue({});
    api.put.mockReset().mockResolvedValue({});
    servicos();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    /* a guarda conta ANTES de restaurar os espioes */
    const erros = errSpy.mock.calls.length;
    const avisos = warnSpy.mock.calls.length;
    errSpy.mockRestore();
    warnSpy.mockRestore();
    expect(erros).toBe(0);
    expect(avisos).toBe(0);
  });

  function servicos({ avaliacoes = AVALIACOES, template = null, falha = false, automatico = true } = {}) {
    api.get.mockReset().mockImplementation(async (url) => {
      if (falha) throw new Error('rede');
      if (url === '/reviews') return { data: { data: avaliacoes } };
      if (url === '/reviews/template') return { data: { data: template } };
      if (url === '/reviews/settings') return { data: { data: { review_auto_request: automatico } } };
      throw new Error(`pedido inesperado: ${url}`);
    });
  }

  async function abre() {
    render(
      <MemoryRouter future={FUTURE}>
        <Feedback />
      </MemoryRouter>
    );
    await screen.findByText('Tours realizados');
    await waitFor(() => expect(document.querySelector('.animate-spin')).toBeNull());
  }
  function kpi(rotulo) {
    return screen.getByText(rotulo).previousElementSibling.textContent;
  }
  function separador(texto) {
    fireEvent.click(screen.getByText(texto));
  }
  function linhas() {
    return within(screen.getByRole('table')).getAllByRole('row').slice(1);
  }
  function campo(etiqueta) {
    const label = screen.getAllByText(etiqueta).find(e => e.tagName === 'LABEL');
    expect(label).toBeTruthy();
    return label.nextElementSibling;
  }
  /* o cartao de um tour: o ascendente do nome que tambem tem a taxa de resposta */
  function cartaoDe(nome) {
    let el = screen.getByText(nome);
    while (el.parentElement && !within(el).queryByText('taxa resposta')) el = el.parentElement;
    return el;
  }

  it('os KPIs mostram tours, avaliações, taxa de resposta e média', async () => {
    await abre();
    expect(kpi('Tours realizados')).toBe('11');
    expect(kpi('Avaliações recebidas')).toBe('2');
    expect(kpi('Taxa de resposta')).toBe('18%');
    expect(kpi('Média geral')).toBe('4.5 / 5');
  });

  it('"Por Tour" agrupa por unidade, ordena por total e mostra taxa e média', async () => {
    await abre();
    const nomes = screen.getAllByText(/^(Kitesurf|Mergulho|Buggy Tour)$/).map(e => e.textContent);
    expect(nomes).toEqual(['Kitesurf', 'Mergulho', 'Buggy Tour']);
    const buggy = cartaoDe('Buggy Tour');
    expect(within(buggy).getByText('50%')).toBeInTheDocument();
    expect(within(buggy).getByText('5.0')).toBeInTheDocument();
    expect(within(cartaoDe('Mergulho')).getByText('25%')).toBeInTheDocument();
    expect(within(cartaoDe('Mergulho')).getByText('4.0')).toBeInTheDocument();
    expect(within(cartaoDe('Kitesurf')).getByText('0%')).toBeInTheDocument();
    /* sem avaliacoes nao ha estrelas */
    expect(within(cartaoDe('Kitesurf')).queryByText(/^\d\.\d$/)).not.toBeInTheDocument();
  });

  it('a cor da taxa tem três níveis: 50 ou mais, 25 ou mais e abaixo', async () => {
    await abre();
    const classe = (nome, taxa) => within(cartaoDe(nome)).getByText(taxa).className;
    const alta = classe('Buggy Tour', '50%');
    const media = classe('Mergulho', '25%');
    const baixa = classe('Kitesurf', '0%');
    expect(new Set([alta, media, baixa]).size).toBe(3);
  });

  it('"Pendentes" só lista reservas sem avaliação, da checkout mais recente para a mais antiga', async () => {
    await abre();
    expect(screen.getByText('Pendentes (9)')).toBeInTheDocument();
    separador('Pendentes (9)');
    expect(screen.getByText('9 reserva(s) sem pedido de avaliação enviado.')).toBeInTheDocument();
    const cab = within(screen.getByRole('table')).getAllByRole('columnheader').map(c => c.textContent);
    expect(cab).toEqual(['Cliente', 'Tour', 'Checkout', 'Dias desde checkout', '']);
    expect(linhas()).toHaveLength(9);
    const primeiras = linhas().slice(0, 4).map(l => within(l).getAllByRole('cell').map(c => c.textContent).slice(0, 2));
    expect(primeiras).toEqual([['Cliente a6', 'Mergulho'], ['Rui Direto', 'Buggy Tour'], ['Cliente a4', 'Mergulho'], ['Cliente a5', 'Mergulho']]);
  });

  it('os dias desde o checkout mudam de cor aos 3 e aos 7 dias', async () => {
    /* 23:30 locais: num fuso com offset negativo (Cabo Verde, UTC-1) a data UTC ja rodou para o dia seguinte */
    const noite = new Date();
    noite.setHours(23, 30, 0, 0);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(noite);
    await abre();
    separador('Pendentes (9)');
    const dias = linhas().slice(0, 4).map(l => within(l).getAllByRole('cell')[3].querySelector('span'));
    /* os dias contam-se a partir da meia-noite UTC da data de checkout, como na pagina */
    const esperados = [-1, -2, -5, -10].map(n => `${Math.floor((Date.now() - Date.parse(`${dia(n)}T00:00:00Z`)) / 86400000)}d`);
    expect(dias.map(d => d.textContent)).toEqual(esperados);
    expect(dias[0].className).toBe(dias[1].className);
    expect(new Set([dias[1].className, dias[2].className, dias[3].className]).size).toBe(3);
  });

  it('"Reenviar pedido" envia o id da reserva', async () => {
    await abre();
    separador('Pendentes (9)');
    fireEvent.click(within(linhas()[0]).getByRole('button', { name: 'Reenviar pedido' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/reviews/request', { reservation_id: 'a6' }));
    await waitFor(() => expect(within(linhas()[0]).getByRole('button', { name: 'Reenviar pedido' })).not.toBeDisabled());
  });

  it('a lista de pendentes limita-se a 50', async () => {
    listReservations.mockResolvedValue(Array.from({ length: 60 }, (_, i) => reserva(`p${i}`, 'u9', 'Tour X', dia(-1 - (i % 30)))));
    servicos({ avaliacoes: [] });
    await abre();
    separador('Pendentes (60)');
    expect(linhas()).toHaveLength(50);
    expect(screen.getByText('A mostrar 50 de 60')).toBeInTheDocument();
  });

  it('sem tours e sem pendentes mostram o vazio', async () => {
    listReservations.mockResolvedValue([reserva('z1', 'u1', 'Buggy Tour', dia(-3))]);
    servicos({ avaliacoes: [{ id: 'v', reservation_id: 'z1', rating: 3 }] });
    await abre();
    separador('Pendentes (0)');
    expect(screen.getByText('Todos os tours tem avaliação solicitada.')).toBeInTheDocument();
    cleanup();
    listReservations.mockResolvedValue([]);
    servicos({ avaliacoes: [] });
    await abre();
    expect(screen.getByText('Sem tours com checkout registado.')).toBeInTheDocument();
  });

  it('o template carrega do servidor por cima da omissao e inserir uma variável acrescenta ao corpo PT', async () => {
    servicos({ template: { subject_pt: 'Assunto do servidor' } });
    await abre();
    separador('Template');
    expect(screen.getByText('Template do pedido de avaliação')).toBeInTheDocument();
    expect(campo('Assunto PT').value).toBe('Assunto do servidor');
    expect(campo('Assunto EN').value).toBe('How was it? Leave your review');
    const antes = campo('Corpo PT').value;
    fireEvent.click(screen.getByRole('button', { name: '{nome_tour}' }));
    expect(campo('Corpo PT').value).toBe(`${antes}{nome_tour}`);
  });

  it('se o template falhar usa o texto por omissao', async () => {
    servicos({ falha: true });
    listReservations.mockRejectedValue(new Error('rede'));
    await abre();
    expect(screen.getByText('Sem tours com checkout registado.')).toBeInTheDocument();
    separador('Template');
    /* modelo por omissao neutro: serve actividades, hoteis, rent-a-car e restaurantes */
    expect(campo('Assunto PT').value).toBe('Como correu? Deixe a sua avaliação');
    expect(campo('Corpo PT').value).not.toMatch(/tour/i);
    /* sem definicoes, o pedido automatico aparece ligado (a omissao do servidor) */
    expect(screen.getByRole('switch', { name: 'Pedir avaliação automaticamente no dia a seguir' })).toHaveAttribute('aria-checked', 'true');
  });

  it('interruptor_do_pedido_automatico_le_e_grava', async () => {
    servicos({ automatico: true });
    api.put.mockReset().mockResolvedValue({ data: { data: { review_auto_request: false } } });
    await abre();
    separador('Template');
    const interruptor = screen.getByRole('switch', { name: 'Pedir avaliação automaticamente no dia a seguir' });
    expect(interruptor).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(interruptor);
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/reviews/settings', { review_auto_request: false }));
    expect(interruptor).toHaveAttribute('aria-checked', 'false');
  });

  it('interruptor_volta_atras_se_gravar_falhar', async () => {
    servicos({ automatico: false });
    api.put.mockReset().mockRejectedValue(new Error('rede'));
    await abre();
    separador('Template');
    const interruptor = screen.getByRole('switch', { name: 'Pedir avaliação automaticamente no dia a seguir' });
    expect(interruptor).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(interruptor);
    await waitFor(() => expect(interruptor).toHaveAttribute('aria-checked', 'false'));
    expect(api.put).toHaveBeenCalledWith('/reviews/settings', { review_auto_request: true });
    expect(await screen.findByText('Não foi possível guardar. Tente de novo.')).toBeInTheDocument();
  });

  it('guardar o template envia o objeto e mostra "Guardado"', async () => {
    await abre();
    separador('Template');
    fireEvent.change(campo('Assunto PT'), { target: { value: 'Novo assunto' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar template' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    const [url, corpo] = api.put.mock.calls[0];
    expect(url).toBe('/reviews/template');
    expect(Object.keys(corpo).sort()).toEqual(['body_en', 'body_pt', 'subject_en', 'subject_pt']);
    expect(corpo.subject_pt).toBe('Novo assunto');
    expect(await screen.findByRole('button', { name: 'Guardado' })).toBeInTheDocument();
  });

  it('o preview em PT e EN substitui as variáveis por dados de exemplo', async () => {
    await abre();
    separador('Template');
    expect(screen.getByText(/Olá Maria Santos/)).toBeInTheDocument();
    expect(screen.getByText(/Kitesurf Lesson/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'EN' }));
    expect(screen.getByText(/Hello Maria Santos/)).toBeInTheDocument();
    expect(screen.getByText(/Assunto: How was it\? Leave your review/)).toBeInTheDocument();
  });

  it('os separadores tem role tab com aria-selected', async () => {
    await abre();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map(t => t.textContent)).toEqual(['Por Tour', 'Pendentes (9)', 'Template']);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(tabs[1]);
    expect(screen.getAllByRole('tab')[1]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getAllByRole('tab')[0]).toHaveAttribute('aria-selected', 'false');
  });

  it('nenhuma cor em hexadecimal ou inline sobra no HTML (por tour, pendentes, template e guardado)', async () => {
    await abre();
    const limpo = () => {
      expect(document.body.innerHTML).not.toContain('[#');
      expect(document.body.innerHTML).not.toMatch(/background-color/);
      expect(document.body.innerHTML).not.toMatch(/(?:text|bg|border)-(?:yellow|orange|red|green)-\d/);
    };
    limpo();
    separador('Pendentes (9)');
    limpo();
    separador('Template');
    limpo();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar template' }));
    await screen.findByRole('button', { name: 'Guardado' });
    limpo();
  });

  it('serviços a falhar não rebentam', async () => {
    servicos({ falha: true });
    listReservations.mockRejectedValue(new Error('rede'));
    await abre();
    expect(kpi('Tours realizados')).toBe('0');
    expect(kpi('Média geral')).toBe('—');
  });
});

/* ───────────────────────── painel em ingles ───────────────────────── */

describe('Feedback: painel em inglês', () => {
  let errSpy;
  let warnSpy;
  /* dados dos testes e textos escritos ao cliente: nao contam como portugues do painel */
  const DADOS = ['Cliente a', 'Rui Direto', 'Buggy Tour', 'Mergulho', 'Kitesurf', 'Olá {nome_cliente}', 'Como correu', 'Maria Santos'];

  beforeEach(() => {
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    useUiStore.setState({ lang: 'en' });
    listReservations.mockReset().mockResolvedValue(RESERVAS);
    api.post.mockReset().mockResolvedValue({});
    api.put.mockReset().mockResolvedValue({});
    api.get.mockReset().mockImplementation(async (url) => {
      if (url === '/reviews') return { data: { data: AVALIACOES } };
      if (url === '/reviews/template') return { data: { data: null } };
      if (url === '/reviews/settings') return { data: { data: { review_auto_request: true } } };
      throw new Error(`pedido inesperado: ${url}`);
    });
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

  async function abreEn() {
    render(
      <MemoryRouter future={FUTURE}>
        <Feedback />
      </MemoryRouter>
    );
    await screen.findByText('Tours completed');
    await waitFor(() => expect(document.querySelector('.animate-spin')).toBeNull());
  }

  function separador(texto) {
    fireEvent.click(screen.getByText(texto));
  }
  function linhas() {
    return within(screen.getByRole('table')).getAllByRole('row').slice(1);
  }
  function campo(etiqueta) {
    const label = screen.getAllByText(etiqueta).find(e => e.tagName === 'LABEL');
    expect(label).toBeTruthy();
    return label.nextElementSibling;
  }

  it('mostra_titulo_kpis_e_tours_em_ingles_com_a_media_e_sem_portugues', async () => {
    await abreEn();
    expect(screen.getByText('Post-Tour Feedback')).toBeInTheDocument();
    expect(screen.getByText('Overall average').previousElementSibling.textContent).toBe('4.5 / 5');
    expect(screen.getByText('Response rate').previousElementSibling.textContent).toBe('18%');
    expect(screen.getAllByText('response rate')).toHaveLength(3);
    expect(screen.getAllByText('tours completed')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
    expect(portuguesNoEcra(DADOS)).toEqual([]);
    expect(chavesCruas(['feedbackPage'])).toEqual([]);
  });

  it('a_lista_de_pendentes_em_ingles_traduz_colunas_botao_e_data', async () => {
    await abreEn();
    fireEvent.click(screen.getByText('Pending (9)'));
    expect(screen.getByText('9 booking(s) without a review request sent.')).toBeInTheDocument();
    const cabecalhos = within(screen.getByRole('table')).getAllByRole('columnheader').map(h => h.textContent);
    expect(cabecalhos).toEqual(['Customer', 'Tour', 'Checkout', 'Days since checkout', '']);
    expect(screen.getAllByRole('button', { name: 'Resend request' })).toHaveLength(9);
    /* a data usa o formato ingles: "dd Mon yyyy" */
    expect(within(linhas()[0]).getByText(/^\d{2} [A-Z][a-z]{2} \d{4}$/)).toBeInTheDocument();
    expect(portuguesNoEcra(DADOS)).toEqual([]);
  });

  it('o_separador_Template_em_ingles_traduz_as_etiquetas_e_grava_o_modelo_do_cliente_em_portugues', async () => {
    await abreEn();
    separador('Template');
    expect(screen.getByText('Request a review automatically the next day')).toBeInTheDocument();
    expect(screen.getByText('Review request template')).toBeInTheDocument();
    expect(screen.getByTitle('Direct link to the review')).toBeInTheDocument();
    expect(campo('Subject PT').value).toBe('Como correu? Deixe a sua avaliação');
    expect(campo('Body PT').value).toMatch(/^Olá \{nome_cliente\},/);
    expect(campo('Body EN').value).toMatch(/^Hello \{nome_cliente\},/);
    fireEvent.click(screen.getByRole('button', { name: 'Save template' }));
    await screen.findByRole('button', { name: 'Saved' });
    expect(api.put).toHaveBeenCalledWith('/reviews/template', expect.objectContaining({
      subject_pt: 'Como correu? Deixe a sua avaliação',
      body_pt: expect.stringMatching(/^Olá \{nome_cliente\},/),
    }));
    expect(portuguesNoEcra(DADOS)).toEqual([]);
    expect(chavesCruas(['feedbackPage'])).toEqual([]);
  });

  it('o_erro_do_interruptor_automatico_aparece_em_ingles', async () => {
    await abreEn();
    separador('Template');
    api.put.mockRejectedValueOnce(new Error('rede'));
    fireEvent.click(screen.getByRole('switch'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save. Please try again.');
  });
});
