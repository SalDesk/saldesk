import { useState, useEffect, useMemo } from 'react';
import { Download, Search, ChevronUp } from 'lucide-react';
import api from '../../services/api';
import PageHeader from '../../components/layout/PageHeader';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input, { Select, Textarea } from '../../components/ui/Input';
import Table from '../../components/ui/Table';
import Modal from '../../components/ui/Modal';

const STATUS_CONFIG = {
  novo:        { label: 'Novo',        badge: 'pending'   },
  contactado:  { label: 'Contactado',  badge: 'info'      },
  convertido:  { label: 'Convertido',  badge: 'confirmed' },
};

const TYPE_LABELS = { activity: 'Actividade', hotel: 'Hotel', rentacar: 'Rent-a-car', restaurant: 'Restaurante' };

function ScoreBar({ score }) {
  const color = score >= 70 ? 'bg-[var(--success)]' : score >= 40 ? 'bg-sand-500' : 'bg-n-300';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-n-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-mono font-semibold text-n-600">{score}</span>
    </div>
  );
}

function exportCsv(rows) {
  const keys    = ['email', 'name', 'operator_type', 'source', 'language', 'computed_status', 'score', 'created_at'];
  const headers = ['Email', 'Nome', 'Tipo', 'Origem', 'Idioma', 'Estado', 'Score', 'Data'];
  const lines   = rows.map(l => keys.map(k => `"${(l[k] ?? '').toString().replace(/"/g, '""')}"`).join(','));
  const csv     = [headers.join(','), ...lines].join('\n');
  const blob    = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement('a');
  a.href = url; a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  URL.revokeObjectURL(url);
}

