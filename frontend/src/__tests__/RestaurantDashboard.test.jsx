import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RestaurantDashboard from '../pages/dashboard/RestaurantDashboard';
import useUiStore from '../store/uiStore';
import { listUnits } from '../services/unitsService';
import { listReservations } from '../services/reservationsService';
import { getResumo } from '../services/financeiroService';
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

const ZERO = { receita: 0, num_reservas: 0, valor_medio: 0, taxa_ocupacao: 0 };
function resumo(atual = {}) {
  return {
    atual: { ...ZERO, ...atual },
    anterior: { ...ZERO },
    variacao: { ...ZERO },
  };
}

/* Mesa completa; sobrepoe-se o que interessa a cada teste */
function mesa(over) {
  return { id: 'm1', name: 'Mesa 1', unit_type: 'table', status: 'available', is_active: true, ...over };
}

/* Reserva completa; o turno vai em notes_guest (JSON) */
function reserva(over, turno) {
  return {
    id: 'r', unit_id: 'm1', status: 'confirmed', guests: 2, check_in: HOJE, check_out: HOJE,
    customer_name: 'Cliente', notes_guest: turno ? JSON.stringify({ turno }) : '{}',
    ...over,
  };
}

/* Responde a cada pedido conforme o par (from, to): hoje ou mes */
function carregaServicos({ units = [mesa()], hoje = [], mes = [], res = resumo(), rating = null } = {}) {
  listUnits.mockReset().mockResolvedValue(units);
  listReservations.mockReset().mockImplementation(async ({ from, to }) => {
    /* O dia 1 pode ser igual a hoje: so o par (from, to) separa os pedidos */
    if (from === HOJE && to === HOJE) return hoje;
    if (from === MES_INICIO && to === MES_FIM) return mes;
    throw new Error(`pedido inesperado ${from} ${to}`);
  });
  getResumo.mockReset().mockResolvedValue(res);
  api.get.mockReset().mockResolvedValue({ data: { data: { average_rating: rating } } });
}

function servicosAFalhar() {
  const erro = new Error('falha de rede');
  listUnits.mockReset().mockRejectedValue(erro);
  listReservations.mockReset().mockRejectedValue(erro);
  getResumo.mockReset().mockRejectedValue(erro);
  api.get.mockReset().mockRejectedValue(erro);
}

function renderRestaurant() {
  return render(
    <MemoryRouter future={FUTURE}>
      <RestaurantDashboard />
    </MemoryRouter>
  );
}

