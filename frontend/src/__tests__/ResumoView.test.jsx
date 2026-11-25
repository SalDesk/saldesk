import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ResumoView from '../pages/dashboard/ResumoView';
import useUiStore from '../store/uiStore';
import useAuthStore from '../store/authStore';
import { getResumo, getReceita, getUnidades } from '../services/financeiroService';
import { listReservations } from '../services/reservationsService';
import { listUnits } from '../services/unitsService';

/* Sem rede: todos os servicos usados pela vista sao simulados */
vi.mock('../services/financeiroService', () => ({
  getResumo: vi.fn(),
  getReceita: vi.fn(),
  getUnidades: vi.fn(),
}));
vi.mock('../services/reservationsService', () => ({
  listReservations: vi.fn(),
}));
vi.mock('../services/unitsService', () => ({
  listUnits: vi.fn(),
}));

/* TODAY e fixo ao importar: aqui e um valor que cada teste escolhe */
const dia = vi.hoisted(() => ({ hoje: '2026-11-25' }));
vi.mock('../pages/dashboard/shared', async (importOriginal) => {
  const real = await importOriginal();
  return Object.defineProperty({ ...real }, 'TODAY', { get: () => dia.hoje, enumerable: true });
});

const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };

const ZERO = { receita: 0, num_reservas: 0, valor_medio: 0, taxa_ocupacao: 0 };

function resumo(over = {}) {
  return {
    atual:    { ...ZERO, ...(over.atual || {}) },
    anterior: { ...ZERO, ...(over.anterior || {}) },
    variacao: { ...ZERO, ...(over.variacao || {}) },
  };
}

function servicosVazios() {
  getResumo.mockReset().mockResolvedValue(resumo());
  getReceita.mockReset().mockResolvedValue([]);
  getUnidades.mockReset().mockResolvedValue([]);
  listReservations.mockReset().mockResolvedValue([]);
  listUnits.mockReset().mockResolvedValue([]);
}

function renderResumo() {
  return render(
    <MemoryRouter future={FUTURE}>
      <ResumoView />
    </MemoryRouter>
  );
}

/* So o relogio e falso; os temporizadores de waitFor continuam reais */
function hojeFixo(ano, mes, dia) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(ano, mes, dia, 12, 0));
}

function tipoDeOperador(tipo) {
  useAuthStore.setState({ operator: { name: 'Zy Tours', operator_type: tipo } });
}

const RESUMO_COM_VARIACAO = resumo({
  atual:    { receita: 1200, num_reservas: 14, valor_medio: 90, taxa_ocupacao: 64 },
  anterior: { receita: 1000, num_reservas: 10, valor_medio: 100, taxa_ocupacao: 60 },
});

beforeEach(() => {
  servicosVazios();
  useUiStore.setState({ lang: 'pt' });
  tipoDeOperador('hotel');
  hojeFixo(2026, 10, 25);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  useAuthStore.setState({ operator: null });
  useUiStore.setState({ lang: 'pt' });
});

