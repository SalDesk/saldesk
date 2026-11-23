import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, Clock, X as XIcon, BedDouble, Sparkles, Star, Euro, AlertTriangle,
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
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import { TODAY, mesAtual, uniaoPorId, HotelMap } from './shared';
import { buildAttentionItems } from './dashboardLogic';
import { serieReceitaAcumulada, variacaoPercentual, valorMedio, porReceber, localeDe } from './agendaLogic';
import { eventosHotel } from './agendaTipos';
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
  const lang     = useUiStore((s) => s.lang);
  const navigate = useNavigate();
  const agora    = useAgora();
  const periodo  = mesAtual();
  const molde    = useMolduraComum();
  const next7    = useMemo(() => proximosDias(), []);

  const [units,    setUnits]    = useState([]);
  const [todayRes, setTodayRes] = useState([]);
  const [pendingRes, setPendingRes] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    /* Cada chamada falha para o seu valor vazio: uma falha nao apaga as outras */
    Promise.all([
      listUnits().catch(() => []),
      listReservations(estadiaEm(TODAY)).catch(() => []),
      /* Quem ja fez check-in e passou a data de saida nao sobrepoe hoje, mas continua a ocupar */
      listReservations({ status: 'checked_in' }).catch(() => []),
      /* Todas as pendentes, de qualquer mes (a barra lateral ja conta assim): o contador so com as do mes
         escondia as reservas por confirmar dos meses seguintes */
      listReservations({ status: 'pending' }).catch(() => []),
    ])
      .then(([u, tRes, ciRes, pRes]) => {
        setUnits(u || []);
        setTodayRes(uniaoPorId(tRes, ciRes));
        setPendingRes(Array.isArray(pRes) ? pRes : []);
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
      ocupados:  occupied,
      ativos:    active.length,
      checkins:  todayRes.filter(r => r.check_in  === TODAY && ['pending', 'confirmed'].includes(r.status)).length,
      checkouts: todayRes.filter(r => r.check_out === TODAY && r.status === 'checked_in').length,
      pendentes: pendingRes.filter(r => r.status === 'pending').length,
    };
  }, [units, todayRes, pendingRes]);

  /* Agenda: partidas as 11:00 e chegadas as 14:00 (agendaTipos.js) */
  const eventos = useMemo(
    () => eventosHotel({ reservas: todayRes, unidades: units, hoje: TODAY, t }),
    [todayRes, units, t],
  );

  /* Proximos 7 dias: chegadas por dia */
  const chegadasPorDia = useMemo(() => {
    const m = Object.fromEntries(next7.map(d => [d, 0]));
    molde.semana
      .filter(r => ['pending', 'confirmed', 'checked_in'].includes(r.status))
      .forEach(r => { if (m[r.check_in] !== undefined) m[r.check_in]++; });
    return m;
  }, [molde.semana, next7]);

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

  /* Itens do painel "Requer atencao" (manutencao, por confirmar, limpezas) */
  const attentionItems = useMemo(() => buildAttentionItems({
    maintenance: alertas.manutencao,
    unconfirmed: alertas.semConfirmacao,
    cleaning:    alertas.limpeza,
  }, t), [alertas, t]);

  if (loading || !molde.carregado) return <div className="flex justify-center py-20"><LoadingSpinner size={32} /></div>;

  const resumo = molde.resumo;
  const receita = Number(resumo?.atual?.receita) || 0;
  const chegadas = eventos.filter(e => e.tipo === 'chegada');
  const partidas = eventos.filter(e => e.tipo === 'partida');
  const pendentesHoje = eventos.reduce((s, e) => s + e.pendentes, 0);
  const confirmadasMes = molde.mes.filter(r => ESTADOS_CONFIRMADOS.includes(r.status)).length;
  const medio = valorMedio(receita, confirmadasMes);
  const mesNome = new Date(`${periodo.inicio}T12:00:00`).toLocaleDateString(localeDe(lang), { month: 'long' });

  const tiles = [
    { id: 'pendentes', icon: Clock, tone: 'ocean', label: t('dashboard.hotel.pendingReservations'), value: String(kpis.pendentes) },
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
        volume={t('dashboard.hero.roomsOccupied', { n: kpis.ocupados, total: kpis.ativos })}
        hojeValor={t('dashboard.hero.arrivals', { n: chegadas.length })}
        hojeDetalhe={t('dashboard.hero.departures', { n: partidas.length, p: pendentesHoje })}
        mesNome={mesNome}
      />

      <StatTiles tiles={tiles} />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] gap-4 items-start">
        <DayAgenda
          eventos={eventos}
          agoraMin={agora.getHours() * 60 + agora.getMinutes()}
          onAbrir={() => navigate('/calendario')}
          resumo={t('dashboard.agenda.summaryHotel', { a: chegadas.length, d: partidas.length })}
          vazio={<EmptyState icon={BedDouble} title={t('dashboard.agenda.empty')} />}
        />
        <div className="space-y-4">
          <AttentionPanel items={attentionItems} />
          <Shortcuts />
          <NextDaysStrip dias={next7} contagens={chegadasPorDia} hoje={TODAY} lang={lang} onAbrir={() => navigate('/calendario')} />
        </div>
      </div>

      {/* Mapa de quartos */}
      <section className="bg-white border border-n-200 rounded-md">
        <header className="flex items-center gap-2 px-4 py-3 border-b border-n-200">
          <BedDouble size={14} strokeWidth={1.75} className="text-n-500" aria-hidden="true" />
          <h2 className="font-display font-semibold text-sm text-n-900">{t('dashboard.hotel.roomMap')}</h2>
          <button
            type="button"
            onClick={() => navigate('/housekeeping')}
            className="ml-auto text-xs font-body text-ocean-700 hover:underline flex items-center gap-1"
          >
            <Sparkles size={11} strokeWidth={1.75} aria-hidden="true" />
            {t('dashboard.hotel.housekeeping')}
          </button>
        </header>
        <div className="p-4">
          <HotelMap units={units} todayRes={todayRes} onSelect={setSelected} />
        </div>
      </section>

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
