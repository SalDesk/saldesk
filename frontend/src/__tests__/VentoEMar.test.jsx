import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import VentoEMar from '../components/dashboard/VentoEMar';
import useUiStore from '../store/uiStore';
import { portuguesNoEcra, chavesCruas } from './helpers/portuguesNoEcra';

/* 2026-11-25 e uma quarta-feira */
const dia = (n, over = {}) => ({
  date: `2026-11-${String(25 + n).padStart(2, '0')}`, ventoKmh: 20, ventoDirecao: 90, ...over,
});
const CINCO = [dia(0), dia(1), dia(2), dia(3), dia(4)];

beforeEach(() => useUiStore.setState({ lang: 'pt' }));

describe('VentoEMar', () => {
  it('mostra cinco linhas com o dia da semana, km/h e a seta rodada', () => {
    render(<VentoEMar dias={CINCO} estado="ok" />);
    const linhas = screen.getAllByRole('listitem');
    expect(linhas).toHaveLength(5);
    /* o Intl devolve 'quarta' ou 'qua.' conforme a versao do ICU */
    expect(within(linhas[0]).getByText(/^qua/)).toBeInTheDocument();
    expect(within(linhas[0]).getByText('20 km/h')).toBeInTheDocument();
    /* vento de leste (90 graus) sopra para oeste: a seta (norte por omissao) roda 270 graus */
    const seta = within(linhas[0]).getByRole('img', { name: 'Vento de E' });
    expect(seta.querySelector('svg').style.transform).toBe('rotate(270deg)');
  });

  it('o vento de norte aponta a seta para sul', () => {
    render(<VentoEMar dias={[dia(0, { ventoDirecao: 0 })]} estado="ok" />);
    expect(screen.getByRole('img', { name: 'Vento de N' }).querySelector('svg').style.transform).toBe('rotate(180deg)');
  });

  it('o ponto cardeal sai em portugues com O para oeste', () => {
    render(<VentoEMar dias={[dia(0, { ventoDirecao: 270 }), dia(1, { ventoDirecao: 225 })]} estado="ok" />);
    expect(screen.getByRole('img', { name: 'Vento de O' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Vento de SO' })).toBeInTheDocument();
  });

  it('so avisa quando algum dia chega aos 35 km/h', () => {
    const { rerender } = render(<VentoEMar dias={[...CINCO.slice(0, 4), dia(4, { ventoKmh: 34 })]} estado="ok" />);
    expect(screen.queryByText(/Considere reagendar/)).not.toBeInTheDocument();
    rerender(<VentoEMar dias={[...CINCO.slice(0, 4), dia(4, { ventoKmh: 35 })]} estado="ok" />);
    expect(screen.getByText(/domingo: vento de até 35 km\/h/)).toBeInTheDocument();
  });

  it('o aviso fala do dia com mais vento', () => {
    render(<VentoEMar dias={[dia(0, { ventoKmh: 36 }), dia(1, { ventoKmh: 41 })]} estado="ok" />);
    expect(screen.getByText(/quinta-feira: vento de até 41 km\/h/)).toBeInTheDocument();
  });

  it('com erro mostra uma mensagem no cartao', () => {
    render(<VentoEMar dias={[]} estado="erro" />);
    expect(screen.getByRole('heading', { name: 'Vento e mar' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Não foi possível carregar a previsão do vento.');
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('vazio e a carregar tem texto proprio', () => {
    const { rerender } = render(<VentoEMar dias={[]} estado="vazio" />);
    expect(screen.getByText('Sem previsão de vento disponível.')).toBeInTheDocument();
    rerender(<VentoEMar dias={[]} estado="a_carregar" />);
    expect(screen.getByText(/A carregar a previsão do vento/)).toBeInTheDocument();
  });

  it('dia sem vento conhecido nao inventa numeros nem seta', () => {
    render(<VentoEMar dias={[dia(0, { ventoKmh: null, ventoDirecao: null })]} estado="ok" />);
    expect(screen.getByText('–')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('em ingles tudo sai em ingles, com os dias da semana e os pontos cardeais ingleses', () => {
    useUiStore.setState({ lang: 'en' });
    render(<VentoEMar dias={[dia(0, { ventoDirecao: 225, ventoKmh: 40 }), dia(1)]} estado="ok" />);
    expect(screen.getByRole('heading', { name: 'Wind and sea' })).toBeInTheDocument();
    expect(screen.getByText('Wed')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Wind from SW' })).toBeInTheDocument();
    expect(screen.getByText('Wednesday: wind up to 40 km/h. Consider rescheduling sea activities.')).toBeInTheDocument();
    expect(portuguesNoEcra()).toEqual([]);
    expect(chavesCruas(['dashboard'])).toEqual([]);
  });
});