describe('ResumoView: periodo', () => {
  it('mostra os tres periodos, com 30 dias premido por omissao', async () => {
    renderResumo();
    const grupo = await screen.findByRole('group', { name: 'Período' });
    expect(within(grupo).getByRole('button', { name: '7 dias' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(grupo).getByRole('button', { name: '30 dias' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(grupo).getByRole('button', { name: '12 meses' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('pede os 30 dias e o periodo anterior ao abrir', async () => {
    renderResumo();
    await waitFor(() => expect(getResumo).toHaveBeenCalledWith('2026-10-27', '2026-11-25'));
    await waitFor(() => expect(getReceita).toHaveBeenCalledWith('2026-10-27', '2026-11-25', 'day'));
    expect(getReceita).toHaveBeenCalledWith('2026-09-27', '2026-10-26', 'day');
    expect(getUnidades).toHaveBeenCalledWith('2026-10-27', '2026-11-25');
  });

  it('12 meses pede os intervalos de 12 meses por mes', async () => {
    renderResumo();
    await waitFor(() => expect(getResumo).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: '12 meses' }));
    await waitFor(() => expect(getResumo).toHaveBeenCalledWith('2025-12-01', '2026-11-25'));
    expect(getReceita).toHaveBeenCalledWith('2025-12-01', '2026-11-25', 'month');
    expect(getReceita).toHaveBeenCalledWith('2024-12-06', '2025-11-30', 'month');
    expect(screen.getByRole('button', { name: '12 meses' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '30 dias' })).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('ResumoView: numeros', () => {
  it('mostra os quatro numeros com a variacao face ao periodo anterior', async () => {
    getResumo.mockResolvedValue(RESUMO_COM_VARIACAO);
    renderResumo();
    const receita = (await screen.findByText('€1200')).closest('article');
    expect(within(receita).getByText('Receita')).toBeInTheDocument();
    expect(within(receita).getByText('+20%')).toBeInTheDocument();
    expect(within(receita).getByText('face ao período anterior')).toBeInTheDocument();

    const reservas = screen.getByText('Reservas').closest('article');
    expect(within(reservas).getByText('14')).toBeInTheDocument();
    expect(within(reservas).getByText('+40%')).toBeInTheDocument();

    const medio = screen.getByText('Valor médio por reserva').closest('article');
    expect(within(medio).getByText('€90.00')).toBeInTheDocument();
    expect(within(medio).getByText('-10%')).toBeInTheDocument();

    const ocupacao = screen.getByText('Ocupação').closest('article');
    expect(within(ocupacao).getByText('64%')).toBeInTheDocument();
    expect(within(ocupacao).getByText('+4 pp')).toBeInTheDocument();
  });

  it('sem periodo anterior (zero) nao ha selo de variacao', async () => {
    getResumo.mockResolvedValue(resumo({ atual: { receita: 500, num_reservas: 3, valor_medio: 50, taxa_ocupacao: 30 } }));
    renderResumo();
    expect(await screen.findByText('€500')).toBeInTheDocument();
    expect(screen.queryByText(/^[+-]\d+%$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/pp$/)).not.toBeInTheDocument();
  });

  it.each(['hotel', 'rentacar'])('%s mostra a ocupacao do backend', async (tipo) => {
    tipoDeOperador(tipo);
    getResumo.mockResolvedValue(RESUMO_COM_VARIACAO);
    renderResumo();
    expect(await screen.findByText('Ocupação')).toBeInTheDocument();
    expect(await screen.findByText('64%')).toBeInTheDocument();
    expect(listUnits).not.toHaveBeenCalled();
  });

  it.each(['restaurant', 'generic'])('%s nao mostra a ocupacao', async (tipo) => {
    tipoDeOperador(tipo);
    getResumo.mockResolvedValue(RESUMO_COM_VARIACAO);
    renderResumo();
    expect(await screen.findByText('Valor médio por reserva')).toBeInTheDocument();
    expect(screen.queryByText('Ocupação')).not.toBeInTheDocument();
  });

  it('actividades calculam a ocupacao com as reservas do periodo e a variacao com as do anterior', async () => {
    tipoDeOperador('activity');
    listUnits.mockResolvedValue([{ id: 't1', name: 'Tour', capacity: 10, status: 'active' }]);
    listReservations.mockImplementation(async (params) => {
      if (params.stay_from === '2026-10-27') return [{ id: 'a', unit_id: 't1', check_in: '2026-11-02', guests: 30, status: 'confirmed' }];
      if (params.stay_from === '2026-09-27') return [{ id: 'b', unit_id: 't1', check_in: '2026-10-02', guests: 15, status: 'confirmed' }];
      return [];
    });
    renderResumo();
    /* 30 pessoas / (10 lugares x 30 dias) = 10%; antes 15 / 300 = 5% */
    const ocupacao = (await screen.findByText('Ocupação')).closest('article');
    await waitFor(() => expect(within(ocupacao).getByText('10%')).toBeInTheDocument());
    expect(within(ocupacao).getByText('+5 pp')).toBeInTheDocument();
    expect(listReservations).toHaveBeenCalledWith({ stay_from: '2026-10-27', stay_to: '2026-11-25' });
  });

  it('lista de reservas possivelmente cortada (1000): sem numero nem variacao', async () => {
    tipoDeOperador('activity');
    listUnits.mockResolvedValue([{ id: 't1', name: 'Tour', capacity: 10, status: 'active' }]);
    const mil = Array.from({ length: 1000 }, (_, i) => ({ id: `r${i}`, unit_id: 't1', check_in: '2026-11-02', guests: 1, status: 'confirmed' }));
    listReservations.mockImplementation(async (p) => (p.stay_from === '2026-10-27' ? mil : []));
    renderResumo();
    const ocupacao = (await screen.findByText('Ocupação')).closest('article');
    await waitFor(() => expect(within(ocupacao).getByText('—')).toBeInTheDocument());
    expect(within(ocupacao).queryByText(/%|pp/)).not.toBeInTheDocument();
  });

  it('so o periodo anterior possivelmente cortado: valor sem variacao', async () => {
    tipoDeOperador('activity');
    listUnits.mockResolvedValue([{ id: 't1', name: 'Tour', capacity: 10, status: 'active' }]);
    const mil = Array.from({ length: 1000 }, (_, i) => ({ id: `r${i}`, unit_id: 't1', check_in: '2026-10-02', guests: 1, status: 'confirmed' }));
    listReservations.mockImplementation(async (p) => {
      if (p.stay_from === '2026-10-27') return [{ id: 'a', unit_id: 't1', check_in: '2026-11-02', guests: 30, status: 'confirmed' }];
      if (p.stay_from === '2026-09-27') return mil;
      return [];
    });
    renderResumo();
    const ocupacao = (await screen.findByText('Ocupação')).closest('article');
    await waitFor(() => expect(within(ocupacao).getByText('10%')).toBeInTheDocument());
    expect(within(ocupacao).queryByText(/pp/)).not.toBeInTheDocument();
  });

  it('actividades sem capacidade mostram a ocupacao em branco', async () => {
    tipoDeOperador('activity');
    listUnits.mockResolvedValue([{ id: 't1', name: 'Tour', status: 'active' }]);
    getResumo.mockResolvedValue(RESUMO_COM_VARIACAO);
    renderResumo();
    const ocupacao = (await screen.findByText('Ocupação')).closest('article');
    await waitFor(() => expect(within(ocupacao).getByText('—')).toBeInTheDocument());
  });

  it('um pedido que falha nao deixa a pagina em branco', async () => {
    getResumo.mockRejectedValue(new Error('falha de rede'));
    getReceita.mockResolvedValue([{ periodo: '2026-11-10', receita: 300 }]);
    renderResumo();
    expect(await screen.findByTestId('resumo-grafico')).toBeInTheDocument();
    const receita = document.querySelector('[data-tile="receita"]');
    expect(within(receita).getByText('—')).toBeInTheDocument();
  });
});

describe('ResumoView: grafico da receita', () => {
  const ATUAL = [{ periodo: '2026-11-10', receita: 300 }, { periodo: '2026-11-20', receita: 700 }];

  it('descreve o total e o melhor ponto', async () => {
    getReceita.mockImplementation(async (inicio) => (inicio === '2026-10-27' ? ATUAL : []));
    renderResumo();
    const grafico = await screen.findByTestId('resumo-grafico');
    expect(grafico).toHaveAttribute('role', 'img');
    expect(grafico).toHaveAttribute('aria-label', 'Receita do período: €1000. Melhor ponto: 20 Nov, €700.');
  });

  it('o grafico desenha-se mesmo sem periodo anterior', async () => {
    getReceita.mockImplementation(async (inicio) => (inicio === '2026-10-27' ? ATUAL : Promise.reject(new Error('x'))));
    renderResumo();
    expect(await screen.findByTestId('resumo-grafico')).toBeInTheDocument();
  });

  it('sem receita mostra o estado vazio', async () => {
    renderResumo();
    expect(await screen.findByText('Sem receita neste período')).toBeInTheDocument();
    expect(screen.queryByTestId('resumo-grafico')).not.toBeInTheDocument();
  });

  it('se a receita falhar diz-o, sem tirar os numeros', async () => {
    getReceita.mockRejectedValue(new Error('falha de rede'));
    getResumo.mockResolvedValue(RESUMO_COM_VARIACAO);
    renderResumo();
    expect(await screen.findByText('Não foi possível carregar a receita.')).toBeInTheDocument();
    expect(await screen.findByText('€1200')).toBeInTheDocument();
  });

  it('em ingles os meses do eixo estao em ingles', async () => {
    useUiStore.setState({ lang: 'en' });
    dia.hoje = '2026-02-10';
    getReceita.mockImplementation(async (inicio) => (inicio === '2026-01-12' ? [{ periodo: '2026-02-05', receita: 400 }] : []));
    renderResumo();
    const eixo = await screen.findByTestId('resumo-eixo');
    expect(within(eixo).getByText('12 Jan')).toBeInTheDocument();
    expect(within(eixo).getByText('10 Feb')).toBeInTheDocument();
    expect(screen.getByTestId('resumo-grafico')).toHaveAttribute('aria-label', 'Revenue for the period: €400. Best point: 5 Feb, €400.');
  });

  it('em portugues o eixo usa os meses portugueses', async () => {
    dia.hoje = '2026-02-10';
    getReceita.mockImplementation(async (inicio) => (inicio === '2026-01-12' ? [{ periodo: '2026-02-05', receita: 400 }] : []));
    renderResumo();
    const eixo = await screen.findByTestId('resumo-eixo');
    expect(within(eixo).getByText('10 Fev')).toBeInTheDocument();
  });
});

describe('ResumoView: blocos de baixo', () => {
  it('mostra servicos mais vendidos', async () => {
    getUnidades.mockResolvedValue([
      { name: 'Servico A', unit_type: 'tour', num_reservas: 2, receita: 100 },
      { name: 'Servico B', unit_type: 'tour', num_reservas: 9, receita: 900 },
      { name: 'Servico C', unit_type: 'tour', num_reservas: 3, receita: 300 },
      { name: 'Servico D', unit_type: 'tour', num_reservas: 5, receita: 500 },
      { name: 'Servico E', unit_type: 'tour', num_reservas: 4, receita: 400 },
      { name: 'Servico F', unit_type: 'tour', num_reservas: 1, receita: 50 },
    ]);
    renderResumo();
    const titulo = await screen.findByText('Serviços mais vendidos');
    const bloco = titulo.closest('section');
    await within(bloco).findByText('Servico B');
    const nomes = within(bloco).getAllByText(/^Servico /).map((el) => el.textContent);
    expect(nomes).toEqual(['Servico B', 'Servico D', 'Servico E', 'Servico C', 'Servico A']);
    expect(within(bloco).queryByText('Servico F')).not.toBeInTheDocument();
  });

  it('as reservas recentes nao usam from/to nem se limitam ao mes', async () => {
    renderResumo();
    await screen.findByText('Sem reservas recentes');
    const pedidos = listReservations.mock.calls.map(([params]) => params);
    expect(pedidos).toEqual([{ order_by: 'created_at', limit: 5 }]);
  });

  it('mostra as 5 reservas mais recentes, de qualquer mes', async () => {
    listReservations.mockResolvedValue(
      Array.from({ length: 7 }, (_, i) => ({
        id: `r${i}`,
        created_at: `2026-11-0${i + 1}T10:00:00Z`,
        status: 'confirmed',
        customer_name: `Cliente ${i + 1}`,
        check_in: '2026-12-10',
        guests: 2,
        units: { name: 'Tour X' },
      })),
    );
    renderResumo();
    const bloco = (await screen.findByText('Reservas recentes')).closest('section');
    await within(bloco).findByText(/Cliente 7/);
    expect(within(bloco).getAllByText(/Cliente \d/).length).toBe(5);
  });

  it('servicos e reservas a falhar mostram os estados vazios', async () => {
    const erro = new Error('falha de rede');
    getUnidades.mockRejectedValue(erro);
    listReservations.mockRejectedValue(erro);
    renderResumo();
    expect(await screen.findByText('Sem vendas este mês')).toBeInTheDocument();
    expect(screen.getByText('Sem reservas recentes')).toBeInTheDocument();
  });
});
