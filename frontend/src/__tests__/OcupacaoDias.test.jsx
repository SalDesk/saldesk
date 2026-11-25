import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import OcupacaoDias from '../components/dashboard/OcupacaoDias';
import useUiStore from '../store/uiStore';
import { portuguesNoEcra, chavesCruas } from './helpers/portuguesNoEcra';

/* 14 dias a partir de quarta-feira, 25 de novembro de 2026 */
const DIAS = Array.from({ length: 14 }, (_, i) => new Date(Date.UTC(2026, 10, 25 + i)).toISOString().slice(0, 10));

const celulas = (valores, capacidade = 10) => DIAS.map((data, i) => {
  const pessoas = valores[i] ?? 0;
  return { data, pessoas, capacidade, pct: capacidade === null ? null : Math.round((pessoas / capacidade) * 100) };
});

const LINHAS = [
  { tourId: 'a', nome: 'Buggy', celulas: celulas([7, 0, 12, 3]) },
  { tourId: 'b', nome: 'Mergulho', celulas: celulas([4, 4, 0], null) },
];

beforeEach(() => useUiStore.setState({ lang: 'pt' }));

describe('OcupacaoDias (mapa de 14 dias)', () => {
  it('e uma tabela com legenda, uma linha por servico e catorze colunas de dias', () => {
    render(<OcupacaoDias linhas={LINHAS} dias={DIAS} />);
    const tabela = screen.getByRole('table', { name: 'Percentagem de lugares vendidos por serviço e por dia' });
    expect(within(tabela).getAllByRole('row')).toHaveLength(3);
    expect(within(tabela).getAllByRole('columnheader')).toHaveLength(15);
    expect(within(tabela).getByRole('rowheader', { name: 'Buggy' })).toBeInTheDocument();
    expect(within(tabela).getByRole('rowheader', { name: 'Mergulho' })).toBeInTheDocument();
    /* a tabela fica numa caixa com scroll horizontal */
    expect(tabela.parentElement.className).toContain('overflow-x-auto');
  });

  it('cada celula mostra a percentagem; sem lotacao mostra o numero de pessoas em cinzento', () => {
    render(<OcupacaoDias linhas={LINHAS} dias={DIAS} />);
    const buggy = screen.getByRole('row', { name: /Buggy/ });
    expect(within(buggy).getByText('70%')).toBeInTheDocument();
    expect(within(buggy).getByText('30%')).toBeInTheDocument();
    const mergulho = screen.getByRole('row', { name: /Mergulho/ });
    const quatro = within(mergulho).getAllByText('4');
    expect(quatro).toHaveLength(2);
    expect(quatro[0].className).toContain('bg-n-100');
    expect(within(mergulho).queryByText(/%/)).not.toBeInTheDocument();
  });

  it('o overbooking mostra o numero real mas usa o degrau mais escuro', () => {
    render(<OcupacaoDias linhas={LINHAS} dias={DIAS} />);
    expect(screen.getByText('120%').className).toContain('bg-ocean-700');
    expect(screen.getByText('70%').className).toContain('bg-ocean-400');
    expect(screen.getByText('30%').className).toContain('bg-ocean-200');
  });

  it('tem legenda vazio/cheio e so mostra a cinzenta quando ha celulas sem lotacao', () => {
    const { rerender } = render(<OcupacaoDias linhas={LINHAS} dias={DIAS} />);
    const legenda = screen.getByTestId('ocupacao-legenda');
    expect(legenda).toHaveTextContent('Vazio');
    expect(legenda).toHaveTextContent('Cheio');
    expect(legenda).toHaveTextContent('Sem lotação definida');
    rerender(<OcupacaoDias linhas={[LINHAS[0]]} dias={DIAS} />);
    expect(screen.getByTestId('ocupacao-legenda')).not.toHaveTextContent('Sem lotação definida');
  });

  it('o fim de semana tem a etiqueta do dia mais escura', () => {
    render(<OcupacaoDias linhas={LINHAS} dias={DIAS} />);
    const cabecalhos = screen.getAllByRole('columnheader').slice(1);
    /* quarta 25 ... sabado 28 e domingo 29 */
    expect(cabecalhos[0].className).toContain('text-n-500');
    expect(cabecalhos[3].className).toContain('text-n-900');
    expect(cabecalhos[4].className).toContain('text-n-900');
    expect(cabecalhos[5].className).toContain('text-n-500');
  });

  it('o cabecalho do dia le-se com o dia da semana por extenso e o numero', () => {
    render(<OcupacaoDias linhas={LINHAS} dias={DIAS} />);
    expect(screen.getAllByRole('columnheader')[1]).toHaveAccessibleName('quarta-feira, 25');
  });

  it('sem servicos activos diz-o em vez de mostrar uma tabela vazia', () => {
    render(<OcupacaoDias linhas={[]} dias={DIAS} />);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText('Sem serviços activos.')).toBeInTheDocument();
  });

  it('em ingles a tabela, a legenda e os dias da semana saem em ingles', () => {
    useUiStore.setState({ lang: 'en' });
    render(<OcupacaoDias linhas={LINHAS} dias={DIAS} />);
    expect(screen.getByRole('table', { name: 'Percentage of seats sold per service and day' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Occupancy for the next 14 days' })).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader')[1]).toHaveTextContent('Wed');
    expect(portuguesNoEcra(['Buggy', 'Mergulho'])).toEqual([]);
    expect(chavesCruas(['dashboard'])).toEqual([]);
  });
});

