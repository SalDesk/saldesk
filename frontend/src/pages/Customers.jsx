import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, Download, Users, Globe, TrendingUp, Star,
  Upload, Tag, Crown, Building2, UserCheck, Plane,
} from 'lucide-react';
import { listCustomers, exportCustomersCsv } from '../services/customersService';
import { useT } from '../i18n';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import Table from '../components/ui/Table';
import Modal from '../components/ui/Modal';
import CustomerDetail from '../components/crm/CustomerDetail';
import LoadingSpinner from '../components/shared/LoadingSpinner';

const SEGMENTS = [
  { key: '',           label: 'Todos',       Icon: Users },
  { key: 'tourist',    label: 'Turistas',    Icon: Plane },
  { key: 'local',      label: 'Locais',      Icon: UserCheck },
  { key: 'group',      label: 'Grupos',      Icon: Users },
  { key: 'corporate',  label: 'Corporativos',Icon: Building2 },
  { key: 'vip',        label: 'VIP',         Icon: Crown },
];

function MetricCard({ icon: Icon, label, value, sub }) {
  return (
    <div className="bg-white rounded-md border border-n-200 shadow-sm px-5 py-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-sm bg-ocean-50 flex items-center justify-center shrink-0">
        <Icon size={20} strokeWidth={1.75} className="text-ocean-700" />
      </div>
      <div>
        <p className="font-display font-bold text-xl text-n-900">{value}</p>
        <p className="text-xs font-body text-n-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs font-body text-n-400">{sub}</p>}
      </div>
    </div>
  );
}

const COLUMNS = (t, onSelect) => [
  {
    key: 'name',
    label: t('customers.name'),
    render: (c) => (
      <button onClick={() => onSelect(c.id)} className="font-body font-semibold text-n-900 hover:text-ocean-700 transition-colors text-left">
        {c.name}
      </button>
    ),
  },
  { key: 'email', label: t('customers.email'), render: (c) => <span className="text-n-600">{c.email}</span> },
  { key: 'country_code', label: t('customers.nationality'), render: (c) => c.country_code || '—', width: '80px' },
  { key: 'total_visits', label: t('customers.visits'), render: (c) => c.total_visits, width: '80px' },
  {
    key: 'total_spent',
    label: t('customers.totalSpent'),
    render: (c) => (
      <span className="font-display font-semibold text-ocean-700">
        €{Number(c.total_spent).toFixed(2)}
      </span>
    ),
    width: '110px',
  },
  {
    key: 'language',
    label: 'Idioma',
    render: (c) => <span className="text-n-500 text-xs uppercase">{c.language}</span>,
    width: '70px',
  },
];

