import { describe, expect, it } from 'vitest';
import { camposAlterados } from '../utils/camposAlterados';

describe('camposAlterados', () => {
  it('so_devolve_os_campos_que_mudaram', () => {
    expect(camposAlterados({ a: 1, b: 'x', c: null }, { a: 1, b: 'y', c: null })).toEqual({ b: 'y' });
  });
  it('listas_e_objectos_contam_pelo_conteudo', () => {
    const base = { fotos: ['a', 'b'], chat: { on: true, dias: [1, 2] } };
    expect(camposAlterados(base, { fotos: ['a', 'b'], chat: { on: true, dias: [1, 2] } })).toEqual({});
    expect(camposAlterados(base, { fotos: ['b', 'a'], chat: { on: true, dias: [1] } }))
      .toEqual({ fotos: ['b', 'a'], chat: { on: true, dias: [1] } });
  });
  it('null_e_ausente_sao_iguais_mas_vazio_e_valor_nao', () => {
    expect(camposAlterados({ a: null }, { a: undefined })).toEqual({});
    expect(camposAlterados({}, { a: null })).toEqual({});
    expect(camposAlterados({ a: 'x' }, { a: '' })).toEqual({ a: '' });
    expect(camposAlterados({ a: 0 }, { a: null })).toEqual({ a: null });
  });
  it('sem_base_tudo_conta_como_alterado', () => {
    expect(camposAlterados(null, { a: 1 })).toEqual({ a: 1 });
  });
});
