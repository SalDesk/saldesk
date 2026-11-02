import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Euro, BookOpen, BarChart2, AlertTriangle, Clock, X as XIcon, Wrench, MoveRight, MoveLeft, BedDouble, Sparkles,
} from 'lucide-react';
import { getResumo } from '../../services/financeiroService';
import { listUnits } from '../../services/unitsService';
import { listReservations } from '../../services/reservationsService';
import { useT } from '../../i18n';
import KpiCard from '../../components/financial/KpiCard';
import Badge from '../../components/ui/Badge';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import { TODAY, mesAtual, HotelMap } from './shared';

/* ─── Hotel dashboard ───────────────────────────────────────── */

const STATUS_BADGE_MAP_H = {
  pending: 'pending', confirmed: 'confirmed',
  checked_in: 'info', checked_out: 'default', cancelled: 'cancelled',
};
const STATUS_KEY_H = {
  pending: 'pending', confirmed: 'confirmed',
  checked_in: 'active', checked_out: 'completed', cancelled: 'cancelled',
};

export default function HotelDashboard() {
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
    Promise.all([
      listUnits(),
      listReservations({ from: TODAY, to: TODAY }),
      listReservations({ from: periodo.inicio, to: periodo.fim }),
      getResumo(periodo.inicio, periodo.fim),
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

  const kpis = useMemo(() => {
    const active   = units.filter(u => !['inactive', 'maintenance'].includes(u.status) && u.is_active !== false);
    const occupied = active.filter(u => todayRes.some(r => r.unit_id === u.id && r.status === 'checked_in')).length;
    const pct      = active.length ? Math.round((occupied / active.length) * 100) : 0;
    return {
      ocupacao:  pct,
      receita:   resumo?.atual?.receita ?? 0,
      checkins:  todayRes.filter(r => r.check_in  === TODAY && ['pending', 'confirmed'].includes(r.status)).length,
      checkouts: todayRes.filter(r => r.check_out === TODAY && r.status === 'checked_in').length,
      pendentes: monthRes.filter(r => r.status === 'pending').length,
    };
  }, [units, todayRes, monthRes, resumo]);

  const checkinsHoje  = useMemo(() =>
    todayRes.filter(r => r.check_in === TODAY && ['pending', 'confirmed'].includes(r.status)),
    [todayRes]
  );
  const checkoutsHoje = useMemo(() =>
    todayRes.filter(r => r.check_out === TODAY && r.status === 'checked_in'),
    [todayRes]
  );

  const alertas = useMemo(() => ({
    manutencao:      units.filter(u => u.status === 'maintenance'),
    semConfirmacao:  todayRes.filter(r => r.check_in === TODAY && r.status === 'pending'),
    limpeza:         units.filter(u => u.status === 'cleaning').length,
  }), [units, todayRes]);

  const roomRes = useMemo(() => {
    if (!selected) return null;
    return todayRes.find(r =>
      r.unit_id === selected.id && ['checked_in', 'confirmed', 'pending'].includes(r.status)
    ) || null;
  }, [selected, todayRes]);

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size={32} /></div>;

  return (
    <div className="space-y-6">

      {/* Alertas */}
      {(alertas.manutencao.length > 0 || alertas.semConfirmacao.length > 0 || alertas.limpeza > 0) && (
        <div className="space-y-2">
          {alertas.manutencao.length > 0 && (
            <div className="flex items-start gap-3 px-4 py-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-md">
              <Wrench size={15} strokeWidth={1.75} className="text-error shrink-0 mt-0.5" />
              <p className="text-sm font-body text-error flex-1">
                <span className="font-semibold">{t('dashboard.hotel.maintenanceAlert', { n: alertas.manutencao.length })}</span>{' '}
                {alertas.manutencao.map(u => u.name).join(', ')}
              </p>
            </div>
          )}
          {alertas.semConfirmacao.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 bg-[#FFF7ED] border border-[#FDBA74] rounded-md">
              <AlertTriangle size={15} strokeWidth={1.75} className="text-[#B45309] shrink-0" />
              <p className="text-sm font-body text-[#B45309] flex-1">
                <span className="font-semibold">{t('dashboard.hotel.noConfirmationAlert', { n: alertas.semConfirmacao.length })}</span>
              </p>
              <button
                onClick={() => navigate('/reservas')}
                className="text-xs font-semibold text-[#B45309] underline whitespace-nowrap shrink-0"
              >
                {t('dashboard.common.viewReservations')}
              </button>
            </div>
          )}
          {alertas.limpeza > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 bg-orange-50 border border-orange-200 rounded-md">
              <Sparkles size={15} strokeWidth={1.75} className="text-orange-600 shrink-0" />
              <p className="text-sm font-body text-orange-700 flex-1">
                <span className="font-semibold">{t('dashboard.hotel.cleaningAlert', { n: alertas.limpeza })}</span>
              </p>
              <button
                onClick={() => navigate('/housekeeping')}
                className="text-xs font-semibold text-orange-700 underline whitespace-nowrap shrink-0"
              >
                {t('dashboard.hotel.housekeeping')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard label={t('dashboard.hotel.occupancyToday')}      value={kpis.ocupacao}  format="percent" icon={BarChart2}  />
        <KpiCard label={t('dashboard.hotel.revenueMonth')}        value={kpis.receita}   format="euro"    icon={Euro}       />
        <KpiCard label={t('dashboard.hotel.checkinsToday')}       value={kpis.checkins}  icon={MoveRight}                   />
        <KpiCard label={t('dashboard.hotel.checkoutsToday')}      value={kpis.checkouts} icon={MoveLeft}                    />
        <KpiCard label={t('dashboard.hotel.pendingReservations')} value={kpis.pendentes} icon={Clock}                       />
      </div>

      {/* Mapa de quartos */}
      <div className="bg-white rounded-lg border border-n-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <BedDouble size={15} strokeWidth={1.75} className="text-n-500" />
          <h2 className="font-display font-semibold text-sm text-n-700 uppercase tracking-wide">
            {t('dashboard.hotel.roomMap')}
          </h2>
          <button
            onClick={() => navigate('/housekeeping')}
            className="ml-auto text-xs font-body text-ocean-700 hover:underline flex items-center gap-1"
          >
            <Sparkles size={11} strokeWidth={1.75} />
            {t('dashboard.hotel.housekeeping')}
          </button>
        </div>
        <HotelMap units={units} todayRes={todayRes} onSelect={setSelected} />
      </div>

      {/* Check-ins + Check-outs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-n-200 shadow-sm">
          <div className="px-5 py-4 border-b border-n-100 flex items-center gap-2">
            <MoveRight size={14} strokeWidth={1.75} className="text-[#1A7A4A]" />
            <h2 className="font-display font-semibold text-sm text-n-700">{t('dashboard.hotel.checkinsToday')}</h2>
            <span className="ml-auto text-xs font-body text-n-400">{checkinsHoje.length}</span>
          </div>
          {checkinsHoje.length === 0 ? (
            <p className="px-5 py-6 text-center text-xs font-body text-n-400">{t('dashboard.hotel.noCheckinToday')}</p>
          ) : (
            <div className="divide-y divide-n-100">
              {checkinsHoje.map(r => (
                <div key={r.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-display font-semibold text-n-900 truncate">{r.customer_name || '—'}</p>
                    <p className="text-xs font-body text-n-400">
                      {units.find(u => u.id === r.unit_id)?.name || '—'} · {r.guests || 1} {t('dashboard.common.guestsSuffix')}
                    </p>
                  </div>
                  <Badge variant={r.status === 'confirmed' ? 'confirmed' : 'pending'}>
                    {r.status === 'confirmed' ? t('dashboard.status.confirmed') : t('dashboard.status.pending')}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border border-n-200 shadow-sm">
          <div className="px-5 py-4 border-b border-n-100 flex items-center gap-2">
            <MoveLeft size={14} strokeWidth={1.75} className="text-n-500" />
            <h2 className="font-display font-semibold text-sm text-n-700">{t('dashboard.hotel.checkoutsToday')}</h2>
            <span className="ml-auto text-xs font-body text-n-400">{checkoutsHoje.length}</span>
          </div>
          {checkoutsHoje.length === 0 ? (
            <p className="px-5 py-6 text-center text-xs font-body text-n-400">{t('dashboard.hotel.noCheckoutToday')}</p>
          ) : (
            <div className="divide-y divide-n-100">
              {checkoutsHoje.map(r => (
                <div key={r.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-display font-semibold text-n-900 truncate">{r.customer_name || '—'}</p>
                    <p className="text-xs font-body text-n-400">
                      {units.find(u => u.id === r.unit_id)?.name || '—'} · {r.guests || 1} {t('dashboard.common.guestsSuffix')}
                    </p>
                  </div>
                  <Badge variant="info">{t('dashboard.map.checkout')}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Room detail overlay */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}
        >
          <div className="bg-white rounded-xl border border-n-200 shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-display font-bold text-base text-n-900">{selected.name}</h3>
                <p className="text-xs font-body text-n-500 mt-0.5">
                  {selected.unit_type || '—'}
                  {(() => { try { const m = JSON.parse(selected.description || '{}'); return m.floor ? ` · ${t('dashboard.hotel.floor', { n: m.floor })}` : ''; } catch { return ''; } })()}
                </p>
              </div>
              <button onClick={() => setSelected(null)} className="p-1 text-n-400 hover:text-n-700 rounded">
                <XIcon size={16} strokeWidth={1.75} />
              </button>
            </div>

            {roomRes ? (
              <div className="bg-n-50 rounded-md p-3 mb-4 space-y-1">
                <p className="text-sm font-display font-semibold text-n-900">{roomRes.customer_name || '—'}</p>
                <p className="text-xs font-body text-n-500">
                  {t('dashboard.hotel.checkIn')}: {roomRes.check_in} · {t('dashboard.hotel.checkOut')}: {roomRes.check_out}
                </p>
                <p className="text-xs font-body text-n-500">{roomRes.guests || 1} {t('dashboard.common.guestsSuffix')}</p>
                <div className="pt-1">
                  <Badge variant={STATUS_BADGE_MAP_H[roomRes.status] || 'default'}>
                    {STATUS_KEY_H[roomRes.status] ? t(`dashboard.status.${STATUS_KEY_H[roomRes.status]}`) : roomRes.status}
                  </Badge>
                </div>
              </div>
            ) : (
              <p className="text-sm font-body text-n-400 mb-4">{t('dashboard.hotel.noActiveReservation')}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setSelected(null)}
                className="flex-1 h-9 rounded-md border border-n-200 text-sm font-body text-n-700 hover:bg-n-50 transition-colors"
              >
                {t('dashboard.common.close')}
              </button>
              <button
                onClick={() => { navigate('/reservas'); setSelected(null); }}
                className="flex-1 h-9 rounded-md bg-ocean-700 text-white text-sm font-body font-medium hover:bg-ocean-500 transition-colors flex items-center justify-center gap-1.5"
              >
                <BookOpen size={13} strokeWidth={1.75} />
                {t('dashboard.common.viewReservations')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
