import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useNavCounters } from '../hooks/useNavCounters';
import { listReservations } from '../services/reservationsService';
import { getUnreadCount } from '../services/messageService';

vi.mock('../services/reservationsService', () => ({ listReservations: vi.fn() }));
vi.mock('../services/messageService', () => ({ getUnreadCount: vi.fn() }));

/* QueryClient novo por teste, sem retry, para nao haver estado partilhado */
function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useNavCounters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devolve os contadores', async () => {
    listReservations.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]);
    getUnreadCount.mockResolvedValue(5);

    const { result } = renderHook(() => useNavCounters(), { wrapper: wrapper() });

    await waitFor(() => {
      expect(result.current).toEqual({ '/reservas': 3, '/mensagens': 5 });
    });
  });

  it('chama listReservations com status pending', async () => {
    listReservations.mockResolvedValue([]);
    getUnreadCount.mockResolvedValue(0);

    renderHook(() => useNavCounters(), { wrapper: wrapper() });

    await waitFor(() => {
      expect(listReservations).toHaveBeenCalledWith({ status: 'pending' });
    });
  });

  it('falha de rede da 0', async () => {
    listReservations.mockRejectedValue(new Error('rede'));
    getUnreadCount.mockRejectedValue(new Error('rede'));

    const { result } = renderHook(() => useNavCounters(), { wrapper: wrapper() });

    await waitFor(() => {
      expect(listReservations).toHaveBeenCalled();
      expect(getUnreadCount).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(result.current).toEqual({ '/reservas': 0, '/mensagens': 0 });
    });
  });
});
