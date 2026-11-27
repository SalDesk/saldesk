import { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, Gift,
  BarChart2, RefreshCw, Calendar, Minus,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend, ReferenceLine,
  Cell,
} from 'recharts';
import { getReceita } from '../services/financeiroService';
import { listReservations } from '../services/reservationsService';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import MareStat from '../components/shared/MareStat';
import DicaGrafico from '../components/financial/DicaGrafico';
import Tabs from '../components/ui/Tabs';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import { useT } from '../i18n';
import { formatarData, formatarNumero, useLingua } from '../utils/formatoLingua';
import { MES_CHAVE, rotuloMes } from '../utils/rotuloMes';

/* Estilo Mare: cartao de pagina, titulo de cartao e algarismos alinhados */
const CARTAO = 'bg-white rounded-[18px] border border-mare-card p-[22px] min-w-0';
const TITULO = 'font-display text-lg font-semibold text-ocean-900';
const NUM = 'font-mono tabular-nums';
const CAIXA = 'bg-mare-head rounded-[14px] p-4';

/* ── helpers ── */

function currentYear()  { return new Date().getFullYear(); }
function prevYear()     { return currentYear() - 1; }
function addDays(base, n) {
  const d = new Date(base + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function avg(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

/* ── CHART TOOLTIP ── */
function ChartTooltip({ active, payload, label }) {
  useLingua();
  if (!active || !payload?.length) return null;
  return (
    <DicaGrafico>
      <p className="font-semibold text-n-700 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} className="flex items-center gap-1.5 text-n-700">
          <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color }} />
          <span className={NUM}>{p.name}: €{formatarNumero(Math.round(p.value))}</span>
        </p>
      ))}
    </DicaGrafico>
  );
}

