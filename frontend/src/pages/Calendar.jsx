import { useState, useEffect, useMemo, useRef } from 'react';
import {
  ChevronLeft, ChevronRight, Lock, Plus,
  CheckCircle, LogIn, LogOut, XCircle, X,
} from 'lucide-react';
import {
  getCalendar, createBlockedDates, deleteBlockedDate, updateReservation,
} from '../services/calendarService';
import { listStaff } from '../services/staffService';
import { createReservation } from '../services/reservationsService';
import useAuthStore from '../store/authStore';
import ReservationForm from '../components/reservations/ReservationForm';
import { useT } from '../i18n';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input, { Select } from '../components/ui/Input';
import CalendarView from '../components/calendar/CalendarView';
import reservationCoversDay from '../components/calendar/reservationCoversDay';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import { mensagemErro } from '../utils/mensagemErro';
import { useLingua } from '../utils/formatoLingua';
import { rotuloMes } from '../utils/rotuloMes';
import {
  nomeMes, diaAbreviado, rotuloEstado, dataVista, eurosVista,
} from '../components/calendar/rotulosCalendario';

const STATUS_COLORS = {
  confirmed:   'bg-ocean-700 text-white',
  pending:     'bg-sand-400 text-n-900',
  checked_in:  'bg-[var(--success)] text-white',
  checked_out: 'bg-n-300 text-n-700',
  cancelled:   'bg-n-200 text-n-400',
  no_show:     'bg-n-200 text-n-400',
};

