import { useState, useEffect } from 'react';
import {
  Users, BookOpen, Euro, TrendingUp, AlertTriangle, Clock,
  Mail, Key, Plus, ToggleLeft, ToggleRight, Download, Send,
  Trash2, Check, X,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
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
const STATUS_BADGE = { trial: 'pending', active: 'confirmed', suspended: 'cancelled' };

function KpiCard({ icon: Icon, label, value, sub, accent = false }) {
  return (
    <div className={`bg-white rounded-md border shadow-sm px-5 py-4 flex items-center gap-4 ${accent ? 'border-ocean-200 bg-ocean-50' : 'border-n-200'}`}>
      <div className="w-10 h-10 rounded-sm bg-ocean-50 flex items-center justify-center shrink-0">
        <Icon size={20} strokeWidth={1.75} className="text-ocean-700" />
      </div>
      <div className="min-w-0">
        <p className="font-display font-bold text-xl text-n-900 leading-tight">{value ?? '—'}</p>
        <p className="text-xs font-body text-n-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs font-body text-n-400">{sub}</p>}
      </div>
    </div>
  );
}

function AlertCard({ icon: Icon, color, title, items, emptyMsg }) {
  return (
    <div className={`border rounded-md p-4 ${color}`}>
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
        <div className="space-y-1.5">
          {items.slice(0, 4).map((item, i) => (
            <div key={i} className="text-xs font-body opacity-80 truncate">
              {item.name || item.email}
              {item.trial_ends_at && <span className="ml-1 opacity-60">· {item.trial_ends_at?.split('T')[0]}</span>}
            </div>
          ))}
          {items.length > 4 && <p className="text-xs font-body opacity-50">+ {items.length - 4} mais</p>}
        </div>
      )}
    </div>
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
          sub={`${stats.operators.total} total · ${stats.operators.trial} trial`}
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
          label="Reservas totais"
          value={stats.reservations.total}
          sub={`${stats.reservations.checked_out} concluidas`}
        />
        <KpiCard
          icon={TrendingUp}
          label="Leads novos"
          value={stats.leads.new_uncontacted}
          sub={`${stats.leads.total} total · ${stats.leads.converted} convertidos`}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card
          className="lg:col-span-2"
          header={<h3 className="font-display font-semibold text-sm text-n-700">Crescimento de operadores (ultimos 6 meses)</h3>}
          padding="px-5 pb-5 pt-2"
        >
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={stats.operator_growth || []} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E8EC" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fontFamily: 'DM Sans', fill: '#6B7280' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fontFamily: 'DM Sans', fill: '#6B7280' }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
              <Tooltip
                formatter={v => [v, 'Operadores']}
                contentStyle={{ fontFamily: 'DM Sans', fontSize: 12, borderRadius: 6, border: '1px solid #E5E8EC' }}
              />
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
          header={<h3 className="font-display font-semibold text-sm text-n-700">Operadores por tipo</h3>}
          padding="px-4 pb-4 pt-2"
        >
          {byType.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
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
                <Tooltip
                  formatter={(v, n) => [v, n]}
                  contentStyle={{ fontFamily: 'DM Sans', fontSize: 12, borderRadius: 6, border: '1px solid #E5E8EC' }}
                />
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <AlertCard
          icon={Clock}
          color="bg-[var(--warning-light)] text-[var(--warning)] border-[var(--warning)]"
          title="Trials a expirar (7 dias)"
          items={stats.trials_expiring || []}
          emptyMsg="Nenhum trial a expirar em breve"
        />
        <AlertCard
          icon={AlertTriangle}
          color="bg-[var(--info-light)] text-[var(--info)] border-[var(--info)]"
          title="Leads sem resposta (48h)"
          items={stats.new_leads_48h || []}
          emptyMsg="Todos os leads foram contactados"
        />

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
      <div className="mt-6 space-y-5">
        <WaitlistSection />
        <InviteCodesSection />
      </div>
    </div>
  );
}
