import pt from './pt.json';
import en from './en.json';
import useUiStore from '../store/uiStore';

const translations = { pt, en };

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
