import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RestaurantTable from '../pages/reservations/RestaurantTable';
import useUiStore from '../store/uiStore';
import { changeStatus } from '../services/reservationsService';

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
const HOJE = dataLocal(0);
const AMANHA = dataLocal(1);

function mesa(over) {
  return { id: 'u1', name: 'M3', unit_type: 'table', description: '{"number":3}', ...over };
}

function reserva(over) {
  return {
    id: 'aaaaaaaa-0001', unit_id: 'u1', status: 'confirmed', guests: 2,
    check_in: HOJE, start_time: '20:30:00', customer_name: 'Cliente Alfa',
    notes_guest: '{}',
    ...over,
  };
}

const CABECALHOS = ['Ref', 'Mesa', 'Turno', 'Pax', 'Cliente', 'Ocasiao', 'Estado', ''];

describe('RestaurantTable (tabela de reservas de restaurante)', () => {
  let errSpy;
  let warnSpy;
  let esperaErros;
  let props;

  beforeEach(() => {
    useUiStore.setState({ lang: 'pt' });
    changeStatus.mockReset().mockImplementation(async (id, status) => ({ id, status }));
    props = {
      reservations: [reserva()],
      units: [mesa()],
      onEdit: vi.fn(),
      onDelete: vi.fn(),
      onDetails: vi.fn(),
      onUpdate: vi.fn(),
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
        <RestaurantTable {...props} {...over} />
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

    it('cada celula mostra os valores de hoje', () => {
      renderTabela({
        reservations: [reserva({
          id: 'abcdef12-3456', guests: 4, check_in: AMANHA, start_time: '13:00:00', status: 'pending',
          notes_guest: JSON.stringify({ ocasiao: 'aniversario' }),
        })],
      });
      expect(celulas(linhas()[0]).map(c => c.textContent)).toEqual([
        'abcdef12',
        'Mesa 3',
        '13:00',
        '4',
        `Cliente Alfa${formatada(AMANHA)}`,
        'Aniversario',
        'Pendente',
        'Confirmar',
      ]);
    });

    it('mesa: sem numero usa o nome da unidade e sem unidade mostra o travessao', () => {
      renderTabela({
        reservations: [
          reserva({ id: 'aaaaaaaa-0001', unit_id: 'u1' }),
          reserva({ id: 'bbbbbbbb-0002', unit_id: 'u2' }),
          reserva({ id: 'cccccccc-0003', unit_id: 'u3' }),
          reserva({ id: 'dddddddd-0004', unit_id: 'inexistente' }),
        ],
        units: [
          mesa({ id: 'u1', description: '{"number":7}' }),
          mesa({ id: 'u2', name: 'Esplanada', description: '{}' }),
          mesa({ id: 'u3', name: 'Balcao', description: 'isto nao e json' }),
        ],
      });
      expect(linhas().map(l => celulas(l)[1].textContent)).toEqual(['Mesa 7', 'Esplanada', 'Balcao', '—']);
    });

    it('lista de espera mostra a etiqueta junto a mesa', () => {
      renderTabela({
        reservations: [
          reserva({ id: 'aaaaaaaa-0001', notes_guest: JSON.stringify({ lista_espera: true }) }),
          reserva({ id: 'bbbbbbbb-0002' }),
        ],
      });
      const [l1, l2] = linhas();
      expect(celulas(l1)[1]).toHaveTextContent('Mesa 3Lista espera');
      expect(celulas(l2)[1].textContent).toBe('Mesa 3');
    });

    it('turno: a hora de inicio tem prioridade; sem hora usa o nome do turno; sem nenhum mostra o travessao', () => {
      renderTabela({
        reservations: [
          reserva({ id: 'aaaaaaaa-0001', start_time: '19:45:00', notes_guest: JSON.stringify({ turno: 'almoco' }) }),
          reserva({ id: 'bbbbbbbb-0002', start_time: undefined, notes_guest: JSON.stringify({ turno: 'almoco' }) }),
          reserva({ id: 'cccccccc-0003', start_time: undefined, notes_guest: JSON.stringify({ turno: 'jantar' }) }),
          reserva({ id: 'dddddddd-0004', start_time: undefined, notes_guest: JSON.stringify({ turno: 'brunch' }) }),
          reserva({ id: 'eeeeeeee-0005', start_time: undefined, notes_guest: '{}' }),
        ],
      });
      expect(linhas().map(l => celulas(l)[2].textContent)).toEqual(['19:45', 'Almoco', 'Jantar', 'brunch', '—']);
    });

    it('ocasiao: usa o nome conhecido, o valor em bruto se for desconhecido e o travessao se faltar', () => {
      renderTabela({
        reservations: [
          reserva({ id: 'aaaaaaaa-0001', notes_guest: JSON.stringify({ ocasiao: 'lua_de_mel' }) }),
          reserva({ id: 'bbbbbbbb-0002', notes_guest: JSON.stringify({ ocasiao: 'reuniao' }) }),
          reserva({ id: 'cccccccc-0003', notes_guest: '{}' }),
        ],
      });
      expect(linhas().map(l => celulas(l)[5].textContent)).toEqual(['Lua-de-mel', 'reuniao', '—']);
    });

    it('campos em falta (cliente, data, notas invalidas) mostram o travessao e nao rebentam', () => {
      renderTabela({
        reservations: [reserva({
          customer_name: undefined, check_in: undefined, start_time: undefined, guests: undefined,
          notes_guest: 'isto nao e json',
        })],
      });
      const c = celulas(linhas()[0]);
      expect(c[2].textContent).toBe('—');
      expect(c[3].textContent).toBe('');
      expect(c[4].textContent).toBe('——');
      expect(c[5].textContent).toBe('—');
    });

    it('sem notas de convidado (notes_guest ausente) nao rebenta', () => {
      renderTabela({ reservations: [reserva({ notes_guest: undefined, start_time: undefined })] });
      expect(celulas(linhas()[0])[2].textContent).toBe('—');
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

    it('Turno / pedidos especiais chama onDetails com a reserva da linha', () => {
      const r1 = reserva({ id: 'aaaaaaaa-0001' });
      const r2 = reserva({ id: 'bbbbbbbb-0002' });
      renderTabela({ reservations: [r1, r2] });
      fireEvent.click(botao(linhas()[1], 'Turno / pedidos especiais'));
      expect(props.onDetails).toHaveBeenCalledTimes(1);
      expect(props.onDetails).toHaveBeenCalledWith(r2);
    });

    it.each([
      ['pending', 'Confirmar', 'confirmed'],
      ['confirmed', 'Sentar', 'checked_in'],
      ['checked_in', 'Liberar mesa', 'checked_out'],
    ])('avancar estado de %s: o botao %s chama changeStatus com %s e depois onUpdate', async (estado, rotulo, proximo) => {
      renderTabela({ reservations: [reserva({ id: 'aaaaaaaa-0001', status: estado })] });
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

    /* visibilidade do botao de avancar por estado; as restantes accoes estao sempre presentes */
    it.each([
      ['pending',     'Confirmar'],
      ['confirmed',   'Sentar'],
      ['checked_in',  'Liberar mesa'],
      ['checked_out', null],
      ['cancelled',   null],
      ['no_show',     null],
    ])('estado %s: botao de avancar=%s', (estado, rotuloAvancar) => {
      renderTabela({ reservations: [reserva({ status: estado })] });
      const linha = linhas()[0];
      for (const rotulo of ['Confirmar', 'Sentar', 'Liberar mesa']) {
        if (rotulo === rotuloAvancar) expect(semBotao(linha, rotulo)).toBeInTheDocument();
        else expect(semBotao(linha, rotulo)).not.toBeInTheDocument();
      }
      for (const nome of ['Turno / pedidos especiais', 'Ver', 'Editar', 'Eliminar']) {
        expect(botao(linha, nome)).toBeInTheDocument();
      }
    });
  });

  describe('ordenacao com o componente Table', () => {
    const TRES = [
      reserva({ id: 'cccccccc-0003', guests: 10, check_in: AMANHA }),
      reserva({ id: 'aaaaaaaa-0001', guests: 2,  check_in: HOJE }),
      reserva({ id: 'bbbbbbbb-0002', guests: 9,  check_in: HOJE }),
    ];

    function cabecalho(nome) {
      return within(tabela()).getByRole('columnheader', { name: nome });
    }
    function clicar(nome) {
      fireEvent.click(within(cabecalho(nome)).getByRole('button'));
    }

    it('so Pax e ordenavel (aria-sort a none) e as outras colunas nao', () => {
      renderTabela({ reservations: TRES });
      expect(cabecalho('Pax')).toHaveAttribute('aria-sort', 'none');
      for (const nome of ['Ref', 'Mesa', 'Turno', 'Cliente', 'Ocasiao', 'Estado']) {
        expect(cabecalho(nome)).not.toHaveAttribute('aria-sort');
      }
    });

    it('Pax ordena numericamente (2, 9, 10), depois descendente, depois repoe a ordem original', () => {
      renderTabela({ reservations: TRES });
      expect(refs()).toEqual(['cccccccc', 'aaaaaaaa', 'bbbbbbbb']);

      clicar('Pax');
      expect(cabecalho('Pax')).toHaveAttribute('aria-sort', 'ascending');
      expect(refs()).toEqual(['aaaaaaaa', 'bbbbbbbb', 'cccccccc']);

      clicar('Pax');
      expect(cabecalho('Pax')).toHaveAttribute('aria-sort', 'descending');
      expect(refs()).toEqual(['cccccccc', 'bbbbbbbb', 'aaaaaaaa']);

      clicar('Pax');
      expect(cabecalho('Pax')).toHaveAttribute('aria-sort', 'none');
      expect(refs()).toEqual(['cccccccc', 'aaaaaaaa', 'bbbbbbbb']);
    });

    it('reservas com campos em falta ordenam sem rebentar', () => {
      renderTabela({
        reservations: [
          reserva({ id: 'aaaaaaaa-0001', guests: undefined, notes_guest: undefined, start_time: undefined }),
          reserva({ id: 'bbbbbbbb-0002', guests: 3 }),
        ],
      });
      clicar('Pax');
      expect(refs()).toHaveLength(2);
      clicar('Pax');
      clicar('Pax');
    });

    it('as accoes continuam ligadas a reserva certa depois de ordenar', () => {
      renderTabela({ reservations: TRES });
      clicar('Pax');
      /* a primeira linha passa a ser a de menos pessoas (aaaaaaaa) */
      fireEvent.click(botao(linhas()[0], 'Editar'));
      expect(props.onEdit).toHaveBeenCalledWith(TRES[1]);
      fireEvent.click(botao(linhas()[0], 'Turno / pedidos especiais'));
      expect(props.onDetails).toHaveBeenCalledWith(TRES[1]);
    });
  });
});
