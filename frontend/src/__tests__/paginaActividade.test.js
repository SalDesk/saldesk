import { describe, it, expect } from 'vitest';
import {
  textoEmBlocos, linhasDestaques, oQueLevar, incluidos, factosActividade, seccoesActividade, precisaLerTudo, textoDuracao,
} from '../utils/paginaActividade';

describe('textoEmBlocos', () => {
  it('separa paragrafos por linha em branco', () => {
    expect(textoEmBlocos('Primeiro.\n\nSegundo.')).toEqual([
      { tipo: 'p', texto: 'Primeiro.' }, { tipo: 'p', texto: 'Segundo.' },
    ]);
  });
  it('linhas seguidas com "- " formam uma lista', () => {
    expect(textoEmBlocos('Traga:\n- Protector solar\n- Chapéu\n\nBoa viagem')).toEqual([
      { tipo: 'p', texto: 'Traga:' },
      { tipo: 'lista', itens: ['Protector solar', 'Chapéu'] },
      { tipo: 'p', texto: 'Boa viagem' },
    ]);
  });
  it('vazio ou nao texto devolve lista vazia', () => {
    expect(textoEmBlocos('')).toEqual([]);
    expect(textoEmBlocos(null)).toEqual([]);
  });
});

describe('linhasDestaques', () => {
  const meta = { highlights_pt: 'Mergulho\n\n  Almoço  \n', highlights_en: 'Diving\nLunch' };
  it('usa o campo da lingua e remove linhas vazias', () => {
    expect(linhasDestaques(meta, 'pt')).toEqual(['Mergulho', 'Almoço']);
    expect(linhasDestaques(meta, 'en')).toEqual(['Diving', 'Lunch']);
  });
  it('EN cai para PT quando falta', () => {
    expect(linhasDestaques({ highlights_pt: 'Mergulho' }, 'en')).toEqual(['Mergulho']);
  });
  it('sem dados devolve []', () => {
    expect(linhasDestaques({}, 'pt')).toEqual([]);
  });
});

describe('oQueLevar', () => {
  it('ordem: lingua, outra lingua, important_info, vazio', () => {
    expect(oQueLevar({ what_to_bring_pt: 'A', what_to_bring_en: 'B', important_info: 'C' }, 'en')).toBe('B');
    expect(oQueLevar({ what_to_bring_pt: 'A', important_info: 'C' }, 'en')).toBe('A');
    expect(oQueLevar({ important_info: 'C' }, 'pt')).toBe('C');
    expect(oQueLevar({}, 'pt')).toBe('');
  });
});

describe('incluidos', () => {
  it('le objectos e strings legadas como incluidas', () => {
    const meta = { included_items: [{ label: 'Almoço', included: true }, { label: 'Bebidas', included: false }, 'Seguro', { label: '  ', included: true }] };
    expect(incluidos(meta, 'pt')).toEqual({ sim: ['Almoço', 'Seguro'], nao: ['Bebidas'] });
  });
  it('sem dados', () => {
    expect(incluidos({}, 'pt')).toEqual({ sim: [], nao: [] });
  });
});

describe('factosActividade', () => {
  const meta = {
    duration: 3, tour_type: 'ambos', languages: ['PT', 'EN', 'XX'], pickup_included: true,
    time_slots: [{ time: '09:00', capacity: 8 }, { time: '14:00', capacity: 8 }],
  };
  it('devolve todos os factos em PT', () => {
    expect(factosActividade({ capacity: 20 }, meta, 'pt')).toEqual([
      { chave: 'duracao', valor: '3 h' },
      { chave: 'formato', valor: 'Grupo ou privado' },
      { chave: 'linguas', valor: 'Português, English, XX' },
      { chave: 'recolha', valor: 'Incluída no hotel' },
      { chave: 'saidas', valor: '09:00 · 14:00' },
      { chave: 'grupo', valor: 'Até 20 pessoas' },
    ]);
  });
  it('EN e recolha pelo ponto de encontro', () => {
    const r = factosActividade({ capacity: 6 }, { tour_type: 'grupo', meeting_point: 'Marina', languages: ['FR'] }, 'en');
    expect(r).toEqual([
      { chave: 'formato', valor: 'Group' },
      { chave: 'linguas', valor: 'French' },
      { chave: 'recolha', valor: 'Marina' },
      { chave: 'grupo', valor: 'Up to 6 people' },
    ]);
  });
  it('duracao com virgula decimal em PT e ponto em EN', () => {
    expect(factosActividade({}, { duration: 6.5 }, 'pt')).toEqual([{ chave: 'duracao', valor: '6,5 h' }]);
    expect(factosActividade({}, { duration: '6.5' }, 'en')).toEqual([{ chave: 'duracao', valor: '6.5 h' }]);
    expect(textoDuracao(2, 'pt')).toBe('2 h');
    expect(textoDuracao(1.25, 'pt')).toBe('1,25 h');
  });
  it('privado e sem dados', () => {
    expect(factosActividade({}, { tour_type: 'privado' }, 'pt')).toEqual([{ chave: 'formato', valor: 'Privado' }]);
    expect(factosActividade({}, {}, 'pt')).toEqual([]);
  });
});

describe('seccoesActividade', () => {
  it('tudo vazio devolve []', () => {
    expect(seccoesActividade({ meta: {}, op: {}, reviews: [], related: [], lang: 'pt' })).toEqual([]);
    expect(seccoesActividade({})).toEqual([]);
  });
  it('tudo preenchido devolve os ids pela ordem da spec', () => {
    const r = seccoesActividade({
      meta: {
        highlights_pt: 'X', desc_pt: 'Descrição', included_items: ['Almoço'], stops: [{ name: 'Praia' }],
        what_to_bring_pt: 'Chapéu', meeting_point: 'Marina',
      },
      op: { cancellation_policy_pt: 'Política', custom_faqs: [{ question_pt: 'P?' }] },
      reviews: [{}], related: [{}], lang: 'pt',
    });
    expect(r).toEqual(['destaques', 'descricao', 'incluido', 'itinerario', 'levar', 'encontro', 'politicas', 'avaliacoes', 'perguntas', 'outros']);
  });
  it('encontro por coordenadas validas de Cabo Verde, nao por fora', () => {
    expect(seccoesActividade({ meta: {}, unit: { lat: 16.6, lng: -22.9 } })).toEqual(['encontro']);
    expect(seccoesActividade({ meta: {}, unit: { lat: 0, lng: 0 } })).toEqual([]);
  });
  it('politicas por free_cancellation_hours numerico (incluindo 0)', () => {
    expect(seccoesActividade({ meta: {}, op: { free_cancellation_hours: 0 } })).toEqual(['politicas']);
    expect(seccoesActividade({ meta: {}, op: { free_cancellation_hours: null } })).toEqual([]);
  });
  it('perguntas ignora faqs sem pergunta', () => {
    expect(seccoesActividade({ meta: {}, op: { custom_faqs: [{ answer_pt: 'x' }] } })).toEqual([]);
    expect(seccoesActividade({ meta: {}, op: { custom_faqs: [{ question_en: 'Q?' }] } })).toEqual(['perguntas']);
  });
});

describe('precisaLerTudo', () => {
  it('so acima do limite', () => {
    expect(precisaLerTudo('a'.repeat(600))).toBe(false);
    expect(precisaLerTudo('a'.repeat(601))).toBe(true);
    expect(precisaLerTudo('abcdef', 5)).toBe(true);
    expect(precisaLerTudo(null)).toBe(false);
  });
});
