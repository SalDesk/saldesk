import { useQuery } from '@tanstack/react-query';
import { listReservations } from '../services/reservationsService';
import { getUnreadCount } from '../services/messageService';

/* Contadores da navegacao lateral: reservas pendentes e mensagens nao
   lidas. Atualiza de 60 em 60 segundos. Se a chamada falhar, o erro e
   engolido aqui (sem console nem excecao) e o contador fica a 0, para
   a navegacao nunca partir por causa de um badge. */
const INTERVALO_MS = 60_000;

export function useNavCounters() {
  const reservas = useQuery({
    queryKey: ['nav', 'pendingReservations'],
    queryFn: async () => {
      try {
        const lista = await listReservations({ status: 'pending' });
        return Array.isArray(lista) ? lista.length : 0;
      } catch {
        return 0;
      }
    },
    refetchInterval: INTERVALO_MS,
    retry: false,
  });

  const mensagens = useQuery({
    queryKey: ['nav', 'unreadMessages'],
    queryFn: async () => {
      try {
        return (await getUnreadCount()) || 0;
      } catch {
        return 0;
      }
    },
    refetchInterval: INTERVALO_MS,
    retry: false,
  });

  return {
    '/reservas': reservas.data ?? 0,
    '/mensagens': mensagens.data ?? 0,
  };
}
