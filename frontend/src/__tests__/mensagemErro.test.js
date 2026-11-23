import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { mensagemErro } from '../utils/mensagemErro';
import { getT } from '../i18n';
import pt from '../i18n/pt.json';
import en from '../i18n/en.json';
import de from '../i18n/de.json';
import nl from '../i18n/nl.json';

/* Erros do servidor na lingua do painel: em pt fica sempre o texto do servidor; em en/de/nl
   usa-se errors.code.<CODE> quando existe, senao o texto do servidor. */
const tPt = getT('pt');
const tEn = getT('en');
const axiosErro = (data) => ({ isAxiosError: true, request: {}, response: { status: 400, data } });
const semRede = () => Object.assign(new Error('Network Error'), { isAxiosError: true, request: {}, code: 'ERR_NETWORK' });

describe('mensagemErro', () => {
  it('pt mostra sempre o texto do servidor', () => {
    const err = { response: { data: { error: 'Unidade não encontrada', code: 'NOT_FOUND' } } };
    expect(mensagemErro(err, tPt, undefined, 'pt')).toBe('Unidade não encontrada');
    expect(mensagemErro(err, tPt, 'Falhou', 'pt')).toBe('Unidade não encontrada');
  });

  it('en traduz pelo codigo', () => {
    const err = { response: { data: { error: 'Unidade não encontrada', code: 'NOT_FOUND' } } };
    expect(mensagemErro(err, tEn, undefined, 'en')).toBe(tEn('errors.code.NOT_FOUND'));
    expect(mensagemErro(err, tEn, undefined, 'en')).toBe('Not found.');
  });

  it('de e nl tambem traduzem pelo codigo', () => {
    const err = axiosErro({ error: 'Esta reserva já está paga.', code: 'ALREADY_PAID' });
    expect(mensagemErro(err, getT('de'), undefined, 'de')).toBe(de.errors.code.ALREADY_PAID);
    expect(mensagemErro(err, getT('nl'), undefined, 'nl')).toBe(nl.errors.code.ALREADY_PAID);
  });

  it('en com codigo desconhecido mostra o texto do servidor', () => {
    const err = axiosErro({ error: 'Algo correu mal', code: 'XPTO' });
    expect(mensagemErro(err, tEn, 'Falhou', 'en')).toBe('Algo correu mal');
  });

  it('en sem codigo mostra o texto do servidor', () => {
    const err = axiosErro({ error: 'Datas sobrepostas' });
    expect(mensagemErro(err, tEn, 'Falhou', 'en')).toBe('Datas sobrepostas');
  });

  it('sem resposta (rede) mostra errors.network nas duas linguas', () => {
    expect(mensagemErro(semRede(), tPt, 'Falhou', 'pt')).toBe(pt.errors.network);
    expect(mensagemErro(semRede(), tEn, 'Falhou', 'en')).toBe(en.errors.network);
  });

  it('erro vazio usa o fallback do chamador, senao errors.generic', () => {
    expect(mensagemErro(axiosErro({}), tPt, 'Falhou', 'pt')).toBe('Falhou');
    expect(mensagemErro(axiosErro({}), tPt, undefined, 'pt')).toBe(pt.errors.generic);
    expect(mensagemErro(axiosErro({ error: '   ' }), tEn, undefined, 'en')).toBe(en.errors.generic);
    expect(mensagemErro(undefined, tEn, 'Failed', 'en')).toBe('Failed');
    /* Error lancado no codigo (nao e do axios): fallback, nunca a mensagem tecnica */
    expect(mensagemErro(new Error('x'), tPt, 'Falhou', 'pt')).toBe('Falhou');
    expect(mensagemErro(new Error('x'), tEn, undefined, 'en')).toBe(en.errors.generic);
  });

  it('aceita tambem o objeto { error, code } directamente', () => {
    expect(mensagemErro({ error: 'Código inválido', code: 'INVALID_VOUCHER' }, tPt, undefined, 'pt')).toBe('Código inválido');
    expect(mensagemErro({ error: 'Código inválido', code: 'INVALID_VOUCHER' }, tEn, undefined, 'en')).toBe(en.errors.code.INVALID_VOUCHER);
    expect(mensagemErro({ code: 'HOLD_EXPIRED' }, tEn, undefined, 'en')).toBe(en.errors.code.HOLD_EXPIRED);
  });

  it('a lingua por omissao e a do painel', () => {
    const err = axiosErro({ error: 'Unidade não encontrada', code: 'NOT_FOUND' });
    expect(mensagemErro(err, tPt)).toBe('Unidade não encontrada');
  });
});

/* Todos os codigos que o backend envia tem traducao em errors.code (o teste le backend/src).
   Formas reconhecidas: { code: 'X' }, err.code = 'X', erro(400, 'X', ...), erro400(msg, 'X'),
   erro(msg, 'X') e err.code || 'X'. O integrador GYG (erro(res, 'X')) responde a GYG, nao ao painel. */
const BACKEND = path.join(__dirname, '..', '..', '..', 'backend', 'src');
const PADROES = [
  /\bcode:\s*'([A-Z][A-Z0-9_]+)'/g,
  /\.code\s*=\s*'([A-Z][A-Z0-9_]+)'/g,
  /\berro\(\s*\d{3}\s*,\s*'([A-Z][A-Z0-9_]+)'/g,
  /\berro400\([^\n]*?,\s*'([A-Z][A-Z0-9_]+)'\)/g,
  /\berro\('[^'\n]*',\s*'([A-Z][A-Z0-9_]+)'\)/g,
  /err\.code\s*\|\|\s*'([A-Z][A-Z0-9_]+)'/g,
];

function ficheirosJs(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : ficheirosJs(p);
    return e.name.endsWith('.js') ? [p] : [];
  });
}

function codigosDoBackend() {
  const codigos = new Set();
  for (const f of ficheirosJs(BACKEND)) {
    const texto = fs.readFileSync(f, 'utf8');
    for (const re of PADROES) for (const m of texto.matchAll(re)) codigos.add(m[1]);
  }
  return [...codigos].sort();
}

describe('errors.code cobre os codigos do backend', () => {
  const codigos = codigosDoBackend();

  it('encontra os codigos (o teste nao passa no vazio)', () => {
    expect(codigos.length).toBeGreaterThan(100);
    expect(codigos).toEqual(expect.arrayContaining(['NOT_FOUND', 'MISSING_FIELDS', 'HOLD_EXPIRED', 'INTERNAL_ERROR', 'INVALID_RANGE', 'NO_PHONE']));
  });

  it.each([['pt', pt], ['en', en], ['de', de], ['nl', nl]])('%s tem errors.code para cada codigo', (_l, dict) => {
    const chaves = dict.errors?.code || {};
    expect(codigos.filter((c) => typeof chaves[c] !== 'string' || !chaves[c].trim())).toEqual([]);
  });
});
