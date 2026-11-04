import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RentacarTable from '../pages/reservations/RentacarTable';
import useUiStore from '../store/uiStore';

/* Sem rede: a tabela so importa o servico de reservas */
vi.mock('../services/reservationsService', () => ({
  changeStatus: vi.fn(),
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
const ONTEM = dataLocal(-1);
const HOJE = dataLocal(0);
const AMANHA = dataLocal(1);
const DEPOIS = dataLocal(2);
const MAIS_TRES = dataLocal(3);

function carro(over) {
  return {
    id: 'u1', name: 'Carro 1', unit_type: 'vehicle',
    description: '{"brand":"Fiat","model":"Panda","plate":"S-01-AB"}',
    ...over,
  };
}

function reserva(over) {
  return {
    id: 'aaaaaaaa-0001', unit_id: 'u1', status: 'confirmed', guests: 2,
    check_in: HOJE, check_out: AMANHA, customer_name: 'Cliente Alfa', total_price: 100,
    notes_internal: '{}',
    ...over,
  };
}

const CABECALHOS = ['Ref', 'Viatura', 'Levantamento', 'Devolucao', 'Cliente', 'Estado', 'Total', ''];

describe('RentacarTable (tabela de reservas de rent-a-car)', () => {
  let errSpy;
  let warnSpy;
  let props;

  beforeEach(() => {
    useUiStore.setState({ lang: 'pt' });
    props = {
      reservations: [reserva()],
      units: [carro()],
      onEdit: vi.fn(),
      onDelete: vi.fn(),
      onLevantamento: vi.fn(),
      onDevolucao: vi.fn(),
      onUpdate: vi.fn(),
      onView: vi.fn(),
    };
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    /* nenhum erro ou aviso no consolo */
    expect(errSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
    warnSpy.mockRestore();
  });

  function renderTabela(over = {}) {
    return render(
      <MemoryRouter future={FUTURE}>
        <RentacarTable {...props} {...over} />
      </MemoryRouter>
    );
  }

  function tabela() {
    return screen.getByRole('table');
  }
  function linhas() {
    return within(tabela()).getAllByRole('row').slice(1);
  }
  function celulas(linha) {
    return within(linha).getAllByRole('cell');
  }
  function refs() {
    return linhas().map(l => celulas(l)[0].textContent);
  }
  function botao(linha, nome) {
    return within(linha).getByRole('button', { name: nome });
  }
  function semBotao(linha, nome) {
    return within(linha).queryByRole('button', { name: nome });
  }

  describe('conteudo (comportamento actual)', () => {
    it('mostra as oito colunas pela ordem de hoje', () => {
      renderTabela();
      expect(within(tabela()).getAllByRole('columnheader').map(th => th.textContent)).toEqual(CABECALHOS);
    });

    it('cada celula mostra os valores de hoje, com matricula e quilometros', () => {
      renderTabela({
        reservations: [reserva({
          id: 'abcdef12-3456', check_in: HOJE, check_out: DEPOIS, status: 'checked_in', total_price: 99.6,
          notes_internal: JSON.stringify({ rentacar: { km_out: 12345, km_in: 12900 } }),
        })],
      });
      const c = celulas(linhas()[0]).map(x => x.textContent);
      expect(c).toEqual([
        'abcdef12',
        'Fiat PandaS-01-AB',
        `${formatada(HOJE)}${Number(12345).toLocaleString()} km`,
        `${formatada(DEPOIS)}${Number(12900).toLocaleString()} km`,
        'Cliente Alfa',
        'Check-in',
        '€100',
        'Devolucao',
      ]);
    });

    it('sem quilometros mostra so as datas; o total usa total_amount como alternativa', () => {
      renderTabela({
        reservations: [reserva({ total_price: undefined, total_amount: 250, check_in: HOJE, check_out: AMANHA })],
      });
      const c = celulas(linhas()[0]);
      expect(c[2].textContent).toBe(formatada(HOJE));
      expect(c[3].textContent).toBe(formatada(AMANHA));
      expect(c[6].textContent).toBe('€250');
    });

    it('viatura: marca sem modelo, sem marca usa o nome e sem unidade mostra o travessao', () => {
      renderTabela({
        reservations: [
          reserva({ id: 'aaaaaaaa-0001', unit_id: 'u1' }),
          reserva({ id: 'bbbbbbbb-0002', unit_id: 'u2' }),
          reserva({ id: 'cccccccc-0003', unit_id: 'u3' }),
          reserva({ id: 'dddddddd-0004', unit_id: 'inexistente' }),
        ],
        units: [
          carro({ id: 'u1', description: '{"brand":"Toyota"}' }),
          carro({ id: 'u2', name: 'Carro Dois', description: '{}' }),
          carro({ id: 'u3', name: 'Carro Tres', description: 'isto nao e json' }),
        ],
      });
      const viaturas = linhas().map(l => celulas(l)[1].textContent);
      expect(viaturas).toEqual(['Toyota', 'Carro Dois', 'Carro Tres', '—']);
    });

    it('campos em falta (cliente, datas, metadados invalidos) mostram o travessao e nao rebentam', () => {
      renderTabela({
        reservations: [reserva({
          customer_name: undefined, check_in: undefined, check_out: undefined, total_price: undefined,
          notes_internal: 'isto nao e json',
        })],
      });
      const c = celulas(linhas()[0]);
      expect(c[2].textContent).toBe('—');
      expect(c[3].textContent).toBe('—');
      expect(c[4].textContent).toBe('—');
      expect(c[6].textContent).toBe('€0');
    });

    it('sem metadados de aluguer (notes_internal ausente) nao rebenta', () => {
      renderTabela({ reservations: [reserva({ notes_internal: undefined })] });
      expect(celulas(linhas()[0])[2].textContent).toBe(formatada(HOJE));
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

    it.each(['pending', 'confirmed'])('um aluguer %s mostra Levantamento (e nao Devolucao) e chama onLevantamento com a reserva', (estado) => {
      const r = reserva({ status: estado });
      renderTabela({ reservations: [r] });
      const linha = linhas()[0];
      expect(semBotao(linha, 'Devolucao')).not.toBeInTheDocument();
      fireEvent.click(botao(linha, 'Levantamento'));
      expect(props.onLevantamento).toHaveBeenCalledTimes(1);
      expect(props.onLevantamento).toHaveBeenCalledWith(r);
      expect(props.onDevolucao).not.toHaveBeenCalled();
    });

    it('um aluguer checked_in mostra Devolucao (e nao Levantamento) e chama onDevolucao com a reserva', () => {
      const r = reserva({ status: 'checked_in' });
      renderTabela({ reservations: [r] });
      const linha = linhas()[0];
      expect(semBotao(linha, 'Levantamento')).not.toBeInTheDocument();
      fireEvent.click(botao(linha, 'Devolucao'));
      expect(props.onDevolucao).toHaveBeenCalledTimes(1);
      expect(props.onDevolucao).toHaveBeenCalledWith(r);
      expect(props.onLevantamento).not.toHaveBeenCalled();
    });

    it.each(['checked_out', 'cancelled', 'no_show'])('estado final %s: sem Levantamento nem Devolucao, mas com Ver, Editar e Eliminar', (estado) => {
      renderTabela({ reservations: [reserva({ status: estado })] });
      const linha = linhas()[0];
      expect(semBotao(linha, 'Levantamento')).not.toBeInTheDocument();
      expect(semBotao(linha, 'Devolucao')).not.toBeInTheDocument();
      for (const nome of ['Ver', 'Editar', 'Eliminar']) {
        expect(botao(linha, nome)).toBeInTheDocument();
      }
    });

    it('cada linha chama o handler com a sua propria reserva', () => {
      const r1 = reserva({ id: 'aaaaaaaa-0001', status: 'confirmed' });
      const r2 = reserva({ id: 'bbbbbbbb-0002', status: 'checked_in' });
      renderTabela({ reservations: [r1, r2] });
      const [l1, l2] = linhas();
      fireEvent.click(botao(l2, 'Devolucao'));
      fireEvent.click(botao(l1, 'Levantamento'));
      expect(props.onDevolucao).toHaveBeenCalledWith(r2);
      expect(props.onLevantamento).toHaveBeenCalledWith(r1);
    });
  });

  describe('ordenacao com o componente Table', () => {
    const TRES = [
      reserva({ id: 'cccccccc-0003', check_in: DEPOIS, check_out: MAIS_TRES, total_price: 20 }),
      reserva({ id: 'aaaaaaaa-0001', check_in: ONTEM,  check_out: HOJE,      total_price: 300 }),
      reserva({ id: 'bbbbbbbb-0002', check_in: HOJE,   check_out: AMANHA,    total_price: 100 }),
    ];

    function cabecalho(nome) {
      return within(tabela()).getByRole('columnheader', { name: nome });
    }
    function clicar(nome) {
      fireEvent.click(within(cabecalho(nome)).getByRole('button'));
    }

    it('so Levantamento, Devolucao e Total sao ordenaveis (aria-sort a none) e as outras colunas nao', () => {
      renderTabela({ reservations: TRES });
      for (const nome of ['Levantamento', 'Devolucao', 'Total']) {
        expect(cabecalho(nome)).toHaveAttribute('aria-sort', 'none');
      }
      for (const nome of ['Ref', 'Viatura', 'Cliente', 'Estado']) {
        expect(cabecalho(nome)).not.toHaveAttribute('aria-sort');
      }
    });

    it('clicar em Levantamento ordena ascendente, depois descendente, depois repoe a ordem original', () => {
      renderTabela({ reservations: TRES });
      expect(refs()).toEqual(['cccccccc', 'aaaaaaaa', 'bbbbbbbb']);

      clicar('Levantamento');
      expect(cabecalho('Levantamento')).toHaveAttribute('aria-sort', 'ascending');
      expect(refs()).toEqual(['aaaaaaaa', 'bbbbbbbb', 'cccccccc']);

      clicar('Levantamento');
      expect(cabecalho('Levantamento')).toHaveAttribute('aria-sort', 'descending');
      expect(refs()).toEqual(['cccccccc', 'bbbbbbbb', 'aaaaaaaa']);

      clicar('Levantamento');
      expect(cabecalho('Levantamento')).toHaveAttribute('aria-sort', 'none');
      expect(refs()).toEqual(['cccccccc', 'aaaaaaaa', 'bbbbbbbb']);
    });

    it('clicar em Devolucao ordena por data de devolucao e repoe a ordem original na terceira vez', () => {
      renderTabela({ reservations: TRES });
      clicar('Devolucao');
      expect(refs()).toEqual(['aaaaaaaa', 'bbbbbbbb', 'cccccccc']); // HOJE, AMANHA, MAIS_TRES
      clicar('Devolucao');
      expect(refs()).toEqual(['cccccccc', 'bbbbbbbb', 'aaaaaaaa']);
      clicar('Devolucao');
      expect(refs()).toEqual(['cccccccc', 'aaaaaaaa', 'bbbbbbbb']);
    });

    it('Total ordena numericamente (20, 100, 300) e a terceira volta repoe a ordem original', () => {
      renderTabela({ reservations: TRES });
      clicar('Total');
      expect(refs()).toEqual(['cccccccc', 'bbbbbbbb', 'aaaaaaaa']); // 20, 100, 300
      clicar('Total');
      expect(refs()).toEqual(['aaaaaaaa', 'bbbbbbbb', 'cccccccc']); // 300, 100, 20
      clicar('Total');
      expect(refs()).toEqual(['cccccccc', 'aaaaaaaa', 'bbbbbbbb']);
    });

    it('reservas com campos em falta ordenam sem rebentar', () => {
      renderTabela({
        reservations: [
          reserva({ id: 'aaaaaaaa-0001', check_in: undefined, check_out: undefined, total_price: undefined, notes_internal: undefined }),
          reserva({ id: 'bbbbbbbb-0002', check_in: HOJE, check_out: AMANHA, total_price: 50 }),
        ],
      });
      for (const nome of ['Levantamento', 'Devolucao', 'Total']) {
        clicar(nome);
        expect(refs()).toHaveLength(2);
        clicar(nome);
        clicar(nome);
      }
    });

    it('as accoes continuam ligadas a reserva certa depois de ordenar', () => {
      renderTabela({ reservations: TRES });
      clicar('Levantamento');
      /* a primeira linha passa a ser a mais antiga (aaaaaaaa) */
      fireEvent.click(botao(linhas()[0], 'Editar'));
      expect(props.onEdit).toHaveBeenCalledWith(TRES[1]);
      fireEvent.click(botao(linhas()[0], 'Levantamento'));
      expect(props.onLevantamento).toHaveBeenCalledWith(TRES[1]);
    });
  });
});
