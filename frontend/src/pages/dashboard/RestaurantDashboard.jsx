import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Euro, BookOpen, Users, UtensilsCrossed, Star, X as XIcon, AlertTriangle,
} from 'lucide-react';
import { listOrders } from '../../services/ordersService';
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
import { TODAY, mesAtual, CELL, unitStatus, parseVehicleMeta, TableMap, ZONE_KEYS } from './shared';
import { buildAttentionItems } from './dashboardLogic';
import { serieReceitaAcumulada, variacaoPercentual, valorMedio, porReceber, localeDe } from './agendaLogic';
import { eventosRestaurante } from './agendaTipos';
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

/* ─── Restaurant dashboard ──────────────────────────────────── */

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
  const lang     = useUiStore((s) => s.lang);
  const navigate = useNavigate();
  const agora    = useAgora();
  const periodo  = mesAtual();
  const molde    = useMolduraComum();
  const next7    = useMemo(() => proximosDias(), []);

  const [units,     setUnits]     = useState([]);
  const [todayRes,  setTodayRes]  = useState([]);
  const [pedidos,   setPedidos]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [selected,  setSelected]  = useState(null);

  useEffect(() => {
    /* Cada chamada falha para o seu valor vazio: uma falha nao apaga as outras. O resumo, o mes, a
       avaliacao e os 7 dias vem da moldura comum (useMolduraComum) */
    Promise.all([
      listUnits().catch(() => []),
      listReservations(estadiaEm(TODAY)).catch(() => []),
      /* pre-pedidos (ultimos 200), cruzados por reservation_id na agenda */
      listOrders().catch(() => []),
    ])
      .then(([u, tRes, ords]) => {
        setUnits((u || []).filter(x => x.unit_type !== 'menu_item' && x.unit_type !== 'tasting_menu'));
        setTodayRes(tRes || []);
        setPedidos(Array.isArray(ords) ? ords : []);
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

  const kpis = useMemo(() => {
    const ativas = units.filter(u => u.is_active !== false && u.status !== 'inactive');
    const ocupadas = ativas.filter(u => statusMap[u.id]).length;
    return {
      ativas: ativas.length,
      ocupadas,
      ocupacao: ativas.length ? Math.min(100, Math.round((ocupadas / ativas.length) * 100)) : 0,
      coversMes: molde.mes.filter(r => ESTADOS_CONFIRMADOS.includes(r.status)).reduce((s, r) => s + (r.guests || 0), 0),
    };
  }, [units, statusMap, molde.mes]);

  /* Agenda: reservas de mesa por hora (agendaTipos.js) */
  const eventos = useMemo(
    () => eventosRestaurante({ reservas: todayRes, unidades: units, pedidos, hoje: TODAY, t }),
    [todayRes, units, pedidos, t],
  );

  /* Proximos 7 dias: reservas por dia */
  const reservasPorDia = useMemo(() => {
    const m = Object.fromEntries(next7.map(d => [d, 0]));
    molde.semana
      .filter(r => ['pending', 'confirmed', 'checked_in'].includes(r.status))
      .forEach(r => { if (m[r.check_in] !== undefined) m[r.check_in]++; });
    return m;
  }, [molde.semana, next7]);

  /* Itens do painel "Requer atencao" (reservas pendentes de hoje) */
  const attentionItems = useMemo(
    () => buildAttentionItems({ pendingToday: todayRes.filter(r => r.status === 'pending') }, t),
    [todayRes, t]
  );

  const tableRes = useMemo(() => {
    if (!selected) return null;
    return todayRes.find(r =>
      r.unit_id === selected.id && ['pending', 'confirmed', 'checked_in'].includes(r.status)
    ) || null;
  }, [selected, todayRes]);

  if (loading || !molde.carregado) return <div className="flex justify-center py-20"><LoadingSpinner size={32} /></div>;

  const resumo = molde.resumo;
  const receita = Number(resumo?.atual?.receita) || 0;
  const pessoasHoje = eventos.reduce((s, e) => s + e.pessoas, 0);
  const pendentesHoje = eventos.reduce((s, e) => s + e.pendentes, 0);
  const confirmadasMes = molde.mes.filter(r => ESTADOS_CONFIRMADOS.includes(r.status)).length;
  const medio = valorMedio(receita, confirmadasMes);
  const mesNome = new Date(`${periodo.inicio}T12:00:00`).toLocaleDateString(localeDe(lang), { month: 'long' });

  const tiles = [
    { id: 'covers', icon: Users, tone: 'ocean', label: t('dashboard.restaurant.coversMonth'), value: String(kpis.coversMes) },
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
        volume={t('dashboard.hero.tablesTaken', { n: kpis.ocupadas, total: kpis.ativas })}
        hojeValor={t('dashboard.hero.peopleToday', { n: pessoasHoje })}
        hojeDetalhe={t('dashboard.hero.peopleTables', { n: eventos.length, p: pendentesHoje })}
        mesNome={mesNome}
      />

      <StatTiles tiles={tiles} />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] gap-4 items-start">
        <DayAgenda
          eventos={eventos}
          agoraMin={agora.getHours() * 60 + agora.getMinutes()}
          onAbrir={() => navigate('/calendario')}
          resumo={t('dashboard.agenda.summaryRestaurant', { n: eventos.length, p: pessoasHoje })}
          vazio={<EmptyState icon={UtensilsCrossed} title={t('dashboard.agenda.empty')} />}
        />
        <div className="space-y-4">
          <AttentionPanel items={attentionItems} />
          <Shortcuts />
          <NextDaysStrip dias={next7} contagens={reservasPorDia} hoje={TODAY} lang={lang} onAbrir={() => navigate('/calendario')} />
        </div>
      </div>

      {/* Mapa de mesas */}
      <section className="bg-white border border-n-200 rounded-md">
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
