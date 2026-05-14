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
import LoadingSpinner from '../../components/shared/LoadingSpinner';

const CMS_CONFIG = {
  featured:    { title: 'Operadores em Destaque', endpoint: '/admin/cms/featured',    fields: [{ key:'operator_id', label:'Operator ID', required:true },{ key:'position', label:'Posicao', type:'number' }] },
  banners:     { title: 'Banners Publicitarios',  endpoint: '/admin/cms/banners',     fields: [{ key:'title', label:'Titulo', required:true },{ key:'advertiser', label:'Anunciante' },{ key:'link_url', label:'URL', required:true },{ key:'position', label:'Posicao', type:'select', options:['main','grid','footer'] }] },
  experiences: { title: 'Experiencias Curadas',   endpoint: '/admin/cms/experiences', fields: [{ key:'title_pt', label:'Titulo PT', required:true },{ key:'title_en', label:'Titulo EN' },{ key:'price_from', label:'Preco desde', type:'number' },{ key:'duration_days', label:'Duracao (dias)', type:'number' },{ key:'theme', label:'Tema' }] },
  events:      { title: 'Eventos e Epocas',        endpoint: '/admin/cms/events',      fields: [{ key:'name_pt', label:'Nome PT', required:true },{ key:'name_en', label:'Nome EN' },{ key:'month_start', label:'Mes inicio', type:'number' },{ key:'month_end', label:'Mes fim', type:'number' },{ key:'event_type', label:'Tipo', type:'select', options:['festival','sport','culture','high_season','general'] }] },
  articles:    { title: 'Artigos do Guia',         endpoint: '/admin/cms/articles',    fields: [{ key:'title_pt', label:'Titulo PT', required:true },{ key:'title_en', label:'Titulo EN' },{ key:'category', label:'Categoria' },{ key:'excerpt_pt', label:'Resumo PT', type:'textarea' },{ key:'slug', label:'Slug' }] },
};

export default function AdminCms({ type }) {
  const cfg = CMS_CONFIG[type] || CMS_CONFIG.banners;
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(null);
  const [form, setForm]       = useState({});
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get(cfg.endpoint).then(r => setItems(r.data.data || [])).finally(() => setLoading(false));
  }, [type]);

  async function handleSave() {
    setSaving(true);
    try {
      if (modal === 'create') {
        const { data } = await api.post(cfg.endpoint, form);
        setItems([data.data, ...items]);
      } else {
        const { data } = await api.put(`${cfg.endpoint}/${modal.id}`, form);
        setItems(items.map(i => i.id === modal.id ? data.data : i));
      }
      setModal(null); setForm({});
    } finally { setSaving(false); }
  }

  async function handleDelete(item) {
    await api.delete(`${cfg.endpoint}/${item.id}`);
    setItems(items.filter(i => i.id !== item.id));
  }

  const set = f => e => setForm({ ...form, [f]: e.target.value });

  const firstFieldKey = cfg.fields[0]?.key;
  const columns = [
    { key: firstFieldKey, label: 'Nome/Titulo', render: i => <span className="font-semibold text-n-900">{i[firstFieldKey] || '—'}</span> },
    { key: 'is_active', label: 'Activo', render: i => i.is_active !== undefined ? <Badge variant={i.is_active ? 'confirmed' : 'cancelled'}>{i.is_active ? 'Sim' : 'Nao'}</Badge> : null, width:'80px' },
    { key: 'actions', label: '', render: i => (
      <div className="flex gap-1">
        <Button variant="ghost" size="sm" icon={Pencil} onClick={() => { setForm(i); setModal(i); }} aria-label="Editar"/>
        <Button variant="ghost" size="sm" icon={Trash2} onClick={() => handleDelete(i)} className="hover:text-error hover:bg-[var(--error-light)]" aria-label="Eliminar"/>
      </div>
    ), width:'80px' },
  ];

  return (
    <div>
      <PageHeader title={cfg.title} subtitle={`${items.length} item(s)`}
        actions={<Button icon={Plus} onClick={() => { setForm({}); setModal('create'); }}>Novo</Button>}/>
      <Card padding="p-0">
        <Table columns={columns} rows={items} loading={loading}/>
      </Card>

      <Modal open={!!modal} onClose={() => { setModal(null); setForm({}); }} title={modal === 'create' ? `Novo — ${cfg.title}` : 'Editar'} size="md"
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>Cancelar</Button><Button loading={saving} onClick={handleSave}>Guardar</Button></>}>
        <div className="space-y-3">
          {cfg.fields.map(f => {
            if (f.type === 'textarea') return <Textarea key={f.key} label={f.label} value={form[f.key]||''} onChange={set(f.key)} rows={3}/>;
            if (f.type === 'select')   return <Select key={f.key} label={f.label} value={form[f.key]||''} onChange={set(f.key)}>{(f.options||[]).map(o=><option key={o} value={o}>{o}</option>)}</Select>;
            return <Input key={f.key} label={f.label} type={f.type||'text'} value={form[f.key]||''} onChange={set(f.key)} required={f.required}/>;
          })}
          <Select label="Activo" value={form.is_active ?? true} onChange={e => setForm({...form, is_active: e.target.value === 'true'})}>
            <option value="true">Sim</option>
            <option value="false">Nao</option>
          </Select>
        </div>
      </Modal>
    </div>
  );
}
