import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RentacarDashboard from '../pages/dashboard/RentacarDashboard';
import useUiStore from '../store/uiStore';
import { listUnits } from '../services/unitsService';
import { listReservations } from '../services/reservationsService';
import { getResumo, getReceita } from '../services/financeiroService';
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
const HOJE = new Date().toLocaleDateString('en-CA');
const MES_INICIO = HOJE.slice(0, 8) + '01';
const MES_FIM = (() => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth() + 1, 0).toLocaleDateString('en-CA');
})();

/* Data relativa a hoje (negativo = passado), nunca fica desactualizada */
function dataEmDias(dias) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toLocaleDateString('en-CA');
}

const ZERO = { receita: 0, num_reservas: 0, valor_medio: 0, taxa_ocupacao: 0 };
function resumo(atual = {}, anterior = {}) {
  return {
    atual: { ...ZERO, ...atual },
    anterior: { ...ZERO, ...anterior },
    variacao: { ...ZERO },
  };
}

/* Viatura completa; os dados do veiculo vao em description (JSON) */
function viatura(meta, over) {
  return {
    id: 'v1', name: 'Viatura 1', unit_type: 'car', status: 'available', is_active: true,
    description: JSON.stringify(meta),
    ...over,
  };
}

/* Reserva completa; sobrepoe-se o que interessa a cada teste */
function reserva(over) {
  return {
    id: 'r', unit_id: 'v1', status: 'confirmed', check_in: HOJE,
    check_out: MES_FIM, customer_name: 'Cliente', total_price: 100, ...over,
  };
}

/* Responde conforme o par exato (stay_from, stay_to): hoje ou mes, ou ao pedido exato
   { status: 'checked_in' } (alugueres ja levantados). Qualquer outra forma de argumentos
   (por exemplo from/to) lanca, para apanhar pedidos perdidos. */
function respostaPorPar(params, { hoje, mes, checkedIn = [], porPagar = [] }) {
  /* moldura comum: pagamentos por regularizar de qualquer mes */
  if (Object.keys(params || {}).join(',') === 'payment_status' && params.payment_status === 'pending,partial') {
    return porPagar;
  }
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
  /* moldura comum: proximos 7 dias */
  if (de === HOJE && ate === dataEmDias(6)) return [];
  throw new Error(`pedido inesperado ${de} ${ate}`);
}

/* Valor de um indicador pelo seu rotulo (o <p> do cartao; os titulos das listas sao <h2>) */
function valorKpi(rotulo) {
  return screen.getByText(rotulo).previousElementSibling.textContent;
}

function carregaServicos({ units = [viatura({ plate: 'AA-00-AA' })], hoje = [], mes = [], checkedIn = [], res = resumo() } = {}) {
  listUnits.mockReset().mockResolvedValue(units);
  listReservations.mockReset().mockImplementation(async (params) => (
    respostaPorPar(params, { hoje, mes, checkedIn })
  ));
  getResumo.mockReset().mockResolvedValue(res);
  getReceita.mockReset().mockResolvedValue([]);
  api.get.mockReset().mockResolvedValue({ data: { data: null } });
}

function servicosAFalhar() {
  const erro = new Error('falha de rede');
  listUnits.mockReset().mockRejectedValue(erro);
  listReservations.mockReset().mockRejectedValue(erro);
  getResumo.mockReset().mockRejectedValue(erro);
  getReceita.mockReset().mockRejectedValue(erro);
  api.get.mockReset().mockRejectedValue(erro);
}

function renderRentacar() {
  return render(
    <MemoryRouter future={FUTURE}>
      <RentacarDashboard />
    </MemoryRouter>
  );
}

