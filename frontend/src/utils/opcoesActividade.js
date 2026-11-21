/* Opcoes de actividade (variantes), suplemento de idioma e ofertas automaticas: ajudantes
   puros sobre o meta da actividade. Espelham o filtro do backend (helpers/opcoesActividade.js).
   O preco aqui e so uma estimativa para o operador; quem cobra e o servidor. */

const TIPOS = ['per_person', 'per_group', 'per_vehicle'];
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;
const MESES = {
  pt: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

function vazio(v) {
  return v === undefined || v === null || v === '';
}

/* Opcoes validas: tipo conhecido, preco > 0, lugares inteiros >= 1 por veiculo; numeros coagidos */
export function opcoesValidas(meta) {
  const lista = Array.isArray(meta?.options) ? meta.options : [];
  const validas = [];
  for (const o of lista) {
    if (!o || !TIPOS.includes(o.type)) continue;
    const price = Number(o.price);
    if (!Number.isFinite(price) || price <= 0) continue;
    const opcao = { ...o, price };
    if (o.type === 'per_vehicle') {
      const seats = Math.floor(Number(o.seats));
      if (!Number.isFinite(seats) || seats < 1) continue;
      opcao.seats = seats;
    } else {
      delete opcao.seats;
    }
    if (o.type === 'per_person' && !vazio(o.price_child)) {
      const pc = Number(o.price_child);
      if (Number.isFinite(pc) && pc >= 0) opcao.price_child = pc;
      else delete opcao.price_child;
    } else {
      delete opcao.price_child;
    }
    validas.push(opcao);
  }
  return validas;
}

/* Nome da opcao na lingua pedida (EN cai para PT) */
export function nomeOpcao(op, lang) {
  if (lang === 'en' && !vazio(op?.name_en)) return op.name_en;
  return op?.name_pt || '';
}

/* "por pessoa" / "por grupo" / "por veiculo (N lugares)" */
export function unidadeOpcao(op, lang) {
  const en = lang === 'en';
  if (op?.type === 'per_group') return en ? 'per group' : 'por grupo';
  if (op?.type === 'per_vehicle') {
    return en ? `per vehicle (${op.seats} seats)` : `por veículo (${op.seats} lugares)`;
  }
  return en ? 'per person' : 'por pessoa';
}

/* Veiculos: minimo ceil(pessoas / lugares), maximo uma pessoa por veiculo; sem pedido, o minimo */
export function limitarVeiculos(seats, pessoas, pedido) {
  const lugares = Math.max(1, Math.floor(Number(seats)) || 1);
  const n = Math.max(0, Math.floor(Number(pessoas)) || 0);
  const minimo = Math.ceil(n / lugares);
  const p = Math.floor(Number(pedido));
  if (vazio(pedido) || !Number.isFinite(p)) return minimo;
  return Math.min(n, Math.max(minimo, p));
}

/* Estimativa do preco de uma opcao (so para pre-visualizacao do operador) */
export function precoEstimado(op, { adults = 0, children = 0, vehicles } = {}) {
  const a = Number(adults) || 0;
  const c = Number(children) || 0;
  let total;
  if (op.type === 'per_group') {
    total = op.price;
  } else if (op.type === 'per_vehicle') {
    total = limitarVeiculos(op.seats, a + c, vehicles) * op.price;
  } else {
    total = a * op.price + c * (vazio(op.price_child) ? op.price : Number(op.price_child));
  }
  return Math.round(total * 100) / 100;
}

/* A opcao valida de menor preco, ou null */
export function opcaoMaisBarata(meta) {
  let melhor = null;
  for (const o of opcoesValidas(meta)) {
    if (!melhor || o.price < melhor.price) melhor = o;
  }
  return melhor;
}

function ofertasValidas(meta) {
  const lista = Array.isArray(meta?.offers) ? meta.offers : [];
  const validas = [];
  for (const o of lista) {
    if (!o) continue;
    const percent = Number(o.percent);
    if (!Number.isInteger(percent) || percent < 1 || percent > 90) continue;
    if (typeof o.from !== 'string' || typeof o.to !== 'string') continue;
    if (!DATA_RE.test(o.from) || !DATA_RE.test(o.to) || o.from > o.to) continue;
    validas.push({ ...o, percent });
  }
  return validas;
}

function hojeCaboVerde() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Atlantic/Cape_Verde' }).format(new Date());
}

/* Oferta a anunciar: entre as que acabam hoje ou mais tarde, a que acaba primeiro */
export function ofertaActual(meta, hoje) {
  const dia = vazio(hoje) ? hojeCaboVerde() : hoje;
  let melhor = null;
  for (const o of ofertasValidas(meta)) {
    if (o.to < dia) continue;
    if (!melhor || o.to < melhor.to || (o.to === melhor.to && o.percent > melhor.percent)) melhor = o;
  }
  return melhor;
}

/* "-25% de 1 a 15 dez" / "-25% from 1 to 15 Dec" (com os dois meses quando diferem) */
export function textoOferta(offer, lang) {
  const en = lang === 'en';
  const meses = en ? MESES.en : MESES.pt;
  const [, mf, df] = offer.from.split('-').map(Number);
  const [, mt, dt] = offer.to.split('-').map(Number);
  const inicio = mf === mt ? `${df}` : `${df} ${meses[mf - 1]}`;
  const fim = `${dt} ${meses[mt - 1]}`;
  return en
    ? `-${offer.percent}% from ${inicio} to ${fim}`
    : `-${offer.percent}% de ${inicio} a ${fim}`;
}

/* Id curto e aleatorio de uma opcao nova (fica estavel nas edicoes seguintes) */
export function novoIdOpcao() {
  return Math.random().toString(36).slice(2, 8).padEnd(6, '0')
    + Date.now().toString(36).slice(-3);
}
