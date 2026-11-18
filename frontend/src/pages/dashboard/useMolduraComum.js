import { useEffect, useState } from 'react';
import { getResumo, getReceita } from '../../services/financeiroService';
import { listReservations } from '../../services/reservationsService';
import { estadiaNoMes, estadiaProximosDias } from '../../services/reservationRanges';
import api from '../../services/api';
import { TODAY, mesAtual } from './shared';
import { unpaidReservations } from './dashboardLogic';

/* Dados comuns da moldura da vista "Hoje" (cartao de destaque, numeros, 7 dias) para hotel, rent-a-car e
   restaurante. Pedidos em paralelo; cada falha cai para vazio sem apagar os outros. */
export default function useMolduraComum() {
  const [dados, setDados] = useState({
    carregado: false, resumo: null, receitaDia: [], mes: [], porPagar: [], semana: [], avaliacao: null,
  });

  useEffect(() => {
    let ativo = true;
    const periodo = mesAtual();
    const listaOuVazio = (p) => p.then((v) => (Array.isArray(v) ? v : [])).catch(() => []);
    Promise.all([
      getResumo(periodo.inicio, periodo.fim).catch(() => null),
      listaOuVazio(getReceita(periodo.inicio, TODAY, 'day')),
      listaOuVazio(listReservations(estadiaNoMes())),
      /* Pagamentos por regularizar de qualquer mes */
      listaOuVazio(listReservations({ payment_status: 'pending,partial' })),
      listaOuVazio(listReservations(estadiaProximosDias(7))),
      /* /reviews/stats devolve { total, average }; sem avaliacoes (total 0) a media nao existe */
      api.get('/reviews/stats')
        .then((r) => {
          const s = r.data?.data;
          return Number(s?.total) > 0 ? (s.average ?? null) : null;
        })
        .catch(() => null),
    ]).then(([resumo, receitaDia, mes, porPagar, semana, avaliacao]) => {
      if (!ativo) return;
      setDados({
        carregado: true,
        resumo: resumo ?? null,
        receitaDia,
        mes,
        porPagar: unpaidReservations(porPagar, TODAY),
        semana,
        avaliacao,
      });
    });
    return () => { ativo = false; };
  }, []);

  return dados;
}