/* ── Suggestion Card ── */
function SuggestionCard({ type, month, text }) {
  const isHigh = type === 'high';
  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-[14px] border ${
      isHigh ? 'bg-[var(--success-light)] border-[var(--success)]' : 'bg-ocean-50 border-ocean-200'
    }`}>
      {isHigh
        ? <TrendingUp size={15} strokeWidth={1.75} className="text-[var(--success)] shrink-0 mt-0.5" />
        : <Gift size={15} strokeWidth={1.75} className="text-ocean-700 shrink-0 mt-0.5" />}
      <p className={`text-[13px] font-body ${isHigh ? 'text-[var(--success)]' : 'text-ocean-700'}`}>{text}</p>
    </div>
  );
}

/* ─────────────────────── Main ─────────────────────── */
export default function Demand() {
  const t = useT();
  const lang = useLingua();
  const [activeTab,   setActiveTab]   = useState('historico');
  const [loading,     setLoading]     = useState(true);
  const [curData,     setCurData]     = useState([]);
  const [prevData,    setPrevData]    = useState([]);
  const [next30Res,   setNext30Res]   = useState([]);

  const today = new Date().toISOString().slice(0, 10);
  const end30 = addDays(today, 29);
  const yr    = currentYear();
  const py    = prevYear();

  async function carregar() {
    setLoading(true);
    try {
      const [cur, prev, upcoming] = await Promise.all([
        getReceita(`${yr}-01-01`, `${yr}-12-31`, 'month').catch(() => []),
        getReceita(`${py}-01-01`, `${py}-12-31`, 'month').catch(() => []),
        /* O backend filtra por check_in_from/check_in_to (nao conhece from/to) e `status` aceita UM valor
           (antes 'confirmed,pending' nao coincidia com nenhuma reserva e o contador dava sempre 0):
           pedem-se as reservas do intervalo e filtram-se aqui as confirmadas e pendentes. */
        listReservations({ check_in_from: today, check_in_to: end30 }).catch(() => []),
      ]);
      setCurData(cur || []);
      setPrevData(prev || []);
      setNext30Res((Array.isArray(upcoming) ? upcoming : []).filter(r => r.status === 'confirmed' || r.status === 'pending'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  /* ── Process monthly chart data (name: o mes abreviado na lingua do painel) ── */
  const chartData = useMemo(() => {
    return MES_CHAVE.map((_, idx) => {
      const name = rotuloMes(idx, t);
      const month = String(idx + 1).padStart(2, '0');
      /* GET /financial/receita devolve { periodo: 'AAAA-MM', receita, num_reservas } por mes */
      const curPt  = curData.find(d  => d.periodo === `${yr}-${month}`);
      const prevPt = prevData.find(d => d.periodo === `${py}-${month}`);
      return {
        name,
        curValue:  Math.round(Number(curPt?.receita  || 0)),
        prevValue: Math.round(Number(prevPt?.receita || 0)),
        month: idx + 1,
      };
    });
  }, [curData, prevData, lang]);

  /* ── Identify high/low seasons ── */
  const { highMonths, lowMonths, average, bestMonth, worstMonth } = useMemo(() => {
    const values = chartData.map(d => d.curValue);
    const mean   = avg(values.filter(v => v > 0)) || 0;
    const high   = chartData.filter(d => d.curValue > mean * 1.25);
    const low    = chartData.filter(d => d.curValue > 0 && d.curValue < mean * 0.75);
    const sorted = [...chartData].sort((a, b) => b.curValue - a.curValue);
    return {
      highMonths:  high,
      lowMonths:   low,
      average:     Math.round(mean),
      bestMonth:   sorted[0],
      worstMonth:  sorted.filter(d => d.curValue > 0).pop(),
    };
  }, [chartData]);

  /* ── Suggestions (o texto vem de demand.suggestionHigh / suggestionLow / suggestionNone) ── */
  const suggestions = useMemo(() => {
    const result = [];
    highMonths.forEach(m => {
      result.push({ type: 'high', text: t('demand.suggestionHigh', { month: m.name }) });
    });
    lowMonths.forEach(m => {
      result.push({ type: 'low', text: t('demand.suggestionLow', { month: m.name }) });
    });
    if (result.length === 0) {
      result.push({ type: 'low', text: t('demand.suggestionNone') });
    }
    return result.slice(0, 6);
  }, [highMonths, lowMonths, lang]);

  /* ── Next 30 days — group by date ── */
  const next30ByDate = useMemo(() => {
    const map = {};
    (next30Res || []).forEach(r => {
      const k = r.check_in;
      if (!map[k]) map[k] = 0;
      map[k]++;
    });
    return map;
  }, [next30Res]);

  const next30Days = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => {
      const date = addDays(today, i);
      return { date, count: next30ByDate[date] || 0 };
    });
  }, [next30ByDate, today]);

  const maxDayCount = Math.max(...next30Days.map(d => d.count), 1);

  /* ── Comparativo KPIs ── */
  const curTotal  = chartData.reduce((s, d) => s + d.curValue, 0);
  const prevTotal = chartData.reduce((s, d) => s + d.prevValue, 0);
  const yoyDelta  = prevTotal > 0 ? Math.round(((curTotal - prevTotal) / prevTotal) * 100) : null;

  const TABS = [
    { id: 'historico', label: t('demand.tabs.history') },
    { id: 'proximo30', label: t('demand.tabs.next30') },
    { id: 'sugestoes', label: t('demand.tabs.suggestions') },
  ];

  return (
    <div>
      <PageHeader
        title={t('demand.title')}
        subtitle={t('demand.subtitle')}
        eyebrow={t('nav.sections.gestao')}
        actions={
          <Button variant="secondary" icon={RefreshCw} size="sm" onClick={carregar} loading={loading} className="min-h-11 md:min-h-0">
            {t('demand.refresh')}
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <MareStat
          icon={TrendingUp}
          label={t('demand.revenueYtd', { year: yr })}
          value={`€${formatarNumero(Math.round(curTotal))}`}
        />
        <MareStat
          icon={yoyDelta == null ? Minus : yoyDelta >= 0 ? TrendingUp : TrendingDown}
          tone={yoyDelta == null ? 'default' : yoyDelta >= 0 ? 'bom' : 'aviso'}
          label={t('demand.vsLastYear')}
          value={yoyDelta != null ? `${yoyDelta > 0 ? '+' : ''}${yoyDelta}%` : '—'}
        />
        <MareStat
          icon={BarChart2}
          label={t('demand.bestMonth')}
          value={bestMonth?.curValue > 0 ? bestMonth.name : '—'}
        />
        <MareStat icon={Calendar} label={t('demand.next30')} value={next30Res.length} />
      </div>

      {/* Tabs */}
      <div className="mb-5">
        <Tabs tabs={TABS} value={activeTab} onChange={setActiveTab} />
      </div>

      {loading ? (
        <div className="flex justify-center py-24"><LoadingSpinner size={36} /></div>
      ) : activeTab === 'historico' ? (
        <div className="space-y-5">
          {/* Monthly bar + line chart */}
          <section className={CARTAO}>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h3 className={TITULO}>{t('demand.monthlyChart')}</h3>
              <span className={`text-xs text-n-500 ${NUM}`}>{py} vs {yr}</span>
            </div>
            {chartData.every(d => d.curValue === 0 && d.prevValue === 0) ? (
              <EmptyState icon={BarChart2} title={t('demand.noFinancialData')} />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                  <CartesianGrid stroke="var(--n200)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fontFamily: 'DM Mono', fill: 'var(--n500)' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 12, fontFamily: 'DM Mono', fill: 'var(--n500)' }} tickLine={false} axisLine={false}
                    tickFormatter={v => v > 999 ? `€${Math.round(v / 1000)}k` : `€${v}`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12, fontFamily: 'DM Mono' }} />
                  {average > 0 && (
                    <ReferenceLine y={average} stroke="var(--sand-500)" strokeDasharray="4 4"
                      label={{ value: t('demand.average'), position: 'insideTopRight', fontSize: 12, fill: 'var(--n700)', fontFamily: 'DM Mono' }} />
                  )}
                  <Bar dataKey="prevValue" name={String(py)} fill="var(--n400)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="curValue"  name={String(yr)} fill="var(--ocean-500)" radius={[4, 4, 0, 0]}>
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={
                        highMonths.some(h => h.name === d.name)  ? 'var(--sand-500)' :
                        lowMonths.some(l => l.name === d.name)   ? 'var(--ocean-700)' :
                        'var(--ocean-500)'
                      } />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </section>

          {/* Season indicators */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className={CARTAO}>
              <h3 className={`${TITULO} mb-3`}>{t('demand.highSeasons')}</h3>
              {highMonths.length === 0 ? (
                <p className="text-[13px] font-body text-n-600">{t('demand.noHighSeasons')}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {highMonths.map(m => (
                    <span key={m.name} className={`flex items-center gap-1.5 px-3 py-1.5 bg-[var(--success-light)] border border-[var(--success)] rounded-full text-xs font-semibold text-[var(--success)] ${NUM}`}>
                      <TrendingUp size={11} strokeWidth={2} />
                      {m.name} · €{formatarNumero(Math.round(m.curValue))}
                    </span>
                  ))}
                </div>
              )}
            </section>
            <section className={CARTAO}>
              <h3 className={`${TITULO} mb-3`}>{t('demand.lowSeasons')}</h3>
              {lowMonths.length === 0 ? (
                <p className="text-[13px] font-body text-n-600">{t('demand.noLowSeasons')}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {lowMonths.map(m => (
                    <span key={m.name} className={`flex items-center gap-1.5 px-3 py-1.5 bg-ocean-50 border border-ocean-200 rounded-full text-xs font-semibold text-ocean-700 ${NUM}`}>
                      <TrendingDown size={11} strokeWidth={2} />
                      {m.name} · €{formatarNumero(Math.round(m.curValue))}
                    </span>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>

      ) : activeTab === 'proximo30' ? (
        <div className="space-y-5">
          <section className={CARTAO}>
            <h3 className={`${TITULO} mb-4`}>
              {t('demand.confirmedNext30')}
            </h3>
            {next30Res.length === 0 ? (
              <EmptyState icon={Calendar} title={t('demand.noConfirmed')} />
            ) : (
              <>
                <div className="grid grid-cols-7 sm:grid-cols-10 gap-1 mb-4">
                  {next30Days.map(({ date, count }) => {
                    const isToday  = date === today;
                    const isHigh   = count >= 3;
                    const d        = new Date(date + 'T00:00:00Z');
                    const dayNum   = d.getUTCDate();
                    const monthAbbr = rotuloMes(d.getUTCMonth(), t);
                    const intensity = maxDayCount > 0 ? count / maxDayCount : 0;
                    return (
                      <div key={date} title={t('demand.dayTitle', { day: dayNum, month: monthAbbr, n: count })}
                        className={`rounded-[10px] p-1.5 flex flex-col items-center gap-0.5 border cursor-default ${
                          isToday
                            ? 'border-ocean-700 bg-ocean-700'
                            : isHigh
                            ? 'border-[var(--success)] bg-[var(--success-light)]'
                            : count > 0
                            ? 'border-ocean-200 bg-ocean-50'
                            : 'border-mare-card bg-white'
                        }`}>
                        <span className={`text-[10px] ${NUM} ${isToday ? 'text-white' : 'text-n-500'}`}>{monthAbbr}</span>
                        <span className={`text-xs font-bold ${NUM} ${isToday ? 'text-white' : isHigh ? 'text-[var(--success)]' : count > 0 ? 'text-ocean-700' : 'text-n-500'}`}>
                          {dayNum}
                        </span>
                        {count > 0 && (
                          <span className={`text-[10px] font-semibold ${NUM} ${isToday ? 'text-ocean-100' : isHigh ? 'text-[var(--success)]' : 'text-ocean-700'}`}>
                            {count}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-body text-n-600">
                  <span className="flex items-center gap-1.5"><span aria-hidden="true" className="w-3 h-3 bg-[var(--success-light)] rounded-[4px] border border-[var(--success)]" /> {t('demand.highDemand')}</span>
                  <span className="flex items-center gap-1.5"><span aria-hidden="true" className="w-3 h-3 bg-ocean-50 rounded-[4px] border border-ocean-200" /> {t('demand.bookings')}</span>
                  <span className="flex items-center gap-1.5"><span aria-hidden="true" className="w-3 h-3 bg-white rounded-[4px] border border-n-300" /> {t('demand.free')}</span>
                </div>
              </>
            )}
          </section>

          {/* Top busy days */}
          {next30Res.length > 0 && (
            <section className={CARTAO}>
              <h3 className={`${TITULO} mb-3`}>{t('demand.busiestDays')}</h3>
              <div className="space-y-2">
                {next30Days
                  .filter(d => d.count > 0)
                  .sort((a, b) => b.count - a.count)
                  .slice(0, 5)
                  .map(({ date, count }) => (
                    <div key={date} className="flex items-center gap-3">
                      <span className={`text-xs text-n-600 w-28 shrink-0 ${NUM}`}>
                        {formatarData(new Date(date + 'T00:00:00Z'), { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC' })}
                      </span>
                      <div className="flex-1 h-2 bg-n-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-ocean-500 transition-all"
                          style={{ width: `${(count / maxDayCount) * 100}%` }} />
                      </div>
                      <span className={`text-xs font-semibold text-ocean-700 w-24 text-right shrink-0 whitespace-nowrap ${NUM}`}>
                        {t('demand.bookingsCount', { n: count })}
                      </span>
                    </div>
                  ))}
              </div>
            </section>
          )}
        </div>

      ) : activeTab === 'sugestoes' ? (
        <div className="space-y-4">
          <div className="px-4 py-3 bg-mare-head border border-mare-card rounded-[14px]">
            <p className="text-[13px] font-body text-ocean-800">
              <span className="font-semibold">{t('demand.suggestionsIntroBold')}</span>{t('demand.suggestionsIntro')}
            </p>
          </div>
          {suggestions.map((s, i) => (
            <SuggestionCard key={i} type={s.type} text={s.text} />
          ))}
          {bestMonth?.curValue > 0 && (
            <section className={CARTAO}>
              <h3 className={`${TITULO} mb-3`}>{t('demand.yearComparison')}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className={CAIXA}>
                  <p className="text-[13px] font-body font-semibold text-n-600">{t('demand.revenueYear', { year: yr })}</p>
                  <p className={`text-lg font-bold text-ocean-900 ${NUM}`}>
                    €{formatarNumero(Math.round(curTotal))}
                  </p>
                </div>
                <div className={CAIXA}>
                  <p className="text-[13px] font-body font-semibold text-n-600">{t('demand.revenueYear', { year: py })}</p>
                  <p className={`text-lg font-bold text-ocean-900 ${NUM}`}>
                    €{formatarNumero(Math.round(prevTotal))}
                  </p>
                </div>
                <div className={CAIXA}>
                  <p className="text-[13px] font-body font-semibold text-n-600">{t('demand.change')}</p>
                  <p className={`text-lg font-bold text-ocean-900 ${NUM}`}>
                    {yoyDelta != null ? `${yoyDelta > 0 ? '+' : ''}${yoyDelta}%` : '—'}
                  </p>
                </div>
              </div>
            </section>
          )}
        </div>
      ) : null}
    </div>
  );
}
