import { useState, useEffect, useMemo } from 'react';
import {
  Download, ExternalLink, Search, ArrowUp, ArrowDown, ArrowUpDown,
  Ban, CheckCircle2, Star, Clock, Send, Check, LogIn, BookOpen, Euro,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import api from '../../services/api';
import PageHeader from '../../components/layout/PageHeader';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input, { Select, Textarea } from '../../components/ui/Input';
import Table from '../../components/ui/Table';
import Modal from '../../components/ui/Modal';
import LoadingSpinner from '../../components/shared/LoadingSpinner';

const PLAN_BADGE   = { starter: 'info', business: 'pending', pro: 'confirmed' };
const STATUS_BADGE = { trial: 'pending', active: 'confirmed', suspended: 'cancelled', cancelled: 'cancelled' };
const TYPE_LABELS  = { activity: 'Actividade', hotel: 'Hotel', rentacar: 'Rent-a-car', restaurant: 'Restaurante' };

const AXIS_TICK   = { fontSize: 11, fontFamily: 'DM Sans', fill: '#6B7280' };
const TOOLTIP_CSS = { fontFamily: 'DM Sans', fontSize: 12, borderRadius: 6, border: '1px solid #E5E8EC' };

function exportCsv(rows) {
  const keys    = ['name', 'email', 'operator_type', 'plan', 'plan_status', 'reservation_count', 'last_login', 'trial_ends_at', 'created_at'];
  const headers = ['Nome', 'Email', 'Tipo', 'Plano', 'Estado', 'Reservas', 'Ultimo login', 'Trial ate', 'Registado em'];
  const lines   = rows.map(o => keys.map(k => `"${(o[k] ?? '').toString().replace(/"/g, '""')}"`).join(','));
  const csv     = [headers.join(','), ...lines].join('\n');
  const blob    = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement('a');
  a.href = url; a.download = `operadores-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}

function OperatorAvatar({ op }) {
  if (op.logo_url) return <img src={op.logo_url} alt={op.name} className="w-7 h-7 rounded-sm object-cover" />;
  return (
    <div className="w-7 h-7 rounded-sm bg-ocean-50 flex items-center justify-center shrink-0">
      <span className="text-xs font-display font-bold text-ocean-700">{op.name?.[0]?.toUpperCase()}</span>
    </div>
  );
}

function SortHeader({ label, sortKey, sortBy, sortDir, onSort }) {
  const active = sortBy === sortKey;
  const Icon   = active ? (sortDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <button
      onClick={() => onSort(sortKey)}
      className={`inline-flex items-center gap-1 hover:text-ocean-700 transition-colors ${active ? 'text-ocean-700' : ''}`}
    >
      {label}
      <Icon size={12} strokeWidth={1.75} />
    </button>
  );
}

function KpiBox({ icon: Icon, label, value }) {
  return (
    <div className="bg-n-50 rounded-sm p-3 flex items-center gap-3">
      <div className="w-8 h-8 rounded-sm bg-white border border-n-200 flex items-center justify-center shrink-0">
        <Icon size={15} strokeWidth={1.75} className="text-ocean-700" />
      </div>
      <div className="min-w-0">
        <p className="font-display font-bold text-base text-n-900 leading-tight truncate">{value ?? '—'}</p>
        <p className="text-xs font-body text-n-400 truncate">{label}</p>
      </div>
    </div>
  );
}

export default function AdminOperators() {
  const [operators, setOperators] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [filterType,   setFilterType]   = useState('');
  const [filterPlan,   setFilterPlan]   = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sortBy,  setSortBy]  = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');

  const [detailModal, setDetailModal] = useState(null);
  const [detail,      setDetail]      = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [editModal, setEditModal] = useState(null);
  const [editForm,  setEditForm]  = useState({ plan: '', plan_status: '', trial_ends_at: '', notes_internal: '', reason: '' });
  const [saving,    setSaving]    = useState(false);
  const [extending, setExtending] = useState(false);
  const [impersonating, setImpersonating] = useState(false);

  const [messageModal, setMessageModal] = useState(null);
  const [messageForm,  setMessageForm]  = useState({ subject: '', body: '' });
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messageSentOk,  setMessageSentOk]  = useState(false);

  function loadOperators() {
    const params = { sort_by: sortBy, sort_dir: sortDir };
    if (filterType)   params.operator_type = filterType;
    if (filterPlan)   params.plan          = filterPlan;
    if (filterStatus) params.plan_status   = filterStatus;
    if (search)       params.search        = search;
    setLoading(true);
    api.get('/admin/operators', { params })
      .then(r => setOperators(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(loadOperators, [search, filterType, filterPlan, filterStatus, sortBy, sortDir]);

  function handleSort(key) {
    if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortDir('asc'); }
  }

  async function openDetail(op) {
    setDetailModal(op);
    setDetailLoading(true);
    try {
      const r = await api.get(`/admin/operators/${op.id}`);
      setDetail(r.data.data);
    } catch {}
    finally { setDetailLoading(false); }
  }

  function applyUpdate(id, patchedOperator) {
    setOperators(prev => prev.map(o => o.id === id ? { ...o, ...patchedOperator } : o));
    setDetail(prev => (prev && prev.operator?.id === id) ? { ...prev, operator: { ...prev.operator, ...patchedOperator } } : prev);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        plan:           editForm.plan,
        plan_status:    editForm.plan_status,
        notes_internal: editForm.notes_internal,
        reason:         editForm.reason?.trim() || undefined,
      };
      if (editForm.trial_ends_at) payload.trial_ends_at = editForm.trial_ends_at;
      const { data } = await api.put(`/admin/operators/${editModal.id}`, payload);
      applyUpdate(editModal.id, data.data);
      setEditModal(null);
    } catch {} finally { setSaving(false); }
  }

  async function handleSuspend(op) {
    const reason = window.prompt(`Motivo da suspensao de "${op.name}" (sera incluido no email enviado ao operador):`, '');
    if (reason === null) return;
    try {
      const { data } = await api.put(`/admin/operators/${op.id}`, { plan_status: 'suspended', reason: reason.trim() });
      applyUpdate(op.id, data.data);
    } catch (err) { window.alert(err?.response?.data?.error || 'Nao foi possivel suspender o operador.'); }
  }

  async function handleReactivate(op) {
    if (!window.confirm(`Reactivar "${op.name}"? O operador sera notificado por email.`)) return;
    try {
      const { data } = await api.put(`/admin/operators/${op.id}`, { plan_status: 'active', reason: 'Reactivacao manual pelo fundador' });
      applyUpdate(op.id, data.data);
    } catch (err) { window.alert(err?.response?.data?.error || 'Nao foi possivel reactivar o operador.'); }
  }

  async function handleExtendTrial(op, days) {
    setExtending(true);
    try {
      const { data } = await api.post(`/admin/operators/${op.id}/extend-trial`, { days });
      applyUpdate(op.id, data.data);
    } catch (err) { window.alert(err?.response?.data?.error || 'Nao foi possivel estender o trial.'); }
    finally { setExtending(false); }
  }

  async function handleImpersonate(op) {
    if (!op?.id) return;
    if (!window.confirm(`Aceder como "${op.name}"?\n\nGuarde a sua sessao actual: sera aberto um novo separador com uma sessao autenticada como este operador.`)) return;
    setImpersonating(true);
    try {
      const { data } = await api.post(`/admin/operators/${op.id}/impersonate`);
      if (data?.data?.action_link) window.open(data.data.action_link, '_blank', 'noopener,noreferrer');
      else window.alert('Nao foi possivel gerar o link de acesso.');
    } catch (err) {
      window.alert(err?.response?.data?.error || 'Nao foi possivel aceder como operador.');
    } finally { setImpersonating(false); }
  }

  function openEdit(op) {
    setEditForm({
      plan:           op.plan,
      plan_status:    op.plan_status,
      trial_ends_at:  op.trial_ends_at?.split('T')[0] || '',
      notes_internal: op.notes_internal || '',
      reason:         '',
    });
    setEditModal(op);
  }

  function openMessage(op) {
    setMessageModal(op);
    setMessageForm({ subject: '', body: '' });
    setMessageSentOk(false);
  }

  async function handleSendMessage() {
    if (!messageModal || !messageForm.subject.trim() || !messageForm.body.trim()) return;
    setSendingMessage(true);
    try {
      await api.post(`/admin/operators/${messageModal.id}/message`, messageForm);
      setMessageSentOk(true);
      setTimeout(() => { setMessageModal(null); setMessageSentOk(false); }, 1200);
    } catch (err) { window.alert(err?.response?.data?.error || 'Nao foi possivel enviar a mensagem.'); }
    finally { setSendingMessage(false); }
  }

  const displayed = useMemo(() => operators, [operators]);

  const planChanged   = editModal && editForm.plan        && editForm.plan        !== editModal.plan;
  const statusChanged = editModal && editForm.plan_status && editForm.plan_status !== editModal.plan_status;

  const columns = [
    {
      key: 'name', label: <SortHeader label="Operador" sortKey="name" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />,
      render: o => (
        <div className="flex items-center gap-2.5">
          <OperatorAvatar op={o} />
          <div className="min-w-0">
            <p className="font-semibold text-n-900 text-sm truncate">{o.name}</p>
            <p className="text-xs text-n-400 truncate">{o.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'operator_type', label: <SortHeader label="Tipo" sortKey="operator_type" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />, width: '110px',
      render: o => <span className="text-xs font-body text-n-600">{TYPE_LABELS[o.operator_type] || o.operator_type}</span>,
    },
    {
      key: 'plan', label: <SortHeader label="Plano" sortKey="plan" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />, width: '90px',
      render: o => <Badge variant={PLAN_BADGE[o.plan] || 'default'}>{o.plan}</Badge>,
    },
    {
      key: 'plan_status', label: <SortHeader label="Estado" sortKey="plan_status" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />, width: '100px',
      render: o => <Badge variant={STATUS_BADGE[o.plan_status] || 'default'}>{o.plan_status}</Badge>,
    },
    {
      key: 'reservation_count', label: <SortHeader label="Reservas" sortKey="reservation_count" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />, width: '90px',
      render: o => <span className="font-mono text-xs text-n-700">{o.reservation_count ?? 0}</span>,
    },
    {
      key: 'last_login', label: <SortHeader label="Ultimo login" sortKey="last_login" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />, width: '120px',
      render: o => o.last_login
        ? <span className="font-mono text-xs text-n-500">{new Date(o.last_login).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit' })}</span>
        : <span className="text-n-300">—</span>,
    },
    {
      key: 'trial_ends_at', label: <SortHeader label="Trial ate" sortKey="trial_ends_at" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />, width: '110px',
      render: o => o.trial_ends_at
        ? <span className="font-mono text-xs text-n-600">{o.trial_ends_at.split('T')[0]}</span>
        : <span className="text-n-300">—</span>,
    },
    {
      key: 'created_at', label: <SortHeader label="Registo" sortKey="created_at" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />, width: '100px',
      render: o => <span className="font-mono text-xs text-n-500">{o.created_at?.split('T')[0]}</span>,
    },
    {
      key: 'actions', label: '', width: '180px',
      render: o => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => openDetail(o)}>Ver</Button>
          <Button variant="ghost" size="sm" onClick={() => openEdit(o)}>Editar</Button>
          {o.plan_status === 'suspended' ? (
            <Button variant="ghost" size="sm" icon={CheckCircle2} onClick={() => handleReactivate(o)} title="Reactivar">
              Reactivar
            </Button>
          ) : (
            <Button variant="ghost" size="sm" icon={Ban} onClick={() => handleSuspend(o)} title="Suspender">
              Suspender
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Operadores"
        subtitle={`${operators.length} registados`}
        actions={
          <Button variant="secondary" size="sm" icon={Download} onClick={() => exportCsv(operators)}>
            Exportar CSV
          </Button>
        }
      />

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative w-56">
          <Search size={13} strokeWidth={1.75} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-n-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Pesquisar por nome..."
            className="w-full h-8 pl-8 pr-3 rounded-sm border border-n-200 text-xs font-body bg-white focus:outline-none focus:ring-1 focus:ring-ocean-300"
          />
        </div>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="h-8 px-2 rounded-sm border border-n-200 text-xs font-body text-n-700 bg-white focus:outline-none"
        >
          <option value="">Todos os tipos</option>
          <option value="activity">Actividade</option>
          <option value="hotel">Hotel</option>
          <option value="rentacar">Rent-a-car</option>
          <option value="restaurant">Restaurante</option>
        </select>
        <select
          value={filterPlan}
          onChange={e => setFilterPlan(e.target.value)}
          className="h-8 px-2 rounded-sm border border-n-200 text-xs font-body text-n-700 bg-white focus:outline-none"
        >
          <option value="">Todos os planos</option>
          <option value="starter">Starter</option>
          <option value="business">Business</option>
          <option value="pro">Pro</option>
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="h-8 px-2 rounded-sm border border-n-200 text-xs font-body text-n-700 bg-white focus:outline-none"
        >
          <option value="">Todos os estados</option>
          <option value="trial">Trial</option>
          <option value="active">Activo</option>
          <option value="suspended">Suspenso</option>
          <option value="cancelled">Cancelado</option>
        </select>
        {(filterType || filterPlan || filterStatus) && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterType(''); setFilterPlan(''); setFilterStatus(''); }}>
            Limpar filtros
          </Button>
        )}
      </div>

      <Card padding="p-0">
        <Table columns={columns} rows={displayed} loading={loading} />
      </Card>

      {/* Modal detalhe — perfil completo */}
      <Modal
        open={!!detailModal}
        onClose={() => { setDetailModal(null); setDetail(null); }}
        title={detailModal?.name || 'Detalhe'}
        size="lg"
        footer={
          <div className="flex gap-2 w-full flex-wrap">
            <Button variant="ghost" size="sm" icon={LogIn} loading={impersonating} onClick={() => handleImpersonate(detailModal)}>
              Aceder como operador
            </Button>
            <Button variant="ghost" size="sm" icon={Send} onClick={() => openMessage(detailModal)}>
              Enviar mensagem
            </Button>
            {detail?.operator?.slug && (
              <Button variant="ghost" size="sm" icon={ExternalLink} onClick={() => window.open(`/${detail.operator.slug}`, '_blank')}>
                Pagina publica
              </Button>
            )}
            <div className="flex-1" />
            <Button variant="secondary" size="sm" onClick={() => { setDetailModal(null); setDetail(null); openEdit(detailModal); }}>
              Editar
            </Button>
            <Button variant="secondary" size="sm" onClick={() => { setDetailModal(null); setDetail(null); }}>Fechar</Button>
          </div>
        }
      >
        {detailLoading ? (
          <div className="flex justify-center py-8"><LoadingSpinner /></div>
        ) : detail ? (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <OperatorAvatar op={detail.operator} />
              <div>
                <p className="font-display font-bold text-n-900">{detail.operator.name}</p>
                <p className="text-xs font-body text-n-500">{detail.operator.email} · {detail.operator.phone || '—'}</p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <Badge variant={PLAN_BADGE[detail.operator.plan] || 'default'}>{detail.operator.plan}</Badge>
                <Badge variant={STATUS_BADGE[detail.operator.plan_status] || 'default'}>{detail.operator.plan_status}</Badge>
              </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <KpiBox icon={BookOpen}      label="Reservas totais" value={detail.stats?.reservations_total ?? '—'} />
              <KpiBox icon={Euro}          label="Receita gerada"  value={detail.stats?.revenue_total != null ? `€${detail.stats.revenue_total}` : '—'} />
              <KpiBox icon={Star}          label="Avaliacao media" value={detail.stats?.avg_rating != null ? `${detail.stats.avg_rating} / 5` : 'Sem avaliacoes'} />
              <KpiBox icon={Clock}         label="Ultimo login"    value={detail.stats?.last_login ? fmtDateTime(detail.stats.last_login) : 'Nunca'} />
            </div>

            {/* Grafico de reservas por mes */}
            <div>
              <p className="text-xs font-mono uppercase tracking-wide text-n-400 mb-1.5">Reservas por mes (ultimos 6 meses)</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={detail.reservations_by_month || []} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E8EC" vertical={false} />
                  <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
                  <Tooltip formatter={v => [v, 'Reservas']} contentStyle={TOOLTIP_CSS} />
                  <Bar dataKey="count" fill="#1480A8" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm font-body">
              {[
                ['Tipo', TYPE_LABELS[detail.operator.operator_type] || detail.operator.operator_type],
                ['Moeda', detail.operator.currency || '—'],
                ['Timezone', detail.operator.timezone || '—'],
                ['Idioma', detail.operator.language || '—'],
                ['Registo', detail.operator.created_at?.split('T')[0]],
                ['Trial ate', detail.operator.trial_ends_at?.split('T')[0] || '—'],
                ['Slug', detail.operator.slug || '—'],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <span className="text-n-400 w-20 shrink-0">{k}</span>
                  <span className="text-n-700 font-medium truncate">{v}</span>
                </div>
              ))}
            </div>

            {/* Estender trial */}
            {detail.operator.plan_status === 'trial' && (
              <div>
                <p className="text-xs font-mono uppercase tracking-wide text-n-400 mb-1.5">Estender trial</p>
                <div className="flex gap-2">
                  {[7, 15, 30].map(days => (
                    <Button key={days} variant="secondary" size="sm" loading={extending} onClick={() => handleExtendTrial(detail.operator, days)}>
                      +{days} dias
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Notas internas com historico */}
            <div>
              <p className="text-xs font-mono uppercase tracking-wide text-n-400 mb-1.5">Notas internas</p>
              {detail.operator.notes_internal && (
                <p className="text-sm font-body text-n-700 bg-n-50 rounded-sm p-3 whitespace-pre-wrap mb-2">{detail.operator.notes_internal}</p>
              )}
              {(detail.notes_log || []).length === 0 ? (
                !detail.operator.notes_internal && <p className="text-xs font-body text-n-400">Sem notas registadas.</p>
              ) : (
                <div className="space-y-1.5">
                  {[...(detail.notes_log || [])].reverse().map((n, i) => (
                    <div key={i} className="flex items-start justify-between gap-2 bg-n-50 rounded-sm px-3 py-2">
                      <p className="text-xs font-body text-n-600">{n.text}</p>
                      <p className="text-xs font-mono text-n-400 shrink-0">{fmtDateTime(n.at)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Historico de actividade */}
            <div>
              <p className="text-xs font-mono uppercase tracking-wide text-n-400 mb-1.5">Actividade recente (ultimas {Math.min(20, (detail.recent_activity || []).length)})</p>
              {(detail.recent_activity || []).length === 0 ? (
                <p className="text-xs font-body text-n-400">Sem reservas registadas</p>
              ) : (
                <div className="divide-y divide-n-100 border border-n-100 rounded-sm max-h-64 overflow-y-auto">
                  {detail.recent_activity.map((a, i) => (
                    <div key={i} className="px-3 py-2 flex items-center justify-between gap-2 text-xs font-body">
                      <span className="text-n-700">Reserva · {a.status}</span>
                      <span className="text-n-500">€{Number(a.amount || 0)}</span>
                      <span className="font-mono text-n-400">{a.time?.split('T')[0]}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Modal editar — plano/estado com motivo */}
      <Modal
        open={!!editModal}
        onClose={() => setEditModal(null)}
        title={`Editar: ${editModal?.name}`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditModal(null)}>Cancelar</Button>
            <Button loading={saving} onClick={handleSave}>Guardar</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select label="Plano" value={editForm.plan} onChange={e => setEditForm({ ...editForm, plan: e.target.value })}>
            <option value="starter">Starter — €29/mes</option>
            <option value="business">Business — €59/mes</option>
            <option value="pro">Pro — €99/mes</option>
          </Select>
          <Select label="Estado" value={editForm.plan_status} onChange={e => setEditForm({ ...editForm, plan_status: e.target.value })}>
            <option value="trial">Trial</option>
            <option value="active">Activo</option>
            <option value="suspended">Suspenso</option>
            <option value="cancelled">Cancelado</option>
          </Select>
          {(planChanged || statusChanged) && (
            <Textarea
              label="Motivo da alteracao"
              hint={statusChanged && editForm.plan_status === 'suspended' ? 'Sera incluido no email de notificacao ao operador.' : 'Fica registado no historico interno do operador.'}
              rows={2}
              value={editForm.reason}
              onChange={e => setEditForm({ ...editForm, reason: e.target.value })}
              placeholder="Explique o motivo desta alteracao..."
            />
          )}
          <Input
            label="Trial ate (opcional)"
            type="date"
            value={editForm.trial_ends_at}
            onChange={e => setEditForm({ ...editForm, trial_ends_at: e.target.value })}
          />
          <Textarea
            label="Notas internas (visiveis apenas para a equipa SalDesk)"
            rows={3}
            value={editForm.notes_internal}
            onChange={e => setEditForm({ ...editForm, notes_internal: e.target.value })}
          />
          {editModal?.plan_status === 'trial' && (
            <div>
              <p className="text-xs font-mono uppercase tracking-wide text-n-400 mb-1.5">Estender trial</p>
              <div className="flex gap-2">
                {[7, 15, 30].map(days => (
                  <Button key={days} variant="secondary" size="sm" loading={extending} onClick={() => handleExtendTrial(editModal, days)}>
                    +{days} dias
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal mensagem directa */}
      <Modal
        open={!!messageModal}
        onClose={() => setMessageModal(null)}
        title={`Mensagem directa — ${messageModal?.name || ''}`}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setMessageModal(null)}>Cancelar</Button>
            <Button
              icon={messageSentOk ? Check : Send}
              loading={sendingMessage}
              onClick={handleSendMessage}
              disabled={!messageForm.subject.trim() || !messageForm.body.trim()}
              className={messageSentOk ? 'text-[#1A7A4A]' : ''}
            >
              {messageSentOk ? 'Enviada' : 'Enviar'}
            </Button>
          </>
        }
      >
        {messageModal && (
          <div className="space-y-4">
            <p className="text-xs font-body text-n-500">Para: <span className="font-mono text-n-700">{messageModal.email}</span></p>
            <Input
              label="Assunto"
              value={messageForm.subject}
              onChange={e => setMessageForm(p => ({ ...p, subject: e.target.value }))}
            />
            <Textarea
              label="Mensagem"
              value={messageForm.body}
              onChange={e => setMessageForm(p => ({ ...p, body: e.target.value }))}
              rows={8}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
