import { usePageTitle } from '../hooks/usePageTitle';
import { useState, useEffect, useCallback } from 'react';
import MetricCard from '../components/financial/MetricCard';
import SimpleChart from '../components/financial/SimpleChart';
import UnitPerformance from '../components/financial/UnitPerformance';
import TopCustomers from '../components/financial/TopCustomers';
import { exportarPDF } from '../components/financial/PdfReport';
import { getResumo, getReceita, getUnidades, getTopClientes } from '../services/financeiroService';
import useAuthStore from '../store/authStore';

function periodoMesAtual() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const ultimo = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return { inicio: `${y}-${m}-01`, fim: `${y}-${m}-${String(ultimo).padStart(2, '0')}` };
}

function periodoMesAnterior() {
  const now = new Date();
  const m = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const ultimo = new Date(y, m + 1, 0).getDate();
  const ms = String(m + 1).padStart(2, '0');
  return { inicio: `${y}-${ms}-01`, fim: `${y}-${ms}-${String(ultimo).padStart(2, '0')}` };
}

const PRESETS = [
  { label: 'Este mês', fn: periodoMesAtual },
  { label: 'Mês anterior', fn: periodoMesAnterior },
  { label: 'Este ano', fn: () => { const y = new Date().getFullYear(); return { inicio: `${y}-01-01`, fim: `${y}-12-31` }; } }
];

