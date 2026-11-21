import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RestaurantDashboard from '../pages/dashboard/RestaurantDashboard';
import useUiStore from '../store/uiStore';
import { listUnits } from '../services/unitsService';
import { listReservations } from '../services/reservationsService';
import { getResumo, getReceita } from '../services/financeiroService';
import { listOrders } from '../services/ordersService';
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
vi.mock('../services/ordersService', () => ({
  listOrders: vi.fn(),
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
const SEMANA_FIM = (() => { const d = new Date(); d.setDate(d.getDate() + 6); return d.toLocaleDateString('en-CA'); })();
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

/* Responde conforme o par exato (stay_from, stay_to): hoje ou mes. Qualquer outra forma de
   argumentos (por exemplo from/to) lanca, para apanhar pedidos perdidos. */
function respostaPorPar(params, { hoje, mes }) {
  /* moldura comum: pagamentos por regularizar de qualquer mes */
  if (Object.keys(params || {}).join(',') === 'payment_status' && params.payment_status === 'pending,partial') return [];
  if (Object.keys(params || {}).sort().join(',') !== 'stay_from,stay_to') {
    throw new Error(`pedido inesperado ${JSON.stringify(params)}`);
  }
  const { stay_from: de, stay_to: ate } = params;
  /* O dia 1 pode ser igual a hoje: so o par completo separa os pedidos */
  if (de === HOJE && ate === HOJE) return hoje;
  if (de === MES_INICIO && ate === MES_FIM) return mes;
  /* moldura comum: proximos 7 dias */
  if (de === HOJE && ate === SEMANA_FIM) return [];
  throw new Error(`pedido inesperado ${de} ${ate}`);
}

function carregaServicos({ units = [mesa()], hoje = [], mes = [], res = resumo(), rating = null, ratingTotal = 3, pedidos = [] } = {}) {
  listUnits.mockReset().mockResolvedValue(units);
  getReceita.mockReset().mockResolvedValue([]);
  listOrders.mockReset().mockResolvedValue(pedidos);
  listReservations.mockReset().mockImplementation(async (params) => (
    respostaPorPar(params, { hoje, mes })
  ));
  getResumo.mockReset().mockResolvedValue(res);
  /* Forma real de GET /reviews/stats: { total, average, distribution } */
  api.get.mockReset().mockResolvedValue({
    data: { data: { total: rating == null ? 0 : ratingTotal, average: rating ?? 0, distribution: {} } },
  });
}

function servicosAFalhar() {
  const erro = new Error('falha de rede');
  listUnits.mockReset().mockRejectedValue(erro);
  listReservations.mockReset().mockRejectedValue(erro);
  getResumo.mockReset().mockRejectedValue(erro);
  getReceita.mockReset().mockRejectedValue(erro);
  listOrders.mockReset().mockRejectedValue(erro);
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
    expect(screen.getByText('Mesa disponível.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByText('Mesa disponível.')).not.toBeInTheDocument();
  });

  it('reserva pendente de hoje aparece no painel de atenção', async () => {
    carregaServicos({
      hoje: [reserva({ id: 'p1', status: 'pending' }), reserva({ id: 'p2', status: 'pending', unit_id: 'm2' })],
    });
    renderRestaurant();
    const item = await screen.findByText('2 reserva(s) pendente(s) para hoje');
    expect(item.closest('li').querySelector('[data-severity="warning"]')).not.toBeNull();
    expect(screen.getByText('Requer atenção')).toBeInTheDocument();
    expect(screen.queryByText('Tudo em ordem')).not.toBeInTheDocument();
    /* o aviso antigo, em bloco proprio, deixa de existir */
    expect(screen.queryByText('2 reserva(s) sem confirmação hoje')).not.toBeInTheDocument();
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

  it('o dashboard não repete as ações do cabeçalho', async () => {
    renderRestaurant();
    await screen.findByText('Mesa 1');
    expect(screen.queryByRole('button', { name: 'Nova reserva' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver calendário' })).not.toBeInTheDocument();
  });

  it('sem reservas mostra o estado vazio da agenda', async () => {
    renderRestaurant();
    const vazio = await screen.findByText('Nada agendado para hoje');
    expect(vazio).toHaveClass('font-display');
    expect(screen.queryByText('Sem reservas de almoço')).not.toBeInTheDocument();
  });

  it('agenda_por_hora_com_mesa_e_pre_pedido', async () => {
    carregaServicos({
      units: [mesa({ id: 'm1', name: 'Mesa 1', description: JSON.stringify({ number: 4 }) })],
      hoje: [
        reserva({ id: 'j1', status: 'confirmed', customer_name: 'Rui Jantar', start_time: '20:30:00' }, 'jantar'),
        reserva({ id: 'a1', status: 'confirmed', customer_name: 'Ana Almoço', start_time: '13:00:00' }, 'almoco'),
        reserva({ id: 'o1', status: 'pending', customer_name: 'Eva Outros' }),
      ],
      pedidos: [{ id: 'ord1', reservation_id: 'j1' }],
    });
    renderRestaurant();
    const jantar = await screen.findByRole('button', { name: /Rui Jantar/ });
    const almoco = screen.getByRole('button', { name: /Ana Almoço/ });
    expect(jantar).toHaveTextContent('Mesa 4 · 2 pessoa(s) · pré-pedido');
    expect(almoco).not.toHaveTextContent('pré-pedido');
    /* ordem por hora: almoco antes do jantar */
    expect(almoco.compareDocumentPosition(jantar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    /* sem hora: grupo proprio, com a pendente */
    expect(screen.getByText('Sem hora marcada')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Eva Outros/ })).toHaveTextContent('1 por confirmar');
    expect(screen.getByText('3 reservas · 6 pessoas')).toBeInTheDocument();
    /* os turnos sairam; o mapa de mesas fica */
    expect(screen.queryByText('Sem turno definido')).not.toBeInTheDocument();
  });

  it('cartao_mostra_mesas_ocupadas_e_pessoas_de_hoje', async () => {
    carregaServicos({
      units: [mesa({ id: 'm1', name: 'Mesa 1' }), mesa({ id: 'm2', name: 'Mesa 2' }), { id: 'p1', name: 'Atum', unit_type: 'menu_item' }],
      hoje: [
        reserva({ id: 'a1', unit_id: 'm1', status: 'confirmed', guests: 4, start_time: '13:00' }),
        reserva({ id: 'o1', unit_id: 'm1', status: 'pending', guests: 3, start_time: '20:00' }),
      ],
      mes: [reserva({ id: 'a1', status: 'confirmed', guests: 4 }), reserva({ id: 'j1', status: 'checked_out', guests: 2 })],
      res: resumo({ receita: 750 }),
      rating: 4.5,
    });
    renderRestaurant();
    expect(await screen.findByText('7 pessoas')).toBeInTheDocument();
    expect(screen.getByText('em 2 reservas · 1 por confirmar')).toBeInTheDocument();
    /* 1 de 2 mesas (o prato nao conta como mesa) */
    expect(screen.getByText('1 de 2 mesas')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('Ocupação hoje')).toBeInTheDocument();
    expect(screen.getByText('€750')).toBeInTheDocument();
    expect(screen.getByText('Covers do mês').previousElementSibling).toHaveTextContent(/^6$/);
    expect(screen.getByText('4.5')).toBeInTheDocument();
    ['Avaliação média', 'Valor médio por reserva', 'Por receber']
      .forEach((rotulo) => expect(screen.getByText(rotulo)).toBeInTheDocument());
  });

  it('molduras_sem_resumo_nao_rebentam', async () => {
    carregaServicos({ res: null });
    renderRestaurant();
    expect((await screen.findAllByText('€0')).length).toBeGreaterThan(0);
    expect(screen.queryByText(/vs mês anterior/)).toBeNull();
  });

  it('a avaliação média vem de average quando ha avaliações', async () => {
    carregaServicos({ rating: 4.7, ratingTotal: 3 });
    renderRestaurant();
    expect(await screen.findByText('4.7')).toBeInTheDocument();
  });

  it('sem avaliações (total 0) a avaliação média mostra o traco', async () => {
    carregaServicos({ rating: 0, ratingTotal: 0 });
    renderRestaurant();
    const rotulo = await screen.findByText('Avaliação média');
    expect(rotulo.previousElementSibling).toHaveTextContent(/^—$/);
  });

  it('a receita mostra a variação face ao mês anterior', async () => {
    carregaServicos({ res: resumo({ receita: 1200 }, { receita: 1000 }) });
    renderRestaurant();
    expect(await screen.findByText(`€${(1200).toLocaleString('pt-PT')}`)).toBeInTheDocument();
    expect(screen.getByText('+20% vs mês anterior')).toBeInTheDocument();
  });

  it('sem mês anterior a receita não mostra variação', async () => {
    carregaServicos({ res: { atual: { receita: 500 } } });
    renderRestaurant();
    expect(await screen.findByText('€500')).toBeInTheDocument();
    expect(screen.queryByText(/vs mês anterior/)).not.toBeInTheDocument();
  });

  it('uma chamada a falhar não apaga os dados das outras', async () => {
    carregaServicos({ hoje: [reserva({ id: 'p1', status: 'pending' })] });
    /* so a lista do mes falha */
    listReservations.mockReset().mockImplementation(async (params) => {
      /* o pedido do mes falha; o de hoje responde (e formas inesperadas lancam) */
      if (params.stay_from === MES_INICIO && params.stay_to === MES_FIM) {
        throw new Error('falha de rede');
      }
      return respostaPorPar(params, { hoje: [reserva({ id: 'p1', status: 'pending' })], mes: [] });
    });
    renderRestaurant();
    expect(await screen.findByText('Mesa 1')).toBeInTheDocument();
    expect(screen.getByText('1 reserva(s) pendente(s) para hoje')).toBeInTheDocument();
    expect(screen.queryByText('Tudo em ordem')).not.toBeInTheDocument();
  });

  it('os pedidos usam stay_from e stay_to', async () => {
    renderRestaurant();
    expect(await screen.findByText('Tudo em ordem')).toBeInTheDocument();
    await waitFor(() => expect(listReservations).toHaveBeenCalledTimes(4));
    const pedidos = listReservations.mock.calls.map(([params]) => params);
    /* nenhuma chamada recebe as chaves antigas from/to */
    pedidos.forEach((p) => {
      expect(p).not.toHaveProperty('from');
      expect(p).not.toHaveProperty('to');
    });
    /* uma saida ultrapassada nao e relevante aqui: nunca se pedem os check-ins feitos */
    expect(pedidos).not.toContainEqual({ status: 'checked_in' });
    /* hoje e o mes atual */
    expect(pedidos).toEqual(expect.arrayContaining([
      { stay_from: HOJE, stay_to: HOJE },
      { stay_from: MES_INICIO, stay_to: MES_FIM },
      { stay_from: HOJE, stay_to: SEMANA_FIM },
      { payment_status: 'pending,partial' },
    ]));
    /* o pre-pedido vem dos pedidos */
    expect(listOrders).toHaveBeenCalled();
  });

  it('só a reserva pendente de hoje entra no painel de atenção', async () => {
    /* o servidor entrega as reservas de hoje; so a pendente pede atencao */
    carregaServicos({
      hoje: [
        reserva({ id: 'p1', status: 'pending', customer_name: 'Eva Pendente' }, 'jantar'),
        reserva({ id: 'c1', status: 'confirmed', customer_name: 'Ana Confirmada' }, 'almoco'),
        reserva({ id: 'x1', status: 'cancelled', customer_name: 'Zé Cancelado' }, 'almoco'),
      ],
    });
    renderRestaurant();
    const item = await screen.findByText('1 reserva(s) pendente(s) para hoje');
    expect(item.closest('li').querySelector('[data-severity="warning"]')).not.toBeNull();
    expect(screen.queryByText('Tudo em ordem')).not.toBeInTheDocument();
    /* a reserva pendente e a confirmada contam como reservas de hoje; a cancelada nao */
    expect(screen.getByText('em 2 reservas · 1 por confirmar')).toBeInTheDocument();
  });

  it('serviços a falhar mostram estados vazios sem erro', async () => {
    servicosAFalhar();
    renderRestaurant();
    expect(await screen.findByText('Tudo em ordem')).toBeInTheDocument();
    expect(screen.getByText('Sem mesas registadas.')).toBeInTheDocument();
    expect(screen.getByText('Nada agendado para hoje')).toBeInTheDocument();
    await waitFor(() => expect(listUnits).toHaveBeenCalled());
  });

  it('reservas sem campos não rebentam', async () => {
    const vazia = { id: 'x', status: 'pending' };
    carregaServicos({ hoje: [vazia], mes: [vazia] });
    renderRestaurant();
    expect(await screen.findByText('Mesa 1')).toBeInTheDocument();
    expect(screen.getByText('1 reserva(s) pendente(s) para hoje')).toBeInTheDocument();
    /* sem mesa a reserva nao entra na agenda, e nada rebenta */
    expect(screen.getByText('Nada agendado para hoje')).toBeInTheDocument();
  });
});
