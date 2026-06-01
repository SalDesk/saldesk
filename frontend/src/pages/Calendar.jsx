import { useState, useEffect, useMemo, useRef } from 'react';
import {
  ChevronLeft, ChevronRight, Lock,
  CheckCircle, LogIn, LogOut, XCircle, X, Users,
} from 'lucide-react';
import {
  getCalendar, createBlockedDates, deleteBlockedDate, updateReservation,
} from '../services/calendarService';
import { listStaff } from '../services/staffService';
import { useT } from '../i18n';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import CalendarView from '../components/calendar/CalendarView';
import LoadingSpinner from '../components/shared/LoadingSpinner';

const MESES_PT = ['Janeiro','Fevereiro','Marco','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DIAS_ABR  = ['Dom','Seg','Ter','Qua','Qui','Sex','Sab'];

const STATUS_COLORS = {
  confirmed:   'bg-ocean-700 text-white',
  pending:     'bg-sand-400 text-n-900',
  checked_in:  'bg-[var(--success)] text-white',
  checked_out: 'bg-n-300 text-n-700',
  cancelled:   'bg-n-200 text-n-400',
  no_show:     'bg-n-200 text-n-400',
};

const STATUS_LABELS = {
  confirmed: 'Confirmada', pending: 'Pendente',
  checked_in: 'Check-in', checked_out: 'Check-out',
  cancelled: 'Cancelada', no_show: 'No Show',
};

const LEGEND = [
  { label: 'Confirmada', cls: 'bg-ocean-700' },
  { label: 'Pendente',   cls: 'bg-sand-400' },
  { label: 'Check-in',   cls: 'bg-[var(--success)]' },
  { label: 'Check-out',  cls: 'bg-n-300' },
  { label: 'Bloqueado',  cls: 'bg-n-200 border border-n-300' },
];

function toDateStr(d) {
  return d.toISOString().split('T')[0];
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split('T')[0];
}

function getWeekStart(dateStr) {
  const d   = new Date(dateStr + 'T00:00:00Z');
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().split('T')[0];
}

function getWeekDays(startStr) {
  return Array.from({ length: 7 }, (_, i) => addDays(startStr, i));
}

export default function Calendar() {
  const t    = useT();
  const hoje = new Date();

  const [view,        setView]       = useState('month');
  const [ano,         setAno]        = useState(hoje.getFullYear());
  const [mes,         setMes]        = useState(hoje.getMonth());
  const [weekStr,     setWeekStr]    = useState(getWeekStart(toDateStr(hoje)));
  const [dayStr,      setDayStr]     = useState(toDateStr(hoje));
  const [filterUnit,  setFilterUnit] = useState('');
  const [filterGuide, setFilterGuide]= useState('');
  const [guides,      setGuides]     = useState([]);
  const [dados,       setDados]      = useState({ units: [], reservations: [], blocked_dates: [] });
  const [loading,     setLoading]    = useState(true);
  const [draggingId,  setDraggingId] = useState(null);

  const [blockModal,   setBlockModal]   = useState(null);
  const [blockEnd,     setBlockEnd]     = useState('');
  const [blockReason,  setBlockReason]  = useState('');
  const [blockLoading, setBlockLoading] = useState(false);

  const [selectedEvent, setSelectedEvent] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const dragPayloadRef = useRef(null);

  async function carregar() {
    setLoading(true);
    try {
      let start, end;
      if (view === 'month') {
        const last = new Date(ano, mes + 1, 0).getDate();
        start = `${ano}-${String(mes + 1).padStart(2, '0')}-01`;
        end   = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
      } else if (view === 'week') {
        start = weekStr;
        end   = addDays(weekStr, 6);
      } else {
        start = dayStr;
        end   = dayStr;
      }
      const data = await getCalendar(start, end);
      setDados(data || { units: [], reservations: [], blocked_dates: [] });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { carregar(); }, [view, ano, mes, weekStr, dayStr]);

  useEffect(() => {
    listStaff().then(setGuides).catch(() => {});
  }, []);

  function navigate(dir) {
    if (view === 'month') {
      let nm = mes + dir, na = ano;
      if (nm < 0)  { nm = 11; na--; }
      if (nm > 11) { nm = 0;  na++; }
      setMes(nm); setAno(na);
    } else if (view === 'week') {
      setWeekStr(prev => addDays(prev, dir * 7));
    } else {
      setDayStr(prev => addDays(prev, dir));
    }
  }

  function getNavLabel() {
    if (view === 'month') return `${MESES_PT[mes]} ${ano}`;
    if (view === 'week') {
      const endStr = addDays(weekStr, 6);
      const sd = new Date(weekStr + 'T00:00:00Z');
      const ed = new Date(endStr   + 'T00:00:00Z');
      const sm = MESES_PT[sd.getUTCMonth()].slice(0, 3);
      const em = MESES_PT[ed.getUTCMonth()].slice(0, 3);
      return sd.getUTCMonth() === ed.getUTCMonth()
        ? `${sd.getUTCDate()} - ${ed.getUTCDate()} ${em} ${ed.getUTCFullYear()}`
        : `${sd.getUTCDate()} ${sm} - ${ed.getUTCDate()} ${em} ${ed.getUTCFullYear()}`;
    }
    const d = new Date(dayStr + 'T00:00:00Z');
    return `${d.getUTCDate()} ${MESES_PT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }

  function handleDayClick(dateStr, unit, reservation) {
    if (reservation) { setSelectedEvent(reservation); return; }
    setBlockReason('');
    setBlockEnd(dateStr);
    setBlockModal({ date: dateStr, unit });
  }

  async function handleDrop(dateStr, unitId, dragData) {
    const { reservationId, duration } = dragData;
    setDraggingId(reservationId);
    try {
      await updateReservation(reservationId, {
        check_in:  dateStr,
        check_out: addDays(dateStr, duration),
        unit_id:   unitId,
      });
      await carregar();
    } catch (err) {
      console.error(err);
    } finally {
      setDraggingId(null);
    }
  }

  async function handleBlock() {
    if (!blockModal) return;
    setBlockLoading(true);
    try {
      const endDate = blockEnd && blockEnd >= blockModal.date ? blockEnd : blockModal.date;
      const dates = [];
      let cur = blockModal.date;
      while (cur <= endDate) { dates.push(cur); cur = addDays(cur, 1); }
      await createBlockedDates({ unit_id: blockModal.unit.id, dates, reason: blockReason || null });
      await carregar();
      setBlockModal(null);
    } catch (err) {
      console.error(err);
    } finally {
      setBlockLoading(false);
    }
  }

  async function handleUnblock(id) {
    try {
      await deleteBlockedDate(id);
      await carregar();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleStatusChange(id, status) {
    setActionLoading(true);
    try {
      await updateReservation(id, { status });
      setSelectedEvent(prev => prev ? { ...prev, status } : null);
      await carregar();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  }

  // If guide filter active, show only units assigned to that guide via reservations
  const guideResUnitIds = useMemo(() => {
    if (!filterGuide) return null;
    const ids = new Set();
    for (const r of dados.reservations || []) {
      if (r.staff_id === filterGuide || r.guide_id === filterGuide) ids.add(r.unit_id);
    }
    return ids;
  }, [filterGuide, dados.reservations]);

  const visibleUnits = (dados.units || []).filter(u => {
    if (filterUnit  && u.id !== filterUnit)              return false;
    if (guideResUnitIds && !guideResUnitIds.has(u.id))   return false;
    return true;
  });

  const resByUnit = useMemo(() => {
    const map = {};
    for (const r of dados.reservations || []) {
      if (!map[r.unit_id]) map[r.unit_id] = [];
      map[r.unit_id].push(r);
    }
    return map;
  }, [dados.reservations]);

  const blockedByUnit = useMemo(() => {
    const map = {};
    for (const b of dados.blocked_dates || []) {
      if (!map[b.unit_id]) map[b.unit_id] = new Set();
      map[b.unit_id].add(b.date || b.start_date);
    }
    return map;
  }, [dados.blocked_dates]);

  const weekDays = useMemo(() => getWeekDays(weekStr), [weekStr]);

  function getResForCell(unitId, dateStr) {
    return resByUnit[unitId]?.find(r => r.check_in <= dateStr && r.check_out > dateStr);
  }

  function getSlotsForCell(unit, dateStr) {
    const res = resByUnit[unit.id]?.filter(r => r.check_in === dateStr) || [];
    const booked = res.reduce((s, r) => s + (r.guests || 1), 0);
    const total  = unit.capacity || 0;
    return total > 0 ? { booked, available: Math.max(0, total - booked), total } : null;
  }

  const todayStr = toDateStr(hoje);

  /* ---- WEEK VIEW ---- */
  function renderWeekView() {
    return (
      <div className="overflow-x-auto rounded-md border border-n-200">
        <table className="w-full text-xs border-collapse" style={{ minWidth: Math.max(480, visibleUnits.length * 90 + 120) }}>
          <thead>
            <tr className="bg-n-50">
              <th className="sticky left-0 z-10 bg-n-50 border-b border-r border-n-200 px-3 py-2.5 text-left text-n-500 font-body font-bold uppercase tracking-wide min-w-[112px]">
                Unidade
              </th>
              {weekDays.map(d => {
                const isToday  = d === todayStr;
                const dayNum   = parseInt(d.slice(8), 10);
                const dayOfWk  = new Date(d + 'T00:00:00Z').getUTCDay();
                return (
                  <th key={d} className={`border-b border-r border-n-200 px-2 py-2 text-center min-w-[80px] ${isToday ? 'bg-ocean-50' : ''}`}>
                    <div className={`font-display font-semibold ${isToday ? 'text-ocean-700' : 'text-n-700'}`}>{dayNum}</div>
                    <div className="font-body text-n-400 font-normal">{DIAS_ABR[dayOfWk]}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visibleUnits.map(unit => (
              <tr key={unit.id} className="border-b border-n-100 hover:bg-n-50/50">
                <td className="sticky left-0 z-10 bg-white border-r border-n-200 px-3 py-2">
                  <div className="font-body font-semibold text-n-800 truncate max-w-[100px] text-xs">{unit.name}</div>
                  <div className="font-body text-n-400 text-xs truncate">{unit.unit_type}</div>
                </td>
                {weekDays.map(d => {
                  const isBlocked = blockedByUnit[unit.id]?.has(d);
                  const res       = getResForCell(unit.id, d);
                  const isToday   = d === todayStr;
                  const isDragging = res?.id === draggingId;

                  return (
                    <td
                      key={d}
                      className={`border-r border-n-100 px-1.5 py-1.5 cursor-pointer ${isToday ? 'bg-ocean-50/40' : ''}`}
                      onClick={() => !res && !isBlocked && handleDayClick(d, unit, null)}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => {
                        e.preventDefault();
                        const raw = e.dataTransfer.getData('text/plain');
                        try {
                          const data = JSON.parse(raw || '{}');
                          if (data.reservationId) handleDrop(d, unit.id, data);
                        } catch {}
                      }}
                    >
                      {res ? (
                        <div className="space-y-0.5">
                          <div
                            draggable
                            onDragStart={e => {
                              const dur = Math.max(1, Math.round((new Date(res.check_out) - new Date(res.check_in)) / 86400000));
                              const payload = { reservationId: res.id, duration: dur, unitId: res.unit_id };
                              dragPayloadRef.current = payload;
                              e.dataTransfer.setData('text/plain', JSON.stringify(payload));
                            }}
                            onClick={e => { e.stopPropagation(); setSelectedEvent(res); }}
                            className={`rounded-xs px-2 py-0.5 truncate font-body font-medium cursor-grab active:cursor-grabbing select-none transition-opacity ${STATUS_COLORS[res.status] || 'bg-n-100 text-n-600'} ${isDragging ? 'opacity-30' : ''}`}
                            title={`${res.customer_name} · ${STATUS_LABELS[res.status]}`}
                          >
                            {res.check_in === d ? res.customer_name.split(' ')[0] : '·'}
                          </div>
                          {(() => {
                            const slots = getSlotsForCell(unit, d);
                            return slots && res.check_in === d ? (
                              <div className={`text-[9px] font-mono text-center ${slots.available === 0 ? 'text-error' : 'text-n-400'}`}>
                                {slots.available}/{slots.total} vagas
                              </div>
                            ) : null;
                          })()}
                        </div>
                      ) : isBlocked ? (
                        <div className="rounded-xs px-2 py-0.5 bg-n-200 text-n-400 font-body text-center">Bloq.</div>
                      ) : (
                        <>
                          <div className="h-5" />
                          {(() => {
                            const slots = getSlotsForCell(unit, d);
                            return slots ? (
                              <div className="text-[9px] font-mono text-center text-n-300">
                                {slots.available}/{slots.total}
                              </div>
                            ) : null;
                          })()}
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {!visibleUnits.length && (
              <tr>
                <td colSpan={8} className="py-12 text-center text-n-400 text-sm font-body">
                  Sem unidades activas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  /* ---- DAY VIEW ---- */
  function renderDayView() {
    const d     = new Date(dayStr + 'T00:00:00Z');
    const label = `${d.getUTCDate()} de ${MESES_PT[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
    return (
      <div className="space-y-3">
        <p className="text-sm font-body font-semibold text-n-700">{label}</p>
        {!visibleUnits.length && (
          <div className="text-center py-12 text-n-400 text-sm font-body">Sem unidades activas.</div>
        )}
        {visibleUnits.map(unit => {
          const res       = getResForCell(unit.id, dayStr);
          const isBlocked = blockedByUnit[unit.id]?.has(dayStr);
          return (
            <div key={unit.id} className="bg-white border border-n-200 rounded-md p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-display font-semibold text-sm text-n-900">{unit.name}</p>
                  <p className="text-xs font-body text-n-400">{unit.unit_type}</p>
                </div>
                {!res && !isBlocked && (
                  <Button variant="ghost" size="sm" icon={Lock} onClick={() => {
                    setBlockReason(''); setBlockEnd(dayStr);
                    setBlockModal({ date: dayStr, unit });
                  }}>
                    Bloquear
                  </Button>
                )}
              </div>

              {res ? (
                <button
                  onClick={() => setSelectedEvent(res)}
                  className={`w-full text-left rounded-sm px-3 py-2.5 transition-opacity hover:opacity-90 ${STATUS_COLORS[res.status] || 'bg-n-100 text-n-600'}`}
                >
                  <p className="font-display font-semibold text-sm">{res.customer_name}</p>
                  <p className="text-xs opacity-80 mt-0.5">
                    {STATUS_LABELS[res.status]} · {res.guests || 1} pax
                    {res.total_amount ? ` · €${Number(res.total_amount).toLocaleString('pt-PT')}` : ''}
                    {(() => {
                      const slots = getSlotsForCell(unit, dayStr);
                      return slots ? ` · ${slots.available} vagas restantes` : '';
                    })()}
                  </p>
                </button>
              ) : isBlocked ? (
                <div className="flex items-center justify-between bg-n-100 rounded-sm px-3 py-2">
                  <span className="text-xs font-body text-n-500">Bloqueado</span>
                  <button
                    className="text-xs font-body text-error hover:underline"
                    onClick={() => {
                      const b = (dados.blocked_dates || []).find(
                        x => x.unit_id === unit.id && (x.date === dayStr || x.start_date === dayStr)
                      );
                      if (b) handleUnblock(b.id);
                    }}
                  >
                    Desbloquear
                  </button>
                </div>
              ) : (
                <div className="text-center py-4 text-n-400 text-xs font-body">Disponivel</div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  const selectedUnit = (dados.units || []).find(u => u.id === selectedEvent?.unit_id);

  return (
    <div>
      <PageHeader
        title={t('nav.calendar')}
        subtitle="Gerir disponibilidade e reservas"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {/* View toggle */}
            <div className="flex rounded-sm border border-n-200 overflow-hidden">
              {[
                { id: 'month', label: 'Mes' },
                { id: 'week',  label: 'Semana' },
                { id: 'day',   label: 'Dia' },
              ].map(v => (
                <button
                  key={v.id}
                  onClick={() => setView(v.id)}
                  className={`px-3 py-1.5 text-xs font-body font-semibold transition-colors ${view === v.id ? 'bg-ocean-700 text-white' : 'bg-white text-n-600 hover:bg-n-50'}`}
                >
                  {v.label}
                </button>
              ))}
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" icon={ChevronLeft} onClick={() => navigate(-1)} />
              <span className="font-display font-semibold text-sm text-n-800 min-w-[160px] text-center">
                {getNavLabel()}
              </span>
              <Button variant="ghost" size="sm" icon={ChevronRight} onClick={() => navigate(1)} />
            </div>

            {/* Unit filter */}
            {(dados.units || []).length > 1 && (
              <select value={filterUnit} onChange={e => setFilterUnit(e.target.value)}
                className="h-8 px-2 rounded-sm border border-n-200 text-xs font-body text-n-700 bg-white focus:outline-none focus:ring-1 focus:ring-ocean-300">
                <option value="">Todas as unidades</option>
                {(dados.units || []).map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            )}

            {/* Guide filter */}
            {guides.length > 0 && (
              <select value={filterGuide} onChange={e => setFilterGuide(e.target.value)}
                className="h-8 px-2 rounded-sm border border-n-200 text-xs font-body text-n-700 bg-white focus:outline-none focus:ring-1 focus:ring-ocean-300">
                <option value="">Todos os guias</option>
                {guides.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            )}
          </div>
        }
      />

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4">
        {LEGEND.map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded-xs ${l.cls}`} />
            <span className="text-xs font-body text-n-500">{l.label}</span>
          </div>
        ))}
      </div>

      {/* Main view */}
      {loading ? (
        <div className="flex justify-center py-20"><LoadingSpinner size={32} /></div>
      ) : view === 'month' ? (
        <CalendarView
          year={ano} month={mes}
          units={dados.units || []}
          reservations={dados.reservations || []}
          blockedDates={dados.blocked_dates || []}
          filterUnit={filterUnit}
          onDayClick={handleDayClick}
          onEventClick={res => setSelectedEvent(res)}
          onDrop={handleDrop}
          draggingId={draggingId}
        />
      ) : view === 'week' ? renderWeekView() : renderDayView()}

      {/* Block modal */}
      <Modal
        open={!!blockModal}
        onClose={() => setBlockModal(null)}
        title="Bloquear datas"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setBlockModal(null)}>Cancelar</Button>
            <Button loading={blockLoading} onClick={handleBlock} icon={Lock}>Bloquear</Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm font-body font-semibold text-n-800">{blockModal?.unit?.name}</p>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Data inicio" type="date" value={blockModal?.date || ''} readOnly />
            <Input
              label="Data fim"
              type="date"
              value={blockEnd}
              onChange={e => setBlockEnd(e.target.value)}
              min={blockModal?.date}
            />
          </div>
          <Input
            label="Motivo (opcional)"
            value={blockReason}
            onChange={e => setBlockReason(e.target.value)}
            placeholder="Manutencao, uso proprio..."
          />
        </div>
      </Modal>

      {/* Event detail modal */}
      <Modal
        open={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        title="Detalhe da reserva"
        size="sm"
      >
        {selectedEvent && (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <p className="font-display font-bold text-lg text-n-900 leading-tight">{selectedEvent.customer_name}</p>
              <span className={`shrink-0 text-xs font-body font-semibold px-2 py-0.5 rounded-xs ${STATUS_COLORS[selectedEvent.status] || 'bg-n-100 text-n-600'}`}>
                {STATUS_LABELS[selectedEvent.status] || selectedEvent.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm font-body">
              <div className="bg-n-50 rounded-sm p-3">
                <p className="text-xs text-n-400 mb-0.5">Check-in</p>
                <p className="font-semibold text-n-800">{selectedEvent.check_in}</p>
              </div>
              <div className="bg-n-50 rounded-sm p-3">
                <p className="text-xs text-n-400 mb-0.5">Check-out</p>
                <p className="font-semibold text-n-800">{selectedEvent.check_out}</p>
              </div>
              {selectedUnit && (
                <div className="bg-n-50 rounded-sm p-3">
                  <p className="text-xs text-n-400 mb-0.5">Unidade</p>
                  <p className="font-semibold text-n-800">{selectedUnit.name}</p>
                </div>
              )}
              <div className="bg-n-50 rounded-sm p-3">
                <p className="text-xs text-n-400 mb-0.5">Hospedes</p>
                <p className="font-semibold text-n-800">{selectedEvent.guests || 1}</p>
              </div>
              {selectedEvent.total_amount && (
                <div className="bg-n-50 rounded-sm p-3 col-span-2">
                  <p className="text-xs text-n-400 mb-0.5">Total</p>
                  <p className="font-semibold text-n-800">
                    €{Number(selectedEvent.total_amount).toLocaleString('pt-PT')}
                    {selectedEvent.payment_status === 'paid' && (
                      <span className="ml-2 text-xs font-normal text-[var(--success)]">Pago</span>
                    )}
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 pt-2 border-t border-n-100">
              {selectedEvent.status === 'pending' && (
                <Button size="sm" icon={CheckCircle} loading={actionLoading}
                  onClick={() => handleStatusChange(selectedEvent.id, 'confirmed')}>
                  Confirmar
                </Button>
              )}
              {selectedEvent.status === 'confirmed' && (
                <Button size="sm" icon={LogIn} loading={actionLoading}
                  onClick={() => handleStatusChange(selectedEvent.id, 'checked_in')}>
                  Check-in
                </Button>
              )}
              {selectedEvent.status === 'checked_in' && (
                <Button size="sm" icon={LogOut} loading={actionLoading}
                  onClick={() => handleStatusChange(selectedEvent.id, 'checked_out')}>
                  Check-out
                </Button>
              )}
              {!['cancelled', 'checked_out', 'no_show'].includes(selectedEvent.status) && (
                <Button size="sm" variant="danger" icon={XCircle} loading={actionLoading}
                  onClick={() => handleStatusChange(selectedEvent.id, 'cancelled')}>
                  Cancelar
                </Button>
              )}
              <Button size="sm" variant="ghost" icon={X} onClick={() => setSelectedEvent(null)}>
                Fechar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
