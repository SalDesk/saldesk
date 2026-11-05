import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ReservationForm from '../components/reservations/ReservationForm';
import ReservationDetailModal from '../components/reservations/ReservationDetailModal';
import ReservationCard from '../components/reservations/ReservationCard';
import useUiStore from '../store/uiStore';
import { getReservation, changeStatus, deleteReservation } from '../services/reservationsService';
import { getFleetAvailability } from '../services/fleetService';

/* Sem rede: so os servicos que estes componentes importam */
vi.mock('../services/reservationsService', () => ({
  getReservation: vi.fn(),
  changeStatus: vi.fn(),
  deleteReservation: vi.fn(),
}));
vi.mock('../services/fleetService', () => ({
  getFleetAvailability: vi.fn(),
}));
vi.mock('../services/messagingService', () => ({
  sendReservationMessage: vi.fn(),
  markMessageOpened: vi.fn(),
}));

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
const AMANHA = dataLocal(1);
const MAIS_QUATRO = dataLocal(4);

/* O campo que esta por baixo de uma etiqueta (a etiqueta e o campo partilham o mesmo bloco) */
function campo(texto) {
  const etiqueta = screen.getByText(texto);
  return etiqueta.parentElement.querySelector('input, select, textarea');
}
function botao(nome) {
  return screen.getByRole('button', { name: nome });
}
function preencher(texto, valor) {
  fireEvent.change(campo(texto), { target: { value: valor } });
}

