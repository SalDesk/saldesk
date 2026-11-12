import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Calendar from '../pages/Calendar';
import useUiStore from '../store/uiStore';
import { getCalendar } from '../services/calendarService';
import { listStaff } from '../services/staffService';

/* Sem rede: os servicos da pagina sao simulados e rejeitam formas de argumentos desconhecidas */
vi.mock('../services/calendarService', () => ({
  getCalendar: vi.fn(),
  createBlockedDates: vi.fn(),
  deleteBlockedDate: vi.fn(),
  updateReservation: vi.fn(),
}));
vi.mock('../services/staffService', () => ({
  listStaff: vi.fn(),
}));

const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const DIAS_ABR = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

/* ---- Datas (calculadas a parte da pagina, sem as funcoes dela) ---- */

function iso(ano, mes, dia) {
  return new Date(Date.UTC(ano, mes - 1, dia)).toISOString().slice(0, 10);
}

function somaDias(texto, n) {
  const [a, m, d] = texto.split('-').map(Number);
  return iso(a, m, d + n);
}

/* Segunda-feira da semana que contem a data (formato AAAA-MM-DD) */
function segundaDe(texto) {
  const [a, m, d] = texto.split('-').map(Number);
  const dow = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
  return iso(a, m, d + (dow === 0 ? -6 : 1 - dow));
}

/* "Hoje" tal como a pagina o define (data UTC do relogio) */
function hojeDaPagina() {
  return new Date().toISOString().slice(0, 10);
}

/* O que o cabecalho mostra para cada dia: numero + abreviatura */
function cabecalhoEsperado(inicio) {
  return Array.from({ length: 7 }, (_, i) => {
    const dia = somaDias(inicio, i);
    const dow = new Date(dia + 'T00:00:00Z').getUTCDay();
    return `${parseInt(dia.slice(8), 10)}${DIAS_ABR[dow]}`;
  });
}

/* ---- Dados ---- */

function unidade(over) {
  return { id: 'u1', name: 'Quarto Azul', unit_type: 'room', ...over };
}

const UNIDADES = [
  unidade({ id: 'u1', name: 'Quarto Azul' }),
  unidade({ id: 'u2', name: 'Quarto Verde' }),
];

const GUIAS = [
  { id: 'g1', name: 'Guia Ana' },
  { id: 'g2', name: 'Guia Rui' },
];

function reserva(over) {
  return {
    id: 'r1', unit_id: 'u1', status: 'confirmed', guests: 2,
    check_in: '2026-01-01', check_out: '2026-01-02', customer_name: 'Alfa Silva',
    ...over,
  };
}

/* Tres reservas relativas a uma segunda-feira: r1 multi-dia em u1 (staff_id g1),
   r2 de uma noite em u2 (guide_id g2), r3 no mesmo dia (domingo) em u2 (sem guia) */
function dadosDaSemana(seg, extra = {}) {
  return {
    units: UNIDADES,
    reservations: [
      reserva({ id: 'r1', unit_id: 'u1', customer_name: 'Alfa Silva', check_in: somaDias(seg, 1), check_out: somaDias(seg, 4), staff_id: 'g1' }),
      reserva({ id: 'r2', unit_id: 'u2', customer_name: 'Beta Costa', status: 'pending', check_in: somaDias(seg, 0), check_out: somaDias(seg, 1), guide_id: 'g2' }),
      reserva({ id: 'r3', unit_id: 'u2', customer_name: 'Gama Dias', check_in: somaDias(seg, 6), check_out: somaDias(seg, 6) }),
    ],
    blocked_dates: [],
    ...extra,
  };
}

let dadosActuais;

function carregaServicos({ dados, guias = GUIAS } = {}) {
  dadosActuais = dados;
  getCalendar.mockReset().mockImplementation((...args) => {
    if (args.length !== 2 || !ISO.test(args[0]) || !ISO.test(args[1])) {
      throw new Error(`getCalendar chamado com argumentos inesperados: ${JSON.stringify(args)}`);
    }
    return Promise.resolve(JSON.parse(JSON.stringify(dadosActuais)));
  });
  listStaff.mockReset().mockImplementation((...args) => {
    if (args.length !== 0) throw new Error(`listStaff chamado com argumentos inesperados: ${JSON.stringify(args)}`);
    return Promise.resolve(guias);
  });
}

