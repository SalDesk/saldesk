import { render, screen } from '@testing-library/react';
import StatusBadge from '../components/reservations/StatusBadge';

describe('StatusBadge', () => {
  const casos = [
    { status: 'pending',     label: 'Pendente' },
    { status: 'confirmed',   label: 'Confirmada' },
    { status: 'checked_in',  label: 'Check-in' },
    { status: 'checked_out', label: 'Check-out' },
    { status: 'cancelled',   label: 'Cancelada' }
  ];

  casos.forEach(({ status, label }) => {
    it(`renderiza "${label}" para status="${status}"`, () => {
      render(<StatusBadge status={status} />);
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it('renderiza o valor bruto para status desconhecido', () => {
    render(<StatusBadge status="unknown_status" />);
    expect(screen.getByText('unknown_status')).toBeInTheDocument();
  });
});
