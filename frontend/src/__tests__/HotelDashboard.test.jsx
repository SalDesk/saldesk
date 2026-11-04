import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HotelDashboard from '../pages/dashboard/HotelDashboard';
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

/* Responde conforme o par exato (stay_from, stay_to): hoje ou mes, ou ao pedido exato
   { status: 'checked_in' } (hospedes que ja entraram). Qualquer outra forma de argumentos
   (por exemplo from/to) lanca, para apanhar pedidos perdidos. */
function respostaPorPar(params, { hoje, mes, checkedIn = [] }) {
  if (Object.keys(params || {}).join(',') === 'status' && params.status === 'checked_in') {
    return checkedIn;
  }
  if (Object.keys(params || {}).sort().join(',') !== 'stay_from,stay_to') {
    throw new Error(`pedido inesperado ${JSON.stringify(params)}`);
  }
  const { stay_from: de, stay_to: ate } = params;
  /* O dia 1 pode ser igual a hoje: so o par completo separa os pedidos */
  if (de === HOJE && ate === HOJE) return hoje;
  if (de === MES_INICIO && ate === MES_FIM) return mes;
  throw new Error(`pedido inesperado ${de} ${ate}`);
}

/* Valor de um indicador pelo seu rotulo (o <p> do cartao; os titulos das listas sao <h2>) */
function valorKpi(rotulo) {
  const el = screen.getAllByText(rotulo).find((e) => e.tagName === 'P');
  return el.parentElement.nextElementSibling.textContent;
}

