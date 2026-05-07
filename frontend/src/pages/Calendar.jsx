import { usePageTitle } from '../hooks/usePageTitle';
import { useState, useEffect } from 'react';
import CalendarView from '../components/calendar/CalendarView';
import { getCalendar } from '../services/calendarService';
import useAuthStore from '../store/authStore';

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

export default function Calendar() {
  usePageTitle('Calendário');
  const token = useAuthStore((s) => s.token);
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth());
  const [dados, setDados] = useState({ units: [], reservations: [], blocked_dates: [] });
  const [loading, setLoading] = useState(true);

  async function carregar(a, m) {
    setLoading(true);
    try {
      const start = `${a}-${String(m + 1).padStart(2, '0')}-01`;
      const ultimo = new Date(a, m + 1, 0).getDate();
      const end = `${a}-${String(m + 1).padStart(2, '0')}-${ultimo}`;
      const { data } = await getCalendar(token, start, end);
      setDados(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(ano, mes); }, [ano, mes]);

  function navMes(delta) {
    let nm = mes + delta;
    let na = ano;
    if (nm < 0) { nm = 11; na--; }
    if (nm > 11) { nm = 0; na++; }
    setMes(nm);
    setAno(na);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Calendário</h1>
        <div className="flex items-center gap-3">
          <button onClick={() => navMes(-1)} className="btn-secondary px-3 py-1.5">‹</button>
          <span className="font-semibold text-gray-800 min-w-[160px] text-center">
            {MESES[mes]} {ano}
          </span>
          <button onClick={() => navMes(1)} className="btn-secondary px-3 py-1.5">›</button>
          <button
            onClick={() => { setAno(hoje.getFullYear()); setMes(hoje.getMonth()); }}
            className="btn-secondary text-sm px-3 py-1.5"
          >
            Hoje
          </button>
        </div>
      </div>

      <div className="card overflow-hidden p-4">
        {loading ? (
          <div className="text-center py-16 text-gray-400">A carregar...</div>
        ) : (
          <CalendarView
            units={dados.units}
            reservations={dados.reservations}
            blockedDates={dados.blocked_dates}
            ano={ano}
            mes={mes}
          />
        )}
      </div>
    </div>
  );
}
