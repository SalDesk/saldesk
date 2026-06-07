import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, BookOpen, Euro, TrendingUp, AlertTriangle, Clock,
  Mail, Key, Plus, ToggleLeft, ToggleRight, Download, Send,
  Check, X, Activity, UserX, ArrowRight, CalendarCheck, Percent,
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import api from '../../services/api';
import PageHeader from '../../components/layout/PageHeader';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import LoadingSpinner from '../../components/shared/LoadingSpinner';

const PIE_COLORS   = ['#0D5470','#1480A8','#3A9BBF','#D4A82A'];
const TYPE_LABELS  = { activity: 'Actividade', hotel: 'Hotel', rentacar: 'Rent-a-car', restaurant: 'Restaurante' };
const PLAN_BADGE   = { starter: 'info', business: 'pending', pro: 'confirmed' };
const ACTIVITY_ICON = { reservation: BookOpen, operator: Users, lead: TrendingUp };

const AXIS_TICK   = { fontSize: 11, fontFamily: 'DM Sans', fill: '#6B7280' };
const TOOLTIP_CSS = { fontFamily: 'DM Sans', fontSize: 12, borderRadius: 6, border: '1px solid #E5E8EC' };

function KpiCard({ icon: Icon, label, value, sub, accent = false }) {
  return (
    <div className={`bg-white rounded-md border shadow-sm px-5 py-4 flex items-center gap-4 ${accent ? 'border-ocean-200 bg-ocean-50' : 'border-n-200'}`}>
      <div className="w-10 h-10 rounded-sm bg-ocean-50 flex items-center justify-center shrink-0">
        <Icon size={20} strokeWidth={1.75} className="text-ocean-700" />
      </div>
      <div className="min-w-0">
        <p className="font-display font-bold text-xl text-n-900 leading-tight">{value ?? '—'}</p>
        <p className="text-xs font-body text-n-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs font-body text-n-400 truncate">{sub}</p>}
      </div>
    </div>
  );
}

