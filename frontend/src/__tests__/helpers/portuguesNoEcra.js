/* Texto portugues que ficou no ecra depois de mudar o painel para outra lingua. Le os nos de texto e os
   atributos que se leem ou ouvem (aria-label, placeholder, title, alt) e procura acentos ou palavras que
   so podem ser portuguesas. As palavras pequenas que tambem sao inglesas ('as', 'do', 'no') ficam de fora:
   aqui o texto ja e ingles ("Mark as completed"). Os dados dos testes (nomes, notas, documentos) passam
   em `ignorar`: um texto que contenha um desses valores nao conta. */
import { PALAVRAS_PORTUGUESAS, MARCAS } from './detectorPortugues';

const INGLES_TAMBEM = new Set(['as', 'do', 'no']);
const ACENTO = /[À-ÖØ-öø-ÿ]/;
const PALAVRA = new RegExp(
  `(?<![\\p{L}\\d_.-])(?:${PALAVRAS_PORTUGUESAS.filter((p) => !INGLES_TAMBEM.has(p)).join('|')})(?![\\p{L}\\d_-])`,
  'u',
);

function textosDoEcra(raiz) {
  const textos = [];
  const andar = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
  while (andar.nextNode()) textos.push(andar.currentNode.nodeValue);
  raiz.querySelectorAll('*').forEach((el) => {
    ['aria-label', 'placeholder', 'title', 'alt'].forEach((a) => { if (el.hasAttribute(a)) textos.push(el.getAttribute(a)); });
  });
  return textos.map((t) => t.trim()).filter(Boolean);
}

export function portuguesNoEcra(ignorar = [], raiz = document.body) {
  return textosDoEcra(raiz)
    .filter((t) => !ignorar.some((i) => t.includes(i)))
    .filter((t) => {
      const s = MARCAS.reduce((acc, m) => acc.split(m).join(' '), t);
      return ACENTO.test(s) || PALAVRA.test(s);
    });
}

/* Chaves de i18n que apareceram cruas no ecra (faltou o texto na lingua) */
export function chavesCruas(prefixos, raiz = document.body) {
  const re = new RegExp(`\\b(?:${prefixos.join('|')})\\.[a-zA-Z]`);
  return textosDoEcra(raiz).filter((t) => re.test(t));
}