export default function AdminLeads() {
  const [leads,    setLeads]   = useState([]);
  const [loading,  setLoading] = useState(true);
  const [search,   setSearch]  = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType,   setFilterType]   = useState('');
  const [sortScore,    setSortScore]    = useState(false);

  const [selectedLead, setSelectedLead] = useState(null);
  const [editForm,     setEditForm]     = useState({ status: '', notes: '' });
  const [saving,       setSaving]       = useState(false);

  function loadLeads(params = {}) {
    setLoading(true);
    const q = {};
    if (params.operator_type || filterType)   q.operator_type = params.operator_type ?? filterType;
    if (params.status        || filterStatus) q.status        = params.status        ?? filterStatus;
    api.get('/admin/leads', { params: q })
      .then(r => setLeads(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadLeads(); }, [filterType, filterStatus]);

  function openEdit(lead) {
    setSelectedLead(lead);
    setEditForm({ status: lead.computed_status || 'novo', notes: lead.notes || '' });
  }

  async function handleSave() {
    if (!selectedLead) return;
    setSaving(true);
    try {
      const { data } = await api.put(`/admin/leads/${selectedLead.id}`, {
        status: editForm.status,
        notes:  editForm.notes,
      });
      const updated = data.data;
      setLeads(prev => prev.map(l => l.id === updated.id ? { ...updated, score: updated.score || selectedLead.score } : l));
      setSelectedLead(null);
    } catch {} finally { setSaving(false); }
  }

  const displayed = useMemo(() => {
    let rows = leads;
    if (search) rows = rows.filter(l =>
      (l.email || '').toLowerCase().includes(search.toLowerCase()) ||
      (l.name  || '').toLowerCase().includes(search.toLowerCase())
    );
    if (sortScore) rows = [...rows].sort((a, b) => (b.score || 0) - (a.score || 0));
    return rows;
  }, [leads, search, sortScore]);

  const columns = [
    {
      key: 'created_at', label: 'Data', width: '100px',
      render: l => <span className="font-mono text-xs text-n-500">{l.created_at?.split('T')[0]}</span>,
    },
    {
      key: 'email', label: 'Lead',
      render: l => (
        <div>
          <p className="font-semibold text-n-900 text-sm">{l.email}</p>
          {l.name && <p className="text-xs text-n-400">{l.name}</p>}
        </div>
      ),
    },
    {
      key: 'operator_type', label: 'Tipo', width: '110px',
      render: l => <span className="text-xs text-n-600">{TYPE_LABELS[l.operator_type] || l.operator_type || '—'}</span>,
    },
    {
      key: 'source', label: 'Origem', width: '90px',
      render: l => <span className="text-xs text-n-500">{l.source || '—'}</span>,
    },
    {
      key: 'score', label: (
        <button className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-n-500" onClick={() => setSortScore(s => !s)}>
          Score <ChevronUp size={12} strokeWidth={2} className={sortScore ? 'text-ocean-700' : 'text-n-300'} />
        </button>
      ), width: '100px',
      render: l => <ScoreBar score={l.score || 0} />,
    },
    {
      key: 'computed_status', label: 'Estado', width: '110px',
      render: l => {
        const cfg = STATUS_CONFIG[l.computed_status] || STATUS_CONFIG.novo;
        return <Badge variant={cfg.badge}>{cfg.label}</Badge>;
      },
    },
    {
      key: 'actions', label: '', width: '80px',
      render: l => <Button variant="ghost" size="sm" onClick={() => openEdit(l)}>Editar</Button>,
    },
  ];

  const newCount = leads.filter(l => l.computed_status === 'novo').length;

  return (
    <div>
      <PageHeader
        title="Leads"
        subtitle={`${newCount} novos · ${leads.length} total`}
        actions={
          <Button variant="secondary" size="sm" icon={Download} onClick={() => exportCsv(displayed)}>
            Exportar CSV
          </Button>
        }
      />

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative w-52">
          <Search size={13} strokeWidth={1.75} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-n-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Pesquisar email ou nome..."
            className="w-full h-8 pl-8 pr-3 rounded-sm border border-n-200 text-xs font-body bg-white focus:outline-none focus:ring-1 focus:ring-ocean-300"
          />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="h-8 px-2 rounded-sm border border-n-200 text-xs font-body bg-white focus:outline-none"
        >
          <option value="">Todos os estados</option>
          <option value="novo">Novo</option>
          <option value="contactado">Contactado</option>
          <option value="convertido">Convertido</option>
        </select>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="h-8 px-2 rounded-sm border border-n-200 text-xs font-body bg-white focus:outline-none"
        >
          <option value="">Todos os tipos</option>
          <option value="activity">Actividade</option>
          <option value="hotel">Hotel</option>
          <option value="rentacar">Rent-a-car</option>
          <option value="restaurant">Restaurante</option>
        </select>
        {(filterStatus || filterType) && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterStatus(''); setFilterType(''); }}>
            Limpar
          </Button>
        )}
      </div>

      <Card padding="p-0">
        <Table columns={columns} rows={displayed} loading={loading} />
      </Card>

      {/* Modal editar lead */}
      <Modal
        open={!!selectedLead}
        onClose={() => setSelectedLead(null)}
        title={selectedLead?.email || 'Lead'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSelectedLead(null)}>Cancelar</Button>
            <Button loading={saving} onClick={handleSave}>Guardar</Button>
          </>
        }
      >
        {selectedLead && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm font-body bg-n-50 rounded-sm p-3">
              {[
                ['Tipo',   TYPE_LABELS[selectedLead.operator_type] || selectedLead.operator_type || '—'],
                ['Origem', selectedLead.source || '—'],
                ['Idioma', selectedLead.language || '—'],
                ['Score',  selectedLead.score || 0],
                ['Registo', selectedLead.created_at?.split('T')[0]],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-2 items-center">
                  <span className="text-n-400 text-xs w-16 shrink-0">{k}</span>
                  <span className="text-n-700 font-medium text-xs">{String(v)}</span>
                </div>
              ))}
            </div>

            <Select
              label="Estado"
              value={editForm.status}
              onChange={e => setEditForm({ ...editForm, status: e.target.value })}
            >
              <option value="novo">Novo</option>
              <option value="contactado">Contactado</option>
              <option value="convertido">Converter em operador</option>
            </Select>

            <Textarea
              label="Notas internas"
              value={editForm.notes}
              onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
              placeholder="Adicionar contexto sobre este lead..."
              rows={3}
            />

            {selectedLead.notes && (
              <div className="text-xs font-body text-n-500 bg-n-50 rounded-sm p-2.5">
                <p className="font-semibold mb-1">Nota anterior:</p>
                <p>{selectedLead.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
