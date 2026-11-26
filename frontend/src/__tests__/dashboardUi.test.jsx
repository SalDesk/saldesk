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
    { id: 'a', severity: 'critical', title: 'Título crítico', detail: 'Detalhe A', to: '/meteorologia' },
    { id: 'b', severity: 'warning', title: 'Título aviso', to: '/reservas' },
    { id: 'c', severity: 'info', title: 'Título info', to: '/calendario' },
  ];

  it('sem itens mostra Tudo em ordem', () => {
    renderRouted(<AttentionPanel items={[]} />);
    expect(screen.getByText('Tudo em ordem')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Abrir/ })).not.toBeInTheDocument();
  });

  it('com itens mostra os titulos pela ordem recebida e a contagem', () => {
    renderRouted(<AttentionPanel items={items} />);
    const titulos = screen.getAllByRole('listitem').map((li) => li.querySelector('[data-role="title"]').textContent);
    expect(titulos).toEqual(['Título crítico', 'Título aviso', 'Título info']);
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

  it('cada linha tem a sua accao pelo tipo do item e a contagem aparece no cabecalho', () => {
    const lista = [
      { id: 'weather', severity: 'critical', title: 'Meteo', to: '/meteorologia' },
      { id: 'unconfirmed', severity: 'warning', title: 'Por confirmar', to: '/reservas' },
      { id: 'pending', severity: 'warning', title: 'Pendentes', to: '/reservas' },
      { id: 'unpaid', severity: 'warning', title: 'Por pagar', to: '/reservas' },
      { id: 'cleaning', severity: 'warning', title: 'Limpezas', to: '/housekeeping' },
    ];
    renderRouted(<AttentionPanel items={lista} />);
    const rotulos = screen.getAllByRole('listitem').map((li) => within(li).getByRole('button').textContent);
    expect(rotulos).toEqual(['Ver', 'Confirmar', 'Confirmar', 'Cobrar', 'Abrir']);
    screen.getAllByRole('listitem').forEach((li) => expect(within(li).getByRole('button').className).toContain('min-h-[44px]'));
    expect(within(screen.getByRole('heading', { name: /Requer atenção/ }).parentElement).getByText('5')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cobrar: Por pagar' }));
    expect(navigateMock).toHaveBeenCalledWith('/reservas');
  });

  it('em ingles as accoes aparecem em ingles', () => {
    useUiStore.setState({ lang: 'en' });
    renderRouted(<AttentionPanel items={[{ id: 'unpaid', severity: 'warning', title: 'X', to: '/reservas' }, { id: 'weather', severity: 'critical', title: 'Y', to: '/m' }]} />);
    expect(screen.getAllByRole('listitem').map((li) => within(li).getByRole('button').textContent)).toEqual(['Collect', 'View']);
    expect(screen.getByRole('heading', { name: 'Needs attention' })).toBeInTheDocument();
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
  it('mostra título, subtítulo e ações', () => {
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

  it('a data fica em DM Mono acima do titulo e o interruptor e uma pilula', () => {
    render(<DashboardHeader title="Bom dia, Rits" subtitle="Terça-feira, 25 de novembro" view="hoje" onViewChange={() => {}} />);
    const data = screen.getByText('Terça-feira, 25 de novembro');
    expect(data.className).toContain('font-mono');
    const titulo = screen.getByRole('heading', { level: 1 });
    expect(data.compareDocumentPosition(titulo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('tablist', { name: 'Vista do painel' }).className).toContain('rounded-full');
  });

  it('Nova reserva e Ver calendario chamam os callbacks e so aparecem quando existem', () => {
    const nova = vi.fn();
    const calendario = vi.fn();
    const { rerender } = render(<DashboardHeader title="Painel" view="hoje" onViewChange={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Nova reserva' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ver calendário' })).toBeNull();
    rerender(<DashboardHeader title="Painel" view="hoje" onViewChange={() => {}} onNovaReserva={nova} onVerCalendario={calendario} />);
    fireEvent.click(screen.getByRole('button', { name: 'Nova reserva' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ver calendário' }));
    expect(nova).toHaveBeenCalledTimes(1);
    expect(calendario).toHaveBeenCalledTimes(1);
  });

  it('Nova reserva e um unico botao sand, no cabecalho tambem no telemovel (a barra de baixo ja tem um botao redondo)', () => {
    render(<DashboardHeader title="Painel" view="hoje" onViewChange={() => {}} onNovaReserva={() => {}} />);
    /* um so botao com este nome: nao ha duplicado para o telemovel */
    const botao = screen.getByRole('button', { name: 'Nova reserva' });
    expect(botao.className).toContain('bg-sand-500');
    /* nao flutua: o botao central da BottomNav ja e redondo e sand, dois juntos confundiam */
    expect(botao.className).not.toContain('max-md:fixed');
    expect(botao.className).toContain('max-md:min-h-[44px]');
    /* o texto ve-se tambem no telemovel */
    expect(botao.textContent).toContain('Nova reserva');
    expect(botao.querySelector('.max-md\\:hidden')).toBeNull();
  });

  it('em telemovel os separadores e Ver calendario tem pelo menos 44 px de altura', () => {
    render(<DashboardHeader title="Painel" view="hoje" onViewChange={() => {}} onVerCalendario={() => {}} />);
    expect(screen.getByRole('tab', { name: 'Hoje' }).className).toContain('max-md:min-h-[44px]');
    expect(screen.getByRole('tab', { name: 'Resumo' }).className).toContain('max-md:min-h-[44px]');
    expect(screen.getByRole('button', { name: 'Ver calendário' }).className).toContain('max-md:!h-11');
  });

  it('as setas mudam de vista como nos outros separadores', () => {
    const onViewChange = vi.fn();
    render(<DashboardHeader title="Painel" view="hoje" onViewChange={onViewChange} />);
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Hoje' }), { key: 'ArrowRight' });
    expect(onViewChange).toHaveBeenCalledWith('resumo');
  });

  it('em ingles o interruptor e as accoes saem em ingles', () => {
    useUiStore.setState({ lang: 'en' });
    render(<DashboardHeader title="Good morning" view="hoje" onViewChange={() => {}} onNovaReserva={() => {}} onVerCalendario={() => {}} />);
    expect(screen.getByRole('tablist', { name: 'Dashboard view' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Today' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New booking' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View calendar' })).toBeInTheDocument();
  });
});

describe('TrialStrip', () => {
  it('em avaliação com 20 dias mostra os dias e o estilo normal', () => {
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

  it('o botão Ver planos leva a definições', () => {
    useAuthStore.setState({ operator: { plan_status: 'trial', trial_ends_at: inDays(20) } });
    renderRouted(<TrialStrip />);
    fireEvent.click(screen.getByRole('button', { name: /Ver planos/ }));
    expect(navigateMock).toHaveBeenCalledWith('/definicoes');
  });

  it('expirado mostra o aviso e leva a facturação', () => {
    useAuthStore.setState({ operator: { plan_status: 'trial', trial_ends_at: inDays(-2) } });
    renderRouted(<TrialStrip />);
    expect(screen.getByText('Período de avaliação expirado')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Ver planos/ }));
    expect(navigateMock).toHaveBeenCalledWith('/definicoes?tab=facturacao');
  });

  it('sem avaliação devolve nada', () => {
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

  it('o formato número não muda para valores em falta', () => {
    render(<KpiCard label="Nulo" value={null} />);
    render(<KpiCard label="Texto" value="—" />);
    expect(valorDe('Nulo')).toHaveTextContent(/^0$/);
    expect(valorDe('Texto')).toHaveTextContent(/^—$/);
  });

  it('a variação em euro leva o sinal antes do simbolo', () => {
    render(<KpiCard label="Neg" value={100} delta={-10} format="euro" />);
    render(<KpiCard label="Pós" value={100} delta={10} format="euro" />);
    render(<KpiCard label="Zero" value={100} delta={0} format="euro" />);
    expect(screen.getByText('-€10')).toBeInTheDocument();
    expect(screen.getByText('+€10')).toBeInTheDocument();
    expect(screen.queryByText('€-10')).not.toBeInTheDocument();
    expect(screen.getByText('€0')).toBeInTheDocument();
  });

  it('a variação em percentagem e em número mantem o formato', () => {
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