/* Legenda: chave do rotulo (estado gravado ou chave calendar.*) e a cor */
const LEGEND = [
  { chave: 'reservations.status.confirmed',   cls: 'bg-ocean-700' },
  { chave: 'reservations.status.pending',     cls: 'bg-sand-400' },
  { chave: 'reservations.status.checked_in',  cls: 'bg-[var(--success)]' },
  { chave: 'reservations.status.checked_out', cls: 'bg-n-300' },
  { chave: 'calendar.blocked',                cls: 'bg-n-200 border border-n-300' },
  { chave: 'calendar.legendSoldByStaff',      cls: 'bg-white border-l-[3px] border-l-sand-500' },
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
  const lang = useLingua();
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

  /* Dia livre: escolher entre criar uma reserva e bloquear datas */
  const { operator } = useAuthStore();
  const opType = operator?.operator_type || 'hotel';
  const [escolha,       setEscolha]       = useState(null); // { date, unit }
  const [novaReserva,   setNovaReserva]   = useState(null); // { date, unit }
  const [novaLoading,   setNovaLoading]   = useState(false);
  const [novaErro,      setNovaErro]      = useState('');

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
    if (view === 'month') return t('calendar.navMonth', { month: nomeMes(mes, t), year: ano });
    if (view === 'week') {
      const endStr = addDays(weekStr, 6);
      const sd = new Date(weekStr + 'T00:00:00Z');
      const ed = new Date(endStr   + 'T00:00:00Z');
      const sm = rotuloMes(sd.getUTCMonth(), t);
      const em = rotuloMes(ed.getUTCMonth(), t);
      return sd.getUTCMonth() === ed.getUTCMonth()
        ? t('calendar.navWeekSameMonth', { start: sd.getUTCDate(), end: ed.getUTCDate(), month: em, year: ed.getUTCFullYear() })
        : t('calendar.navWeekCross', { start: sd.getUTCDate(), startMonth: sm, end: ed.getUTCDate(), endMonth: em, year: ed.getUTCFullYear() });
    }
    const d = new Date(dayStr + 'T00:00:00Z');
    return t('calendar.navDay', { day: d.getUTCDate(), month: nomeMes(d.getUTCMonth(), t), year: d.getUTCFullYear() });
  }

  function handleDayClick(dateStr, unit, reservation) {
    if (reservation) { setSelectedEvent(reservation); return; }
    setEscolha({ date: dateStr, unit });
  }

  function abrirBloqueio({ date, unit }) {
    setEscolha(null);
    setBlockReason('');
    setBlockEnd(date);
    setBlockModal({ date, unit });
  }

  function abrirNovaReserva(alvo) {
    setEscolha(null);
    setNovaErro('');
    setNovaReserva(alvo);
  }

  async function handleCriarReserva(dadosForm) {
    setNovaErro('');
    setNovaLoading(true);
    try {
      await createReservation(dadosForm);
      setNovaReserva(null);
      await carregar();
    } catch (err) {
      setNovaErro(mensagemErro(err, t, t('errors.generic')));
    } finally {
      setNovaLoading(false);
    }
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

  /* TODAS as reservas que ocupam a celula (varias no mesmo dia e comum, por exemplo tours com varios
     horarios; antes so aparecia a primeira). As canceladas ficam por ultimo para nao taparem as activas. */
  function getResForCell(unitId, dateStr) {
    return (resByUnit[unitId] || [])
      .filter(r => reservationCoversDay(r, dateStr))
      .sort((a, b) => (a.status === 'cancelled') - (b.status === 'cancelled'));
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
      <div className="overflow-x-auto rounded-[18px] border border-mare-card bg-white">
        <table className="w-full text-xs border-collapse" style={{ minWidth: Math.max(480, visibleUnits.length * 90 + 120) }}>
          <thead>
            <tr className="bg-mare-head">
              <th className="sticky left-0 z-10 bg-mare-head border-b border-r border-mare-card px-3 py-2.5 text-left text-n-500 font-body font-semibold min-w-[112px]">
                {t('reservations.unit')}
              </th>
              {weekDays.map(d => {
                const isToday  = d === todayStr;
                const dayNum   = parseInt(d.slice(8), 10);
                const dayOfWk  = new Date(d + 'T00:00:00Z').getUTCDay();
                return (
                  <th
                    key={d}
                    aria-current={isToday ? 'date' : undefined}
                    className={`border-b border-r border-mare-card px-2 py-2 text-center min-w-[80px] ${isToday ? 'bg-sand-50' : ''}`}
                  >
                    {/* hoje: fundo areia, data em negrito e ponto (nao depende so da cor) */}
                    <div className={`font-display flex items-center justify-center gap-1 ${isToday ? 'font-bold text-ocean-900' : 'font-semibold text-n-700'}`}>
                      {isToday && <span className="w-2 h-2 rounded-full bg-sand-500 shrink-0" aria-hidden="true" />}
                      <span className={isToday ? 'font-bold' : ''}>{dayNum}</span>
                    </div>
                    <div className="font-body text-n-400 font-normal">{diaAbreviado(dayOfWk, t)}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visibleUnits.map(unit => (
              <tr key={unit.id} className="border-b border-mare-card hover:bg-n-50/50">
                <td className="sticky left-0 z-10 bg-white border-r border-mare-card px-3 py-2">
                  <div className="font-body font-semibold text-n-800 truncate max-w-[100px] text-xs">{unit.name}</div>
                  <div className="font-body text-n-400 text-xs truncate">{unit.unit_type}</div>
                </td>
                {weekDays.map(d => {
                  const isBlocked = blockedByUnit[unit.id]?.has(d);
                  const lista     = getResForCell(unit.id, d);
                  const isToday   = d === todayStr;

                  return (
                    <td
                      key={d}
                      className={`border-r border-mare-card px-1.5 py-1.5 cursor-pointer ${isToday ? 'bg-sand-50' : ''}`}
                      onClick={() => !lista.length && !isBlocked && handleDayClick(d, unit, null)}
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
                      {lista.length > 0 ? (
                        <div className="space-y-0.5">
                          {lista.map(res => (
                            <div
                              key={res.id}
                              draggable
                              onDragStart={e => {
                                const dur = Math.max(1, Math.round((new Date(res.check_out) - new Date(res.check_in)) / 86400000));
                                const payload = { reservationId: res.id, duration: dur, unitId: res.unit_id };
                                dragPayloadRef.current = payload;
                                e.dataTransfer.setData('text/plain', JSON.stringify(payload));
                              }}
                              onClick={e => { e.stopPropagation(); setSelectedEvent(res); }}
                              className={`rounded-xs px-2 py-0.5 truncate font-body font-medium cursor-grab active:cursor-grabbing select-none transition-opacity ${STATUS_COLORS[res.status] || 'bg-n-100 text-n-600'} ${res.id === draggingId ? 'opacity-30' : ''}`}
                              title={`${res.customer_name} · ${rotuloEstado(res.status, t)}`}
                            >
                              {res.check_in === d ? res.customer_name.split(' ')[0] : '·'}
                            </div>
                          ))}
                          {(() => {
                            const slots = getSlotsForCell(unit, d);
                            return slots && lista.some(r => r.check_in === d) ? (
                              <div className={`text-[9px] font-mono text-center ${slots.available === 0 ? 'text-error' : 'text-n-400'}`}>
                                {t('calendar.spots', { available: slots.available, total: slots.total })}
                              </div>
                            ) : null;
                          })()}
                        </div>
                      ) : isBlocked ? (
                        <div className="rounded-xs px-2 py-0.5 bg-n-200 text-n-400 font-body text-center">{t('calendar.blockedShort')}</div>
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
                  {t('calendar.noUnits')}
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
    const label = t('calendar.dayHeading', { day: d.getUTCDate(), month: nomeMes(d.getUTCMonth(), t), year: d.getUTCFullYear() });
    return (
      <div className="space-y-3">
        <p className="text-sm font-body font-semibold text-n-700">{label}</p>
        {!visibleUnits.length && (
          <div className="text-center py-12 text-n-400 text-sm font-body">{t('calendar.noUnits')}</div>
        )}
        {visibleUnits.map(unit => {
          const lista     = getResForCell(unit.id, dayStr);
          const isBlocked = blockedByUnit[unit.id]?.has(dayStr);
          return (
            <div key={unit.id} className="bg-white border border-mare-card rounded-[18px] p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-display font-semibold text-sm text-n-900">{unit.name}</p>
                  <p className="text-xs font-body text-n-400">{unit.unit_type}</p>
                </div>
                {!lista.length && !isBlocked && (
                  <div className="flex items-center gap-1">
                    <Button variant="secondary" size="sm" icon={Plus} onClick={() => abrirNovaReserva({ date: dayStr, unit })}>
                      {t('calendar.newBooking')}
                    </Button>
                    <Button variant="ghost" size="sm" icon={Lock} onClick={() => abrirBloqueio({ date: dayStr, unit })}>
                      {t('calendar.block')}
                    </Button>
                  </div>
                )}
              </div>

              {lista.length > 0 ? (
                <div className="space-y-2">
                  {lista.map(res => (
                    <button
                      key={res.id}
                      onClick={() => setSelectedEvent(res)}
                      className={`w-full text-left rounded-sm px-3 py-2.5 transition-opacity hover:opacity-90 ${STATUS_COLORS[res.status] || 'bg-n-100 text-n-600'}`}
                    >
                      <p className="font-display font-semibold text-sm">{res.customer_name}</p>
                      <p className="text-xs opacity-80 mt-0.5">
                        {rotuloEstado(res.status, t)} · {t('reservations.paxCount', { n: res.guests || 1 })}
                        {res.total_price ? ` · ${eurosVista(res.total_price, lang)}` : ''}
                        {(() => {
                          const slots = getSlotsForCell(unit, dayStr);
                          return slots ? ` · ${t('calendar.spotsLeft', { n: slots.available })}` : '';
                        })()}
                      </p>
                    </button>
                  ))}
                </div>
              ) : isBlocked ? (
                <div className="flex items-center justify-between bg-n-100 rounded-sm px-3 py-2">
                  <span className="text-xs font-body text-n-500">{t('calendar.blocked')}</span>
                  <button
                    className="text-xs font-body text-error hover:underline"
                    onClick={() => {
                      const b = (dados.blocked_dates || []).find(
                        x => x.unit_id === unit.id && (x.date === dayStr || x.start_date === dayStr)
                      );
                      if (b) handleUnblock(b.id);
                    }}
                  >
                    {t('calendar.unblock')}
                  </button>
                </div>
              ) : (
                <div className="text-center py-4 text-n-400 text-xs font-body">{t('calendar.available')}</div>
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
        eyebrow={t('nav.sections.operacao')}
        title={t('nav.calendar')}
        subtitle={t('calendar.subtitle')}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {/* Seletor de vista: pilula na pista (botoes nativos, aria-pressed) */}
            <div data-testid="calendar-views" className="flex items-center gap-1 rounded-full border border-mare-card bg-white p-1">
              {[
                { id: 'month', label: t('calendar.views.month') },
                { id: 'week',  label: t('calendar.views.week') },
                { id: 'day',   label: t('calendar.views.day') },
              ].map(v => (
                <button
                  key={v.id}
                  type="button"
                  aria-pressed={view === v.id}
                  onClick={() => setView(v.id)}
                  className={`relative min-h-10 px-4 rounded-full text-sm font-body font-semibold transition-colors before:absolute before:content-[''] before:inset-x-0 before:-inset-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sand-500 ${view === v.id ? 'bg-ocean-900 text-white' : 'text-ocean-700 hover:bg-ocean-50'}`}
                >
                  {v.label}
                </button>
              ))}
            </div>

            {/* Navegacao: setas redondas de 44 px */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label={t('calendar.prevPeriod')}
                onClick={() => navigate(-1)}
                className="inline-flex items-center justify-center w-11 h-11 rounded-full border border-mare-card bg-white text-ocean-700 hover:bg-ocean-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sand-500"
              >
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
              <span className="font-display font-semibold text-sm text-ocean-900 min-w-[160px] text-center">
                {getNavLabel()}
              </span>
              <button
                type="button"
                aria-label={t('calendar.nextPeriod')}
                onClick={() => navigate(1)}
                className="inline-flex items-center justify-center w-11 h-11 rounded-full border border-mare-card bg-white text-ocean-700 hover:bg-ocean-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sand-500"
              >
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </div>
          </div>
        }
      />

      {/* Barra do cartao Mare: filtros e legenda */}
      <div data-testid="calendar-toolbar" className="mb-4 rounded-[18px] border border-mare-card bg-white p-4 space-y-3">
        {((dados.units || []).length > 1 || guides.length > 0) && (
          <div className="flex flex-wrap items-end gap-3">
            {/* Unit filter */}
            {(dados.units || []).length > 1 && (
              <Select label={t('calendar.byUnit')} value={filterUnit} onChange={e => setFilterUnit(e.target.value)} className="w-48">
                <option value="">{t('calendar.allUnits')}</option>
                {(dados.units || []).map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </Select>
            )}

            {/* Guide filter */}
            {guides.length > 0 && (
              <Select label={t('calendar.byGuide')} value={filterGuide} onChange={e => setFilterGuide(e.target.value)} className="w-48">
                <option value="">{t('calendar.allGuides')}</option>
                {guides.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </Select>
            )}
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {LEGEND.map(l => (
            <div key={l.chave} className="flex items-center gap-1.5">
              <span className={`w-3 h-3 rounded-xs ${l.cls}`} />
              <span className="text-xs font-body text-n-600">{t(l.chave)}</span>
            </div>
          ))}
        </div>
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

      {/* Dia livre: criar reserva ou bloquear datas */}
      <Modal open={!!escolha} onClose={() => setEscolha(null)} title={t('calendar.freeDay')} size="sm">
        {escolha && (
          <div className="space-y-4">
            <p className="text-sm font-body text-n-600">
              {t('calendar.freeDayAsk', { unit: escolha.unit.name, date: dataVista(escolha.date, lang) })}
            </p>
            <div className="flex flex-col gap-2">
              <Button icon={Plus} onClick={() => abrirNovaReserva(escolha)}>{t('calendar.createBooking')}</Button>
              <Button variant="secondary" icon={Lock} onClick={() => abrirBloqueio(escolha)}>{t('calendar.blockDates')}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Nova reserva a partir do dia/unidade clicados */}
      <Modal open={!!novaReserva} onClose={() => setNovaReserva(null)} title={t('reservations.new')} size="md">
        {novaReserva && (
          <ReservationForm
            initial={{
              unit_id: novaReserva.unit.id,
              check_in: novaReserva.date,
              /* tours e restaurantes sao de um dia; as restantes unidades, uma noite por omissao */
              check_out: opType === 'activity' || opType === 'restaurant' ? novaReserva.date : addDays(novaReserva.date, 1),
            }}
            units={dados.units || []}
            operatorType={opType}
            onSave={handleCriarReserva}
            onCancel={() => setNovaReserva(null)}
            loading={novaLoading}
            error={novaErro}
          />
        )}
      </Modal>

      {/* Block modal */}
      <Modal
        open={!!blockModal}
        onClose={() => setBlockModal(null)}
        title={t('calendar.blockDates')}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setBlockModal(null)}>{t('common.cancel')}</Button>
            <Button loading={blockLoading} onClick={handleBlock} icon={Lock}>{t('calendar.block')}</Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm font-body font-semibold text-n-800">{blockModal?.unit?.name}</p>
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('calendar.startDate')} type="date" value={blockModal?.date || ''} readOnly />
            <Input
              label={t('calendar.endDate')}
              type="date"
              value={blockEnd}
              onChange={e => setBlockEnd(e.target.value)}
              min={blockModal?.date}
            />
          </div>
          <Input
            label={t('calendar.reason')}
            value={blockReason}
            onChange={e => setBlockReason(e.target.value)}
            placeholder={t('calendar.reasonPlaceholder')}
          />
        </div>
      </Modal>

      {/* Event detail modal */}
      <Modal
        open={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        title={t('calendar.detailTitle')}
        size="sm"
      >
        {selectedEvent && (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <p className="font-display font-bold text-lg text-n-900 leading-tight">{selectedEvent.customer_name}</p>
              <span className={`shrink-0 text-xs font-body font-semibold px-2 py-0.5 rounded-xs ${STATUS_COLORS[selectedEvent.status] || 'bg-n-100 text-n-600'}`}>
                {rotuloEstado(selectedEvent.status, t)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm font-body">
              <div className="bg-n-50 rounded-sm p-3">
                <p className="text-xs text-n-400 mb-0.5">{t('reservations.checkIn')}</p>
                <p className="font-semibold text-n-800">{dataVista(selectedEvent.check_in, lang)}</p>
              </div>
              <div className="bg-n-50 rounded-sm p-3">
                <p className="text-xs text-n-400 mb-0.5">{t('reservations.checkOut')}</p>
                <p className="font-semibold text-n-800">{dataVista(selectedEvent.check_out, lang)}</p>
              </div>
              {selectedUnit && (
                <div className="bg-n-50 rounded-sm p-3">
                  <p className="text-xs text-n-400 mb-0.5">{t('reservations.unit')}</p>
                  <p className="font-semibold text-n-800">{selectedUnit.name}</p>
                </div>
              )}
              <div className="bg-n-50 rounded-sm p-3">
                <p className="text-xs text-n-400 mb-0.5">{t('reservations.guests')}</p>
                <p className="font-semibold text-n-800">{selectedEvent.guests || 1}</p>
              </div>
              {selectedEvent.total_price && (
                <div className="bg-n-50 rounded-sm p-3 col-span-2">
                  <p className="text-xs text-n-400 mb-0.5">{t('calendar.total')}</p>
                  <p className="font-semibold text-n-800">
                    {eurosVista(selectedEvent.total_price, lang)}
                    {selectedEvent.payment_status === 'paid' && (
                      <span className="ml-2 text-xs font-normal text-[var(--success)]">{t('reservations.paid')}</span>
                    )}
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 pt-2 border-t border-n-100">
              {selectedEvent.status === 'pending' && (
                <Button size="sm" icon={CheckCircle} loading={actionLoading}
                  onClick={() => handleStatusChange(selectedEvent.id, 'confirmed')}>
                  {t('common.confirm')}
                </Button>
              )}
              {selectedEvent.status === 'confirmed' && (
                <Button size="sm" icon={LogIn} loading={actionLoading}
                  onClick={() => handleStatusChange(selectedEvent.id, 'checked_in')}>
                  {t('reservations.checkIn')}
                </Button>
              )}
              {selectedEvent.status === 'checked_in' && (
                <Button size="sm" icon={LogOut} loading={actionLoading}
                  onClick={() => handleStatusChange(selectedEvent.id, 'checked_out')}>
                  {t('reservations.checkOut')}
                </Button>
              )}
              {!['cancelled', 'checked_out', 'no_show'].includes(selectedEvent.status) && (
                <Button size="sm" variant="danger" icon={XCircle} loading={actionLoading}
                  onClick={() => handleStatusChange(selectedEvent.id, 'cancelled')}>
                  {t('common.cancel')}
                </Button>
              )}
              <Button size="sm" variant="ghost" icon={X} onClick={() => setSelectedEvent(null)}>
                {t('common.close')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
