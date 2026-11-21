/* Regras puras da pagina completa de actividade (ServiceDetail): que seccoes existem, factos
   rapidos, texto em blocos. Recebem o `meta` (units.description ja lido) e nunca tocam na rede.
   Spec: docs/superpowers/specs/2026-11-21-pagina-servico-completa-design.md */
import { dentroDeCaboVerde } from './coordenadas';

const texto = (v) => (typeof v === 'string' ? v.trim() : '');

/* Campo da lingua pedida, com a outra como alternativa */
function porLingua(meta, base, lang) {
  const m = meta || {};
  const outra = lang === 'en' ? 'pt' : 'en';
  return texto(m[`${base}_${lang}`]) || texto(m[`${base}_${outra}`]);
}

/* Texto livre -> blocos: linha em branco separa blocos; linhas seguidas com "- " formam lista */
export function textoEmBlocos(t) {
  if (typeof t !== 'string' || !t.trim()) return [];
  const blocos = [];
  for (const bloco of t.replace(/\r\n?/g, '\n').split(/\n\s*\n/)) {
    let paragrafo = [];
    let lista = null;
    const fechaP = () => { if (paragrafo.length) blocos.push({ tipo: 'p', texto: paragrafo.join('\n') }); paragrafo = []; };
    const fechaL = () => { if (lista && lista.length) blocos.push({ tipo: 'lista', itens: lista }); lista = null; };
    for (const linha of bloco.split('\n').map((l) => l.trim()).filter(Boolean)) {
      if (linha.startsWith('- ')) {
        fechaP();
        lista = lista || [];
        if (linha.slice(2).trim()) lista.push(linha.slice(2).trim());
      } else {
        fechaL();
        paragrafo.push(linha);
      }
    }
    fechaP();
    fechaL();
  }
  return blocos;
}

export function linhasDestaques(meta, lang) {
  return porLingua(meta, 'highlights', lang).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}

export function oQueLevar(meta, lang) {
  return porLingua(meta, 'what_to_bring', lang) || texto((meta || {}).important_info);
}

/* included_items: objectos {label, included} ou strings legadas (contam como incluido) */
export function incluidos(meta) {
  const sim = [];
  const nao = [];
  const itens = Array.isArray((meta || {}).included_items) ? meta.included_items : [];
  for (const it of itens) {
    const label = texto(typeof it === 'string' ? it : it && it.label);
    if (!label) continue;
    if (typeof it === 'string' || it.included !== false) sim.push(label);
    else nao.push(label);
  }
  return { sim, nao };
}

const LINGUAS = {
  PT: ['Português', 'Portuguese'], EN: ['English', 'English'], FR: ['Français', 'French'],
  ES: ['Español', 'Spanish'], DE: ['Deutsch', 'German'], IT: ['Italiano', 'Italian'], NL: ['Nederlands', 'Dutch'],
};

export function factosActividade(unit, meta, lang) {
  const en = lang === 'en';
  const m = meta || {};
  const factos = [];
  const dur = Number(m.duration);
  if (Number.isFinite(dur) && dur > 0) factos.push({ chave: 'duracao', valor: `${dur} h` });
  const formatos = { grupo: ['Em grupo', 'Group'], privado: ['Privado', 'Private'], ambos: ['Grupo ou privado', 'Group or private'] };
  if (formatos[m.tour_type]) factos.push({ chave: 'formato', valor: formatos[m.tour_type][en ? 1 : 0] });
  const langs = Array.isArray(m.languages) ? m.languages.map((c) => String(c || '').trim()).filter(Boolean) : [];
  if (langs.length) {
    factos.push({ chave: 'linguas', valor: langs.map((c) => (LINGUAS[c.toUpperCase()] || [c, c])[en ? 1 : 0]).join(', ') });
  }
  const recolha = m.pickup_included ? (en ? 'Hotel pickup included' : 'Incluída no hotel') : texto(m.meeting_point);
  if (recolha) factos.push({ chave: 'recolha', valor: recolha });
  const horas = (Array.isArray(m.time_slots) ? m.time_slots : []).map((s) => texto(s && s.time)).filter(Boolean);
  if (horas.length) factos.push({ chave: 'saidas', valor: horas.join(' · ') });
  const cap = Number(unit && unit.capacity);
  if (Number.isFinite(cap) && cap > 0) factos.push({ chave: 'grupo', valor: en ? `Up to ${cap} people` : `Até ${cap} pessoas` });
  return factos;
}

/* Ids das seccoes com dados, pela ordem da spec. `unit` (opcional) so conta para o mapa. */
export function seccoesActividade({ meta, op, reviews, related, lang, unit } = {}) {
  const m = meta || {};
  const o = op || {};
  const l = lang === 'en' ? 'en' : 'pt';
  const inc = incluidos(m);
  const temPolitica = texto(o.cancellation_policy_pt) || texto(o.cancellation_policy_en)
    || (typeof o.free_cancellation_hours === 'number' && Number.isFinite(o.free_cancellation_hours));
  const temFaq = (Array.isArray(o.custom_faqs) ? o.custom_faqs : []).some((f) => f && (texto(f.question_pt) || texto(f.question_en)));
  const temMapa = unit && dentroDeCaboVerde(Number(unit.lat), Number(unit.lng));
  const paragens = Array.isArray(m.stops) ? m.stops.filter((s) => s && texto(s.name)) : [];
  const tem = {
    destaques: linhasDestaques(m, l).length > 0,
    descricao: !!porLingua(m, 'desc', l),
    incluido: inc.sim.length + inc.nao.length > 0,
    itinerario: paragens.length > 0,
    levar: !!oQueLevar(m, l),
    encontro: !!texto(m.meeting_point) || !!temMapa,
    politicas: !!temPolitica,
    avaliacoes: Array.isArray(reviews) && reviews.length > 0,
    perguntas: temFaq,
    outros: Array.isArray(related) && related.length > 0,
  };
  return Object.keys(tem).filter((id) => tem[id]);
}

export function precisaLerTudo(t, limite = 600) {
  return typeof t === 'string' && t.length > limite;
}
