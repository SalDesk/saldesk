import { useMemo, useRef } from 'react';

const STATUS_COLORS = {
  confirmed:   'bg-ocean-700 text-white',
  pending:     'bg-sand-400 text-n-900',
  checked_in:  'bg-[var(--success)] text-white',
  checked_out: 'bg-n-300 text-n-700',
  cancelled:   'bg-n-200 text-n-400 line-through',
};

const WEEK_DAYS = ['D','S','T','Q','Q','S','S'];

function getDaysInMonth(year, month) {
  const total = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: total }, (_, i) => new Date(year, month, i + 1));
}

function toDateStr(d) {
  return d.toISOString().split('T')[0];
}

function isFromSeller(reservation) {
  return reservation?.source === 'manual' && reservation?.notes?.startsWith('Vendedor:');
}

function getSellerName(reservation) {
  if (!isFromSeller(reservation)) return null;
  const match = reservation.notes.match(/^Vendedor:\s*([^(]+)\(/);
  return match ? match[1].trim() : null;
}

export default function CalendarView({
  year, month, units, reservations, blockedDates,
  onDayClick, onEventClick,
  onDrop, draggingId,
  filterUnit,
}) {
  const days         = useMemo(() => getDaysInMonth(year, month), [year, month]);
  const todayStr     = toDateStr(new Date());
  const dragDataRef  = useRef(null);

  const visibleUnits = filterUnit
    ? (units || []).filter(u => u.id === filterUnit)
    : (units || []);

  const reservationsByUnit = useMemo(() => {
    const map = {};
    for (const r of reservations || []) {
      if (!map[r.unit_id]) map[r.unit_id] = [];
      map[r.unit_id].push(r);
    }
    return map;
  }, [reservations]);

  const blockedByUnit = useMemo(() => {
    const map = {};
    for (const b of blockedDates || []) {
      if (!map[b.unit_id]) map[b.unit_id] = new Set();
      map[b.unit_id].add(b.date || b.start_date);
    }
    return map;
  }, [blockedDates]);

  if (!visibleUnits.length) {
    return (
      <div className="flex items-center justify-center py-20 text-n-400">
        <p className="font-body text-sm">Sem unidades activas. Crie unidades primeiro.</p>
      </div>
    );
  }

  function handleDragStart(e, reservation) {
    const dur = (reservation.check_in && reservation.check_out)
      ? Math.max(1, Math.round((new Date(reservation.check_out) - new Date(reservation.check_in)) / 86400000))
      : 1;
    const payload = { reservationId: reservation.id, duration: dur, unitId: reservation.unit_id };
    dragDataRef.current = payload;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify(payload));
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function handleDrop(e, dateStr, unit) {
    e.preventDefault();
    let payload = dragDataRef.current;
    try {
      const raw = e.dataTransfer.getData('text/plain');
      if (raw) payload = JSON.parse(raw);
    } catch {}
    if (payload?.reservationId) onDrop?.(dateStr, unit.id, payload);
  }

  return (
    <div className="overflow-x-auto rounded-md border border-n-200">
      <table className="w-full text-xs border-collapse" style={{ minWidth: visibleUnits.length * 130 + 80 }}>
        <thead>
          <tr className="bg-n-50">
            <th className="sticky left-0 z-10 bg-n-50 border-b border-r border-n-200 px-3 py-2.5 text-left text-n-500 font-body font-bold uppercase tracking-wide w-20 min-w-[80px]">
              Dia
            </th>
            {visibleUnits.map((u) => (
              <th key={u.id} className="border-b border-r border-n-200 px-3 py-2.5 text-left min-w-[130px]">
                <div className="font-display font-semibold text-n-700 truncate">{u.name}</div>
                <div className="font-body text-n-400 font-normal mt-0.5">{u.unit_type}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((day) => {
            const dateStr  = toDateStr(day);
            const isToday  = dateStr === todayStr;
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;

            return (
              <tr key={dateStr} className={`border-b border-n-100 hover:bg-n-50/50 ${isWeekend ? 'bg-n-50/30' : ''}`}>
                <td className={`sticky left-0 z-10 border-r border-n-200 px-3 py-1.5 font-body font-medium whitespace-nowrap ${isToday ? 'bg-ocean-50 text-ocean-700' : 'bg-white text-n-600'}`}>
                  <div className="flex items-center gap-1.5">
                    {isToday && <span className="w-1.5 h-1.5 rounded-full bg-ocean-700 shrink-0" />}
                    <span className="font-display font-semibold">{day.getDate()}</span>
                    <span className="text-n-300">{WEEK_DAYS[day.getDay()]}</span>
                  </div>
                </td>

                {visibleUnits.map((unit) => {
                  const isBlocked   = blockedByUnit[unit.id]?.has(dateStr);
                  const reservation = reservationsByUnit[unit.id]?.find(
                    (r) => r.check_in <= dateStr && (r.check_out > dateStr || r.check_in === r.check_out)
                  );
                  const isDragging = reservation?.id === draggingId;

                  return (
                    <td
                      key={unit.id}
                      className="border-r border-n-100 px-1.5 py-1 cursor-pointer"
                      onClick={() => !reservation && !isBlocked && onDayClick?.(dateStr, unit, null)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, dateStr, unit)}
                    >
                      {reservation ? (
                        <div
                          draggable
                          onDragStart={(e) => handleDragStart(e, reservation)}
                          onClick={(e) => { e.stopPropagation(); onEventClick?.(reservation); }}
                          className={`relative rounded-xs px-2 py-0.5 truncate font-body font-medium cursor-grab active:cursor-grabbing select-none transition-opacity ${STATUS_COLORS[reservation.status] || 'bg-n-100 text-n-600'} ${isDragging ? 'opacity-30' : ''} ${isFromSeller(reservation) ? 'border-l-[3px] border-l-sand-500' : ''}`}
                          title={
                            isFromSeller(reservation)
                              ? `${reservation.customer_name} · ${reservation.status} · Vendido por ${getSellerName(reservation)}`
                              : `${reservation.customer_name} · ${reservation.status}`
                          }
                        >
                          {isFromSeller(reservation) && (
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-sand-500 mr-1 shrink-0" aria-hidden="true" />
                          )}
                          {reservation.check_in === dateStr ? reservation.customer_name : '·'}
                        </div>
                      ) : isBlocked ? (
                        <div className="rounded-xs px-2 py-0.5 bg-n-200 text-n-400 font-body">
                          Bloq.
                        </div>
                      ) : (
                        <div className="h-5" />
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
