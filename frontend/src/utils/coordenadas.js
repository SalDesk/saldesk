/* Coordenadas coladas pelo operador no formulario de actividade: um par "lat, lng" ou um link
   do Google Maps (@lat,lng / ?q=lat,lng / ?ll=lat,lng / !3dlat!4dlng). Nunca adivinha: sem
   coordenadas no texto devolve null (os links curtos maps.app.goo.gl nao as trazem).
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

export function lerCoordenadas(texto) {
  if (typeof texto !== 'string') return null;
  const t = texto.trim();
  if (!t) return null;
  /* marcador do link (!3d!4d) antes da camara (@) */
  const padroes = [
    new RegExp(`!3d${NUM}!4d${NUM}`),
    new RegExp(`[?&](?:q|ll|query)=${NUM}\\s*,\\s*${NUM}`),
    new RegExp(`@${NUM},${NUM}`),
    new RegExp(`^${NUM}\\s*,\\s*${NUM}$`),
  ];
  for (const p of padroes) {
    const r = par(t.match(p));
    if (r) return r;
  }
  return null;
}

/* Rectangulo largo a volta do arquipelago (aviso no formulario, nunca bloqueia) */
export function dentroDeCaboVerde(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= 14.5 && lat <= 17.5 && lng >= -25.5 && lng <= -22.5;
}
