import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BeachSale from '../pages/BeachSale';
import { listUnits } from '../services/unitsService';
import { createReservation } from '../services/reservationsService';
import useUiStore from '../store/uiStore';
import { portuguesNoEcra, chavesCruas } from './helpers/portuguesNoEcra';

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
  return screen.findByText('Horário');
}

describe('BeachSale: horários do tour', () => {
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

  it('mostra os horários por omissao quando o tour não tem hora definida', async () => {
    await abrirPassoDois(tour({}));
    for (const hora of ['09:00', '11:00', '14:00', '16:00']) {
      expect(screen.getByRole('button', { name: hora })).toBeTruthy();
    }
  });

  it('sem hora de início usa os horários configurados (time_slots) em vez dos por omissao', async () => {
    await abrirPassoDois(tour({ time_slots: [{ time: '10:00', capacity: 6 }, { time: '15:30', capacity: 4 }] }));
    for (const hora of ['10:00', '15:30']) {
      expect(screen.getByRole('button', { name: hora })).toBeTruthy();
    }
    for (const hora of ['09:00', '11:00', '14:00', '16:00']) {
      expect(screen.queryByRole('button', { name: hora })).toBeNull();
    }
  });

  it('time_slots sem nenhuma hora válida volta aos horários por omissao', async () => {
    await abrirPassoDois(tour({ time_slots: [{ capacity: 3 }, null, ''] }));
    for (const hora of ['09:00', '11:00', '14:00', '16:00']) {
      expect(screen.getByRole('button', { name: hora })).toBeTruthy();
    }
  });

  /* Com horarios configurados, o servidor so aceita essas horas (INVALID_TIME_SLOT para outra):
     a hora de inicio solta so se mostra se for tambem um dos horarios */
  it('com horários em texto simples mostra só esses horários, não a hora de início solta', async () => {
    await abrirPassoDois(tour({ start_time: '08:30', time_slots: ['10:00', '15:00'] }));
    for (const hora of ['10:00', '15:00']) {
      expect(screen.getByRole('button', { name: hora })).toBeTruthy();
    }
    expect(screen.queryByRole('button', { name: '08:30' })).toBeNull();
    expect(screen.queryByRole('button', { name: '09:00' })).toBeNull();
  });

  it('não rebenta com horários em objeto { time, capacity } e mostra a hora de cada um', async () => {
    await abrirPassoDois(
      tour({
        start_time: '08:30',
        time_slots: [{ time: '10:00', capacity: 6 }, { time: '15:00', capacity: 4 }],
      }),
    );
    for (const hora of ['10:00', '15:00']) {
      expect(screen.getByRole('button', { name: hora })).toBeTruthy();
    }
    expect(screen.queryByRole('button', { name: '08:30' })).toBeNull();
  });

  it('ignora horários sem hora e não repete a hora de início quando ela e um dos horários', async () => {
    await abrirPassoDois(
      tour({
        start_time: '08:30',
        time_slots: [{ time: '08:30', capacity: 6 }, { capacity: 3 }, null, '', { time: '10:00', capacity: 2 }],
      }),
    );
    expect(screen.getAllByRole('button', { name: '08:30' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: '10:00' })).toBeTruthy();
  });

  it('sem horários configurados mostra a hora de início do tour', async () => {
    await abrirPassoDois(tour({ start_time: '08:30' }));
    expect(screen.getByRole('button', { name: '08:30' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '09:00' })).toBeNull();
  });

  it('selecionar um horário em objeto marca-o como escolhido', async () => {
    await abrirPassoDois(
      tour({ start_time: '08:30', time_slots: [{ time: '10:00', capacity: 6 }] }),
    );
    const botao = screen.getByRole('button', { name: '10:00' });
    expect(botao.className).not.toContain('bg-turquoise-500');
    fireEvent.click(botao);
    expect(screen.getByRole('button', { name: '10:00' }).className).toContain('bg-turquoise-500');
  });
});

