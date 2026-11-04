import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Reservations from '../pages/Reservations';
import useAuthStore from '../store/authStore';
import useUiStore from '../store/uiStore';
import { listReservations, changeStatus, getReservation } from '../services/reservationsService';
import { listUnits } from '../services/unitsService';
import { listStaff } from '../services/staffService';

/* Sem rede: todos os servicos usados pela pagina e pelos componentes que ela renderiza
   sao simulados */
vi.mock('../services/reservationsService', () => ({
  listReservations: vi.fn(),
  createReservation: vi.fn(),
  updateReservation: vi.fn(),
  changeStatus: vi.fn(),
  deleteReservation: vi.fn(),
  getReservation: vi.fn(),
}));
vi.mock('../services/unitsService', () => ({
  listUnits: vi.fn(),
}));
vi.mock('../services/staffService', () => ({
  listStaff: vi.fn(),
}));
vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));
vi.mock('../services/fleetService', () => ({
  listFleet: vi.fn().mockResolvedValue([]),
  getFleetAvailability: vi.fn().mockResolvedValue([]),
}));
vi.mock('../services/assignmentService', () => ({
  createCompositeAssignment: vi.fn(),
}));
vi.mock('../services/messagingService', () => ({
  sendReservationMessage: vi.fn(),
  markMessageOpened: vi.fn(),
}));

/* Navegacao simulada */
const navigateMock = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => navigateMock,
}));

const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };

/* Datas locais relativas a hoje, nunca fixas nem em UTC */
function dataLocal(dias = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toLocaleDateString('en-CA');
}
const HOJE = dataLocal(0);
const AMANHA = dataLocal(1);

function unidade(over) {
  return { id: 'u1', name: 'Tour Pedra de Lume', unit_type: 'tour', status: 'active', ...over };
}

/* Reserva completa; sobrepoe-se o que interessa a cada teste */
function reserva(over) {
  return {
    id: 'aaaaaaaa-0001', unit_id: 'u1', status: 'confirmed', guests: 2, source: 'direct',
    check_in: HOJE, check_out: AMANHA, customer_name: 'Cliente Alfa', total_price: 100,
    notes_guest: '{}', units: { name: 'Tour Pedra de Lume' },
    ...over,
  };
}

const DUAS = [
  reserva({ id: 'aaaaaaaa-0001', status: 'confirmed', customer_name: 'Cliente Alfa' }),
  reserva({ id: 'bbbbbbbb-0002', status: 'pending', customer_name: 'Cliente Beta' }),
];

function carregaServicos({ reservas = DUAS, units = [unidade()], staff = [] } = {}) {
  listReservations.mockReset().mockResolvedValue(reservas);
  listUnits.mockReset().mockResolvedValue(units);
  listStaff.mockReset().mockResolvedValue(staff);
  changeStatus.mockReset().mockImplementation(async (id, status) => ({ ...reservas.find(r => r.id === id), status }));
  getReservation.mockReset().mockResolvedValue(reserva({ id: 'aaaaaaaa-0001', customer_email: 'alfa@exemplo.cv' }));
}

function servicosAFalhar() {
  const erro = new Error('falha de rede');
  listReservations.mockReset().mockRejectedValue(erro);
  listUnits.mockReset().mockRejectedValue(erro);
  listStaff.mockReset().mockRejectedValue(erro);
  changeStatus.mockReset().mockRejectedValue(erro);
  getReservation.mockReset().mockRejectedValue(erro);
}

function renderPagina(tipo) {
  useAuthStore.setState({ operator: tipo ? { operator_type: tipo } : null });
  return render(
    <MemoryRouter future={FUTURE}>
      <Reservations />
    </MemoryRouter>
  );
}

