import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import RescheduleModal from '../pages/reservations/RescheduleModal';
import NoShowModal from '../pages/reservations/NoShowModal';
import LevantamentoModal from '../pages/reservations/LevantamentoModal';
import DevolucaoModal from '../pages/reservations/DevolucaoModal';
import RestaurantCreateModal from '../pages/reservations/RestaurantCreateModal';
import ManifestoModal from '../pages/reservations/ManifestoModal';
import { updateReservation, changeStatus } from '../services/reservationsService';

/* Sem rede: os modais so importam o servico de reservas */
vi.mock('../services/reservationsService', () => ({
  updateReservation: vi.fn(),
  changeStatus: vi.fn(),
}));

/* Datas locais relativas a hoje, nunca fixas nem em UTC */
function dataLocal(dias = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toLocaleDateString('en-CA');
}
const HOJE = dataLocal(0);
const AMANHA = dataLocal(1);
const DEPOIS = dataLocal(2);

/* O campo que esta por baixo de uma etiqueta (a etiqueta e o campo partilham o mesmo bloco) */
function campo(texto) {
  const etiqueta = screen.getByText(texto);
  return etiqueta.parentElement.querySelector('input, select, textarea');
}

function botao(nome) {
  return screen.getByRole('button', { name: nome });
}

/* Cada campo do desenho do sistema traz a etiqueta logo por cima, no mesmo bloco.
   (O componente de campo nao liga a etiqueta por htmlFor, por isso getByLabelText nao serve.) */
function temEtiquetaPorCima(textos) {
  for (const texto of textos) {
    const etiqueta = screen.getByText(texto);
    expect(etiqueta.tagName).toBe('LABEL');
    expect(etiqueta.nextElementSibling).toBe(campo(texto));
  }
}

