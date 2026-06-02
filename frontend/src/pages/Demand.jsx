import { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, Gift, AlertTriangle,
  BarChart2, RefreshCw, Calendar, Zap, Minus,
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend, ReferenceLine,
  Cell,
} from 'recharts';
import { getReceita } from '../services/financeiroService';
import { listReservations } from '../services/reservationsService';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import LoadingSpinner from '../components/shared/LoadingSpinner';

/* ── helpers ── */
const MONTHS_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function currentYear()  { return new Date().getFullYear(); }
function prevYear()     { return currentYear() - 1; }
function addDays(base, n) {
  const d = new Date(base + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function monthLabel(dateStr) {
  if (!dateStr) return '';
  const m = parseInt(dateStr.split('-')[1]) - 1;
  return MONTHS_PT[m] || '';
}

function avg(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

/* ── CHART TOOLTIP ── */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-n-200 rounded-sm shadow-sm px-3 py-2 text-xs font-body">
      <p className="font-semibold text-n-700 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: €{Math.round(p.value).toLocaleString('pt-PT')}
        </p>
      ))}
    </div>
  );
}

/* ── Suggestion Card ── */
function SuggestionCard({ type, month, text }) {
  const isHigh = type === 'high';
  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-md border ${
      isHigh ? 'bg-[#ECFDF5] border-green-200' : 'bg-ocean-50 border-ocean-200'
    }`}>
      {isHigh
        ? <TrendingUp size={15} strokeWidth={1.75} className="text-[#1A7A4A] shrink-0 mt-0.5" />
        : <Gift size={15} strokeWidth={1.75} className="text-ocean-700 shrink-0 mt-0.5" />}
      <p className={`text-xs font-body ${isHigh ? 'text-[#1A7A4A]' : 'text-ocean-700'}`}>{text}</p>
    </div>
  );
}

/* ─────────────────────── Main ─────────────────────── */
export default function Demand() {
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
        listReservations({ from: today, to: end30, status: 'confirmed,pending' }).catch(() => []),
      ]);
      setCurData(cur || []);
      setPrevData(prev || []);
      setNext30Res(upcoming || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  /* ── Process monthly chart data ── */
  const chartData = useMemo(() => {
    return MONTHS_PT.map((name, idx) => {
      const month = String(idx + 1).padStart(2, '0');
      const curPt  = curData.find(d  => d.date?.slice(5, 7) === month || d.date?.slice(0, 7) === `${yr}-${month}`);
      const prevPt = prevData.find(d => d.date?.slice(5, 7) === month || d.date?.slice(0, 7) === `${py}-${month}`);
      return {
        name,
        curValue:  Math.round(curPt?.value  || curPt?.total  || 0),
        prevValue: Math.round(prevPt?.value || prevPt?.total || 0),
        month: idx + 1,
      };
    });
  }, [curData, prevData]);

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

  /* ── Suggestions ── */
  const suggestions = useMemo(() => {
    const result = [];
    highMonths.forEach(m => {
      result.push({
        type: 'high',
        text: `${m.name} e historicamente um mes de alta procura — considera abrir mais vagas e ajustar precos para maximizar receita.`,
      });
    });
    lowMonths.forEach(m => {
      result.push({
        type: 'low',
        text: `${m.name} tem historicamente baixa ocupacao — cria uma promocao especial ou voucher para atrair mais reservas.`,
      });
    });
    if (result.length === 0) {
      result.push({
        type: 'low',
        text: 'Sem dados historicos suficientes para gerar sugestoes. Adiciona mais reservas ao sistema para desbloquear a analise de sazonalidade.',
      });
    }
    return result.slice(0, 6);
  }, [highMonths, lowMonths]);

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
    { key: 'historico',  label: 'Historico',      Icon: BarChart2 },
    { key: 'proximo30',  label: 'Proximos 30 dias', Icon: Calendar  },
    { key: 'sugestoes',  label: 'Sugestoes',       Icon: Zap        },
  ];

  return (
    <div>
      <PageHeader
        title="Previsao de Procura"
        subtitle="Analise de sazonalidade e identificacao de oportunidades"
        actions={
          <Button variant="secondary" icon={RefreshCw} size="sm" onClick={carregar} loading={loading}>
            Actualizar
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          {
            label:  `Receita ${yr} (acumulado)`,
            value:  `€${Math.round(curTotal).toLocaleString('pt-PT')}`,
            color:  'text-ocean-700',
            icon:   TrendingUp,
          },
          {
            label:  'Var. vs ano anterior',
            value:  yoyDelta != null ? `${yoyDelta > 0 ? '+' : ''}${yoyDelta}%` : '—',
            color:  yoyDelta == null ? 'text-n-400' : yoyDelta >= 0 ? 'text-[#1A7A4A]' : 'text-error',
            icon:   yoyDelta == null ? Minus : yoyDelta >= 0 ? TrendingUp : TrendingDown,
          },
          {
            label:  'Melhor mes',
            value:  bestMonth?.curValue > 0 ? bestMonth.name : '—',
            color:  'text-[#1A7A4A]',
            icon:   BarChart2,
          },
          {
            label:  'Reservas proximos 30d',
            value:  next30Res.length,
            color:  'text-n-900',
            icon:   Calendar,
          },
        ].map(m => (
          <div key={m.label} className="bg-white border border-n-200 rounded-md px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-sm bg-ocean-50 flex items-center justify-center shrink-0">
              <m.icon size={16} strokeWidth={1.75} className="text-ocean-700" />
            </div>
            <div>
              <p className={`font-display font-bold text-xl ${m.color}`}>{m.value}</p>
              <p className="text-xs font-body text-n-500">{m.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-n-200 mb-5">
        {TABS.map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-body font-semibold border-b-2 -mb-px transition-colors ${
              activeTab === key ? 'border-ocean-700 text-ocean-700' : 'border-transparent text-n-500 hover:text-n-700'
            }`}>
            <Icon size={15} strokeWidth={1.75} />{label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-24"><LoadingSpinner size={36} /></div>
      ) : activeTab === 'historico' ? (
        <div className="space-y-5">
          {/* Monthly bar + line chart */}
          <Card
            header={
              <div className="flex items-center justify-between">
                <h3 className="font-display font-semibold text-sm text-n-700">Receita mensal — comparativo anual</h3>
                <span className="text-xs font-mono text-n-400">{py} vs {yr}</span>
              </div>
            }
            padding="px-5 pb-5 pt-2"
          >
            {chartData.every(d => d.curValue === 0 && d.prevValue === 0) ? (
              <div className="text-center py-10">
                <BarChart2 size={28} strokeWidth={1.25} className="mx-auto mb-2 text-n-300" />
                <p className="text-sm font-body text-n-400">Sem dados financeiros disponiveis para o periodo.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E8EC" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fontFamily: 'DM Mono', fill: '#6B7280' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fontFamily: 'DM Mono', fill: '#6B7280' }} tickLine={false} axisLine={false}
                    tickFormatter={v => v > 999 ? `€${Math.round(v / 1000)}k` : `€${v}`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'DM Mono' }} />
                  {average > 0 && (
                    <ReferenceLine y={average} stroke="#D4A82A" strokeDasharray="4 4"
                      label={{ value: 'Media', position: 'insideTopRight', fontSize: 10, fill: '#D4A82A', fontFamily: 'DM Mono' }} />
                  )}
                  <Bar dataKey="prevValue" name={String(py)} fill="#E5E8EC" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="curValue"  name={String(yr)} radius={[2, 2, 0, 0]}>
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={
                        highMonths.some(h => h.name === d.name)  ? '#1A7A4A' :
                        lowMonths.some(l => l.name === d.name)   ? '#0D5470' :
                        '#3BA7CB'
                      } />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Season indicators */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card padding="px-5 py-4">
              <h3 className="font-display font-semibold text-sm text-n-700 mb-3">Epocas altas</h3>
              {highMonths.length === 0 ? (
                <p className="text-xs font-body text-n-400">Sem dados suficientes para identificar epocas altas.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {highMonths.map(m => (
                    <span key={m.name} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#ECFDF5] border border-green-200 rounded-sm text-xs font-body font-semibold text-[#1A7A4A]">
                      <TrendingUp size={11} strokeWidth={2} />
                      {m.name} · €{Math.round(m.curValue).toLocaleString('pt-PT')}
                    </span>
                  ))}
                </div>
              )}
            </Card>
            <Card padding="px-5 py-4">
              <h3 className="font-display font-semibold text-sm text-n-700 mb-3">Epocas baixas</h3>
              {lowMonths.length === 0 ? (
                <p className="text-xs font-body text-n-400">Sem epocas baixas identificadas — bom desempenho anual!</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {lowMonths.map(m => (
                    <span key={m.name} className="flex items-center gap-1.5 px-3 py-1.5 bg-ocean-50 border border-ocean-200 rounded-sm text-xs font-body font-semibold text-ocean-700">
                      <TrendingDown size={11} strokeWidth={2} />
                      {m.name} · €{Math.round(m.curValue).toLocaleString('pt-PT')}
                    </span>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>

      ) : activeTab === 'proximo30' ? (
        <div className="space-y-5">
          <Card padding="px-5 py-5">
            <h3 className="font-display font-semibold text-sm text-n-700 mb-4">
              Reservas confirmadas — proximos 30 dias
            </h3>
            {next30Res.length === 0 ? (
              <div className="text-center py-8">
                <Calendar size={28} strokeWidth={1.25} className="mx-auto mb-2 text-n-300" />
                <p className="text-sm font-body text-n-400">Sem reservas confirmadas para os proximos 30 dias.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-7 sm:grid-cols-10 gap-1 mb-4">
                  {next30Days.map(({ date, count }) => {
                    const isToday  = date === today;
                    const isHigh   = count >= 3;
                    const d        = new Date(date + 'T00:00:00Z');
                    const dayNum   = d.getUTCDate();
                    const monthAbbr = MONTHS_PT[d.getUTCMonth()];
                    const intensity = maxDayCount > 0 ? count / maxDayCount : 0;
                    return (
                      <div key={date} title={`${dayNum} ${monthAbbr}: ${count} reserva(s)`}
                        className={`rounded-sm p-1.5 flex flex-col items-center gap-0.5 border cursor-default ${
                          isToday
                            ? 'border-ocean-700 bg-ocean-700'
                            : isHigh
                            ? 'border-[#1A7A4A] bg-[#ECFDF5]'
                            : count > 0
                            ? 'border-ocean-200 bg-ocean-50'
                            : 'border-n-100 bg-white'
                        }`}>
                        <span className={`text-[9px] font-mono ${isToday ? 'text-white' : 'text-n-400'}`}>{monthAbbr}</span>
                        <span className={`text-xs font-display font-bold ${isToday ? 'text-white' : isHigh ? 'text-[#1A7A4A]' : count > 0 ? 'text-ocean-700' : 'text-n-400'}`}>
                          {dayNum}
                        </span>
                        {count > 0 && (
                          <span className={`text-[9px] font-mono font-semibold ${isToday ? 'text-ocean-200' : isHigh ? 'text-[#1A7A4A]' : 'text-ocean-500'}`}>
                            {count}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-4 text-[10px] font-mono text-n-400">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-[#1A7A4A] rounded-xs" /> Alta procura (3+)</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-ocean-100 rounded-xs border border-ocean-200" /> Reservas</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-white rounded-xs border border-n-200" /> Livre</span>
                </div>
              </>
            )}
          </Card>

          {/* Top busy days */}
          {next30Res.length > 0 && (
            <Card padding="px-5 py-4">
              <h3 className="font-display font-semibold text-sm text-n-700 mb-3">Dias com mais actividade</h3>
              <div className="space-y-2">
                {next30Days
                  .filter(d => d.count > 0)
                  .sort((a, b) => b.count - a.count)
                  .slice(0, 5)
                  .map(({ date, count }) => (
                    <div key={date} className="flex items-center gap-3">
                      <span className="text-xs font-mono text-n-500 w-28 shrink-0">
                        {new Date(date + 'T00:00:00Z').toLocaleDateString('pt-PT', { weekday: 'short', day: '2-digit', month: 'short' })}
                      </span>
                      <div className="flex-1 h-2 bg-n-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-ocean-500 transition-all"
                          style={{ width: `${(count / maxDayCount) * 100}%` }} />
                      </div>
                      <span className="text-xs font-mono font-semibold text-ocean-700 w-16 text-right shrink-0">
                        {count} reserva(s)
                      </span>
                    </div>
                  ))}
              </div>
            </Card>
          )}
        </div>

      ) : activeTab === 'sugestoes' ? (
        <div className="space-y-4">
          <div className="px-4 py-3 bg-ocean-50 border border-ocean-100 rounded-sm">
            <p className="text-xs font-body text-ocean-700">
              <span className="font-semibold">Sugestoes automaticas</span> baseadas nos dados de receita mensal dos ultimos 12 meses. Quanto mais dados tiveres no sistema, mais precisas sao as sugestoes.
            </p>
          </div>
          {suggestions.map((s, i) => (
            <SuggestionCard key={i} type={s.type} text={s.text} />
          ))}
          {bestMonth?.curValue > 0 && (
            <Card padding="px-5 py-4">
              <h3 className="font-display font-semibold text-sm text-n-700 mb-3">Comparativo anual</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs font-body text-n-500">Receita {yr}</p>
                  <p className="font-display font-bold text-lg text-ocean-700">
                    €{Math.round(curTotal).toLocaleString('pt-PT')}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-body text-n-500">Receita {py}</p>
                  <p className="font-display font-bold text-lg text-n-600">
                    €{Math.round(prevTotal).toLocaleString('pt-PT')}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-body text-n-500">Variacao</p>
                  <p className={`font-display font-bold text-lg ${yoyDelta == null ? 'text-n-400' : yoyDelta >= 0 ? 'text-[#1A7A4A]' : 'text-error'}`}>
                    {yoyDelta != null ? `${yoyDelta > 0 ? '+' : ''}${yoyDelta}%` : '—'}
                  </p>
                </div>
              </div>
            </Card>
          )}
        </div>
      ) : null}
    </div>
  );
}