function renderPagina() {
  return render(
    <MemoryRouter future={FUTURE}>
      <Calendar />
    </MemoryRouter>
  );
}

/* ---- Ajudantes de interaccao ---- */

/* Espera que o pedido em curso termine (o spinner desaparece) */
async function esperaCarregar() {
  await waitFor(() => {
    expect(getCalendar).toHaveBeenCalled();
    expect(document.querySelector('.animate-spin')).toBeNull();
  });
}

/* Executa uma accao que dispara novo pedido ao calendario e espera que acabe */
async function accaoQueRecarrega(accao) {
  const antes = getCalendar.mock.calls.length;
  accao();
  await waitFor(() => expect(getCalendar.mock.calls.length).toBe(antes + 1));
  await esperaCarregar();
}

async function abrePagina() {
  renderPagina();
  await esperaCarregar();
}

async function abreSemana() {
  await abrePagina();
  await accaoQueRecarrega(() => fireEvent.click(screen.getByRole('button', { name: 'Semana' })));
}

/* Os dois botoes de navegacao (so com icone): anterior e seguinte */
function botoesNav() {
  const vazios = screen.getAllByRole('button').filter(b => b.textContent === '');
  expect(vazios).toHaveLength(2);
  return { anterior: vazios[0], seguinte: vazios[1] };
}

function dias() {
  return [...document.querySelectorAll('thead th')].slice(1).map(th => th.textContent);
}

function celulas(nomeUnidade) {
  const linha = [...document.querySelectorAll('tbody tr')].find(tr => tr.querySelector('td')?.firstElementChild?.textContent === nomeUnidade);
  expect(linha).toBeTruthy();
  return [...linha.querySelectorAll('td')].slice(1).map(td => td.textContent);
}

function nomesDasUnidades() {
  return [...document.querySelectorAll('tbody tr td:first-child')].map(td => td.firstElementChild?.textContent).filter(Boolean);
}

/* Unidades na vista de mes: cabecalhos de coluna */
function colunasDoMes() {
  return [...document.querySelectorAll('thead th')].slice(1).map(th => th.firstElementChild.textContent);
}

/* Cartao de uma unidade na vista de dia (o nome esta em <p>, dentro de dois blocos) */
function cartaoDoDia(nome) {
  const p = screen.getAllByText(nome).find(e => e.tagName === 'P');
  return p.parentElement.parentElement.parentElement;
}

function seletor(textoOpcaoVazia) {
  return screen.getByDisplayValue(textoOpcaoVazia);
}

/* Cada campo do desenho do sistema traz a etiqueta logo por cima, no mesmo bloco.
   (O componente de campo nao liga a etiqueta por htmlFor, por isso getByLabelText nao serve.) */
function etiquetaDe(texto) {
  const etiqueta = screen.getAllByText(texto).find(e => e.tagName === 'LABEL');
  expect(etiqueta).toBeTruthy();
  return etiqueta;
}