function carregaServicos({ units = [unidade()], hoje = [], mes = [], checkedIn = [], res = resumo() } = {}) {
  listUnits.mockReset().mockResolvedValue(units);
  listReservations.mockReset().mockImplementation(async (params) => (
    respostaPorPar(params, { hoje, mes, checkedIn })
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

  it('manutencao, sem confirmacao e limpeza aparecem no painel', async () => {
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
    /* sem check-ins nem check-outs: estados vazios compactos */
    expect(screen.getByText('Nenhum check-in agendado para hoje')).toBeInTheDocument();
    expect(screen.getByText('Nenhum check-out agendado para hoje')).toBeInTheDocument();
  });

  it('o mapa continua a mostrar as unidades', async () => {
    renderHotel();
    expect(await screen.findByText('Quarto 101')).toBeInTheDocument();
    expect(screen.getByText('Mapa de Quartos — Hoje')).toBeInTheDocument();
  });

  it('mantem os cinco indicadores e os blocos de check-in e check-out', async () => {
    carregaServicos({
      hoje: [
        reserva({ id: 'c1', status: 'confirmed', customer_name: 'Ana Entrada' }),
        reserva({ id: 'c2', status: 'checked_in', check_in: '2020-01-01', check_out: HOJE, customer_name: 'Rui Saida' }),
      ],
      res: resumo({ receita: 500 }),
    });
    renderHotel();
    expect(await screen.findByText('Ana Entrada')).toBeInTheDocument();
    expect(screen.getByText('Rui Saida')).toBeInTheDocument();
    expect(screen.getByText('Ocupacao hoje')).toBeInTheDocument();
    expect(screen.getByText('Receita do mês')).toBeInTheDocument();
    expect(screen.getByText('€500')).toBeInTheDocument();
    expect(screen.getByText('Reservas pendentes')).toBeInTheDocument();
    expect(screen.getAllByText('Check-ins hoje').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Check-outs hoje').length).toBeGreaterThan(0);
  });

  it('a receita mostra a variacao face ao mes anterior', async () => {
    carregaServicos({ res: resumo({ receita: 1200 }, { receita: 1000 }) });
    renderHotel();
    expect(await screen.findByText(/^€1\s?200$/)).toBeInTheDocument();
    expect(screen.getByText('+€200')).toBeInTheDocument();
    expect(screen.getByText('face ao mês anterior')).toBeInTheDocument();
  });

  it('sem mes anterior a receita nao mostra variacao', async () => {
    carregaServicos({ res: { atual: { receita: 500 } } });
    renderHotel();
    expect(await screen.findByText('€500')).toBeInTheDocument();
    expect(screen.queryByText('face ao mês anterior')).not.toBeInTheDocument();
  });

  it('uma chamada a falhar nao apaga os dados das outras', async () => {
    const pendente = reserva({ id: 'p1', status: 'pending' });
    carregaServicos({ hoje: [pendente] });
    /* so a lista do mes falha */
    listReservations.mockReset().mockImplementation(async (params) => {
      /* o pedido do mes falha; o de hoje responde (e formas inesperadas lancam) */
      if (params.stay_from === MES_INICIO && params.stay_to === MES_FIM) {
        throw new Error('falha de rede');
      }
      return respostaPorPar(params, { hoje: [pendente], mes: [] });
    });
    renderHotel();
    expect(await screen.findByText('Quarto 101')).toBeInTheDocument();
    expect(screen.getByText('1 reserva(s) por confirmar')).toBeInTheDocument();
    expect(screen.queryByText('Tudo em ordem')).not.toBeInTheDocument();
  });

  it('os pedidos usam stay_from e stay_to', async () => {
    renderHotel();
    expect(await screen.findByText('Tudo em ordem')).toBeInTheDocument();
    await waitFor(() => expect(listReservations).toHaveBeenCalledTimes(3));
    const pedidos = listReservations.mock.calls.map(([params]) => params);
    /* nenhuma chamada recebe as chaves antigas from/to */
    pedidos.forEach((p) => {
      expect(p).not.toHaveProperty('from');
      expect(p).not.toHaveProperty('to');
    });
    /* hoje e o mes atual */
    expect(pedidos).toEqual(expect.arrayContaining([
      { stay_from: HOJE, stay_to: HOJE },
      { stay_from: MES_INICIO, stay_to: MES_FIM },
    ]));
    /* e os hospedes ja instalados, que a sobreposicao de hoje pode nao devolver */
    expect(pedidos).toContainEqual({ status: 'checked_in' });
  });

  it('check-in feito com saida ultrapassada mantem o quarto ocupado e conta na ocupacao', async () => {
    /* o hospede nao fez check-out: a saida foi ontem, logo a sobreposicao de hoje nao o devolve;
       so o pedido dos check-ins feitos o traz */
    carregaServicos({
      units: [
        unidade({ id: 'u1', name: 'Quarto 101' }),
        unidade({ id: 'u2', name: 'Quarto 102' }),
      ],
      checkedIn: [
        reserva({ id: 'o', unit_id: 'u1', status: 'checked_in', check_in: diaLocal(-5), check_out: diaLocal(-1), customer_name: 'Hospede Atrasado' }),
      ],
    });
    renderHotel();
    const celula = async (nome) => (await screen.findByText(nome)).parentElement;
    await waitFor(async () => expect(within(await celula('Quarto 101')).getByText('Ocupado')).toBeInTheDocument());
    expect(within(await celula('Quarto 102')).getByText('Disponivel')).toBeInTheDocument();
    /* 1 de 2 quartos ocupados */
    expect(valorKpi('Ocupacao hoje')).toBe('50.0%');
  });

  it('a mesma reserva devolvida pelos dois pedidos aparece uma so vez', async () => {
    const saida = reserva({ id: 'b', unit_id: 'u1', status: 'checked_in', check_in: diaLocal(-3), check_out: HOJE, customer_name: 'Rui Saida' });
    carregaServicos({ hoje: [saida], checkedIn: [saida] });
    renderHotel();
    const checkouts = (await screen.findByRole('heading', { name: 'Check-outs hoje' })).closest('section');
    /* sem deduplicacao a lista e o contador de saidas contariam 2 */
    await waitFor(() => expect(within(checkouts).getAllByText('Rui Saida')).toHaveLength(1));
    expect(valorKpi('Check-outs hoje')).toBe('1');
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
        reserva({ id: 'b', unit_id: 'u2', status: 'checked_in', check_in: diaLocal(-3), check_out: HOJE, customer_name: 'Rui Saida' }),
        /* entra hoje */
        reserva({ id: 'c', unit_id: 'u3', status: 'confirmed', check_in: HOJE, check_out: diaLocal(3), customer_name: 'Ana Entrada' }),
      ],
      mes: [reserva({ id: 'p', unit_id: 'u4', status: 'pending', check_in: diaLocal(1) })],
    });
    renderHotel();
    const checkins = (await screen.findByRole('heading', { name: 'Check-ins hoje' })).closest('section');
    const checkouts = screen.getByRole('heading', { name: 'Check-outs hoje' }).closest('section');
    const celula = (nome) => screen.getByText(nome).parentElement;
    /* a estadia a meio ocupa o quarto, apesar de nao ter check-in nem check-out hoje */
    expect(within(celula('Quarto 101')).getByText('Ocupado')).toBeInTheDocument();
    expect(within(celula('Quarto 102')).getByText('Ocupado')).toBeInTheDocument();
    expect(within(celula('Quarto 103')).getByText('Check-in')).toBeInTheDocument();
    expect(within(celula('Quarto 104')).getByText('Disponivel')).toBeInTheDocument();
    /* listas de hoje */
    expect(within(checkins).getByText('Ana Entrada')).toBeInTheDocument();
    expect(within(checkins).queryByText('Rui Saida')).not.toBeInTheDocument();
    expect(within(checkins).queryByText('Maria Estadia')).not.toBeInTheDocument();
    expect(within(checkouts).getByText('Rui Saida')).toBeInTheDocument();
    expect(within(checkouts).queryByText('Maria Estadia')).not.toBeInTheDocument();
    /* contadores: 2 de 4 quartos ocupados, 1 check-in, 1 check-out, 1 pendente do mes */
    expect(valorKpi('Ocupacao hoje')).toBe('50.0%');
    expect(valorKpi('Check-ins hoje')).toBe('1');
    expect(valorKpi('Check-outs hoje')).toBe('1');
    expect(valorKpi('Reservas pendentes')).toBe('1');
  });

  it('servicos a falhar mostram estados vazios sem erro', async () => {
    servicosAFalhar();
    renderHotel();
    expect(await screen.findByText('Tudo em ordem')).toBeInTheDocument();
    expect(screen.getByText('Nenhum check-in agendado para hoje')).toBeInTheDocument();
    expect(screen.getByText('Sem unidades registadas.')).toBeInTheDocument();
    await waitFor(() => expect(listUnits).toHaveBeenCalled());
  });

  it('reservas sem campos nao rebentam', async () => {
    const vazia = { id: 'x', status: 'pending' };
    carregaServicos({ units: [{ id: 'u9', name: 'Quarto 9' }], hoje: [vazia], mes: [vazia] });
    renderHotel();
    expect(await screen.findByText('Quarto 9')).toBeInTheDocument();
    expect(screen.getByText('Tudo em ordem')).toBeInTheDocument();
  });
});