describe('RestaurantDashboard (Hoje)', () => {
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

  it('mostra o mapa de mesas', async () => {
    renderRestaurant();
    expect(await screen.findByText('Mesa 1')).toBeInTheDocument();
    expect(screen.getByText('Mapa de Mesas — Hoje')).toBeInTheDocument();
  });

  it('clicar numa mesa abre o detalhe e fecha', async () => {
    carregaServicos({ units: [mesa({ id: 'm1', name: 'Mesa 1' })] });
    renderRestaurant();
    fireEvent.click(await screen.findByText('Mesa 1'));
    expect(screen.getByText('Mesa disponivel.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByText('Mesa disponivel.')).not.toBeInTheDocument();
  });

  it('reserva pendente de hoje aparece no painel de atencao', async () => {
    carregaServicos({
      hoje: [reserva({ id: 'p1', status: 'pending' }), reserva({ id: 'p2', status: 'pending', unit_id: 'm2' })],
    });
    renderRestaurant();
    const item = await screen.findByText('2 reserva(s) pendente(s) para hoje');
    expect(item.closest('li').querySelector('[data-severity="warning"]')).not.toBeNull();
    expect(screen.getByText('Requer atenção')).toBeInTheDocument();
    expect(screen.queryByText('Tudo em ordem')).not.toBeInTheDocument();
    /* o aviso antigo, em bloco proprio, deixa de existir */
    expect(screen.queryByText('2 reserva(s) sem confirmacao hoje')).not.toBeInTheDocument();
    /* a linha abre as reservas */
    fireEvent.click(screen.getByRole('button', { name: /2 reserva\(s\) pendente\(s\) para hoje/ }));
    expect(navigateMock).toHaveBeenLastCalledWith('/reservas');
  });

  it('sem pendentes mostra Tudo em ordem', async () => {
    carregaServicos({ hoje: [reserva({ id: 'c1', status: 'confirmed' })] });
    renderRestaurant();
    expect(await screen.findByText('Tudo em ordem')).toBeInTheDocument();
    expect(screen.getByText('Requer atenção')).toBeInTheDocument();
  });

  it('o dashboard nao repete as acoes do cabecalho', async () => {
    renderRestaurant();
    await screen.findByText('Mesa 1');
    expect(screen.queryByRole('button', { name: 'Nova reserva' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver calendario' })).not.toBeInTheDocument();
  });

  it('sem reservas mostra estados vazios compactos', async () => {
    renderRestaurant();
    const almoco = await screen.findByText('Sem reservas de almoco');
    const jantar = screen.getByText('Sem reservas de jantar');
    /* titulo do estado vazio compacto, nao o paragrafo pequeno antigo */
    expect(almoco).toHaveClass('font-display');
    expect(jantar).toHaveClass('font-display');
    /* sem reservas sem turno nao ha terceira secao */
    expect(screen.queryByText('Sem turno definido')).not.toBeInTheDocument();
  });

  it('mantem os indicadores e as reservas por turno', async () => {
    carregaServicos({
      hoje: [
        reserva({ id: 'a1', status: 'confirmed', customer_name: 'Ana Almoco', guests: 4 }, 'almoco'),
        reserva({ id: 'j1', status: 'checked_in', customer_name: 'Rui Jantar', guests: 2 }, 'jantar'),
        reserva({ id: 'o1', status: 'pending', customer_name: 'Eva Outros', guests: 3 }),
        reserva({ id: 'x1', status: 'cancelled', customer_name: 'Zé Cancelado', guests: 9 }, 'almoco'),
      ],
      mes: [
        reserva({ id: 'a1', status: 'confirmed', guests: 4 }),
        reserva({ id: 'j1', status: 'checked_out', guests: 2 }),
        reserva({ id: 'o1', status: 'pending', guests: 3 }),
      ],
      res: resumo({ receita: 750 }),
      rating: 4.5,
    });
    renderRestaurant();
    expect(await screen.findByText('Ana Almoco')).toBeInTheDocument();
    expect(screen.getByText('Rui Jantar')).toBeInTheDocument();
    expect(screen.getByText('Eva Outros')).toBeInTheDocument();
    expect(screen.queryByText('Zé Cancelado')).not.toBeInTheDocument();
    expect(screen.getByText('Sem turno definido')).toBeInTheDocument();
    /* reservas hoje (pendente + confirmada + sentada) e covers do mes (confirmada + concluida) */
    expect(screen.getByText('Reservas hoje').parentElement.nextElementSibling).toHaveTextContent('3');
    expect(screen.getByText('Covers do mes').parentElement.nextElementSibling).toHaveTextContent('6');
    expect(screen.getByText('€750')).toBeInTheDocument();
    expect(screen.getByText('4.5')).toBeInTheDocument();
    expect(screen.getByText('Receita estimada')).toBeInTheDocument();
    expect(screen.getByText('Avaliação média')).toBeInTheDocument();
  });

  it('servicos a falhar mostram estados vazios sem erro', async () => {
    servicosAFalhar();
    renderRestaurant();
    expect(await screen.findByText('Tudo em ordem')).toBeInTheDocument();
    expect(screen.getByText('Sem mesas registadas.')).toBeInTheDocument();
    expect(screen.getByText('Sem reservas de almoco')).toBeInTheDocument();
    expect(screen.getByText('Sem reservas de jantar')).toBeInTheDocument();
    await waitFor(() => expect(listUnits).toHaveBeenCalled());
  });

  it('reservas sem campos nao rebentam', async () => {
    const vazia = { id: 'x', status: 'pending' };
    carregaServicos({ hoje: [vazia], mes: [vazia] });
    renderRestaurant();
    expect(await screen.findByText('Mesa 1')).toBeInTheDocument();
    expect(screen.getByText('1 reserva(s) pendente(s) para hoje')).toBeInTheDocument();
    /* sem turno definido: cai na terceira secao, com mesa e cliente por omissao */
    expect(screen.getByText('Sem turno definido')).toBeInTheDocument();
    expect(screen.getByText('Sem mesa · pax')).toBeInTheDocument();
  });
});
