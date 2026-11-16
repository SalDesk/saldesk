import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ActivityDashboard from '../pages/dashboard/ActivityDashboard';
import useUiStore from '../store/uiStore';
import { listUnits } from '../services/unitsService';
import { listReservations } from '../services/reservationsService';
import { getResumo, getReceita } from '../services/financeiroService';
import { listAssignments } from '../services/assignmentService';
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
  getReceita: vi.fn(),
}));
vi.mock('../services/assignmentService', () => ({
  listAssignments: vi.fn(),
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
function respostaPorPar(params, { hoje, semana, mes, porPagar = [] }) {
  const chaves = Object.keys(params || {}).sort().join(',');
  /* pagamentos por regularizar, de qualquer mes: { payment_status: 'pending,partial' } */
  if (chaves === 'payment_status' && params.payment_status === 'pending,partial') return porPagar;
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
function carregaServicos({ hoje = [], mes = [], semana = [], porPagar = [], res = resumo(), tours = [TOUR_A, TOUR_B], meteo = [], rating = null, ratingTotal = 3, receitaDia = [], atribuicoes = [] } = {}) {
  listUnits.mockReset().mockResolvedValue(tours);
  getReceita.mockReset().mockResolvedValue(receitaDia);
  listAssignments.mockReset().mockResolvedValue(atribuicoes);
  listReservations.mockReset().mockImplementation(async (params) => (
    respostaPorPar(params, { hoje, semana, mes, porPagar })
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
  getReceita.mockReset().mockRejectedValue(erro);
  listAssignments.mockReset().mockRejectedValue(erro);
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

  it('mostra_a_agenda_de_hoje_com_hora_guia_e_lotacao', async () => {
    const comHora = { ...TOUR_A, description: JSON.stringify({ start_time: '09:00', meeting_point: 'Santa Maria' }) };
    carregaServicos({
      hoje: RES_HOJE,
      tours: [comHora, TOUR_B],
      atribuicoes: [{ reservation_id: 'h1', status: 'confirmed', staff: { name: 'Djo' } }],
    });
    renderActivity();
    expect(await screen.findByRole('heading', { name: 'Agenda de hoje' })).toBeInTheDocument();
    const tour = await screen.findByRole('button', { name: /Tour Teste/ });
    expect(tour).toHaveTextContent('8/10 · guia Djo · Santa Maria');
    expect(screen.getByText('09:00')).toBeInTheDocument();
    /* o segundo tour nao tem hora: vai para "Sem hora marcada", com a reserva pendente */
    expect(screen.getByText('Sem hora marcada')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Barco Azul/ })).toHaveTextContent('1 por confirmar');
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('clicar_num_evento_abre_o_calendario', async () => {
    carregaServicos({ hoje: RES_HOJE });
    renderActivity();
    fireEvent.click(await screen.findByRole('button', { name: /Tour Teste/ }));
    expect(navigateMock).toHaveBeenLastCalledWith('/calendario');
  });

  it('pessoas_de_hoje_no_cartao_de_destaque', async () => {
    carregaServicos({ hoje: RES_HOJE });
    renderActivity();
    /* 3+3+2 no tour A e 2 (pendente) no B */
    expect(await screen.findByText('10 pessoas')).toBeInTheDocument();
    expect(screen.getByText('em 2 tours · 1 por confirmar')).toBeInTheDocument();
  });

  it('a_lotacao_da_agenda_nunca_passa_dos_100_nem_rebenta_sem_capacidade', async () => {
    carregaServicos({
      hoje: [
        reserva({ id: 'a', guests: 15 }),
        reserva({ id: 'b', unit_id: 't3', guests: 4 }),
      ],
      tours: [TOUR_A, { id: 't3', name: 'Sem Capacidade' }],
    });
    renderActivity();
    expect(await screen.findByRole('button', { name: /Sem Capacidade/ })).toHaveTextContent('4');
    /* so o tour com capacidade tem barra, limitada a 100 */
    const barras = screen.getAllByRole('progressbar');
    expect(barras.map((b) => b.getAttribute('aria-valuenow'))).toEqual(['100']);
  });

  it('lotacao quase esgotada aparece na atencao', async () => {
    carregaServicos({ hoje: RES_HOJE });
    renderActivity();
    expect(await screen.findByText('1 data(s) quase cheia(s)')).toBeInTheDocument();
    expect(screen.getByText('Tour Teste 8/10')).toBeInTheDocument();
  });

  it('pendentes e por pagar na atencao', async () => {
    carregaServicos({ hoje: RES_HOJE, mes: [RES_POR_PAGAR, ...RES_HOJE], porPagar: [RES_POR_PAGAR] });
    renderActivity();
    expect(await screen.findByText('1 reserva(s) pendente(s) para hoje')).toBeInTheDocument();
    expect(screen.getByText('1 pagamento(s) por regularizar')).toBeInTheDocument();
  });

  it('um pagamento por regularizar de meses anteriores tambem aparece (nao so os do mes actual)', async () => {
    const antiga = reserva({ id: 'old', check_in: '2026-01-05', check_out: '2026-01-05', status: 'checked_out', payment_status: 'partial' });
    carregaServicos({ mes: [], porPagar: [antiga, RES_POR_PAGAR] });
    renderActivity();
    expect(await screen.findByText('2 pagamento(s) por regularizar')).toBeInTheDocument();
  });

  it('so conta como por regularizar o que ja comecou e esta confirmado ou concluido', async () => {
    carregaServicos({ porPagar: [
      reserva({ id: 'futura', check_in: AMANHA, payment_status: 'pending' }),
      reserva({ id: 'cancelada', status: 'cancelled', check_in: ONTEM, payment_status: 'pending' }),
      RES_POR_PAGAR,
    ] });
    renderActivity();
    expect(await screen.findByText('1 pagamento(s) por regularizar')).toBeInTheDocument();
  });

  it('se o pedido dos pagamentos por regularizar falha o resto do painel carrega', async () => {
    carregaServicos({ hoje: RES_HOJE });
    const base = listReservations.getMockImplementation();
    listReservations.mockImplementation(async (params) => {
      if (params.payment_status) throw new Error('falha de rede');
      return base(params);
    });
    renderActivity();
    expect(await screen.findByText('1 reserva(s) pendente(s) para hoje')).toBeInTheDocument();
    expect(screen.queryByText(/por regularizar/)).not.toBeInTheDocument();
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

  it('mostra_o_cartao_de_destaque_e_os_quatro_numeros', async () => {
    carregaServicos({
      hoje: RES_HOJE,
      mes: RES_HOJE,
      res: resumo({ receita: 1120 }, { receita: 1000 }),
      rating: 4.5,
    });
    renderActivity();
    expect(await screen.findByText(`€${(1120).toLocaleString('pt-PT')}`)).toBeInTheDocument();
    expect(screen.getByText('+12% vs mês anterior')).toBeInTheDocument();
    expect(screen.getByText('Ocupação do mês')).toBeInTheDocument();
    ['Reservas no mês', 'Avaliação média', 'Valor médio por reserva', 'Por receber']
      .forEach((rotulo) => expect(screen.getByText(rotulo)).toBeInTheDocument());
    /* reservas do mes nao canceladas: 4; avaliacao 4.5 */
    expect(screen.getByText('Reservas no mês').previousElementSibling).toHaveTextContent(/^4$/);
    expect(screen.getByText('4.5')).toBeInTheDocument();
    /* os indicadores antigos sairam */
    expect(screen.queryByText('Tours hoje')).not.toBeInTheDocument();
    expect(screen.queryByText('face ao mês anterior')).not.toBeInTheDocument();
  });

  it('sem_mes_anterior_sem_pilula', async () => {
    carregaServicos({ res: { atual: { receita: 500 } } });
    renderActivity();
    expect(await screen.findByText('€500')).toBeInTheDocument();
    expect(screen.queryByText(/vs mês anterior/)).not.toBeInTheDocument();
  });

  it('valor_medio_divide_a_receita_pelas_reservas_confirmadas_do_mes', async () => {
    /* RES_HOJE: 3 confirmadas e 1 pendente; 920 / 3 = 306,67 */
    carregaServicos({ mes: RES_HOJE, res: resumo({ receita: 920 }) });
    renderActivity();
    const rotulo = await screen.findByText('Valor médio por reserva');
    expect(rotulo.previousElementSibling).toHaveTextContent(/^€307$/);
  });

  it('sem_reservas_confirmadas_o_valor_medio_e_um_traco', async () => {
    carregaServicos({ mes: [], res: resumo({ receita: 920 }) });
    renderActivity();
    const rotulo = await screen.findByText('Valor médio por reserva');
    expect(rotulo.previousElementSibling).toHaveTextContent(/^—$/);
  });

  it('por_receber_soma_o_que_falta_pagar', async () => {
    carregaServicos({ porPagar: [reserva({ id: 'p1', check_in: ONTEM, payment_status: 'partial', total_price: 200, amount_paid: 50 })] });
    renderActivity();
    const rotulo = await screen.findByText('Por receber');
    await waitFor(() => expect(rotulo.previousElementSibling).toHaveTextContent(/^€150$/));
  });

  it('grafico_pede_a_receita_por_dia_do_mes_ate_hoje', async () => {
    renderActivity();
    await waitFor(() => expect(getReceita).toHaveBeenCalledWith(MES_INICIO, HOJE, 'day'));
  });

  it('falha_da_receita_por_dia_ou_das_atribuicoes_nao_apaga_o_resto', async () => {
    carregaServicos({ hoje: RES_HOJE, res: resumo({ receita: 500 }) });
    getReceita.mockReset().mockRejectedValue(new Error('falha de rede'));
    listAssignments.mockReset().mockRejectedValue(new Error('falha de rede'));
    renderActivity();
    expect(await screen.findByRole('button', { name: /Tour Teste/ })).toHaveTextContent('8/10');
    expect(screen.getByText('€500')).toBeInTheDocument();
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
    expect(screen.getByRole('heading', { name: 'Agenda de hoje' })).toBeInTheDocument();
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
    expect(rotulo.previousElementSibling).toHaveTextContent(/^—$/);
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
    expect(await screen.findByRole('button', { name: /Tour Teste/ })).toHaveTextContent('8/10');
    expect(screen.getByText('1 reserva(s) pendente(s) para hoje')).toBeInTheDocument();
    expect(screen.queryByText('Tudo em ordem')).not.toBeInTheDocument();
    expect(screen.queryByText('Nenhum tour agendado para hoje')).not.toBeInTheDocument();
  });

  it('os pedidos usam stay_from e stay_to', async () => {
    renderActivity();
    expect(await screen.findByText('Nenhum tour agendado para hoje')).toBeInTheDocument();
    await waitFor(() => expect(listReservations).toHaveBeenCalledTimes(4));
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
    /* e os pagamentos por regularizar de qualquer mes */
    expect(pedidos).toContainEqual({ payment_status: 'pending,partial' });
  });

  it('servicos a falhar mostram estados vazios sem erro', async () => {
    servicosAFalhar();
    renderActivity();
    expect(await screen.findByText('Nenhum tour agendado para hoje')).toBeInTheDocument();
    expect(screen.getByText('Tudo em ordem')).toBeInTheDocument();
    await waitFor(() => expect(listUnits).toHaveBeenCalled());
  });
});
