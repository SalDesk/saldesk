import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import AgendaSaidas from '../components/dashboard/AgendaSaidas';
import useUiStore from '../store/uiStore';
import { portuguesNoEcra, chavesCruas } from './helpers/portuguesNoEcra';

/* Tres saidas num dia: buggy (com guia, ja terminou), mergulho (com guia, a decorrer), volta a ilha (sem guia, a seguir) */
const TOURS = [
  { id: 'buggy', name: 'Buggy Norte', description: JSON.stringify({ start_time: '08:30', duration: 2, meeting_point: 'Hotel Oasis' }) },
  { id: 'mergulho', name: 'Mergulho', description: JSON.stringify({ start_time: '10:00', duration: 2 }) },
  { id: 'ilha', name: 'Volta a ilha', description: JSON.stringify({ start_time: '14:00', duration: 4 }) },
];
const R = (id, unit, over) => ({ id, unit_id: unit, status: 'confirmed', guests: 2, check_in: '2026-11-25', total_price: 100, amount_paid: 100, ...over });
const RESERVAS = [
  R('b1', 'buggy', { status: 'checked_in' }),
  R('b2', 'buggy', { status: 'checked_out' }),
  R('m1', 'mergulho', { status: 'checked_in', guests: 3 }),
  R('m2', 'mergulho', { guests: 1, amount_paid: 40 }),
  R('i1', 'ilha', { guests: 4, amount_paid: 0, total_price: 330 }),
];
const evento = (id, titulo, inicio, dur, guias, local = '') => ({
  id: `${id}|${inicio}`, inicio, inicioMin: Number(inicio.slice(0, 2)) * 60 + Number(inicio.slice(3)), fimMin: Number(inicio.slice(0, 2)) * 60 + Number(inicio.slice(3)) + dur,
  titulo, local, pessoas: 99, capacidade: null, pendentes: 0, guias, clientes: [],
});
const EVENTOS = [
  evento('buggy', 'Buggy Norte', '08:30', 120, ['Carlos Lima'], 'Hotel Oasis'),
  evento('mergulho', 'Mergulho', '10:00', 120, ['Rui']),
  evento('ilha', 'Volta a ilha', '14:00', 240, []),
];

function montar(extra = {}) {
  const props = { eventos: EVENTOS, reservasHoje: RESERVAS, tours: TOURS, agoraMin: 11 * 60, onAbrirManifesto: vi.fn(), ...extra };
  render(<AgendaSaidas {...props} />);
  return props;
}

beforeEach(() => { useUiStore.setState({ lang: 'pt' }); });
afterEach(() => { cleanup(); });

