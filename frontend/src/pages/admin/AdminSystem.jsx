import { useState, useEffect } from 'react';
import { RefreshCw, Server, Database, Clock, Cpu, Activity, BookOpen, Users } from 'lucide-react';
import api from '../../services/api';
import PageHeader from '../../components/layout/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import LoadingSpinner from '../../components/shared/LoadingSpinner';

function StatusDot({ ok }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${ok ? 'bg-[var(--success)]' : 'bg-[var(--error)]'}`} />
  );
}

function HealthCard({ icon: Icon, label, value, sub, ok }) {
  return (
    <div className="bg-white rounded-md border border-n-200 shadow-sm px-4 py-4 flex items-center gap-3">
      <div className="w-9 h-9 rounded-sm bg-ocean-50 flex items-center justify-center shrink-0">
        <Icon size={18} strokeWidth={1.75} className="text-ocean-700" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-body text-n-400 mb-0.5">{label}</p>
        <p className="font-display font-bold text-lg text-n-900 leading-tight">{value}</p>
        {sub && <p className="text-xs font-body text-n-400 mt-0.5">{sub}</p>}
      </div>
      {ok !== undefined && (
        <div className="flex items-center gap-1.5 shrink-0">
          <StatusDot ok={ok} />
          <span className={`text-xs font-body font-semibold ${ok ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
            {ok ? 'OK' : 'ERRO'}
          </span>
        </div>
      )}
    </div>
  );
}

function formatUptime(seconds) {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const LOG_ICON = { reservation: BookOpen, operator: Users };

export default function AdminSystem() {
  const [health,        setHealth]        = useState(null);
  const [logs,          setLogs]          = useState([]);
  const [healthLoading, setHealthLoading] = useState(true);
  const [logsLoading,   setLogsLoading]   = useState(true);
  const [lastRefresh,   setLastRefresh]   = useState(null);

  function fetchHealth() {
    setHealthLoading(true);
    api.get('/admin/system/health')
      .then(r => { setHealth(r.data.data); setLastRefresh(new Date()); })
      .catch(() => {})
      .finally(() => setHealthLoading(false));
  }

  function fetchLogs() {
    setLogsLoading(true);
    api.get('/admin/logs', { params: { limit: 25 } })
      .then(r => setLogs(r.data.data || []))
      .catch(() => {})
      .finally(() => setLogsLoading(false));
  }

  useEffect(() => {
    fetchHealth();
    fetchLogs();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  function handleRefresh() {
    fetchHealth();
    fetchLogs();
  }

  return (
    <div>
      <PageHeader
        title="Sistema"
        subtitle={lastRefresh
          ? `Actualizado: ${lastRefresh.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
          : 'A carregar...'}
        actions={
          <Button variant="secondary" size="sm" icon={RefreshCw} onClick={handleRefresh}>
            Actualizar
          </Button>
        }
      />

      {healthLoading ? (
        <div className="flex justify-center py-10 mb-6"><LoadingSpinner /></div>
      ) : health ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <HealthCard
            icon={Server}
            label="API"
            value={health.api?.toUpperCase() || '—'}
            ok={health.api === 'ok'}
          />
          <HealthCard
            icon={Database}
            label="Base de dados"
            value={health.database?.toUpperCase() || '—'}
            ok={health.database === 'ok'}
          />
          <HealthCard
            icon={Clock}
            label="Uptime"
            value={formatUptime(health.uptime_seconds)}
            sub={`${health.node_version || ''} · ${health.environment || ''}`}
          />
          <HealthCard
            icon={Cpu}
            label="Memoria heap"
            value={`${health.memory?.used_mb ?? '—'} MB`}
            sub={`de ${health.memory?.total_mb ?? '—'} MB · RSS ${health.memory?.rss_mb ?? '—'} MB`}
          />
        </div>
      ) : (
        <div className="text-sm font-body text-n-400 mb-6 py-4">
          Nao foi possivel carregar metricas do sistema.
        </div>
      )}

      <Card
        header={
          <div className="flex items-center gap-2">
            <Activity size={14} strokeWidth={1.75} className="text-n-500" />
            <h3 className="font-display font-semibold text-sm text-n-700">Actividade recente</h3>
          </div>
        }
        padding="p-0"
      >
        {logsLoading ? (
          <div className="flex justify-center py-8"><LoadingSpinner /></div>
        ) : logs.length === 0 ? (
          <p className="text-center py-8 text-n-400 text-xs font-body">Sem actividade recente</p>
        ) : (
          <div className="divide-y divide-n-100">
            {logs.map((log, i) => {
              const Icon = LOG_ICON[log.type] || Activity;
              const timeStr = log.time
                ? new Date(log.time).toLocaleString('pt-PT', {
                    month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })
                : '';
              return (
                <div key={i} className="px-4 py-3 flex items-center gap-3">
                  <div className="w-7 h-7 rounded-sm bg-n-50 flex items-center justify-center shrink-0">
                    <Icon size={13} strokeWidth={1.75} className="text-n-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-body font-semibold text-n-800 truncate">{log.title}</p>
                    {log.sub && <p className="text-xs font-body text-n-400 truncate">{log.sub}</p>}
                  </div>
                  <span className="text-xs font-mono text-n-400 shrink-0">{timeStr}</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
