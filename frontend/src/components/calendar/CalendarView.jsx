import { useMemo } from 'react';

const STATUS_COLOR = {
  pending:     'bg-yellow-400',
  confirmed:   'bg-blue-500',
  checked_in:  'bg-green-500',
  checked_out: 'bg-gray-400'
};

function diasDoMes(ano, mes) {
  const dias = [];
  const d = new Date(ano, mes, 1);
  while (d.getMonth() === mes) {
    dias.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return dias;
}

function toStr(d) {
  return d.toISOString().split('T')[0];
}

export default function CalendarView({ units, reservations, blockedDates, ano, mes }) {
  const dias = useMemo(() => diasDoMes(ano, mes), [ano, mes]);

  // Indexar reservas e bloqueios por unidade+data para lookup O(1)
  const reservasPorUnidadeData = useMemo(() => {
    const map = {};
    for (const r of reservations) {
      const dtIn = new Date(r.check_in + 'T00:00:00');
      const dtOut = new Date(r.check_out + 'T00:00:00');
      const cur = new Date(dtIn);
      while (cur < dtOut) {
        const key = `${r.unit_id}_${toStr(cur)}`;
        map[key] = r;
        cur.setDate(cur.getDate() + 1);
      }
    }
    return map;
  }, [reservations]);

  const bloqueiosPorUnidadeData = useMemo(() => {
    const set = new Set();
    for (const b of blockedDates) {
      set.add(`${b.unit_id}_${b.date}`);
    }
    return set;
  }, [blockedDates]);

  const hoje = toStr(new Date());

  return (
    <div className="overflow-x-auto">
      <div className="min-w-max">
        {/* Cabeçalho dos dias */}
        <div className="flex">
          <div className="w-40 shrink-0" />
          {dias.map((d) => {
            const str = toStr(d);
            const isHoje = str === hoje;
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            return (
              <div
                key={str}
                className={`w-9 text-center text-xs py-1 border-l border-gray-200 font-medium
                  ${isHoje ? 'bg-primary-500 text-white' : isWeekend ? 'text-gray-400 bg-gray-50' : 'text-gray-500'}`}
              >
                <div>{d.getDate()}</div>
                <div className="text-gray-400 font-normal">{['D','S','T','Q','Q','S','S'][d.getDay()]}</div>
              </div>
            );
          })}
        </div>

        {/* Linhas por unidade */}
        {units.map((unit, i) => (
          <div key={unit.id} className={`flex items-center border-t border-gray-200 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
            <div className="w-40 shrink-0 px-3 py-2">
              <p className="text-sm font-medium text-gray-800 truncate">{unit.name}</p>
              <p className="text-xs text-gray-400">{unit.unit_type}</p>
            </div>

            {dias.map((d) => {
              const str = toStr(d);
              const key = `${unit.id}_${str}`;
              const reserva = reservasPorUnidadeData[key];
              const bloqueado = bloqueiosPorUnidadeData.has(key);
              const isHoje = str === hoje;

              return (
                <div
                  key={str}
                  title={reserva ? `${reserva.customer_name} (${reserva.status})` : bloqueado ? 'Bloqueado' : ''}
                  className={`w-9 h-10 border-l border-gray-200 flex items-center justify-center
                    ${isHoje ? 'bg-primary-50' : ''}
                    ${reserva ? STATUS_COLOR[reserva.status] + ' cursor-pointer' : ''}
                    ${bloqueado && !reserva ? 'bg-gray-300' : ''}
                  `}
                />
              );
            })}
          </div>
        ))}

        {units.length === 0 && (
          <div className="flex items-center justify-center h-24 text-gray-400 text-sm">
            Sem unidades activas
          </div>
        )}
      </div>

      {/* Legenda */}
      <div className="flex gap-4 mt-4 text-xs text-gray-600">
        {Object.entries(STATUS_COLOR).map(([status, cls]) => (
          <span key={status} className="flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded-sm ${cls}`} />
            {status === 'pending' ? 'Pendente' : status === 'confirmed' ? 'Confirmada' : status === 'checked_in' ? 'Check-in' : 'Check-out'}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-gray-300" />
          Bloqueado
        </span>
      </div>
    </div>
  );
}
