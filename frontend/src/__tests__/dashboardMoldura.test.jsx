/* Componentes da moldura nova do dashboard: agenda do dia, cartao de destaque, numeros, atalhos, 7 dias. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import useUiStore from '../store/uiStore';
import DayAgenda from '../components/dashboard/DayAgenda';
import HeroCard from '../components/dashboard/HeroCard';
import StatTiles from '../components/dashboard/StatTiles';
import Shortcuts from '../components/dashboard/Shortcuts';
import NextDaysStrip from '../components/dashboard/NextDaysStrip';

const navigateMock = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => navigateMock,
}));

const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };
const HEX = /#[0-9A-Fa-f]{3,8}(?![0-9A-Za-z])/;
const NOMEADAS = /(?:text|bg|border|fill|ring|from|to)-(?:green|yellow|blue|red|amber)-\d/;
const montar = (ui) => render(<MemoryRouter future={FUTURE}>{ui}</MemoryRouter>);

function evento(over) {
  return {
    id: 'e', inicio: '09:00', inicioMin: 540, fimMin: 660, titulo: 'Buggy', local: '', pessoas: 1,
    capacidade: null, pendentes: 0, guias: [], clientes: [], ...over,
  };
}

beforeEach(() => {
  navigateMock.mockReset();
  useUiStore.setState({ lang: 'pt' });
});

describe('DayAgenda', () => {
  it('agenda_mostra_sem_hora_no_topo_e_os_eventos_por_hora', () => {
    const { container } = montar(<DayAgenda agoraMin={0} onAbrir={() => {}} vazio={null} eventos={[
      evento({ id: 'k', titulo: 'Kite', inicio: null, inicioMin: null, fimMin: null }),
      evento({ id: 'm', titulo: 'Mergulho', inicio: '14:00', inicioMin: 840, fimMin: 900 }),
      evento({ id: 'b', titulo: 'Buggy' }),
    ]} />);
    const texto = container.textContent;
    const pos = ['Sem hora marcada', 'Kite', 'Buggy', 'Mergulho'].map((t) => texto.indexOf(t));
    expect(pos.every((p) => p >= 0)).toBe(true);
    expect([...pos].sort((a, b) => a - b)).toEqual(pos);
  });

  it('sem_eventos_sem_hora_nao_mostra_o_grupo', () => {
    montar(<DayAgenda agoraMin={0} onAbrir={() => {}} vazio={null} eventos={[evento({})]} />);
    expect(screen.queryByText('Sem hora marcada')).toBeNull();
  });

  it('evento_a_decorrer_tem_estado_iniciais_e_hora_de_fim', () => {
    montar(<DayAgenda agoraMin={600} onAbrir={() => {}} vazio={null} eventos={[
      evento({ clientes: ['Ana Silva', 'Joao Lima', 'Maria Sousa', 'Rui Costa'] }),
    ]} />);
    const botao = screen.getByRole('button', { name: /Buggy/ });
    expect(botao).toHaveAttribute('data-estado', 'a_decorrer');
    expect(botao).toHaveTextContent('A decorrer, termina às 11:00');
    ['AS', 'JL', 'MS', '+1'].forEach((i) => expect(within(botao).getByText(i)).toBeInTheDocument());
  });

  it('evento_concluido_e_esbatido', () => {
    montar(<DayAgenda agoraMin={700} onAbrir={() => {}} vazio={null} eventos={[evento({})]} />);
    const botao = screen.getByRole('button', { name: /Buggy/ });
    expect(botao).toHaveAttribute('data-estado', 'concluido');
    expect(botao).toHaveTextContent('Concluído');
  });

  it('pilulas_por_confirmar_e_quase_cheio', () => {
    montar(<DayAgenda agoraMin={0} onAbrir={() => {}} vazio={null} eventos={[
      evento({ id: 'a', titulo: 'Kite', pendentes: 2, pessoas: 3, capacidade: 6 }),
      evento({ id: 'b', titulo: 'Por do sol', pessoas: 18, capacidade: 20 }),
    ]} />);
    expect(screen.getByRole('button', { name: /Kite/ })).toHaveTextContent('2 por confirmar');
    const cheio = screen.getByRole('button', { name: /Por do sol/ });
    expect(cheio).toHaveTextContent('Quase cheio');
    expect(within(cheio).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '90');
  });

  it('linha_secundaria_com_lotacao_guia_e_local', () => {
    montar(<DayAgenda agoraMin={0} onAbrir={() => {}} vazio={null} eventos={[
      evento({ pessoas: 12, capacidade: 16, guias: ['Djo', 'Kiko'], local: 'Santa Maria' }),
    ]} />);
    expect(screen.getByText('12/16 · guia Djo +1 · Santa Maria')).toBeInTheDocument();
  });

  it('linha_secundaria_omite_partes_vazias', () => {
    montar(<DayAgenda agoraMin={0} onAbrir={() => {}} vazio={null} eventos={[evento({ pessoas: 3 })]} />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('a_lotacao_nunca_passa_dos_100', () => {
    montar(<DayAgenda agoraMin={0} onAbrir={() => {}} vazio={null} eventos={[evento({ pessoas: 30, capacidade: 10 })]} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  it('detalhe_proprio_substitui_a_linha_composta', () => {
    montar(<DayAgenda agoraMin={0} onAbrir={() => {}} vazio={null} eventos={[
      evento({ titulo: 'Chegada · Ana', detalhe: 'Suite 12 · 2 pessoa(s)', pessoas: 2, capacidade: null, local: 'X' }),
    ]} />);
    expect(screen.getByText('Suite 12 · 2 pessoa(s)')).toBeInTheDocument();
    expect(screen.queryByText(/· X/)).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('resumo_proprio_no_cabecalho', () => {
    montar(<DayAgenda agoraMin={0} onAbrir={() => {}} vazio={null} resumo="2 chegadas · 1 partidas" eventos={[evento({})]} />);
    expect(screen.getByText('2 chegadas · 1 partidas')).toBeInTheDocument();
    expect(screen.queryByText(/tours/)).toBeNull();
  });

  it('clicar_num_evento_chama_onAbrir', () => {
    const onAbrir = vi.fn();
    const e = evento({});
    montar(<DayAgenda agoraMin={0} onAbrir={onAbrir} vazio={null} eventos={[e]} />);
    fireEvent.click(screen.getByRole('button', { name: /Buggy/ }));
    expect(onAbrir).toHaveBeenCalledWith(e);
  });

  it('agenda_vazia_mostra_o_conteudo_vazio', () => {
    montar(<DayAgenda agoraMin={0} onAbrir={() => {}} vazio={<p>Nada hoje</p>} eventos={[]} />);
    expect(screen.getByText('Nada hoje')).toBeInTheDocument();
  });
});

describe('HeroCard', () => {
  const base = { receita: 8420, variacao: 12, serie: [0, 100, 300], ocupacao: 71, volume: '212 participantes', hojeValor: '39 pessoas', hojeDetalhe: 'em 4 tours · 2 por confirmar', mesNome: 'novembro' };

  it('hero_formata_receita_e_variacao', () => {
    montar(<HeroCard {...base} />);
    expect(screen.getByText(`€${(8420).toLocaleString('pt-PT')}`)).toBeInTheDocument();
    expect(screen.getByText('+12% vs mês anterior')).toBeInTheDocument();
    expect(screen.getByText('Receita de novembro')).toBeInTheDocument();
    expect(screen.getByText('39 pessoas')).toBeInTheDocument();
    expect(screen.getByText('212 participantes')).toBeInTheDocument();
  });

  it('variacao_negativa_sem_mais', () => {
    montar(<HeroCard {...base} variacao={-5} />);
    expect(screen.getByText('-5% vs mês anterior')).toBeInTheDocument();
  });

  it('sem_mes_anterior_sem_pilula', () => {
    montar(<HeroCard {...base} variacao={null} />);
    expect(screen.queryByText(/vs mês anterior/)).toBeNull();
  });

  it('hero_rotulo_do_anel_proprio', () => {
    montar(<HeroCard {...base} rotuloOcupacao="Ocupação hoje" />);
    expect(screen.getByText('Ocupação hoje')).toBeInTheDocument();
    expect(screen.queryByText('Ocupação do mês')).toBeNull();
  });

  it('anel_limita_a_ocupacao', () => {
    montar(<HeroCard {...base} ocupacao={140} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('serie_vazia_ou_de_um_ponto_nao_rebenta', () => {
    const { container, rerender } = montar(<HeroCard {...base} serie={[]} />);
    expect(container.querySelector('svg path')).not.toBeNull();
    rerender(<MemoryRouter future={FUTURE}><HeroCard {...base} serie={[5]} /></MemoryRouter>);
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
  });
});

describe('StatTiles, Shortcuts e NextDaysStrip', () => {
  it('numeros_com_etiqueta_e_valor', () => {
    montar(<StatTiles tiles={[{ id: 'r', icon: BookOpen, label: 'Reservas no mês', value: '64', tone: 'ocean' }]} />);
    expect(screen.getByText('Reservas no mês')).toBeInTheDocument();
    expect(screen.getByText('64')).toBeInTheDocument();
  });

  it('atalhos_levam_aos_ecras', () => {
    montar(<Shortcuts />);
    [['Check-in', '/reservas'], ['Bloquear dia', '/calendario'], ['Enviar mensagem', '/mensagens'], ['Registar pagamento', '/financeiro']]
      .forEach(([nome, rota]) => {
        fireEvent.click(screen.getByRole('button', { name: nome }));
        expect(navigateMock).toHaveBeenLastCalledWith(rota);
      });
  });

  it('sete_dias_contagem_so_quando_ha_reservas_e_hoje_destacado', () => {
    const dias = ['2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26'];
    const onAbrir = vi.fn();
    montar(<NextDaysStrip dias={dias} contagens={{ '2026-11-20': 4, '2026-11-21': 6 }} hoje="2026-11-20" lang="pt" onAbrir={onAbrir} />);
    const botoes = screen.getAllByRole('button');
    expect(botoes).toHaveLength(7);
    expect(botoes[0]).toHaveAttribute('aria-current', 'date');
    expect(botoes[0]).toHaveTextContent('Sex');
    expect(botoes[0]).toHaveTextContent('4');
    expect(botoes[3].textContent).toBe('Seg23');
    fireEvent.click(botoes[2]);
    expect(onAbrir).toHaveBeenCalled();
  });

  it('sem_cores_hexadecimais_ou_nomeadas', () => {
    const { container } = montar(<>
      <DayAgenda agoraMin={600} onAbrir={() => {}} vazio={null} eventos={[evento({ pessoas: 18, capacidade: 20, pendentes: 1, clientes: ['Ana Silva'] }), evento({ id: 'z', titulo: 'Z', inicio: null, inicioMin: null, fimMin: null })]} />
      <HeroCard receita={1} variacao={3} serie={[1, 2]} ocupacao={50} volume="v" hojeValor="h" hojeDetalhe="d" mesNome="novembro" />
      <StatTiles tiles={['ocean', 'sand', 'success', 'warning'].map((tone) => ({ id: tone, icon: BookOpen, label: tone, value: '1', tone }))} />
      <Shortcuts />
      <NextDaysStrip dias={['2026-11-20']} contagens={{ '2026-11-20': 1 }} hoje="2026-11-20" lang="pt" onAbrir={() => {}} />
    </>);
    expect(container.innerHTML).not.toMatch(HEX);
    expect(container.innerHTML).not.toMatch(NOMEADAS);
  });
});
