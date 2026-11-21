import { describe, expect, it } from 'vitest';
import {
  opcoesValidas, nomeOpcao, unidadeOpcao, limitarVeiculos, precoEstimado,
  opcaoMaisBarata, ofertaActual, textoOferta, novoIdOpcao,
} from '../utils/opcoesActividade';

describe('opcoesValidas', () => {
  it('filtra como o backend: tipo conhecido, preco > 0, lugares >= 1 por veiculo', () => {
    const meta = { options: [
      { id: 'a', type: 'per_person', price: '25', price_child: '10' },
      { id: 'b', type: 'per_group', price: 0 },
      { id: 'c', type: 'per_vehicle', price: 40, seats: 0 },
      { id: 'd', type: 'per_vehicle', price: 40, seats: '4' },
      { id: 'e', type: 'outro', price: 5 },
      null,
    ] };
    const v = opcoesValidas(meta);
    expect(v.map(o => o.id)).toEqual(['a', 'd']);
    expect(v[0].price).toBe(25);
    expect(v[0].price_child).toBe(10);
    expect(v[1].seats).toBe(4);
  });
  it('sem opcoes devolve lista vazia', () => {
    expect(opcoesValidas({})).toEqual([]);
    expect(opcoesValidas(null)).toEqual([]);
  });
});

describe('nomeOpcao e unidadeOpcao', () => {
  const op = { name_pt: 'Barco', name_en: '', type: 'per_vehicle', seats: 4, price: 10 };
  it('EN cai para PT', () => {
    expect(nomeOpcao(op, 'en')).toBe('Barco');
    expect(nomeOpcao({ ...op, name_en: 'Boat' }, 'en')).toBe('Boat');
    expect(nomeOpcao({ ...op, name_en: 'Boat' }, 'pt')).toBe('Barco');
  });
  it('unidade por tipo e lingua', () => {
    expect(unidadeOpcao({ type: 'per_person' }, 'pt')).toBe('por pessoa');
    expect(unidadeOpcao({ type: 'per_group' }, 'pt')).toBe('por grupo');
    expect(unidadeOpcao(op, 'pt')).toBe('por veículo (4 lugares)');
    expect(unidadeOpcao({ type: 'per_person' }, 'en')).toBe('per person');
    expect(unidadeOpcao({ type: 'per_group' }, 'en')).toBe('per group');
    expect(unidadeOpcao(op, 'en')).toBe('per vehicle (4 seats)');
  });
});

describe('limitarVeiculos', () => {
  it('pedido fora dos limites e corrigido', () => {
    expect(limitarVeiculos(2, 5, 1)).toBe(3);
    expect(limitarVeiculos(2, 5, 99)).toBe(5);
    expect(limitarVeiculos(2, 5, 4)).toBe(4);
  });
  it('sem pedido ou invalido fica o minimo', () => {
    expect(limitarVeiculos(4, 5)).toBe(2);
    expect(limitarVeiculos(4, 5, '')).toBe(2);
    expect(limitarVeiculos(4, 5, 'x')).toBe(2);
    expect(limitarVeiculos(4, 0, 3)).toBe(0);
  });
});

describe('precoEstimado', () => {
  it('por pessoa, com e sem preco de crianca', () => {
    const op = { type: 'per_person', price: 20, price_child: 10 };
    expect(precoEstimado(op, { adults: 2, children: 1 })).toBe(50);
    expect(precoEstimado({ type: 'per_person', price: 20 }, { adults: 2, children: 1 })).toBe(60);
  });
  it('por grupo e preco fixo', () => {
    expect(precoEstimado({ type: 'per_group', price: 99.5 }, { adults: 5, children: 0 })).toBe(99.5);
  });
  it('por veiculo usa os veiculos limitados', () => {
    const op = { type: 'per_vehicle', price: 30, seats: 2 };
    expect(precoEstimado(op, { adults: 3, children: 2, vehicles: 1 })).toBe(90);
    expect(precoEstimado(op, { adults: 3, children: 2, vehicles: 4 })).toBe(120);
  });
  it('arredonda a cêntimos', () => {
    expect(precoEstimado({ type: 'per_person', price: 0.1 }, { adults: 3, children: 0 })).toBe(0.3);
  });
});

describe('opcaoMaisBarata', () => {
  it('devolve a mais barata ou null', () => {
    const meta = { options: [
      { id: 'a', type: 'per_person', price: 40 },
      { id: 'b', type: 'per_group', price: 30 },
      { id: 'c', type: 'per_group', price: 0 },
    ] };
    expect(opcaoMaisBarata(meta).id).toBe('b');
    expect(opcaoMaisBarata({})).toBeNull();
  });
});

describe('ofertaActual', () => {
  const meta = { offers: [
    { percent: 10, from: '2026-11-01', to: '2026-11-20' },
    { percent: 20, from: '2026-12-01', to: '2026-12-31' },
    { percent: 15, from: '2026-11-25', to: '2026-12-05' },
    { percent: 95, from: '2026-11-25', to: '2026-12-05' },
    { percent: 10, from: '2026-12-10', to: '2026-12-01' },
  ] };
  it('uma oferta que acabou ontem nunca aparece', () => {
    expect(ofertaActual(meta, '2026-11-21').percent).toBe(15);
  });
  it('uma oferta que acaba hoje ainda conta', () => {
    expect(ofertaActual(meta, '2026-11-20').percent).toBe(10);
  });
  it('entre varias fica a que acaba primeiro', () => {
    expect(ofertaActual(meta, '2026-11-26').to).toBe('2026-12-05');
  });
  it('sem ofertas validas devolve null', () => {
    expect(ofertaActual(meta, '2027-01-01')).toBeNull();
    expect(ofertaActual({}, '2026-11-21')).toBeNull();
  });
});

describe('textoOferta', () => {
  const o = { percent: 25, from: '2026-12-01', to: '2026-12-15' };
  it('mesmo mes', () => {
    expect(textoOferta(o, 'pt')).toBe('-25% de 1 a 15 dez');
    expect(textoOferta(o, 'en')).toBe('-25% from 1 to 15 Dec');
  });
  it('meses diferentes', () => {
    const d = { percent: 25, from: '2026-11-28', to: '2026-12-05' };
    expect(textoOferta(d, 'pt')).toBe('-25% de 28 nov a 5 dez');
    expect(textoOferta(d, 'en')).toBe('-25% from 28 Nov to 5 Dec');
  });
});

describe('novoIdOpcao', () => {
  it('gera ids curtos e diferentes', () => {
    const a = novoIdOpcao();
    const b = novoIdOpcao();
    expect(a).toMatch(/^[a-z0-9]{6,12}$/);
    expect(a).not.toBe(b);
  });
});
