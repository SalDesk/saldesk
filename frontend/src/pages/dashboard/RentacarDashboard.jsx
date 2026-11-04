import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Euro, BookOpen, BarChart2, Car, X as XIcon, Wrench, MoveRight, MoveLeft,
} from 'lucide-react';
import { getResumo } from '../../services/financeiroService';
import { listUnits } from '../../services/unitsService';
import { listReservations } from '../../services/reservationsService';
import { estadiaEm, estadiaNoMes } from '../../services/reservationRanges';
import { useT } from '../../i18n';
import KpiCard from '../../components/financial/KpiCard';
import AttentionPanel from '../../components/dashboard/AttentionPanel';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import { TODAY, mesAtual, CELL, unitStatus, parseVehicleMeta, MapLegend } from './shared';
import { buildAttentionItems } from './dashboardLogic';

/* ─── Rentacar dashboard ─────────────────────────────────────── */

function VehicleFleet({ units, getState, onSelect }) {
  const t = useT();
  if (!units.length)
    return <p className="text-sm font-body text-n-400 py-4">{t('dashboard.rentacar.noVehiclesRegistered')}</p>;
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {units.map(u => {
          const st  = getState(u);
          const s   = CELL[st] || CELL.available;
          const meta = parseVehicleMeta(u);
          const photo = u.images?.[0];
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => onSelect?.(u)}
              className={`rounded-sm border border-n-100 overflow-hidden text-left hover:ring-2 hover:ring-ocean-300 transition-all ${s.bg}`}
            >
              {photo ? (
                <div className="w-full aspect-video bg-n-100 overflow-hidden">
                  <img src={photo} alt={u.name} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className={`w-full aspect-video flex items-center justify-center ${s.bg}`}>
                  <Car size={24} strokeWidth={1.25} className={`${s.text} opacity-40`} />
                </div>
              )}
              <div className="p-2.5">
                <p className={`text-xs font-display font-semibold truncate ${s.text}`}>
                  {meta.brand ? `${meta.brand} ${meta.model || ''}`.trim() : u.name}
                </p>
                {meta.plate && (
                  <p className="text-[10px] font-mono text-n-500 mt-0.5 uppercase">{meta.plate}</p>
                )}
                <div className="flex items-center gap-1 mt-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
                  <span className={`text-[10px] font-mono uppercase tracking-wide ${s.text}`}>{t(`dashboard.map.${st}`)}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <MapLegend keys={['available', 'occupied', 'maintenance', 'breakdown', 'inactive']} />
    </>
  );
}

function VehicleDetailCard({ unit, state, reservation, onClose, onNavigate }) {
  const t    = useT();
  const s    = CELL[state] || CELL.available;
  const meta = parseVehicleMeta(unit);
  const photo = unit.images?.[0];
  return (
    <div className="bg-white rounded-xl border border-n-200 shadow-2xl w-full max-w-sm">
      {photo && (
        <div className="w-full aspect-video rounded-t-xl overflow-hidden bg-n-100">
          <img src={photo} alt={unit.name} className="w-full h-full object-cover" />
        </div>
      )}
      <div className="p-6">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-display font-bold text-base text-n-900">
              {meta.brand ? `${meta.brand} ${meta.model || ''}`.trim() : unit.name}
            </h3>
            <p className="text-xs font-body text-n-500 mt-0.5">
              {[meta.plate, meta.year, unit.unit_type].filter(Boolean).join(' · ')}
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
              {t('dashboard.rentacar.pickup')}: {reservation.check_in} · {t('dashboard.rentacar.return')}: {reservation.check_out}
            </p>
            <p className="text-xs font-body text-n-500">
              €{Number(reservation.total_price || 0).toFixed(0)}
            </p>
          </div>
        ) : (
          <p className="text-sm font-body text-n-400 mb-4">{t('dashboard.rentacar.vehicleAvailable')}</p>
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 h-9 rounded-md border border-n-200 text-sm font-body text-n-700 hover:bg-n-50 transition-colors"
          >
            {t('dashboard.common.close')}
          </button>
          <button
            onClick={onNavigate}
            className="flex-1 h-9 rounded-md bg-ocean-700 text-white text-sm font-body font-medium hover:bg-ocean-500 transition-colors flex items-center justify-center gap-1.5"
          >
            <BookOpen size={13} strokeWidth={1.75} />
            {t('dashboard.common.viewReservations')}
          </button>
        </div>
      </div>
    </div>
  );
}

function computeDocAlerts(units, t) {
  const alerts = [];
  const now = new Date();
  units.forEach(u => {
    const meta  = parseVehicleMeta(u);
    const label = meta.plate || u.name;
    const check = (expiry, name) => {
      if (!expiry) return;
      const d    = new Date(expiry);
      const days = Math.ceil((d - now) / 86400000);
      if (days <= 0)  alerts.push({ type: 'expired', msg: t('dashboard.rentacar.expired', { label, name }),                unit: u });
      else if (days <= 30) alerts.push({ type: 'warning', msg: t('dashboard.rentacar.expiresIn', { label, name, days }),   unit: u });
    };
    check(meta.seguro_expiry,   t('dashboard.rentacar.insurance'));
    check(meta.iuc_expiry,      t('dashboard.rentacar.roadTax'));
    check(meta.inspecao_expiry, t('dashboard.rentacar.inspection'));
    if (meta.next_revision_km && meta.current_km) {
      const kmLeft = Number(meta.next_revision_km) - Number(meta.current_km);
      if (kmLeft <= 0)   alerts.push({ type: 'expired', msg: t('dashboard.rentacar.revisionOverdue', { label, km: Math.abs(kmLeft) }), unit: u });
      else if (kmLeft <= 500) alerts.push({ type: 'warning', msg: t('dashboard.rentacar.revisionIn', { label, km: kmLeft }),           unit: u });
    }
  });
  return alerts;
}

export default function RentacarDashboard() {
  const t        = useT();
  const navigate = useNavigate();
  const periodo  = mesAtual();

  const [units,    setUnits]    = useState([]);
  const [todayRes, setTodayRes] = useState([]);
  const [monthRes, setMonthRes] = useState([]);
  const [resumo,   setResumo]   = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    /* Cada chamada falha para o seu valor vazio: uma falha nao apaga as outras */
    Promise.all([
      listUnits().catch(() => []),
      listReservations(estadiaEm(TODAY)).catch(() => []),
      listReservations(estadiaNoMes()).catch(() => []),
      getResumo(periodo.inicio, periodo.fim).catch(() => null),
    ])
      .then(([u, tRes, mRes, res]) => {
        setUnits(u || []);
        setTodayRes(tRes || []);
        setMonthRes(mRes || []);
        setResumo(res);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const vehicleStatusMap = useMemo(() => {
    const m = {};
    todayRes.forEach(r => {
      if (r.status === 'checked_in') m[r.unit_id] = 'occupied';
    });
    return m;
  }, [todayRes]);

  function getVehicleState(unit) {
    const us = unitStatus(unit);
    if (us) return us;
    return vehicleStatusMap[unit.id] || 'available';
  }

  const kpis = useMemo(() => {
    const active = units.filter(u => u.is_active !== false);
    const available  = active.filter(u => !['maintenance', 'breakdown', 'inactive'].includes(u.status) && !vehicleStatusMap[u.id]).length;
    const rented     = Object.values(vehicleStatusMap).filter(v => v === 'occupied').length;
    const inMaint    = active.filter(u => ['maintenance', 'breakdown'].includes(u.status)).length;
    return {
      available,
      receita:   resumo?.atual?.receita ?? 0,
      /* Sem mes anterior na resposta nao ha variacao a mostrar */
      receitaDelta: resumo?.atual && resumo?.anterior
        ? Number(resumo.atual.receita || 0) - Number(resumo.anterior.receita || 0)
        : undefined,
      alugados:  rented,
      manutencao: inMaint,
    };
  }, [units, vehicleStatusMap, resumo]);

  const levantamentos = useMemo(() =>
    todayRes.filter(r => r.check_in === TODAY && ['pending', 'confirmed'].includes(r.status)),
    [todayRes]
  );
  const devolucoes = useMemo(() =>
    todayRes.filter(r => r.check_out === TODAY && r.status === 'checked_in'),
    [todayRes]
  );

  /* Itens do painel "Requer atencao" (documentos expirados ou a expirar, revisoes) */
  const attentionItems = useMemo(
    () => buildAttentionItems({ docAlerts: computeDocAlerts(units, t) }, t),
    [units, t]
  );

  const vehicleRes = useMemo(() => {
    if (!selected) return null;
    return todayRes.find(r =>
      r.unit_id === selected.id && ['checked_in', 'confirmed', 'pending'].includes(r.status)
    ) || null;
  }, [selected, todayRes]);

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size={32} /></div>;

  return (
    <div className="space-y-4">

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label={t('dashboard.rentacar.availableVehicles')} value={kpis.available}   icon={Car}      />
        <KpiCard label={t('dashboard.rentacar.revenueMonth')}      value={kpis.receita}     delta={kpis.receitaDelta} deltaLabel={t('dashboard.summary.vsPrevMonth')} icon={Euro} format="euro" />
        <KpiCard label={t('dashboard.rentacar.activeRentals')}     value={kpis.alugados}    icon={BarChart2}/>
        <KpiCard label={t('dashboard.rentacar.inMaintenance')}     value={kpis.manutencao}  icon={Wrench}   />
      </div>

      {/* Frota + Requer atencao */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4 items-start">
        <section className="bg-white border border-n-200 rounded-sm">
          <header className="flex items-center gap-2 px-4 py-3 border-b border-n-200">
            <Car size={14} strokeWidth={1.75} className="text-n-500" aria-hidden="true" />
            <h2 className="font-display font-semibold text-sm text-n-900">
              {t('dashboard.rentacar.fleetStatus')}
            </h2>
            <button
              type="button"
              onClick={() => navigate('/manutencao')}
              className="ml-auto text-xs font-body text-ocean-700 hover:underline flex items-center gap-1"
            >
              <Wrench size={11} strokeWidth={1.75} aria-hidden="true" />
              {t('dashboard.common.maintenance')}
            </button>
          </header>
          <div className="p-4">
            <VehicleFleet units={units} getState={getVehicleState} onSelect={setSelected} />
          </div>
        </section>

        <AttentionPanel items={attentionItems} />
      </div>

      {/* Levantamentos + Devolucoes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="bg-white border border-n-200 rounded-sm">
          <header className="flex items-center gap-2 px-4 py-3 border-b border-n-200">
            <MoveRight size={14} strokeWidth={1.75} className="text-[#1A7A4A]" aria-hidden="true" />
            <h2 className="font-display font-semibold text-sm text-n-900">{t('dashboard.rentacar.pickupsToday')}</h2>
            <span className="ml-auto text-xs font-body text-n-500 tabular-nums">{levantamentos.length}</span>
          </header>
          {levantamentos.length === 0 ? (
            <EmptyState icon={MoveRight} title={t('dashboard.rentacar.noPickupToday')} />
          ) : (
            <div className="divide-y divide-n-100">
              {levantamentos.map(r => {
                const u    = units.find(x => x.id === r.unit_id);
                const meta = u ? parseVehicleMeta(u) : {};
                return (
                  <div key={r.id} className="px-4 py-2.5 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-display font-semibold text-n-900 truncate">{r.customer_name || '—'}</p>
                      <p className="text-xs font-body text-n-500">
                        {u?.name || '—'}{meta.plate ? ` · ${meta.plate}` : ''}
                      </p>
                    </div>
                    <Badge variant={r.status === 'confirmed' ? 'confirmed' : 'pending'}>
                      {r.status === 'confirmed' ? t('dashboard.status.confirmed') : t('dashboard.status.pending')}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="bg-white border border-n-200 rounded-sm">
          <header className="flex items-center gap-2 px-4 py-3 border-b border-n-200">
            <MoveLeft size={14} strokeWidth={1.75} className="text-n-500" aria-hidden="true" />
            <h2 className="font-display font-semibold text-sm text-n-900">{t('dashboard.rentacar.returnsToday')}</h2>
            <span className="ml-auto text-xs font-body text-n-500 tabular-nums">{devolucoes.length}</span>
          </header>
          {devolucoes.length === 0 ? (
            <EmptyState icon={MoveLeft} title={t('dashboard.rentacar.noReturnToday')} />
          ) : (
            <div className="divide-y divide-n-100">
              {devolucoes.map(r => {
                const u    = units.find(x => x.id === r.unit_id);
                const meta = u ? parseVehicleMeta(u) : {};
                return (
                  <div key={r.id} className="px-4 py-2.5 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-display font-semibold text-n-900 truncate">{r.customer_name || '—'}</p>
                      <p className="text-xs font-body text-n-500">
                        {u?.name || '—'}{meta.plate ? ` · ${meta.plate}` : ''} · {t('dashboard.rentacar.since', { date: r.check_in })}
                      </p>
                    </div>
                    <Badge variant="info">{t('dashboard.status.return')}</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Vehicle detail overlay */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}
        >
          <VehicleDetailCard
            unit={selected}
            state={getVehicleState(selected)}
            reservation={vehicleRes}
            onClose={() => setSelected(null)}
            onNavigate={() => { navigate('/reservas'); setSelected(null); }}
          />
        </div>
      )}
    </div>
  );
}
