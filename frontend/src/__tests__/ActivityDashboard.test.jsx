import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ActivityDashboard from '../pages/dashboard/ActivityDashboard';
import useUiStore from '../store/uiStore';
import { listUnits } from '../services/unitsService';
import { listReservations } from '../services/reservationsService';
import { getResumo } from '../services/financeiroService';
import { getWeatherForecast } from '../services/weatherService';
import api from '../services/api';

/* Sem rede: todos os servicos usados pelo dashboard sao simulados */
vi.mock('../services/unitsService', () => ({
  listUnits: vi.fn(),
}));
vi.mock('../services/reservationsService', () => ({
  listReservations: vi.fn(),
}));
vi.mock('../services/financeiroService', () => ({
  getResumo: vi.fn(),
}));
vi.mock('../services/weatherService', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, getWeatherForecast: vi.fn() };
});
vi.mock('../services/api', () => ({
  default: { get: vi.fn() },
}));

/* Navegacao simulada */
const navigateMock = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => navigateMock,
}));

const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };

/* Datas locais calculadas aqui, sem reutilizar o codigo em teste */
function diaLocal(deslocamento) {
  const d = new Date();
  d.setDate(d.getDate() + deslocamento);
  return d.toLocaleDateString('en-CA');
}
const HOJE = diaLocal(0);
const ONTEM = diaLocal(-1);
const AMANHA = diaLocal(1);
const SEMANA_FIM = diaLocal(6);
const MES_INICIO = HOJE.slice(0, 8) + '01';
const MES_FIM = (() => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth() + 1, 0).toLocaleDateString('en-CA');
})();

const ZERO = { receita: 0, num_reservas: 0, valor_medio: 0, taxa_ocupacao: 0 };
function resumo(atual = {}, anterior = {}) {
  return {
    atual: { ...ZERO, ...atual },
    anterior: { ...ZERO, ...anterior },
    variacao: { ...ZERO },
  };
}

const TOUR_A = { id: 't1', name: 'Tour Teste', capacity: 10, status: 'active', description: null };
const TOUR_B = { id: 't2', name: 'Barco Azul', capacity: 20, status: 'active', description: null };

/* Reserva completa; sobrepoe-se o que interessa a cada teste */
function reserva(over) {
  return {
    id: 'r', unit_id: 't1', status: 'confirmed', guests: 1, check_in: HOJE,
    payment_status: 'paid', customer_name: 'Cliente', created_at: '2026-01-01T10:00:00Z',
    ...over,
  };
}

/* Tres confirmadas (3+3+2 = 8 convidados) no tour A e uma pendente no tour B */
const RES_HOJE = [
  reserva({ id: 'h1', guests: 3 }),
  reserva({ id: 'h2', guests: 3 }),
  reserva({ id: 'h3', guests: 2 }),
  reserva({ id: 'h4', unit_id: 't2', status: 'pending', guests: 2 }),
];
/* Reserva do mes confirmada por pagar, com check-in de ontem */
const RES_POR_PAGAR = reserva({ id: 'm1', check_in: ONTEM, payment_status: 'pending' });
/* Reserva de amanha (para a faixa de 7 dias e para o aviso de mau tempo) */
const RES_AMANHA = reserva({ id: 'w1', check_in: AMANHA });

/* Responde conforme o par exato (stay_from, stay_to) pedido: hoje, mes ou semana.
   Qualquer outra forma de argumentos (por exemplo from/to) lanca, para apanhar pedidos perdidos. */
function respostaPorPar(params, { hoje, semana, mes }) {
  const chaves = Object.keys(params || {}).sort().join(',');
  if (chaves !== 'stay_from,stay_to') {
    throw new Error(`pedido inesperado ${JSON.stringify(params)}`);
  }
  const { stay_from: de, stay_to: ate } = params;
  if (de === HOJE && ate === HOJE) return hoje;
  /* O dia 1 e o mesmo inicio para semana e mes: so o par completo os separa */
  if (de === HOJE && ate === SEMANA_FIM) return semana;
  if (de === MES_INICIO && ate === MES_FIM) return mes;
  throw new Error(`pedido inesperado ${de} ${ate}`);
}

/* Responde a cada pedido conforme o intervalo pedido: hoje, mes ou semana */
function carregaServicos({ hoje = [], mes = [], semana = [], res = resumo(), tours = [TOUR_A, TOUR_B], meteo = [], rating = null, ratingTotal = 3 } = {}) {
  listUnits.mockReset().mockResolvedValue(tours);
  listReservations.mockReset().mockImplementation(async (params) => (
    respostaPorPar(params, { hoje, semana, mes })
  ));
  getResumo.mockReset().mockResolvedValue(res);
  getWeatherForecast.mockReset().mockResolvedValue(meteo);
  /* Forma real de GET /reviews/stats: { total, average, distribution } */
  api.get.mockReset().mockResolvedValue({
    data: { data: rating == null ? null : { total: ratingTotal, average: rating, distribution: {} } },
  });
}

