import { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  FileText,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import { exportExcel, exportPdf, getReceita } from '../../services/financeiroService';
import { listExpenses, getSalaryPayments } from '../../services/expensesService';
import Button from '../../components/ui/Button';
import MareStat from '../../components/shared/MareStat';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import { EUR_CVE, CARTAO, CartaoFin, TITULO, NUM, fmtMoney, fmtEixo, fmtDica } from './shared';
import { useLingua } from '../../utils/formatoLingua';
import { rotuloMes } from '../../utils/rotuloMes';
import { useT } from '../../i18n';

/* ─────────────────── RESULTADO ─────────────────── */

/* AAAA-MM-DD em hora local */
function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function ResultadoTab({ resumo, currency, periodo }) {
  useLingua();
  const t = useT();
  const [allExp,     setAllExp]     = useState([]);
  const [mensal,     setMensal]     = useState([]);
  const [salPayments, setSalPayments] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [exporting,  setExporting]  = useState(false);

  useEffect(() => {
    setLoading(true);
    /* Receita mensal dos ultimos 6 meses (o grafico), pedida aqui para nao depender do ano corrente:
       GET /financial/receita devolve { periodo: 'AAAA-MM', receita, num_reservas } por mes. */
    const hoje = new Date();
    const inicio6 = ymd(new Date(hoje.getFullYear(), hoje.getMonth() - 5, 1));
    const fim6 = ymd(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0));
    Promise.all([listExpenses(), getSalaryPayments(), getReceita(inicio6, fim6, 'month').catch(() => [])])
      .then(([exp, pay, rec]) => { setAllExp(exp); setSalPayments(pay || []); setMensal(rec || []); })
      .finally(() => setLoading(false));
  }, []);

  const now = new Date();
  /* A receita ja respeitava o periodo seleccionado (resumo.atual), mas
     despesas e folha salarial usavam sempre o mes calendario actual --
     "Resultado liquido" ficava incoerente sempre que o periodo escolhido
     no topo da pagina nao era o mes corrente. Filtra ambas pelo mesmo
     periodo real (periodo.inicio/periodo.fim). */
  const monthExp = allExp.filter(e => e.date && e.date >= periodo.inicio && e.date <= periodo.fim);

  /* Folha salarial usa os pagamentos REAIS registados (salary_payments),
     nao uma extrapolacao da configuracao actual -- essa configuracao
     representa o custo mensal corrente, sem nocao nenhuma do periodo
     historico seleccionado. Comparacao "YYYY-MM" e lexicograficamente
     igual a cronologica. */
  const startYM = periodo.inicio.slice(0, 7);
  const endYM   = periodo.fim.slice(0, 7);
  const totalSal = salPayments
    .filter(p => {
      const ym = `${p.year}-${String(p.month).padStart(2, '0')}`;
      return ym >= startYM && ym <= endYM;
    })
    .reduce((s, p) => s + Number(p.amount || 0), 0);

  const receita   = Number(resumo?.atual?.receita || 0);
  const totalDespesas = monthExp.reduce((s, e) => s + Number(e.amount || 0), 0);
  const resultado = receita - totalDespesas - totalSal;
  const margem    = receita > 0 ? (resultado / receita) * 100 : 0;

  /* Chart: last 6 months (os valores sao convertidos para a moeda escolhida, como os cartoes) */
  const taxa = currency === 'CVE' ? EUR_CVE : 1;
  const chartData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const rec = mensal.find(s => s.periodo === m);
    const dep = allExp.filter(e => (e.date || '').startsWith(m)).reduce((s, e) => s + Number(e.amount || 0), 0);
    const sal = salPayments.filter(p => `${p.year}-${String(p.month).padStart(2, '0')}` === m).reduce((s, p) => s + Number(p.amount || 0), 0);
    return { name: rotuloMes(d.getMonth(), t), receita: Math.round(Number(rec?.receita || 0) * taxa), despesas: Math.round((dep + sal) * taxa) };
  });

  async function handleExport(type) {
    setExporting(true);
    try {
      if (type === 'excel') await exportExcel(periodo.inicio, periodo.fim);
      else                  await exportPdf(periodo.inicio, periodo.fim);
    } finally { setExporting(false); }
  }

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner size={32} /></div>;

  /* Tom do quadro: bom com resultado positivo ou margem a partir de 20%, aviso nos restantes casos de atencao */
  const tomResultado = resultado >= 0 ? 'bom' : 'aviso';
  const tomMargem = margem >= 20 ? 'bom' : 'aviso';

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <MareStat label={t('financial.result.grossRevenue')}      value={fmtMoney(receita, currency)} />
        <MareStat label={t('financial.result.operatingExpenses')} value={fmtMoney(totalDespesas, currency)} />
        <MareStat label={t('financial.result.payroll')}           value={fmtMoney(totalSal, currency)} />
        <MareStat label={t('financial.result.netResult')}         value={fmtMoney(resultado, currency)} tone={tomResultado} />
        <MareStat label={t('financial.result.margin')}            value={`${margem.toFixed(1)}%`} tone={tomMargem} />
        <MareStat label={t('financial.result.bookingsInPeriod')}  value={resumo?.atual?.num_reservas ?? '—'} />
      </div>

      {/* Receitas vs Despesas chart */}
      <CartaoFin titulo={t('financial.result.chartTitle')}>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid stroke="var(--n200)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fontFamily: 'DM Mono', fill: 'var(--n500)' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11, fontFamily: 'DM Mono', fill: 'var(--n500)' }} tickLine={false} axisLine={false} tickFormatter={v => fmtEixo(v, currency)} />
            <ChartTooltip contentStyle={{ fontSize: 12, fontFamily: 'DM Sans', border: '1px solid var(--n200)', borderRadius: 12 }} formatter={v => fmtDica(v, currency)} />
            <Legend wrapperStyle={{ fontSize: 12, fontFamily: 'DM Sans' }} />
            <Bar dataKey="receita"  name={t('financial.result.revenue')}  fill="var(--ocean-500)" radius={[6,6,0,0]} maxBarSize={28} />
            <Bar dataKey="despesas" name={t('financial.result.expenses')} fill="var(--sand-500)" radius={[6,6,0,0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </CartaoFin>

      {/* Breakdown */}
      <div className={CARTAO}>
        <h3 className={`${TITULO} mb-4`}>{t('financial.result.breakdown')}</h3>
        <div className="space-y-2">
          {[
            { label: t('financial.result.grossRevenue'),           value: receita,        sign: '+', color: 'text-ocean-700' },
            { label: t('financial.result.operatingExpensesShort'), value: totalDespesas,  sign: '−', color: 'text-[var(--error)]' },
            { label: t('financial.result.payroll'),                value: totalSal,       sign: '−', color: 'text-[var(--error)]' },
          ].map(r => (
            <div key={r.label} className="flex flex-wrap items-center justify-between gap-x-4 py-2 border-b border-n-100 last:border-0">
              <span className="text-sm font-body text-n-700">{r.label}</span>
              <span className={`${NUM} font-semibold text-sm ${r.color}`}>{r.sign} {fmtMoney(r.value, currency)}</span>
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-x-4 py-2 pt-3 border-t-2 border-n-300">
            <span className="text-sm font-body font-bold text-n-800">{t('financial.result.netResult')}</span>
            <span className={`${NUM} font-semibold text-base ${resultado >= 0 ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>{resultado >= 0 ? '+' : '−'} {fmtMoney(Math.abs(resultado), currency)}</span>
          </div>
        </div>
      </div>

      {/* Export */}
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" icon={FileText} loading={exporting} onClick={() => handleExport('pdf')} className="flex-1">
          {t('financial.result.exportPdf')}
        </Button>
        <Button variant="secondary" icon={FileSpreadsheet} loading={exporting} onClick={() => handleExport('excel')} className="flex-1">
          {t('financial.result.exportExcel')}
        </Button>
      </div>
    </div>
  );
}

export default ResultadoTab;