function CsvImportModal({ open, onClose, onImported }) {
  const [file,     setFile]    = useState(null);
  const [preview,  setPreview] = useState([]);
  const [loading,  setLoading] = useState(false);
  const [error,    setError]   = useState('');
  const fileRef = useRef(null);

  function handleFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setError('');
    const reader = new FileReader();
    reader.onload = ev => {
      const lines = ev.target.result.split('\n').filter(Boolean);
      setPreview(lines.slice(0, 6));
    };
    reader.readAsText(f);
  }

  async function handleImport() {
    if (!file) return;
    setLoading(true); setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { default: api } = await import('../services/api');
      const res = await api.post('/customers/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onImported(res.data.data?.imported || 0);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao importar ficheiro');
    } finally { setLoading(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Importar clientes via CSV" size="md">
      <div className="space-y-4">
        <div className="px-3 py-2.5 bg-ocean-50 border border-ocean-100 rounded-sm text-xs font-body text-ocean-700 space-y-1">
          <p className="font-semibold">Formato esperado (cabecalho obrigatorio):</p>
          <p className="font-mono">first_name, last_name, email, phone, country_code, language</p>
        </div>

        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-n-300 rounded-md p-8 text-center cursor-pointer hover:border-ocean-400 hover:bg-ocean-50/30 transition-colors">
          <Upload size={24} strokeWidth={1.25} className="mx-auto mb-2 text-n-400" />
          <p className="text-sm font-body text-n-600">{file ? file.name : 'Clicar para seleccionar ficheiro CSV'}</p>
          <p className="text-xs font-body text-n-400 mt-1">Ficheiro .csv, max 5MB</p>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
        </div>

        {preview.length > 0 && (
          <div className="border border-n-200 rounded-sm overflow-hidden">
            <div className="px-3 py-2 bg-n-50 border-b border-n-200">
              <p className="text-xs font-mono text-n-500 uppercase tracking-wide">Pre-visualizacao (primeiras {preview.length} linhas)</p>
            </div>
            <div className="p-3 space-y-1">
              {preview.map((line, i) => (
                <p key={i} className={`text-xs font-mono truncate ${i === 0 ? 'text-ocean-700 font-semibold' : 'text-n-600'}`}>{line}</p>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-xs font-body text-error">{error}</p>}

        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button onClick={handleImport} loading={loading} disabled={!file} icon={Upload} className="flex-1">
            Importar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default function Customers() {
  const t = useT();
  const [customers,    setCustomers]  = useState([]);
  const [loading,      setLoading]    = useState(true);
  const [search,       setSearch]     = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [segment,      setSegment]    = useState('');
  const [selectedId,   setSelectedId] = useState(null);
  const [exporting,    setExporting]  = useState(false);
  const [csvModal,     setCsvModal]   = useState(false);
  const [importMsg,    setImportMsg]  = useState('');

  const carregar = useCallback(async (q = search, country = countryFilter) => {
    setLoading(true);
    try {
      const filtros = {};
      if (q) filtros.search = q;
      if (country) filtros.country_code = country;
      const data = await listCustomers(filtros);
      setCustomers(data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { carregar('', ''); }, []);

  function handleSearch(e) { e.preventDefault(); carregar(search, countryFilter); }

  function handleCountryFilter(country) {
    setCountryFilter(country);
    carregar(search, country);
  }

  async function handleExport() {
    setExporting(true);
    try { await exportCustomersCsv(); }
    finally { setExporting(false); }
  }

  function handleUpdate(updated) {
    setCustomers(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c));
  }

  function handleImported(count) {
    setImportMsg(`${count} cliente(s) importado(s) com sucesso.`);
    carregar('', '');
    setTimeout(() => setImportMsg(''), 4000);
  }

  // Local segmentation based on tags / nationality / visits
  const segmented = customers.filter(c => {
    if (!segment) return true;
    const tags = c.tags || [];
    if (segment === 'vip')       return tags.includes('VIP') || Number(c.total_spent) > 500;
    if (segment === 'tourist')   return c.nationality !== 'CV' && c.country_code !== 'CV';
    if (segment === 'local')     return c.country_code === 'CV';
    if (segment === 'group')     return tags.includes('grupo') || Number(c.total_visits) >= 5;
    if (segment === 'corporate') return tags.includes('corporativo') || tags.includes('empresa');
    return true;
  });

  const totalGasto = customers.reduce((s, c) => s + Number(c.total_spent), 0);
  const paises     = new Set(customers.map(c => c.country_code).filter(Boolean)).size;
  const topCliente = customers[0];
  const countries  = [...new Set(customers.map(c => c.country_code).filter(Boolean))].sort();

  return (
    <div>
      <PageHeader
        title={t('customers.title')}
        subtitle={`${customers.length} cliente(s) registado(s)`}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" icon={Upload} onClick={() => setCsvModal(true)}>
              Importar CSV
            </Button>
            <Button variant="secondary" icon={Download} loading={exporting} onClick={handleExport}>
              Exportar
            </Button>
          </div>
        }
      />

      {importMsg && (
        <div className="mb-4 px-4 py-2.5 bg-[#ECFDF5] border border-green-200 rounded-md text-sm font-body text-[#1A7A4A]">
          {importMsg}
        </div>
      )}

      {/* Metricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard icon={Users}      label="Total clientes"  value={customers.length} />
        <MetricCard icon={TrendingUp} label="Receita total"   value={`€${totalGasto.toFixed(0)}`} />
        <MetricCard icon={Globe}      label="Paises"          value={paises} />
        <MetricCard icon={Star}       label="Top cliente"     value={topCliente?.name?.split(' ')[0] || '—'}
          sub={topCliente ? `€${Number(topCliente.total_spent).toFixed(0)}` : ''} />
      </div>

      {/* Segmentacao */}
      <div className="flex gap-2 flex-wrap mb-4">
        {SEGMENTS.map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setSegment(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-body font-semibold transition-colors ${
              segment === key ? 'bg-ocean-700 text-white' : 'bg-white border border-n-200 text-n-600 hover:border-ocean-300'
            }`}>
            <Icon size={12} strokeWidth={1.75} />
            {label}
          </button>
        ))}
      </div>

      {/* Pesquisa e paises */}
      <div className="flex flex-wrap gap-3 mb-4">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-[200px]">
          <div className="flex-1">
            <Input placeholder={`${t('common.search')}...`} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Button type="submit" icon={Search} variant="secondary" size="md" />
        </form>
        {countries.length > 0 && (
          <div className="flex gap-2 flex-wrap items-center">
            <button onClick={() => handleCountryFilter('')}
              className={`px-3 py-1.5 rounded-sm text-xs font-body font-semibold transition-colors ${!countryFilter ? 'bg-ocean-700 text-white' : 'bg-white border border-n-200 text-n-600 hover:border-ocean-300'}`}>
              Todos
            </button>
            {countries.slice(0, 8).map(c => (
              <button key={c} onClick={() => handleCountryFilter(c)}
                className={`px-3 py-1.5 rounded-sm text-xs font-body font-semibold transition-colors ${countryFilter === c ? 'bg-ocean-700 text-white' : 'bg-white border border-n-200 text-n-600 hover:border-ocean-300'}`}>
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tabela */}
      <Card padding="p-0">
        <Table columns={COLUMNS(t, setSelectedId)} rows={segmented} loading={loading} />
      </Card>

      {/* Perfil lateral */}
      {selectedId && (
        <CustomerDetail customerId={selectedId} onClose={() => setSelectedId(null)} onUpdate={handleUpdate} />
      )}

      <CsvImportModal open={csvModal} onClose={() => setCsvModal(false)} onImported={handleImported} />
    </div>
  );
}
