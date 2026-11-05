import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BeachSale from '../pages/BeachSale';
import { listUnits } from '../services/unitsService';

/* Sem rede: servicos simulados. O seletor de buggys e testado a parte. */
vi.mock('../services/unitsService', () => ({ listUnits: vi.fn() }));
vi.mock('../services/reservationsService', () => ({ createReservation: vi.fn() }));
vi.mock('../services/staffService', () => ({ getMyProfile: vi.fn().mockResolvedValue({ commission_pct: 12 }) }));
vi.mock('../services/sellerService', () => ({
  getSellerCommissionPct: vi.fn().mockReturnValue(10),
  getSellerMeta: vi.fn().mockReturnValue({}),
}));
vi.mock('../components/fleet/FleetSelector', () => ({ default: () => null }));

const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };

/* O TourForm grava os horarios como objetos { time, capacity }; descricoes antigas
   podem ter texto simples. A pagina tem de aceitar as duas formas. */
function tour(meta) {
  return {
    id: 't1',
    name: 'Buggy Tour',
    base_price: 40,
    capacity: 8,
    is_active: true,
    description: JSON.stringify(meta),
    images: [],
  };
}

async function abrirPassoDois(unidade) {
  listUnits.mockResolvedValue([unidade]);
  render(
    <MemoryRouter future={FUTURE}>
      <BeachSale />
    </MemoryRouter>,
  );
  fireEvent.click(await screen.findByRole('button', { name: /Buggy Tour/ }));
  return screen.findByText('Horario');
}

describe('BeachSale: horarios do tour', () => {
  let errSpy;
  let warnSpy;

  beforeEach(() => {
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    const erros = errSpy.mock.calls.length;
    const avisos = warnSpy.mock.calls.length;
    errSpy.mockRestore();
    warnSpy.mockRestore();
    cleanup();
    expect(erros).toBe(0);
    expect(avisos).toBe(0);
  });

  it('mostra os horarios por omissao quando o tour nao tem hora definida', async () => {
    await abrirPassoDois(tour({}));
    for (const hora of ['09:00', '11:00', '14:00', '16:00']) {
      expect(screen.getByRole('button', { name: hora })).toBeTruthy();
    }
  });

  it('mostra a hora de inicio e os horarios em texto simples', async () => {
    await abrirPassoDois(tour({ start_time: '08:30', time_slots: ['10:00', '15:00'] }));
    for (const hora of ['08:30', '10:00', '15:00']) {
      expect(screen.getByRole('button', { name: hora })).toBeTruthy();
    }
    expect(screen.queryByRole('button', { name: '09:00' })).toBeNull();
  });

  it('nao rebenta com horarios em objeto { time, capacity } e mostra a hora de cada um', async () => {
    await abrirPassoDois(
      tour({
        start_time: '08:30',
        time_slots: [{ time: '10:00', capacity: 6 }, { time: '15:00', capacity: 4 }],
      }),
    );
    for (const hora of ['08:30', '10:00', '15:00']) {
      expect(screen.getByRole('button', { name: hora })).toBeTruthy();
    }
  });

  it('ignora horarios sem hora e nao repete a hora de inicio', async () => {
    await abrirPassoDois(
      tour({
        start_time: '08:30',
        time_slots: [{ time: '08:30', capacity: 6 }, { capacity: 3 }, null, '', { time: '10:00', capacity: 2 }],
      }),
    );
    expect(screen.getAllByRole('button', { name: '08:30' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: '10:00' })).toBeTruthy();
  });

  it('selecionar um horario em objeto marca-o como escolhido', async () => {
    await abrirPassoDois(
      tour({ start_time: '08:30', time_slots: [{ time: '10:00', capacity: 6 }] }),
    );
    const botao = screen.getByRole('button', { name: '10:00' });
    expect(botao.className).not.toContain('bg-turquoise-500');
    fireEvent.click(botao);
    expect(screen.getByRole('button', { name: '10:00' }).className).toContain('bg-turquoise-500');
  });
});
