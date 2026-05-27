import { useState, useEffect, useMemo } from 'react';
import { Download, ExternalLink, Search, Filter } from 'lucide-react';
import api from '../../services/api';
import PageHeader from '../../components/layout/PageHeader';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input, { Select } from '../../components/ui/Input';
import Table from '../../components/ui/Table';
import Modal from '../../components/ui/Modal';
import LoadingSpinner from '../../components/shared/LoadingSpinner';

const PLAN_BADGE   = { starter: 'info', business: 'pending', pro: 'confirmed' };
const STATUS_BADGE = { trial: 'pending', active: 'confirmed', suspended: 'cancelled', cancelled: 'cancelled' };
const TYPE_LABELS  = { activity: 'Actividade', hotel: 'Hotel', rentacar: 'Rent-a-car', restaurant: 'Restaurante' };

function exportCsv(rows) {
  const keys    = ['name', 'email', 'operator_type', 'plan', 'plan_status', 'trial_ends_at', 'created_at'];
  const headers = ['Nome', 'Email', 'Tipo', 'Plano', 'Estado', 'Trial ate', 'Registado em'];
  const lines   = rows.map(o => keys.map(k => `"${(o[k] || '').toString().replace(/"/g, '""')}"`).join(','));
  const csv     = [headers.join(','), ...lines].join('\n');
  const blob    = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement('a');
  a.href = url; a.download = `operadores-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function OperatorAvatar({ op }) {
  if (op.logo_url) return <img src={op.logo_url} alt={op.name} className="w-7 h-7 rounded-sm object-cover" />;
  return (
    <div className="w-7 h-7 rounded-sm bg-ocean-50 flex items-center justify-center shrink-0">
      <span className="text-xs font-display font-bold text-ocean-700">{op.name?.[0]?.toUpperCase()}</span>
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

  const [detailModal, setDetailModal] = useState(null);
  const [detail,      setDetail]      = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [editModal, setEditModal] = useState(null);
  const [editForm,  setEditForm]  = useState({ plan: '', plan_status: '', trial_ends_at: '' });
  const [saving,    setSaving]    = useState(false);

  useEffect(() => {
    const params = {};
    if (filterType)   params.operator_type = filterType;
    if (filterPlan)   params.plan          = filterPlan;
    if (filterStatus) params.plan_status   = filterStatus;
    if (search)       params.search        = search;
    setLoading(true);
    api.get('/admin/operators', { params })
      .then(r => setOperators(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [search, filterType, filterPlan, filterStatus]);

  async function openDetail(op) {
    setDetailModal(op);
    setDetailLoading(true);
    try {
      const r = await api.get(`/admin/operators/${op.id}`);
      setDetail(r.data.data);
    } catch {}
    finally { setDetailLoading(false); }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = { plan: editForm.plan, plan_status: editForm.plan_status };
      if (editForm.trial_ends_at) payload.trial_ends_at = editForm.trial_ends_at;
      const { data } = await api.put(`/admin/operators/${editModal.id}`, payload);
      setOperators(prev => prev.map(o => o.id === editModal.id ? { ...o, ...data.data } : o));
      setEditModal(null);
    } catch {} finally { setSaving(false); }
  }

  function handleImpersonate(op) {
    window.alert(`Impersonation disponivel na Fase 9 (producao).\n\nOperador: ${op.name}\nID: ${op.id}`);
  }

  const displayed = useMemo(() => operators, [operators]);

  const columns = [
    {
      key: 'name', label: 'Operador',
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
      key: 'operator_type', label: 'Tipo', width: '110px',
      render: o => <span className="text-xs font-body text-n-600">{TYPE_LABELS[o.operator_type] || o.operator_type}</span>,
    },
    {
      key: 'plan', label: 'Plano', width: '90px',
      render: o => <Badge variant={PLAN_BADGE[o.plan] || 'default'}>{o.plan}</Badge>,
    },
    {
      key: 'plan_status', label: 'Estado', width: '100px',
      render: o => <Badge variant={STATUS_BADGE[o.plan_status] || 'default'}>{o.plan_status}</Badge>,
    },
    {
      key: 'trial_ends_at', label: 'Trial ate', width: '110px',
      render: o => o.trial_ends_at
        ? <span className="font-mono text-xs text-n-600">{o.trial_ends_at.split('T')[0]}</span>
        : <span className="text-n-300">—</span>,
    },
    {
      key: 'created_at', label: 'Registo', width: '100px',
      render: o => <span className="font-mono text-xs text-n-500">{o.created_at?.split('T')[0]}</span>,
    },
    {
      key: 'actions', label: '', width: '120px',
      render: o => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => openDetail(o)}>Ver</Button>
          <Button
            variant="ghost" size="sm"
            onClick={() => { setEditForm({ plan: o.plan, plan_status: o.plan_status, trial_ends_at: o.trial_ends_at?.split('T')[0] || '' }); setEditModal(o); }}
          >
            Editar
          </Button>
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

      {/* Modal detalhe */}
      <Modal
        open={!!detailModal}
        onClose={() => { setDetailModal(null); setDetail(null); }}
        title={detailModal?.name || 'Detalhe'}
        size="md"
        footer={
          <div className="flex gap-2 w-full">
            <Button
              variant="ghost"
              size="sm"
              icon={ExternalLink}
              onClick={() => handleImpersonate(detailModal)}
            >
              Aceder como operador
            </Button>
            <div className="flex-1" />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setDetailModal(null); setDetail(null);
                setEditForm({ plan: detailModal?.plan, plan_status: detailModal?.plan_status, trial_ends_at: detailModal?.trial_ends_at?.split('T')[0] || '' });
                setEditModal(detailModal);
              }}
            >
              Editar plano
            </Button>
            <Button variant="secondary" size="sm" onClick={() => { setDetailModal(null); setDetail(null); }}>Fechar</Button>
          </div>
        }
      >
        {detailLoading ? (
          <div className="flex justify-center py-8"><LoadingSpinner /></div>
        ) : detail ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <OperatorAvatar op={detail.operator} />
              <div>
                <p className="font-display font-bold text-n-900">{detail.operator.name}</p>
                <p className="text-xs font-body text-n-500">{detail.operator.email} · {detail.operator.phone || '—'}</p>
              </div>
              <Badge variant={STATUS_BADGE[detail.operator.plan_status] || 'default'} className="ml-auto">
                {detail.operator.plan_status}
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Reservas', value: detail.stats?.reservations_total ?? '—' },
                { label: 'Receita gerada', value: detail.stats?.revenue_total != null ? `€${detail.stats.revenue_total}` : '—' },
                { label: 'Clientes', value: detail.stats?.customers_total ?? '—' },
              ].map(s => (
                <div key={s.label} className="bg-n-50 rounded-sm p-3 text-center">
                  <p className="font-display font-bold text-lg text-n-900">{s.value}</p>
                  <p className="text-xs font-body text-n-400">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm font-body">
              {[
                ['Tipo', TYPE_LABELS[detail.operator.operator_type] || detail.operator.operator_type],
                ['Plano', detail.operator.plan],
                ['Moeda', detail.operator.currency || '—'],
                ['Timezone', detail.operator.timezone || '—'],
                ['Idioma', detail.operator.language || '—'],
                ['Registo', detail.operator.created_at?.split('T')[0]],
                ['Trial ate', detail.operator.trial_ends_at?.split('T')[0] || '—'],
                ['Slug', detail.operator.booking_link_slug || '—'],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <span className="text-n-400 w-20 shrink-0">{k}</span>
                  <span className="text-n-700 font-medium truncate">{v}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Modal editar */}
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
          <Input
            label="Trial ate (opcional)"
            type="date"
            value={editForm.trial_ends_at}
            onChange={e => setEditForm({ ...editForm, trial_ends_at: e.target.value })}
          />
        </div>
      </Modal>
    </div>
  );
}
