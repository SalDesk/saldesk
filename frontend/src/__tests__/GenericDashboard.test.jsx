import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GenericDashboard from '../pages/dashboard/GenericDashboard';
import useAuthStore from '../store/authStore';
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

/* Data local calculada aqui, sem reutilizar o codigo em teste */
const HOJE = new Date().toLocaleDateString('en-CA');

const ZERO = { receita: 0, num_reservas: 0, valor_medio: 0, taxa_ocupacao: 0 };
function resumo(atual = {}, variacao = {}) {
  return {
    atual: { ...ZERO, ...atual },
    anterior: { ...ZERO },
    variacao: { ...ZERO, ...variacao },
  };
}

/* Textos que antes estavam fixos em portugues dentro do componente */
const ANTIGOS_POR_TIPO = {
  hotel:      ['Check-ins hoje', 'Ocupacao hoje', 'Mapa de Quartos — Hoje'],
  rentacar:   ['Alugueres activos', 'Veiculos disponiveis', 'Frota — Estado Actual'],
  restaurant: ['Reservas hoje', 'Covers hoje', 'Mapa de Mesas — Hoje'],
};
const ANTIGOS_COMUNS = [
  'Accoes Rapidas', 'Clientes', 'Automacoes', 'Financeiro', 'Unidades',
  'CRM com historico e estatisticas', 'Emails e WhatsApp automaticos',
  'Relatorios e exportacoes', 'Gerir quartos, actividades, etc.',
  'vs mes ant.', 'p.p.',
];

/* O que cada tipo mostra em portugues (a chave existente diz Viaturas, como o dashboard de rent-a-car) */
const PORTUGUES_POR_TIPO = {
  hotel:      ['Check-ins hoje', 'Ocupacao hoje', 'Mapa de Quartos — Hoje'],
  rentacar:   ['Alugueres activos', 'Viaturas disponiveis', 'Frota — Estado Actual'],
  restaurant: ['Reservas hoje', 'Covers hoje', 'Mapa de Mesas — Hoje'],
};

/* O que cada tipo deve mostrar em ingles */
const INGLES_POR_TIPO = {
  hotel:      ['Check-ins today', 'Occupancy today', 'Room Map — Today'],
  rentacar:   ['Active rentals', 'Available vehicles', 'Fleet — Current Status'],
  restaurant: ['Reservations today', 'Covers today', 'Table Map — Today'],
};

function carregaServicos({ units = [], hoje = [], res = resumo() } = {}) {
  listUnits.mockReset().mockResolvedValue(units);
  /* Responde so ao par exato (stay_from, stay_to) de hoje; qualquer outra forma de argumentos
     (por exemplo from/to) lanca, para apanhar pedidos perdidos */
  listReservations.mockReset().mockImplementation(async (params) => {
    if (Object.keys(params || {}).sort().join(',') !== 'stay_from,stay_to') {
      throw new Error(`pedido inesperado ${JSON.stringify(params)}`);
    }
    if (params.stay_from === HOJE && params.stay_to === HOJE) return hoje;
    throw new Error(`pedido inesperado ${params.stay_from} ${params.stay_to}`);
  });
  getResumo.mockReset().mockResolvedValue(res);
}

function servicosAFalhar() {
  const erro = new Error('falha de rede');
  listUnits.mockReset().mockRejectedValue(erro);
  listReservations.mockReset().mockRejectedValue(erro);
  getResumo.mockReset().mockRejectedValue(erro);
}

function renderGenerico(operator_type) {
  useAuthStore.setState({ operator: { name: 'Teste', operator_type } });
  return render(
    <MemoryRouter future={FUTURE}>
      <GenericDashboard />
    </MemoryRouter>
  );
}

/* Espera que os servicos tenham respondido e o estado assente */
async function esperaCarregar() {
  await waitFor(() => expect(listUnits).toHaveBeenCalled());
  await waitFor(() => expect(getResumo).toHaveBeenCalled());
}

