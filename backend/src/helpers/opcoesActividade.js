/* Opcoes de actividade (variantes), suplemento de idioma do guia e ofertas automaticas.
   Funcoes puras sobre o meta da unidade (JSON em units.description). Os precos usam a
   moeda do operador, como o resto do preco da actividade. */

const TIPOS_OPCAO = ['per_person', 'per_group', 'per_vehicle'];
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;

function vazio(v) {
  return v === undefined || v === null || v === '';
}

// Opcoes validas (tipo conhecido, preco > 0, lugares >= 1 por veiculo), com numeros coagidos.
function opcoesDaActividade(meta) {
  const lista = Array.isArray(meta?.options) ? meta.options : [];
  const validas = [];
  for (const o of lista) {
    if (!o || !TIPOS_OPCAO.includes(o.type)) continue;
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

function opcaoEscolhida(meta, optionId) {
  if (vazio(optionId)) return null;
  return opcoesDaActividade(meta).find((o) => !vazio(o.id) && String(o.id) === String(optionId)) || null;
}

function opcaoMaisBarata(meta) {
  let melhor = null;
  for (const o of opcoesDaActividade(meta)) {
    if (!melhor || o.price < melhor.price) melhor = o;
  }
  return melhor;
}

/* Veiculos: minimo ceil(pessoas / lugares), maximo uma pessoa por veiculo. O pedido do
   browser e sempre corrigido para dentro desses limites; sem pedido fica o minimo. */
function limitarVeiculos(seats, pessoas, pedido) {
  const lugares = Math.max(1, Math.floor(Number(seats)) || 1);
  const n = Math.max(0, Math.floor(Number(pessoas)) || 0);
  const minimo = Math.ceil(n / lugares);
  const p = Math.floor(Number(pedido));
  if (vazio(pedido) || !Number.isFinite(p)) return minimo;
  return Math.min(n, Math.max(minimo, p));
}

function suplementoIdioma(meta, codigo) {
  if (vazio(codigo)) return 0;
  const tabela = meta?.language_surcharges && typeof meta.language_surcharges === 'object' ? meta.language_surcharges : {};
  const chave = Object.keys(tabela).find((k) => k.toUpperCase() === String(codigo).toUpperCase());
  const v = chave === undefined ? 0 : Number(tabela[chave]);
  return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : 0;
}

/* Idioma do guia que conta para o preco. Vazio ou um codigo que a actividade nao oferece
   valem "sem preferencia" (gratis). Se a actividade so oferece uma lingua e essa lingua
   tem suplemento, essa lingua e o padrao (o preco nunca fica escondido). */
function idiomaEfectivo(meta, codigo) {
  const linguas = Array.isArray(meta?.languages) ? meta.languages.filter((l) => !vazio(l)).map(String) : [];
  if (!vazio(codigo)) {
    const oferecida = linguas.find((l) => l.toUpperCase() === String(codigo).toUpperCase());
    if (oferecida) return oferecida;
  }
  if (linguas.length === 1 && suplementoIdioma(meta, linguas[0]) > 0) return linguas[0];
  return null;
}

// Ofertas validas: percentagem inteira 1..90, datas YYYY-MM-DD com from <= to.
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

// Oferta que se aplica a uma data (from/to inclusivos); com varias, ganha a maior percentagem.
function melhorOferta(meta, date) {
  if (typeof date !== 'string' || !DATA_RE.test(date)) return null;
  let melhor = null;
  for (const o of ofertasValidas(meta)) {
    if (date < o.from || date > o.to) continue;
    if (!melhor || o.percent > melhor.percent) melhor = o;
  }
  return melhor;
}

/* Oferta a anunciar hoje (hora de Cabo Verde): entre as que acabam hoje ou mais tarde,
   a que acaba primeiro. Sem `hoje`, usa o dia de hoje em Cabo Verde. */
function ofertaActual(meta, hoje) {
  // require tardio: bookingHelpers tambem usa este modulo
  const dia = vazio(hoje) ? require('./bookingHelpers').hojeEHoraCaboVerde().hoje : hoje;
  let melhor = null;
  for (const o of ofertasValidas(meta)) {
    if (o.to < dia) continue;
    if (!melhor || o.to < melhor.to || (o.to === melhor.to && o.percent > melhor.percent)) melhor = o;
  }
  return melhor;
}

module.exports = {
  opcoesDaActividade, opcaoEscolhida, opcaoMaisBarata, limitarVeiculos,
  idiomaEfectivo, suplementoIdioma, melhorOferta, ofertaActual,
};
