import { render, screen } from '@testing-library/react';
import MetricCard from '../components/financial/MetricCard';

describe('MetricCard', () => {
  it('formata valor em euros', () => {
    render(<MetricCard label="Receita" value={1234.5} formato="euro" icon="💰" />);
    expect(screen.getByText('1234.50 €')).toBeInTheDocument();
  });

  it('formata valor em percentagem', () => {
    render(<MetricCard label="Ocupação" value={75} formato="percentagem" icon="📊" />);
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('mostra variação positiva com ▲', () => {
    render(<MetricCard label="X" value={100} variacao={12} variacaoLabel="+12%" icon="📈" />);
    expect(screen.getByText('▲')).toBeInTheDocument();
    expect(screen.getByText('+12%')).toBeInTheDocument();
  });

  it('mostra variação negativa com ▼', () => {
    render(<MetricCard label="X" value={80} variacao={-5} variacaoLabel="-5%" icon="📉" />);
    expect(screen.getByText('▼')).toBeInTheDocument();
    expect(screen.getByText('-5%')).toBeInTheDocument();
  });

  it('não mostra variação quando não fornecida', () => {
    render(<MetricCard label="X" value={100} icon="📊" />);
    expect(screen.queryByText('▲')).not.toBeInTheDocument();
    expect(screen.queryByText('▼')).not.toBeInTheDocument();
  });

  it('renderiza o label', () => {
    render(<MetricCard label="Receita Total" value={0} icon="💰" />);
    expect(screen.getByText('Receita Total')).toBeInTheDocument();
  });
});
