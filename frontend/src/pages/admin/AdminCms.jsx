import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import api from '../../services/api';
import PageHeader from '../../components/layout/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input, { Textarea, Select } from '../../components/ui/Input';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';

const TABS = [
  { key: 'featured',    label: 'Destaques'    },
  { key: 'banners',     label: 'Banners'      },
  { key: 'experiences', label: 'Experiencias' },
  { key: 'events',      label: 'Eventos'      },
  { key: 'articles',    label: 'Artigos'      },
];

const CMS_CONFIG = {
  featured: {
    title:    'Operadores em Destaque',
    endpoint: '/admin/cms/featured',
    fields: [
      { key: 'operator_id', label: 'Operator ID', required: true },
      { key: 'position',    label: 'Posicao',      type: 'number' },
    ],
  },
  banners: {
    title:    'Banners Publicitarios',
    endpoint: '/admin/cms/banners',
    fields: [
      { key: 'title',      label: 'Titulo',    required: true },
      { key: 'advertiser', label: 'Anunciante' },
      { key: 'link_url',   label: 'URL',       required: true },
      { key: 'position',   label: 'Posicao',   type: 'select', options: ['main', 'grid', 'footer'] },
    ],
  },
  experiences: {
    title:    'Experiencias Curadas',
    endpoint: '/admin/cms/experiences',
    fields: [
      { key: 'title_pt',      label: 'Titulo PT',     required: true },
      { key: 'title_en',      label: 'Titulo EN' },
      { key: 'price_from',    label: 'Preco desde',   type: 'number' },
      { key: 'duration_days', label: 'Duracao (dias)', type: 'number' },
      { key: 'theme',         label: 'Tema' },
    ],
  },
  events: {
    title:    'Eventos e Epocas',
    endpoint: '/admin/cms/events',
    fields: [
      { key: 'name_pt',     label: 'Nome PT',    required: true },
      { key: 'name_en',     label: 'Nome EN' },
      { key: 'month_start', label: 'Mes inicio', type: 'number' },
      { key: 'month_end',   label: 'Mes fim',    type: 'number' },
      { key: 'event_type',  label: 'Tipo',       type: 'select', options: ['festival', 'sport', 'culture', 'high_season', 'general'] },
    ],
  },
  articles: {
    title:    'Artigos do Guia',
    endpoint: '/admin/cms/articles',
    fields: [
      { key: 'title_pt',   label: 'Titulo PT',  required: true },
      { key: 'title_en',   label: 'Titulo EN' },
      { key: 'category',   label: 'Categoria' },
      { key: 'excerpt_pt', label: 'Resumo PT',  type: 'textarea' },
      { key: 'slug',       label: 'Slug' },
    ],
  },
};

function CmsSection({ type }) {
  const cfg = CMS_CONFIG[type];
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(null);
  const [form,    setForm]    = useState({});
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get(cfg.endpoint)
      .then(r => setItems(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [type]);

  async function handleSave() {
    setSaving(true);
    try {
      if (modal === 'create') {
        const { data } = await api.post(cfg.endpoint, form);
        setItems(prev => [data.data, ...prev]);
      } else {
        const { data } = await api.put(`${cfg.endpoint}/${modal.id}`, form);
        setItems(prev => prev.map(i => i.id === modal.id ? data.data : i));
      }
      setModal(null); setForm({});
    } catch {} finally { setSaving(false); }
  }

  async function handleDelete(item) {
    if (!window.confirm(`Eliminar "${item[cfg.fields[0]?.key] || item.id}"?`)) return;
    try {
      await api.delete(`${cfg.endpoint}/${item.id}`);
      setItems(prev => prev.filter(i => i.id !== item.id));
    } catch {}
  }

  const setField = key => e => setForm(f => ({ ...f, [key]: e.target.value }));

  const firstKey = cfg.fields[0]?.key;
  const columns = [
    {
      key: firstKey,
      label: 'Nome / Titulo',
      render: i => <span className="font-semibold text-sm text-n-900">{i[firstKey] || '—'}</span>,
    },
    {
      key: 'is_active',
      label: 'Activo',
      width: '80px',
      render: i => i.is_active !== undefined
        ? <Badge variant={i.is_active ? 'confirmed' : 'cancelled'}>{i.is_active ? 'Sim' : 'Nao'}</Badge>
        : null,
    },
    {
      key: 'actions',
      label: '',
      width: '80px',
      render: i => (
        <div className="flex gap-1">
          <Button
            variant="ghost" size="sm" icon={Pencil}
            onClick={() => { setForm(i); setModal(i); }}
            aria-label="Editar"
          />
          <Button
            variant="ghost" size="sm" icon={Trash2}
            onClick={() => handleDelete(i)}
            className="hover:text-[var(--error)] hover:bg-[var(--error-light)]"
            aria-label="Eliminar"
          />
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="flex justify-between items-center mb-3">
        <p className="text-xs font-body text-n-400">{items.length} registo(s)</p>
        <Button icon={Plus} size="sm" onClick={() => { setForm({}); setModal('create'); }}>
          Novo
        </Button>
      </div>

      <Card padding="p-0">
        <Table columns={columns} rows={items} loading={loading} />
      </Card>

      <Modal
        open={!!modal}
        onClose={() => { setModal(null); setForm({}); }}
        title={modal === 'create' ? `Novo — ${cfg.title}` : 'Editar'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setModal(null); setForm({}); }}>Cancelar</Button>
            <Button loading={saving} onClick={handleSave}>Guardar</Button>
          </>
        }
      >
        <div className="space-y-3">
          {cfg.fields.map(f => {
            if (f.type === 'textarea') {
              return (
                <Textarea key={f.key} label={f.label} value={form[f.key] || ''} onChange={setField(f.key)} rows={3} />
              );
            }
            if (f.type === 'select') {
              return (
                <Select key={f.key} label={f.label} value={form[f.key] || ''} onChange={setField(f.key)}>
                  <option value="">— seleccionar —</option>
                  {(f.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                </Select>
              );
            }
            return (
              <Input
                key={f.key}
                label={f.label}
                type={f.type || 'text'}
                value={form[f.key] || ''}
                onChange={setField(f.key)}
                required={f.required}
              />
            );
          })}
          <Select
            label="Activo"
            value={String(form.is_active ?? true)}
            onChange={e => setForm(f => ({ ...f, is_active: e.target.value === 'true' }))}
          >
            <option value="true">Sim</option>
            <option value="false">Nao</option>
          </Select>
        </div>
      </Modal>
    </>
  );
}

export default function AdminCms() {
  const [activeTab, setActiveTab] = useState('featured');

  return (
    <div>
      <PageHeader title="CMS" subtitle="Gestao de conteudo do website publico" />

      <div className="flex gap-0.5 mb-5 bg-n-100 p-0.5 rounded-sm w-fit">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-1.5 rounded-sm text-xs font-body font-medium transition-colors ${
              activeTab === t.key
                ? 'bg-white text-ocean-700 shadow-sm'
                : 'text-n-500 hover:text-n-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <CmsSection key={activeTab} type={activeTab} />
    </div>
  );
}
