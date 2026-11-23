import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HotelDashboard from '../pages/dashboard/HotelDashboard';
import useUiStore from '../store/uiStore';
import { listUnits } from '../services/unitsService';
import { listReservations } from '../services/reservationsService';
import { getResumo, getReceita } from '../services/financeiroService';
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

/* Unidade completa; sobrepoe-se o que interessa a cada teste */
function unidade(over) {
  return { id: 'u1', name: 'Quarto 101', unit_type: 'double', status: 'available', is_active: true, ...over };
}

/* Reserva completa; sobrepoe-se o que interessa a cada teste */
function reserva(over) {
  return {
    id: 'r', unit_id: 'u1', status: 'confirmed', guests: 2, check_in: HOJE,
    check_out: MES_FIM, customer_name: 'Cliente', ...over,
  };
}

/* Responde conforme o par exato (stay_from, stay_to) de hoje, ou aos pedidos exatos
   { status: 'checked_in' } (hospedes que ja entraram) e { status: 'pending' }. Qualquer outra forma de argumentos
   (por exemplo from/to) lanca, para apanhar pedidos perdidos. */
function respostaPorPar(params, { hoje, checkedIn = [], pendentes = [], porPagar = [] }) {
  /* moldura comum: pagamentos por regularizar de qualquer mes */
  if (Object.keys(params || {}).join(',') === 'payment_status' && params.payment_status === 'pending,partial') {
    return porPagar;
  }
  if (Object.keys(params || {}).join(',') === 'status' && params.status === 'checked_in') {
    return checkedIn;
  }
  /* todas as pendentes, de qualquer mes (como o contador da barra lateral) */
  if (Object.keys(params || {}).join(',') === 'status' && params.status === 'pending') {
    return pendentes;
  }
  if (Object.keys(params || {}).sort().join(',') !== 'stay_from,stay_to') {
    throw new Error(`pedido inesperado ${JSON.stringify(params)}`);
  }
  const { stay_from: de, stay_to: ate } = params;
  if (de === HOJE && ate === HOJE) return hoje;
  /* moldura comum: mes e proximos 7 dias */
  if (de === MES_INICIO && ate === MES_FIM) return [];
  if (de === HOJE && ate === diaLocal(6)) return [];
  throw new Error(`pedido inesperado ${de} ${ate}`);
}

/* Valor de um indicador pelo seu rotulo (o <p> do cartao; os titulos das listas sao <h2>) */
function valorKpi(rotulo) {
  return screen.getByText(rotulo).previousElementSibling.textContent;
}

function carregaServicos({ units = [unidade()], hoje = [], checkedIn = [], pendentes = [], porPagar = [], res = resumo() } = {}) {
  listUnits.mockReset().mockResolvedValue(units);
  getReceita.mockReset().mockResolvedValue([]);
  listReservations.mockReset().mockImplementation(async (params) => (
    respostaPorPar(params, { hoje, checkedIn, pendentes, porPagar })
  ));
  getResumo.mockReset().mockResolvedValue(res);
  getWeatherForecast.mockReset().mockResolvedValue([]);
  api.get.mockReset().mockResolvedValue({ data: { data: null } });
}

function servicosAFalhar() {
  const erro = new Error('falha de rede');
  listUnits.mockReset().mockRejectedValue(erro);
  listReservations.mockReset().mockRejectedValue(erro);
  getResumo.mockReset().mockRejectedValue(erro);
  getReceita.mockReset().mockRejectedValue(erro);
  getWeatherForecast.mockReset().mockRejectedValue(erro);
  api.get.mockReset().mockRejectedValue(erro);
}

function renderHotel() {
  return render(
    <MemoryRouter future={FUTURE}>
      <HotelDashboard />
    </MemoryRouter>
  );
}

