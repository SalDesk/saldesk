import pt from './pt.json';
import en from './en.json';
import de from './de.json';
import nl from './nl.json';
import useUiStore from '../store/uiStore';

const translations = { pt, en, de, nl };

export function useT() {
  const lang = useUiStore((s) => s.lang);
  const dict = translations[lang] || translations.pt;

  function t(key) {
    const parts = key.split('.');
    let val = dict;
    for (const part of parts) {
      val = val?.[part];
      if (val === undefined) return key;
    }
    return val ?? key;
  }

  return t;
}

export function getT(lang = 'pt') {
  const dict = translations[lang] || translations.pt;
  return function t(key) {
    const parts = key.split('.');
    let val = dict;
    for (const part of parts) {
      val = val?.[part];
      if (val === undefined) return key;
    }
    return val ?? key;
  };
}

export const SUPPORTED_LANGS = ['pt', 'en', 'de', 'nl'];
export const LANG_LABELS = { pt: 'PT', en: 'EN', de: 'DE', nl: 'NL' };
