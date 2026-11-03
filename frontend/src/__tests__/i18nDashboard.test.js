import { describe, expect, it } from 'vitest';
import pt from '../i18n/pt.json';
import en from '../i18n/en.json';
import de from '../i18n/de.json';
import nl from '../i18n/nl.json';

const LANGS = { pt, en, de, nl };
const NAMESPACES = ['attention', 'view', 'summary', 'generic'];

/* Lista os caminhos das folhas de um objeto (ex.: "a.b.c") */
function leaves(node, prefix = '') {
  if (node === null || typeof node !== 'object') return [{ path: prefix, value: node }];
  return Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k));
}

/* Folhas de um namespace do dashboard; vazio se o namespace nao existir */
function folhas(dict, ns) {
  const node = dict.dashboard && dict.dashboard[ns];
  return node === undefined ? [] : leaves(node, ns);
}

describe('i18n dashboard', () => {
  it('attention e view existem nas quatro linguas', () => {
    Object.entries(LANGS).forEach(([lang, dict]) => {
      expect(dict.dashboard.attention, lang).toBeDefined();
      expect(dict.dashboard.view, lang).toBeDefined();
    });
  });

  it('as chaves obrigatorias existem em portugues', () => {
    const keys = folhas(pt, 'attention').map((l) => l.path).concat(folhas(pt, 'view').map((l) => l.path));
    [
      'attention.title', 'attention.allClear', 'attention.open', 'attention.weather',
      'attention.maintenance', 'attention.unconfirmed', 'attention.pending',
      'attention.unpaid', 'attention.cleaning', 'attention.nearlyFull',
      'view.today', 'view.summary',
    ].forEach((k) => expect(keys).toContain(k));
  });

  it('dashboard.generic tem as chaves do dashboard generico nas quatro linguas', () => {
    const esperadas = ['coversToday', 'customersDesc', 'automationsDesc', 'financialDesc', 'unitsDesc'];
    Object.entries(LANGS).forEach(([lang, dict]) => {
      esperadas.forEach((k) => {
        expect(typeof (dict.dashboard.generic || {})[k], `${lang} generic.${k}`).toBe('string');
      });
    });
  });

  NAMESPACES.forEach((ns) => {
    it(`dashboard.${ns}: as quatro linguas tem o mesmo conjunto de chaves`, () => {
      const base = folhas(pt, ns).map((l) => l.path).sort();
      Object.entries(LANGS).forEach(([lang, dict]) => {
        expect(folhas(dict, ns).map((l) => l.path).sort(), lang).toEqual(base);
      });
    });

    it(`dashboard.${ns}: nenhum valor e vazio`, () => {
      Object.entries(LANGS).forEach(([lang, dict]) => {
        folhas(dict, ns).forEach(({ path, value }) => {
          expect(typeof value, `${lang} ${path}`).toBe('string');
          expect(value.trim(), `${lang} ${path}`).not.toBe('');
        });
      });
    });
  });

  it('as chaves com contagem usam {{n}} em todas as linguas', () => {
    ['weather', 'maintenance', 'unconfirmed', 'pending', 'unpaid', 'cleaning', 'nearlyFull'].forEach((k) => {
      Object.entries(LANGS).forEach(([lang, dict]) => {
        expect(dict.dashboard.attention[k], `${lang} ${k}`).toContain('{{n}}');
      });
    });
  });
});