describe('HotelDashboard (Hoje)', () => {
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

  it('manutenção, sem confirmação e limpeza aparecem no painel', async () => {
    carregaServicos({
      units: [
        unidade({ id: 'u1', name: 'Quarto 101', status: 'maintenance' }),
        unidade({ id: 'u2', name: 'Quarto 102', status: 'cleaning' }),
      ],
      hoje: [reserva({ id: 'p1', unit_id: 'u2', status: 'pending' })],
    });
    renderHotel();
    expect(await screen.findByText('1 unidade(s) em manutenção')).toBeInTheDocument();
    expect(screen.getByText('1 reserva(s) por confirmar')).toBeInTheDocument();
    expect(screen.getByText('1 limpeza(s) por fazer')).toBeInTheDocument();
    expect(screen.queryByText('Tudo em ordem')).not.toBeInTheDocument();
    /* cada linha abre o seu destino */
    fireEvent.click(screen.getByRole('button', { name: /1 reserva\(s\) por confirmar/ }));
    expect(navigateMock).toHaveBeenLastCalledWith('/reservas');
    fireEvent.click(screen.getByRole('button', { name: /1 limpeza\(s\) por fazer/ }));
    expect(navigateMock).toHaveBeenLastCalledWith('/housekeeping');
  });

  it('sem alertas mostra Tudo em ordem', async () => {
    renderHotel();
    expect(await screen.findByText('Tudo em ordem')).toBeInTheDocument();
    expect(screen.getByText('Requer atenção')).toBeInTheDocument();
    /* sem chegadas nem partidas: a agenda mostra o estado vazio */
    expect(screen.getByText('Nada agendado para hoje')).toBeInTheDocument();
  });

  it('o mapa continua a mostrar as unidades', async () => {
    renderHotel();
    expect(await screen.findByText('Quarto 101')).toBeInTheDocument();
    expect(screen.getByText('Mapa de Quartos — Hoje')).toBeInTheDocument();
  });

  it('agenda_com_partida_as_11_e_chegada_as_14_e_cartao_de_destaque', async () => {
    carregaServicos({
      hoje: [
        reserva({ id: 'c1', status: 'confirmed', customer_name: 'Ana Entrada' }),
        reserva({ id: 'c2', status: 'checked_in', check_in: '2020-01-01', check_out: HOJE, customer_name: 'Rui Saída' }),
      ],
      res: resumo({ receita: 500 }),
    });
    renderHotel();
    const chegada = await screen.findByRole('button', { name: /Chegada · Ana Entrada/ });
    const partida = screen.getByRole('button', { name: /Partida · Rui Saída/ });
    expect(chegada).toHaveTextContent('Quarto 101 · 2 pessoa(s)');
    expect(partida).toBeInTheDocument();
    expect(screen.getByText('11:00')).toBeInTheDocument();
    expect(screen.getByText('14:00')).toBeInTheDocument();
    /* partida antes da chegada */
    expect(partida.compareDocumentPosition(chegada) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText('1 chegadas · 1 partidas')).toBeInTheDocument();
    expect(screen.getByText('Ocupação hoje')).toBeInTheDocument();
    expect(screen.getByText('€500')).toBeInTheDocument();
    expect(screen.getByText('1 chegadas')).toBeInTheDocument();
    expect(screen.getByText('1 partidas · 0 chegadas por confirmar')).toBeInTheDocument();
    ['Reservas pendentes', 'Avaliação média', 'Valor médio por reserva', 'Por receber']
      .forEach((rotulo) => expect(screen.getByText(rotulo)).toBeInTheDocument());
    /* as listas antigas sairam; o mapa fica */
    expect(screen.queryByRole('heading', { name: 'Check-ins hoje' })).toBeNull();
    expect(screen.getByText('Mapa de Quartos — Hoje')).toBeInTheDocument();
  });

  it('clicar_num_evento_abre_o_calendario', async () => {
    carregaServicos({ hoje: [reserva({ id: 'c1', status: 'confirmed', customer_name: 'Ana Entrada' })] });
    renderHotel();
    fireEvent.click(await screen.findByRole('button', { name: /Chegada · Ana Entrada/ }));
    expect(navigateMock).toHaveBeenLastCalledWith('/calendario');
  });

  it('o_por_confirmar_do_cartao_diz_respeito_as_chegadas', async () => {
    carregaServicos({ hoje: [reserva({ id: 'c1', status: 'pending', customer_name: 'Ana Entrada' })] });
    renderHotel();
    expect(await screen.findByText('0 partidas · 1 chegadas por confirmar')).toBeInTheDocument();
  });

  it('molduras_sem_resumo_nao_rebentam', async () => {
    carregaServicos({ res: null });
    renderHotel();
    expect((await screen.findAllByText('€0')).length).toBeGreaterThan(0);
    expect(screen.queryByText(/vs mês anterior/)).toBeNull();
  });

  it('a receita mostra a variação face ao mês anterior', async () => {
    carregaServicos({ res: resumo({ receita: 1200 }, { receita: 1000 }) });
    renderHotel();
    expect(await screen.findByText(`€${(1200).toLocaleString('pt-PT')}`)).toBeInTheDocument();
    expect(screen.getByText('+20% vs mês anterior')).toBeInTheDocument();
  });

  it('o valor por receber segue a lingua: 12 345 em PT e 12,345 em EN', async () => {
    const porPagar = [reserva({ id: 'rp', total_price: 12345, amount_paid: 0, payment_status: 'pending' })];
    carregaServicos({ porPagar });
    renderHotel();
    /* o pt-PT separa milhares com um espaco unico (nao-quebravel); o texto do DOM chega normalizado */
    expect(await screen.findByText(/^€12\s345$/)).toBeInTheDocument();
    cleanup();
    useUiStore.setState({ lang: 'en' });
    carregaServicos({ porPagar });
    renderHotel();
    expect(await screen.findByText('€12,345')).toBeInTheDocument();
  });

  it('sem mês anterior a receita não mostra variação', async () => {
    carregaServicos({ res: { atual: { receita: 500 } } });
    renderHotel();
    expect(await screen.findByText('€500')).toBeInTheDocument();
    expect(screen.queryByText(/vs mês anterior/)).not.toBeInTheDocument();
  });

  it('uma chamada a falhar não apaga os dados das outras', async () => {
    const pendente = reserva({ id: 'p1', status: 'pending' });
    carregaServicos({ hoje: [pendente] });
    /* so o pedido das pendentes falha */
    listReservations.mockReset().mockImplementation(async (params) => {
      /* o pedido das pendentes falha; o de hoje responde (e formas inesperadas lancam) */
      if (params.status === 'pending') throw new Error('falha de rede');
      return respostaPorPar(params, { hoje: [pendente] });
    });
    renderHotel();
    expect(await screen.findByText('Quarto 101')).toBeInTheDocument();
    expect(screen.getByText('1 reserva(s) por confirmar')).toBeInTheDocument();
    expect(screen.queryByText('Tudo em ordem')).not.toBeInTheDocument();
  });

  it('os pedidos usam stay_from e stay_to', async () => {
    renderHotel();
    expect(await screen.findByText('Tudo em ordem')).toBeInTheDocument();
    await waitFor(() => expect(listReservations).toHaveBeenCalledTimes(6));
    const pedidos = listReservations.mock.calls.map(([params]) => params);
    /* nenhuma chamada recebe as chaves antigas from/to */
    pedidos.forEach((p) => {
      expect(p).not.toHaveProperty('from');
      expect(p).not.toHaveProperty('to');
    });
    /* hoje (o mes ja nao e pedido: so servia para contar as pendentes) */
    expect(pedidos).toContainEqual({ stay_from: HOJE, stay_to: HOJE });
    /* e os hospedes ja instalados, que a sobreposicao de hoje pode nao devolver */
    expect(pedidos).toContainEqual({ status: 'checked_in' });
    /* e todas as pendentes, de qualquer mes */
    expect(pedidos).toContainEqual({ status: 'pending' });
    /* moldura comum: mes, 7 dias e pagamentos por regularizar */
    expect(pedidos).toContainEqual({ stay_from: MES_INICIO, stay_to: MES_FIM });
    expect(pedidos).toContainEqual({ stay_from: HOJE, stay_to: diaLocal(6) });
    expect(pedidos).toContainEqual({ payment_status: 'pending,partial' });
  });

  it('reservas pendentes conta as de qualquer mês e não só as que tocam o mês actual', async () => {
    /* nada no mes actual, mas ha duas pendentes (uma do mes seguinte): a barra lateral ja contava as duas */
    carregaServicos({
      pendentes: [
        reserva({ id: 'p1', status: 'pending', check_in: diaLocal(45), check_out: diaLocal(48) }),
        reserva({ id: 'p2', status: 'pending', check_in: diaLocal(70), check_out: diaLocal(72) }),
      ],
    });
    renderHotel();
    await screen.findByText('Quarto 101');
    expect(valorKpi('Reservas pendentes')).toBe('2');
  });

  it('se o pedido das pendentes falha o contador mostra 0 e o resto do painel carrega', async () => {
    carregaServicos({ hoje: [reserva({ id: 'a', status: 'confirmed', check_in: HOJE })] });
    const base = listReservations.getMockImplementation();
    listReservations.mockImplementation(async (params) => {
      if (params.status === 'pending') throw new Error('falha de rede');
      return base(params);
    });
    renderHotel();
    await screen.findByText('Quarto 101');
    expect(valorKpi('Reservas pendentes')).toBe('0');
  });

  it('check-in feito com saída ultrapassada mantem o quarto ocupado e conta na ocupação', async () => {
    /* o hospede nao fez check-out: a saida foi ontem, logo a sobreposicao de hoje nao o devolve;
       so o pedido dos check-ins feitos o traz */
    carregaServicos({
      units: [
        unidade({ id: 'u1', name: 'Quarto 101' }),
        unidade({ id: 'u2', name: 'Quarto 102' }),
      ],
      checkedIn: [
        reserva({ id: 'o', unit_id: 'u1', status: 'checked_in', check_in: diaLocal(-5), check_out: diaLocal(-1), customer_name: 'Hóspede Atrasado' }),
      ],
    });
    renderHotel();
    const celula = async (nome) => (await screen.findByText(nome)).parentElement;
    await waitFor(async () => expect(within(await celula('Quarto 101')).getByText('Ocupado')).toBeInTheDocument());
    expect(within(await celula('Quarto 102')).getByText('Disponível')).toBeInTheDocument();
    /* 1 de 2 quartos ocupados */
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('1 de 2 quartos')).toBeInTheDocument();
  });

  it('a mesma reserva devolvida pelos dois pedidos aparece uma só vez', async () => {
    const saida = reserva({ id: 'b', unit_id: 'u1', status: 'checked_in', check_in: diaLocal(-3), check_out: HOJE, customer_name: 'Rui Saída' });
    carregaServicos({ hoje: [saida], checkedIn: [saida] });
    renderHotel();
    /* sem deduplicacao a agenda e o contador de partidas contariam 2 */
    await waitFor(() => expect(screen.getAllByRole('button', { name: /Partida · Rui Saída/ })).toHaveLength(1));
    expect(screen.getByText('1 partidas · 0 chegadas por confirmar')).toBeInTheDocument();
  });

  it('estadia a meio, check-out e check-in de hoje entram no mapa, nas listas e nos contadores', async () => {
    /* o servidor devolve tambem as estadias que apenas sobrepoem hoje */
    carregaServicos({
      units: [
        unidade({ id: 'u1', name: 'Quarto 101' }),
        unidade({ id: 'u2', name: 'Quarto 102' }),
        unidade({ id: 'u3', name: 'Quarto 103' }),
        unidade({ id: 'u4', name: 'Quarto 104' }),
      ],
      hoje: [
        /* entrou ha 2 dias e sai daqui a 2: sem check-in nem check-out hoje */
        reserva({ id: 'a', unit_id: 'u1', status: 'checked_in', check_in: diaLocal(-2), check_out: diaLocal(2), customer_name: 'Maria Estadia' }),
        /* sai hoje */
        reserva({ id: 'b', unit_id: 'u2', status: 'checked_in', check_in: diaLocal(-3), check_out: HOJE, customer_name: 'Rui Saída' }),
        /* entra hoje */
        reserva({ id: 'c', unit_id: 'u3', status: 'confirmed', check_in: HOJE, check_out: diaLocal(3), customer_name: 'Ana Entrada' }),
      ],
      pendentes: [reserva({ id: 'p', unit_id: 'u4', status: 'pending', check_in: diaLocal(1) })],
    });
    renderHotel();
    const agenda = (await screen.findByRole('heading', { name: 'Agenda de hoje' })).closest('section');
    await screen.findByRole('button', { name: /Chegada · Ana Entrada/ });
    const celula = (nome) => screen.getByText(nome).parentElement;
    /* a estadia a meio ocupa o quarto, apesar de nao ter check-in nem check-out hoje */
    expect(within(celula('Quarto 101')).getByText('Ocupado')).toBeInTheDocument();
    expect(within(celula('Quarto 102')).getByText('Ocupado')).toBeInTheDocument();
    expect(within(celula('Quarto 103')).getByText('Check-in')).toBeInTheDocument();
    expect(within(celula('Quarto 104')).getByText('Disponível')).toBeInTheDocument();
    /* agenda de hoje: so a chegada e a partida; a estadia a meio nao */
    expect(within(agenda).getByRole('button', { name: /Partida · Rui Saída/ })).toBeInTheDocument();
    expect(within(agenda).queryByText(/Maria Estadia/)).not.toBeInTheDocument();
    expect(within(agenda).queryByText(/Chegada · Rui Saída/)).not.toBeInTheDocument();
    /* contadores: 2 de 4 quartos ocupados, 1 chegada, 1 partida, 1 pendente */
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('2 de 4 quartos')).toBeInTheDocument();
    expect(screen.getByText('1 chegadas')).toBeInTheDocument();
    expect(screen.getByText('1 partidas · 0 chegadas por confirmar')).toBeInTheDocument();
    expect(valorKpi('Reservas pendentes')).toBe('1');
  });

  it('serviços a falhar mostram estados vazios sem erro', async () => {
    servicosAFalhar();
    renderHotel();
    expect(await screen.findByText('Tudo em ordem')).toBeInTheDocument();
    expect(screen.getByText('Nada agendado para hoje')).toBeInTheDocument();
    expect(screen.getByText('Sem unidades registadas.')).toBeInTheDocument();
    await waitFor(() => expect(listUnits).toHaveBeenCalled());
  });

  it('reservas sem campos não rebentam', async () => {
    const vazia = { id: 'x', status: 'pending' };
    carregaServicos({ units: [{ id: 'u9', name: 'Quarto 9' }], hoje: [vazia] });
    renderHotel();
    expect(await screen.findByText('Quarto 9')).toBeInTheDocument();
    expect(screen.getByText('Tudo em ordem')).toBeInTheDocument();
  });
});