function AlertCard({ icon: Icon, color, title, items, emptyMsg, renderItem, action }) {
  return (
    <div className={`border rounded-md p-4 flex flex-col ${color}`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon size={16} strokeWidth={1.75} />
        <p className="text-sm font-body font-semibold">{title}</p>
        {items.length > 0 && (
          <span className="ml-auto text-xs font-bold font-body">{items.length}</span>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-xs font-body opacity-60">{emptyMsg}</p>
      ) : (
        <div className="space-y-1.5 flex-1">
          {items.slice(0, 4).map((item, i) => (
            <div key={i} className="text-xs font-body opacity-80 truncate">
              {renderItem ? renderItem(item) : (item.name || item.email)}
            </div>
          ))}
          {items.length > 4 && <p className="text-xs font-body opacity-50">+ {items.length - 4} mais</p>}
        </div>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-body font-semibold opacity-80 hover:opacity-100 transition-opacity self-start"
        >
          {action.label}
          <ArrowRight size={13} strokeWidth={1.75} />
        </button>
      )}
    </div>
  );
}

/* ── Activity feed ── */
function ActivityFeed() {
  const [events,  setEvents]  = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    api.get('/admin/activity', { params: { limit: 10 } })
      .then(r => setEvents(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <Card
      header={
        <div className="flex items-center gap-2">
          <Activity size={16} strokeWidth={1.75} className="text-ocean-700" />
          <h3 className="font-display font-semibold text-sm text-n-700">Actividade recente</h3>
          <span className="ml-auto text-xs font-mono text-n-400">actualiza a cada 30s</span>
        </div>
      }
      padding="p-0"
    >
      {loading ? (
        <div className="flex justify-center py-8"><LoadingSpinner size={22} /></div>
      ) : events.length === 0 ? (
        <p className="px-4 py-8 text-center text-n-400 text-xs font-body">Sem actividade recente</p>
      ) : (
        <div className="divide-y divide-n-100 max-h-[360px] overflow-y-auto">
          {events.map((e, i) => {
            const Icon = ACTIVITY_ICON[e.type] || Activity;
            return (
              <div key={i} className="px-4 py-3 flex items-start gap-3">
                <div className="w-7 h-7 rounded-sm bg-ocean-50 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon size={14} strokeWidth={1.75} className="text-ocean-700" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-body font-semibold text-n-900 truncate">{e.title}</p>
                  <p className="text-xs font-body text-n-400 truncate">{e.sub}</p>
                </div>
                <p className="text-xs font-mono text-n-400 whitespace-nowrap shrink-0">
                  {e.time ? new Date(e.time).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/* ── Waitlist section ── */
function WaitlistSection() {
  const [waitlist,    setWaitlist]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [sending,     setSending]     = useState(false);
  const [sentOk,      setSentOk]      = useState(false);
  const [search,      setSearch]      = useState('');

  useEffect(() => {
    api.get('/admin/waitlist')
      .then(r => setWaitlist(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function exportCsv() {
    const rows = [['Email', 'Data de inscricao', 'Fonte']];
    waitlist.forEach(w => rows.push([w.email, w.created_at?.slice(0, 10) || '', w.source || 'coming-soon']));
    const csv  = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `waitlist-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  async function sendLaunchEmail() {
    if (!window.confirm(`Enviar email de lançamento para ${waitlist.length} subscritores?`)) return;
    setSending(true);
    try {
      await api.post('/admin/waitlist/launch-email');
      setSentOk(true);
      setTimeout(() => setSentOk(false), 3000);
    } catch { /* ignore */ }
    finally { setSending(false); }
  }

  const filtered = waitlist.filter(w =>
    !search || w.email.toLowerCase().includes(search.toLowerCase()),
  );

  if (loading) return <div className="flex justify-center py-8"><LoadingSpinner size={24} /></div>;

  return (
    <Card
      header={
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Mail size={16} strokeWidth={1.75} className="text-ocean-700" />
            <h3 className="font-display font-semibold text-sm text-n-700">
              Waitlist — {waitlist.length} subscritores
            </h3>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="secondary" size="sm" icon={Download} onClick={exportCsv} disabled={waitlist.length === 0}>
              Exportar CSV
            </Button>
            <Button
              variant="secondary" size="sm"
              icon={sentOk ? Check : Send}
              loading={sending}
              onClick={sendLaunchEmail}
              disabled={waitlist.length === 0}
              className={sentOk ? 'text-[#1A7A4A] border-green-200' : ''}>
              {sentOk ? 'Email enviado' : 'Email de lancamento'}
            </Button>
          </div>
        </div>
      }
      padding="p-0"
    >
      {waitlist.length === 0 ? (
        <div className="text-center py-10">
          <Mail size={28} strokeWidth={1.25} className="mx-auto mb-2 text-n-300" />
          <p className="text-sm font-body text-n-400">Sem subscritores na waitlist ainda.</p>
        </div>
      ) : (
        <>
          <div className="px-4 py-2.5 border-b border-n-100">
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Pesquisar email..."
              className="w-full sm:w-64 h-8 px-3 text-sm font-body border border-n-200 rounded bg-n-50 placeholder:text-n-400 focus:outline-none focus:border-ocean-700"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-n-200 bg-n-50">
                  {['Email', 'Fonte', 'Lingua', 'Data'].map(h => (
                    <th key={h} className="text-left py-2 px-4 text-xs font-mono uppercase tracking-wider text-n-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-n-100">
                {filtered.slice(0, 50).map(w => (
                  <tr key={w.id} className="hover:bg-n-50">
                    <td className="py-2.5 px-4 font-body text-n-800">{w.email}</td>
                    <td className="py-2.5 px-4">
                      <span className="text-xs font-mono text-n-500 bg-n-100 px-1.5 py-0.5 rounded">
                        {w.source || 'coming-soon'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-xs font-mono text-n-500">{(w.lang || 'pt').toUpperCase()}</td>
                    <td className="py-2.5 px-4 text-xs font-mono text-n-500 whitespace-nowrap">
                      {w.created_at ? new Date(w.created_at).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > 50 && (
              <p className="text-xs font-body text-n-400 text-center py-2">
                A mostrar 50 de {filtered.length} resultados
              </p>
            )}
          </div>
        </>
      )}
    </Card>
  );
}

/* ── Invite codes section ── */
function InviteCodesSection() {
  const [codes,    setCodes]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [newCode,  setNewCode]  = useState({ code: '', description: '', max_uses: '999' });
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving,   setSaving]   = useState({});

  useEffect(() => {
    api.get('/admin/invite-codes')
      .then(r => setCodes(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!newCode.code.trim()) return;
    setCreating(true);
    try {
      const { data } = await api.post('/admin/invite-codes', {
        code:        newCode.code.trim().toUpperCase(),
        description: newCode.description.trim(),
        max_uses:    Number(newCode.max_uses) || 999,
      });
      setCodes(p => [data.data, ...p]);
      setNewCode({ code: '', description: '', max_uses: '999' });
      setShowForm(false);
    } catch { /* ignore */ }
    finally { setCreating(false); }
  }

  async function toggleActive(id, active) {
    setSaving(p => ({ ...p, [id]: true }));
    try {
      await api.put(`/admin/invite-codes/${id}`, { active: !active });
      setCodes(p => p.map(c => c.id === id ? { ...c, active: !active } : c));
    } catch { /* ignore */ }
    finally { setSaving(p => ({ ...p, [id]: false })); }
  }

  if (loading) return <div className="flex justify-center py-8"><LoadingSpinner size={24} /></div>;

  return (
    <Card
      header={
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key size={16} strokeWidth={1.75} className="text-ocean-700" />
            <h3 className="font-display font-semibold text-sm text-n-700">Codigos de Convite</h3>
          </div>
          <Button variant="secondary" size="sm" icon={Plus} onClick={() => setShowForm(p => !p)}>
            Novo codigo
          </Button>
        </div>
      }
    >
      {showForm && (
        <form onSubmit={handleCreate} className="flex flex-wrap gap-2 mb-4 p-3 bg-n-50 border border-n-200 rounded-md">
          <input
            value={newCode.code}
            onChange={e => setNewCode(p => ({ ...p, code: e.target.value.toUpperCase() }))}
            placeholder="CODIGO"
            required
            className="h-8 px-3 text-sm font-mono border border-n-200 rounded bg-white focus:outline-none focus:border-ocean-700 w-36"
          />
          <input
            value={newCode.description}
            onChange={e => setNewCode(p => ({ ...p, description: e.target.value }))}
            placeholder="Descricao"
            className="h-8 px-3 text-sm font-body border border-n-200 rounded bg-white focus:outline-none focus:border-ocean-700 flex-1 min-w-[120px]"
          />
          <input
            type="number" min="1"
            value={newCode.max_uses}
            onChange={e => setNewCode(p => ({ ...p, max_uses: e.target.value }))}
            placeholder="Usos max."
            className="h-8 px-3 text-sm font-mono border border-n-200 rounded bg-white focus:outline-none focus:border-ocean-700 w-24"
          />
          <button type="submit" disabled={creating}
            className="h-8 px-3 bg-ocean-700 text-white text-xs font-body font-semibold rounded hover:bg-ocean-800 transition-colors disabled:opacity-50">
            {creating ? 'A criar...' : 'Criar'}
          </button>
          <button type="button" onClick={() => setShowForm(false)}
            className="h-8 px-2 text-n-400 hover:text-n-600 transition-colors">
            <X size={14} strokeWidth={1.75} />
          </button>
        </form>
      )}

      {codes.length === 0 ? (
        <div className="text-center py-8">
          <Key size={28} strokeWidth={1.25} className="mx-auto mb-2 text-n-300" />
          <p className="text-sm font-body text-n-400">Sem codigos de convite registados.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-n-200">
                {['Codigo', 'Descricao', 'Usos', 'Estado', ''].map(h => (
                  <th key={h} className="text-left py-2 px-3 text-xs font-mono uppercase tracking-wider text-n-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-n-100">
              {codes.map(c => (
                <tr key={c.id} className={`hover:bg-n-50 transition-colors ${!c.active ? 'opacity-60' : ''}`}>
                  <td className="py-2.5 px-3 font-mono font-bold text-n-900 tracking-wider">{c.code}</td>
                  <td className="py-2.5 px-3 font-body text-n-600 max-w-[180px] truncate">{c.description || '—'}</td>
                  <td className="py-2.5 px-3">
                    <span className="text-xs font-mono text-n-700">{c.uses || 0}</span>
                    {c.max_uses && <span className="text-xs font-mono text-n-400">/{c.max_uses}</span>}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`text-xs font-mono px-2 py-0.5 rounded-xs ${c.active ? 'bg-[#ECFDF5] text-[#1A7A4A]' : 'bg-n-100 text-n-500'}`}>
                      {c.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <button
                      onClick={() => toggleActive(c.id, c.active)}
                      disabled={saving[c.id]}
                      className="p-1 rounded text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors disabled:opacity-40"
                      title={c.active ? 'Desactivar' : 'Activar'}>
                      {c.active
                        ? <ToggleRight size={16} strokeWidth={1.75} className="text-ocean-700" />
                        : <ToggleLeft  size={16} strokeWidth={1.75} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default function AdminDashboard() {
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/admin/stats')
      .then(r => setStats(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size={32} /></div>;
  if (!stats)  return <div className="text-center py-20 text-n-400 font-body text-sm">Erro ao carregar dados.</div>;

  const byType = (stats.operators.by_type || []).map(d => ({
    ...d,
    label: TYPE_LABELS[d.name] || d.name,
  }));

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Metricas globais da plataforma SalDesk"
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          icon={Users}
          label="Operadores activos"
          value={stats.operators.active}
          sub={`${stats.operators.trial} trial · ${stats.operators.suspended} suspensos`}
        />
        <KpiCard
          icon={Euro}
          label="MRR estimado"
          value={`€${stats.mrr}`}
          sub={`${stats.operators.by_plan?.starter || 0}S · ${stats.operators.by_plan?.business || 0}B · ${stats.operators.by_plan?.pro || 0}Pro`}
          accent
        />
        <KpiCard
          icon={BookOpen}
          label="Reservas hoje"
          value={stats.reservations.today}
          sub={`${stats.reservations.this_month} este mes · ${stats.reservations.total} total`}
        />
        <KpiCard
          icon={CalendarCheck}
          label="Trials a expirar (7 dias)"
          value={(stats.trials_expiring || []).length}
          sub="Necessitam de seguimento"
        />
        <KpiCard
          icon={TrendingUp}
          label="Leads (24h)"
          value={stats.leads.new_24h}
          sub={`${stats.leads.total} total · ${stats.leads.converted} convertidos`}
        />
        <KpiCard
          icon={Percent}
          label="Taxa de conversao"
          value={`${stats.leads.conversion_rate}%`}
          sub="Leads convertidos em operadores"
        />
        <KpiCard
          icon={UserX}
          label="Operadores inactivos"
          value={(stats.inactive_operators || []).length}
          sub="Sem reservas nos ultimos 30 dias"
        />
        <KpiCard
          icon={Users}
          label="Operadores totais"
          value={stats.operators.total}
          sub={`${stats.operators.active} activos · ${stats.operators.trial} trial`}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card
          header={<h3 className="font-display font-semibold text-sm text-n-700">Crescimento de operadores (ultimos 6 meses)</h3>}
          padding="px-5 pb-5 pt-2"
        >
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={stats.operator_growth || []} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E8EC" vertical={false} />
              <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
              <Tooltip formatter={v => [v, 'Operadores']} contentStyle={TOOLTIP_CSS} />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#0D5470"
                strokeWidth={2}
                dot={{ r: 3, fill: '#0D5470', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card
          header={<h3 className="font-display font-semibold text-sm text-n-700">MRR estimado (ultimos 6 meses)</h3>}
          padding="px-5 pb-5 pt-2"
        >
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={stats.mrr_by_month || []} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="mrrGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#D4A82A" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#D4A82A" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E8EC" vertical={false} />
              <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} width={36} tickFormatter={v => `€${v}`} />
              <Tooltip formatter={v => [`€${v}`, 'MRR']} contentStyle={TOOLTIP_CSS} />
              <Area type="monotone" dataKey="mrr" stroke="#D4A82A" strokeWidth={2} fill="url(#mrrGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card
          header={<h3 className="font-display font-semibold text-sm text-n-700">Reservas diarias (ultimos 30 dias)</h3>}
          padding="px-5 pb-5 pt-2"
        >
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stats.daily_reservations || []} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E8EC" vertical={false} />
              <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={4} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
              <Tooltip formatter={v => [v, 'Reservas']} contentStyle={TOOLTIP_CSS} />
              <Bar dataKey="count" fill="#1480A8" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card
          header={<h3 className="font-display font-semibold text-sm text-n-700">Operadores por tipo</h3>}
          padding="px-4 pb-4 pt-2"
        >
          {byType.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={byType}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="45%"
                  innerRadius={48}
                  outerRadius={72}
                  paddingAngle={3}
                >
                  {byType.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v, n) => [v, n]} contentStyle={TOOLTIP_CSS} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={v => <span style={{ fontSize: 11, fontFamily: 'DM Sans', color: '#374151' }}>{v}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-n-400 text-sm font-body">Sem dados</div>
          )}
        </Card>
      </div>

      {/* Alertas + Actividade */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <AlertCard
          icon={Clock}
          color="bg-[var(--warning-light)] text-[var(--warning)] border-[var(--warning)]"
          title="Trials a expirar (7 dias)"
          items={stats.trials_expiring || []}
          emptyMsg="Nenhum trial a expirar em breve"
          renderItem={item => <>{item.name} <span className="opacity-60">· {item.trial_ends_at?.split('T')[0]}</span></>}
          action={{ label: 'Ver operadores', onClick: () => navigate('/admin/operators') }}
        />
        <AlertCard
          icon={AlertTriangle}
          color="bg-[var(--info-light)] text-[var(--info)] border-[var(--info)]"
          title="Leads sem resposta (48h)"
          items={stats.new_leads_48h || []}
          emptyMsg="Todos os leads foram contactados"
          renderItem={item => <>{item.nome || item.email} <span className="opacity-60">· {TYPE_LABELS[item.tipo_negocio] || item.tipo_negocio}</span></>}
          action={{ label: 'Ver leads', onClick: () => navigate('/admin/leads') }}
        />
        <AlertCard
          icon={UserX}
          color="bg-[var(--error-light)] text-[var(--error)] border-[var(--error)]"
          title="Operadores inactivos"
          items={stats.inactive_operators || []}
          emptyMsg="Todos os operadores tem actividade recente"
          renderItem={item => <>{item.name} <span className="opacity-60">· {TYPE_LABELS[item.operator_type] || item.operator_type}</span></>}
          action={{ label: 'Ver operadores', onClick: () => navigate('/admin/operators') }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2">
          <ActivityFeed />
        </div>
        <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Operadores recentes</h3>} padding="p-0">
          {(stats.recent_operators || []).length === 0 ? (
            <p className="px-4 py-8 text-center text-n-400 text-xs font-body">Sem registos recentes</p>
          ) : (
            <div className="divide-y divide-n-100">
              {(stats.recent_operators || []).map(op => (
                <div key={op.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="w-7 h-7 rounded-sm bg-ocean-50 flex items-center justify-center shrink-0">
                    <span className="text-xs font-display font-bold text-ocean-700">
                      {op.name?.[0]?.toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-body font-semibold text-n-900 truncate">{op.name}</p>
                    <p className="text-xs font-body text-n-400">{TYPE_LABELS[op.operator_type] || op.operator_type}</p>
                  </div>
                  <Badge variant={PLAN_BADGE[op.plan] || 'default'}>{op.plan}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Waitlist + Invite codes */}
      <div className="space-y-5">
        <WaitlistSection />
        <InviteCodesSection />
      </div>
    </div>
  );
}
