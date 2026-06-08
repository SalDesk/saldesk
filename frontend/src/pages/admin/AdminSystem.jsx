import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Server, Database, Cpu, HardDrive, Clock, Wifi,
  Shield, AlertTriangle, XCircle, CheckCircle, Circle,
  RefreshCw, Trash2, Ban, LogOut, Save, RotateCcw,
  Archive, Zap, Settings, Activity, Lock, FileText,
  ChevronRight, Terminal,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import api from '../../services/api';
import LoadingSpinner from '../../components/shared/LoadingSpinner';

/* ─── Design constants ──────────────────────────────────────── */
const ICON_SM  = { strokeWidth: 1.75, size: 16 };
const ICON_MD  = { strokeWidth: 1.75, size: 20 };
const AXIS_TICK   = { fontSize: 11, fontFamily: 'DM Sans', fill: '#6B7280' };
const TOOLTIP_CSS = { fontFamily: 'DM Sans', fontSize: 12, borderRadius: 6, border: '1px solid #E5E8EC' };

const TAB_BASE   = 'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap';
const TAB_ACTIVE = `${TAB_BASE} border-ocean-700 text-ocean-700`;
const TAB_IDLE   = `${TAB_BASE} border-transparent text-n-500 hover:text-n-900`;
const BTN_PRIMARY = 'inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-ocean-700 text-white text-sm font-medium hover:bg-ocean-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
const BTN_GHOST   = 'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-n-200 text-sm text-n-700 hover:bg-n-50 transition-colors disabled:opacity-50';
const BTN_DANGER  = 'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--error)]/10 border border-[var(--error)]/30 text-sm text-[var(--error)] hover:bg-[var(--error)]/20 transition-colors disabled:opacity-50';
const INPUT_CLS   = 'w-full rounded-lg border border-n-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ocean-500';
const LABEL_CLS   = 'block text-xs font-medium text-n-500 mb-1';

/* ─── Shared components ─────────────────────────────────────── */
const TABS = [
  { key: 'monitor',      label: 'Monitorizacao'   },
  { key: 'services',     label: 'Servicos'         },
  { key: 'logs',         label: 'Logs'             },
  { key: 'security',     label: 'Seguranca'        },
  { key: 'settings',     label: 'Configuracoes'    },
  { key: 'maintenance',  label: 'Manutencao'       },
];

