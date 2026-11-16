/* As quatro linguas da app do operador (pt, en, de, nl) tem de ficar em paralelo:
   as mesmas chaves, sem textos vazios e com os mesmos marcadores {n}, {name}... em cada texto. */
import { describe, expect, it } from 'vitest';
import pt from '../i18n/pt.json';
import en from '../i18n/en.json';
import de from '../i18n/de.json';
import nl from '../i18n/nl.json';

const LINGUAS = { en, de, nl };

function achatar(obj, prefixo = '') {
  const saida = {};
  for (const [k, v] of Object.entries(obj)) {
    const chave = prefixo ? `${prefixo}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(saida, achatar(v, chave));
    else saida[chave] = v;
  }
  return saida;
}

const base = achatar(pt);
const marcadores = (texto) => (String(texto).match(/\{[a-zA-Z]+\}/g) || []).sort();

describe('i18n: paridade entre pt, en, de e nl', () => {
  it.each(Object.keys(LINGUAS))('%s tem exactamente as mesmas chaves que pt', (lingua) => {
    const outra = achatar(LINGUAS[lingua]);
    expect(Object.keys(base).filter((k) => !(k in outra))).toEqual([]);
    expect(Object.keys(outra).filter((k) => !(k in base))).toEqual([]);
  });

  it.each(['pt', 'en', 'de', 'nl'])('%s nao tem textos vazios', (lingua) => {
    const texto = achatar({ pt, en, de, nl }[lingua]);
    expect(Object.entries(texto).filter(([, v]) => typeof v !== 'string' || v.trim() === '').map(([k]) => k)).toEqual([]);
  });

  it.each(Object.keys(LINGUAS))('%s usa os mesmos marcadores {x} que pt em cada texto', (lingua) => {
    const outra = achatar(LINGUAS[lingua]);
    const diferentes = Object.keys(base)
      .filter((k) => k in outra && JSON.stringify(marcadores(base[k])) !== JSON.stringify(marcadores(outra[k])))
      .map((k) => `${k}: pt ${marcadores(base[k])} / ${lingua} ${marcadores(outra[k])}`);
    expect(diferentes).toEqual([]);
  });
});