describe('AgendaSaidas', () => {
  it('cada saida e um botao com hora, tour, pessoas, guia e estado', () => {
    montar();
    const botoes = screen.getAllByRole('button', { name: /Buggy|Mergulho|Volta/ });
    expect(botoes).toHaveLength(3);
    expect(botoes[0]).toHaveTextContent('08:30');
    expect(botoes[0]).toHaveTextContent('4 pessoa(s) · Carlos Lima');
    expect(botoes[0]).toHaveTextContent('Concluída');
    expect(botoes[1]).toHaveTextContent('A decorrer');
    expect(botoes[2]).toHaveTextContent('Sem guia');
    botoes.forEach((b) => expect(b).toHaveAttribute('aria-pressed'));
  });

  it('lista e detalhe so ficam lado a lado em ecras muito largos (a 1280 px os nomes ficavam cortados)', () => {
    montar();
    const lista = screen.getAllByRole('button', { name: /Buggy/ })[0].closest('ul, ol, div.grid');
    const grelha = lista.closest('.grid.grid-cols-1');
    expect(grelha.className).toContain('2xl:grid-cols-2');
    expect(grelha.className).not.toContain('lg:grid-cols-2');
  });

  it('o total de pessoas conta tambem quem ja fez check-out, nao o do evento', () => {
    montar();
    expect(screen.getByRole('button', { name: /Buggy/ })).toHaveTextContent('4 pessoa(s)');
    expect(screen.getByText('3 tours · 12 pessoas')).toBeInTheDocument();
  });

  it('uma saida futura com guia diz A seguir', () => {
    montar({ eventos: [EVENTOS[0], { ...EVENTOS[1], guias: ['Rui'], inicio: '16:00', inicioMin: 960, fimMin: 1080, id: 'mergulho|16:00' }] });
    expect(screen.getByRole('button', { name: /Mergulho/ })).toHaveTextContent('A seguir');
  });

  it('a primeira saida que nao terminou vem escolhida; clicar noutra muda o detalhe', () => {
    montar();
    const botoes = screen.getAllByRole('button', { name: /Buggy|Mergulho|Volta/ });
    expect(botoes[0]).toHaveAttribute('aria-pressed', 'false');
    expect(botoes[1]).toHaveAttribute('aria-pressed', 'true');
    const detalhe = screen.getByRole('complementary', { name: 'Detalhe da saída' });
    expect(within(detalhe).getByText('Mergulho')).toBeInTheDocument();
    fireEvent.click(botoes[2]);
    expect(botoes[2]).toHaveAttribute('aria-pressed', 'true');
    expect(botoes[1]).toHaveAttribute('aria-pressed', 'false');
    expect(within(detalhe).getByText('Volta a ilha')).toBeInTheDocument();
  });

  it('se todas terminaram fica escolhida a ultima', () => {
    montar({ agoraMin: 23 * 60 });
    const botoes = screen.getAllByRole('button', { name: /Buggy|Mergulho|Volta/ });
    expect(botoes[2]).toHaveAttribute('aria-pressed', 'true');
  });

  it('o detalhe mostra check-in com barra, guia, encontro e por receber', () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: /Buggy/ }));
    const d = screen.getByRole('complementary', { name: 'Detalhe da saída' });
    expect(d).toHaveTextContent('08:30 · 2 h');
    expect(within(d).getByText('4 / 4')).toBeInTheDocument();
    expect(within(d).getByRole('progressbar', { name: 'Check-in feito' })).toHaveAttribute('aria-valuenow', '100');
    expect(within(d).getByText('Carlos Lima')).toBeInTheDocument();
    expect(within(d).getByText('Hotel Oasis')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Volta/ }));
    expect(within(d).getByText('0 / 4')).toBeInTheDocument();
    expect(within(d).getByText('Por atribuir')).toBeInTheDocument();
    /* sem ponto de encontro, a linha nao aparece */
    expect(within(d).queryByText('Encontro')).not.toBeInTheDocument();
    expect(d).toHaveTextContent(/330/);
  });

  it('o botao do manifesto tem pelo menos 44 px, a barra diz "x de y" e a linha junta os guias', () => {
    montar({ eventos: [{ ...EVENTOS[1], guias: ['Rui', 'Ana'] }, EVENTOS[2]] });
    expect(screen.getByRole('button', { name: 'Abrir manifesto' }).className).toContain('min-h-[44px]');
    expect(screen.getByRole('progressbar', { name: 'Check-in feito' })).toHaveAttribute('aria-valuetext', '3 de 4');
    expect(screen.getByRole('button', { name: /Mergulho/ })).toHaveTextContent('Rui, Ana');
  });

  it('Abrir manifesto entrega a saida escolhida', () => {
    const props = montar();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir manifesto' }));
    expect(props.onAbrirManifesto).toHaveBeenCalledWith(EVENTOS[1]);
  });

  it('sem saidas mostra o conteudo vazio', () => {
    montar({ eventos: [], vazio: <p>Nada hoje</p> });
    expect(screen.getByText('Nada hoje')).toBeInTheDocument();
    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('em ingles mostra ingles e nenhuma chave crua', () => {
    useUiStore.setState({ lang: 'en' });
    montar();
    expect(screen.getByRole('button', { name: /Buggy/ })).toHaveTextContent('Done');
    expect(screen.getByRole('button', { name: /Volta/ })).toHaveTextContent('No guide');
    expect(screen.getByRole('button', { name: 'Open manifest' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Departure detail' })).toBeInTheDocument();
    expect(portuguesNoEcra(['Buggy Norte', 'Volta a ilha', 'Mergulho', 'Carlos Lima', 'Rui', 'Hotel Oasis'])).toEqual([]);
    expect(chavesCruas(['dashboard'])).toEqual([]);
  });
});