function TabBar({ active, onChange }) {
  return (
    <div className="flex gap-0 border-b border-n-200 overflow-x-auto">
      {TABS.map(t => (
        <button key={t.key} className={active === t.key ? TAB_ACTIVE : TAB_IDLE} onClick={() => onChange(t.key)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

function SectionCard({ title, icon: Icon, children, action }) {
  return (
    <div className="bg-white rounded-xl border border-n-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-n-900 flex items-center gap-2">
          {Icon && <Icon {...ICON_SM} className="text-ocean-700" />}
          {title}
        </h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function StatusDot({ ok, pulse }) {
  const color = ok ? 'bg-[var(--success)]' : 'bg-[var(--error)]';
  return <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${color} ${pulse && ok ? 'animate-pulse' : ''}`} />;
}

function MetricCard({ icon: Icon, label, value, sub, bar, barColor = 'bg-ocean-700' }) {
  return (
    <div className="bg-white rounded-xl border border-n-200 px-5 py-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-sm bg-ocean-50 flex items-center justify-center shrink-0">
          <Icon {...ICON_MD} className="text-ocean-700" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-n-500 uppercase tracking-wide">{label}</p>
          <p className="text-xl font-bold text-n-900 font-display leading-tight">{value ?? '—'}</p>
        </div>
      </div>
      {sub && <p className="text-xs text-n-400">{sub}</p>}
      {bar != null && (
        <div className="mt-2 h-1.5 bg-n-100 rounded-full overflow-hidden">
          <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${Math.min(100, bar)}%` }} />
        </div>
      )}
    </div>
  );
}

function formatUptime(s) {
  if (!s) return '—';
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtTs(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/* ─── Tab 1: Monitorização ──────────────────────────────────── */
function MonitorTab({ stats, loading }) {
  if (loading && !stats) return <div className="flex justify-center py-16"><LoadingSpinner size={28} /></div>;
  if (!stats) return <p className="text-sm text-n-400 text-center py-12">Nao foi possivel carregar metricas</p>;

  const { cpu, memory, disk, uptime_seconds, node_version, environment } = stats;
  const ramPct  = memory ? Math.round((memory.heap_used_mb / memory.heap_total_mb) * 100) : 0;
  const diskPct = disk   ? Math.round((disk.used_gb / disk.total_gb) * 100) : 0;
  const cpuPct  = cpu?.current ?? 0;
  const cpuBarColor = cpuPct > 80 ? 'bg-[var(--error)]' : cpuPct > 60 ? 'bg-[var(--warning)]' : 'bg-ocean-700';
  const ramBarColor = ramPct  > 80 ? 'bg-[var(--error)]' : ramPct  > 60 ? 'bg-[var(--warning)]' : 'bg-ocean-700';
  const diskBarColor = diskPct > 80 ? 'bg-[var(--error)]' : diskPct > 60 ? 'bg-[var(--warning)]' : 'bg-ocean-700';

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard icon={Cpu}      label="CPU"    value={`${cpuPct}%`}  bar={cpuPct}  barColor={cpuBarColor}  sub="processo Node.js" />
        <MetricCard icon={Activity} label="Heap RAM" value={`${memory?.heap_used_mb ?? '—'} MB`} bar={ramPct} barColor={ramBarColor} sub={`de ${memory?.heap_total_mb ?? '—'} MB · RSS ${memory?.rss_mb ?? '—'} MB`} />
        <MetricCard icon={HardDrive} label="Disco" value={`${disk?.used_gb ?? '—'} GB`} bar={diskPct} barColor={diskBarColor} sub={`de ${disk?.total_gb ?? '—'} GB${disk?.simulated ? ' (simulado)' : ''}`} />
        <MetricCard icon={Clock}    label="Uptime"  value={formatUptime(uptime_seconds)} sub={`${node_version ?? ''} · ${environment ?? ''}`} />
      </div>

      <SectionCard title="CPU — últimos 30 minutos" icon={Cpu}>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={cpu?.history || []} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E8EC" />
            <XAxis dataKey="label" tick={AXIS_TICK} interval={4} />
            <YAxis tick={AXIS_TICK} domain={[0, 100]} tickFormatter={v => `${v}%`} />
            <Tooltip contentStyle={TOOLTIP_CSS} formatter={v => [`${v}%`, 'CPU']} />
            <Line type="monotone" dataKey="cpu" stroke="#0D5470" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </SectionCard>
    </div>
  );
}

/* ─── Tab 2: Serviços ───────────────────────────────────────── */
const SERVICE_ICONS = { api: Server, database: Database, redis: Wifi, sendgrid: Activity, pm2: Terminal };

function ServicesTab({ stats, loading }) {
  if (loading && !stats) return <div className="flex justify-center py-16"><LoadingSpinner size={28} /></div>;
  const services = stats?.services || {};

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Object.entries(services).map(([key, svc]) => {
        const Icon = SERVICE_ICONS[key] || Server;
        return (
          <div key={key} className="bg-white rounded-xl border border-n-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-sm bg-ocean-50 flex items-center justify-center">
                  <Icon {...ICON_MD} className="text-ocean-700" />
                </div>
                <p className="font-semibold text-sm text-n-900">{svc.label || key}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusDot ok={svc.ok} pulse={svc.ok} />
                <span className={`text-xs font-bold ${svc.ok ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
                  {svc.ok ? 'OK' : 'ERRO'}
                </span>
              </div>
            </div>
            {svc.error && (
              <p className="text-xs text-[var(--error)] bg-[var(--error)]/5 rounded px-2 py-1 break-all">{svc.error}</p>
            )}
            {svc.processes?.length > 0 && (
              <div className="space-y-1 mt-2">
                {svc.processes.map(p => (
                  <div key={p.name} className="flex items-center justify-between text-xs">
                    <span className="font-mono text-n-700">{p.name}</span>
                    <span className={`px-1.5 py-0.5 rounded ${p.status === 'online' ? 'bg-[var(--success)]/10 text-[var(--success)]' : 'bg-n-100 text-n-500'}`}>{p.status}</span>
                  </div>
                ))}
              </div>
            )}
            {svc.simulated && (
              <p className="text-xs text-n-300 mt-2">Dados simulados — servidor de desenvolvimento</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Tab 3: Logs ───────────────────────────────────────────── */
const LOG_LEVEL_COLOR = {
  error:   'text-[var(--error)]   bg-[var(--error)]/10',
  warning: 'text-[var(--warning)] bg-[var(--warning)]/10',
  info:    'text-ocean-700       bg-ocean-50',
};

function LogsTab() {
  const [logs,    setLogs]    = useState([]);
  const [filter,  setFilter]  = useState('all');
  const [loading, setLoading] = useState(false);
  const topRef = useRef(null);

  const load = useCallback(async (lvl = filter) => {
    setLoading(true);
    try {
      const params = lvl !== 'all' ? { level: lvl, limit: 50 } : { limit: 50 };
      const { data } = await api.get('/admin/system/logs', { params });
      setLogs(data.data || []);
    } finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, []);

  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleFilter = (lvl) => { setFilter(lvl); load(lvl); };

  const clearAll = async () => {
    if (!window.confirm('Limpar todos os logs de API?')) return;
    await api.delete('/admin/system/logs');
    setLogs([]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {['all', 'error', 'warning', 'info'].map(lvl => (
            <button
              key={lvl}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${filter === lvl ? 'bg-ocean-700 text-white' : 'bg-n-50 text-n-600 hover:bg-n-100'}`}
              onClick={() => handleFilter(lvl)}
            >
              {lvl === 'all' ? 'Todos' : lvl.charAt(0).toUpperCase() + lvl.slice(1)}
            </button>
          ))}
          <button className={BTN_GHOST} onClick={() => load()} disabled={loading}>
            <RefreshCw {...ICON_SM} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
        <button className={BTN_DANGER} onClick={clearAll}>
          <Trash2 {...ICON_SM} />
          Limpar logs
        </button>
      </div>

      <div className="bg-n-900 rounded-xl overflow-hidden">
        <div className="max-h-[500px] overflow-y-auto font-mono text-xs">
          <div ref={topRef} />
          {loading && <p className="text-n-400 px-4 py-4">A carregar...</p>}
          {!loading && logs.length === 0 && (
            <p className="text-n-500 px-4 py-8 text-center">Sem logs{filter !== 'all' ? ` de nível "${filter}"` : ''}</p>
          )}
          {logs.map(log => (
            <div key={log.id} className="flex items-start gap-3 px-4 py-2.5 border-b border-n-800 hover:bg-n-800/50">
              <span className="text-n-500 shrink-0 tabular-nums">{log.timestamp ? new Date(log.timestamp).toLocaleTimeString('pt-PT') : '—'}</span>
              <span className={`px-1.5 py-0.5 rounded text-xs font-bold shrink-0 uppercase ${LOG_LEVEL_COLOR[log.level] || LOG_LEVEL_COLOR.info}`}>
                {log.level}
              </span>
              <span className="text-ocean-300 shrink-0">{log.endpoint}</span>
              <span className="text-n-300 font-mono text-xs shrink-0">{log.code}</span>
              <span className="text-n-200 break-all">{log.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Tab 4: Segurança ──────────────────────────────────────── */
function SecurityTab() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [blocking, setBlocking] = useState('');
  const [msg, setMsg]         = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: r } = await api.get('/admin/system/security');
      setData(r.data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const blockIp = async (ip) => {
    setBlocking(ip); setMsg('');
    try {
      await api.post('/admin/system/block-ip', { ip });
      setMsg(`IP ${ip} bloqueado`);
      load();
    } catch (e) {
      setMsg(e.response?.data?.error || 'Erro');
    } finally { setBlocking(''); }
  };

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner size={28} /></div>;
  if (!data)   return <p className="text-sm text-n-400 text-center py-12">Nao foi possivel carregar dados de seguranca</p>;

  const { access_logs = [], failed_logins = [], blocked_ips = [], sessions = [] } = data;
  const suspicious = access_logs.filter(l => l.suspicious);

  return (
    <div className="space-y-5">
      {suspicious.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-[var(--warning)]/10 border border-[var(--warning)]/30">
          <AlertTriangle {...ICON_SM} className="text-[var(--warning)] mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-n-900">{suspicious.length} acesso{suspicious.length > 1 ? 's' : ''} suspeito{suspicious.length > 1 ? 's' : ''} detectado{suspicious.length > 1 ? 's' : ''}</p>
            <p className="text-xs text-n-500 mt-0.5">Acessos fora do horario habitual (antes das 07:00 ou apos as 22:00)</p>
          </div>
        </div>
      )}

      {msg && <p className={`text-sm font-medium ${msg.startsWith('Erro') ? 'text-[var(--error)]' : 'text-[var(--success)]'}`}>{msg}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard title="Logs de acesso ao painel" icon={Lock}>
          {access_logs.length === 0 && <p className="text-sm text-n-400 text-center py-6">Sem acessos registados nesta sessao</p>}
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {access_logs.slice(0, 20).map(l => (
              <div key={l.id} className={`flex items-start justify-between gap-2 p-2.5 rounded-lg border text-xs ${l.suspicious ? 'bg-[var(--warning)]/5 border-[var(--warning)]/20' : 'bg-n-50 border-n-100'}`}>
                <div className="min-w-0">
                  <p className="font-mono text-n-700 truncate">{l.action}</p>
                  <p className="text-n-400 mt-0.5">{l.ip} · {l.user_agent?.split(' ')[0]}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {l.suspicious && <AlertTriangle size={12} strokeWidth={1.75} className="text-[var(--warning)]" />}
                  <span className="text-n-300 whitespace-nowrap">{fmtTs(l.timestamp).split(',')[1]?.trim()}</span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Sessões activas do Fundador" icon={Shield}>
          {sessions.length === 0 && <p className="text-sm text-n-400 text-center py-6">Sem sessoes encontradas via Auth Admin</p>}
          <div className="space-y-2">
            {sessions.map(s => (
              <div key={s.user_id} className="flex items-center justify-between gap-2 p-3 rounded-lg bg-n-50 border border-n-100">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-n-900">{s.email}</p>
                  <p className="text-xs text-n-400 mt-0.5">Ultimo acesso: {fmtTs(s.last_sign_in)}</p>
                </div>
                <span className="text-xs text-n-300">Activa</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard title={`Tentativas de login falhadas (${failed_logins.length})`} icon={XCircle}>
        {failed_logins.length === 0 && <p className="text-sm text-n-400 text-center py-6">Sem tentativas falhadas nesta sessao</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-n-100">
                {['Data', 'IP', 'Email tentado', 'Acção'].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-n-500 pb-2 pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {failed_logins.slice(0, 20).map(l => (
                <tr key={l.id} className="border-b border-n-50 last:border-0">
                  <td className="py-2 pr-4 text-n-400 font-mono text-xs whitespace-nowrap">{fmtTs(l.timestamp)}</td>
                  <td className="py-2 pr-4 font-mono text-n-700">{l.ip}</td>
                  <td className="py-2 pr-4 text-n-600">{l.email || '—'}</td>
                  <td className="py-2">
                    <button
                      className={BTN_DANGER}
                      onClick={() => blockIp(l.ip)}
                      disabled={!!blocking || blocked_ips.includes(l.ip)}
                    >
                      <Ban {...ICON_SM} />
                      {blocked_ips.includes(l.ip) ? 'Bloqueado' : 'Bloquear IP'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {blocked_ips.length > 0 && (
          <div className="mt-4 pt-4 border-t border-n-100">
            <p className="text-xs font-medium text-n-500 mb-2">IPs bloqueados ({blocked_ips.length})</p>
            <div className="flex flex-wrap gap-2">
              {blocked_ips.map(ip => (
                <span key={ip} className="font-mono text-xs px-2 py-1 bg-[var(--error)]/10 text-[var(--error)] rounded border border-[var(--error)]/20">{ip}</span>
              ))}
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

/* ─── Tab 5: Configurações ──────────────────────────────────── */
function Toggle({ label, checked, onChange, description }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-n-100 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-n-900">{label}</p>
        {description && <p className="text-xs text-n-400 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 mt-0.5 ${checked ? 'bg-ocean-700' : 'bg-n-200'}`}
      >
        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${checked ? 'left-6' : 'left-1'}`} />
      </button>
    </div>
  );
}

function SettingsTab() {
  const [form,    setForm]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState('');

  useEffect(() => {
    api.get('/admin/system/settings')
      .then(r => setForm(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true); setMsg('');
    try {
      await api.put('/admin/system/settings', form);
      setMsg('Configuracoes guardadas com sucesso');
    } catch (e) {
      setMsg(e.response?.data?.error || 'Erro ao guardar');
    } finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner size={28} /></div>;
  if (!form)   return <p className="text-sm text-n-400 text-center py-12">Nao foi possivel carregar configuracoes</p>;

  const bool = (k) => form[k] === 'true' || form[k] === true;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <SectionCard title="Estado da plataforma" icon={Settings}>
        <div className="space-y-0">
          <Toggle
            label="Registo por convite"
            checked={bool('invite_only')}
            onChange={v => set('invite_only', String(v))}
            description="Apenas utilizadores com codigo de convite podem registar-se"
          />
          <Toggle
            label="Modo manutencao"
            checked={bool('coming_soon_mode')}
            onChange={v => set('coming_soon_mode', String(v))}
            description="Mostra pagina de manutencao aos visitantes"
          />
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className={LABEL_CLS}>Mensagem de manutencao</label>
            <textarea className={INPUT_CLS} rows={3} value={form.maintenance_message || ''} onChange={e => set('maintenance_message', e.target.value)} placeholder="Estamos em manutencao. Voltamos em breve." />
          </div>
          <div>
            <label className={LABEL_CLS}>Data de lancamento</label>
            <input type="date" className={INPUT_CLS} value={form.launch_date || ''} onChange={e => set('launch_date', e.target.value)} />
          </div>
          <div>
            <label className={LABEL_CLS}>Email de suporte</label>
            <input type="email" className={INPUT_CLS} value={form.sys_support_email || ''} onChange={e => set('sys_support_email', e.target.value)} />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Limites de plano" icon={Settings}>
        <p className="text-xs text-n-400 mb-4">Numero maximo de tours/reservas por mes. 0 = ilimitado.</p>
        <div className="space-y-3">
          {[
            { key: 'sys_max_tours_starter',  label: 'Starter' },
            { key: 'sys_max_tours_business', label: 'Business' },
            { key: 'sys_max_tours_pro',      label: 'Pro' },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className={LABEL_CLS}>{label} — max tours/mes</label>
              <input
                type="number" min="0" className={INPUT_CLS}
                value={form[key] || '0'}
                onChange={e => set(key, e.target.value)}
              />
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="lg:col-span-2 flex items-center justify-between">
        {msg && <p className={`text-sm font-medium ${msg.startsWith('Erro') ? 'text-[var(--error)]' : 'text-[var(--success)]'}`}>{msg}</p>}
        <button className={BTN_PRIMARY} onClick={save} disabled={saving}>
          <Save {...ICON_SM} />
          {saving ? 'A guardar...' : 'Guardar configuracoes'}
        </button>
      </div>
    </div>
  );
}

/* ─── Tab 6: Manutenção ─────────────────────────────────────── */
function MaintenanceTab() {
  const [backups,  setBackups]  = useState([]);
  const [loading,  setLoading]  = useState({ backup: false, cache: false, restart: false });
  const [msgs,     setMsgs]     = useState({});
  const [confirm,  setConfirm]  = useState(false);

  const loadBackups = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/system/settings');
      let h = [];
      try { h = JSON.parse(data.data?.sys_backup_history || '[]'); } catch { h = []; }
      setBackups(h);
    } catch { /* silencioso */ }
  }, []);

  useEffect(() => { loadBackups(); }, [loadBackups]);

  const setLoading1 = (k, v) => setLoading(l => ({ ...l, [k]: v }));
  const setMsg      = (k, v) => setMsgs(m => ({ ...m, [k]: v }));

  const doBackup = async () => {
    setLoading1('backup', true); setMsg('backup', '');
    try {
      const { data } = await api.post('/admin/system/backup');
      setMsg('backup', data.message || 'Backup registado');
      loadBackups();
    } catch (e) { setMsg('backup', e.response?.data?.error || 'Erro'); }
    finally { setLoading1('backup', false); }
  };

  const doFlush = async () => {
    setLoading1('cache', true); setMsg('cache', '');
    try {
      const { data } = await api.post('/admin/system/flush-cache');
      setMsg('cache', data.message || 'Cache limpo');
    } catch (e) { setMsg('cache', e.response?.data?.error || 'Erro'); }
    finally { setLoading1('cache', false); }
  };

  const doRestart = async () => {
    setConfirm(false);
    setLoading1('restart', true); setMsg('restart', '');
    try {
      const { data } = await api.post('/admin/system/restart');
      setMsg('restart', data.message || 'Restart enviado');
    } catch (e) { setMsg('restart', e.response?.data?.error || 'Erro'); }
    finally { setLoading1('restart', false); }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SectionCard title="Backup da base de dados" icon={Archive}>
          <p className="text-xs text-n-400 mb-4">Regista um ponto de restauro. Para backup real configure pg_dump no servidor.</p>
          <button className={BTN_PRIMARY} onClick={doBackup} disabled={loading.backup}>
            <Archive {...ICON_SM} />
            {loading.backup ? 'A registar...' : 'Backup manual'}
          </button>
          {msgs.backup && <p className={`text-xs mt-2 ${msgs.backup.startsWith('Erro') ? 'text-[var(--error)]' : 'text-[var(--success)]'}`}>{msgs.backup}</p>}
        </SectionCard>

        <SectionCard title="Cache Redis" icon={Zap}>
          <p className="text-xs text-n-400 mb-4">Limpa todas as chaves do Redis. Filas de jobs serao reiniciadas.</p>
          <button className={`${BTN_GHOST} w-full justify-center`} onClick={doFlush} disabled={loading.cache}>
            <Zap {...ICON_SM} />
            {loading.cache ? 'A limpar...' : 'Limpar cache'}
          </button>
          {msgs.cache && <p className={`text-xs mt-2 ${msgs.cache.startsWith('Erro') ? 'text-[var(--error)]' : 'text-[var(--success)]'}`}>{msgs.cache}</p>}
        </SectionCard>

        <SectionCard title="Reiniciar API" icon={RotateCcw}>
          <p className="text-xs text-n-400 mb-4">Reinicia o processo via PM2. O servidor ficara indisponivel alguns segundos.</p>
          {confirm ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[var(--error)]">Confirmar reinicio?</p>
              <div className="flex gap-2">
                <button className={BTN_DANGER} onClick={doRestart} disabled={loading.restart}>Sim, reiniciar</button>
                <button className={BTN_GHOST} onClick={() => setConfirm(false)}>Cancelar</button>
              </div>
            </div>
          ) : (
            <button className={`${BTN_DANGER} w-full justify-center`} onClick={() => setConfirm(true)} disabled={loading.restart}>
              <RotateCcw {...ICON_SM} />
              {loading.restart ? 'A reiniciar...' : 'Reiniciar API'}
            </button>
          )}
          {msgs.restart && <p className={`text-xs mt-2 ${msgs.restart.startsWith('Erro') ? 'text-[var(--error)]' : 'text-[var(--success)]'}`}>{msgs.restart}</p>}
        </SectionCard>
      </div>

      <SectionCard title={`Histórico de backups (${backups.length})`} icon={FileText}>
        {backups.length === 0 && <p className="text-sm text-n-400 text-center py-6">Nenhum backup registado</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-n-100">
                {['Data', 'Tipo', 'Estado', 'Tamanho'].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-n-500 pb-2 pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {backups.map(b => (
                <tr key={b.id} className="border-b border-n-50 last:border-0">
                  <td className="py-2 pr-4 text-n-700 whitespace-nowrap">{fmtTs(b.timestamp)}</td>
                  <td className="py-2 pr-4 capitalize text-n-600">{b.type}</td>
                  <td className="py-2 pr-4">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${b.status === 'completed' ? 'bg-[var(--success)]/10 text-[var(--success)]' : 'bg-n-100 text-n-500'}`}>
                      {b.status}
                    </span>
                  </td>
                  <td className="py-2 text-n-400">{b.size}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────── */
export default function AdminSystem() {
  const [tab,        setTab]        = useState('monitor');
  const [stats,      setStats]      = useState(null);
  const [statsLoad,  setStatsLoad]  = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  const loadStats = useCallback(async () => {
    setStatsLoad(true);
    try {
      const { data } = await api.get('/admin/system/stats');
      setStats(data.data);
      setLastUpdate(new Date());
    } catch { /* silencioso */ }
    finally { setStatsLoad(false); }
  }, []);

  useEffect(() => {
    loadStats();
    const t = setInterval(loadStats, 30000);
    return () => clearInterval(t);
  }, [loadStats]);

  const timeFmt = lastUpdate
    ? lastUpdate.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : 'A carregar...';

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-n-900 font-display">Sistema</h1>
          <p className="text-xs text-n-400 mt-1 flex items-center gap-1.5">
            <Circle size={6} strokeWidth={3} className={stats ? 'text-[var(--success)]' : 'text-n-300'} />
            Actualizado: {timeFmt} · refresh automático 30s
          </p>
        </div>
        <button className={BTN_GHOST} onClick={loadStats} disabled={statsLoad}>
          <RefreshCw {...ICON_SM} className={statsLoad ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      <div className="bg-white rounded-xl border border-n-200 overflow-hidden">
        <div className="px-4 pt-4">
          <TabBar active={tab} onChange={setTab} />
        </div>
        <div className="p-4">
          {tab === 'monitor'     && <MonitorTab    stats={stats}  loading={statsLoad} />}
          {tab === 'services'    && <ServicesTab   stats={stats}  loading={statsLoad} />}
          {tab === 'logs'        && <LogsTab />}
          {tab === 'security'    && <SecurityTab />}
          {tab === 'settings'    && <SettingsTab />}
          {tab === 'maintenance' && <MaintenanceTab />}
        </div>
      </div>
    </div>
  );
}
