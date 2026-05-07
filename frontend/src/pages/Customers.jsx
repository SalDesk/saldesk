import { useState, useEffect, useCallback } from 'react';
import { Search, Download, Users, Globe, TrendingUp, Star } from 'lucide-react';
import { listCustomers, exportCustomersCsv } from '../services/customersService';
import { useT } from '../i18n';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import Table from '../components/ui/Table';
import CustomerDetail from '../components/crm/CustomerDetail';
import LoadingSpinner from '../components/shared/LoadingSpinner';

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

export default function Customers() {
  const t = useT();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [exporting, setExporting] = useState(false);

  const carregar = useCallback(async (q = search, country = countryFilter) => {
    setLoading(true);
    try {
      const filtros = {};
      if (q) filtros.search = q;
      if (country) filtros.country_code = country;
      const data = await listCustomers(filtros);
      setCustomers(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar('', ''); }, []);

  function handleSearch(e) {
    e.preventDefault();
    carregar(search, countryFilter);
  }

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
    setCustomers((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
  }

  const totalGasto   = customers.reduce((s, c) => s + Number(c.total_spent), 0);
  const totalVisitas = customers.reduce((s, c) => s + c.total_visits, 0);
  const paises       = new Set(customers.map((c) => c.country_code).filter(Boolean)).size;
  const topCliente   = customers[0];

  const countries = [...new Set(customers.map((c) => c.country_code).filter(Boolean))].sort();

  return (
    <div>
      <PageHeader
        title={t('customers.title')}
        subtitle={`${customers.length} cliente(s) registado(s)`}
        actions={
          <Button variant="secondary" icon={Download} loading={exporting} onClick={handleExport}>
            Exportar CSV
          </Button>
        }
      />

      {/* Metricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard icon={Users}    label="Total clientes"  value={customers.length} />
        <MetricCard icon={TrendingUp} label="Receita total" value={`€${totalGasto.toFixed(0)}`} />
        <MetricCard icon={Globe}    label="Paises"          value={paises} />
        <MetricCard icon={Star}     label="Top cliente"     value={topCliente?.name?.split(' ')[0] || '—'} sub={topCliente ? `€${Number(topCliente.total_spent).toFixed(0)}` : ''} />
      </div>

      {/* Pesquisa e filtros */}
      <div className="flex flex-wrap gap-3 mb-4">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-[200px]">
          <div className="flex-1">
            <Input
              placeholder={`${t('common.search')}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button type="submit" icon={Search} variant="secondary" size="md" />
        </form>

        {countries.length > 0 && (
          <div className="flex gap-2 flex-wrap items-center">
            <button
              onClick={() => handleCountryFilter('')}
              className={`px-3 py-1.5 rounded-sm text-xs font-body font-semibold transition-colors ${!countryFilter ? 'bg-ocean-700 text-white' : 'bg-white border border-n-200 text-n-600 hover:border-ocean-300'}`}
            >
              Todos
            </button>
            {countries.slice(0, 8).map((c) => (
              <button
                key={c}
                onClick={() => handleCountryFilter(c)}
                className={`px-3 py-1.5 rounded-sm text-xs font-body font-semibold transition-colors ${countryFilter === c ? 'bg-ocean-700 text-white' : 'bg-white border border-n-200 text-n-600 hover:border-ocean-300'}`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tabela */}
      <Card padding="p-0">
        <Table
          columns={COLUMNS(t, setSelectedId)}
          rows={customers}
          loading={loading}
        />
      </Card>

      {/* Perfil lateral */}
      {selectedId && (
        <CustomerDetail
          customerId={selectedId}
          onClose={() => setSelectedId(null)}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  );
}
