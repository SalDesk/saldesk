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

  /* Itens que falam de recolha: com pickup_included ja aparecem em "Recolha no hotel".
     A recolha no aeroporto e outra coisa e fica na lista. */
  var RECOLHA = /recolha|pick[- ]?up/i;
  var AEROPORTO = /aeroporto|airport/i;

  /* O que inclui: objectos { label, included } marcados como incluidos e textos simples */
  function incluidosTexto(meta, max) {
    var n = max || 3;
    var itens = Array.isArray(meta && meta.included_items) ? meta.included_items : [];
    var semRecolha = !!(meta && meta.pickup_included === true);
    var out = [];
    itens.forEach(function (i) {
      var t = '';
      if (typeof i === 'string') t = texto(i);
      else if (i && typeof i === 'object' && i.included === true) t = texto(i.label);
      if (t && !(semRecolha && RECOLHA.test(t) && !AEROPORTO.test(t))) out.push(t);
    });
    return out.length ? out.slice(0, n).join(' · ') : null;
  }

  /* Beneficios do cartao, por esta ordem e so quando verdadeiros: prazo de cancelamento
     gratis do operador (sem prazo ou 0 = nada), confirmacao automatica do operador e
     recolha no hotel da actividade. */
  var PRAZOS = {
    24: { pt: '24 h', en: '24 h' },
    48: { pt: '48 h', en: '48 h' },
    72: { pt: '72 h', en: '72 h' },
    168: { pt: '7 dias', en: '7 days' },
  };
  function beneficiosCartao(item, meta, lang) {
    var en = lang === 'en';
    var out = [];
    var prazo = PRAZOS[item && item.free_cancellation_hours];
    if (prazo) out.push(en ? 'Free cancellation up to ' + prazo.en + ' before' : 'Cancelamento grátis até ' + prazo.pt + ' antes');
    if (item && item.auto_confirm_bookings === true) out.push(en ? 'Instant confirmation' : 'Confirmação imediata');
    if (meta && meta.pickup_included === true) out.push(en ? 'Hotel pickup' : 'Recolha no hotel');
    return out;
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

  /* ── Filtros extra do Discover (beneficios, preco, duracao) e ordenacao por preco ──
     Mesmos valores que o cartao mostra: preco "A partir de" em EUR (CVE / taxa) e duracao
     da descricao (horas) ou duration_minutes. Sem preco/duracao nunca cai numa faixa. */
  function precoEmEur(item, meta, taxa) {
    var p = precoCartao(item, meta);
    if (!p) return null;
    return item && item.currency === 'CVE' ? p.valor / (taxa || 110) : p.valor;
  }

  function faixaPreco(item, meta, taxa) {
    var eur = precoEmEur(item, meta, taxa);
    if (eur === null) return null;
    if (eur <= 50) return 'ate50';
    if (eur <= 100) return '50a100';
    return 'mais100';
  }

  function duracaoMinutos(item, meta) {
    var horas = Number(meta && meta.duration);
    if (horas > 0) return horas * 60;
    var min = Number(item && item.duration_minutes);
    return min > 0 ? min : null;
  }

  function faixaDuracao(item, meta) {
    var min = duracaoMinutos(item, meta);
    if (min === null) return null;
    if (min <= 180) return 'ate3';
    if (min <= 360) return '3a6';
    return 'mais6';
  }

  function temBeneficio(item, meta, chave) {
    if (chave === 'cancelamento') return !!PRAZOS[item && item.free_cancellation_hours];
    if (chave === 'confirmacao') return !!(item && item.auto_confirm_bookings === true);
    if (chave === 'recolha') return !!(meta && meta.pickup_included === true);
    return false;
  }

  function passaFiltrosExtra(item, meta, filtros, taxa) {
    var f = filtros || {};
    if (f.beneficio && !temBeneficio(item, meta, f.beneficio)) return false;
    if (f.preco && faixaPreco(item, meta, taxa) !== f.preco) return false;
    if (f.duracao && faixaDuracao(item, meta) !== f.duracao) return false;
    return true;
  }

  /* '' = ordem original; sem preco sempre no fim; empates mantem a ordem original */
  function ordenarPorPreco(itens, sentido, taxa) {
    var lista = Array.isArray(itens) ? itens.slice() : [];
    if (sentido !== 'asc' && sentido !== 'desc') return lista;
    var comIndice = lista.map(function (it, i) { return { it: it, i: i, p: precoEmEur(it, lerMeta(it), taxa) }; });
    comIndice.sort(function (a, b) {
      if (a.p === null && b.p === null) return a.i - b.i;
      if (a.p === null) return 1;
      if (b.p === null) return -1;
      var d = sentido === 'asc' ? a.p - b.p : b.p - a.p;
      return d || a.i - b.i;
    });
    return comIndice.map(function (x) { return x.it; });
  }

  var OPCOES = {
    beneficio: ['cancelamento', 'confirmacao', 'recolha'],
    preco: ['ate50', '50a100', 'mais100'],
    duracao: ['ate3', '3a6', 'mais6'],
  };

  /* Quantas experiencias tem cada opcao do grupo, contando so as que passam os OUTROS grupos */
  function contarOpcoes(itens, grupo, filtros, taxa) {
    var outros = {};
    var f = filtros || {};
    Object.keys(OPCOES).forEach(function (g) { outros[g] = g === grupo ? '' : (f[g] || ''); });
    var cont = {};
    (OPCOES[grupo] || []).forEach(function (k) { cont[k] = 0; });
    (Array.isArray(itens) ? itens : []).forEach(function (it) {
      var meta = lerMeta(it);
      if (!passaFiltrosExtra(it, meta, outros, taxa)) return;
      (OPCOES[grupo] || []).forEach(function (k) {
        var tem = grupo === 'beneficio' ? temBeneficio(it, meta, k)
          : grupo === 'preco' ? faixaPreco(it, meta, taxa) === k
            : faixaDuracao(it, meta) === k;
        if (tem) cont[k] += 1;
      });
    });
    return cont;
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

  /* Nomes das ilhas em ingles (os mesmos de ISLAND_LABEL da pagina); em PT, o nome da API */
  var ILHAS_EN = {
    'sal': 'Sal Island', 'santiago': 'Santiago', 'sao-vicente': 'São Vicente', 'santo-antao': 'Santo Antão',
    'fogo': 'Fogo', 'brava': 'Brava', 'maio': 'Maio', 'boa-vista': 'Boa Vista', 'sao-nicolau': 'São Nicolau',
  };
  function nomeIlha(item, lang) {
    var nome = texto(item && item.island_name);
    if (lang === 'en' && item && ILHAS_EN[item.island_slug]) return ILHAS_EN[item.island_slug];
    return nome;
  }

  /* Outros pontos turisticos da mesma ilha (sem o proprio), os que tem foto primeiro */
  function outrosLugares(item, todos, max) {
    var n = max || 6;
    if (!item || !Array.isArray(todos)) return [];
    var mesmos = todos.filter(function (l) { return l && l.island_slug === item.island_slug && l.slug !== item.slug; });
    var comFoto = mesmos.filter(function (l) { return !!l.image_url; });
    var semFoto = mesmos.filter(function (l) { return !l.image_url; });
    return comFoto.concat(semFoto).slice(0, n);
  }

  /* Resposta de /landmarks?slug=: null = a API falhou; lista sem o lugar = nao existe */
  function estadoDoLugar(resposta, slug) {
    if (resposta === null || resposta === undefined) return { estado: 'erro', lugar: null };
    var lugar = (Array.isArray(resposta) && slug) ? resposta.filter(function (l) { return l && l.slug === slug; })[0] : null;
    return lugar ? { estado: 'ok', lugar: lugar } : { estado: 'nao_encontrado', lugar: null };
  }

  function nomesBatem(a, b) {
    a = texto(a).toLowerCase(); b = texto(b).toLowerCase();
    return !!a && !!b && (a.indexOf(b) !== -1 || b.indexOf(a) !== -1);
  }

  /* Experiencias para a pagina de um lugar: as da mesma ilha cujo itinerario (stops) passa
     por ele; se nenhuma passa, as da mesma ilha, mais reservadas primeiro. Maximo 6. */
  function experienciasDoLugar(lugar, units) {
    var lista = Array.isArray(units) ? units.filter(function (u) { return u && lugar && u.island_slug === lugar.island_slug; }) : [];
    var nomes = [lugar && lugar.name_pt, lugar && lugar.name_en];
    var porParagem = lista.filter(function (u) {
      var stops = lerMeta(u).stops;
      return Array.isArray(stops) && stops.some(function (st) {
        return st && nomes.some(function (n) { return nomesBatem(st.name, n) || nomesBatem(st.name_en, n); });
      });
    });
    if (porParagem.length) return { porItinerario: true, itens: porParagem.slice(0, 6) };
    var ordenadas = lista.slice().sort(function (a, b) {
      return (Number(b.avg_rating) || 0) - (Number(a.avg_rating) || 0) || (Number(b.recent_bookings) || 0) - (Number(a.recent_bookings) || 0);
    });
    return { porItinerario: false, itens: ordenadas.slice(0, 6) };
  }

  /* Dados estruturados (schema.org) de um ponto turistico, para o Google: so o que existe */
  function jsonLdLugar(lugar, url, regiao) {
    var nome = texto(lugar && lugar.name_pt);
    if (!nome) return null;
    var j = { '@context': 'https://schema.org', '@type': 'TouristAttraction', name: nome };
    var desc = texto(lugar.description_pt);
    if (desc) j.description = desc.slice(0, 500);
    if (texto(lugar.image_url)) j.image = lugar.image_url;
    if (url) j.url = url;
    var lat = Number(lugar.lat); var lng = Number(lugar.lng);
    if (lugar.lat !== null && lugar.lat !== undefined && lugar.lng !== null && lugar.lng !== undefined && isFinite(lat) && isFinite(lng)) {
      j.geo = { '@type': 'GeoCoordinates', latitude: lat, longitude: lng };
    }
    j.address = texto(regiao)
      ? { '@type': 'PostalAddress', addressRegion: texto(regiao), addressCountry: 'CV' }
      : { '@type': 'PostalAddress', addressCountry: 'CV' };
    return j;
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
    beneficiosCartao: beneficiosCartao,
    faixaPreco: faixaPreco,
    faixaDuracao: faixaDuracao,
    temBeneficio: temBeneficio,
    passaFiltrosExtra: passaFiltrosExtra,
    ordenarPorPreco: ordenarPorPreco,
    contarOpcoes: contarOpcoes,
    jsonLdLugar: jsonLdLugar,
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
    nomeIlha: nomeIlha,
    outrosLugares: outrosLugares,
    estadoDoLugar: estadoDoLugar,
    experienciasDoLugar: experienciasDoLugar,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.CartaoDiscover = api;
})();
