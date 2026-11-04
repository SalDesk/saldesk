import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Euro, BookOpen, CalendarDays, Users, UtensilsCrossed, Star, Clock, X as XIcon,
} from 'lucide-react';
import { getResumo } from '../../services/financeiroService';
import { listUnits } from '../../services/unitsService';
import { listReservations } from '../../services/reservationsService';
import { estadiaEm, estadiaNoMes } from '../../services/reservationRanges';
import api from '../../services/api';
import { useT } from '../../i18n';
import KpiCard from '../../components/financial/KpiCard';
import AttentionPanel from '../../components/dashboard/AttentionPanel';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import { TODAY, mesAtual, CELL, unitStatus, parseVehicleMeta, TableMap, ZONE_KEYS } from './shared';
import { buildAttentionItems } from './dashboardLogic';

/* ─── Restaurant dashboard ──────────────────────────────────── */

function TurnoSection({ label, reservations, units, emptyMsg }) {
  const t = useT();
  return (
    <section className="bg-white border border-n-200 rounded-sm">
      <header className="flex items-center gap-2 px-4 py-3 border-b border-n-200">
        <Clock size={14} strokeWidth={1.75} className="text-n-500" aria-hidden="true" />
        <h2 className="font-display font-semibold text-sm text-n-900">{label}</h2>
        <span className="ml-auto text-xs font-body text-n-500 tabular-nums">{reservations.length}</span>
      </header>
      {reservations.length === 0 ? (
        <EmptyState icon={Clock} title={emptyMsg} />
      ) : (
        <div className="divide-y divide-n-100">
          {reservations.map(r => {
            const unit  = units.find(u => u.id === r.unit_id);
            const umeta = unit ? parseVehicleMeta(unit) : {};
            const tbl   = unit ? (umeta.number ? t('dashboard.restaurant.table', { n: umeta.number }) : unit.name) : t('dashboard.restaurant.noTable');
            let gm = {};
            try { gm = JSON.parse(r.notes_guest || '{}'); } catch {}
            return (
              <div key={r.id} className="px-4 py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-display font-semibold text-n-900 truncate">{r.customer_name || '—'}</p>
                  <p className="text-xs font-body text-n-500">
                    {tbl} · {r.guests} {t('dashboard.common.pax')}{gm.ocasiao ? ` · ${gm.ocasiao}` : ''}
                  </p>
                </div>
                <Badge variant={r.status === 'checked_in' ? 'info' : r.status === 'confirmed' ? 'confirmed' : 'pending'}>
                  {r.status === 'checked_in' ? t('dashboard.status.seated') : r.status === 'confirmed' ? t('dashboard.status.confirmed') : t('dashboard.status.pending')}
                </Badge>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function TableDetailCard({ unit, state, reservation, onClose, onNavigate }) {
  const t    = useT();
  const s    = CELL[state] || CELL.available;
  const meta = parseVehicleMeta(unit);
  const tbl  = meta.number ? t('dashboard.restaurant.table', { n: meta.number }) : unit.name;
  const zone = ZONE_KEYS[meta.zone] ? t(`dashboard.zones.${meta.zone}`) : (meta.zone || '');
  const cap  = meta.capacity_max || unit.capacity;
  let gm = {};
  if (reservation) { try { gm = JSON.parse(reservation.notes_guest || '{}'); } catch {} }

  return (
    <div className="bg-white rounded-xl border border-n-200 shadow-2xl w-full max-w-sm">
      <div className="p-6">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-display font-bold text-base text-n-900">{tbl}</h3>
            <p className="text-xs font-body text-n-500 mt-0.5">
              {[zone, cap ? `${cap} ${t('dashboard.common.pax')}` : null].filter(Boolean).join(' · ')}
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-n-400 hover:text-n-700 rounded">
            <XIcon size={16} strokeWidth={1.75} />
          </button>
        </div>

        <div className={`flex items-center gap-2 px-2.5 py-2 rounded-md mb-4 ${s.bg}`}>
          <span className={`w-2 h-2 rounded-full ${s.dot}`} />
          <span className={`text-xs font-mono font-bold uppercase tracking-wide ${s.text}`}>{t(`dashboard.map.${state}`)}</span>
        </div>

        {reservation ? (
          <div className="bg-n-50 rounded-md p-3 mb-4 space-y-1">
            <p className="text-sm font-display font-semibold text-n-900">{reservation.customer_name || '—'}</p>
            <p className="text-xs font-body text-n-500">
              {reservation.guests} {t('dashboard.restaurant.people')}{gm.turno ? ` · ${t('dashboard.restaurant.shift', { turno: gm.turno })}` : ''}
            </p>
            {gm.ocasiao && <p className="text-xs font-body text-n-400">{gm.ocasiao}</p>}
            {gm.pedidos_especiais && <p className="text-xs font-body text-n-400 italic">{gm.pedidos_especiais}</p>}
          </div>
        ) : (
          <p className="text-sm font-body text-n-400 mb-4">{t('dashboard.restaurant.tableAvailable')}</p>
        )}

        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 h-9 rounded-md border border-n-200 text-sm font-body text-n-700 hover:bg-n-50 transition-colors">
            {t('dashboard.common.close')}
          </button>
          <button onClick={onNavigate}
            className="flex-1 h-9 rounded-md bg-ocean-700 text-white text-sm font-body font-medium hover:bg-ocean-500 transition-colors flex items-center justify-center gap-1.5">
            <BookOpen size={13} strokeWidth={1.75} />
            {t('dashboard.common.viewReservations')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RestaurantDashboard() {
  const t        = useT();
  const navigate = useNavigate();
  const periodo  = mesAtual();

  const [units,     setUnits]     = useState([]);
  const [todayRes,  setTodayRes]  = useState([]);
  const [monthRes,  setMonthRes]  = useState([]);
  const [resumo,    setResumo]    = useState(null);
  const [avgRating, setAvgRating] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [selected,  setSelected]  = useState(null);

  useEffect(() => {
    /* Cada chamada falha para o seu valor vazio: uma falha nao apaga as outras.
       /reviews/stats devolve { total, average, distribution }; sem avaliacoes
       (total 0) a media nao existe */
    Promise.all([
      listUnits().catch(() => []),
      listReservations(estadiaEm(TODAY)).catch(() => []),
      listReservations(estadiaNoMes()).catch(() => []),
      getResumo(periodo.inicio, periodo.fim).catch(() => null),
      api.get('/reviews/stats')
        .then(r => {
          const s = r.data?.data;
          return Number(s?.total) > 0 ? (s.average ?? null) : null;
        })
        .catch(() => null),
    ])
      .then(([u, tRes, mRes, res, avgR]) => {
        setUnits((u || []).filter(x => x.unit_type !== 'menu_item' && x.unit_type !== 'tasting_menu'));
        setTodayRes(tRes || []);
        setMonthRes(mRes || []);
        setResumo(res);
        setAvgRating(avgR);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusMap = useMemo(() => {
    const m = {};
    todayRes.forEach(r => {
      if (r.status === 'checked_in' && !m[r.unit_id])               { m[r.unit_id] = 'occupied'; return; }
      if (['pending', 'confirmed'].includes(r.status) && !m[r.unit_id]) m[r.unit_id] = 'checkin';
    });
    return m;
  }, [todayRes]);

  function getTableState(unit) { return unitStatus(unit) || statusMap[unit.id] || 'available'; }

  const kpis = useMemo(() => ({
    reservasHoje: todayRes.filter(r => ['pending', 'confirmed', 'checked_in'].includes(r.status)).length,
    coversMes:    monthRes.filter(r => ['confirmed', 'checked_in', 'checked_out'].includes(r.status)).reduce((s, r) => s + (r.guests || 0), 0),
    receita:      resumo?.atual?.receita ?? 0,
    /* Sem mes anterior na resposta nao ha variacao a mostrar */
    receitaDelta: resumo?.atual && resumo?.anterior
      ? Number(resumo.atual.receita || 0) - Number(resumo.anterior.receita || 0)
      : undefined,
    rating:       avgRating,
  }), [todayRes, monthRes, resumo, avgRating]);

  /* Itens do painel "Requer atencao" (reservas pendentes de hoje) */
  const attentionItems = useMemo(
    () => buildAttentionItems({ pendingToday: todayRes.filter(r => r.status === 'pending') }, t),
    [todayRes, t]
  );

  const shifts = useMemo(() => {
    const a = [], j = [], o = [];
    todayRes.filter(r => ['pending', 'confirmed', 'checked_in'].includes(r.status)).forEach(r => {
      let meta = {};
      try { meta = JSON.parse(r.notes_guest || '{}'); } catch {}
      if      (meta.turno === 'almoco') a.push(r);
      else if (meta.turno === 'jantar') j.push(r);
      else                              o.push(r);
    });
    return { almoco: a, jantar: j, outros: o };
  }, [todayRes]);

  const tableRes = useMemo(() => {
    if (!selected) return null;
    return todayRes.find(r =>
      r.unit_id === selected.id && ['pending', 'confirmed', 'checked_in'].includes(r.status)
    ) || null;
  }, [selected, todayRes]);

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size={32} /></div>;

  return (
    <div className="space-y-4">

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label={t('dashboard.restaurant.reservationsToday')} value={kpis.reservasHoje}                            icon={CalendarDays} />
        <KpiCard label={t('dashboard.restaurant.coversMonth')}       value={kpis.coversMes}                               icon={Users}        />
        <KpiCard label={t('dashboard.restaurant.revenueEstimated')}  value={kpis.receita} delta={kpis.receitaDelta} deltaLabel={t('dashboard.summary.vsPrevMonth')} icon={Euro} format="euro" />
        <KpiCard label={t('dashboard.restaurant.avgRating')}         value={kpis.rating ? kpis.rating.toFixed(1) : '—'}  icon={Star}         />
      </div>

      {/* Mapa de mesas + Requer atencao */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4 items-start">
        <section className="bg-white border border-n-200 rounded-sm">
          <header className="flex items-center gap-2 px-4 py-3 border-b border-n-200">
            <UtensilsCrossed size={14} strokeWidth={1.75} className="text-n-500" aria-hidden="true" />
            <h2 className="font-display font-semibold text-sm text-n-900">
              {t('dashboard.restaurant.tableMap')}
            </h2>
            <button
              type="button"
              onClick={() => navigate('/unidades')}
              className="ml-auto text-xs font-body text-ocean-700 hover:underline"
            >
              {t('dashboard.restaurant.manageTables')}
            </button>
          </header>
          <div className="p-4">
            <TableMap units={units} todayRes={todayRes} onSelect={setSelected} />
          </div>
        </section>

        <AttentionPanel items={attentionItems} />
      </div>

      {/* Turnos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TurnoSection label={t('dashboard.restaurant.lunch')}  reservations={shifts.almoco} units={units} emptyMsg={t('dashboard.restaurant.noLunchReservations')} />
        <TurnoSection label={t('dashboard.restaurant.dinner')} reservations={shifts.jantar} units={units} emptyMsg={t('dashboard.restaurant.noDinnerReservations')} />
      </div>

      {shifts.outros.length > 0 && (
        <TurnoSection label={t('dashboard.restaurant.noShiftDefined')} reservations={shifts.outros} units={units} emptyMsg="" />
      )}

      {/* Table detail overlay */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}
        >
          <TableDetailCard
            unit={selected}
            state={getTableState(selected)}
            reservation={tableRes}
            onClose={() => setSelected(null)}
            onNavigate={() => { navigate('/reservas'); setSelected(null); }}
          />
        </div>
      )}
    </div>
  );
}