describe('OcupacaoDias compacto (proximos 7 dias)', () => {
  it('mostra sete barras com a etiqueta do dia da semana, todos os servicos juntos', () => {
    render(<OcupacaoDias compacto linhas={LINHAS} dias={DIAS.slice(0, 7)} />);
    expect(screen.getByRole('heading', { name: 'Próximos 7 dias' })).toBeInTheDocument();
    const barras = screen.getAllByRole('img');
    expect(barras).toHaveLength(7);
    /* quarta: 7 + 4 pessoas; quinta: 0 + 4 */
    expect(barras[0].getAttribute('aria-label')).toMatch(/^qua\S*: 11 pessoa\(s\)$/);
    expect(barras[1].getAttribute('aria-label')).toMatch(/^qui\S*: 4 pessoa\(s\)$/);
    /* o Intl devolve 'quarta' ou 'qua.' conforme a versao do ICU */
    ['qua', 'qui', 'sex', 's[aá]b', 'dom', 'seg', 'ter'].forEach((d) => expect(screen.getByText(new RegExp(`^${d}`))).toBeInTheDocument());
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('em ingles as etiquetas sao inglesas', () => {
    useUiStore.setState({ lang: 'en' });
    render(<OcupacaoDias compacto linhas={LINHAS} dias={DIAS.slice(0, 7)} />);
    expect(screen.getByRole('heading', { name: 'Next 7 days' })).toBeInTheDocument();
    ['Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue'].forEach((d) => expect(screen.getByText(d)).toBeInTheDocument());
    expect(portuguesNoEcra()).toEqual([]);
  });
});

describe('OcupacaoDias compacto: servicos com e sem lotacao (revisao final)', () => {
  beforeEach(() => useUiStore.setState({ lang: 'pt' }));

  const altura = (barra) => barra.firstElementChild.style.height;

  it('a_barra_so_conta_os_servicos_com_lotacao', () => {
    /* A: lotacao 10 com 5 pessoas; B: sem lotacao com 20 pessoas -> a barra e 50%, nao 100% */
    const linhas = [
      { tourId: 'a', nome: 'A', celulas: celulas([5], 10) },
      { tourId: 'b', nome: 'B', celulas: celulas([20], null) },
    ];
    render(<OcupacaoDias compacto linhas={linhas} dias={DIAS.slice(0, 7)} />);
    const barra = screen.getAllByRole('img')[0];
    expect(altura(barra)).toBe('50%');
    expect(barra.firstElementChild.className).toContain('bg-ocean-400');
    /* o numero de pessoas no rotulo continua a ser o total */
    expect(barra.getAttribute('aria-label')).toMatch(/: 25 pessoa\(s\)$/);
  });

  it('sem_nenhuma_lotacao_a_barra_e_relativa_e_neutra_sem_percentagem', () => {
    const linhas = [{ tourId: 'b', nome: 'B', celulas: celulas([20, 10], null) }];
    render(<OcupacaoDias compacto linhas={linhas} dias={DIAS.slice(0, 7)} />);
    const barras = screen.getAllByRole('img');
    expect(altura(barras[0])).toBe('100%');
    expect(altura(barras[1])).toBe('50%');
    expect(barras[0].firstElementChild.className).toContain('bg-ocean-400');
    expect(screen.queryByText(/%/)).toBeNull();
  });
});

describe('OcupacaoDias: erro e lista cortada (revisao final)', () => {
  beforeEach(() => useUiStore.setState({ lang: 'pt' }));

  it('com_erro_mostra_o_erro_e_nao_o_vazio', () => {
    render(<OcupacaoDias linhas={[]} dias={DIAS} erro="Falhou" />);
    expect(screen.getByText('Falhou')).toBeInTheDocument();
    expect(screen.queryByText('Sem serviços activos.')).toBeNull();
  });

  it('cortada_esconde_as_percentagens', () => {
    render(<OcupacaoDias linhas={LINHAS} dias={DIAS} cortada />);
    expect(screen.getByText(/Lista possivelmente incompleta/)).toBeInTheDocument();
    expect(screen.getByRole('table').textContent).not.toMatch(/%/);
  });
});