describe('Calendar', () => {
  let errSpy;
  let warnSpy;
  let esperaErros;

  beforeEach(() => {
    useUiStore.setState({ lang: 'pt' });
    esperaErros = false;
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    /* nenhum erro ou aviso no consolo, salvo no caso explicito de servicos a falhar */
    if (!esperaErros) expect(errSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
    warnSpy.mockRestore();
  });

  describe('semana actual', () => {
    let seg;

    beforeEach(() => {
      seg = segundaDe(hojeDaPagina());
      carregaServicos({ dados: dadosDaSemana(seg) });
    });

    it('mostra o titulo e, por omissao, a vista de mes com as unidades', async () => {
      await abrePagina();
      expect(screen.getByRole('heading', { name: 'Calendario' })).toBeInTheDocument();
      expect(screen.getByText('Gerir disponibilidade e reservas')).toBeInTheDocument();
      expect(colunasDoMes()).toEqual(['Quarto Azul', 'Quarto Verde']);
      /* a vista de mes tem a coluna "Dia", nao "Unidade" */
      expect(screen.getByRole('columnheader', { name: 'Dia' })).toBeInTheDocument();
      /* pedido do mes inteiro, em hora local */
      const hoje = new Date();
      const mm = String(hoje.getMonth() + 1).padStart(2, '0');
      const ultimo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
      expect(getCalendar).toHaveBeenLastCalledWith(`${hoje.getFullYear()}-${mm}-01`, `${hoje.getFullYear()}-${mm}-${String(ultimo).padStart(2, '0')}`);
      expect(document.querySelectorAll('tbody tr')).toHaveLength(ultimo);
    });

    it('a grelha mostra os sete dias da semana actual e as unidades', async () => {
      await abreSemana();
      expect(getCalendar).toHaveBeenLastCalledWith(seg, somaDias(seg, 6));
      expect(screen.getByText('Unidade')).toBeInTheDocument();
      expect(dias()).toEqual(cabecalhoEsperado(seg));
      expect(dias()[0].endsWith('Seg')).toBe(true);
      expect(dias()[6].endsWith('Dom')).toBe(true);
      expect(nomesDasUnidades()).toEqual(['Quarto Azul', 'Quarto Verde']);
    });

    it('"seguinte" e "anterior" mudam os dias', async () => {
      await abreSemana();
      const { anterior, seguinte } = botoesNav();

      await accaoQueRecarrega(() => fireEvent.click(seguinte));
      expect(getCalendar).toHaveBeenLastCalledWith(somaDias(seg, 7), somaDias(seg, 13));
      expect(dias()).toEqual(cabecalhoEsperado(somaDias(seg, 7)));

      await accaoQueRecarrega(() => fireEvent.click(anterior));
      expect(dias()).toEqual(cabecalhoEsperado(seg));

      await accaoQueRecarrega(() => fireEvent.click(anterior));
      expect(getCalendar).toHaveBeenLastCalledWith(somaDias(seg, -7), somaDias(seg, -1));
      expect(dias()).toEqual(cabecalhoEsperado(somaDias(seg, -7)));
    });

    it('uma reserva multi-dia ocupa as celulas certas', async () => {
      await abreSemana();
      /* r1: entra na terca, sai na sexta (saida nao ocupa); r2: so a segunda; r3: mesmo dia, domingo */
      expect(celulas('Quarto Azul')).toEqual(['', 'Alfa', '·', '·', '', '', '']);
      expect(celulas('Quarto Verde')).toEqual(['Beta', '', '', '', '', '', 'Gama']);
      /* o titulo vai em cada celula ocupada */
      expect(screen.getAllByTitle('Alfa Silva · Confirmada')).toHaveLength(3);
      expect(screen.getAllByTitle('Beta Costa · Pendente')).toHaveLength(1);
    });

    it('uma reserva de um so dia (entrada = saida) ocupa so essa celula e nao se repete', async () => {
      const umDia = reserva({ id: 'r9', unit_id: 'u1', customer_name: 'Delta Pires', check_in: somaDias(seg, 2), check_out: somaDias(seg, 2) });
      carregaServicos({ dados: { units: UNIDADES, reservations: [umDia], blocked_dates: [] } });
      await abreSemana();
      /* quarta-feira: so o nome; quinta a domingo continuam livres (antes repetia-se com '·') */
      expect(celulas('Quarto Azul')).toEqual(['', '', 'Delta', '', '', '', '']);
      expect(screen.getAllByTitle('Delta Pires · Confirmada')).toHaveLength(1);
    });

    it('varias_reservas_da_mesma_unidade_no_mesmo_dia_aparecem_todas', async () => {
      const dia = somaDias(seg, 2);
      const duas = [
        reserva({ id: 'r8', unit_id: 'u1', customer_name: 'Delta Pires', check_in: dia, check_out: dia }),
        reserva({ id: 'r9', unit_id: 'u1', customer_name: 'Omega Lopes', check_in: dia, check_out: dia, status: 'pending' }),
      ];
      carregaServicos({ dados: { units: UNIDADES, reservations: duas, blocked_dates: [] } });
      await abreSemana();
      expect(screen.getAllByTitle('Delta Pires · Confirmada')).toHaveLength(1);
      expect(screen.getAllByTitle('Omega Lopes · Pendente')).toHaveLength(1);
      expect(celulas('Quarto Azul')[2]).toBe('DeltaOmega');
      /* cada uma abre o seu detalhe */
      fireEvent.click(screen.getByTitle('Omega Lopes · Pendente'));
      expect(await screen.findByText('Detalhe da reserva')).toBeInTheDocument();
      expect(screen.getByText('Omega Lopes')).toBeInTheDocument();
    });

    it('uma_reserva_cancelada_nao_esconde_a_activa_do_mesmo_dia_e_fica_por_ultimo', async () => {
      const dia = somaDias(seg, 3);
      const duas = [
        reserva({ id: 'r8', unit_id: 'u1', customer_name: 'Cancelada Cruz', check_in: dia, check_out: dia, status: 'cancelled' }),
        reserva({ id: 'r9', unit_id: 'u1', customer_name: 'Activa Alves', check_in: dia, check_out: dia }),
      ];
      carregaServicos({ dados: { units: UNIDADES, reservations: duas, blocked_dates: [] } });
      await abreSemana();
      expect(celulas('Quarto Azul')[3]).toBe('ActivaCancelada');
    });

    it('as celulas bloqueadas mostram "Bloq."', async () => {
      carregaServicos({ dados: dadosDaSemana(seg, { blocked_dates: [{ id: 'b1', unit_id: 'u1', date: somaDias(seg, 5) }] }) });
      await abreSemana();
      expect(celulas('Quarto Azul')).toEqual(['', 'Alfa', '·', '·', '', 'Bloq.', '']);
    });

    it('clicar numa reserva abre o detalhe', async () => {
      await abreSemana();
      expect(screen.queryByText('Detalhe da reserva')).not.toBeInTheDocument();
      fireEvent.click(screen.getAllByTitle('Alfa Silva · Confirmada')[0]);
      const titulo = await screen.findByText('Detalhe da reserva');
      expect(titulo).toBeInTheDocument();
      expect(screen.getByText('Alfa Silva')).toBeInTheDocument();
    });

    it('filtrar por unidade esconde as outras', async () => {
      await abreSemana();
      const sel = seletor('Todas as unidades');
      expect([...sel.options].map(o => o.textContent)).toEqual(['Todas as unidades', 'Quarto Azul', 'Quarto Verde']);

      fireEvent.change(sel, { target: { value: 'u2' } });
      expect(nomesDasUnidades()).toEqual(['Quarto Verde']);

      fireEvent.change(sel, { target: { value: 'u1' } });
      expect(nomesDasUnidades()).toEqual(['Quarto Azul']);

      fireEvent.change(sel, { target: { value: '' } });
      expect(nomesDasUnidades()).toEqual(['Quarto Azul', 'Quarto Verde']);
    });

    it('filtrar por guia deixa so as unidades com reservas desse guia', async () => {
      await abreSemana();
      const sel = seletor('Todos os guias');
      expect([...sel.options].map(o => o.textContent)).toEqual(['Todos os guias', 'Guia Ana', 'Guia Rui']);

      /* staff_id g1 -> r1 em u1 */
      fireEvent.change(sel, { target: { value: 'g1' } });
      expect(nomesDasUnidades()).toEqual(['Quarto Azul']);
      expect(celulas('Quarto Azul')).toEqual(['', 'Alfa', '·', '·', '', '', '']);

      /* guide_id g2 -> r2 em u2 (as reservas dessa unidade mantem-se visiveis) */
      fireEvent.change(sel, { target: { value: 'g2' } });
      expect(nomesDasUnidades()).toEqual(['Quarto Verde']);
      expect(celulas('Quarto Verde')).toEqual(['Beta', '', '', '', '', '', 'Gama']);

      fireEvent.change(sel, { target: { value: '' } });
      expect(nomesDasUnidades()).toEqual(['Quarto Azul', 'Quarto Verde']);
    });

    it('os filtros de unidade e de guia combinam-se', async () => {
      await abreSemana();
      fireEvent.change(seletor('Todos os guias'), { target: { value: 'g1' } });
      fireEvent.change(seletor('Todas as unidades'), { target: { value: 'u2' } });
      expect(nomesDasUnidades()).toEqual([]);
      expect(screen.getByText('Sem unidades activas.')).toBeInTheDocument();
    });

    it('o filtro de unidade tambem vale na vista de mes', async () => {
      await abrePagina();
      fireEvent.change(seletor('Todas as unidades'), { target: { value: 'u1' } });
      expect(colunasDoMes()).toEqual(['Quarto Azul']);
    });

    it('so mostra o filtro de unidade com mais de uma unidade', async () => {
      carregaServicos({ dados: { ...dadosDaSemana(seg), units: [UNIDADES[0]] } });
      await abrePagina();
      expect(screen.queryByDisplayValue('Todas as unidades')).not.toBeInTheDocument();
      expect(screen.getByDisplayValue('Todos os guias')).toBeInTheDocument();
    });

    it('so mostra o filtro de guia quando ha guias', async () => {
      carregaServicos({ dados: dadosDaSemana(seg), guias: [] });
      await abrePagina();
      expect(screen.queryByDisplayValue('Todos os guias')).not.toBeInTheDocument();
      expect(screen.getByDisplayValue('Todas as unidades')).toBeInTheDocument();
    });

    it('os selects tem etiqueta', async () => {
      await abrePagina();
      expect(etiquetaDe('Por unidade').nextElementSibling).toBe(seletor('Todas as unidades'));
      expect(etiquetaDe('Por guia').nextElementSibling).toBe(seletor('Todos os guias'));
    });

    it('a vista de dia mostra cada unidade com a reserva, o bloqueio ou a disponibilidade', async () => {
      const hoje = hojeDaPagina();
      carregaServicos({
        dados: {
          units: [...UNIDADES, unidade({ id: 'u3', name: 'Quarto Rosa' })],
          reservations: [reserva({ id: 'r1', unit_id: 'u1', customer_name: 'Alfa Silva', guests: 3, total_price: 150, check_in: hoje, check_out: somaDias(hoje, 1) })],
          blocked_dates: [{ id: 'b1', unit_id: 'u2', date: hoje }],
        },
      });
      await abrePagina();
      await accaoQueRecarrega(() => fireEvent.click(screen.getByRole('button', { name: 'Dia' })));
      expect(getCalendar).toHaveBeenLastCalledWith(hoje, hoje);
      expect(cartaoDoDia('Quarto Azul')).toBeTruthy();

      const azul = within(cartaoDoDia('Quarto Azul'));
      expect(azul.getByText('Alfa Silva')).toBeInTheDocument();
      expect(azul.getByText(/Confirmada · 3 pax/)).toBeInTheDocument();
      expect(azul.queryByRole('button', { name: 'Bloquear' })).not.toBeInTheDocument();

      const verde = within(cartaoDoDia('Quarto Verde'));
      expect(verde.getByText('Bloqueado')).toBeInTheDocument();
      expect(verde.getByRole('button', { name: 'Desbloquear' })).toBeInTheDocument();

      const rosa = within(cartaoDoDia('Quarto Rosa'));
      expect(rosa.getByText('Disponivel')).toBeInTheDocument();
      expect(rosa.getByRole('button', { name: 'Bloquear' })).toBeInTheDocument();
    });

    it('a vista de dia lista todas as reservas da unidade nesse dia', async () => {
      const hoje = hojeDaPagina();
      carregaServicos({
        dados: {
          units: UNIDADES,
          reservations: [
            reserva({ id: 'r1', unit_id: 'u1', customer_name: 'Alfa Silva', check_in: hoje, check_out: hoje }),
            reserva({ id: 'r2', unit_id: 'u1', customer_name: 'Beta Costa', check_in: hoje, check_out: hoje, status: 'pending' }),
          ],
          blocked_dates: [],
        },
      });
      await abrePagina();
      await accaoQueRecarrega(() => fireEvent.click(screen.getByRole('button', { name: 'Dia' })));
      const azul = within(cartaoDoDia('Quarto Azul'));
      expect(azul.getByText('Alfa Silva')).toBeInTheDocument();
      expect(azul.getByText('Beta Costa')).toBeInTheDocument();
      expect(azul.queryByText('Disponivel')).not.toBeInTheDocument();
      expect(azul.queryByRole('button', { name: 'Bloquear' })).not.toBeInTheDocument();
    });

    it('servicos a falhar nao rebentam: a vista de mes mostra o vazio', async () => {
      esperaErros = true;
      getCalendar.mockReset().mockRejectedValue(new Error('falha de rede'));
      listStaff.mockReset().mockRejectedValue(new Error('falha de rede'));
      await abrePagina();
      expect(screen.getByText('Sem unidades activas. Crie unidades primeiro.')).toBeInTheDocument();
      expect(screen.queryByDisplayValue('Todas as unidades')).not.toBeInTheDocument();
      expect(screen.queryByDisplayValue('Todos os guias')).not.toBeInTheDocument();
      expect(errSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('viragem de mes e de ano (data simulada)', () => {
    /* So a Date e simulada, para os temporizadores do findBy/waitFor continuarem reais.
       Hora local do meio-dia; restaurada no afterEach (useRealTimers). */
    function fixaHoje(ano, mes, dia) {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(ano, mes - 1, dia, 12, 0, 0));
    }

    it('29 de Dezembro de 2026: a semana atravessa o fim do ano', async () => {
      fixaHoje(2026, 12, 29);
      carregaServicos({ dados: dadosDaSemana('2026-12-28') });
      await abreSemana();

      /* terca 29/12 -> segunda 28/12 a domingo 3/1 */
      expect(getCalendar).toHaveBeenLastCalledWith('2026-12-28', '2027-01-03');
      expect(dias()).toEqual(['28Seg', '29Ter', '30Qua', '31Qui', '1Sex', '2Sab', '3Dom']);
      expect(screen.getByText('28 Dez - 3 Jan 2027')).toBeInTheDocument();

      const { anterior, seguinte } = botoesNav();
      await accaoQueRecarrega(() => fireEvent.click(seguinte));
      expect(getCalendar).toHaveBeenLastCalledWith('2027-01-04', '2027-01-10');
      expect(dias()).toEqual(['4Seg', '5Ter', '6Qua', '7Qui', '8Sex', '9Sab', '10Dom']);
      expect(screen.getByText('4 - 10 Jan 2027')).toBeInTheDocument();

      await accaoQueRecarrega(() => fireEvent.click(anterior));
      await accaoQueRecarrega(() => fireEvent.click(anterior));
      expect(getCalendar).toHaveBeenLastCalledWith('2026-12-21', '2026-12-27');
      expect(dias()).toEqual(['21Seg', '22Ter', '23Qua', '24Qui', '25Sex', '26Sab', '27Dom']);
      expect(screen.getByText('21 - 27 Dez 2026')).toBeInTheDocument();
    });

    it('29 de Dezembro de 2026: uma reserva ocupa as celulas dos dois lados da viragem do ano', async () => {
      fixaHoje(2026, 12, 29);
      carregaServicos({
        dados: {
          units: UNIDADES,
          reservations: [reserva({ id: 'rx', unit_id: 'u1', customer_name: 'Delta Reis', check_in: '2026-12-30', check_out: '2027-01-02' })],
          blocked_dates: [],
        },
      });
      await abreSemana();
      /* ocupa 30/12, 31/12 e 1/1; a saida (2/1) fica livre */
      expect(celulas('Quarto Azul')).toEqual(['', '', 'Delta', '·', '·', '', '']);
    });

    it('1 de Marco de 2026 (domingo): a semana comeca na segunda anterior, em Fevereiro', async () => {
      fixaHoje(2026, 3, 1);
      carregaServicos({ dados: dadosDaSemana('2026-02-23') });
      await abreSemana();

      expect(getCalendar).toHaveBeenLastCalledWith('2026-02-23', '2026-03-01');
      expect(dias()).toEqual(['23Seg', '24Ter', '25Qua', '26Qui', '27Sex', '28Sab', '1Dom']);
      expect(screen.getByText('23 Fev - 1 Mar 2026')).toBeInTheDocument();

      const { anterior, seguinte } = botoesNav();
      await accaoQueRecarrega(() => fireEvent.click(seguinte));
      expect(getCalendar).toHaveBeenLastCalledWith('2026-03-02', '2026-03-08');
      expect(dias()).toEqual(['2Seg', '3Ter', '4Qua', '5Qui', '6Sex', '7Sab', '8Dom']);

      await accaoQueRecarrega(() => fireEvent.click(anterior));
      await accaoQueRecarrega(() => fireEvent.click(anterior));
      expect(getCalendar).toHaveBeenLastCalledWith('2026-02-16', '2026-02-22');
      expect(dias()).toEqual(['16Seg', '17Ter', '18Qua', '19Qui', '20Sex', '21Sab', '22Dom']);
      expect(screen.getByText('16 - 22 Fev 2026')).toBeInTheDocument();
    });

    it('vista de mes em Dezembro: seguinte vai a Janeiro do ano seguinte e anterior volta', async () => {
      fixaHoje(2026, 12, 29);
      carregaServicos({ dados: dadosDaSemana('2026-12-28') });
      await abrePagina();
      expect(screen.getByText('Dezembro 2026')).toBeInTheDocument();
      expect(getCalendar).toHaveBeenLastCalledWith('2026-12-01', '2026-12-31');
      expect(document.querySelectorAll('tbody tr')).toHaveLength(31);

      const { anterior, seguinte } = botoesNav();
      await accaoQueRecarrega(() => fireEvent.click(seguinte));
      expect(screen.getByText('Janeiro 2027')).toBeInTheDocument();
      expect(getCalendar).toHaveBeenLastCalledWith('2027-01-01', '2027-01-31');

      await accaoQueRecarrega(() => fireEvent.click(anterior));
      expect(screen.getByText('Dezembro 2026')).toBeInTheDocument();
      expect(getCalendar).toHaveBeenLastCalledWith('2026-12-01', '2026-12-31');
    });

    it('vista de mes: uma reserva de um so dia aparece so nesse dia', async () => {
      fixaHoje(2026, 3, 10);
      const umDia = reserva({ id: 'r9', unit_id: 'u1', customer_name: 'Delta Pires', check_in: '2026-03-12', check_out: '2026-03-12' });
      carregaServicos({ dados: { units: UNIDADES, reservations: [umDia], blocked_dates: [] } });
      await abrePagina();
      /* uma linha por dia; a coluna 1 e o dia, a 2 e Quarto Azul */
      const linhas = [...document.querySelectorAll('tbody tr')];
      const celulaAzul = (dia) => linhas[dia - 1].querySelectorAll('td')[1].textContent;
      expect(celulaAzul(11)).toBe('');
      expect(celulaAzul(12)).toBe('Delta Pires');
      for (const dia of [13, 14, 20, 31]) expect(celulaAzul(dia)).toBe('');
      expect(screen.getAllByTitle('Delta Pires · confirmed')).toHaveLength(1);
    });

    it('vista de mes: varias reservas da mesma unidade no mesmo dia aparecem todas', async () => {
      fixaHoje(2026, 3, 10);
      const duas = [
        reserva({ id: 'r8', unit_id: 'u1', customer_name: 'Delta Pires', check_in: '2026-03-12', check_out: '2026-03-12' }),
        reserva({ id: 'r9', unit_id: 'u1', customer_name: 'Omega Lopes', check_in: '2026-03-12', check_out: '2026-03-12' }),
      ];
      carregaServicos({ dados: { units: UNIDADES, reservations: duas, blocked_dates: [] } });
      await abrePagina();
      const linhas = [...document.querySelectorAll('tbody tr')];
      expect(linhas[11].querySelectorAll('td')[1].textContent).toBe('Delta PiresOmega Lopes');
      expect(screen.getAllByTitle('Delta Pires · confirmed')).toHaveLength(1);
      expect(screen.getAllByTitle('Omega Lopes · confirmed')).toHaveLength(1);
    });

    it('vista de mes em Marco: anterior vai a Fevereiro com 28 dias', async () => {
      fixaHoje(2026, 3, 1);
      carregaServicos({ dados: dadosDaSemana('2026-02-23') });
      await abrePagina();
      expect(screen.getByText('Marco 2026')).toBeInTheDocument();
      expect(document.querySelectorAll('tbody tr')).toHaveLength(31);

      const { anterior } = botoesNav();
      await accaoQueRecarrega(() => fireEvent.click(anterior));
      expect(screen.getByText('Fevereiro 2026')).toBeInTheDocument();
      expect(getCalendar).toHaveBeenLastCalledWith('2026-02-01', '2026-02-28');
      expect(document.querySelectorAll('tbody tr')).toHaveLength(28);
    });
  });
});
