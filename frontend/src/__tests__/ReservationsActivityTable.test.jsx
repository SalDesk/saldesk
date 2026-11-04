import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ActivityTable from '../pages/reservations/ActivityTable';
import useUiStore from '../store/uiStore';
import { changeStatus } from '../services/reservationsService';

/* Sem rede: so o que a tabela e o modal de equipa importam e simulado */
vi.mock('../services/reservationsService', () => ({
  changeStatus: vi.fn(),
}));
vi.mock('../services/fleetService', () => ({
  listFleet: vi.fn().mockResolvedValue([]),
}));
vi.mock('../services/assignmentService', () => ({
  createCompositeAssignment: vi.fn(),
}));

const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };

/* Datas locais relativas a hoje, nunca fixas nem em UTC */
function dataLocal(dias = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toLocaleDateString('en-CA');
}
function formatada(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
const HOJE = dataLocal(0);
const AMANHA = dataLocal(1);
const DEPOIS = dataLocal(2);
const ONTEM = dataLocal(-1);

function reserva(over) {
  return {
    id: 'aaaaaaaa-0001', unit_id: 'u1', status: 'confirmed', guests: 2, source: 'direct',
    check_in: HOJE, check_out: AMANHA, customer_name: 'Cliente Alfa', customer_country: 'CV',
    total_price: 100, units: { name: 'Tour Pedra de Lume' },
    ...over,
  };
}

const CABECALHOS = ['Ref', 'Tour', 'Data', 'Cliente', 'Pax', 'Origem', 'Estado', 'Total', ''];

describe('ActivityTable (tabela de reservas de atividades)', () => {
  let errSpy;
  let warnSpy;
  let esperaErros;
  let props;

  beforeEach(() => {
    useUiStore.setState({ lang: 'pt' });
    changeStatus.mockReset().mockImplementation(async (id, status) => ({ id, status }));
    props = {
      reservations: [reserva()],
      units: [],
      guides: [],
      onEdit: vi.fn(),
      onDelete: vi.fn(),
      onUpdate: vi.fn(),
      onReschedule: vi.fn(),
      onNoShow: vi.fn(),
      onVoucher: vi.fn(),
      voucherLoading: null,
      onView: vi.fn(),
    };
    esperaErros = false;
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    /* nenhum erro ou aviso no consolo, salvo no caso explicito de a mudanca de estado falhar */
    if (!esperaErros) expect(errSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
    warnSpy.mockRestore();
  });

  function renderTabela(over = {}) {
    return render(
      <MemoryRouter future={FUTURE}>
        <ActivityTable {...props} {...over} />
      </MemoryRouter>
    );
  }

  /* A tabela do ecra largo (os cartoes do telemovel sao divs, so ha uma <table>) */
  function tabela() {
    return screen.getByRole('table');
  }
  function linhas() {
    return within(tabela()).getAllByRole('row').slice(1);
  }
  function refs() {
    return linhas().map(l => within(l).getAllByRole('cell')[0].textContent);
  }
  function botao(linha, nome) {
    return within(linha).getByRole('button', { name: nome });
  }
  function semBotao(linha, nome) {
    return within(linha).queryByRole('button', { name: nome });
  }

  describe('conteudo (comportamento actual)', () => {
    it('mostra as nove colunas pela ordem de hoje', () => {
      renderTabela();
      const cabecalhos = within(tabela()).getAllByRole('columnheader').map(th => th.textContent);
      expect(cabecalhos).toEqual(CABECALHOS);
    });

    it('cada celula mostra os valores de hoje', () => {
      renderTabela({
        reservations: [reserva({ id: 'abcdef12-3456', check_in: AMANHA, guests: 4, source: 'viator', total_price: 99.6, status: 'pending' })],
      });
      const celulas = within(linhas()[0]).getAllByRole('cell').map(c => c.textContent);
      expect(celulas.slice(0, 8)).toEqual([
        'abcdef12',
        'Tour Pedra de Lume',
        formatada(AMANHA),
        'Cliente AlfaCV',
        '4',
        'Viator',
        'Pendente',
        '€100',
      ]);
    });

    it('o total usa total_amount quando nao ha total_price e zero quando nao ha nenhum', () => {
      renderTabela({
        reservations: [
          reserva({ id: 'aaaaaaaa-0001', total_price: undefined, total_amount: 250 }),
          reserva({ id: 'bbbbbbbb-0002', total_price: undefined, total_amount: undefined }),
        ],
      });
      const totais = linhas().map(l => within(l).getAllByRole('cell')[7].textContent);
      expect(totais).toEqual(['€250', '€0']);
    });

    it('o nome do tour vem da lista de unidades quando a reserva nao o traz', () => {
      renderTabela({
        reservations: [reserva({ units: undefined, unit_id: 'u9' })],
        units: [{ id: 'u9', name: 'Tour Salinas' }],
      });
      expect(within(linhas()[0]).getAllByRole('cell')[1]).toHaveTextContent('Tour Salinas');
    });

    it('campos em falta mostram o travessao e nao rebentam', () => {
      renderTabela({
        reservations: [reserva({
          units: undefined, unit_id: 'u-desconhecida', customer_name: undefined, customer_country: undefined,
          guests: undefined, source: undefined, check_in: undefined, total_price: undefined,
        })],
      });
      const celulas = within(linhas()[0]).getAllByRole('cell');
      expect(celulas[1]).toHaveTextContent('—');
      expect(celulas[2]).toHaveTextContent('—');
      expect(celulas[3]).toHaveTextContent('—');
      expect(celulas[4].textContent).toBe('');
      expect(celulas[7]).toHaveTextContent('€0');
    });

    it('sem reservas mostra o vazio compacto e nenhuma tabela', () => {
      renderTabela({ reservations: [] });
      expect(screen.getByText('Sem resultados')).toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
  });

  describe('accoes (comportamento actual)', () => {
    it('Ver, Editar e Eliminar chamam o handler com a reserva da linha', () => {
      const r1 = reserva({ id: 'aaaaaaaa-0001' });
      const r2 = reserva({ id: 'bbbbbbbb-0002', customer_name: 'Cliente Beta' });
      renderTabela({ reservations: [r1, r2] });
      const [l1, l2] = linhas();

      fireEvent.click(botao(l2, 'Ver'));
      expect(props.onView).toHaveBeenCalledTimes(1);
      expect(props.onView).toHaveBeenCalledWith(r2);

      fireEvent.click(botao(l1, 'Editar'));
      expect(props.onEdit).toHaveBeenCalledTimes(1);
      expect(props.onEdit).toHaveBeenCalledWith(r1);

      fireEvent.click(botao(l2, 'Eliminar'));
      expect(props.onDelete).toHaveBeenCalledTimes(1);
      expect(props.onDelete).toHaveBeenCalledWith(r2);
    });

    it('Reagendar e Enviar voucher chamam o handler com a reserva da linha', () => {
      const r1 = reserva({ id: 'aaaaaaaa-0001' });
      const r2 = reserva({ id: 'bbbbbbbb-0002' });
      renderTabela({ reservations: [r1, r2] });
      const [l1, l2] = linhas();

      fireEvent.click(botao(l2, 'Reagendar'));
      expect(props.onReschedule).toHaveBeenCalledTimes(1);
      expect(props.onReschedule).toHaveBeenCalledWith(r2);

      fireEvent.click(botao(l1, 'Enviar voucher'));
      expect(props.onVoucher).toHaveBeenCalledTimes(1);
      expect(props.onVoucher).toHaveBeenCalledWith(r1);
    });

    it('o voucher fica desactivado so na linha cujo id esta a enviar', () => {
      renderTabela({
        reservations: [reserva({ id: 'aaaaaaaa-0001' }), reserva({ id: 'bbbbbbbb-0002' })],
        voucherLoading: 'bbbbbbbb-0002',
      });
      const [l1, l2] = linhas();
      expect(botao(l1, 'Enviar voucher')).not.toBeDisabled();
      expect(botao(l2, 'Enviar voucher')).toBeDisabled();
    });

    it('No-show chama o handler com a reserva da linha', () => {
      const r = reserva({ status: 'pending' });
      renderTabela({ reservations: [r] });
      fireEvent.click(botao(linhas()[0], 'No-show'));
      expect(props.onNoShow).toHaveBeenCalledTimes(1);
      expect(props.onNoShow).toHaveBeenCalledWith(r);
    });

    it('Atribuir equipa abre o modal da reserva da linha e fecha-o com Cancelar', async () => {
      renderTabela({
        reservations: [
          reserva({ id: 'aaaaaaaa-0001', customer_name: 'Cliente Alfa' }),
          reserva({ id: 'bbbbbbbb-0002', customer_name: 'Cliente Beta', guests: 7 }),
        ],
      });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      fireEvent.click(botao(linhas()[1], 'Atribuir equipa'));
      const dialogo = await screen.findByRole('dialog');
      expect(within(dialogo).getByText(new RegExp(`${HOJE} · 7 pax · Cliente Beta`))).toBeInTheDocument();
      /* espera o fim do carregamento das viaturas para nao deixar estado por assentar */
      await within(dialogo).findByText(/Nenhuma viatura cadastrada/);

      fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it.each([
      ['pending', 'Confirmar', 'confirmed'],
      ['confirmed', 'Check-in', 'checked_in'],
      ['checked_in', 'Check-out', 'checked_out'],
    ])('avancar estado de %s: o botao %s chama changeStatus com %s e depois onUpdate', async (estado, rotulo, proximo) => {
      const r = reserva({ id: 'aaaaaaaa-0001', status: estado });
      renderTabela({ reservations: [r] });
      fireEvent.click(botao(linhas()[0], rotulo));
      await waitFor(() => expect(changeStatus).toHaveBeenCalledWith('aaaaaaaa-0001', proximo));
      await waitFor(() => expect(props.onUpdate).toHaveBeenCalledWith({ id: 'aaaaaaaa-0001', status: proximo }));
    });

    it('enquanto o estado muda, o botao de avancar da linha fica desactivado', async () => {
      let resolve;
      changeStatus.mockReset().mockImplementation(() => new Promise((res) => { resolve = res; }));
      renderTabela({
        reservations: [reserva({ id: 'aaaaaaaa-0001', status: 'pending' }), reserva({ id: 'bbbbbbbb-0002', status: 'pending' })],
      });
      const [l1, l2] = linhas();
      fireEvent.click(botao(l1, 'Confirmar'));
      await waitFor(() => expect(botao(l1, 'Confirmar')).toBeDisabled());
      expect(botao(l2, 'Confirmar')).not.toBeDisabled();

      resolve({ id: 'aaaaaaaa-0001', status: 'confirmed' });
      await waitFor(() => expect(botao(linhas()[0], 'Confirmar')).not.toBeDisabled());
      expect(props.onUpdate).toHaveBeenCalledWith({ id: 'aaaaaaaa-0001', status: 'confirmed' });
    });

    it('se a mudanca de estado falhar, regista o erro, nao chama onUpdate e reactiva o botao', async () => {
      esperaErros = true;
      const erro = new Error('falha de rede');
      changeStatus.mockReset().mockRejectedValue(erro);
      renderTabela({ reservations: [reserva({ status: 'pending' })] });
      fireEvent.click(botao(linhas()[0], 'Confirmar'));
      await waitFor(() => expect(errSpy).toHaveBeenCalledWith(erro));
      await waitFor(() => expect(botao(linhas()[0], 'Confirmar')).not.toBeDisabled());
      expect(props.onUpdate).not.toHaveBeenCalled();
    });

    /* visibilidade das accoes por estado: [estado, rotulo de avancar, no-show, atribuir equipa] */
    it.each([
      ['pending',     'Confirmar', true,  true],
      ['confirmed',   'Check-in',  true,  true],
      ['checked_in',  'Check-out', true,  true],
      ['checked_out', null,        false, true],
      ['cancelled',   null,        false, false],
      ['no_show',     null,        false, false],
    ])('estado %s: avancar=%s, no-show=%s, equipa=%s', (estado, rotuloAvancar, noShow, equipa) => {
      renderTabela({ reservations: [reserva({ status: estado })] });
      const linha = linhas()[0];
      for (const rotulo of ['Confirmar', 'Check-in', 'Check-out']) {
        if (rotulo === rotuloAvancar) expect(semBotao(linha, rotulo)).toBeInTheDocument();
        else expect(semBotao(linha, rotulo)).not.toBeInTheDocument();
      }
      expect(!!semBotao(linha, 'No-show')).toBe(noShow);
      expect(!!semBotao(linha, 'Atribuir equipa')).toBe(equipa);
      /* estas estao sempre presentes, em qualquer estado */
      for (const nome of ['Reagendar', 'Enviar voucher', 'Ver', 'Editar', 'Eliminar']) {
        expect(botao(linha, nome)).toBeInTheDocument();
      }
    });
  });

  describe('ordenacao com o componente Table', () => {
    const TRES = [
      reserva({ id: 'cccccccc-0003', check_in: DEPOIS, guests: 10, total_price: 20 }),
      reserva({ id: 'aaaaaaaa-0001', check_in: ONTEM,  guests: 2,  total_price: 300 }),
      reserva({ id: 'bbbbbbbb-0002', check_in: HOJE,   guests: 9,  total_price: 100 }),
    ];

    function cabecalho(nome) {
      return within(tabela()).getByRole('columnheader', { name: nome });
    }

    it('so Data, Pax e Total sao ordenaveis (aria-sort a none) e as outras colunas nao', () => {
      renderTabela({ reservations: TRES });
      for (const nome of ['Data', 'Pax', 'Total']) {
        expect(cabecalho(nome)).toHaveAttribute('aria-sort', 'none');
      }
      for (const nome of ['Ref', 'Tour', 'Cliente', 'Origem', 'Estado']) {
        expect(cabecalho(nome)).not.toHaveAttribute('aria-sort');
      }
    });

    it('clicar em Data ordena ascendente, depois descendente, depois repoe a ordem original', () => {
      renderTabela({ reservations: TRES });
      expect(refs()).toEqual(['cccccccc', 'aaaaaaaa', 'bbbbbbbb']);

      fireEvent.click(within(cabecalho('Data')).getByRole('button'));
      expect(cabecalho('Data')).toHaveAttribute('aria-sort', 'ascending');
      expect(refs()).toEqual(['aaaaaaaa', 'bbbbbbbb', 'cccccccc']);

      fireEvent.click(within(cabecalho('Data')).getByRole('button'));
      expect(cabecalho('Data')).toHaveAttribute('aria-sort', 'descending');
      expect(refs()).toEqual(['cccccccc', 'bbbbbbbb', 'aaaaaaaa']);

      fireEvent.click(within(cabecalho('Data')).getByRole('button'));
      expect(cabecalho('Data')).toHaveAttribute('aria-sort', 'none');
      expect(refs()).toEqual(['cccccccc', 'aaaaaaaa', 'bbbbbbbb']);
    });

    it('Pax ordena numericamente (9 antes de 10) e a terceira volta repoe a ordem original', () => {
      renderTabela({ reservations: TRES });
      fireEvent.click(within(cabecalho('Pax')).getByRole('button'));
      expect(refs()).toEqual(['aaaaaaaa', 'bbbbbbbb', 'cccccccc']); // 2, 9, 10

      fireEvent.click(within(cabecalho('Pax')).getByRole('button'));
      expect(refs()).toEqual(['cccccccc', 'bbbbbbbb', 'aaaaaaaa']); // 10, 9, 2

      fireEvent.click(within(cabecalho('Pax')).getByRole('button'));
      expect(refs()).toEqual(['cccccccc', 'aaaaaaaa', 'bbbbbbbb']);
    });

    it('Total ordena numericamente (20, 100, 300) e a terceira volta repoe a ordem original', () => {
      renderTabela({ reservations: TRES });
      fireEvent.click(within(cabecalho('Total')).getByRole('button'));
      expect(refs()).toEqual(['cccccccc', 'bbbbbbbb', 'aaaaaaaa']); // 20, 100, 300

      fireEvent.click(within(cabecalho('Total')).getByRole('button'));
      expect(refs()).toEqual(['aaaaaaaa', 'bbbbbbbb', 'cccccccc']); // 300, 100, 20

      fireEvent.click(within(cabecalho('Total')).getByRole('button'));
      expect(refs()).toEqual(['cccccccc', 'aaaaaaaa', 'bbbbbbbb']);
    });

    it('reservas com campos em falta ordenam sem rebentar', () => {
      renderTabela({
        reservations: [
          reserva({ id: 'aaaaaaaa-0001', check_in: undefined, guests: undefined, total_price: undefined }),
          reserva({ id: 'bbbbbbbb-0002', check_in: HOJE, guests: 3, total_price: 50 }),
        ],
      });
      for (const nome of ['Data', 'Pax', 'Total']) {
        fireEvent.click(within(cabecalho(nome)).getByRole('button'));
        expect(refs()).toHaveLength(2);
        fireEvent.click(within(cabecalho(nome)).getByRole('button'));
        fireEvent.click(within(cabecalho(nome)).getByRole('button'));
      }
    });

    it('as accoes continuam ligadas a reserva certa depois de ordenar', () => {
      renderTabela({ reservations: TRES });
      fireEvent.click(within(cabecalho('Data')).getByRole('button'));
      /* a primeira linha passa a ser a mais antiga (aaaaaaaa) */
      fireEvent.click(botao(linhas()[0], 'Editar'));
      expect(props.onEdit).toHaveBeenCalledWith(TRES[1]);
    });
  });
});
