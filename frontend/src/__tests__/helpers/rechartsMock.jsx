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
    notar(ch, acc);
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

/* grelha (vertical) e chaves das series: servem para verificar a linguagem dos graficos */
function notar(ch, acc) {
  const nome = ch.type && ch.type.displayName;
  if (nome === 'CartesianGrid') { acc.gridVertical = ch.props.vertical; acc.gridHorizontal = ch.props.horizontal; }
  if (ch.props.tick && ch.props.tick.fontSize) acc.tickSizes.push(ch.props.tick.fontSize);
  if (ch.props.content) acc.customTooltip = true;
  if (ch.props.contentStyle) acc.styledTooltip = true;
  if ((nome === 'Bar' || nome === 'Area') && ch.props.dataKey) acc.keys.push(ch.props.dataKey);
}

function grafico(nome) {
  return function Grafico(props) {
    const acc = { colors: [], data: null, keys: [], gridVertical: undefined, gridHorizontal: undefined, tickSizes: [], customTooltip: false, styledTooltip: false };
    olhar(props, acc);
    recolher(props.children, acc);
    return <div data-chart={nome} data-colors={JSON.stringify(acc.colors)} data-data={JSON.stringify(acc.data)} data-keys={JSON.stringify(acc.keys)} data-grid-vertical={String(acc.gridVertical)} data-grid-horizontal={String(acc.gridHorizontal)} data-tick-sizes={JSON.stringify(acc.tickSizes)} data-tooltip-custom={String(acc.customTooltip)} data-tooltip-styled={String(acc.styledTooltip)} />;
  };
}

export function makeRechartsMock() {
  const vazio = () => null;
  /* componentes com displayName: o grafico le o nome para encontrar a grelha e as series */
  const nomeado = (nome) => { const f = () => null; f.displayName = nome; return f; };
  const CartesianGrid = nomeado('CartesianGrid');
  const Bar = nomeado('Bar');
  const Area = nomeado('Area');
  return {
    ResponsiveContainer: ({ children }) => <div data-chart="container">{children}</div>,
    PieChart: grafico('pie'), BarChart: grafico('bar'), AreaChart: grafico('area'),
    Pie: vazio, Cell: vazio, Bar, Area,
    XAxis: vazio, YAxis: vazio, CartesianGrid, Tooltip: vazio, Legend: vazio,
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
