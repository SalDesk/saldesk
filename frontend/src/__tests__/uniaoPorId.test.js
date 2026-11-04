import { describe, expect, it } from 'vitest';
import { uniaoPorId } from '../pages/dashboard/shared';

describe('uniaoPorId', () => {
  it('junta as listas por ordem e tira repetidos pelo id, ficando com a primeira', () => {
    const a = { id: 'a', n: 1 };
    const b = { id: 'b', n: 2 };
    const aRepetido = { id: 'a', n: 99 };
    const c = { id: 'c', n: 3 };
    const r = uniaoPorId([a, b], [aRepetido, c]);
    expect(r).toEqual([a, b, c]);
    /* a primeira ocorrencia e a que fica (o resultado do pedido de sobreposicao) */
    expect(r[0]).toBe(a);
  });

  it('tolera entradas que nao sao listas', () => {
    expect(uniaoPorId(undefined, null, 'x', 5, { id: 'a' }, [{ id: 'z' }])).toEqual([{ id: 'z' }]);
    expect(uniaoPorId()).toEqual([]);
    expect(uniaoPorId(null)).toEqual([]);
  });

  it('mantem os itens sem id, mesmo que sejam o mesmo objeto repetido', () => {
    const semId = { status: 'pending' };
    const outro = { status: 'confirmed', id: undefined };
    expect(uniaoPorId([semId, { id: 'a' }], [semId, outro, { id: 'a' }])).toEqual([
      semId, { id: 'a' }, semId, outro,
    ]);
  });

  it('ignora entradas nulas dentro das listas sem rebentar', () => {
    expect(uniaoPorId([null, { id: 'a' }, undefined])).toEqual([null, { id: 'a' }, undefined]);
  });

  it('nao altera as listas recebidas', () => {
    const l1 = [{ id: 'a' }];
    const l2 = [{ id: 'a' }, { id: 'b' }];
    uniaoPorId(l1, l2);
    expect(l1).toHaveLength(1);
    expect(l2).toHaveLength(2);
  });
});
