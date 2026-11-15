/* Cor da marca do operador (pagina publica e widget): validar e normalizar.
   Formato #rrggbb; o texto sobre a cor e branco, por isso exige-se contraste minimo 4.5:1 (WCAG AA). */

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const CONTRASTE_MINIMO = 4.5;

function canalLinear(c) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminancia(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * canalLinear(r) + 0.7152 * canalLinear(g) + 0.0722 * canalLinear(b);
}

/* Razao de contraste do branco sobre a cor (1 a 21) */
function contrasteComBranco(hex) {
  return 1.05 / (luminancia(hex) + 0.05);
}

/* null/undefined/vazio = limpar a cor (volta a original). Devolve { ok, cor } ou { ok:false, error } */
function validarCor(valor) {
  if (valor === null || valor === undefined) return { ok: true, cor: null };
  if (typeof valor !== 'string') return { ok: false, error: 'A cor tem de ser texto no formato #rrggbb' };
  const t = valor.trim();
  if (t === '') return { ok: true, cor: null };
  if (!HEX_RE.test(t)) return { ok: false, error: 'A cor tem de estar no formato #rrggbb (por exemplo #0d5470)' };
  const cor = t.toLowerCase();
  if (contrasteComBranco(cor) < CONTRASTE_MINIMO) {
    return { ok: false, error: 'Esta cor e demasiado clara: o texto branco nao se leria bem. Escolha uma cor mais escura.' };
  }
  return { ok: true, cor };
}

module.exports = { validarCor, contrasteComBranco, CONTRASTE_MINIMO };
