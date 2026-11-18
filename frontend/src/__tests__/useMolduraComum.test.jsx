/* Dados comuns da moldura do dashboard (hotel, rent-a-car, restaurante). */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import useMolduraComum from '../pages/dashboard/useMolduraComum';
import { getResumo, getReceita } from '../services/financeiroService';
import { listReservations } from '../services/reservationsService';
import api from '../services/api';
import { TODAY } from '../pages/dashboard/shared';

vi.mock('../services/financeiroService', () => ({ getResumo: vi.fn(), getReceita: vi.fn() }));
vi.mock('../services/reservationsService', () => ({ listReservations: vi.fn() }));
vi.mock('../services/api', () => ({ default: { get: vi.fn() } }));

const ONTEM = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toLocaleDateString('en-CA'); })();
const AMANHA = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toLocaleDateString('en-CA'); })();

beforeEach(() => {
  [getResumo, getReceita, listReservations, api.get].forEach((f) => f.mockReset());
});

describe('useMolduraComum', () => {
  it('carrega_os_seis_pedidos_em_paralelo', async () => {
    const pendente = new Promise(() => {});
    getResumo.mockReturnValue(pendente);
    getReceita.mockReturnValue(pendente);
    listReservations.mockReturnValue(pendente);
    api.get.mockReturnValue(pendente);
    const { result } = renderHook(() => useMolduraComum());
    /* nenhum pedido respondeu e todos ja foram feitos */
    await waitFor(() => expect(listReservations).toHaveBeenCalledTimes(3));
    expect(getResumo).toHaveBeenCalledTimes(1);
    expect(getReceita).toHaveBeenCalledWith(expect.any(String), TODAY, 'day');
    expect(api.get).toHaveBeenCalledWith('/reviews/stats');
    const pedidos = listReservations.mock.calls.map(([p]) => p);
    expect(pedidos).toContainEqual({ payment_status: 'pending,partial' });
    expect(result.current.carregado).toBe(false);
  });

  it('cada_falha_cai_para_vazio', async () => {
    const erro = new Error('falha de rede');
    [getResumo, getReceita, listReservations, api.get].forEach((f) => f.mockRejectedValue(erro));
    const { result } = renderHook(() => useMolduraComum());
    await waitFor(() => expect(result.current.carregado).toBe(true));
    expect(result.current).toMatchObject({ resumo: null, receitaDia: [], mes: [], porPagar: [], semana: [], avaliacao: null });
  });

  it('avaliacao_so_com_total', async () => {
    getResumo.mockResolvedValue(null);
    getReceita.mockResolvedValue([]);
    listReservations.mockResolvedValue([]);
    api.get.mockResolvedValue({ data: { data: { total: 0, average: 4.2 } } });
    const { result } = renderHook(() => useMolduraComum());
    await waitFor(() => expect(result.current.carregado).toBe(true));
    expect(result.current.avaliacao).toBeNull();
  });

  it('avaliacao_com_total_vem_de_average', async () => {
    getResumo.mockResolvedValue(null);
    getReceita.mockResolvedValue([]);
    listReservations.mockResolvedValue([]);
    api.get.mockResolvedValue({ data: { data: { total: 3, average: 4.6 } } });
    const { result } = renderHook(() => useMolduraComum());
    await waitFor(() => expect(result.current.avaliacao).toBe(4.6));
  });

  it('por_pagar_filtrado', async () => {
    getResumo.mockResolvedValue({ atual: { receita: 10 } });
    getReceita.mockResolvedValue([{ periodo: TODAY, receita: 10 }]);
    const iniciada = { id: 'a', status: 'confirmed', check_in: ONTEM, payment_status: 'pending', total_price: 100 };
    const futura = { id: 'b', status: 'confirmed', check_in: AMANHA, payment_status: 'pending', total_price: 100 };
    listReservations.mockImplementation(async (p) => (p.payment_status ? [iniciada, futura] : []));
    api.get.mockResolvedValue({ data: { data: null } });
    const { result } = renderHook(() => useMolduraComum());
    await waitFor(() => expect(result.current.carregado).toBe(true));
    expect(result.current.porPagar.map((r) => r.id)).toEqual(['a']);
    expect(result.current.resumo).toEqual({ atual: { receita: 10 } });
    expect(result.current.receitaDia).toHaveLength(1);
  });
});
