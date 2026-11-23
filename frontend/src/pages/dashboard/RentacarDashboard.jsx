import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Euro, BookOpen, Car, X as XIcon, Wrench, Star, AlertTriangle,
} from 'lucide-react';
import { listUnits } from '../../services/unitsService';
import { listReservations } from '../../services/reservationsService';
import { estadiaEm } from '../../services/reservationRanges';
import { useT } from '../../i18n';
import { formatarNumero } from '../../utils/formatoLingua';
import useUiStore from '../../store/uiStore';
import useAgora from '../../hooks/useAgora';
import AttentionPanel from '../../components/dashboard/AttentionPanel';
import DayAgenda from '../../components/dashboard/DayAgenda';
import HeroCard from '../../components/dashboard/HeroCard';
import StatTiles from '../../components/dashboard/StatTiles';
import Shortcuts from '../../components/dashboard/Shortcuts';
import NextDaysStrip from '../../components/dashboard/NextDaysStrip';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import { TODAY, mesAtual, uniaoPorId, CELL, unitStatus, parseVehicleMeta, MapLegend } from './shared';
import { buildAttentionItems } from './dashboardLogic';
import { serieReceitaAcumulada, variacaoPercentual, valorMedio, porReceber, localeDe } from './agendaLogic';
import { eventosRentacar } from './agendaTipos';
import useMolduraComum from './useMolduraComum';

const ESTADOS_CONFIRMADOS = ['confirmed', 'checked_in', 'checked_out'];

function proximosDias() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d.toLocaleDateString('en-CA');
  });
}

function euros(valor) {
  return `€${formatarNumero(Math.round(Number(valor) || 0))}`;
}

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
  const lang     = useUiStore((s) => s.lang);
  const navigate = useNavigate();
  const agora    = useAgora();
  const periodo  = mesAtual();
  const molde    = useMolduraComum();
  const next7    = useMemo(() => proximosDias(), []);

  const [units,    setUnits]    = useState([]);
  const [todayRes, setTodayRes] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    /* Cada chamada falha para o seu valor vazio: uma falha nao apaga as outras */
    Promise.all([
      listUnits().catch(() => []),
      listReservations(estadiaEm(TODAY)).catch(() => []),
      /* Quem ja fez check-in e passou a data de saida nao sobrepoe hoje, mas continua a ocupar */
      listReservations({ status: 'checked_in' }).catch(() => []),
    ])
      .then(([u, tRes, ciRes]) => {
        setUnits(u || []);
        setTodayRes(uniaoPorId(tRes, ciRes));
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
      ativos:    active.length,
      alugados:  rented,
      ocupacao:  active.length ? Math.min(100, Math.round((rented / active.length) * 100)) : 0,
      manutencao: inMaint,
    };
  }, [units, vehicleStatusMap]);

  /* Agenda: levantamentos e devolucoes a hora da reserva (agendaTipos.js) */
  const eventos = useMemo(
    () => eventosRentacar({ reservas: todayRes, unidades: units, hoje: TODAY, t }),
    [todayRes, units, t],
  );

  /* Proximos 7 dias: levantamentos por dia */
  const levantamentosPorDia = useMemo(() => {
    const m = Object.fromEntries(next7.map(d => [d, 0]));
    molde.semana
      .filter(r => ['pending', 'confirmed', 'checked_in'].includes(r.status))
      .forEach(r => { if (m[r.check_in] !== undefined) m[r.check_in]++; });
    return m;
  }, [molde.semana, next7]);

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

  if (loading || !molde.carregado) return <div className="flex justify-center py-20"><LoadingSpinner size={32} /></div>;

  const resumo = molde.resumo;
  const receita = Number(resumo?.atual?.receita) || 0;
  const levantamentos = eventos.filter(e => e.tipo === 'levantamento');
  const devolucoes = eventos.filter(e => e.tipo === 'devolucao');
  const confirmadasMes = molde.mes.filter(r => ESTADOS_CONFIRMADOS.includes(r.status)).length;
  const medio = valorMedio(receita, confirmadasMes);
  const mesNome = new Date(`${periodo.inicio}T12:00:00`).toLocaleDateString(localeDe(lang), { month: 'long' });

  const tiles = [
    { id: 'disponiveis', icon: Car, tone: 'ocean', label: t('dashboard.rentacar.availableVehicles'), value: String(kpis.available) },
    { id: 'avaliacao', icon: Star, tone: 'sand', label: t('dashboard.tiles.rating'), value: molde.avaliacao != null ? Number(molde.avaliacao).toFixed(1) : '—' },
    { id: 'medio', icon: Euro, tone: 'success', label: t('dashboard.tiles.avgValue'), value: medio != null ? euros(medio) : '—' },
    { id: 'receber', icon: AlertTriangle, tone: 'warning', label: t('dashboard.tiles.toReceive'), value: euros(porReceber(molde.porPagar)) },
  ];

  return (
    <div className="space-y-4">
      <HeroCard
        receita={receita}
        variacao={resumo?.atual && resumo?.anterior ? variacaoPercentual(resumo.atual.receita, resumo.anterior.receita) : null}
        serie={serieReceitaAcumulada(molde.receitaDia, periodo.inicio, TODAY)}
        ocupacao={kpis.ocupacao}
        rotuloOcupacao={t('dashboard.hero.occupancyToday')}
        volume={t('dashboard.hero.vehiclesRented', { n: kpis.alugados, total: kpis.ativos })}
        hojeValor={t('dashboard.hero.pickups', { n: levantamentos.length })}
        hojeDetalhe={t('dashboard.hero.returns', { n: devolucoes.length })}
        mesNome={mesNome}
      />

      <StatTiles tiles={tiles} />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] gap-4 items-start">
        <DayAgenda
          eventos={eventos}
          agoraMin={agora.getHours() * 60 + agora.getMinutes()}
          onAbrir={() => navigate('/calendario')}
          resumo={t('dashboard.agenda.summaryRentacar', { a: levantamentos.length, d: devolucoes.length })}
          vazio={<EmptyState icon={Car} title={t('dashboard.agenda.empty')} />}
        />
        <div className="space-y-4">
          <AttentionPanel items={attentionItems} />
          <Shortcuts />
          <NextDaysStrip dias={next7} contagens={levantamentosPorDia} hoje={TODAY} lang={lang} onAbrir={() => navigate('/calendario')} />
        </div>
      </div>

      {/* Frota */}
      <section className="bg-white border border-n-200 rounded-md">
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
