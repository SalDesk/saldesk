/* Ecras que o turista ve depois de reservar e promessas da pagina publica do operador:
   tem de bater com a confirmacao automatica e o prazo de cancelamento do operador. */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { BS } from '../pages/ServiceDetail';
import { textoReservaMesa } from '../components/restaurant/RestaurantReservationWidget';

afterEach(cleanup);

describe('ecra de reserva feita (servico)', () => {
  it('reserva_confirmada_diz_que_esta_confirmada', () => {
    render(<BS resId="abcd1234efgh" lang="pt" type="activity" confirmed onClose={vi.fn()} />);
    expect(screen.getByText('A sua reserva está confirmada. Receberá um email com os detalhes em breve.')).toBeInTheDocument();
    expect(screen.queryByText(/confirmará a sua reserva em 24h/)).toBeNull();
  });

  it('reserva_confirmada_em_ingles', () => {
    render(<BS resId="abcd1234efgh" lang="en" type="activity" confirmed onClose={vi.fn()} />);
    expect(screen.getByText('Your booking is confirmed. You will receive an email with the details shortly.')).toBeInTheDocument();
  });

  it('reserva_pendente_mantem_o_aviso_das_24h', () => {
    render(<BS resId="abcd1234efgh" lang="pt" type="activity" onClose={vi.fn()} />);
    expect(screen.getByText('Receberá um email de confirmação em breve. O operador confirmará a sua reserva em 24h.')).toBeInTheDocument();
  });
});

describe('ecra de mesa reservada (restaurante)', () => {
  it('mesa_confirmada_e_mesa_pendente', () => {
    expect(textoReservaMesa('confirmed', 'pt')).toEqual({ titulo: 'Reserva confirmada!', texto: 'A sua mesa está confirmada. Vai receber um email em breve.' });
    expect(textoReservaMesa('confirmed', 'en')).toEqual({ titulo: 'Reservation confirmed!', texto: 'Your table is confirmed. You will receive an email shortly.' });
    expect(textoReservaMesa('pending', 'pt')).toEqual({ titulo: 'Reserva submetida!', texto: 'A aguardar confirmação do restaurante. Vai receber um email em breve.' });
    expect(textoReservaMesa(undefined, 'en')).toEqual({ titulo: 'Reservation submitted!', texto: 'Awaiting confirmation from the restaurant. You will receive an email shortly.' });
  });
});
