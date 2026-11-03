import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AttentionPanel from '../components/dashboard/AttentionPanel';
import DashboardHeader from '../components/dashboard/DashboardHeader';
import TrialStrip from '../components/dashboard/TrialStrip';
import KpiCard from '../components/financial/KpiCard';
import useAuthStore from '../store/authStore';
import useUiStore from '../store/uiStore';

/* useNavigate mockado, mantendo os restantes exports do router */
const navigateMock = vi.fn();
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig()),
  useNavigate: () => navigateMock,
}));

const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };

function renderRouted(ui) {
  return render(<MemoryRouter future={FUTURE}>{ui}</MemoryRouter>);
}

/* Data ISO a N dias de agora (menos uma hora de folga para o arredondamento) */
function inDays(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000 - 60 * 60 * 1000).toISOString();
}

beforeEach(() => {
  navigateMock.mockReset();
  useUiStore.setState({ lang: 'pt' });
  useAuthStore.setState({ operator: null });
});

afterEach(() => {
  useAuthStore.setState({ operator: null });
});

describe('AttentionPanel', () => {
  const items = [
    { id: 'a', severity: 'critical', title: 'Titulo critico', detail: 'Detalhe A', to: '/meteorologia' },
    { id: 'b', severity: 'warning', title: 'Titulo aviso', to: '/reservas' },
    { id: 'c', severity: 'info', title: 'Titulo info', to: '/calendario' },
  ];

  it('sem itens mostra Tudo em ordem', () => {
    renderRouted(<AttentionPanel items={[]} />);
    expect(screen.getByText('Tudo em ordem')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Abrir/ })).not.toBeInTheDocument();
  });

  it('com itens mostra os titulos pela ordem recebida e a contagem', () => {
    renderRouted(<AttentionPanel items={items} />);
    const titulos = screen.getAllByRole('listitem').map((li) => li.querySelector('[data-role="title"]').textContent);
    expect(titulos).toEqual(['Titulo critico', 'Titulo aviso', 'Titulo info']);
    expect(screen.getByRole('heading', { name: /Requer atenção/ })).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Detalhe A')).toBeInTheDocument();
    expect(screen.queryByText('Tudo em ordem')).not.toBeInTheDocument();
  });

  it('cada linha leva a gravidade no ponto de cor', () => {
    renderRouted(<AttentionPanel items={items} />);
    const pontos = screen.getAllByRole('listitem').map((li) => li.querySelector('[data-severity]').dataset.severity);
    expect(pontos).toEqual(['critical', 'warning', 'info']);
  });

  it('clicar Abrir navega para o destino da linha', () => {
    renderRouted(<AttentionPanel items={items} />);
    const linha = screen.getAllByRole('listitem')[1];
    fireEvent.click(within(linha).getByRole('button', { name: /Abrir/ }));
    expect(navigateMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith('/reservas');
  });
});

