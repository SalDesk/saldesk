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
import Card from '../../components/ui/Card';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import { MONTHS_PT, fmtMoney } from './shared';

/* ─────────────────── RESULTADO ─────────────────── */

/* AAAA-MM-DD em hora local */
function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function ResultadoTab({ resumo, currency, periodo }) {
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

  /* Chart: last 6 months */
  const chartData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const rec = mensal.find(s => s.periodo === m);
    const dep = allExp.filter(e => (e.date || '').startsWith(m)).reduce((s, e) => s + Number(e.amount || 0), 0);
    const sal = salPayments.filter(p => `${p.year}-${String(p.month).padStart(2, '0')}` === m).reduce((s, p) => s + Number(p.amount || 0), 0);
    return { name: MONTHS_PT[d.getMonth()], receita: Math.round(Number(rec?.receita || 0)), despesas: Math.round(dep + sal) };
  });

  async function handleExport(type) {
    setExporting(true);
    try {
      if (type === 'excel') await exportExcel(periodo.inicio, periodo.fim);
      else                  await exportPdf(periodo.inicio, periodo.fim);
    } finally { setExporting(false); }
  }

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner size={32} /></div>;

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {[
          { label: 'Receita bruta',         value: fmtMoney(receita, currency),        color: 'text-ocean-700'  },
          { label: 'Despesas operacionais', value: fmtMoney(totalDespesas, currency),   color: 'text-[var(--error)]' },
          { label: 'Folha salarial',        value: fmtMoney(totalSal, currency),        color: 'text-[var(--error)]' },
          { label: 'Resultado liquido',     value: fmtMoney(resultado, currency),       color: resultado >= 0 ? 'text-[var(--success)]' : 'text-[var(--error)]' },
          { label: 'Margem',                value: `${margem.toFixed(1)}%`,             color: margem >= 20 ? 'text-[var(--success)]' : margem >= 0 ? 'text-[var(--warning)]' : 'text-[var(--error)]' },
          { label: 'Reservas no periodo',   value: resumo?.atual?.num_reservas ?? '—',   color: 'text-n-900'      },
        ].map(m => (
          <Card key={m.label} padding="px-4 py-3">
            <p className={`font-display font-bold text-xl ${m.color}`}>{m.value}</p>
            <p className="text-xs font-body text-n-500 mt-0.5">{m.label}</p>
          </Card>
        ))}
      </div>

      {/* Receitas vs Despesas chart */}
      <Card padding="px-5 pb-5 pt-3" header={<h3 className="font-display font-semibold text-sm text-n-700">Receitas vs Despesas — ultimos 6 meses</h3>}>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--n200)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fontFamily: 'DM Mono', fill: 'var(--n500)' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fontFamily: 'DM Mono', fill: 'var(--n500)' }} tickLine={false} axisLine={false} tickFormatter={v => v > 999 ? `€${Math.round(v / 1000)}k` : `€${v}`} />
            <ChartTooltip contentStyle={{ fontSize: 11, fontFamily: 'DM Sans', border: '1px solid var(--n200)', borderRadius: 4 }} formatter={v => `€${Math.round(v).toLocaleString('pt-PT')}`} />
            <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'DM Mono' }} />
            <Bar dataKey="receita"  name="Receita"  fill="var(--ocean-700)" radius={[2,2,0,0]} />
            <Bar dataKey="despesas" name="Despesas" fill="var(--error)" radius={[2,2,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Breakdown */}
      <Card padding="px-5 py-4">
        <h3 className="font-display font-semibold text-sm text-n-700 mb-4">Decomposicao do resultado</h3>
        <div className="space-y-2">
          {[
            { label: 'Receita bruta',     value: receita,        sign: '+', color: 'text-ocean-700' },
            { label: 'Despesas operac.',  value: totalDespesas,  sign: '−', color: 'text-[var(--error)]' },
            { label: 'Folha salarial',    value: totalSal,       sign: '−', color: 'text-[var(--error)]' },
          ].map(r => (
            <div key={r.label} className="flex items-center justify-between py-2 border-b border-n-100 last:border-0">
              <span className="text-sm font-body text-n-700">{r.label}</span>
              <span className={`font-display font-bold text-sm ${r.color}`}>{r.sign} {fmtMoney(r.value, currency)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between py-2 pt-3 border-t-2 border-n-300">
            <span className="text-sm font-body font-bold text-n-800">Resultado liquido</span>
            <span className={`font-display font-bold text-base ${resultado >= 0 ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>{resultado >= 0 ? '+' : '−'} {fmtMoney(Math.abs(resultado), currency)}</span>
          </div>
        </div>
      </Card>

      {/* Export */}
      <div className="flex gap-3">
        <Button variant="secondary" icon={FileText} loading={exporting} onClick={() => handleExport('pdf')} className="flex-1">
          Exportar PDF
        </Button>
        <Button variant="secondary" icon={FileSpreadsheet} loading={exporting} onClick={() => handleExport('excel')} className="flex-1">
          Exportar Excel
        </Button>
      </div>
    </div>
  );
}

export default ResultadoTab;
