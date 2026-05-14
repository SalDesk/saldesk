import { useState, useEffect } from 'react';
import api from '../../services/api';
import PageHeader from '../../components/layout/PageHeader';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Table from '../../components/ui/Table';
import LoadingSpinner from '../../components/shared/LoadingSpinner';

export default function AdminLeads() {
  const [leads, setLeads]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/leads').then(r => setLeads(r.data.data)).finally(() => setLoading(false));
  }, []);

  async function markContacted(lead) {
    const { data } = await api.put(`/admin/leads/${lead.id}`, { is_contacted: true });
    setLeads(leads.map(l => l.id === lead.id ? data.data : l));
  }

  const columns = [
    { key: 'created_at', label: 'Data',          render: l => <span className="font-mono text-xs text-n-600">{l.created_at?.split('T')[0]}</span>, width:'110px' },
    { key: 'email',      label: 'Email',          render: l => <span className="font-semibold text-n-900">{l.email}</span> },
    { key: 'name',       label: 'Nome',           render: l => l.name || '—' },
    { key: 'operator_type', label: 'Tipo',        render: l => l.operator_type || '—', width:'90px' },
    { key: 'source',     label: 'Origem',         render: l => <span className="text-xs text-n-500">{l.source}</span>, width:'90px' },
    { key: 'status',     label: 'Estado',         render: l => (
      l.converted_at ? <Badge variant="confirmed">Convertido</Badge> :
      l.is_contacted  ? <Badge variant="info">Contactado</Badge> :
      <Badge variant="pending">Novo</Badge>
    ), width:'110px' },
    { key: 'actions',    label: '',               render: l => !l.is_contacted ? (
      <Button variant="ghost" size="sm" onClick={() => markContacted(l)}>Marcar contactado</Button>
    ) : null, width:'160px' },
  ];

  return (
    <div>
      <PageHeader title="Leads" subtitle={`${leads.filter(l => !l.is_contacted).length} novos`}/>
      <Card padding="p-0">
        <Table columns={columns} rows={leads} loading={loading}/>
      </Card>
    </div>
  );
}