describe('GenericDashboard (Hoje)', () => {
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
    useAuthStore.setState({ operator: null });
    useUiStore.setState({ lang: 'pt' });
    /* nenhum erro ou aviso no consolo durante o teste */
    expect(errSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('renderiza sem tipo de operador', async () => {
    carregaServicos({ res: resumo({ receita: 320, num_reservas: 7, taxa_ocupacao: 41 }) });
    renderGenerico(undefined);
    expect(await screen.findByText('€320')).toBeInTheDocument();
    expect(screen.getByText('Receita')).toBeInTheDocument();
    expect(screen.getByText('Reservas')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('Ocupacao')).toBeInTheDocument();
    expect(screen.getByText('41.0%')).toBeInTheDocument();
    /* sem tipo nao ha mapa */
    expect(screen.queryByText('Mapa de Quartos — Hoje')).not.toBeInTheDocument();
    await esperaCarregar();
  });

  /* Valor principal do cartao com este rotulo */
  function valorDe(label) {
    return screen.getByText(label).parentElement.nextElementSibling;
  }

  it('antes de getResumo responder mostra o traco e nunca NaN', async () => {
    /* Nenhum servico responde: o primeiro desenho nao pode ter NaN */
    const pendente = () => new Promise(() => {});
    listUnits.mockReset().mockImplementation(pendente);
    listReservations.mockReset().mockImplementation(pendente);
    getResumo.mockReset().mockImplementation(pendente);
    const { container } = renderGenerico(undefined);
    expect(valorDe('Receita')).toHaveTextContent(/^—$/);
    expect(valorDe('Ocupacao')).toHaveTextContent(/^—$/);
    expect(container.textContent).not.toContain('NaN');
  });

  it('getResumo a falhar mostra o traco sem NaN', async () => {
    servicosAFalhar();
    const { container } = renderGenerico(undefined);
    await esperaCarregar();
    expect(valorDe('Receita')).toHaveTextContent(/^—$/);
    expect(valorDe('Ocupacao')).toHaveTextContent(/^—$/);
    expect(container.textContent).not.toContain('NaN');
  });

  it('a variacao da receita e a diferenca em euros face ao mes anterior', async () => {
    carregaServicos({
      res: {
        atual: { ...ZERO, receita: 1200 },
        anterior: { ...ZERO, receita: 1000 },
        /* variacao do backend e uma percentagem (+20%), nao euros */
        variacao: { ...ZERO, receita: 20 },
      },
    });
    renderGenerico(undefined);
    expect(await screen.findByText('+€200')).toBeInTheDocument();
    expect(screen.queryByText('+€20')).not.toBeInTheDocument();
  });

  it('sem mes anterior a receita nao mostra variacao', async () => {
    carregaServicos({ res: { atual: { ...ZERO, receita: 500 } } });
    renderGenerico(undefined);
    expect(await screen.findByText('€500')).toBeInTheDocument();
    expect(screen.queryByText('vs mes anterior')).not.toBeInTheDocument();
  });

  it('as accoes rapidas nao repetem as do cabecalho', async () => {
    renderGenerico(undefined);
    expect(await screen.findByText('Accoes Rapidas')).toBeInTheDocument();
    /* ver calendario e nova reserva ja estao na casca */
    expect(screen.queryByRole('button', { name: /Calendario/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Gerir e acompanhar reservas/ })).not.toBeInTheDocument();
    /* o que a casca nao tem continua aqui, com destino proprio */
    fireEvent.click(screen.getByRole('button', { name: /Clientes/ }));
    expect(navigateMock).toHaveBeenLastCalledWith('/clientes');
    fireEvent.click(screen.getByRole('button', { name: /Automacoes/ }));
    expect(navigateMock).toHaveBeenLastCalledWith('/automacoes');
    fireEvent.click(screen.getByRole('button', { name: /Financeiro/ }));
    expect(navigateMock).toHaveBeenLastCalledWith('/financeiro');
    fireEvent.click(screen.getByRole('button', { name: /Unidades/ }));
    expect(navigateMock).toHaveBeenLastCalledWith('/unidades');
    await esperaCarregar();
  });

  it('a variacao de ocupacao mostra a unidade uma so vez', async () => {
    carregaServicos({ res: resumo({ taxa_ocupacao: 40 }, { taxa_ocupacao: 2, receita: 5 }) });
    renderGenerico(undefined);
    expect(await screen.findByText('+2.0 p.p.')).toBeInTheDocument();
    expect(screen.queryAllByText('p.p.')).toHaveLength(0);
    expect(screen.getByText('vs mes anterior')).toBeInTheDocument();
  });

  Object.keys(ANTIGOS_POR_TIPO).forEach((tipo) => {
    it(`${tipo}: em portugues mostra os textos do tipo`, async () => {
      renderGenerico(tipo);
      for (const texto of PORTUGUES_POR_TIPO[tipo]) {
        expect(await screen.findByText(texto)).toBeInTheDocument();
      }
      await esperaCarregar();
    });

    it(`${tipo}: em ingles nenhum texto fixo em portugues aparece`, async () => {
      useUiStore.setState({ lang: 'en' });
      carregaServicos({ res: resumo({ receita: 100 }, { receita: 5, taxa_ocupacao: 2 }) });
      renderGenerico(tipo);
      for (const texto of INGLES_POR_TIPO[tipo]) {
        expect(await screen.findByText(texto)).toBeInTheDocument();
      }
      await esperaCarregar();
      [...ANTIGOS_POR_TIPO[tipo], ...ANTIGOS_COMUNS].forEach((antigo) => {
        expect(screen.queryByText(antigo), antigo).not.toBeInTheDocument();
      });
      /* a coluna de accoes e a variacao em ingles */
      expect(screen.getByText('Quick Actions')).toBeInTheDocument();
      expect(screen.getByText('vs last month')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Customers/ })).toBeInTheDocument();
    });
  });

  it('em ingles sem tipo nenhum texto fixo em portugues aparece', async () => {
    useUiStore.setState({ lang: 'en' });
    renderGenerico(undefined);
    expect(await screen.findByText('Quick Actions')).toBeInTheDocument();
    ANTIGOS_COMUNS.forEach((antigo) => {
      expect(screen.queryByText(antigo), antigo).not.toBeInTheDocument();
    });
    expect(screen.getByText('Revenue')).toBeInTheDocument();
    await esperaCarregar();
  });

  it('sem unidades o mapa mostra um estado vazio compacto', async () => {
    renderGenerico('hotel');
    const vazio = await screen.findByText('Sem unidades registadas.');
    /* titulo do estado vazio compacto, nao o paragrafo pequeno antigo */
    expect(vazio).toHaveClass('font-display');
  });

  it('com unidades o mapa continua a aparecer', async () => {
    carregaServicos({
      units: [{ id: 'u1', name: 'Quarto 101', unit_type: 'double', status: 'available', is_active: true }],
    });
    renderGenerico('hotel');
    expect(await screen.findByText('Quarto 101')).toBeInTheDocument();
    expect(screen.queryByText('Sem unidades registadas.')).not.toBeInTheDocument();
  });

  it('os indicadores do tipo mantem os calculos', async () => {
    carregaServicos({
      units: [
        { id: 'u1', name: 'Quarto 1', unit_type: 'double', status: 'available', is_active: true },
        { id: 'u2', name: 'Quarto 2', unit_type: 'double', status: 'available', is_active: true },
      ],
      hoje: [
        { id: 'r1', unit_id: 'u1', status: 'checked_in', check_in: HOJE, guests: 2 },
        { id: 'r2', unit_id: 'u2', status: 'confirmed', check_in: HOJE, guests: 2 },
      ],
    });
    renderGenerico('hotel');
    /* 1 check-in confirmado hoje e 1 de 2 quartos ocupados = 50% */
    expect(await screen.findByText('50.0%')).toBeInTheDocument();
    expect(screen.getByText('Check-ins hoje').parentElement.nextElementSibling).toHaveTextContent('1');
  });

  it('os pedidos usam stay_from e stay_to', async () => {
    renderGenerico('hotel');
    await esperaCarregar();
    await waitFor(() => expect(listReservations).toHaveBeenCalledTimes(1));
    const pedidos = listReservations.mock.calls.map(([params]) => params);
    /* nenhuma chamada recebe as chaves antigas from/to */
    pedidos.forEach((p) => {
      expect(p).not.toHaveProperty('from');
      expect(p).not.toHaveProperty('to');
    });
    /* so o dia de hoje */
    expect(pedidos).toEqual([{ stay_from: HOJE, stay_to: HOJE }]);
  });

  it('rentacar: um aluguer em curso (comecou antes de hoje) conta nos alugueres activos', async () => {
    const antesDeOntem = new Date();
    antesDeOntem.setDate(antesDeOntem.getDate() - 2);
    const depois = new Date();
    depois.setDate(depois.getDate() + 3);
    carregaServicos({
      units: [{ id: 'v1', name: 'Viatura 1', unit_type: 'car', status: 'available', is_active: true }],
      hoje: [{
        id: 'r1', unit_id: 'v1', status: 'checked_in',
        check_in: antesDeOntem.toLocaleDateString('en-CA'),
        check_out: depois.toLocaleDateString('en-CA'),
      }],
    });
    renderGenerico('rentacar');
    await screen.findByText('Viatura 1');
    expect(screen.getByText('Alugueres activos').parentElement.nextElementSibling).toHaveTextContent('1');
  });

  it('servicos a falhar nao rebentam', async () => {
    servicosAFalhar();
    renderGenerico('restaurant');
    expect(await screen.findByText('Sem mesas registadas.')).toBeInTheDocument();
    expect(screen.getByText('Covers hoje')).toBeInTheDocument();
    expect(screen.getByText('Accoes Rapidas')).toBeInTheDocument();
    await esperaCarregar();
  });

  it('uma chamada a falhar nao apaga os dados das outras', async () => {
    carregaServicos({ units: [{ id: 'u1', name: 'Quarto 1', unit_type: 'double', status: 'available', is_active: true }] });
    listReservations.mockReset().mockRejectedValue(new Error('falha de rede'));
    renderGenerico('hotel');
    expect(await screen.findByText('Quarto 1')).toBeInTheDocument();
    expect(screen.queryByText('Sem unidades registadas.')).not.toBeInTheDocument();
  });

  it('reservas sem campos nao rebentam', async () => {
    const vazia = { id: 'x', status: 'confirmed' };
    carregaServicos({ units: [{ id: 'u9', name: 'Mesa 9' }], hoje: [vazia] });
    renderGenerico('restaurant');
    expect(await screen.findByText('Mesa 9')).toBeInTheDocument();
    expect(screen.getByText('Covers hoje').parentElement.nextElementSibling).toHaveTextContent('0');
  });
});