describe('RentacarDashboard (Hoje)', () => {
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

  it('documento expirado aparece como crítico', async () => {
    carregaServicos({
      units: [
        /* o aviso vem primeiro na lista: o painel tem de por o expirado antes */
        viatura({ plate: 'W-22-CD', iuc_expiry: dataEmDias(10) }, { id: 'v1' }),
        viatura({ plate: 'E-11-AB', seguro_expiry: dataEmDias(-1) }, { id: 'v2' }),
      ],
    });
    renderRentacar();
    const expirado = await screen.findByText('E-11-AB: Seguro expirado');
    expect(expirado).toBeInTheDocument();
    const aviso = screen.getByText(/^W-22-CD: IUC expira em \d+d$/);
    /* o expirado vem antes do aviso no painel */
    expect(
      expirado.compareDocumentPosition(aviso) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    /* gravidade critica no ponto do item expirado */
    expect(expirado.closest('li').querySelector('[data-severity="critical"]')).not.toBeNull();
    expect(aviso.closest('li').querySelector('[data-severity="warning"]')).not.toBeNull();
    expect(screen.queryByText('Tudo em ordem')).not.toBeInTheDocument();
    /* a linha abre a frota */
    fireEvent.click(screen.getByRole('button', { name: /E-11-AB: Seguro expirado/ }));
    expect(navigateMock).toHaveBeenLastCalledWith('/unidades');
  });

  it('revisão atrasada conta como crítica', async () => {
    carregaServicos({
      units: [viatura({ plate: 'R-33-EF', next_revision_km: 10000, current_km: 10400 })],
    });
    renderRentacar();
    const item = await screen.findByText('R-33-EF: Revisão atrasada (400km)');
    expect(item.closest('li').querySelector('[data-severity="critical"]')).not.toBeNull();
  });

  it('aviso a menos de 30 dias', async () => {
    carregaServicos({
      units: [viatura({ plate: 'W-22-CD', inspecao_expiry: dataEmDias(10) })],
    });
    renderRentacar();
    const aviso = await screen.findByText(/^W-22-CD: Inspeção expira em \d+d$/);
    expect(aviso.closest('li').querySelector('[data-severity="warning"]')).not.toBeNull();
    expect(aviso.closest('li').querySelector('[data-severity="critical"]')).toBeNull();
    expect(screen.queryByText('Tudo em ordem')).not.toBeInTheDocument();
  });

  it('documento a mais de 30 dias não gera alerta', async () => {
    carregaServicos({
      units: [viatura({ plate: 'F-44-GH', seguro_expiry: dataEmDias(90) })],
    });
    renderRentacar();
    expect(await screen.findByText('Tudo em ordem')).toBeInTheDocument();
  });

  it('sem alertas mostra Tudo em ordem', async () => {
    renderRentacar();
    expect(await screen.findByText('Tudo em ordem')).toBeInTheDocument();
    expect(screen.getByText('Requer atenção')).toBeInTheDocument();
    /* sem levantamentos nem devolucoes: a agenda mostra o estado vazio */
    expect(screen.getByText('Nada agendado para hoje')).toBeInTheDocument();
  });

  it('a frota continua a mostrar o veiculo', async () => {
    carregaServicos({
      units: [viatura({ plate: 'P-55-IJ', brand: 'Toyota', model: 'Yaris' })],
    });
    renderRentacar();
    expect(await screen.findByText('P-55-IJ')).toBeInTheDocument();
    expect(screen.getByText('Toyota Yaris')).toBeInTheDocument();
    expect(screen.getByText('Frota — Estado Actual')).toBeInTheDocument();
  });

  it('agenda_com_levantamento_com_hora_e_devolucao_sem_hora', async () => {
    carregaServicos({
      units: [viatura({ plate: 'L-66-KL', brand: 'Kia', model: 'Picanto' })],
      hoje: [
        reserva({ id: 'c1', status: 'confirmed', start_time: '09:30:00', customer_name: 'Ana Levanta' }),
        reserva({ id: 'c2', status: 'checked_in', check_in: '2020-01-01', check_out: HOJE, customer_name: 'Rui Devolve' }),
      ],
      res: resumo({ receita: 500 }),
    });
    renderRentacar();
    const lev = await screen.findByRole('button', { name: /Levantamento · Ana Levanta/ });
    expect(lev).toHaveTextContent('Kia Picanto · L-66-KL');
    expect(screen.getByText('09:30')).toBeInTheDocument();
    /* a devolucao nao tem hora: vai para "Sem hora marcada" */
    expect(screen.getByText('Sem hora marcada')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Devolução · Rui Devolve/ })).toBeInTheDocument();
    expect(screen.getByText('1 levantamentos · 1 devoluções')).toBeInTheDocument();
    /* as listas antigas sairam; a frota fica */
    expect(screen.queryByRole('heading', { name: 'Levantamentos hoje' })).toBeNull();
    expect(screen.getByText('Frota — Estado Actual')).toBeInTheDocument();
  });

  it('cartao_mostra_viaturas_alugadas_e_ocupacao_hoje', async () => {
    carregaServicos({
      units: [viatura({ plate: 'AA-11-AA' }, { id: 'v1' }), viatura({ plate: 'BB-22-BB' }, { id: 'v2' })],
      hoje: [reserva({ id: 'a', unit_id: 'v1', status: 'checked_in', check_in: dataEmDias(-1), check_out: dataEmDias(2) })],
      res: resumo({ receita: 500 }),
    });
    renderRentacar();
    expect(await screen.findByText('1 de 2 viaturas')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('Ocupação hoje')).toBeInTheDocument();
    expect(screen.getByText('€500')).toBeInTheDocument();
    expect(screen.getByText('0 levantamentos')).toBeInTheDocument();
    expect(screen.getByText('0 devoluções')).toBeInTheDocument();
    ['Viaturas disponíveis', 'Avaliação média', 'Valor médio por reserva', 'Por receber']
      .forEach((rotulo) => expect(screen.getByText(rotulo)).toBeInTheDocument());
    expect(valorKpi('Viaturas disponíveis')).toBe('1');
  });

  it('molduras_sem_resumo_nao_rebentam', async () => {
    carregaServicos({ res: null });
    renderRentacar();
    expect((await screen.findAllByText('€0')).length).toBeGreaterThan(0);
    expect(screen.queryByText(/vs mês anterior/)).toBeNull();
  });

  it('a receita mostra a variação face ao mês anterior', async () => {
    carregaServicos({ res: resumo({ receita: 1200 }, { receita: 1000 }) });
    renderRentacar();
    expect(await screen.findByText(`€${(1200).toLocaleString('pt-PT')}`)).toBeInTheDocument();
    expect(screen.getByText('+20% vs mês anterior')).toBeInTheDocument();
  });

  it('sem mês anterior a receita não mostra variação', async () => {
    carregaServicos({ res: { atual: { receita: 500 } } });
    renderRentacar();
    expect(await screen.findByText('€500')).toBeInTheDocument();
    expect(screen.queryByText(/vs mês anterior/)).not.toBeInTheDocument();
  });

  it('uma chamada a falhar não apaga os dados das outras', async () => {
    const unidades = [viatura({ plate: 'E-11-AB', seguro_expiry: dataEmDias(-1) })];
    const levanta = reserva({ id: 'c1', status: 'confirmed', customer_name: 'Ana Levanta' });
    carregaServicos({ units: unidades, hoje: [levanta] });
    /* so a lista do mes falha */
    listReservations.mockReset().mockImplementation(async (params) => {
      /* o pedido do mes falha; o de hoje responde (e formas inesperadas lancam) */
      if (params.stay_from === MES_INICIO && params.stay_to === MES_FIM) {
        throw new Error('falha de rede');
      }
      return respostaPorPar(params, { hoje: [levanta], mes: [] });
    });
    renderRentacar();
    expect(await screen.findByRole('button', { name: /Levantamento · Ana Levanta/ })).toBeInTheDocument();
    expect(screen.getByText('E-11-AB: Seguro expirado')).toBeInTheDocument();
    expect(screen.queryByText('Tudo em ordem')).not.toBeInTheDocument();
  });

  it('os pedidos usam stay_from e stay_to', async () => {
    renderRentacar();
    expect(await screen.findByText('Tudo em ordem')).toBeInTheDocument();
    await waitFor(() => expect(listReservations).toHaveBeenCalledTimes(5));
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
    /* e os alugueres ja levantados, que a sobreposicao de hoje pode nao devolver */
    expect(pedidos).toContainEqual({ status: 'checked_in' });
    /* moldura comum: 7 dias e pagamentos por regularizar */
    expect(pedidos).toContainEqual({ stay_from: HOJE, stay_to: dataEmDias(6) });
    expect(pedidos).toContainEqual({ payment_status: 'pending,partial' });
  });

  it('aluguer levantado com devolução ultrapassada mantem a viatura alugada e conta nos alugueres activos', async () => {
    /* a viatura nao foi devolvida: a devolucao era ontem, logo a sobreposicao de hoje nao a devolve;
       so o pedido dos levantamentos feitos a traz */
    carregaServicos({
      units: [
        viatura({ plate: 'AA-11-AA' }, { id: 'v1', name: 'Viatura 1' }),
        viatura({ plate: 'BB-22-BB' }, { id: 'v2', name: 'Viatura 2' }),
      ],
      checkedIn: [
        reserva({ id: 'o', unit_id: 'v1', status: 'checked_in', check_in: dataEmDias(-5), check_out: dataEmDias(-1), customer_name: 'Cliente Atrasado' }),
      ],
    });
    renderRentacar();
    const cartao = async (matricula) => (await screen.findByText(matricula)).closest('button');
    await waitFor(async () => expect(within(await cartao('AA-11-AA')).getByText('Ocupado')).toBeInTheDocument());
    expect(within(await cartao('BB-22-BB')).getByText('Disponível')).toBeInTheDocument();
    expect(screen.getByText('1 de 2 viaturas')).toBeInTheDocument();
    expect(valorKpi('Viaturas disponíveis')).toBe('1');
  });

  it('o mesmo aluguer devolvido pelos dois pedidos aparece uma só vez', async () => {
    const devolve = reserva({ id: 'b', unit_id: 'v1', status: 'checked_in', check_in: dataEmDias(-4), check_out: HOJE, customer_name: 'Rui Devolve' });
    carregaServicos({ units: [viatura({ plate: 'AA-11-AA' })], hoje: [devolve], checkedIn: [devolve] });
    renderRentacar();
    /* sem deduplicacao a agenda mostraria a devolucao duas vezes */
    await waitFor(() => expect(screen.getAllByRole('button', { name: /Devolução · Rui Devolve/ })).toHaveLength(1));
    expect(screen.getByText('1 de 1 viaturas')).toBeInTheDocument();
  });

  it('aluguer em curso, devolução e levantamento de hoje entram na frota, nas listas e nos contadores', async () => {
    /* o servidor devolve tambem os alugueres que apenas sobrepoem hoje */
    carregaServicos({
      units: [
        viatura({ plate: 'AA-11-AA' }, { id: 'v1', name: 'Viatura 1' }),
        viatura({ plate: 'BB-22-BB' }, { id: 'v2', name: 'Viatura 2' }),
        viatura({ plate: 'CC-33-CC' }, { id: 'v3', name: 'Viatura 3' }),
      ],
      hoje: [
        /* comecou ha 2 dias e devolve daqui a 3: sem levantamento nem devolução hoje */
        reserva({ id: 'a', unit_id: 'v1', status: 'checked_in', check_in: dataEmDias(-2), check_out: dataEmDias(3), customer_name: 'Cliente Em Curso' }),
        /* devolve hoje */
        reserva({ id: 'b', unit_id: 'v2', status: 'checked_in', check_in: dataEmDias(-4), check_out: HOJE, customer_name: 'Rui Devolve' }),
        /* levanta hoje */
        reserva({ id: 'c', unit_id: 'v3', status: 'confirmed', check_in: HOJE, check_out: dataEmDias(2), customer_name: 'Ana Levanta' }),
      ],
    });
    renderRentacar();
    const agenda = (await screen.findByRole('heading', { name: 'Agenda de hoje' })).closest('section');
    await screen.findByRole('button', { name: /Levantamento · Ana Levanta/ });
    const cartao = (matricula) => screen.getAllByText(matricula).find((e) => e.closest('button')?.className.includes('aspect') || e.tagName === 'P').closest('button');
    /* o aluguer em curso mantem o veiculo alugado */
    expect(within(cartao('AA-11-AA')).getByText('Ocupado')).toBeInTheDocument();
    expect(within(cartao('BB-22-BB')).getByText('Ocupado')).toBeInTheDocument();
    expect(within(cartao('CC-33-CC')).getByText('Disponível')).toBeInTheDocument();
    /* agenda de hoje: so o levantamento e a devolucao; o aluguer em curso nao */
    expect(within(agenda).getByRole('button', { name: /Devolução · Rui Devolve/ })).toBeInTheDocument();
    expect(within(agenda).queryByText(/Cliente Em Curso/)).not.toBeInTheDocument();
    /* contadores: 2 alugados, 1 disponivel */
    expect(screen.getByText('2 de 3 viaturas')).toBeInTheDocument();
    expect(valorKpi('Viaturas disponíveis')).toBe('1');
  });

  it('serviços a falhar mostram estados vazios sem erro', async () => {
    servicosAFalhar();
    renderRentacar();
    expect(await screen.findByText('Tudo em ordem')).toBeInTheDocument();
    expect(screen.getByText('Nada agendado para hoje')).toBeInTheDocument();
    expect(screen.getByText('Sem viaturas registadas.')).toBeInTheDocument();
    await waitFor(() => expect(listUnits).toHaveBeenCalled());
  });

  it('reservas sem campos não rebentam', async () => {
    const vazia = { id: 'x', status: 'pending' };
    carregaServicos({ units: [{ id: 'u9', name: 'Viatura 9' }], hoje: [vazia], mes: [vazia] });
    renderRentacar();
    expect(await screen.findByText('Viatura 9')).toBeInTheDocument();
    expect(screen.getByText('Tudo em ordem')).toBeInTheDocument();
  });
});