function servicosAFalhar() {
  const erro = new Error('falha de rede');
  listUnits.mockReset().mockRejectedValue(erro);
  listReservations.mockReset().mockRejectedValue(erro);
  getResumo.mockReset().mockRejectedValue(erro);
  getWeatherForecast.mockReset().mockRejectedValue(erro);
  api.get.mockReset().mockRejectedValue(erro);
}

function renderActivity() {
  return render(
    <MemoryRouter future={FUTURE}>
      <ActivityDashboard />
    </MemoryRouter>
  );
}

describe('ActivityDashboard (Hoje)', () => {
  let errSpy;
  let warnSpy;

  beforeEach(() => {
    useUiStore.setState({ lang: 'pt' });
    navigateMock.mockReset();
    carregaServicos();
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    /* nenhum erro ou aviso no consolo durante o teste */
    expect(errSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('mostra a tabela de tours de hoje', async () => {
    carregaServicos({ hoje: RES_HOJE });
    renderActivity();
    expect(await screen.findByRole('heading', { name: 'Tours de hoje' })).toBeInTheDocument();
    const celula = await screen.findByText('8/10');
    const linha = celula.closest('tr');
    expect(within(linha).getByText('Tour Teste')).toBeInTheDocument();
    /* numero de reservas do tour e estado */
    expect(within(linha).getByText('3')).toBeInTheDocument();
    expect(within(linha).getByText('Confirmado')).toBeInTheDocument();
    /* o segundo tour tem uma reserva pendente */
    const linhaB = screen.getByText('Barco Azul').closest('tr');
    expect(within(linhaB).getByText('Pendente')).toBeInTheDocument();
  });

  it('a barra de lotacao nunca passa dos 100% nem rebenta sem capacidade', async () => {
    carregaServicos({
      hoje: [
        reserva({ id: 'a', guests: 15 }),
        reserva({ id: 'b', unit_id: 't3', guests: 4 }),
      ],
      tours: [TOUR_A, { id: 't3', name: 'Sem Capacidade' }],
    });
    renderActivity();
    const barras = await screen.findAllByRole('progressbar');
    const valores = barras.map((b) => b.getAttribute('aria-valuenow'));
    expect(valores).toEqual(['100', '0']);
  });

  it('lotacao quase esgotada aparece na atencao', async () => {
    carregaServicos({ hoje: RES_HOJE });
    renderActivity();
    expect(await screen.findByText('1 data(s) quase cheia(s)')).toBeInTheDocument();
    expect(screen.getByText('Tour Teste 8/10')).toBeInTheDocument();
  });

  it('pendentes e por pagar na atencao', async () => {
    carregaServicos({ hoje: RES_HOJE, mes: [RES_POR_PAGAR, ...RES_HOJE] });
    renderActivity();
    expect(await screen.findByText('1 reserva(s) pendente(s) para hoje')).toBeInTheDocument();
    expect(screen.getByText('1 pagamento(s) por regularizar')).toBeInTheDocument();
  });

  it('o mau tempo e um item da atencao e nao ha faixa vermelha', async () => {
    carregaServicos({
      semana: [RES_AMANHA],
      meteo: [{ date: AMANHA, code: 95, precipitation: 12 }],
    });
    renderActivity();
    expect(await screen.findByText('1 tour(s) afectado(s) pela meteorologia')).toBeInTheDocument();
    expect(screen.getByText(`${AMANHA} Trovoada`)).toBeInTheDocument();
    expect(screen.queryByText('Mau tempo previsto em dias com tours agendados')).not.toBeInTheDocument();
    /* abre a meteorologia */
    fireEvent.click(screen.getByRole('button', { name: /1 tour\(s\) afectado\(s\) pela meteorologia/ }));
    expect(navigateMock).toHaveBeenLastCalledWith('/meteorologia');
  });

  it('sem tours hoje mostra o estado vazio com Nova reserva', async () => {
    renderActivity();
    expect(await screen.findByText('Nenhum tour agendado para hoje')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Nova reserva' }));
    expect(navigateMock).toHaveBeenLastCalledWith('/reservas');
    /* nada a pedir atencao */
    expect(screen.getByText('Tudo em ordem')).toBeInTheDocument();
  });

  it('recentes, mais vendidos e accoes rapidas ja nao estao no Hoje', async () => {
    carregaServicos({ hoje: RES_HOJE, mes: RES_HOJE });
    renderActivity();
    expect(await screen.findByText('8/10')).toBeInTheDocument();
    expect(screen.queryByText('Reservas recentes')).not.toBeInTheDocument();
    expect(screen.queryByText('Top tours do mes')).not.toBeInTheDocument();
    expect(screen.queryByText('Accoes rapidas')).not.toBeInTheDocument();
  });

  it('mostra os cinco indicadores e a variacao da receita face ao mes anterior', async () => {
    carregaServicos({
      hoje: RES_HOJE,
      mes: RES_HOJE,
      res: resumo({ receita: 500 }, { receita: 300 }),
      rating: 4.5,
    });
    renderActivity();
    expect(await screen.findByText('Tours hoje')).toBeInTheDocument();
    expect(screen.getByText('Participantes do mês')).toBeInTheDocument();
    expect(screen.getByText('Taxa de ocupação')).toBeInTheDocument();
    expect(screen.getByText('Receita do mês')).toBeInTheDocument();
    expect(screen.getByText('Avaliação média')).toBeInTheDocument();
    expect(screen.getByText('€500')).toBeInTheDocument();
    expect(screen.getByText('+€200')).toBeInTheDocument();
    expect(screen.getByText('face ao mês anterior')).toBeInTheDocument();
    expect(screen.getByText('4.5')).toBeInTheDocument();
  });

  it('sem mes anterior nao mostra variacao', async () => {
    carregaServicos({ res: { atual: { receita: 500 } } });
    renderActivity();
    expect(await screen.findByText('€500')).toBeInTheDocument();
    expect(screen.queryByText('face ao mês anterior')).not.toBeInTheDocument();
  });

  it('a faixa de 7 dias so mostra contagem quando ha reservas', async () => {
    carregaServicos({ hoje: RES_HOJE, semana: [...RES_HOJE, RES_AMANHA] });
    renderActivity();
    expect(await screen.findByText('Próximos 7 dias')).toBeInTheDocument();
    /* hoje: 4 reservas activas; amanha: 1; os outros cinco dias sem contagem */
    expect(screen.getByText('4 res.')).toBeInTheDocument();
    expect(screen.getByText('1 res.')).toBeInTheDocument();
    expect(screen.getAllByText('res.', { exact: false })).toHaveLength(2);
  });

  it('reserva sem campos nao lanca', async () => {
    const vazia = { id: 'x', status: 'pending' };
    carregaServicos({ hoje: [vazia], mes: [vazia], semana: [vazia] });
    renderActivity();
    expect(await screen.findByText('1 reserva(s) pendente(s) para hoje')).toBeInTheDocument();
    expect(screen.getByText('Tours hoje')).toBeInTheDocument();
  });

  it('a avaliacao media vem de average quando ha avaliacoes', async () => {
    carregaServicos({ rating: 4.7, ratingTotal: 3 });
    renderActivity();
    expect(await screen.findByText('4.7')).toBeInTheDocument();
  });

  it('sem avaliacoes (total 0) a avaliacao media mostra o traco', async () => {
    carregaServicos({ rating: 0, ratingTotal: 0 });
    renderActivity();
    const rotulo = await screen.findByText('Avaliação média');
    expect(rotulo.parentElement.nextElementSibling).toHaveTextContent(/^—$/);
    expect(screen.queryByText('0.0')).not.toBeInTheDocument();
  });

  it('uma chamada a falhar nao apaga os dados das outras', async () => {
    carregaServicos({ hoje: RES_HOJE });
    /* so a lista do mes falha; hoje, tours e resumo respondem */
    listReservations.mockReset().mockImplementation(async (params) => {
      /* hoje e semana respondem (e rejeitam formas inesperadas); o mes falha */
      if (params.stay_from === MES_INICIO && params.stay_to === MES_FIM) {
        throw new Error('falha de rede');
      }
      return respostaPorPar(params, { hoje: RES_HOJE, semana: [], mes: [] });
    });
    renderActivity();
    const celula = await screen.findByText('8/10');
    expect(within(celula.closest('tr')).getByText('Tour Teste')).toBeInTheDocument();
    expect(screen.getByText('1 reserva(s) pendente(s) para hoje')).toBeInTheDocument();
    expect(screen.queryByText('Tudo em ordem')).not.toBeInTheDocument();
    expect(screen.queryByText('Nenhum tour agendado para hoje')).not.toBeInTheDocument();
  });

  it('os pedidos usam stay_from e stay_to', async () => {
    renderActivity();
    expect(await screen.findByText('Nenhum tour agendado para hoje')).toBeInTheDocument();
    await waitFor(() => expect(listReservations).toHaveBeenCalledTimes(3));
    const pedidos = listReservations.mock.calls.map(([params]) => params);
    /* nenhuma chamada recebe as chaves antigas from/to */
    pedidos.forEach((p) => {
      expect(p).not.toHaveProperty('from');
      expect(p).not.toHaveProperty('to');
    });
    /* uma saida ultrapassada nao e relevante aqui: nunca se pedem os check-ins feitos */
    expect(pedidos).not.toContainEqual({ status: 'checked_in' });
    /* hoje, mes e semana (hoje..hoje+6) */
    expect(pedidos).toEqual(expect.arrayContaining([
      { stay_from: HOJE, stay_to: HOJE },
      { stay_from: MES_INICIO, stay_to: MES_FIM },
      { stay_from: HOJE, stay_to: SEMANA_FIM },
    ]));
  });

  it('servicos a falhar mostram estados vazios sem erro', async () => {
    servicosAFalhar();
    renderActivity();
    expect(await screen.findByText('Nenhum tour agendado para hoje')).toBeInTheDocument();
    expect(screen.getByText('Tudo em ordem')).toBeInTheDocument();
    await waitFor(() => expect(listUnits).toHaveBeenCalled());
  });
});