describe('Formulario, detalhe e cartao de reserva', () => {
  let errSpy;
  let warnSpy;

  beforeEach(() => {
    useUiStore.setState({ lang: 'pt' });
    getReservation.mockReset();
    changeStatus.mockReset();
    deleteReservation.mockReset();
    /* por omissao a disponibilidade de buggys nunca responde: nenhuma actualizacao fora do teste */
    getFleetAvailability.mockReset().mockImplementation(() => new Promise(() => {}));
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

  /* ---------------------------------------------------------------- */
  describe('ReservationForm', () => {
    const QUARTO = { id: 'u1', name: 'Quarto 1', base_price: 50 };
    const TOUR_SEM_HORARIOS = { id: 't1', name: 'Tour Norte', base_price: 25, description: 'Passeio' };
    const TOUR_COM_HORARIOS = {
      id: 't2', name: 'Tour Sul', base_price: 25,
      description: JSON.stringify({ time_slots: [{ time: '09:00', capacity: 8 }, { time: '14:00', capacity: 6 }] }),
    };
    const MESA = { id: 'm1', name: 'Mesa 4', base_price: 0 };

    function renderForm(over = {}) {
      const props = {
        reservation: null,
        units: [QUARTO, TOUR_SEM_HORARIOS, TOUR_COM_HORARIOS, MESA],
        operatorType: 'hotel',
        onSave: vi.fn(),
        onCancel: vi.fn(),
        loading: false,
        error: '',
        ...over,
      };
      render(<ReservationForm {...props} />);
      return props;
    }

    function preencherCliente() {
      preencher('Cliente', 'Maria Silva');
      preencher('Email', 'maria@exemplo.com');
    }

    it('hotel: mostra os campos de hoje e o botao de criar', () => {
      renderForm();
      for (const e of ['Unidade', 'Check-in', 'Check-out', 'Cliente', 'Email', 'Telefone', 'Nacionalidade', 'Hospedes', 'Fonte', 'Notas internas']) {
        expect(screen.getByText(e)).toBeInTheDocument();
      }
      expect(campo('Hospedes')).toHaveValue(1);
      expect(campo('Fonte')).toHaveValue('manual');
      expect(screen.getByText('Codigo ISO 2')).toBeInTheDocument();
      expect(screen.getByRole('checkbox')).not.toBeChecked();
      expect(botao('Nova Reserva')).toBeInTheDocument();
      expect(botao('Cancelar')).toBeInTheDocument();
    });

    it('hotel: preencher e submeter entrega o objecto exacto (vazios incluidos, hospedes numero)', () => {
      const props = renderForm();
      preencher('Unidade', 'u1');
      preencher('Check-in', AMANHA);
      preencher('Check-out', MAIS_QUATRO);
      preencherCliente();
      preencher('Hospedes', '3');
      fireEvent.click(botao('Nova Reserva'));
      expect(props.onSave).toHaveBeenCalledTimes(1);
      expect(props.onSave).toHaveBeenCalledWith({
        unit_id: 'u1',
        customer_name: 'Maria Silva',
        customer_email: 'maria@exemplo.com',
        customer_phone: '',
        customer_country: '',
        check_in: AMANHA,
        check_out: MAIS_QUATRO,
        guests: 3,
        tour_time: '09:00',
        start_time: null,
        source: 'manual',
        notes: '',
        whatsapp_opt_in: false,
        fleet_id: null,
      });
    });

    it('hotel: todos os campos opcionais, fonte e consentimento de WhatsApp', () => {
      const props = renderForm();
      preencher('Unidade', 'u1');
      preencher('Check-in', AMANHA);
      preencher('Check-out', MAIS_QUATRO);
      preencherCliente();
      preencher('Telefone', '+238 900 0000');
      preencher('Nacionalidade', 'PT');
      preencher('Fonte', 'viator');
      preencher('Notas internas', 'Chega tarde');
      fireEvent.click(screen.getByRole('checkbox'));
      fireEvent.click(botao('Nova Reserva'));
      expect(props.onSave).toHaveBeenCalledWith({
        unit_id: 'u1',
        customer_name: 'Maria Silva',
        customer_email: 'maria@exemplo.com',
        customer_phone: '+238 900 0000',
        customer_country: 'PT',
        check_in: AMANHA,
        check_out: MAIS_QUATRO,
        guests: 1,
        tour_time: '09:00',
        start_time: null,
        source: 'viator',
        notes: 'Chega tarde',
        whatsapp_opt_in: true,
        fleet_id: null,
      });
    });

    it('hotel: pre-visualiza o preco pelas noites', () => {
      renderForm();
      preencher('Unidade', 'u1');
      preencher('Check-in', AMANHA);
      preencher('Check-out', MAIS_QUATRO);
      expect(screen.getByText('3 noite(s)')).toBeInTheDocument();
      expect(screen.getByText('€150.00')).toBeInTheDocument();
    });

    it('os campos obrigatorios mostram o asterisco (o componente de campo nao passa required ao elemento)', () => {
      renderForm();
      for (const e of ['Unidade', 'Check-in', 'Check-out', 'Cliente', 'Email']) {
        expect(screen.getByText(e)).toHaveTextContent(`${e}*`);
      }
      for (const e of ['Telefone', 'Nacionalidade', 'Hospedes', 'Fonte', 'Notas internas']) {
        expect(screen.getByText(e)).not.toHaveTextContent('*');
      }
      expect(campo('Check-out')).not.toHaveAttribute('min');
      preencher('Check-in', AMANHA);
      expect(campo('Check-out')).toHaveAttribute('min', AMANHA);
      expect(campo('Hospedes')).toHaveAttribute('min', '1');
    });

    it('mostra o erro recebido por prop', () => {
      renderForm({ error: 'Unidade ocupada nessas datas' });
      expect(screen.getByText('Unidade ocupada nessas datas')).toBeInTheDocument();
    });

    it('sem erro nao mostra caixa de erro', () => {
      renderForm();
      expect(screen.queryByText('Unidade ocupada nessas datas')).not.toBeInTheDocument();
    });

    it('a carregar o botao de submeter fica desactivado', () => {
      renderForm({ loading: true });
      expect(botao('Nova Reserva')).toBeDisabled();
    });

    it('Cancelar chama onCancel e nao submete', () => {
      const props = renderForm();
      fireEvent.click(botao('Cancelar'));
      expect(props.onCancel).toHaveBeenCalledTimes(1);
      expect(props.onSave).not.toHaveBeenCalled();
    });

    it('a fonte oferece as seis origens de hoje', () => {
      renderForm();
      const opcoes = within(campo('Fonte')).getAllByRole('option').map(o => [o.value, o.textContent]);
      expect(opcoes).toEqual([
        ['direct', 'Directa'],
        ['booking_com', 'Booking.com'],
        ['airbnb', 'Airbnb'],
        ['viator', 'Viator'],
        ['getyourguide', 'GetYourGuide'],
        ['manual', 'Manual'],
      ]);
    });

    it('a escolha de um buggy livre entra no objecto como fleet_id', async () => {
      getFleetAvailability.mockReset().mockResolvedValue([
        { id: 'f1', name: 'Buggy 1', capacity: 4, available: true },
        { id: 'f2', name: 'Buggy 2', capacity: 4, available: false },
      ]);
      const props = renderForm({ operatorType: 'activity' });
      preencher('Tour / Actividade', 't1');
      preencher('Data do tour', AMANHA);
      fireEvent.click(await screen.findByRole('button', { name: /Buggy 1/ }));
      preencherCliente();
      fireEvent.click(botao('Nova Reserva'));
      expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({ fleet_id: 'f1', unit_id: 't1' }));
      expect(getFleetAvailability).toHaveBeenCalledWith('t1', AMANHA);
    });

    it('actividade sem horarios: hora livre, data repetida na saida e hora nas notas', () => {
      const props = renderForm({ operatorType: 'activity' });
      preencher('Tour / Actividade', 't1');
      preencher('Data do tour', AMANHA);
      preencher('Hora', '10:30');
      preencherCliente();
      preencher('Hospedes', '2');
      preencher('Notas internas', 'Vegetariano');
      expect(screen.getByText('2 pessoa(s)')).toBeInTheDocument();
      expect(screen.getByText('€50.00')).toBeInTheDocument();
      fireEvent.click(botao('Nova Reserva'));
      expect(props.onSave).toHaveBeenCalledWith({
        unit_id: 't1',
        customer_name: 'Maria Silva',
        customer_email: 'maria@exemplo.com',
        customer_phone: '',
        customer_country: '',
        check_in: AMANHA,
        check_out: AMANHA,
        guests: 2,
        tour_time: '10:30',
        start_time: null,
        source: 'manual',
        notes: 'Hora: 10:30 | Vegetariano',
        whatsapp_opt_in: false,
        fleet_id: null,
      });
    });

    it('actividade com horarios: escolhe um horario e o start_time acompanha-o', () => {
      const props = renderForm({ operatorType: 'activity' });
      preencher('Tour / Actividade', 't2');
      preencher('Data do tour', AMANHA);
      expect(within(campo('Horário')).getAllByRole('option').map(o => o.textContent)).toEqual([
        'Seleccionar horário...', '09:00 (8 lugares)', '14:00 (6 lugares)',
      ]);
      preencher('Horário', '14:00');
      preencherCliente();
      fireEvent.click(botao('Nova Reserva'));
      expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({
        unit_id: 't2', check_in: AMANHA, check_out: AMANHA, tour_time: '14:00', start_time: '14:00', notes: 'Hora: 14:00',
      }));
    });

    it('restaurante: data e hora da reserva, sem pre-visualizacao de preco', () => {
      const props = renderForm({ operatorType: 'restaurant' });
      preencher('Unidade', 'm1');
      preencher('Data da reserva', AMANHA);
      expect(campo('Hora')).toHaveValue('19:00');
      preencher('Hora', '20:30');
      preencherCliente();
      preencher('Hospedes', '4');
      expect(screen.queryByText(/pessoa\(s\)/)).not.toBeInTheDocument();
      fireEvent.click(botao('Nova Reserva'));
      expect(props.onSave).toHaveBeenCalledWith({
        unit_id: 'm1',
        customer_name: 'Maria Silva',
        customer_email: 'maria@exemplo.com',
        customer_phone: '',
        customer_country: '',
        check_in: AMANHA,
        check_out: AMANHA,
        guests: 4,
        tour_time: '09:00',
        start_time: '20:30',
        source: 'manual',
        notes: '',
        whatsapp_opt_in: false,
        fleet_id: null,
      });
    });

    it('edicao: parte dos valores da reserva, esconde o consentimento e mostra Guardar', () => {
      const reservation = {
        id: 'r1', unit_id: 'u1', customer_name: 'Joao Pires', customer_email: 'joao@exemplo.com',
        customer_phone: '+238 911', customer_country: 'DE', check_in: AMANHA, check_out: MAIS_QUATRO,
        guests: 2, start_time: '18:45:00', source: 'airbnb', notes: 'Nota antiga', fleet_id: 'f9',
      };
      const props = renderForm({ reservation });
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
      expect(campo('Cliente')).toHaveValue('Joao Pires');
      expect(campo('Fonte')).toHaveValue('airbnb');
      expect(botao('Guardar')).toBeInTheDocument();
      preencher('Telefone', '+238 922');
      fireEvent.click(botao('Guardar'));
      expect(props.onSave).toHaveBeenCalledWith({
        unit_id: 'u1',
        customer_name: 'Joao Pires',
        customer_email: 'joao@exemplo.com',
        customer_phone: '+238 922',
        customer_country: 'DE',
        check_in: AMANHA,
        check_out: MAIS_QUATRO,
        guests: 2,
        tour_time: '09:00',
        start_time: null,
        source: 'airbnb',
        notes: 'Nota antiga',
        whatsapp_opt_in: false,
        fleet_id: 'f9',
      });
    });
  });

  /* ---------------------------------------------------------------- */
  describe('ReservationDetailModal', () => {
    const COMPLETA = {
      id: 'abcdef12-3456-7890', status: 'confirmed', source: 'viator',
      units: { name: 'Tour Norte', unit_type: 'tour' },
      total_price: 123.4, amount_paid: 50,
      check_in: AMANHA, check_out: MAIS_QUATRO, start_time: '19:30:00', guests: 3,
      payment_status: 'paid', payment_method: 'vinti4',
      customer_name: 'Maria Silva', customer_email: 'maria@exemplo.com', customer_phone: '+238 900 0000', customer_country: 'PT',
      fleet: { name: 'Buggy 1', capacity: 4 },
      notes: 'Chega tarde',
      created_at: new Date().toISOString(),
    };

    function renderDetalhe(over = {}) {
      const props = { reservationId: 'abcdef12-3456-7890', open: true, onClose: vi.fn(), ...over };
      render(<ReservationDetailModal {...props} />);
      return props;
    }

    it('pede a reserva pelo id e mostra todos os campos', async () => {
      getReservation.mockResolvedValue(COMPLETA);
      renderDetalhe();
      expect(await screen.findByText('Maria Silva')).toBeInTheDocument();
      expect(getReservation).toHaveBeenCalledWith('abcdef12-3456-7890');
      expect(screen.getByRole('heading', { name: 'Detalhes da reserva' })).toBeInTheDocument();
      expect(screen.getByText('Confirmada')).toBeInTheDocument();
      expect(screen.getByText('Viator')).toBeInTheDocument();
      expect(screen.getByText('#abcdef12')).toBeInTheDocument();
      expect(screen.getByText('Tour Norte')).toBeInTheDocument();
      expect(screen.getByText('tour')).toBeInTheDocument();
      expect(screen.getByText('€123.40')).toBeInTheDocument();
      expect(screen.getByText('Pago: €50.00')).toBeInTheDocument();
      expect(screen.getByText(formatada(AMANHA))).toBeInTheDocument();
      expect(screen.getByText(formatada(MAIS_QUATRO))).toBeInTheDocument();
      expect(screen.getByText('19:30')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('VINTI4')).toBeInTheDocument();
      expect(screen.getByText('maria@exemplo.com')).toBeInTheDocument();
      expect(screen.getByText('+238 900 0000')).toBeInTheDocument();
      expect(screen.getByText('PT')).toBeInTheDocument();
      expect(screen.getByText('Buggy 1 (4 lugares)')).toBeInTheDocument();
      expect(screen.getByText('Chega tarde')).toBeInTheDocument();
      for (const e of ['Check-in', 'Check-out', 'Hora', 'Hospedes', 'Estado do pagamento', 'Metodo de pagamento', 'Cliente', 'Email', 'Telefone', 'Viatura', 'Notas', 'Criada em']) {
        expect(screen.getByText(e)).toBeInTheDocument();
      }
    });

    it('o estado do pagamento aparece traduzido', async () => {
      getReservation.mockResolvedValue(COMPLETA);
      renderDetalhe();
      expect(await screen.findByText('Maria Silva')).toBeInTheDocument();
      expect(screen.getByText('Pago')).toBeInTheDocument();
    });

    it('as acoes de WhatsApp aparecem conforme o estado da reserva', async () => {
      getReservation.mockResolvedValue(COMPLETA);
      renderDetalhe();
      expect(await screen.findByText('Maria Silva')).toBeInTheDocument();
      expect(botao('Confirmação')).toBeEnabled();
      expect(botao('Lembrete')).toBeEnabled();
    });

    it('no mesmo dia nao repete a saida e sem extras esconde os blocos opcionais', async () => {
      getReservation.mockResolvedValue({
        id: 'x1', status: 'pending', source: 'manual', units: { name: 'Quarto 1' }, total_price: 80,
        check_in: AMANHA, check_out: AMANHA, guests: 2, customer_name: 'Rui Rosa',
      });
      renderDetalhe({ reservationId: 'x1' });
      expect(await screen.findByText('Rui Rosa')).toBeInTheDocument();
      expect(screen.queryByText('Check-out')).not.toBeInTheDocument();
      expect(screen.queryByText('Hora')).not.toBeInTheDocument();
      expect(screen.queryByText('Viatura')).not.toBeInTheDocument();
      expect(screen.queryByText('Notas')).not.toBeInTheDocument();
      expect(screen.queryByText('Estado do pagamento')).not.toBeInTheDocument();
      expect(screen.getByText('Pendente')).toBeInTheDocument();
    });

    it('mostra o erro do servidor', async () => {
      getReservation.mockRejectedValue({ response: { data: { error: 'Reserva nao encontrada' } } });
      renderDetalhe();
      expect(await screen.findByText('Reserva nao encontrada')).toBeInTheDocument();
    });

    it('fechar chama onClose', async () => {
      getReservation.mockResolvedValue(COMPLETA);
      const props = renderDetalhe();
      expect(await screen.findByText('Maria Silva')).toBeInTheDocument();
      fireEvent.click(botao('Fechar'));
      expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    it('fechado nao pede a reserva', () => {
      renderDetalhe({ open: false });
      expect(getReservation).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  /* ---------------------------------------------------------------- */
  describe('ReservationCard', () => {
    function reserva(over = {}) {
      return {
        id: 'r1', status: 'pending', source: 'direct', units: { name: 'Quarto 1' }, total_price: 150, guests: 2,
        check_in: AMANHA, check_out: MAIS_QUATRO, customer_name: 'Maria Silva', customer_country: 'PT',
        ...over,
      };
    }

    function renderCartao(r = reserva(), over = {}) {
      const props = { reservation: r, onUpdate: vi.fn(), onEdit: vi.fn(), onView: vi.fn(), ...over };
      render(<ReservationCard {...props} />);
      return props;
    }

    it('mostra cliente, estado, origem, unidade, total, hospedes e datas', () => {
      renderCartao();
      expect(screen.getByText('Maria Silva')).toBeInTheDocument();
      expect(screen.getByText('· PT')).toBeInTheDocument();
      expect(screen.getByText('Pendente')).toBeInTheDocument();
      expect(screen.getByText('Directa')).toBeInTheDocument();
      expect(screen.getByText('Quarto 1')).toBeInTheDocument();
      expect(screen.getByText('€150.00')).toBeInTheDocument();
      expect(screen.getByText('2 hósp.')).toBeInTheDocument();
      expect(screen.getByText(formatada(AMANHA))).toBeInTheDocument();
      expect(screen.getByText(formatada(MAIS_QUATRO))).toBeInTheDocument();
    });

    it('usa a base de cartao do desenho: branco, com borda e cantos de 8 px', () => {
      const { container } = render(<ReservationCard reservation={reserva()} onUpdate={vi.fn()} onEdit={vi.fn()} onView={vi.fn()} />);
      expect(container.firstChild).toHaveClass('bg-white', 'border', 'border-n-200', 'rounded-sm');
    });

    it('mostra o buggy quando a reserva tem um', () => {
      renderCartao(reserva({ fleet: { name: 'Buggy 1', capacity: 4 } }));
      expect(screen.getByText('Buggy 1 (4 lugares)')).toBeInTheDocument();
    });

    it('Ver e Editar chamam as props com a reserva', () => {
      const r = reserva();
      const props = renderCartao(r);
      fireEvent.click(botao('Ver'));
      expect(props.onView).toHaveBeenCalledWith(r);
      fireEvent.click(botao('Editar'));
      expect(props.onEdit).toHaveBeenCalledWith(r);
    });

    it('o botao de avancar muda o estado e devolve a reserva actualizada', async () => {
      changeStatus.mockResolvedValue({ id: 'r1', status: 'confirmed' });
      const props = renderCartao();
      fireEvent.click(botao('Confirmar'));
      await waitFor(() => expect(props.onUpdate).toHaveBeenCalledTimes(1));
      expect(changeStatus).toHaveBeenCalledWith('r1', 'confirmed');
      expect(props.onUpdate).toHaveBeenCalledWith({ id: 'r1', status: 'confirmed' });
    });

    it('o botao de avancar segue o estado: confirmada passa a Check-in, check-in a Check-out', () => {
      renderCartao(reserva({ status: 'confirmed' }));
      expect(botao('Check-in')).toBeInTheDocument();
      cleanup();
      renderCartao(reserva({ status: 'checked_in' }));
      expect(botao('Check-out')).toBeInTheDocument();
    });

    it('sem proximo estado nao ha botao de avancar nem de eliminar', () => {
      renderCartao(reserva({ status: 'checked_out' }));
      expect(screen.getAllByRole('button').map(b => b.getAttribute('aria-label'))).toEqual(['Ver', 'Editar']);
    });

    it('pendente: eliminar pede confirmacao e depois apaga', async () => {
      deleteReservation.mockResolvedValue();
      const props = renderCartao();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      fireEvent.click(botao('Eliminar'));
      const dialogo = await screen.findByRole('dialog');
      expect(within(dialogo).getByText('Tem a certeza que quer eliminar esta reserva?')).toBeInTheDocument();
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Eliminar' }));
      await waitFor(() => expect(props.onUpdate).toHaveBeenCalledTimes(1));
      expect(deleteReservation).toHaveBeenCalledWith('r1');
      expect(props.onUpdate).toHaveBeenCalledWith(null, 'r1');
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('cancelar a confirmacao nao apaga', async () => {
      const props = renderCartao();
      fireEvent.click(botao('Eliminar'));
      const dialogo = await screen.findByRole('dialog');
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(deleteReservation).not.toHaveBeenCalled();
      expect(props.onUpdate).not.toHaveBeenCalled();
    });

    it('cancelada tambem pode ser eliminada, confirmada nao', () => {
      renderCartao(reserva({ status: 'cancelled' }));
      expect(botao('Eliminar')).toBeInTheDocument();
      cleanup();
      renderCartao(reserva({ status: 'confirmed' }));
      expect(screen.queryByRole('button', { name: 'Eliminar' })).not.toBeInTheDocument();
    });
  });
});
