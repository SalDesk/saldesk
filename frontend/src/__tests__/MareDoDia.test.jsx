import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import MareDoDia from '../components/dashboard/MareDoDia';
import TilesTendencia from '../components/dashboard/TilesTendencia';
import Sparkline from '../components/dashboard/Sparkline';
import { curvaMare } from '../pages/dashboard/mareLogic';
import useUiStore from '../store/uiStore';
import { portuguesNoEcra, chavesCruas } from './helpers/portuguesNoEcra';

/* Tours com hora e duracao (horas) na descricao */
const TOUR_A = { id: 't1', name: 'Tour Teste', description: JSON.stringify({ start_time: '09:00', duration: 3 }) };
const TOUR_B = { id: 't2', name: 'Barco Azul', description: JSON.stringify({ start_time: '10:00', duration: 2 }) };
const res = (over) => ({ id: 'r', unit_id: 't1', status: 'confirmed', guests: 4, check_in: '2026-11-25', ...over });

/* 09-12 com 4 pessoas; 10-12 mais 6 -> pico de 10 as 10:00 e 11:00 */
const CURVA = curvaMare([res({ id: 'a' }), res({ id: 'b', unit_id: 't2', guests: 6 })], [TOUR_A, TOUR_B]);

describe('MareDoDia', () => {
  beforeEach(() => useUiStore.setState({ lang: 'pt' }));
  afterEach(cleanup);

  it('o grafico tem rotulo com o pico e o numero de agora', () => {
    render(<MareDoDia curva={CURVA} agoraMin={10 * 60 + 30} />);
    const grafico = screen.getByRole('img');
    expect(grafico.getAttribute('aria-label')).toBe(
      'Pessoas em actividade entre as 07:00 e as 20:00; pico de 10 às 10:00; agora 10.',
    );
  });

  it('mostra_pico_agora_e_saidas_com_uma_pastilha_por_saida', () => {
    render(<MareDoDia curva={CURVA} agoraMin={9 * 60 + 15} />);
    expect(screen.getByText('pico às 10:00')).toBeInTheDocument();
    expect(screen.getByText('agora, 09:15')).toBeInTheDocument();
    expect(screen.getByText('saídas hoje').previousElementSibling).toHaveTextContent('2');
    /* agora (09:15): so o tour A esta na rua, com 4 pessoas */
    expect(screen.getByText('agora, 09:15').previousElementSibling).toHaveTextContent('4');
    const pastilhas = screen.getAllByRole('listitem');
    expect(pastilhas).toHaveLength(2);
    expect(pastilhas[0]).toHaveTextContent('09:00');
    expect(pastilhas[0]).toHaveTextContent('Tour Teste');
    expect(pastilhas[1]).toHaveTextContent('10:00');
    expect(pastilhas[1]).toHaveTextContent('Barco Azul');
  });

  it('sem_reservas_mostra_o_texto_vazio_em_vez_do_grafico', () => {
    render(<MareDoDia curva={curvaMare([], [TOUR_A])} agoraMin={600} />);
    expect(screen.getByText('Sem actividades marcadas para hoje')).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByRole('listitem')).toBeNull();
  });

  it('em_ingles_mostra_ingles', () => {
    useUiStore.setState({ lang: 'en' });
    render(<MareDoDia curva={CURVA} agoraMin={9 * 60 + 15} />);
    expect(screen.getByText('Tide of the day')).toBeInTheDocument();
    expect(screen.getByText('peak at 10:00')).toBeInTheDocument();
    expect(screen.getByText('departures today')).toBeInTheDocument();
    expect(portuguesNoEcra(['Tour Teste', 'Barco Azul'])).toEqual([]);
    expect(chavesCruas(['dashboard'])).toEqual([]);
  });
});

describe('Sparkline', () => {
  it('desenha_uma_serie_constante_sem_NaN', () => {
    const { container } = render(<Sparkline valores={[3, 3, 3]} rotulo="Plano" />);
    expect(screen.getByRole('img', { name: 'Plano' })).toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(/NaN/);
  });

  it('sem_valores_nao_desenha_nada', () => {
    const { container } = render(<Sparkline valores={[]} rotulo="Vazio" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('TilesTendencia', () => {
  afterEach(cleanup);

  it('so_mostra_o_badge_quando_ha_variacao_e_a_serie_quando_existe', () => {
    render(
      <TilesTendencia
        tiles={[
          { id: 'a', label: 'Com variacao', value: '5', delta: '+2', deltaTom: 'bom', nota: 'nota a', serie: [1, 2, 5], serieRotulo: 'serie a' },
          { id: 'b', label: 'Sem variacao', value: '7', delta: null, deltaTom: null, nota: '', serie: null },
        ]}
      />,
    );
    expect(screen.getByText('+2')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'serie a' })).toBeInTheDocument();
    const segundo = screen.getByText('Sem variacao').closest('article');
    expect(within(segundo).queryByRole('img')).toBeNull();
    expect(segundo.querySelector('.font-mono')).toBeNull();
  });
});
