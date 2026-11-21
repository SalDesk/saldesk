/* Pagina de pagamento cancelado: com erro=lugar o pagamento foi recebido mas o lugar ja estava ocupado. */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BookingCancel from '../pages/BookingCancel';

const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };
const montar = (qs) => render(<MemoryRouter initialEntries={[`/book/cancel${qs}`]} future={FUTURE}><BookingCancel /></MemoryRouter>);

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('BookingCancel', () => {
  it('erro=lugar mostra o texto do reembolso em portugues', () => {
    localStorage.setItem('sd-lang', 'pt');
    montar('?res=r1&erro=lugar');
    expect(screen.getByText('O pagamento foi recebido, mas o lugar já tinha sido ocupado. O operador vai contactá-lo para o reembolso ou uma nova data.')).toBeInTheDocument();
    expect(screen.queryByText(/foi cancelado ou não pôde/)).toBeNull();
  });
  it('erro=lugar mostra o texto do reembolso em ingles', () => {
    localStorage.setItem('sd-lang', 'en');
    montar('?res=r1&erro=lugar');
    expect(screen.getByText('Your payment was received, but the place had already been taken. The operator will contact you about a refund or a new date.')).toBeInTheDocument();
  });
  it('outro erro mantem o texto generico', () => {
    localStorage.setItem('sd-lang', 'pt');
    montar('?erro=x');
    expect(screen.getByText('O pagamento foi cancelado ou não pôde ser validado.')).toBeInTheDocument();
  });
});
