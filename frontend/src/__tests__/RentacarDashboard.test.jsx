import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

/* Responde a cada pedido conforme o par (from, to): hoje ou mes */
function carregaServicos({ units = [viatura({ plate: 'AA-00-AA' })], hoje = [], mes = [], res = resumo() } = {}) {
  listUnits.mockReset().mockResolvedValue(units);
  listReservations.mockReset().mockImplementation(async ({ from, to }) => {
    /* O dia 1 pode ser igual a hoje: so o par (from, to) separa os pedidos */
    if (from === HOJE && to === HOJE) return hoje;
    if (from === MES_INICIO && to === MES_FIM) return mes;
    throw new Error(`pedido inesperado ${from} ${to}`);
  });
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
    listReservations.mockReset().mockImplementation(async ({ from, to }) => {
      if (from === HOJE && to === HOJE) return [levanta];
      throw new Error('falha de rede');
    });
    renderRentacar();
    expect(await screen.findByText('Ana Levanta')).toBeInTheDocument();
    expect(screen.getByText('E-11-AB: Seguro expirado')).toBeInTheDocument();
    expect(screen.queryByText('Tudo em ordem')).not.toBeInTheDocument();
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