describe('DashboardHeader', () => {
  it('mostra titulo, subtitulo e acoes', () => {
    render(
      <DashboardHeader
        title="Hotel Morabeza"
        subtitle="Segunda-feira"
        actions={<button type="button">Nova reserva</button>}
        view="hoje"
        onViewChange={() => {}}
      />
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Hotel Morabeza' })).toBeInTheDocument();
    expect(screen.getByText('Segunda-feira')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nova reserva' })).toBeInTheDocument();
  });

  it('clicar Resumo chama onViewChange e a tab ativa tem aria-selected', () => {
    const onViewChange = vi.fn();
    render(<DashboardHeader title="Painel" view="hoje" onViewChange={onViewChange} />);
    expect(screen.getByRole('tab', { name: 'Hoje' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Resumo' })).toHaveAttribute('aria-selected', 'false');
    fireEvent.click(screen.getByRole('tab', { name: 'Resumo' }));
    expect(onViewChange).toHaveBeenCalledWith('resumo');
  });

  it('a vista resumo fica com a tab Resumo ativa', () => {
    render(<DashboardHeader title="Painel" view="resumo" onViewChange={() => {}} />);
    expect(screen.getByRole('tab', { name: 'Resumo' })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('TrialStrip', () => {
  it('em avaliacao com 20 dias mostra os dias e o estilo normal', () => {
    useAuthStore.setState({ operator: { plan_status: 'trial', trial_ends_at: inDays(20) } });
    renderRouted(<TrialStrip />);
    expect(screen.getByText(/20 dia\(s\) restante\(s\)/)).toBeInTheDocument();
    expect(screen.getByTestId('trial-strip').className).not.toContain('bg-amber-50');
  });

  it('com 3 dias aplica o estilo urgente (bg-amber-50)', () => {
    useAuthStore.setState({ operator: { plan_status: 'trial', trial_ends_at: inDays(3) } });
    renderRouted(<TrialStrip />);
    expect(screen.getByText(/3 dia\(s\) restante\(s\)/)).toBeInTheDocument();
    expect(screen.getByTestId('trial-strip').className).toContain('bg-amber-50');
  });

  it('o botao Ver planos leva a definicoes', () => {
    useAuthStore.setState({ operator: { plan_status: 'trial', trial_ends_at: inDays(20) } });
    renderRouted(<TrialStrip />);
    fireEvent.click(screen.getByRole('button', { name: /Ver planos/ }));
    expect(navigateMock).toHaveBeenCalledWith('/definicoes');
  });

  it('expirado mostra o aviso e leva a facturacao', () => {
    useAuthStore.setState({ operator: { plan_status: 'trial', trial_ends_at: inDays(-2) } });
    renderRouted(<TrialStrip />);
    expect(screen.getByText('Periodo de avaliacao expirado')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Ver planos/ }));
    expect(navigateMock).toHaveBeenCalledWith('/definicoes?tab=facturacao');
  });

  it('sem avaliacao devolve nada', () => {
    useAuthStore.setState({ operator: { plan_status: 'active', trial_ends_at: null } });
    const { container } = renderRouted(<TrialStrip />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('KpiCard', () => {
  it('mantem o aspeto antigo e ganha o novo', () => {
    render(<KpiCard label="Receita" value={10} />);
    const card = screen.getByText('Receita').closest('div[class*="rounded-lg"]');
    expect(card.className).toContain('rounded-lg');
    expect(card.className).toContain('app:rounded-sm');
    expect(card.className).toContain('app:hover:translate-y-0');
    expect(card.className).toContain('app:hover:shadow-sm');
    expect(screen.getByText('Receita').className).toContain('app:normal-case');
    expect(screen.getByText('10').className).toContain('app:tabular-nums');
  });

  /* Texto do valor principal do cartao (o paragrafo a seguir ao rotulo) */
  function valorDe(label) {
    return screen.getByText(label).parentElement.nextElementSibling;
  }

  it('valor em falta em euro mostra o traco e nunca NaN', () => {
    [null, undefined, '—', NaN, Infinity].forEach((v, i) => {
      const label = `Euro ${i}`;
      render(<KpiCard label={label} value={v} format="euro" />);
      expect(valorDe(label)).toHaveTextContent(/^—$/);
    });
    expect(document.body.textContent).not.toContain('NaN');
  });

  it('valor em falta em percentagem mostra o traco e nunca NaN', () => {
    [null, undefined, '—', NaN, Infinity].forEach((v, i) => {
      const label = `Pct ${i}`;
      render(<KpiCard label={label} value={v} format="percent" />);
      expect(valorDe(label)).toHaveTextContent(/^—$/);
    });
    expect(document.body.textContent).not.toContain('NaN');
  });

  it('o zero verdadeiro continua a aparecer como zero', () => {
    render(<KpiCard label="Eur" value={0} format="euro" />);
    render(<KpiCard label="Pct" value={0} format="percent" />);
    render(<KpiCard label="Num" value={0} />);
    expect(valorDe('Eur')).toHaveTextContent(/^€0$/);
    expect(valorDe('Pct')).toHaveTextContent(/^0\.0%$/);
    expect(valorDe('Num')).toHaveTextContent(/^0$/);
  });

  it('o formato numero nao muda para valores em falta', () => {
    render(<KpiCard label="Nulo" value={null} />);
    render(<KpiCard label="Texto" value="—" />);
    expect(valorDe('Nulo')).toHaveTextContent(/^0$/);
    expect(valorDe('Texto')).toHaveTextContent(/^—$/);
  });

  it('a variacao em euro leva o sinal antes do simbolo', () => {
    render(<KpiCard label="Neg" value={100} delta={-10} format="euro" />);
    render(<KpiCard label="Pos" value={100} delta={10} format="euro" />);
    render(<KpiCard label="Zero" value={100} delta={0} format="euro" />);
    expect(screen.getByText('-€10')).toBeInTheDocument();
    expect(screen.getByText('+€10')).toBeInTheDocument();
    expect(screen.queryByText('€-10')).not.toBeInTheDocument();
    expect(screen.getByText('€0')).toBeInTheDocument();
  });

  it('a variacao em percentagem e em numero mantem o formato', () => {
    render(<KpiCard label="PctPos" value={50} delta={2} format="percent" />);
    render(<KpiCard label="PctNeg" value={50} delta={-3} format="percent" />);
    render(<KpiCard label="NumNeg" value={5} delta={-3} />);
    render(<KpiCard label="NumPos" value={5} delta={4} />);
    expect(screen.getByText('+2.0 p.p.')).toBeInTheDocument();
    expect(screen.getByText('-3.0 p.p.')).toBeInTheDocument();
    expect(screen.getByText('-3')).toBeInTheDocument();
    expect(screen.getByText('+4')).toBeInTheDocument();
  });
});
