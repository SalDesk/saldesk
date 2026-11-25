import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { portuguesNoEcra, chavesCruas } from './helpers/portuguesNoEcra';
import { MemoryRouter } from 'react-router-dom';
import ActivityDashboard from '../pages/dashboard/ActivityDashboard';
import useUiStore from '../store/uiStore';
import { listUnits } from '../services/unitsService';
import { listReservations } from '../services/reservationsService';
import { listAssignments } from '../services/assignmentService';
import { getWeatherForecast } from '../services/weatherService';

/* Sem rede: todos os servicos usados pelo dashboard sao simulados */
vi.mock('../services/unitsService', () => ({
  listUnits: vi.fn(),
}));
vi.mock('../services/reservationsService', () => ({
  listReservations: vi.fn(),
}));
vi.mock('../services/assignmentService', () => ({
  listAssignments: vi.fn(),
}));
vi.mock('../services/weatherService', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, getWeatherForecast: vi.fn() };
});

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
/* os proximos 14 dias: hoje..hoje+13 */
const SEMANA_FIM = diaLocal(13);
const ANTERIOR_INICIO = diaLocal(-13);
const SEMANA_PASSADA = diaLocal(-7);

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

/* Responde conforme o par exato (stay_from, stay_to) pedido: hoje, 13 dias anteriores ou semana.
   Qualquer outra forma de argumentos (por exemplo from/to) lanca, para apanhar pedidos perdidos. */
function respostaPorPar(params, { hoje, semana, anterior, porPagar = [] }) {
  const chaves = Object.keys(params || {}).sort().join(',');
  /* pagamentos por regularizar, de qualquer mes: { payment_status: 'pending,partial' } */
  if (chaves === 'payment_status' && params.payment_status === 'pending,partial') return porPagar;
  if (chaves !== 'stay_from,stay_to') {
    throw new Error(`pedido inesperado ${JSON.stringify(params)}`);
  }
  const { stay_from: de, stay_to: ate } = params;
  if (de === HOJE && ate === HOJE) return hoje;
  if (de === HOJE && ate === SEMANA_FIM) return semana;
  if (de === ANTERIOR_INICIO && ate === ONTEM) return anterior;
  throw new Error(`pedido inesperado ${de} ${ate}`);
}

/* Responde a cada pedido conforme o intervalo pedido: hoje, 13 dias anteriores ou semana */
function carregaServicos({ hoje = [], anterior = [], semana = [], porPagar = [], tours = [TOUR_A, TOUR_B], meteo = [], atribuicoes = [] } = {}) {
  listUnits.mockReset().mockResolvedValue(tours);
  listAssignments.mockReset().mockResolvedValue(atribuicoes);
  listReservations.mockReset().mockImplementation(async (params) => (
    respostaPorPar(params, { hoje, semana, anterior, porPagar })
  ));
  getWeatherForecast.mockReset().mockResolvedValue(meteo);
}

