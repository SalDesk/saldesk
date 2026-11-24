import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, Download, Users, Globe, TrendingUp, Star,
  Upload, Crown, Building2, UserCheck, Plane, Plus,
} from 'lucide-react';
import { listCustomers, exportCustomersCsv, createCustomer } from '../services/customersService';
import { useT } from '../i18n';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Input, { Textarea } from '../components/ui/Input';
import Card from '../components/ui/Card';
import Table from '../components/ui/Table';
import Modal from '../components/ui/Modal';
import FilterChips from '../components/ui/FilterChips';
import CustomerDetail from '../components/crm/CustomerDetail';
import { mensagemErro } from '../utils/mensagemErro';
import { useLingua } from '../utils/formatoLingua';
import { eurosDuasCasas } from '../utils/formatoEuros';
import { eurosInteiros } from './reservations/shared';

/* label: chave em customersPage.segments (a chave do segmento e o valor que filtra) */
const SEGMENTS = [
  { key: '',           label: 'all',       Icon: Users },
  { key: 'tourist',    label: 'tourist',   Icon: Plane },
  { key: 'local',      label: 'local',     Icon: UserCheck },
  { key: 'group',      label: 'group',     Icon: Users },
  { key: 'corporate',  label: 'corporate', Icon: Building2 },
  { key: 'vip',        label: 'vip',       Icon: Crown },
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

const COLUMNS = (t, onSelect, lang) => [
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
        {eurosDuasCasas(c.total_spent, lang)}
      </span>
    ),
    width: '110px',
  },
  {
    key: 'language',
    label: t('customersPage.language'),
    render: (c) => <span className="text-n-500 text-xs uppercase">{c.language}</span>,
    width: '70px',
  },
  {
    key: 'custom_price',
    label: t('customersPage.agreedPrice'),
    render: (c) => c.custom_price != null ? <span className="font-display font-semibold text-n-700">{eurosDuasCasas(c.custom_price, lang)}</span> : <span className="text-n-300">—</span>,
    width: '110px',
  },
];

/* Ate agora so existia importacao CSV para adicionar clientes -- um
   operador com poucos clientes (ex: precos negociados individualmente,
   sem sentido montar um ficheiro) nao tinha forma nenhuma de os adicionar
   um a um. Confirmado por uma operadora real na comunidade de WhatsApp. */
/* Turista/Local ja tinham deteccao automatica pelo country_code (ver
   "segmented" abaixo), mas o operador pode querer corrigir/forcar (ex:
   cabo-verdiano da diaspora que e cliente turista, nao local) -- a tag
   manual passa a complementar essa deteccao, nunca a substitui.
   Grupo/Corporativo/VIP nao tem nenhum dado automatico, dependem so da tag. */
const TAG_OPTIONS = [
  { key: 'turista',      Icon: Plane },
  { key: 'local',        Icon: UserCheck },
  { key: 'VIP',          Icon: Crown },
  { key: 'grupo',        Icon: Users },
  { key: 'corporativo',  Icon: Building2 },
];

