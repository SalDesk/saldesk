/* Regras do cartao de experiencia do Discover (SalDesk Conect).
   Funcoes puras, sem DOM: usadas pela pagina (window.CartaoDiscover) e pelos
   testes em tests/website/cartao.test.js (module.exports). So mostram o que o
   operador preencheu -- nunca inventam informacao. */
(function () {
  'use strict';

  var MESES = {
    pt: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'],
    en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  };

  function texto(v) { return typeof v === 'string' ? v.trim() : ''; }

  /* A descricao da unidade e um JSON com os campos extra (ou texto simples) */
  function lerMeta(item) {
    var d = item && item.description;
    if (typeof d !== 'string' || d.charAt(0) !== '{') return {};
    try {
      var m = JSON.parse(d);
      return m && typeof m === 'object' ? m : {};
    } catch (e) {
      return {};
    }
  }

  function minutosEmTexto(min) {
    if (!(min > 0)) return null;
    if (min < 60) return Math.round(min) + ' min';
    var h = Math.floor(min / 60);
    var r = Math.round(min - h * 60);
    return r ? h + ' h ' + (r < 10 ? '0' + r : r) : h + ' h';
  }

  /* Duracao: horas da descricao (duration) ou, em falta, duration_minutes */
  function duracaoTexto(item, meta) {
    var horas = Number(meta && meta.duration);
    if (horas > 0) return minutosEmTexto(horas * 60);
    return minutosEmTexto(Number(item && item.duration_minutes));
  }

  var FORMATOS = {
    privado: { pt: 'Privado', en: 'Private' },
    grupo: { pt: 'Em grupo', en: 'Group' },
    ambos: { pt: 'Privado ou grupo', en: 'Private or group' },
  };

  function formatoTexto(meta, lang) {
    var f = FORMATOS[meta && meta.tour_type];
    return f ? f[lang === 'en' ? 'en' : 'pt'] : null;
  }

  function linguasTexto(meta) {
    var l = Array.isArray(meta && meta.languages) ? meta.languages : [];
    var vistas = [];
    l.forEach(function (x) {
      var c = texto(x).toUpperCase();
      if (c && vistas.indexOf(c) === -1) vistas.push(c);
    });
    return vistas.length ? vistas.join(', ') : null;
  }

  /* O que inclui: objectos { label, included } marcados como incluidos e textos simples */
  function incluidosTexto(meta, max) {
    var n = max || 3;
    var itens = Array.isArray(meta && meta.included_items) ? meta.included_items : [];
    var out = [];
    itens.forEach(function (i) {
      var t = '';
      if (typeof i === 'string') t = texto(i);
      else if (i && typeof i === 'object' && i.included === true) t = texto(i.label);
      if (t) out.push(t);
    });
    return out.length ? out.slice(0, n).join(' · ') : null;
  }

  /* Mesma prioridade do servidor (displayPrice): por pessoa > escalao mais
     barato > preco privado. Escaloes e privado sao o total do grupo. */
  function precoCartao(item, meta) {
    var base = Number(item && item.base_price);
    if (base > 0) return { valor: base, unidade: 'pessoa' };
    var tiers = Array.isArray(meta && meta.price_tiers) ? meta.price_tiers : [];
    var precos = tiers.map(function (t) { return Number(t && t.price); }).filter(function (p) { return p > 0; });
    if (precos.length) return { valor: Math.min.apply(null, precos), unidade: 'grupo' };
    var priv = Number(meta && meta.price_private);
    if (priv > 0) return { valor: priv, unidade: 'grupo' };
    return null;
  }

  function precoCrianca(meta) {
    var c = Number(meta && meta.price_child);
    return c > 0 ? c : null;
  }

  /* Conversao igual a fmtPrice da pagina (1 EUR = taxa CVE) */
  function formatarPreco(valor, moedaOperador, moedaVista, taxa) {
    var t = taxa || 110;
    if (moedaVista === 'CVE') {
      var cve = moedaOperador === 'CVE' ? valor : valor * t;
      return Math.round(cve).toLocaleString('pt-PT') + ' CVE';
    }
    var eur = moedaOperador === 'CVE' ? valor / t : valor;
    return '€' + (eur < 10 ? eur.toFixed(1) : Math.round(eur));
  }

  function tituloCartao(item, meta, lang) {
    var en = texto(meta && meta.name_en);
    if (lang === 'en' && en) return en;
    return (item && item.unit_name) || '';
  }

  /* Reservas dos ultimos 30 dias (recent_bookings da API) */
  function sinalProcura(item, lang) {
    var n = Number(item && item.recent_bookings);
    if (!(n >= 1)) return null;
    if (lang === 'en') return n === 1 ? 'Booked once in the last month' : 'Booked ' + n + ' times in the last month';
    return n === 1 ? 'Reservado 1 vez no último mês' : 'Reservado ' + n + ' vezes no último mês';
  }

  function hojeCaboVerde(agora) {
    return (agora || new Date()).toLocaleDateString('en-CA', { timeZone: 'Atlantic/Cape_Verde' });
  }

  /* So quando a proxima data livre nao e hoje: "disponivel hoje" em todos nao informa */
  function proximaData(item, hoje, lang) {
    var d = item && item.next_available;
    if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d) || !(d > hoje)) return null;
    var dia = Number(d.slice(8, 10));
    var mes = MESES[lang === 'en' ? 'en' : 'pt'][Number(d.slice(5, 7)) - 1];
    return (lang === 'en' ? 'Next date: ' : 'Próxima data: ') + dia + ' ' + mes;
  }

  /* Miniatura oficial da Wikimedia em vez do original (fotos de varios MB). So larguras
     normalizadas da Wikimedia funcionam (330, 500, 960...): outras dao erro 400. */
  var WIKI = /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/([0-9a-f])\/([0-9a-f]{2})\/([^/?#]+)$/;
  function miniaturaWikimedia(url, largura) {
    var m = typeof url === 'string' ? url.match(WIKI) : null;
    if (!m) return url;
    var w = largura || 500;
    return 'https://upload.wikimedia.org/wikipedia/commons/thumb/' + m[1] + '/' + m[2] + '/' + m[3] + '/' + w + 'px-' + m[3];
  }

  function iniciais(nome) {
    var palavras = texto(nome).split(/\s+/).filter(function (p) { return /^\p{L}/u.test(p); });
    return palavras.slice(0, 2).map(function (p) { return p.charAt(0).toUpperCase(); }).join('');
  }

  function ilhasDosItens(itens) {
    var cont = {};
    (Array.isArray(itens) ? itens : []).forEach(function (i) {
      var n = texto(i && i.island_name);
      if (n) cont[n] = (cont[n] || 0) + 1;
    });
    return Object.keys(cont)
      .map(function (nome) { return { nome: nome, n: cont[nome] }; })
      .sort(function (a, b) { return b.n - a.n || a.nome.localeCompare(b.nome, 'pt'); });
  }

  var api = {
    lerMeta: lerMeta,
    duracaoTexto: duracaoTexto,
    formatoTexto: formatoTexto,
    linguasTexto: linguasTexto,
    incluidosTexto: incluidosTexto,
    precoCartao: precoCartao,
    precoCrianca: precoCrianca,
    formatarPreco: formatarPreco,
    tituloCartao: tituloCartao,
    sinalProcura: sinalProcura,
    hojeCaboVerde: hojeCaboVerde,
    proximaData: proximaData,
    miniaturaWikimedia: miniaturaWikimedia,
    iniciais: iniciais,
    ilhasDosItens: ilhasDosItens,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.CartaoDiscover = api;
})();