function servicosAFalhar() {
  const erro = new Error('falha de rede');
  listUnits.mockReset().mockRejectedValue(erro);
  listReservations.mockReset().mockRejectedValue(erro);
  listAssignments.mockReset().mockRejectedValue(erro);
  getWeatherForecast.mockReset().mockRejectedValue(erro);
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
    expect(tour).toHaveTextContent('8 pessoa(s) · Djo');
    /* a hora aparece na agenda e na pastilha da mare */
    expect(screen.getAllByText('09:00')).toHaveLength(2);
    /* o segundo tour nao tem hora nem guia: fica no fim da lista, sem hora e sem guia */
    expect(screen.getByRole('button', { name: /Barco Azul/ })).toHaveTextContent('2 pessoa(s) · sem guiaSem guia');
    /* o detalhe da saida escolhida mostra o ponto de encontro */
    fireEvent.click(tour);
    const detalhe = screen.getByRole('complementary', { name: 'Detalhe da saída' });
    expect(within(detalhe).getByText('Santa Maria')).toBeInTheDocument();
    expect(within(detalhe).getByText('Djo')).toBeInTheDocument();
    expect(within(detalhe).queryByRole('table')).toBeNull();
  });

  it('clicar_numa_saida_mostra_o_detalhe_e_nao_navega', async () => {
    carregaServicos({ hoje: RES_HOJE });
    renderActivity();
    const barco = await screen.findByRole('button', { name: /Barco Azul/ });
    fireEvent.click(barco);
    expect(barco).toHaveAttribute('aria-pressed', 'true');
    expect(within(screen.getByRole('complementary', { name: 'Detalhe da saída' })).getByText('Barco Azul')).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('abrir_manifesto_abre_na_saida_escolhida_e_deixa_mudar_de_tour', async () => {
    const comHora = { ...TOUR_A, description: JSON.stringify({ start_time: '09:00' }) };
    carregaServicos({
      hoje: [
        reserva({ id: 'h1', guests: 2, customer_name: 'Ana Silva' }),
        reserva({ id: 'h2', guests: 1, customer_name: 'Rui Costa', start_time: '15:00' }),
        reserva({ id: 'h3', unit_id: 't2', guests: 1, customer_name: 'Outro Tour' }),
      ],
      tours: [comHora, TOUR_B],
    });
    renderActivity();
    fireEvent.click(await screen.findByRole('button', { name: /09:00.*Tour Teste/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Abrir manifesto' }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('Ana Silva')).toBeInTheDocument();
    /* abre no tour e dia da saida; os seletores continuam a funcionar para o dia todo */
    expect(within(dialogo).queryByText('Outro Tour')).not.toBeInTheDocument();
    fireEvent.change(within(dialogo).getByLabelText('Tour'), { target: { value: 't2' } });
    expect(within(dialogo).getByText('Outro Tour')).toBeInTheDocument();
    expect(within(dialogo).queryByText('Ana Silva')).not.toBeInTheDocument();
  });

  it('uma_saida_toda_com_check_out_continua_na_agenda', async () => {
    carregaServicos({ hoje: [reserva({ id: 'h1', guests: 2, status: 'checked_out' })] });
    renderActivity();
    expect(await screen.findByRole('button', { name: /Tour Teste/ })).toHaveTextContent('2 pessoa(s)');
  });

  it('a_lotacao_da_agenda_nunca_passa_dos_100_nem_rebenta_sem_capacidade', async () => {
    carregaServicos({
      hoje: [
        reserva({ id: 'a', guests: 15, status: 'checked_in' }),
        reserva({ id: 'b', unit_id: 't3', guests: 4 }),
      ],
      tours: [TOUR_A, { id: 't3', name: 'Sem Capacidade' }],
    });
    renderActivity();
    const semCapacidade = await screen.findByRole('button', { name: /Sem Capacidade/ });
    expect(semCapacidade).toHaveTextContent('4 pessoa(s)');
    /* a barra do check-in nunca passa de 100, mesmo com mais pessoas do que a capacidade */
    fireEvent.click(screen.getByRole('button', { name: /Tour Teste/ }));
    const barras = screen.getAllByRole('progressbar', { name: 'Check-in feito' });
    expect(barras.map((b) => Number(b.getAttribute('aria-valuenow')))).toEqual([100]);
  });

  it('lotacao quase esgotada aparece na atencao', async () => {
    carregaServicos({ hoje: RES_HOJE });
    renderActivity();
    expect(await screen.findByText('1 data(s) quase cheia(s)')).toBeInTheDocument();
    expect(screen.getByText('Tour Teste 8/10')).toBeInTheDocument();
  });

  it('pendentes e por pagar na atencao', async () => {
    carregaServicos({ hoje: RES_HOJE, porPagar: [RES_POR_PAGAR] });
    renderActivity();
    expect(await screen.findByText('1 reserva(s) pendente(s) para hoje')).toBeInTheDocument();
    expect(screen.getByText('1 pagamento(s) por regularizar')).toBeInTheDocument();
  });

  it('um pagamento por regularizar de meses anteriores tambem aparece (nao so os do mes actual)', async () => {
    const antiga = reserva({ id: 'old', check_in: '2026-01-05', check_out: '2026-01-05', status: 'checked_out', payment_status: 'partial' });
    carregaServicos({ porPagar: [antiga, RES_POR_PAGAR] });
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

  it('em ingles o alerta de meteorologia mostra o estado do tempo em ingles', async () => {
    useUiStore.setState({ lang: 'en' });
    carregaServicos({
      semana: [RES_AMANHA],
      meteo: [{ date: AMANHA, code: 95, precipitation: 12 }],
    });
    renderActivity();
    expect(await screen.findByText(`${AMANHA} Thunderstorm`)).toBeInTheDocument();
    expect(screen.queryByText(`${AMANHA} Trovoada`)).not.toBeInTheDocument();
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
    carregaServicos({ hoje: RES_HOJE });
    renderActivity();
    expect(await screen.findByRole('heading', { name: 'Agenda de hoje' })).toBeInTheDocument();
    expect(screen.queryByText('Reservas recentes')).not.toBeInTheDocument();
    expect(screen.queryByText('Top tours do mes')).not.toBeInTheDocument();
    expect(screen.queryByText('Accoes rapidas')).not.toBeInTheDocument();
  });

  it('o mapa de ocupacao mostra a percentagem por servico e dia (14 dias)', async () => {
    carregaServicos({ hoje: RES_HOJE, semana: [...RES_HOJE, RES_AMANHA] });
    renderActivity();
    const mapa = await screen.findByRole('table', { name: 'Percentagem de lugares vendidos por serviço e por dia' });
    /* um tour por linha e catorze dias */
    expect(within(mapa).getAllByRole('row')).toHaveLength(3);
    expect(within(mapa).getAllByRole('columnheader')).toHaveLength(15);
    const tourA = within(mapa).getByRole('row', { name: /Tour Teste/ });
    /* hoje 8 de 10 lugares, amanha 1 de 10, os outros dias vazios */
    expect(within(tourA).getByText('80%')).toBeInTheDocument();
    expect(within(tourA).getByText('10%')).toBeInTheDocument();
    expect(within(tourA).getAllByText('0%')).toHaveLength(12);
    /* e as barras do telemovel: sete dias */
    expect(screen.getByText('Próximos 7 dias')).toBeInTheDocument();
  });

  it('o Hoje de actividades ja nao tem os atalhos nem a faixa de 7 dias antiga', async () => {
    carregaServicos({ hoje: RES_HOJE });
    renderActivity();
    expect(await screen.findByRole('heading', { name: 'Agenda de hoje' })).toBeInTheDocument();
    expect(screen.queryByText('Atalhos')).not.toBeInTheDocument();
    expect(screen.queryByText(/^\d+ res\.$/)).not.toBeInTheDocument();
  });

  it('a falha da previsao do vento so afecta o seu cartao', async () => {
    carregaServicos({ hoje: RES_HOJE });
    getWeatherForecast.mockReset().mockRejectedValue(new Error('sem rede'));
    renderActivity();
    expect(await screen.findByText('Não foi possível carregar a previsão do vento.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Agenda de hoje' })).toBeInTheDocument();
  });

  it('o cartao de vento mostra os cinco dias e avisa quando o vento chega aos 35 km/h', async () => {
    const dias = [0, 1, 2, 3, 4, 5].map((n) => ({
      date: diaLocal(n), code: 0, precipitation: 0, ventoKmh: n === 2 ? 38 : 18, ventoDirecao: 45,
    }));
    carregaServicos({ hoje: RES_HOJE, meteo: dias });
    renderActivity();
    expect(await screen.findByRole('heading', { name: 'Vento e mar' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').filter((li) => li.hasAttribute('data-forte'))).toHaveLength(5);
    expect(screen.getByText(/vento de até 38 km\/h/)).toBeInTheDocument();
  });

  it('reserva sem campos nao lanca', async () => {
    const vazia = { id: 'x', status: 'pending' };
    carregaServicos({ hoje: [vazia], anterior: [vazia], semana: [vazia] });
    renderActivity();
    expect(await screen.findByText('1 reserva(s) pendente(s) para hoje')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Agenda de hoje' })).toBeInTheDocument();
  });

  it('uma chamada a falhar nao apaga os dados das outras', async () => {
    carregaServicos({ hoje: RES_HOJE });
    /* so a lista dos 13 dias anteriores falha; hoje e tours respondem */
    listReservations.mockReset().mockImplementation(async (params) => {
      /* hoje e semana respondem (e rejeitam formas inesperadas); os dias anteriores falham */
      if (params.stay_from === ANTERIOR_INICIO && params.stay_to === ONTEM) {
        throw new Error('falha de rede');
      }
      return respostaPorPar(params, { hoje: RES_HOJE, semana: [], anterior: [] });
    });
    renderActivity();
    expect(await screen.findByRole('button', { name: /Tour Teste/ })).toHaveTextContent('8 pessoa(s)');
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
    /* hoje, 13 dias anteriores e semana (hoje..hoje+6) */
    expect(pedidos).toEqual(expect.arrayContaining([
      { stay_from: HOJE, stay_to: HOJE },
      { stay_from: ANTERIOR_INICIO, stay_to: ONTEM },
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

/* Numeros do dia e mare do dia */
const ROTULOS = ['Reservas hoje', 'Pessoas em actividade', 'Valor do dia', 'Por receber'];
const tileDe = (rotulo) => screen.getByText(rotulo).closest('article');

describe('ActivityDashboard: numeros do dia e mare', () => {
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
    expect(errSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('quatro_numeros_pela_ordem_e_o_cartao_de_destaque_ja_nao_existe', async () => {
    carregaServicos({ hoje: RES_HOJE });
    renderActivity();
    await screen.findByText('Reservas hoje');
    const tiles = [...document.querySelectorAll('article[data-tile]')];
    expect(tiles.map((a) => a.querySelector('span').textContent)).toEqual(ROTULOS);
    expect(screen.queryByText('Reservas no mês')).not.toBeInTheDocument();
    expect(screen.queryByText('Ocupação do mês')).not.toBeInTheDocument();
  });

  it('reservas_e_pessoas_de_hoje_contam_tudo_o_que_nao_esta_cancelado', async () => {
    /* 3+3+2 no tour A, 2 pendentes no B, e uma cancelada que nao conta */
    carregaServicos({ hoje: [...RES_HOJE, reserva({ id: 'x', status: 'cancelled', guests: 9 })] });
    renderActivity();
    await screen.findByText('Reservas hoje');
    expect(tileDe('Reservas hoje')).toHaveTextContent(/^Reservas hoje4/);
    expect(tileDe('Reservas hoje')).toHaveTextContent('1 por confirmar');
    expect(tileDe('Pessoas em actividade')).toHaveTextContent(/^Pessoas em actividade10/);
  });

  it('valor_do_dia_e_o_total_reservado_e_nao_o_cobrado', async () => {
    carregaServicos({
      hoje: [
        reserva({ id: 'v1', total_price: 100, status: 'confirmed' }),
        reserva({ id: 'v2', total_price: 220, status: 'pending', payment_status: 'pending' }),
        reserva({ id: 'v3', total_price: 999, status: 'cancelled' }),
      ],
    });
    renderActivity();
    await screen.findByText('Valor do dia');
    expect(tileDe('Valor do dia')).toHaveTextContent('€320');
    expect(tileDe('Valor do dia')).not.toHaveTextContent('€0');
  });

  it('por_receber_soma_o_que_falta_pagar_e_conta_as_reservas', async () => {
    carregaServicos({ porPagar: [reserva({ id: 'p1', check_in: ONTEM, payment_status: 'partial', total_price: 200, amount_paid: 50 })] });
    renderActivity();
    await screen.findByText('Por receber');
    await waitFor(() => expect(tileDe('Por receber')).toHaveTextContent('€150'));
    expect(tileDe('Por receber')).toHaveTextContent('1 reserva(s) por pagar');
    /* sem tendencia que se possa calcular: nao ha grafico neste numero */
    expect(within(tileDe('Por receber')).queryByRole('img')).toBeNull();
  });

  it('cada_numero_com_tendencia_tem_o_seu_grafico_com_rotulo', async () => {
    carregaServicos({ hoje: RES_HOJE });
    renderActivity();
    await screen.findByText('Reservas hoje');
    ['Reservas hoje', 'Pessoas em actividade', 'Valor do dia'].forEach((rotulo) => {
      const img = within(tileDe(rotulo)).getByRole('img');
      expect(img.getAttribute('aria-label')).toMatch(new RegExp(`^${rotulo}, últimos 7 dias: `));
    });
  });

  it('com_a_semana_passada_a_zero_nao_ha_variacao', async () => {
    carregaServicos({ hoje: RES_HOJE, anterior: [reserva({ id: 'o', check_in: ONTEM })] });
    renderActivity();
    await screen.findByText('Reservas hoje');
    ['Reservas hoje', 'Pessoas em actividade', 'Valor do dia'].forEach((rotulo) => {
      expect(tileDe(rotulo).querySelector('.font-mono')).toBeNull();
    });
  });

  it('variacao_face_ao_mesmo_dia_da_semana_passada', async () => {
    /* semana passada: 1 reserva de 2 pessoas e 100 euros; hoje: 4 reservas, 9 pessoas, 300 euros */
    carregaServicos({
      hoje: [
        ...RES_HOJE.slice(0, 3),
        reserva({ id: 'h5', guests: 1, total_price: 300 }),
      ],
      anterior: [reserva({ id: 'sp', check_in: SEMANA_PASSADA, guests: 2, total_price: 100 })],
    });
    renderActivity();
    await screen.findByText('Reservas hoje');
    expect(tileDe('Reservas hoje')).toHaveTextContent('+3');
    /* 3+3+2+1 = 9 pessoas contra 2: +350% */
    expect(tileDe('Pessoas em actividade')).toHaveTextContent('+350%');
    expect(tileDe('Valor do dia')).toHaveTextContent('+200%');
  });

  it('mostra_a_mare_do_dia_com_o_pico', async () => {
    const comHora = { ...TOUR_A, description: JSON.stringify({ start_time: '09:00', duration: 2 }) };
    carregaServicos({ hoje: RES_HOJE.slice(0, 3), tours: [comHora, TOUR_B] });
    renderActivity();
    expect(await screen.findByRole('heading', { name: 'Maré do dia' })).toBeInTheDocument();
    expect(screen.getByText('pico às 09:00')).toBeInTheDocument();
    expect(screen.getByText('saídas hoje').previousElementSibling).toHaveTextContent('1');
  });

  it('falha_das_atribuicoes_nao_apaga_o_resto', async () => {
    carregaServicos({ hoje: RES_HOJE });
    listAssignments.mockReset().mockRejectedValue(new Error('falha de rede'));
    renderActivity();
    expect(await screen.findByRole('button', { name: /Tour Teste/ })).toHaveTextContent('8 pessoa(s)');
    expect(screen.getByText('Reservas hoje')).toBeInTheDocument();
  });

  it('sem_actividades_a_mare_mostra_o_texto_vazio', async () => {
    renderActivity();
    expect(await screen.findByText('Sem actividades marcadas para hoje')).toBeInTheDocument();
  });

  it('em_ingles_os_numeros_e_a_mare_estao_em_ingles', async () => {
    useUiStore.setState({ lang: 'en' });
    const comHora = { ...TOUR_A, description: JSON.stringify({ start_time: '09:00', duration: 2 }) };
    carregaServicos({ hoje: RES_HOJE, tours: [comHora, TOUR_B] });
    renderActivity();
    expect(await screen.findByText('Value of the day')).toBeInTheDocument();
    expect(screen.getByText('Bookings today')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tide of the day' })).toBeInTheDocument();
    expect(portuguesNoEcra(['Tour Teste', 'Barco Azul', 'Cliente'])).toEqual([]);
    expect(chavesCruas(['dashboard'])).toEqual([]);
  });

  it('os_valores_do_grafico_usam_a_lingua_certa', async () => {
    useUiStore.setState({ lang: 'en' });
    carregaServicos({ hoje: [reserva({ id: 'g1', total_price: 12000 })] });
    renderActivity();
    await screen.findByText('Value of the day');
    expect(within(tileDe('Value of the day')).getByRole('img').getAttribute('aria-label')).toContain('€12,000');
    cleanup();
    useUiStore.setState({ lang: 'pt' });
    renderActivity();
    await screen.findByText('Valor do dia');
    expect(within(tileDe('Valor do dia')).getByRole('img').getAttribute('aria-label')).toContain('€12000');
  });

  it('se_os_dias_anteriores_falham_nao_ha_tendencia_nem_variacao_inventadas', async () => {
    carregaServicos({ hoje: RES_HOJE, semana: [RES_AMANHA] });
    const base = listReservations.getMockImplementation();
    listReservations.mockImplementation(async (params) => {
      if (params.stay_from === ANTERIOR_INICIO && params.stay_to === ONTEM) throw new Error('falha de rede');
      return base(params);
    });
    renderActivity();
    await screen.findByText('Reservas hoje');
    expect(tileDe('Reservas hoje')).toHaveTextContent(/^Reservas hoje4/);
    ['Reservas hoje', 'Pessoas em actividade', 'Valor do dia'].forEach((rotulo) => {
      expect(within(tileDe(rotulo)).queryByRole('img')).toBeNull();
      expect(tileDe(rotulo).querySelector('.font-mono')).toBeNull();
    });
    expect(screen.getByRole('button', { name: /Tour Teste/ })).toBeInTheDocument();
  });

  it('com_reservas_mas_sem_hora_a_mare_diz_que_nao_tem_hora', async () => {
    carregaServicos({ hoje: RES_HOJE });
    renderActivity();
    expect(await screen.findByText('As reservas de hoje não têm hora marcada')).toBeInTheDocument();
    expect(screen.queryByText('Sem actividades marcadas para hoje')).not.toBeInTheDocument();
  });
});