describe('Reservations', () => {
  let errSpy;
  let warnSpy;
  let esperaErros;

  beforeEach(() => {
    useUiStore.setState({ lang: 'pt' });
    navigateMock.mockReset();
    carregaServicos();
    esperaErros = false;
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    /* nenhum erro ou aviso no consolo, salvo no caso explicito de servicos a falhar */
    if (!esperaErros) expect(errSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
    warnSpy.mockRestore();
    useAuthStore.setState({ operator: null });
  });

  describe('por tipo de operador', () => {
    it('atividade: titulo e colunas da tabela de tours', async () => {
      renderPagina('activity');
      expect(screen.getByRole('heading', { name: 'Reservas' })).toBeInTheDocument();
      expect(await screen.findByText('Tour')).toBeInTheDocument();
      expect(screen.getByText('Origem')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Manifesto' })).toBeInTheDocument();
      expect(screen.getAllByText('Cliente Alfa').length).toBeGreaterThan(0);
    });

    it('rent-a-car: titulo e colunas de viatura, levantamento e devolucao', async () => {
      carregaServicos({
        reservas: [reserva({ customer_name: 'Cliente Alfa', status: 'confirmed' })],
        units: [unidade({ name: 'Carro 1', unit_type: 'vehicle', description: '{"brand":"Fiat","model":"Panda","plate":"S-01-AB"}' })],
      });
      renderPagina('rentacar');
      expect(screen.getByRole('heading', { name: 'Reservas' })).toBeInTheDocument();
      expect(await screen.findByText('Viatura')).toBeInTheDocument();
      expect(screen.getByText('Devolucao')).toBeInTheDocument();
      expect(screen.getByText('Fiat Panda')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Levantamento' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Manifesto' })).not.toBeInTheDocument();
    });

    it('restaurante: titulo e colunas de mesa, turno e ocasiao', async () => {
      carregaServicos({
        reservas: [reserva({ customer_name: 'Cliente Alfa', start_time: '20:30:00' })],
        units: [unidade({ name: 'M3', unit_type: 'table', description: '{"number":3}' })],
      });
      renderPagina('restaurant');
      expect(screen.getByRole('heading', { name: 'Reservas' })).toBeInTheDocument();
      expect(await screen.findByText('Mesa')).toBeInTheDocument();
      expect(screen.getByText('Ocasiao')).toBeInTheDocument();
      expect(screen.getByText('Mesa 3')).toBeInTheDocument();
      expect(screen.getByText('20:30')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Jantar' })).toBeInTheDocument();
    });

    it('hotel: titulo e cartoes de reserva', async () => {
      renderPagina('hotel');
      expect(screen.getByRole('heading', { name: 'Reservas' })).toBeInTheDocument();
      expect(await screen.findByText('Cliente Alfa')).toBeInTheDocument();
      expect(screen.getByText('Cliente Beta')).toBeInTheDocument();
      expect(screen.queryByText('Tour')).not.toBeInTheDocument();
      expect(screen.queryByText('Viatura')).not.toBeInTheDocument();
    });

    it('tipo em falta: trata como hotel e mostra cartoes', async () => {
      renderPagina(null);
      expect(screen.getByRole('heading', { name: 'Reservas' })).toBeInTheDocument();
      expect(await screen.findByText('Cliente Alfa')).toBeInTheDocument();
      expect(screen.queryByText('Tour')).not.toBeInTheDocument();
    });

    it('hotel sem reservas mostra a mensagem de vazio', async () => {
      carregaServicos({ reservas: [] });
      renderPagina('hotel');
      expect(await screen.findByText('Sem resultados')).toBeInTheDocument();
    });
  });

  describe('filtro de estado', () => {
    it('atividade: Confirmada esconde as outras e Todas volta a mostra-las', async () => {
      renderPagina('activity');
      await screen.findByText('Tour');
      expect(screen.getAllByText('Cliente Beta').length).toBeGreaterThan(0);
      expect(screen.getByText('2 resultado(s)')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Confirmada' }));
      expect(screen.getAllByText('Cliente Alfa').length).toBeGreaterThan(0);
      expect(screen.queryByText('Cliente Beta')).not.toBeInTheDocument();
      expect(screen.getByText('1 resultado(s)')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Todas' }));
      expect(screen.getAllByText('Cliente Beta').length).toBeGreaterThan(0);
      expect(screen.getByText('2 resultado(s)')).toBeInTheDocument();
    });

    it('hotel: Confirmada esconde as outras e Todas volta a mostra-las', async () => {
      renderPagina('hotel');
      await screen.findByText('Cliente Beta');

      fireEvent.click(screen.getByRole('button', { name: 'Confirmada' }));
      expect(screen.getByText('Cliente Alfa')).toBeInTheDocument();
      expect(screen.queryByText('Cliente Beta')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Todas' }));
      expect(screen.getByText('Cliente Beta')).toBeInTheDocument();
    });
  });

  describe('barra de filtros', () => {
    const TRES = [
      reserva({ id: 'aaaaaaaa-0001', unit_id: 'u1', status: 'confirmed', source: 'direct', check_in: HOJE, customer_name: 'Cliente Alfa' }),
      reserva({ id: 'bbbbbbbb-0002', unit_id: 'u2', status: 'pending', source: 'viator', check_in: AMANHA, customer_name: 'Cliente Beta', units: { name: 'Tour Salinas' } }),
      reserva({ id: 'cccccccc-0003', unit_id: 'u1', status: 'cancelled', source: 'viator', check_in: AMANHA, customer_name: 'Cliente Gama' }),
    ];
    const DUAS_UNIDADES = [unidade(), unidade({ id: 'u2', name: 'Tour Salinas' })];

    function carregaTres() {
      carregaServicos({ reservas: TRES, units: DUAS_UNIDADES });
    }

    function campoData(container) {
      return container.querySelector('input[type="date"]');
    }

    it('o estado e um grupo de botoes aria-pressed, com Todas seleccionada por defeito', async () => {
      carregaTres();
      renderPagina('activity');
      await screen.findByText('Tour');
      /* so os chips tem aria-pressed (a tabela tem outros botoes, p.ex. a accao Check-in) */
      const chips = screen.getAllByRole('button').filter(b => b.hasAttribute('aria-pressed'));
      expect(chips.map(b => b.textContent)).toEqual(['Todas', 'Pendente', 'Confirmada', 'Check-in', 'Check-out', 'Cancelada']);
      expect(screen.getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'Confirmada' })).toHaveAttribute('aria-pressed', 'false');

      fireEvent.click(screen.getByRole('button', { name: 'Confirmada' }));
      expect(screen.getByRole('button', { name: 'Confirmada' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('atividade: o selector de tour filtra por unit_id e a contagem acompanha', async () => {
      carregaTres();
      renderPagina('activity');
      await screen.findByText('Tour');
      expect(screen.getByText('3 resultado(s)')).toBeInTheDocument();

      fireEvent.change(screen.getByDisplayValue('Todos os tours'), { target: { value: 'u2' } });
      expect(screen.getAllByText('Cliente Beta').length).toBeGreaterThan(0);
      expect(screen.queryByText('Cliente Alfa')).not.toBeInTheDocument();
      expect(screen.queryByText('Cliente Gama')).not.toBeInTheDocument();
      expect(screen.getByText('1 resultado(s)')).toBeInTheDocument();
    });

    it('atividade: o campo de data filtra por check_in (data local) e a contagem acompanha', async () => {
      carregaTres();
      const { container } = renderPagina('activity');
      await screen.findByText('Tour');

      fireEvent.change(campoData(container), { target: { value: AMANHA } });
      expect(campoData(container)).toHaveValue(AMANHA);
      expect(screen.queryByText('Cliente Alfa')).not.toBeInTheDocument();
      expect(screen.getAllByText('Cliente Beta').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Cliente Gama').length).toBeGreaterThan(0);
      expect(screen.getByText('2 resultado(s)')).toBeInTheDocument();
    });

    it('atividade: o selector de origem filtra por source', async () => {
      carregaTres();
      renderPagina('activity');
      await screen.findByText('Tour');

      fireEvent.change(screen.getByDisplayValue('Todas as origens'), { target: { value: 'viator' } });
      expect(screen.queryByText('Cliente Alfa')).not.toBeInTheDocument();
      expect(screen.getByText('2 resultado(s)')).toBeInTheDocument();
    });

    it('atividade: os filtros combinam-se e Limpar repoe todos', async () => {
      carregaTres();
      const { container } = renderPagina('activity');
      await screen.findByText('Tour');
      expect(screen.queryByRole('button', { name: 'Limpar' })).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Cancelada' }));
      fireEvent.change(screen.getByDisplayValue('Todos os tours'), { target: { value: 'u1' } });
      fireEvent.change(campoData(container), { target: { value: AMANHA } });
      fireEvent.change(screen.getByDisplayValue('Todas as origens'), { target: { value: 'viator' } });
      expect(screen.getByText('1 resultado(s)')).toBeInTheDocument();
      expect(screen.getAllByText('Cliente Gama').length).toBeGreaterThan(0);

      fireEvent.click(screen.getByRole('button', { name: 'Limpar' }));
      expect(screen.getByText('3 resultado(s)')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByDisplayValue('Todos os tours')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Todas as origens')).toBeInTheDocument();
      expect(campoData(container)).toHaveValue('');
      expect(screen.queryByRole('button', { name: 'Limpar' })).not.toBeInTheDocument();
    });

    it('hotel: o segundo bloco de estado tambem e aria-pressed e filtra', async () => {
      carregaTres();
      renderPagina('hotel');
      await screen.findByText('Cliente Alfa');
      expect(screen.getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByText('3 resultado(s)')).toBeInTheDocument();
      /* o layout nao-actividade nao tem selectores nem data */
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Cancelada' }));
      expect(screen.getByRole('button', { name: 'Cancelada' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByText('Cliente Gama')).toBeInTheDocument();
      expect(screen.queryByText('Cliente Alfa')).not.toBeInTheDocument();
      expect(screen.getByText('1 resultado(s)')).toBeInTheDocument();
    });

    it('restaurante: estado e turno sao grupos de botoes aria-pressed independentes', async () => {
      carregaServicos({
        reservas: [
          reserva({ id: 'aaaaaaaa-0001', status: 'confirmed', start_time: '13:00:00', customer_name: 'Cliente Alfa' }),
          reserva({ id: 'bbbbbbbb-0002', status: 'confirmed', start_time: '20:30:00', customer_name: 'Cliente Beta' }),
        ],
        units: [unidade({ name: 'M1', unit_type: 'table', description: '{"number":1}' })],
      });
      renderPagina('restaurant');
      await screen.findByText('Mesa');
      expect(screen.getByRole('button', { name: 'Todos turnos' })).toHaveAttribute('aria-pressed', 'true');

      fireEvent.click(screen.getByRole('button', { name: 'Jantar' }));
      expect(screen.getByRole('button', { name: 'Jantar' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.queryByText('Cliente Alfa')).not.toBeInTheDocument();
      expect(screen.getAllByText('Cliente Beta').length).toBeGreaterThan(0);

      fireEvent.click(screen.getByRole('button', { name: 'Pendente' }));
      await waitFor(() => expect(screen.queryByText('Cliente Beta')).not.toBeInTheDocument());
      expect(screen.getByText('0 resultado(s)')).toBeInTheDocument();
    });
  });

  describe('accoes', () => {
    it('Nova reserva abre o formulario', async () => {
      renderPagina('activity');
      await screen.findByText('Tour');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Nova Reserva' }));
      const dialogo = await screen.findByRole('dialog');
      expect(within(dialogo).getByRole('heading', { name: 'Nova Reserva' })).toBeInTheDocument();
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Fechar' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('o botao Ver abre o detalhe da reserva', async () => {
      renderPagina('activity');
      await screen.findByText('Tour');
      fireEvent.click(screen.getAllByRole('button', { name: 'Ver' })[0]);
      expect(await screen.findByText('Detalhes da reserva')).toBeInTheDocument();
      expect(getReservation).toHaveBeenCalledWith('aaaaaaaa-0001');
      expect(await screen.findByText('alfa@exemplo.cv')).toBeInTheDocument();
    });

    it('atividade: avancar estado chama changeStatus com o proximo estado', async () => {
      renderPagina('activity');
      await screen.findByText('Tour');
      /* a reserva pendente (Cliente Beta) avanca para confirmada */
      fireEvent.click(screen.getAllByRole('button', { name: 'Confirmar' })[0]);
      await waitFor(() => expect(changeStatus).toHaveBeenCalledWith('bbbbbbbb-0002', 'confirmed'));
      /* depois de actualizada deixa de haver reservas pendentes para confirmar */
      await waitFor(() => expect(screen.queryAllByRole('button', { name: 'Confirmar' })).toHaveLength(0));
    });

    it('restaurante: Sentar chama changeStatus com checked_in', async () => {
      carregaServicos({
        reservas: [reserva({ id: 'cccccccc-0003', status: 'confirmed', start_time: '13:00:00' })],
        units: [unidade({ name: 'M1', unit_type: 'table', description: '{"number":1}' })],
      });
      renderPagina('restaurant');
      fireEvent.click(await screen.findByRole('button', { name: 'Sentar' }));
      await waitFor(() => expect(changeStatus).toHaveBeenCalledWith('cccccccc-0003', 'checked_in'));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Liberar mesa' })).toBeInTheDocument());
    });

    it('rent-a-car: Levantamento abre o modal de levantamento', async () => {
      carregaServicos({
        reservas: [reserva({ status: 'confirmed' })],
        units: [unidade({ name: 'Carro 1', unit_type: 'vehicle', description: '{}' })],
      });
      renderPagina('rentacar');
      fireEvent.click(await screen.findByRole('button', { name: 'Levantamento' }));
      expect(await screen.findByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('servicos a falhar', () => {
    it.each(['activity', 'rentacar', 'restaurant', 'hotel'])('%s: a pagina nao rebenta', async (tipo) => {
      servicosAFalhar();
      esperaErros = true;
      renderPagina(tipo);
      expect(screen.getByRole('heading', { name: 'Reservas' })).toBeInTheDocument();
      await waitFor(() => expect(screen.getByText('Sem resultados')).toBeInTheDocument());
      expect(screen.getByRole('heading', { name: 'Reservas' })).toBeInTheDocument();
      expect(screen.getByText('0 resultado(s)')).toBeInTheDocument();
    });
  });
});