function NewCustomerModal({ open, onClose, onCreated }) {
  const t = useT();
  const [form,    setForm]    = useState({ name: '', email: '', phone: '', country_code: '', notes: '', tags: [], custom_price: '' });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  function update(field, value) { setForm(prev => ({ ...prev, [field]: value })); }

  function toggleTag(tag) {
    setForm(prev => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter(t => t !== tag) : [...prev.tags, tag],
    }));
  }

  async function handleCreate() {
    if (!form.name.trim() || !form.email.trim()) {
      setError(t('customersPage.newModal.required'));
      return;
    }
    setLoading(true); setError('');
    try {
      const created = await createCustomer(form);
      onCreated(created);
      setForm({ name: '', email: '', phone: '', country_code: '', notes: '', tags: [], custom_price: '' });
      onClose();
    } catch (err) {
      setError(mensagemErro(err, t, t('customersPage.newModal.createError')));
    } finally { setLoading(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('customersPage.newModal.title')} size="md">
      <div className="space-y-4">
        <Input label={t('customersPage.newModal.name')} value={form.name} onChange={(e) => update('name', e.target.value)} placeholder={t('customersPage.newModal.namePlaceholder')} />
        <Input label={t('customersPage.newModal.email')} type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder={t('customersPage.newModal.emailPlaceholder')} />
        <div className="grid grid-cols-2 gap-3">
          <Input label={t('customersPage.newModal.phone')} value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="+238..." />
          <Input label={t('customersPage.newModal.countryCode')} value={form.country_code} onChange={(e) => update('country_code', e.target.value)} placeholder={t('customersPage.newModal.countryPlaceholder')} maxLength={2} />
        </div>

        <div>
          <label className="block text-xs font-body font-medium text-n-500 uppercase tracking-wide mb-2">{t('customersPage.newModal.category')}</label>
          <div className="flex flex-wrap gap-2">
            {TAG_OPTIONS.map(({ key, Icon }) => {
              const active = form.tags.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleTag(key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-body font-medium border transition-colors ${
                    active ? 'bg-ocean-700 border-ocean-700 text-white' : 'bg-white border-n-200 text-n-600 hover:border-ocean-300'
                  }`}
                >
                  <Icon size={14} strokeWidth={1.75} />
                  {t(`customersPage.categories.${key}`)}
                </button>
              );
            })}
          </div>
        </div>

        <Input
          label={t('customersPage.newModal.price')}
          type="number"
          step="0.01"
          min="0"
          value={form.custom_price}
          onChange={(e) => update('custom_price', e.target.value)}
          placeholder={t('customersPage.newModal.pricePlaceholder')}
        />

        <Textarea label={t('customersPage.newModal.notes')} value={form.notes} onChange={(e) => update('notes', e.target.value)} rows={3} placeholder={t('customersPage.newModal.notesPlaceholder')} />

        {error && <p className="text-xs font-body text-error">{error}</p>}

        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">{t('common.cancel')}</Button>
          <Button onClick={handleCreate} loading={loading} icon={Plus} className="flex-1">{t('customersPage.newModal.create')}</Button>
        </div>
      </div>
    </Modal>
  );
}

function CsvImportModal({ open, onClose, onImported }) {
  const t = useT();
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
      setError(mensagemErro(err, t, t('customersPage.importModal.importError')));
    } finally { setLoading(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('customersPage.importModal.title')} size="md">
      <div className="space-y-4">
        <div className="px-3 py-2.5 bg-ocean-50 border border-ocean-100 rounded-sm text-xs font-body text-ocean-700 space-y-1">
          <p className="font-semibold">{t('customersPage.importModal.expected')}</p>
          <p className="font-mono">first_name, last_name, email, phone, country_code, language</p>
        </div>

        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-n-300 rounded-md p-8 text-center cursor-pointer hover:border-ocean-400 hover:bg-ocean-50/30 transition-colors">
          <Upload size={24} strokeWidth={1.25} className="mx-auto mb-2 text-n-400" />
          <p className="text-sm font-body text-n-600">{file ? file.name : t('customersPage.importModal.selectFile')}</p>
          <p className="text-xs font-body text-n-400 mt-1">{t('customersPage.importModal.fileHint')}</p>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
        </div>

        {preview.length > 0 && (
          <div className="border border-n-200 rounded-sm overflow-hidden">
            <div className="px-3 py-2 bg-n-50 border-b border-n-200">
              <p className="text-xs font-mono text-n-500 uppercase tracking-wide">{t('customersPage.importModal.preview', { n: preview.length })}</p>
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
          <Button variant="secondary" onClick={onClose} className="flex-1">{t('common.cancel')}</Button>
          <Button onClick={handleImport} loading={loading} disabled={!file} icon={Upload} className="flex-1">
            {t('customersPage.importModal.import')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default function Customers() {
  const t = useT();
  const lang = useLingua();
  const [customers,    setCustomers]  = useState([]);
  const [loading,      setLoading]    = useState(true);
  const [search,       setSearch]     = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [segment,      setSegment]    = useState('');
  const [selectedId,   setSelectedId] = useState(null);
  const [exporting,    setExporting]  = useState(false);
  const [csvModal,     setCsvModal]   = useState(false);
  const [newModal,     setNewModal]   = useState(false);
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
    /* O servidor escreve o cabecalho em portugues; nas outras linguas troca-se pelo da lingua do painel.
       Ninguem o le de volta: a importacao usa os seus proprios nomes (first_name, last_name...). */
    try {
      await exportCustomersCsv(lang === 'pt' ? undefined : {
        cabecalho: t('customersPage.csvHeader'),
        prefixo: t('customersPage.csvFilePrefix'),
      });
    }
    finally { setExporting(false); }
  }

  function handleUpdate(updated) {
    setCustomers(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c));
  }

  function handleImported(count) {
    setImportMsg(t('customersPage.importedMsg', { n: count }));
    carregar('', '');
    setTimeout(() => setImportMsg(''), 4000);
  }

  function handleCreated() {
    setImportMsg(t('customersPage.createdMsg'));
    carregar('', '');
    setTimeout(() => setImportMsg(''), 4000);
  }

  // Local segmentation based on tags / nationality / visits
  const segmented = customers.filter(c => {
    if (!segment) return true;
    const tags = c.tags || [];
    if (segment === 'vip')       return tags.includes('VIP') || Number(c.total_spent) > 500;
    if (segment === 'tourist')   return tags.includes('turista') || (c.nationality !== 'CV' && c.country_code !== 'CV');
    if (segment === 'local')     return tags.includes('local') || c.country_code === 'CV';
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
        subtitle={t('customersPage.subtitle', { n: customers.length })}
        actions={
          <div className="flex gap-2">
            <Button icon={Plus} onClick={() => setNewModal(true)}>
              {t('customersPage.newCustomer')}
            </Button>
            <Button variant="secondary" icon={Upload} onClick={() => setCsvModal(true)}>
              {t('customersPage.importCsv')}
            </Button>
            <Button variant="secondary" icon={Download} loading={exporting} onClick={handleExport}>
              {t('common.export')}
            </Button>
          </div>
        }
      />

      {importMsg && (
        <div className="mb-4 px-4 py-2.5 bg-[var(--success-light)] border border-n-200 rounded-md text-sm font-body text-[var(--success)]">
          {importMsg}
        </div>
      )}

      {/* Metricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard icon={Users}      label={t('customersPage.metrics.totalCustomers')}  value={customers.length} />
        <MetricCard icon={TrendingUp} label={t('customersPage.metrics.totalRevenue')}   value={eurosInteiros(totalGasto, lang)} />
        <MetricCard icon={Globe}      label={t('customersPage.metrics.countries')}      value={paises} />
        <MetricCard icon={Star}       label={t('customersPage.metrics.topCustomer')}    value={topCliente?.name?.split(' ')[0] || '—'}
          sub={topCliente ? eurosInteiros(topCliente.total_spent, lang) : ''} />
      </div>

      {/* Segmentacao */}
      <div className="mb-4">
        <FilterChips
          options={SEGMENTS.map(({ key, label }) => ({ value: key, label: t(`customersPage.segments.${label}`) }))}
          value={segment}
          onChange={setSegment}
        />
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
          <FilterChips
            options={[{ value: '', label: t('customersPage.segments.all') }, ...countries.slice(0, 8).map(c => ({ value: c, label: c }))]}
            value={countryFilter}
            onChange={handleCountryFilter}
          />
        )}
      </div>

      {/* Tabela */}
      <Card padding="p-0">
        <Table columns={COLUMNS(t, setSelectedId, lang)} rows={segmented} loading={loading} />
      </Card>

      {/* Perfil lateral */}
      {selectedId && (
        <CustomerDetail customerId={selectedId} onClose={() => setSelectedId(null)} onUpdate={handleUpdate} />
      )}

      <CsvImportModal open={csvModal} onClose={() => setCsvModal(false)} onImported={handleImported} />
      <NewCustomerModal open={newModal} onClose={() => setNewModal(false)} onCreated={handleCreated} />
    </div>
  );
}
