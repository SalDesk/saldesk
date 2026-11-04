import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RentacarDashboard from '../pages/dashboard/RentacarDashboard';
import useUiStore from '../store/uiStore';
import { listUnits } from '../services/unitsService';
import { listReservations } from '../services/reservationsService';
import { getResumo } from '../services/financeiroService';

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

/* Responde conforme o par exato (stay_from, stay_to): hoje ou mes. Qualquer outra forma de
   argumentos (por exemplo from/to) lanca, para apanhar pedidos perdidos. */
function respostaPorPar(params, { hoje, mes }) {
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

function carregaServicos({ units = [viatura({ plate: 'AA-00-AA' })], hoje = [], mes = [], res = resumo() } = {}) {
  listUnits.mockReset().mockResolvedValue(units);
  listReservations.mockReset().mockImplementation(async (params) => (
    respostaPorPar(params, { hoje, mes })
  ));
  getResumo.mockReset().mockResolvedValue(res);
}

function servicosAFalhar() {
  const erro = new Error('falha de rede');
  listUnits.mockReset().mockRejectedValue(erro);
  listReservations.mockReset().mockRejectedValue(erro);
  getResumo.mockReset().mockRejectedValue(erro);
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

  it('documento expirado aparece como critico', async () => {
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

  it('revisao atrasada conta como critica', async () => {
    carregaServicos({
      units: [viatura({ plate: 'R-33-EF', next_revision_km: 10000, current_km: 10400 })],
    });
    renderRentacar();
    const item = await screen.findByText('R-33-EF: Revisao atrasada (400km)');
    expect(item.closest('li').querySelector('[data-severity="critical"]')).not.toBeNull();
  });

  it('aviso a menos de 30 dias', async () => {
    carregaServicos({
      units: [viatura({ plate: 'W-22-CD', inspecao_expiry: dataEmDias(10) })],
    });
    renderRentacar();
    const aviso = await screen.findByText(/^W-22-CD: Inspecao expira em \d+d$/);
    expect(aviso.closest('li').querySelector('[data-severity="warning"]')).not.toBeNull();
    expect(aviso.closest('li').querySelector('[data-severity="critical"]')).toBeNull();
    expect(screen.queryByText('Tudo em ordem')).not.toBeInTheDocument();
  });

  it('documento a mais de 30 dias nao gera alerta', async () => {
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
    /* sem levantamentos nem devolucoes: estados vazios compactos */
    expect(screen.getByText('Nenhum levantamento agendado para hoje')).toBeInTheDocument();
    expect(screen.getByText('Nenhuma devolucao agendada para hoje')).toBeInTheDocument();
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

  it('mantem os indicadores e as listas de levantamentos e devolucoes', async () => {
    carregaServicos({
      units: [viatura({ plate: 'L-66-KL' })],
      hoje: [
        reserva({ id: 'c1', status: 'confirmed', customer_name: 'Ana Levanta' }),
        reserva({ id: 'c2', status: 'checked_in', check_in: '2020-01-01', check_out: HOJE, customer_name: 'Rui Devolve' }),
      ],
      res: resumo({ receita: 500 }),
    });
    renderRentacar();
    expect(await screen.findByText('Ana Levanta')).toBeInTheDocument();
    expect(screen.getByText('Rui Devolve')).toBeInTheDocument();
    expect(screen.getByText('Viaturas disponiveis')).toBeInTheDocument();
    expect(screen.getByText('Receita do mês')).toBeInTheDocument();
    expect(screen.getByText('€500')).toBeInTheDocument();
    expect(screen.getByText('Alugueres activos')).toBeInTheDocument();
    expect(screen.getByText('Em manutencao')).toBeInTheDocument();
    expect(screen.getByText('Levantamentos hoje')).toBeInTheDocument();
    expect(screen.getByText('Devolucoes hoje')).toBeInTheDocument();
  });

  it('a receita mostra a variacao face ao mes anterior', async () => {
    carregaServicos({ res: resumo({ receita: 1200 }, { receita: 1000 }) });
    renderRentacar();
    expect(await screen.findByText(/^€1\s?200$/)).toBeInTheDocument();
    expect(screen.getByText('+€200')).toBeInTheDocument();
    expect(screen.getByText('face ao mês anterior')).toBeInTheDocument();
  });

  it('sem mes anterior a receita nao mostra variacao', async () => {
    carregaServicos({ res: { atual: { receita: 500 } } });
    renderRentacar();
    expect(await screen.findByText('€500')).toBeInTheDocument();
    expect(screen.queryByText('face ao mês anterior')).not.toBeInTheDocument();
  });

  it('uma chamada a falhar nao apaga os dados das outras', async () => {
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
    expect(await screen.findByText('Ana Levanta')).toBeInTheDocument();
    expect(screen.getByText('E-11-AB: Seguro expirado')).toBeInTheDocument();
    expect(screen.queryByText('Tudo em ordem')).not.toBeInTheDocument();
  });

  it('os pedidos usam stay_from e stay_to', async () => {
    renderRentacar();
    expect(await screen.findByText('Tudo em ordem')).toBeInTheDocument();
    await waitFor(() => expect(listReservations).toHaveBeenCalledTimes(2));
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
  });

  it('aluguer em curso, devolucao e levantamento de hoje entram na frota, nas listas e nos contadores', async () => {
    /* o servidor devolve tambem os alugueres que apenas sobrepoem hoje */
    carregaServicos({
      units: [
        viatura({ plate: 'AA-11-AA' }, { id: 'v1', name: 'Viatura 1' }),
        viatura({ plate: 'BB-22-BB' }, { id: 'v2', name: 'Viatura 2' }),
        viatura({ plate: 'CC-33-CC' }, { id: 'v3', name: 'Viatura 3' }),
      ],
      hoje: [
        /* comecou ha 2 dias e devolve daqui a 3: sem levantamento nem devolucao hoje */
        reserva({ id: 'a', unit_id: 'v1', status: 'checked_in', check_in: dataEmDias(-2), check_out: dataEmDias(3), customer_name: 'Cliente Em Curso' }),
        /* devolve hoje */
        reserva({ id: 'b', unit_id: 'v2', status: 'checked_in', check_in: dataEmDias(-4), check_out: HOJE, customer_name: 'Rui Devolve' }),
        /* levanta hoje */
        reserva({ id: 'c', unit_id: 'v3', status: 'confirmed', check_in: HOJE, check_out: dataEmDias(2), customer_name: 'Ana Levanta' }),
      ],
    });
    renderRentacar();
    const levantamentos = (await screen.findByRole('heading', { name: 'Levantamentos hoje' })).closest('section');
    const devolucoes = screen.getByRole('heading', { name: 'Devolucoes hoje' }).closest('section');
    const cartao = (matricula) => screen.getByText(matricula).closest('button');
    /* o aluguer em curso mantem o veiculo alugado */
    expect(within(cartao('AA-11-AA')).getByText('Ocupado')).toBeInTheDocument();
    expect(within(cartao('BB-22-BB')).getByText('Ocupado')).toBeInTheDocument();
    expect(within(cartao('CC-33-CC')).getByText('Disponivel')).toBeInTheDocument();
    /* listas de hoje */
    expect(within(levantamentos).getByText('Ana Levanta')).toBeInTheDocument();
    expect(within(levantamentos).queryByText('Cliente Em Curso')).not.toBeInTheDocument();
    expect(within(devolucoes).getByText('Rui Devolve')).toBeInTheDocument();
    expect(within(devolucoes).queryByText('Cliente Em Curso')).not.toBeInTheDocument();
    /* contadores: 2 alugados, 1 disponivel */
    expect(valorKpi('Alugueres activos')).toBe('2');
    expect(valorKpi('Viaturas disponiveis')).toBe('1');
  });

  it('servicos a falhar mostram estados vazios sem erro', async () => {
    servicosAFalhar();
    renderRentacar();
    expect(await screen.findByText('Tudo em ordem')).toBeInTheDocument();
    expect(screen.getByText('Nenhum levantamento agendado para hoje')).toBeInTheDocument();
    expect(screen.getByText('Sem viaturas registadas.')).toBeInTheDocument();
    await waitFor(() => expect(listUnits).toHaveBeenCalled());
  });

  it('reservas sem campos nao rebentam', async () => {
    const vazia = { id: 'x', status: 'pending' };
    carregaServicos({ units: [{ id: 'u9', name: 'Viatura 9' }], hoje: [vazia], mes: [vazia] });
    renderRentacar();
    expect(await screen.findByText('Viatura 9')).toBeInTheDocument();
    expect(screen.getByText('Tudo em ordem')).toBeInTheDocument();
  });
});