describe('BeachSale: opções da actividade', () => {
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

  it('a lista mostra "desde" com o preço da opção mais barata', async () => {
    listUnits.mockResolvedValue([tour({ options: OPCOES })]);
    render(<MemoryRouter future={FUTURE}><BeachSale /></MemoryRouter>);
    const cartao = await screen.findByRole('button', { name: /Buggy Tour/ });
    expect(within(cartao).getByText('desde')).toBeTruthy();
    expect(within(cartao).getByText('€50')).toBeTruthy();
    expect(within(cartao).getByText('por pessoa')).toBeTruthy();
    expect(within(cartao).queryByText('€40')).toBeNull();
  });

  it('mostra as opções do tour escolhido, comeca na mais barata e envia option_id', async () => {
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

  it('opção por veiculo: contador de veiculos com o mínimo pelas pessoas e preço pelos veiculos', async () => {
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

  it('as crianças contam como pessoas (sem preço de criança neste ecrã)', async () => {
    await abrirPassoDois(tour({ options: OPCOES, time_slots: [{ time: '09:00', capacity: 8 }] }));
    fireEvent.click(contador('Crianças').mais);
    expect(screen.getAllByText('€100').length).toBeGreaterThan(0);
  });

  it('tour sem opções continua igual: preço por pessoa e sem option_id', async () => {
    listUnits.mockResolvedValue([tour({ time_slots: [{ time: '09:00', capacity: 8 }] })]);
    render(<MemoryRouter future={FUTURE}><BeachSale /></MemoryRouter>);
    const cartao = await screen.findByRole('button', { name: /Buggy Tour/ });
    expect(within(cartao).getByText('€40')).toBeTruthy();
    expect(within(cartao).getByText('/pessoa')).toBeTruthy();
    fireEvent.click(cartao);
    await screen.findByText('Horário');
    expect(screen.queryByText('Opção')).toBeNull();
    const corpo = await confirmar();
    expect(corpo).toMatchObject({ unit_id: 't1', guests: 1, total_amount: 40 });
    expect(corpo).not.toHaveProperty('option_id');
    expect(corpo).not.toHaveProperty('vehicles');
  });

  /* Sem start_time o servidor recusa a venda de um tour com horarios (INVALID_TIME_SLOT) */
  it('tour com horários envia a hora escolhida como start_time', async () => {
    await abrirPassoDois(tour({ time_slots: [{ time: '09:00', capacity: 8 }, { time: '14:00', capacity: 8 }] }));
    const corpo = await confirmar();
    expect(corpo.start_time).toBe('09:00');
  });

  it('tour sem horários não envia start_time (a hora fica só nas notas)', async () => {
    await abrirPassoDois(tour({}));
    const corpo = await confirmar();
    expect(corpo).not.toHaveProperty('start_time');
    expect(corpo.notes_internal).toContain('Hora: 09:00');
  });
});

describe('BeachSale: lingua do painel', () => {
  let errSpy;
  let warnSpy;

  beforeEach(() => {
    useUiStore.setState({ lang: 'pt' });
    createReservation.mockReset().mockResolvedValue({ id: 'r1' });
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    errSpy.mockRestore();
    warnSpy.mockRestore();
    cleanup();
    useUiStore.setState({ lang: 'pt' });
  });

  const GRANDE = { ...tour({ time_slots: [{ time: '09:00', capacity: 8 }] }), base_price: 1234 };

  async function venderAteAoFim({ continuar, nome, placeholder, confirmar }) {
    listUnits.mockResolvedValue([GRANDE]);
    render(<MemoryRouter future={FUTURE}><BeachSale /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /Buggy Tour/ }));
    fireEvent.click(await screen.findByRole('button', { name: '09:00' }));
    fireEvent.click(screen.getByRole('button', { name: continuar }));
    fireEvent.change(await screen.findByPlaceholderText(placeholder), { target: { value: nome } });
    fireEvent.click(screen.getByRole('button', { name: confirmar }));
    await waitFor(() => expect(createReservation).toHaveBeenCalledTimes(1));
    return createReservation.mock.calls[0][0];
  }

  it('o botao de lingua do cabecalho passa os passos para ingles e para portugues', async () => {
    listUnits.mockResolvedValue([GRANDE]);
    render(<MemoryRouter future={FUTURE}><BeachSale /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /Buggy Tour/ }));
    expect(await screen.findByText('Passo 2 de 3 — Data e Grupo')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'en' }));
    expect(screen.getByText('Step 2 of 3 — Date and group')).toBeTruthy();
    expect(screen.getByText('Group size')).toBeTruthy();
    expect(screen.getAllByText('€1,234').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'pt' }));
    expect(screen.getByText('Passo 2 de 3 — Data e Grupo')).toBeTruthy();
    expect(screen.getAllByText('€1234').length).toBeGreaterThan(0);
  });

  it('em ingles os tres passos e o fim nao tem portugues nem chaves cruas', async () => {
    useUiStore.setState({ lang: 'en' });
    listUnits.mockResolvedValue([GRANDE]);
    render(<MemoryRouter future={FUTURE}><BeachSale /></MemoryRouter>);
    await screen.findByText('Select the tour');
    expect(portuguesNoEcra(['Buggy Tour'])).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: /Buggy Tour/ }));
    await screen.findByText('Group size');
    expect(portuguesNoEcra(['Buggy Tour'])).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: '09:00' }));
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
    fireEvent.change(await screen.findByPlaceholderText('Customer first and last name'), { target: { value: 'Ana Lima' } });
    expect(portuguesNoEcra(['Buggy Tour', 'Ana Lima'])).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: /Confirm booking/ }));
    expect(await screen.findByText('Booking confirmed!')).toBeTruthy();
    expect(portuguesNoEcra(['Buggy Tour', 'Ana Lima'])).toEqual([]);
    expect(chavesCruas(['beachSeller', 'staff', 'opcoesActividade'])).toEqual([]);
  });

  it('uma venda feita em ingles envia o mesmo corpo que em portugues', async () => {
    const pt = await venderAteAoFim({ continuar: /Continuar/, nome: 'Ana Lima', placeholder: 'Nome e apelido do cliente', confirmar: /Confirmar Reserva/ });
    cleanup();
    createReservation.mockClear();
    useUiStore.setState({ lang: 'en' });
    const en = await venderAteAoFim({ continuar: /Continue/, nome: 'Ana Lima', placeholder: 'Customer first and last name', confirmar: /Confirm booking/ });
    expect(en).toEqual(pt);
    expect(en).toMatchObject({ unit_id: 't1', total_amount: 1234, payment_method: 'cash' });
  });
});