describe('Modais de Reservas', () => {
  let errSpy;
  let warnSpy;

  beforeEach(() => {
    updateReservation.mockReset().mockResolvedValue({});
    changeStatus.mockReset().mockResolvedValue({});
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

  describe('RescheduleModal', () => {
    function renderModal(over = {}) {
      const props = {
        reservation: { id: 'r1', customer_name: 'Cliente Alfa', check_in: HOJE },
        open: true,
        onClose: vi.fn(),
        onDone: vi.fn(),
        ...over,
      };
      render(<RescheduleModal {...props} />);
      return props;
    }

    it('mostra o titulo, o cliente e a data actual no campo', () => {
      renderModal();
      expect(screen.getByRole('heading', { name: 'Reagendar reserva' })).toBeInTheDocument();
      expect(screen.getByText('Cliente Alfa')).toBeInTheDocument();
      expect(campo('Nova data')).toHaveValue(HOJE);
    });

    it('guarda a nova data com o objecto exacto e avisa quem chamou', async () => {
      const props = renderModal();
      fireEvent.change(campo('Nova data'), { target: { value: AMANHA } });
      fireEvent.click(botao('Reagendar'));
      await waitFor(() => expect(props.onDone).toHaveBeenCalledTimes(1));
      expect(updateReservation).toHaveBeenCalledTimes(1);
      expect(updateReservation).toHaveBeenCalledWith('r1', { check_in: AMANHA });
      expect(props.onDone).toHaveBeenCalledWith(AMANHA);
    });

    it('sem data nao chama o servico', () => {
      const props = renderModal();
      fireEvent.change(campo('Nova data'), { target: { value: '' } });
      fireEvent.click(botao('Reagendar'));
      expect(updateReservation).not.toHaveBeenCalled();
      expect(props.onDone).not.toHaveBeenCalled();
    });

    it('mostra o erro do servidor e nao conclui', async () => {
      updateReservation.mockRejectedValue({ response: { data: { error: 'Data indisponivel' } } });
      const props = renderModal();
      fireEvent.change(campo('Nova data'), { target: { value: DEPOIS } });
      fireEvent.click(botao('Reagendar'));
      expect(await screen.findByText('Data indisponivel')).toBeInTheDocument();
      expect(props.onDone).not.toHaveBeenCalled();
    });

    it('o campo tem a etiqueta por cima', () => {
      renderModal();
      temEtiquetaPorCima(['Nova data']);
    });

    it('Cancelar chama onClose', () => {
      const props = renderModal();
      fireEvent.click(botao('Cancelar'));
      expect(props.onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('NoShowModal', () => {
    function renderModal(over = {}) {
      const props = {
        reservation: { id: 'r1', customer_name: 'Cliente Alfa' },
        open: true,
        onClose: vi.fn(),
        onDone: vi.fn(),
        ...over,
      };
      render(<NoShowModal {...props} />);
      return props;
    }

    it('mostra o titulo e o cliente', () => {
      renderModal();
      expect(screen.getByRole('heading', { name: 'Registar No-Show' })).toBeInTheDocument();
      expect(screen.getByText('Cliente Alfa')).toBeInTheDocument();
    });

    it('com nota: muda o estado para no_show e guarda a nota tal como escrita', async () => {
      const props = renderModal();
      fireEvent.change(campo('Nota interna (opcional)'), { target: { value: ' Nao apareceu ' } });
      fireEvent.click(botao('Confirmar No-Show'));
      await waitFor(() => expect(props.onDone).toHaveBeenCalledTimes(1));
      expect(changeStatus).toHaveBeenCalledTimes(1);
      expect(changeStatus).toHaveBeenCalledWith('r1', 'no_show');
      expect(updateReservation).toHaveBeenCalledTimes(1);
      expect(updateReservation).toHaveBeenCalledWith('r1', { notes_internal: ' Nao apareceu ' });
    });

    it('sem nota (ou so espacos) so muda o estado', async () => {
      const props = renderModal();
      fireEvent.change(campo('Nota interna (opcional)'), { target: { value: '   ' } });
      fireEvent.click(botao('Confirmar No-Show'));
      await waitFor(() => expect(props.onDone).toHaveBeenCalledTimes(1));
      expect(changeStatus).toHaveBeenCalledWith('r1', 'no_show');
      expect(updateReservation).not.toHaveBeenCalled();
    });

    it('o campo tem a etiqueta por cima', () => {
      renderModal();
      temEtiquetaPorCima(['Nota interna (opcional)']);
    });

    it('Cancelar chama onClose e nao toca no servico', () => {
      const props = renderModal();
      fireEvent.click(botao('Cancelar'));
      expect(props.onClose).toHaveBeenCalledTimes(1);
      expect(changeStatus).not.toHaveBeenCalled();
    });
  });

  describe('LevantamentoModal', () => {
    const UNITS = [{ id: 'u1', name: 'Carro 1', description: '{"brand":"Fiat","model":"Panda","plate":"S-01-AB"}' }];

    function renderModal(reservation, over = {}) {
      const props = {
        reservation: {
          id: 'r1', unit_id: 'u1', customer_name: 'Cliente Alfa', check_in: HOJE, check_out: AMANHA,
          notes_internal: '{"foo":"bar"}',
          ...reservation,
        },
        units: UNITS,
        open: true,
        onClose: vi.fn(),
        onDone: vi.fn(),
        ...over,
      };
      render(<LevantamentoModal {...props} />);
      return props;
    }

    it('mostra viatura, cliente e os valores por omissao', () => {
      renderModal();
      expect(screen.getByRole('heading', { name: 'Levantamento de viatura' })).toBeInTheDocument();
      expect(screen.getByText('Fiat Panda')).toBeInTheDocument();
      expect(screen.getByText('S-01-AB')).toBeInTheDocument();
      expect(screen.getByText('Cliente Alfa')).toBeInTheDocument();
      expect(campo('Km na saida')).toHaveValue(null);
      expect(campo('Danos existentes (registo)')).toHaveValue('');
      expect(campo('Caucao (€)')).toHaveValue(null);
      expect(screen.getByRole('checkbox')).not.toBeChecked();
    });

    it('confirma com o objecto exacto: combustivel, km numero, caucao em texto e paga booleano', async () => {
      const props = renderModal();
      fireEvent.click(botao('1/2'));
      fireEvent.change(campo('Km na saida'), { target: { value: '12345' } });
      fireEvent.change(campo('Danos existentes (registo)'), { target: { value: 'Risco no para-choques' } });
      fireEvent.change(campo('Caucao (€)'), { target: { value: '150.5' } });
      fireEvent.click(screen.getByRole('checkbox'));
      fireEvent.click(botao('Confirmar levantamento'));
      await waitFor(() => expect(props.onDone).toHaveBeenCalledTimes(1));
      expect(updateReservation).toHaveBeenCalledTimes(1);
      expect(updateReservation).toHaveBeenCalledWith('r1', {
        notes_internal: JSON.stringify({
          foo: 'bar',
          rentacar: {
            fuel_out: 2, km_out: 12345, damages_out: 'Risco no para-choques', caucao: '150.5', caucao_paid: true,
          },
        }),
      });
      expect(changeStatus).toHaveBeenCalledTimes(1);
      expect(changeStatus).toHaveBeenCalledWith('r1', 'checked_in');
    });

    it('sem preencher nada: combustivel cheio, km nulo, textos vazios, paga falso', async () => {
      const props = renderModal();
      fireEvent.click(botao('Confirmar levantamento'));
      await waitFor(() => expect(props.onDone).toHaveBeenCalledTimes(1));
      expect(updateReservation).toHaveBeenCalledWith('r1', {
        notes_internal: JSON.stringify({
          foo: 'bar',
          rentacar: {
            fuel_out: 4, km_out: null, damages_out: '', caucao: '', caucao_paid: false,
          },
        }),
      });
      expect(changeStatus).toHaveBeenCalledWith('r1', 'checked_in');
    });

    it('parte dos dados ja guardados e preserva os campos que nao edita', async () => {
      const props = renderModal({
        notes_internal: JSON.stringify({ rentacar: { fuel_out: 1, km_out: 500, caucao: 80, caucao_paid: true, outro: 'x' } }),
      });
      expect(campo('Km na saida')).toHaveValue(500);
      expect(campo('Caucao (€)')).toHaveValue(80);
      expect(screen.getByRole('checkbox')).toBeChecked();
      fireEvent.change(campo('Km na saida'), { target: { value: '650' } });
      fireEvent.click(botao('Confirmar levantamento'));
      await waitFor(() => expect(props.onDone).toHaveBeenCalledTimes(1));
      expect(updateReservation).toHaveBeenCalledWith('r1', {
        notes_internal: JSON.stringify({
          rentacar: {
            fuel_out: 1, km_out: 650, caucao: '80', caucao_paid: true, outro: 'x', damages_out: '',
          },
        }),
      });
    });

    it('os campos tem a etiqueta por cima', () => {
      renderModal();
      temEtiquetaPorCima(['Km na saida', 'Danos existentes (registo)', 'Caucao (€)']);
    });

    it('Cancelar chama onClose e nao toca no servico', () => {
      const props = renderModal();
      fireEvent.click(botao('Cancelar'));
      expect(props.onClose).toHaveBeenCalledTimes(1);
      expect(updateReservation).not.toHaveBeenCalled();
    });
  });

  describe('DevolucaoModal', () => {
    const UNITS = [{ id: 'u1', name: 'Carro 1', description: '{"brand":"Fiat","model":"Panda","plate":"S-01-AB"}' }];

    function renderModal(reservation, over = {}) {
      const props = {
        reservation: {
          id: 'r1', unit_id: 'u1', customer_name: 'Cliente Alfa', check_in: HOJE, check_out: AMANHA,
          notes_internal: JSON.stringify({ foo: 'bar', rentacar: { km_out: 12000, fuel_out: 4 } }),
          ...reservation,
        },
        units: UNITS,
        open: true,
        onClose: vi.fn(),
        onDone: vi.fn(),
        ...over,
      };
      render(<DevolucaoModal {...props} />);
      return props;
    }

    it('mostra viatura, cliente, km de saida e esconde o valor retido por omissao', () => {
      renderModal();
      expect(screen.getByRole('heading', { name: 'Devolucao de viatura' })).toBeInTheDocument();
      expect(screen.getByText('Fiat Panda')).toBeInTheDocument();
      expect(screen.getByText('Cliente Alfa')).toBeInTheDocument();
      expect(screen.getByText(/^Saida: .*km$/)).toBeInTheDocument();
      expect(campo('Km na chegada')).toHaveValue(null);
      expect(screen.queryByText('Valor retido (€)')).not.toBeInTheDocument();
    });

    it('mostra os quilometros percorridos', () => {
      renderModal();
      fireEvent.change(campo('Km na chegada'), { target: { value: '12500' } });
      expect(screen.getByText(/km percorridos/)).toBeInTheDocument();
    });

    it('caucao devolvida: confirma com o objecto exacto', async () => {
      const props = renderModal();
      fireEvent.click(botao('1/4'));
      fireEvent.change(campo('Km na chegada'), { target: { value: '12500' } });
      fireEvent.change(campo('Danos na devolucao'), { target: { value: 'Sem danos' } });
      fireEvent.click(botao('Confirmar devolucao'));
      await waitFor(() => expect(props.onDone).toHaveBeenCalledTimes(1));
      expect(updateReservation).toHaveBeenCalledTimes(1);
      expect(updateReservation).toHaveBeenCalledWith('r1', {
        notes_internal: JSON.stringify({
          foo: 'bar',
          rentacar: {
            km_out: 12000, fuel_out: 4,
            fuel_in: 1, km_in: 12500, damages_in: 'Sem danos', caucao_retained: 0, caucao_status: 'returned',
          },
        }),
      });
      expect(changeStatus).toHaveBeenCalledTimes(1);
      expect(changeStatus).toHaveBeenCalledWith('r1', 'checked_out');
    });

    it('caucao retida (parcial): o valor retido passa a numero', async () => {
      const props = renderModal();
      fireEvent.click(botao('Retida (parcial)'));
      fireEvent.change(campo('Valor retido (€)'), { target: { value: '40.5' } });
      fireEvent.change(campo('Km na chegada'), { target: { value: '12100' } });
      fireEvent.click(botao('Confirmar devolucao'));
      await waitFor(() => expect(props.onDone).toHaveBeenCalledTimes(1));
      expect(updateReservation).toHaveBeenCalledWith('r1', {
        notes_internal: JSON.stringify({
          foo: 'bar',
          rentacar: {
            km_out: 12000, fuel_out: 4,
            fuel_in: 4, km_in: 12100, damages_in: '', caucao_retained: 40.5, caucao_status: 'retained',
          },
        }),
      });
      expect(changeStatus).toHaveBeenCalledWith('r1', 'checked_out');
    });

    it('caucao retida (total) sem valor: km nulo e retido zero', async () => {
      const props = renderModal();
      fireEvent.click(botao('Retida (total)'));
      fireEvent.click(botao('Confirmar devolucao'));
      await waitFor(() => expect(props.onDone).toHaveBeenCalledTimes(1));
      expect(updateReservation).toHaveBeenCalledWith('r1', {
        notes_internal: JSON.stringify({
          foo: 'bar',
          rentacar: {
            km_out: 12000, fuel_out: 4,
            fuel_in: 4, km_in: null, damages_in: '', caucao_retained: 0, caucao_status: 'full',
          },
        }),
      });
    });

    it('os campos tem a etiqueta por cima', () => {
      renderModal();
      temEtiquetaPorCima(['Km na chegada', 'Danos na devolucao']);
    });

    it('o valor retido tambem tem a etiqueta por cima', () => {
      renderModal();
      fireEvent.click(botao('Retida (parcial)'));
      temEtiquetaPorCima(['Valor retido (€)']);
    });

    it('Cancelar chama onClose e nao toca no servico', () => {
      const props = renderModal();
      fireEvent.click(botao('Cancelar'));
      expect(props.onClose).toHaveBeenCalledTimes(1);
      expect(updateReservation).not.toHaveBeenCalled();
    });
  });

  describe('RestaurantCreateModal', () => {
    const UNITS = [{ id: 'm1', name: 'Mesa 4' }];

    function renderModal(reservation, over = {}) {
      const props = {
        reservation: {
          id: 'r1', unit_id: 'm1', customer_name: 'Cliente Alfa', guests: 4,
          notes_guest: '{"phone":"+238 999"}',
          ...reservation,
        },
        units: UNITS,
        open: true,
        onClose: vi.fn(),
        onDone: vi.fn(),
        ...over,
      };
      render(<RestaurantCreateModal {...props} />);
      return props;
    }

    it('mostra o resumo da reserva e os valores por omissao', () => {
      renderModal();
      expect(screen.getByRole('heading', { name: 'Detalhes da reserva' })).toBeInTheDocument();
      expect(screen.getByText('Cliente Alfa')).toBeInTheDocument();
      expect(screen.getByText(/4 pessoas/)).toBeInTheDocument();
      expect(screen.getByText(/Mesa 4/)).toBeInTheDocument();
      expect(campo('Ocasiao especial')).toHaveValue('');
      expect(campo('Pedidos especiais')).toHaveValue('');
      expect(screen.getByRole('checkbox')).not.toBeChecked();
    });

    it('guarda turno, ocasiao, pedidos e lista de espera com o objecto exacto', async () => {
      const props = renderModal();
      fireEvent.click(botao(/Almoco/));
      fireEvent.change(campo('Ocasiao especial'), { target: { value: 'lua_de_mel' } });
      fireEvent.change(campo('Pedidos especiais'), { target: { value: 'Sem gluten' } });
      fireEvent.click(screen.getByRole('checkbox'));
      fireEvent.click(botao('Guardar detalhes'));
      await waitFor(() => expect(props.onDone).toHaveBeenCalledTimes(1));
      expect(updateReservation).toHaveBeenCalledTimes(1);
      expect(updateReservation).toHaveBeenCalledWith('r1', {
        notes_guest: JSON.stringify({
          phone: '+238 999',
          turno: 'almoco', ocasiao: 'lua_de_mel', pedidos_especiais: 'Sem gluten', lista_espera: true,
        }),
      });
    });

    it('sem mexer em nada guarda jantar, sem ocasiao, sem pedidos e fora da lista de espera', async () => {
      const props = renderModal();
      fireEvent.click(botao('Guardar detalhes'));
      await waitFor(() => expect(props.onDone).toHaveBeenCalledTimes(1));
      expect(updateReservation).toHaveBeenCalledWith('r1', {
        notes_guest: JSON.stringify({
          phone: '+238 999',
          turno: 'jantar', ocasiao: '', pedidos_especiais: '', lista_espera: false,
        }),
      });
    });

    it('a ocasiao oferece as cinco opcoes de hoje', () => {
      renderModal();
      const opcoes = within(campo('Ocasiao especial')).getAllByRole('option').map(o => [o.value, o.textContent]);
      expect(opcoes).toEqual([
        ['', 'Nenhuma'],
        ['aniversario', 'Aniversario'],
        ['lua_de_mel', 'Lua-de-mel'],
        ['negocios', 'Negocios'],
        ['outro', 'Outro'],
      ]);
    });

    it('os campos tem a etiqueta por cima', () => {
      renderModal();
      temEtiquetaPorCima(['Ocasiao especial', 'Pedidos especiais']);
    });

    it('Cancelar chama onClose e nao toca no servico', () => {
      const props = renderModal();
      fireEvent.click(botao('Cancelar'));
      expect(props.onClose).toHaveBeenCalledTimes(1);
      expect(updateReservation).not.toHaveBeenCalled();
    });
  });

  describe('ManifestoModal (so leitura)', () => {
    const UNITS = [
      { id: 't1', name: 'Tour Norte' },
      { id: 't2', name: 'Tour Sul' },
    ];
    const RESERVAS = [
      { id: 'a', unit_id: 't1', status: 'confirmed', check_in: HOJE, guests: 2, customer_name: 'Zeca Zulu', total_price: 100 },
      { id: 'b', unit_id: 't1', status: 'pending', check_in: AMANHA, guests: 3, customer_name: 'Ana Alfa', total_price: 60 },
      { id: 'c', unit_id: 't2', status: 'checked_in', check_in: HOJE, guests: 1, customer_name: 'Rui Rosa', total_price: 40 },
      { id: 'd', unit_id: 't1', status: 'cancelled', check_in: HOJE, guests: 5, customer_name: 'Cancelado Cinza', total_price: 500 },
    ];

    function renderModal(over = {}) {
      const props = { open: true, onClose: vi.fn(), reservations: RESERVAS, units: UNITS, ...over };
      render(<ManifestoModal {...props} />);
      return props;
    }

    function nomes() {
      const tabela = screen.getByRole('table');
      return within(tabela).getAllByRole('row').slice(1, -1).map(l => within(l).getAllByRole('cell')[1].textContent);
    }

    it('os campos tem a etiqueta por cima', () => {
      renderModal();
      temEtiquetaPorCima(['Tour', 'Data']);
    });

    it('sem filtros pede para seleccionar um tour e/ou uma data', () => {
      renderModal();
      expect(screen.getByRole('heading', { name: 'Manifesto de Participantes' })).toBeInTheDocument();
      expect(screen.getByText('Seleccione um tour e/ou uma data para ver o manifesto.')).toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('o seletor de tour oferece todos os tours e as unidades', () => {
      renderModal();
      const opcoes = within(campo('Tour')).getAllByRole('option').map(o => [o.value, o.textContent]);
      expect(opcoes).toEqual([['', 'Todos os tours'], ['t1', 'Tour Norte'], ['t2', 'Tour Sul']]);
    });

    it('filtrar por tour lista so as reservas activas desse tour, por ordem de nome', () => {
      renderModal();
      fireEvent.change(campo('Tour'), { target: { value: 't1' } });
      expect(nomes()).toEqual(['Ana Alfa', 'Zeca Zulu']);
      expect(screen.getByText('2 reservas · 5 participantes')).toBeInTheDocument();
    });

    it('filtrar por data lista as reservas activas desse dia', () => {
      renderModal();
      fireEvent.change(campo('Data'), { target: { value: HOJE } });
      expect(nomes()).toEqual(['Rui Rosa', 'Zeca Zulu']);
      expect(screen.getByText('2 reservas · 3 participantes')).toBeInTheDocument();
    });

    it('tour e data juntos cruzam os dois filtros', () => {
      renderModal();
      fireEvent.change(campo('Tour'), { target: { value: 't1' } });
      fireEvent.change(campo('Data'), { target: { value: AMANHA } });
      expect(nomes()).toEqual(['Ana Alfa']);
    });

    it('sem resultados mostra a mensagem de vazio', () => {
      renderModal();
      fireEvent.change(campo('Tour'), { target: { value: 't2' } });
      fireEvent.change(campo('Data'), { target: { value: AMANHA } });
      expect(screen.getByText('Nenhum participante encontrado.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Exportar PDF' })).not.toBeInTheDocument();
    });

    it('Exportar PDF imprime a pagina', () => {
      const print = vi.spyOn(window, 'print').mockImplementation(() => {});
      renderModal();
      fireEvent.change(campo('Tour'), { target: { value: 't1' } });
      fireEvent.click(botao('Exportar PDF'));
      expect(print).toHaveBeenCalledTimes(1);
      print.mockRestore();
    });
  });
});
