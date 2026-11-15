/* Cor da marca do operador na pagina publica (/book/*) e no widget.
   A cor escolhida (#rrggbb) e o tom 700 (o dos botoes); os restantes tons misturam-se com preto ou branco.
   A pagina aplica-os como variaveis CSS --brand-<tom>-rgb, lidas pela familia `brand` do Tailwind
   (tailwind.config.js), cujos valores por omissao sao os da cor original da marca (ocean). */
import { useEffect } from 'react';

export const COR_ORIGINAL = '#0d5470';
export const TONS = [900, 800, 700, 600, 500, 400, 300, 200, 100, 50];
const CONTRASTE_MINIMO = 4.5; /* igual ao do backend (helpers/brandColor.js) */

/* mistura com preto (negativo) ou branco (positivo): peso 0 a 1 */
const MISTURA = { 900: -0.6, 800: -0.3, 700: 0, 600: 0.12, 500: 0.25, 400: 0.45, 300: 0.6, 200: 0.75, 100: 0.85, 50: 0.93 };

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function canais(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

function misturar(canal, peso) {
  return Math.round(peso >= 0 ? canal + (255 - canal) * peso : canal * (1 + peso));
}

/* { 900: 'r g b', ..., 50: 'r g b' } ou null se a cor nao for #rrggbb */
export function paletaDaCor(hex) {
  if (typeof hex !== 'string' || !HEX_RE.test(hex.trim())) return null;
  const base = canais(hex.trim());
  const paleta = {};
  TONS.forEach((t) => { paleta[t] = base.map((c) => misturar(c, MISTURA[t])).join(' '); });
  return paleta;
}

function luminancia(hex) {
  const [r, g, b] = canais(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/* Razao de contraste do branco sobre a cor (1 a 21) */
export function contrasteComBranco(hex) {
  return 1.05 / (luminancia(hex) + 0.05);
}

/* { ok: true } ou { ok: false, motivo: 'formato' | 'clara' } */
export function corValida(hex) {
  if (typeof hex !== 'string' || !HEX_RE.test(hex.trim())) return { ok: false, motivo: 'formato' };
  if (contrasteComBranco(hex.trim()) < CONTRASTE_MINIMO) return { ok: false, motivo: 'clara' };
  return { ok: true };
}

/* Define as variaveis na raiz do documento; devolve a funcao que as remove. Sem cor valida nao faz nada. */
export function aplicarCorDaMarca(hex) {
  const paleta = paletaDaCor(hex);
  if (!paleta || typeof document === 'undefined') return () => {};
  const raiz = document.documentElement;
  TONS.forEach((t) => raiz.style.setProperty(`--brand-${t}-rgb`, paleta[t]));
  return () => TONS.forEach((t) => raiz.style.removeProperty(`--brand-${t}-rgb`));
}

/* Hook da pagina publica: aplica a cor do operador enquanto a pagina esta montada */
export function useBrandColor(hex) {
  useEffect(() => aplicarCorDaMarca(hex), [hex]);
}
