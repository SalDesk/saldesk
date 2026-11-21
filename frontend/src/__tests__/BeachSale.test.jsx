import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BeachSale from '../pages/BeachSale';
import { listUnits } from '../services/unitsService';
import { createReservation } from '../services/reservationsService';
import useUiStore from '../store/uiStore';

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

  it('sem hora de inicio usa os horarios configurados (time_slots) em vez dos por omissao', async () => {
    await abrirPassoDois(tour({ time_slots: [{ time: '10:00', capacity: 6 }, { time: '15:30', capacity: 4 }] }));
    for (const hora of ['10:00', '15:30']) {
      expect(screen.getByRole('button', { name: hora })).toBeTruthy();
    }
    for (const hora of ['09:00', '11:00', '14:00', '16:00']) {
      expect(screen.queryByRole('button', { name: hora })).toBeNull();
    }
  });

  it('time_slots sem nenhuma hora valida volta aos horarios por omissao', async () => {
    await abrirPassoDois(tour({ time_slots: [{ capacity: 3 }, null, ''] }));
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

describe('BeachSale: opcoes da actividade', () => {
  let errSpy;
  let warnSpy;

  const OPCOES = [
    { id: 'o2', name_pt: 'Grupo privado', name_en: 'Private group', type: 'per_group', price: 200 },
    { id: 'o1', name_pt: 'Por pessoa', name_en: 'Per person', type: 'per_person', price: 50, price_child: 30 },
    { id: 'o3', name_pt: 'Buggy 2h', name_en: 'Buggy 2h', type: 'per_vehicle', price: 90, seats: 2 },
  ];

  beforeEach(() => {
    useUiStore.setState({ lang: 'pt' });
    createReservation.mockReset().mockResolvedValue({ id: 'r1' });
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

  /* Botoes - e + do contador com esta etiqueta */
  function contador(etiqueta) {
    const [menos, mais] = within(screen.getByText(etiqueta).parentElement).getAllByRole('button');
    return { menos, mais, valor: () => Number(within(screen.getByText(etiqueta).parentElement).getByText(/^\d+$/).textContent) };
  }

  async function confirmar() {
    fireEvent.click(screen.getByRole('button', { name: '09:00' }));
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));
    fireEvent.change(await screen.findByPlaceholderText('Nome e apelido do cliente'), { target: { value: 'Ana Lima' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar Reserva/ }));
    await waitFor(() => expect(createReservation).toHaveBeenCalledTimes(1));
    return createReservation.mock.calls[0][0];
  }

  it('a lista mostra "desde" com o preco da opcao mais barata', async () => {
    listUnits.mockResolvedValue([tour({ options: OPCOES })]);
    render(<MemoryRouter future={FUTURE}><BeachSale /></MemoryRouter>);
    const cartao = await screen.findByRole('button', { name: /Buggy Tour/ });
    expect(within(cartao).getByText('desde')).toBeTruthy();
    expect(within(cartao).getByText('€50')).toBeTruthy();
    expect(within(cartao).getByText('por pessoa')).toBeTruthy();
    expect(within(cartao).queryByText('€40')).toBeNull();
  });

  it('mostra as opcoes do tour escolhido, comeca na mais barata e envia option_id', async () => {
    await abrirPassoDois(tour({ options: OPCOES, time_slots: [{ time: '09:00', capacity: 8 }] }));
    for (const nome of ['Grupo privado', 'Por pessoa', 'Buggy 2h']) {
      expect(screen.getByRole('button', { name: new RegExp(nome) })).toBeTruthy();
    }
    expect(screen.getByRole('button', { name: /Por pessoa/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByText('Veículos')).toBeNull();
    fireEvent.click(contador('Adultos').mais);
    expect(screen.getAllByText('€100').length).toBeGreaterThan(0);
    const corpo = await confirmar();
    expect(corpo).toMatchObject({ unit_id: 't1', guests: 2, option_id: 'o1', total_amount: 100 });
    expect(corpo).not.toHaveProperty('vehicles');
  });

  it('opcao por veiculo: contador de veiculos com o minimo pelas pessoas e preco pelos veiculos', async () => {
    await abrirPassoDois(tour({ options: OPCOES, time_slots: [{ time: '09:00', capacity: 8 }] }));
    fireEvent.click(screen.getByRole('button', { name: /Buggy 2h/ }));
    for (let i = 0; i < 4; i += 1) fireEvent.click(contador('Adultos').mais);
    expect(contador('Veículos').valor()).toBe(3);
    expect(contador('Veículos').menos.disabled).toBe(true);
    expect(screen.getAllByText('€270').length).toBeGreaterThan(0);
    fireEvent.click(contador('Veículos').mais);
    expect(contador('Veículos').valor()).toBe(4);
    expect(screen.getAllByText('€360').length).toBeGreaterThan(0);
    const corpo = await confirmar();
    expect(corpo).toMatchObject({ unit_id: 't1', guests: 5, option_id: 'o3', vehicles: 4, total_amount: 360 });
  });

  it('as criancas contam como pessoas (sem preco de crianca neste ecra)', async () => {
    await abrirPassoDois(tour({ options: OPCOES, time_slots: [{ time: '09:00', capacity: 8 }] }));
    fireEvent.click(contador('Criancas').mais);
    expect(screen.getAllByText('€100').length).toBeGreaterThan(0);
  });

  it('tour sem opcoes continua igual: preco por pessoa e sem option_id', async () => {
    listUnits.mockResolvedValue([tour({ time_slots: [{ time: '09:00', capacity: 8 }] })]);
    render(<MemoryRouter future={FUTURE}><BeachSale /></MemoryRouter>);
    const cartao = await screen.findByRole('button', { name: /Buggy Tour/ });
    expect(within(cartao).getByText('€40')).toBeTruthy();
    expect(within(cartao).getByText('/pessoa')).toBeTruthy();
    fireEvent.click(cartao);
    await screen.findByText('Horario');
    expect(screen.queryByText('Opção')).toBeNull();
    const corpo = await confirmar();
    expect(corpo).toMatchObject({ unit_id: 't1', guests: 1, total_amount: 40 });
    expect(corpo).not.toHaveProperty('option_id');
    expect(corpo).not.toHaveProperty('vehicles');
  });
});
