/* Simulacao do recharts para os testes: o ResponsiveContainer real nao desenha nada no jsdom.
   Cada grafico desenha <div data-chart data-colors data-data>: data-colors e a lista de todas as
   cores (fill, stroke, stopColor, tick, cursor, contentStyle.border, ...) dadas aos filhos e
   data-data os dados (props "data" do grafico ou da serie). Uso:
   vi.mock('recharts', async () => (await import('./helpers/rechartsMock')).makeRechartsMock()); */
import React from 'react';

function ignorar(v) {
  return typeof v !== 'string' || v.startsWith('url(') || v === 'none' || v === 'transparent';
}

function recolher(children, acc) {
  React.Children.forEach(children, (ch) => {
    if (!ch || typeof ch !== 'object' || !ch.props) return;
    olhar(ch.props, acc);
    recolher(ch.props.children, acc);
  });
}

function olhar(p, acc) {
  const candidatos = [
    p.fill, p.stroke, p.stopColor,
    p.tick && p.tick.fill, p.cursor && p.cursor.fill, p.cursor && p.cursor.stroke,
    p.activeDot && p.activeDot.fill, p.contentStyle && p.contentStyle.border,
  ];
  for (const v of candidatos) if (!ignorar(v)) acc.colors.push(v);
  if (p.data && acc.data == null) acc.data = p.data;
}

function grafico(nome) {
  return function Grafico(props) {
    const acc = { colors: [], data: null };
    olhar(props, acc);
    recolher(props.children, acc);
    return <div data-chart={nome} data-colors={JSON.stringify(acc.colors)} data-data={JSON.stringify(acc.data)} />;
  };
}

export function makeRechartsMock() {
  const vazio = () => null;
  return {
    ResponsiveContainer: ({ children }) => <div data-chart="container">{children}</div>,
    PieChart: grafico('pie'), BarChart: grafico('bar'), AreaChart: grafico('area'),
    Pie: vazio, Cell: vazio, Bar: vazio, Area: vazio,
    XAxis: vazio, YAxis: vazio, CartesianGrid: vazio, Tooltip: vazio, Legend: vazio,
  };
}

/* todas as cores dadas aos graficos desenhados */
export function coresDosGraficos(root = document) {
  return [...root.querySelectorAll('[data-chart][data-colors]')].flatMap(el => JSON.parse(el.getAttribute('data-colors')));
}
/* os dados do primeiro grafico do tipo dado */
export function dadosDoGrafico(nome, root = document) {
  const el = root.querySelector(`[data-chart="${nome}"][data-data]`);
  return el ? JSON.parse(el.getAttribute('data-data')) : null;
}
