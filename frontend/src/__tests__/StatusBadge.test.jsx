import { render, screen } from '@testing-library/react';
import StatusBadge from '../components/reservations/StatusBadge';
import useUiStore from '../store/uiStore';

describe('StatusBadge', () => {
  const casos = [
    { status: 'pending',     label: 'Pendente' },
    { status: 'confirmed',   label: 'Confirmada' },
    { status: 'checked_in',  label: 'Check-in' },
    { status: 'checked_out', label: 'Check-out' },
    { status: 'cancelled',   label: 'Cancelada' },
    { status: 'no_show',     label: 'Não apareceu' }
  ];

  casos.forEach(({ status, label }) => {
    it(`renderiza "${label}" para status="${status}"`, () => {
      render(<StatusBadge status={status} />);
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it('em ingles o no_show mostra o rotulo e nao o valor gravado', () => {
    useUiStore.setState({ lang: 'en' });
    render(<StatusBadge status="no_show" />);
    expect(screen.getByText('No-show')).toBeInTheDocument();
    expect(screen.queryByText('no_show')).toBeNull();
    useUiStore.setState({ lang: 'pt' });
  });

  it('renderiza o valor bruto para status desconhecido', () => {
    render(<StatusBadge status="unknown_status" />);
    expect(screen.getByText('unknown_status')).toBeInTheDocument();
  });
});
