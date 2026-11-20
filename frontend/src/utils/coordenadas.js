/* Coordenadas coladas pelo operador no formulario de actividade: um par "lat, lng" (virgula ou
   espaco, graus decimais ou graus/minutos/segundos com N/S/E/W) ou um link do Google Maps.
   Ordem nos links: marcador (!3d!4d) > parametros (?q=, ?query=, ?ll=) > ponto no caminho
   (/dir//lat,lng, /search/lat,+lng, /place/lat,lng) > camara (@lat,lng). A camara e so a vista
   do mapa e fica em ultimo. Nunca adivinha: sem coordenadas no texto devolve null (os links
   curtos maps.app.goo.gl nao as trazem -- ver eLinkCurto).
   Spec: docs/superpowers/specs/2026-11-20-ponto-encontro-mapa-design.md */

const NUM = '(-?\\d{1,3}(?:\\.\\d+)?)';

function valido(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function par(m) {
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  return valido(lat, lng) ? { lat, lng } : null;
}

function normalizar(texto) {
  let t = texto.trim().replace(/−/g, '-');
  try { t = decodeURIComponent(t); } catch { /* percentagem partida: fica o texto como veio */ }
  return t.replace(/\+/g, ' ');
}

/* Virgula decimal (teclados e hábitos em portugues): "16,7631 -22,895", "16,7631; -22,895" ou
   "16,7631, -22,895". So quando a leitura e unica; "16,76,-22,89" nao se adivinha. */
function parComVirgulaDecimal(t) {
  const DEC = '(-?\\d{1,3},\\d+)';
  const m = t.match(new RegExp(`^${DEC}(?:\\s*;\\s*|,\\s+|\\s+)${DEC}$`));
  if (!m) return null;
  const lat = Number(m[1].replace(',', '.'));
  const lng = Number(m[2].replace(',', '.'));
  return valido(lat, lng) ? { lat, lng } : null;
}

/* 16.7631° N, 22.895° W  ou  16°45'47.2"N 22°53'42.0"W */
function grausComHemisferio(t) {
  const parte = '(\\d{1,3})(?:\\.(\\d+))?°\\s*(?:(\\d{1,2})[\'′]\\s*)?(?:([\\d.]+)["″]\\s*)?([NSEWO])';
  const m = t.match(new RegExp(`^${parte}[\\s,]+${parte}$`, 'i'));
  if (!m) return null;
  const valor = (g, dec, min, seg, hemi) => {
    let v = Number(`${g}${dec ? `.${dec}` : ''}`) + (min ? Number(min) / 60 : 0) + (seg ? Number(seg) / 3600 : 0);
    if (/[SWO]/i.test(hemi)) v = -v;
    return v;
  };
  const a = { v: valor(m[1], m[2], m[3], m[4], m[5]), h: m[5].toUpperCase() };
  const b = { v: valor(m[6], m[7], m[8], m[9], m[10]), h: m[10].toUpperCase() };
  const latPrimeiro = /[NS]/.test(a.h) && /[EWO]/.test(b.h);
  const lngPrimeiro = /[EWO]/.test(a.h) && /[NS]/.test(b.h);
  if (!latPrimeiro && !lngPrimeiro) return null;
  const lat = Math.round((latPrimeiro ? a.v : b.v) * 1e6) / 1e6;
  const lng = Math.round((latPrimeiro ? b.v : a.v) * 1e6) / 1e6;
  return valido(lat, lng) ? { lat, lng } : null;
}

export function lerCoordenadas(texto) {
  if (typeof texto !== 'string') return null;
  if (!texto.trim()) return null;
  const t = normalizar(texto);
  const padroes = [
    new RegExp(`!3d${NUM}!4d${NUM}`),
    new RegExp(`[?&](?:q|ll|query)=\\s*${NUM}\\s*,\\s*${NUM}`),
    new RegExp(`/${NUM}\\s*,\\s*${NUM}(?=/|\\?|$)`),
    new RegExp(`@${NUM},${NUM}`),
    new RegExp(`^${NUM}(?:\\s*,\\s*|\\s+)${NUM}$`),
  ];
  for (const p of padroes) {
    const r = par(t.match(p));
    if (r) return r;
  }
  return parComVirgulaDecimal(t) || grausComHemisferio(t);
}

/* Links curtos de partilha (maps.app.goo.gl, goo.gl/maps): nao trazem coordenadas */
export function eLinkCurto(texto) {
  return typeof texto === 'string' && /(^|\/\/)(maps\.app\.goo\.gl|goo\.gl\/maps)\//i.test(texto.trim());
}

/* Rectangulo largo a volta do arquipelago (aviso no formulario, nunca bloqueia) */
export function dentroDeCaboVerde(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= 14.5 && lat <= 17.5 && lng >= -25.5 && lng <= -22.5;
}
