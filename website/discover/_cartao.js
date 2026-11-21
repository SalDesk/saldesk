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
    /* Opcoes validas (tipo conhecido, preco > 0, lugares >= 1 por veiculo) mandam: a mais
       barata decide valor e unidade, como opcaoMaisBarata() no servidor. */
    var UNIDADES = { per_person: 'pessoa', per_group: 'grupo', per_vehicle: 'veiculo' };
    var opcoes = Array.isArray(meta && meta.options) ? meta.options : [];
    var melhor = null;
    opcoes.forEach(function (o) {
      if (!o || !UNIDADES[o.type]) return;
      var p = Number(o.price);
      if (!(p > 0)) return;
      if (o.type === 'per_vehicle' && !(Math.floor(Number(o.seats)) >= 1)) return;
      if (!melhor || p < melhor.valor) melhor = { valor: p, unidade: UNIDADES[o.type] };
    });
    if (melhor) return melhor;
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

  /* Rotulo das faixas de preco (50 e 100 EUR) na moeda escolhida no topo da pagina */
  function rotuloFaixaPreco(chave, moeda, lang, taxa) {
    var en = lang === 'en';
    if (moeda === 'CVE') {
      var t = taxa || 110;
      var a = (50 * t).toLocaleString('pt-PT'); var b = (100 * t).toLocaleString('pt-PT');
      if (chave === 'ate50') return (en ? 'Up to ' : 'Até ') + a + ' CVE';
      if (chave === '50a100') return a + '–' + b + ' CVE';
      if (chave === 'mais100') return (en ? 'Over ' : 'Mais de ') + b + ' CVE';
      return '';
    }
    if (chave === 'ate50') return en ? 'Up to €50' : 'Até 50 €';
    if (chave === '50a100') return en ? '€50–100' : '50–100 €';
    if (chave === 'mais100') return en ? 'Over €100' : 'Mais de 100 €';
    return '';
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

  /* Estrelas do cartao: so a classificacao propria da experiencia (unit_avg_rating /
     unit_review_count). A media do operador (avg_rating) nunca entra aqui. */
  function classificacaoCartao(item) {
    var media = Number(item && item.unit_avg_rating);
    var total = Number(item && item.unit_review_count);
    if (!(total >= 1) || !(media >= 1 && media <= 5)) return null;
    return { media: media, total: total };
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
     por ele; se nenhuma passa, as da mesma ilha, primeiro as com melhores estrelas proprias
     (nunca a media do operador), depois as mais reservadas. Maximo 6. */
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
      var ca = classificacaoCartao(a) || { media: 0, total: 0 };
      var cb = classificacaoCartao(b) || { media: 0, total: 0 };
      return cb.media - ca.media || cb.total - ca.total || (Number(b.recent_bookings) || 0) - (Number(a.recent_bookings) || 0);
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

  /* ── Mapa das experiencias (sem biblioteca: azulejos OSM + projeccao Web Mercator) ──
     Localizacao: ponto de encontro (lat/lng da unidade) ou, em falta, a primeira paragem do
     itinerario com coordenadas. Nunca inventa (sem centro da ilha, sem morada). */
  function numero(v) {
    if (v === null || v === undefined || v === '') return NaN;
    return Number(v);
  }

  /* Rectangulo largo a volta do arquipelago: fora dele (ex.: 0,0 de campos nunca preenchidos)
     a coordenada e um erro de dados e nao entra no mapa */
  function dentroDeCaboVerde(lat, lng) {
    return isFinite(lat) && isFinite(lng) && lat >= 14.5 && lat <= 17.5 && lng >= -25.5 && lng <= -22.5;
  }

  function localizacaoExperiencia(item, meta) {
    var la = numero(item && item.lat); var ln = numero(item && item.lng);
    if (dentroDeCaboVerde(la, ln)) return { lat: la, lng: ln, origem: 'encontro' };
    var stops = meta && Array.isArray(meta.stops) ? meta.stops : [];
    for (var i = 0; i < stops.length; i += 1) {
      var s = stops[i];
      var sa = numero(s && s.lat); var sn = numero(s && s.lng);
      if (dentroDeCaboVerde(sa, sn)) return { lat: sa, lng: sn, origem: 'paragem' };
    }
    return null;
  }

  /* Pixels do mundo (azulejos de 256 px) para lat/lng e zoom */
  function projectar(lat, lng, zoom) {
    var escala = 256 * Math.pow(2, zoom);
    var sen = Math.max(-0.9999, Math.min(0.9999, Math.sin(lat * Math.PI / 180)));
    return {
      x: (lng + 180) / 360 * escala,
      y: (0.5 - Math.log((1 + sen) / (1 - sen)) / (4 * Math.PI)) * escala,
    };
  }

  /* Maior zoom (entre zMin e zMax) em que todos os pontos cabem dentro da margem; o conjunto
     fica centrado. Devolve o canto superior esquerdo em pixels do mundo. */
  function enquadrarMapa(pontos, largura, altura, opcoes) {
    var o = opcoes || {};
    var zMin = o.zMin === undefined ? 8 : o.zMin;
    var zMax = o.zMax === undefined ? 15 : o.zMax;
    var margem = o.margem === undefined ? 40 : o.margem;
    var lista = Array.isArray(pontos) ? pontos.filter(function (p) { return p && isFinite(p.lat) && isFinite(p.lng); }) : [];
    if (!lista.length) return null;
    var escolha = null;
    for (var z = zMax; z >= zMin; z -= 1) {
      var ps = lista.map(function (p) { return projectar(p.lat, p.lng, z); });
      var xs = ps.map(function (p) { return p.x; }); var ys = ps.map(function (p) { return p.y; });
      var minX = Math.min.apply(null, xs); var maxX = Math.max.apply(null, xs);
      var minY = Math.min.apply(null, ys); var maxY = Math.max.apply(null, ys);
      escolha = { zoom: z, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
      if (maxX - minX <= largura - 2 * margem && maxY - minY <= altura - 2 * margem) break;
    }
    return { zoom: escolha.zoom, x0: escolha.cx - largura / 2, y0: escolha.cy - altura / 2 };
  }

  /* Azulejos que cobrem o rectangulo do mapa, com a posicao relativa ao mapa */
  function azulejosDoMapa(enq, largura, altura) {
    if (!enq) return [];
    var z = enq.zoom; var n = Math.pow(2, z);
    var tx0 = Math.floor(enq.x0 / 256); var tx1 = Math.floor((enq.x0 + largura - 1) / 256);
    var ty0 = Math.floor(enq.y0 / 256); var ty1 = Math.floor((enq.y0 + altura - 1) / 256);
    var out = [];
    for (var ty = ty0; ty <= ty1; ty += 1) {
      if (ty < 0 || ty >= n) continue;
      for (var tx = tx0; tx <= tx1; tx += 1) {
        out.push({ z: z, x: ((tx % n) + n) % n, y: ty, left: tx * 256 - enq.x0, top: ty * 256 - enq.y0 });
      }
    }
    return out;
  }

  /* Junta marcadores a menos de 'limite' px uns dos outros (ex.: varios tours do mesmo cais),
     para nenhum ficar escondido debaixo de outro. Ordem estavel; o centro e a media do grupo. */
  function agruparPinos(pontos, limite) {
    var grupos = [];
    (Array.isArray(pontos) ? pontos : []).forEach(function (p) {
      var alvo = null;
      for (var k = 0; k < grupos.length; k += 1) {
        var g = grupos[k];
        if (Math.hypot(g.x - p.x, g.y - p.y) <= limite) { alvo = g; break; }
      }
      if (!alvo) { grupos.push({ x: p.x, y: p.y, sx: p.x, sy: p.y, membros: [p.i] }); return; }
      alvo.membros.push(p.i);
      alvo.sx += p.x; alvo.sy += p.y;
      alvo.x = alvo.sx / alvo.membros.length; alvo.y = alvo.sy / alvo.membros.length;
    });
    return grupos.map(function (g) { return { x: g.x, y: g.y, membros: g.membros }; });
  }

  /* Vista mostrada: o Mapa que o turista escolheu, so enquanto houver experiencias com localizacao
     (sem nenhuma mostra a lista, mas a escolha fica para quando voltarem) */
  function vistaEfectiva(escolhida, nLocalizadas) {
    return escolhida === 'mapa' && nLocalizadas > 0 ? 'mapa' : 'lista';
  }

  /* Zoom dos mapas do Discover: ate 13 (com uma so experiencia ainda se ve a zona da ilha); desce ate 5
     para o grupo sem ilha, com pontos espalhados por Cabo Verde, caber mesmo num telemovel */
  var OPCOES_MAPA = { zMin: 5, zMax: 13 };

  /* Numero no marcador: so nos grupos (quantas experiencias junta); um marcador sozinho leva so um ponto */
  function rotuloPino(n) {
    return n > 1 ? String(n) : '';
  }

  /* Tamanho do mapa de cada ilha. No telemovel ocupa a largura toda (cartoes por baixo).
     No computador fica ao lado dos cartoes, com a largura ajustada a forma dos pontos (uma ilha
     alta como o Sal fica estreita, sem uma faixa de mar dos dois lados): entre 42% e 62% do espaco. */
  function tamanhoMapa(pontos, larguraDisponivel) {
    var disp = Math.round(larguraDisponivel);
    if (!(disp >= 720)) return { largura: disp, altura: 360, lado: false };
    var altura = 440; var margem = 40;
    var min = Math.round(disp * 0.42); var max = Math.round(disp * 0.62);
    var ps = (Array.isArray(pontos) ? pontos : []).filter(function (p) { return p && isFinite(p.lat) && isFinite(p.lng); })
      .map(function (p) { return projectar(p.lat, p.lng, 0); });
    var desejada = 0;
    if (ps.length > 1) {
      var xs = ps.map(function (p) { return p.x; }); var ys = ps.map(function (p) { return p.y; });
      var bw = Math.max.apply(null, xs) - Math.min.apply(null, xs);
      var bh = Math.max.apply(null, ys) - Math.min.apply(null, ys);
      desejada = bh > 0 ? bw / bh * (altura - 2 * margem) + 2 * margem : (bw > 0 ? Infinity : 0);
    }
    return { largura: Math.round(Math.max(min, Math.min(max, desejada))), altura: altura, lado: true };
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
    rotuloFaixaPreco: rotuloFaixaPreco,
    faixaDuracao: faixaDuracao,
    temBeneficio: temBeneficio,
    passaFiltrosExtra: passaFiltrosExtra,
    ordenarPorPreco: ordenarPorPreco,
    contarOpcoes: contarOpcoes,
    jsonLdLugar: jsonLdLugar,
    localizacaoExperiencia: localizacaoExperiencia,
    dentroDeCaboVerde: dentroDeCaboVerde,
    projectar: projectar,
    enquadrarMapa: enquadrarMapa,
    azulejosDoMapa: azulejosDoMapa,
    agruparPinos: agruparPinos,
    rotuloPino: rotuloPino,
    vistaEfectiva: vistaEfectiva,
    OPCOES_MAPA: OPCOES_MAPA,
    tamanhoMapa: tamanhoMapa,
    precoCartao: precoCartao,
    precoCrianca: precoCrianca,
    formatarPreco: formatarPreco,
    tituloCartao: tituloCartao,
    sinalProcura: sinalProcura,
    classificacaoCartao: classificacaoCartao,
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