const GRANULARIDADES = [
  { value: 'day', label: 'Dia' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mês' }
];

export default function Financial() {
  usePageTitle('Financeiro');
  const { token, operator } = useAuthStore();
  const [periodo, setPeriodo] = useState(periodoMesAtual());
  const [granularidade, setGranularidade] = useState('week');
  const [dados, setDados] = useState({ resumo: null, receita: [], unidades: [], clientes: [] });
  const [loading, setLoading] = useState(true);
  const [exportando, setExportando] = useState(false);
  const [erroLoad, setErroLoad] = useState('');

  const carregar = useCallback(async () => {
    setLoading(true);
    setErroLoad('');
    try {
      const [resumoRes, receitaRes, unidadesRes, clientesRes] = await Promise.all([
        getResumo(token, periodo.inicio, periodo.fim),
        getReceita(token, periodo.inicio, periodo.fim, granularidade),
        getUnidades(token, periodo.inicio, periodo.fim),
        getTopClientes(token, periodo.inicio, periodo.fim)
      ]);
      setDados({
        resumo: resumoRes.data,
        receita: receitaRes.data,
        unidades: unidadesRes.data,
        clientes: clientesRes.data
      });
    } catch (err) {
      setErroLoad(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, periodo, granularidade]);

  useEffect(() => { carregar(); }, [carregar]);

  async function handleExport() {
    if (!dados.resumo) return;
    setExportando(true);
    try {
      await exportarPDF({
        operator,
        periodo,
        resumo: dados.resumo,
        receitaDados: dados.receita,
        unidadesDados: dados.unidades,
        topClientesDados: dados.clientes
      });
    } catch (err) {
      alert('Erro ao gerar PDF: ' + err.message);
    } finally {
      setExportando(false);
    }
  }

  const { resumo } = dados;

  return (
    <div>
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Painel Financeiro</h1>
          <p className="text-gray-500 text-sm mt-1">Receita, ocupação e performance</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Presets de período */}
          {PRESETS.map(({ label, fn }) => (
            <button key={label} onClick={() => setPeriodo(fn())} className="btn-secondary text-xs py-1.5 px-3">
              {label}
            </button>
          ))}

          {/* Datas customizadas */}
          <input type="date" className="input text-sm py-1.5 w-36" value={periodo.inicio}
            onChange={(e) => setPeriodo({ ...periodo, inicio: e.target.value })} />
          <span className="text-gray-400">→</span>
          <input type="date" className="input text-sm py-1.5 w-36" value={periodo.fim}
            onChange={(e) => setPeriodo({ ...periodo, fim: e.target.value })} />

          {/* Exportar PDF */}
          <button
            onClick={handleExport}
            disabled={!dados.resumo || exportando}
            className="btn-secondary text-sm py-1.5 px-4 flex items-center gap-1.5"
          >
            {exportando ? (
              <span className="text-gray-400">A gerar...</span>
            ) : (
              <>⬇ <span>Exportar PDF</span></>
            )}
          </button>
        </div>
      </div>

      {erroLoad && (
        <div className="bg-red-50 text-red-600 rounded-xl p-4 mb-6 text-sm">{erroLoad}</div>
      )}

      {loading ? (
        <div className="text-center py-20 text-gray-400">
          <div className="text-4xl mb-3">📊</div>
          <p>A carregar dados financeiros...</p>
        </div>
      ) : resumo && (
        <>
          {/* Métricas principais */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <MetricCard
              label="Receita Total"
              value={resumo.atual.receita}
              variacao={resumo.variacao.receita}
              variacaoLabel={`${resumo.variacao.receita >= 0 ? '+' : ''}${resumo.variacao.receita}%`}
              icon="💰"
              formato="euro"
            />
            <MetricCard
              label="Nº Reservas"
              value={resumo.atual.num_reservas}
              variacao={resumo.variacao.num_reservas}
              variacaoLabel={`${resumo.variacao.num_reservas >= 0 ? '+' : ''}${resumo.variacao.num_reservas}`}
              icon="📅"
            />
            <MetricCard
              label="Taxa de Ocupação"
              value={resumo.atual.taxa_ocupacao}
              variacao={resumo.variacao.taxa_ocupacao}
              variacaoLabel={`${resumo.variacao.taxa_ocupacao >= 0 ? '+' : ''}${resumo.variacao.taxa_ocupacao}pp`}
              icon="📊"
              formato="percentagem"
            />
            <MetricCard
              label="Valor Médio / Reserva"
              value={resumo.atual.valor_medio}
              variacao={resumo.variacao.valor_medio}
              variacaoLabel={`${resumo.variacao.valor_medio >= 0 ? '+' : ''}${resumo.variacao.valor_medio}%`}
              icon="🧾"
              formato="euro"
            />
          </div>

          {/* Gráfico de receita */}
          <div className="card mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-gray-900">Receita por Período</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {periodo.inicio} → {periodo.fim}
                </p>
              </div>
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                {GRANULARIDADES.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setGranularidade(value)}
                    className={`text-xs px-3 py-1 rounded-md transition-colors ${
                      granularidade === value
                        ? 'bg-white text-primary-500 shadow-sm font-medium'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <SimpleChart dados={dados.receita} />
          </div>

          {/* Performance + Top clientes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <h2 className="font-semibold text-gray-900 mb-4">Performance por Unidade</h2>
              <UnitPerformance dados={dados.unidades} />
            </div>
            <div className="card">
              <h2 className="font-semibold text-gray-900 mb-4">Top Clientes no Período</h2>
              <TopCustomers dados={dados.clientes} />
            </div>
          </div>

          {/* Comparativo */}
          <div className="card mt-6 bg-primary-50 border-primary-100">
            <h3 className="text-sm font-semibold text-primary-700 mb-2">Comparativo com período anterior</h3>
            <p className="text-xs text-primary-600">
              Período anterior: <strong>{resumo.periodo_anterior.inicio}</strong> → <strong>{resumo.periodo_anterior.fim}</strong>
              {' '}·{' '}
              Receita: <strong>{Number(resumo.anterior.receita).toFixed(2)} €</strong>
              {' '}·{' '}
              Reservas: <strong>{resumo.anterior.num_reservas}</strong>
              {' '}·{' '}
              Ocupação: <strong>{resumo.anterior.taxa_ocupacao}%</strong>
            </p>
          </div>
        </>
      )}
    </div>
  );
}
