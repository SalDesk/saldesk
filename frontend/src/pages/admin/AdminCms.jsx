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

const TYPE_LABELS = { hotel: 'Hotel', activity: 'Actividade', rentacar: 'Rent-a-car', restaurant: 'Restaurante' };

/* ════════════════════════════════════════════════════════════
   Secção CRUD genérica — usada pelas listas bilingues simples
   ════════════════════════════════════════════════════════════ */
const CMS_CONFIG = {
  banners: {
    title:       'Banners Publicitários',
    endpoint:    '/admin/cms/banners',
    activeField: 'is_active',
    fields: [
      { key: 'title',      label: 'Título',           required: true },
      { key: 'advertiser', label: 'Anunciante' },
      { key: 'image_url',  label: 'Imagem (URL)' },
      { key: 'link_url',   label: 'Link de destino',  required: true },
      { key: 'position',   label: 'Posição',          type: 'select', options: ['main', 'grid', 'footer'] },
      { key: 'starts_at',  label: 'Início do período', type: 'date' },
      { key: 'ends_at',    label: 'Fim do período',    type: 'date' },
    ],
  },
  experiences: {
    title:       'Experiências Curadas',
    endpoint:    '/admin/cms/experiences',
    activeField: 'is_active',
    fields: [
      { key: 'title_pt',       label: 'Título PT',       required: true },
      { key: 'title_en',       label: 'Título EN' },
      { key: 'description_pt', label: 'Descrição PT',    type: 'textarea' },
      { key: 'description_en', label: 'Descrição EN',    type: 'textarea' },
      { key: 'image_url',      label: 'Foto (URL)' },
      { key: 'price_from',     label: 'Preço desde',     type: 'number' },
      { key: 'duration_days',  label: 'Duração (dias)',  type: 'number' },
      { key: 'theme',          label: 'Tema' },
    ],
  },
  events: {
    title:       'Eventos da Ilha',
    endpoint:    '/admin/cms/events',
    activeField: 'is_active',
    fields: [
      { key: 'name_pt',        label: 'Nome PT',      required: true },
      { key: 'name_en',        label: 'Nome EN' },
      { key: 'description_pt', label: 'Descrição PT', type: 'textarea' },
      { key: 'description_en', label: 'Descrição EN', type: 'textarea' },
      { key: 'month_start',    label: 'Mês início',   type: 'number' },
      { key: 'month_end',      label: 'Mês fim',      type: 'number' },
      { key: 'event_type',     label: 'Tipo',         type: 'select', options: ['festival', 'sport', 'culture', 'high_season', 'general'] },
    ],
  },
  testimonials: {
    title:       'Testemunhos',
    endpoint:    '/admin/cms/testimonials',
    activeField: 'active',
    fields: [
      { key: 'name',        label: 'Nome',             required: true },
      { key: 'role',        label: 'Cargo' },
      { key: 'company',     label: 'Empresa' },
      { key: 'photo_url',   label: 'Foto (URL)' },
      { key: 'text_pt',     label: 'Texto PT',         type: 'textarea' },
      { key: 'text_en',     label: 'Texto EN',         type: 'textarea' },
      { key: 'rating',      label: 'Avaliação (1-5)',  type: 'number' },
      { key: 'order_index', label: 'Ordem',            type: 'number' },
    ],
  },
  faqs: {
    title:       'Perguntas Frequentes',
    endpoint:    '/admin/cms/faqs',
    activeField: 'active',
    fields: [
      { key: 'question_pt', label: 'Pergunta PT', required: true },
      { key: 'question_en', label: 'Pergunta EN' },
      { key: 'answer_pt',   label: 'Resposta PT', type: 'textarea' },
      { key: 'answer_en',   label: 'Resposta EN', type: 'textarea' },
      { key: 'category',    label: 'Categoria' },
      { key: 'order_index', label: 'Ordem',       type: 'number' },
    ],
  },
  landmarks: {
    title:       'Pontos Turísticos',
    endpoint:    '/admin/cms/landmarks',
    activeField: null,
    fields: [
      { key: 'slug',           label: 'Slug',           required: true },
      { key: 'name_pt',        label: 'Nome PT',        required: true },
      { key: 'name_en',        label: 'Nome EN' },
      { key: 'type',           label: 'Tipo' },
      { key: 'description_pt', label: 'Descrição PT',   type: 'textarea' },
      { key: 'description_en', label: 'Descrição EN',   type: 'textarea' },
      { key: 'lat',            label: 'Latitude',       type: 'number' },
      { key: 'lng',            label: 'Longitude',      type: 'number' },
      { key: 'how_to_get_pt',  label: 'Como chegar PT', type: 'textarea' },
      { key: 'how_to_get_en',  label: 'Como chegar EN', type: 'textarea' },
    ],
  },
};

function CmsSection({ type }) {
  const cfg         = CMS_CONFIG[type];
  const activeField = cfg.activeField;
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
      label: 'Nome / Título',
      render: i => <span className="font-semibold text-sm text-n-900">{i[firstKey] || '—'}</span>,
    },
    ...(activeField ? [{
      key: activeField,
      label: 'Activo',
      width: '80px',
      render: i => (
        <Badge variant={i[activeField] ? 'confirmed' : 'cancelled'}>{i[activeField] ? 'Sim' : 'Não'}</Badge>
      ),
    }] : []),
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
        <Button icon={Plus} size="sm" onClick={() => { setForm(activeField ? { [activeField]: true } : {}); setModal('create'); }}>
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
          {activeField && (
            <Select
              label="Activo"
              value={String(form[activeField] ?? true)}
              onChange={e => setForm(f => ({ ...f, [activeField]: e.target.value === 'true' }))}
            >
              <option value="true">Sim</option>
              <option value="false">Não</option>
            </Select>
          )}
        </div>
      </Modal>
    </>
  );
}

/* ════════════════════════════════════════════════════════════
   Destaques — selecção de operador da lista + ordem
   ════════════════════════════════════════════════════════════ */
function FeaturedSection() {
  const [items,     setItems]     = useState([]);
  const [operators, setOperators] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState(null);
  const [form,      setForm]      = useState({});
  const [saving,    setSaving]    = useState(false);

  function load() {
    setLoading(true);
    Promise.all([
      api.get('/admin/cms/featured'),
      api.get('/admin/operators'),
    ]).then(([fRes, oRes]) => {
      setItems(fRes.data.data || []);
      setOperators(oRes.data.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(load, []);

  const operatorName = id => operators.find(o => o.id === id)?.name || '—';

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        operator_id: form.operator_id,
        position:    Number(form.position) || 1,
        is_active:   form.is_active ?? true,
      };
      if (modal === 'create') {
        const { data } = await api.post('/admin/cms/featured', payload);
        setItems(prev => [data.data, ...prev]);
      } else {
        const { data } = await api.put(`/admin/cms/featured/${modal.id}`, payload);
        setItems(prev => prev.map(i => i.id === modal.id ? data.data : i));
      }
      setModal(null); setForm({});
    } catch {} finally { setSaving(false); }
  }

  async function handleDelete(item) {
    if (!window.confirm(`Remover "${operatorName(item.operator_id)}" dos destaques?`)) return;
    try {
      await api.delete(`/admin/cms/featured/${item.id}`);
      setItems(prev => prev.filter(i => i.id !== item.id));
    } catch {}
  }

  const sorted = [...items].sort((a, b) => (a.position || 0) - (b.position || 0));

  return (
    <>
      <div className="flex justify-between items-center mb-3">
        <p className="text-xs font-body text-n-400">{items.length} operador(es) em destaque</p>
        <Button icon={Plus} size="sm" onClick={() => { setForm({ position: items.length + 1, is_active: true }); setModal('create'); }}>
          Adicionar destaque
        </Button>
      </div>

      <Card padding="p-0">
        {loading ? (
          <p className="text-xs font-body text-n-400 px-5 py-6 text-center">A carregar…</p>
        ) : sorted.length === 0 ? (
          <p className="text-xs font-body text-n-400 px-5 py-6 text-center">Nenhum operador em destaque.</p>
        ) : (
          <div className="divide-y divide-n-100">
            {sorted.map(i => (
              <div key={i.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-7 h-7 rounded-full bg-ocean-50 text-ocean-700 text-xs font-display font-bold flex items-center justify-center shrink-0">
                    {i.position}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-n-900 truncate">{operatorName(i.operator_id)}</p>
                    <p className="text-xs text-n-400">Ordem de aparição: {i.position}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={i.is_active ? 'confirmed' : 'cancelled'}>{i.is_active ? 'Activo' : 'Inactivo'}</Badge>
                  <Button variant="ghost" size="sm" icon={Pencil} onClick={() => { setForm(i); setModal(i); }} aria-label="Editar" />
                  <Button
                    variant="ghost" size="sm" icon={Trash2}
                    onClick={() => handleDelete(i)}
                    className="hover:text-[var(--error)] hover:bg-[var(--error-light)]"
                    aria-label="Remover"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={!!modal}
        onClose={() => { setModal(null); setForm({}); }}
        title={modal === 'create' ? 'Adicionar operador em destaque' : 'Editar destaque'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setModal(null); setForm({}); }}>Cancelar</Button>
            <Button loading={saving} onClick={handleSave} disabled={!form.operator_id}>Guardar</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Select label="Operador" value={form.operator_id || ''} onChange={e => setForm(f => ({ ...f, operator_id: e.target.value }))}>
            <option value="">— seleccionar operador —</option>
            {operators.map(o => (
              <option key={o.id} value={o.id}>{o.name} ({TYPE_LABELS[o.operator_type] || o.operator_type})</option>
            ))}
          </Select>
          <Input label="Ordem de aparição" type="number" min="1" value={form.position ?? ''} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} />
          <Select label="Activo" value={String(form.is_active ?? true)} onChange={e => setForm(f => ({ ...f, is_active: e.target.value === 'true' }))}>
            <option value="true">Sim</option>
            <option value="false">Não</option>
          </Select>
        </div>
      </Modal>
    </>
  );
}

/* ════════════════════════════════════════════════════════════
   Preços dos planos — Starter / Business / Pro em EUR e CVE
   ════════════════════════════════════════════════════════════ */
const PLAN_LABELS = { starter: 'Starter', business: 'Business', pro: 'Pro' };

function PricingSection() {
  const [items,      setItems]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [edits,      setEdits]      = useState({});
  const [savingPlan, setSavingPlan] = useState(null);
  const [savedPlan,  setSavedPlan]  = useState(null);

  function load() {
    setLoading(true);
    api.get('/admin/cms/pricing').then(r => setItems(r.data.data || [])).catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(load, []);

  const fieldValue = (plan, key, fallback) => edits[plan]?.[key] ?? fallback ?? '';
  const setFieldValue = (plan, key, value) => {
    setSavedPlan(null);
    setEdits(prev => ({ ...prev, [plan]: { ...prev[plan], [key]: value } }));
  };

  async function handleSave(item) {
    setSavingPlan(item.plan); setSavedPlan(null);
    try {
      const payload = {
        price_eur: Number(fieldValue(item.plan, 'price_eur', item.price_eur)),
        price_cve: Number(fieldValue(item.plan, 'price_cve', item.price_cve)),
      };
      const { data } = await api.put(`/admin/cms/pricing/${item.plan}`, payload);
      setItems(prev => prev.map(i => i.plan === item.plan ? data.data : i));
      setEdits(prev => ({ ...prev, [item.plan]: undefined }));
      setSavedPlan(item.plan);
    } catch {} finally { setSavingPlan(null); }
  }

  if (loading) return <p className="text-xs font-body text-n-400 px-1 py-6">A carregar…</p>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {items.map(item => (
        <Card key={item.plan} header={<h3 className="font-display font-semibold text-sm text-n-700">{PLAN_LABELS[item.plan] || item.plan}</h3>}>
          <div className="space-y-3">
            <Input
              label="Preço (EUR / mês)" type="number" step="0.01" min="0"
              value={fieldValue(item.plan, 'price_eur', item.price_eur)}
              onChange={e => setFieldValue(item.plan, 'price_eur', e.target.value)}
            />
            <Input
              label="Preço (CVE / mês)" type="number" step="0.01" min="0"
              value={fieldValue(item.plan, 'price_cve', item.price_cve)}
              onChange={e => setFieldValue(item.plan, 'price_cve', e.target.value)}
            />
            <div className="flex items-center gap-3">
              <Button size="sm" loading={savingPlan === item.plan} onClick={() => handleSave(item)}>Guardar</Button>
              {savedPlan === item.plan && <span className="text-xs font-body text-[var(--success)]">Guardado.</span>}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   Hero do website — título e subtítulo PT/EN
   ════════════════════════════════════════════════════════════ */
function HeroSection() {
  const [form,   setForm]   = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  useEffect(() => {
    api.get('/admin/cms/hero').then(r => setForm(r.data.data || {})).catch(() => setForm({}));
  }, []);

  const setField = key => e => { setSaved(false); setForm(f => ({ ...f, [key]: e.target.value })); };

  async function handleSave() {
    setSaving(true); setSaved(false);
    try {
      const { data } = await api.put('/admin/cms/hero', form);
      setForm(data.data);
      setSaved(true);
    } catch {} finally { setSaving(false); }
  }

  if (!form) return <p className="text-xs font-body text-n-400 px-1 py-6">A carregar…</p>;

  return (
    <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Textos do hero (página inicial)</h3>}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="Título (PT)" value={form.hero_title_pt || ''} onChange={setField('hero_title_pt')} />
        <Input label="Título (EN)" value={form.hero_title_en || ''} onChange={setField('hero_title_en')} />
        <Textarea label="Subtítulo (PT)" rows={2} value={form.hero_subtitle_pt || ''} onChange={setField('hero_subtitle_pt')} />
        <Textarea label="Subtítulo (EN)" rows={2} value={form.hero_subtitle_en || ''} onChange={setField('hero_subtitle_en')} />
      </div>
      <div className="flex items-center gap-3 mt-4">
        <Button loading={saving} onClick={handleSave}>Guardar alterações</Button>
        {saved && <span className="text-xs font-body text-[var(--success)]">Guardado.</span>}
      </div>
    </Card>
  );
}

/* ════════════════════════════════════════════════════════════
   Templates de email — lista, editor, preview, envio de teste
   ════════════════════════════════════════════════════════════ */
const TEMPLATE_LABELS = {
  confirmacao_reserva: 'Confirmação de reserva',
  boas_vindas:         'Boas-vindas',
  trial_a_expirar:     'Trial a expirar',
  reset_password:      'Reset de password',
};

const PREVIEW_VARS = {
  nome: 'Maria Silva', tour: 'Passeio de barco ao pôr-do-sol',
  data: '2026-07-12', dias: '5',
  link: 'https://app.saldesk.cv/reset-password?token=exemplo',
};

function renderPreview(text) {
  if (!text) return '';
  return text.replace(/\{(\w+)\}/g, (m, key) => PREVIEW_VARS[key] ?? m);
}

function EmailTemplatesSection() {
  const [items,    setItems]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null);
  const [form,     setForm]     = useState(null);
  const [lang,     setLang]     = useState('pt');
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [testTo,   setTestTo]   = useState('');
  const [sending,  setSending]  = useState(false);
  const [sentMsg,  setSentMsg]  = useState('');

  useEffect(() => {
    setLoading(true);
    api.get('/admin/cms/email-templates').then(r => {
      const rows = r.data.data || [];
      setItems(rows);
      if (rows.length) selectTemplate(rows[0]);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  function selectTemplate(tpl) {
    setSelected(tpl);
    setForm({ subject_pt: tpl.subject_pt || '', subject_en: tpl.subject_en || '', body_pt: tpl.body_pt || '', body_en: tpl.body_en || '' });
    setSaved(false); setSentMsg('');
  }

  const setField = key => e => { setSaved(false); setForm(f => ({ ...f, [key]: e.target.value })); };

  async function handleSave() {
    if (!selected) return;
    setSaving(true); setSaved(false);
    try {
      const { data } = await api.put(`/admin/cms/email-templates/${selected.id}`, form);
      setItems(prev => prev.map(i => i.id === selected.id ? data.data : i));
      setSelected(data.data);
      setSaved(true);
    } catch {} finally { setSaving(false); }
  }

  async function handleSendTest() {
    if (!selected) return;
    setSending(true); setSentMsg('');
    try {
      await api.post(`/admin/cms/email-templates/${selected.id}/test`, { to: testTo || undefined, lang });
      setSentMsg('Email de teste enviado.');
    } catch {
      setSentMsg('Não foi possível enviar o email de teste.');
    } finally { setSending(false); }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card padding="p-0" className="lg:col-span-1">
        {loading ? (
          <p className="text-xs font-body text-n-400 px-5 py-6 text-center">A carregar…</p>
        ) : (
          <div className="divide-y divide-n-100">
            {items.map(tpl => (
              <button
                key={tpl.id}
                onClick={() => selectTemplate(tpl)}
                className={`w-full text-left px-5 py-3 transition-colors ${selected?.id === tpl.id ? 'bg-ocean-50' : 'hover:bg-n-50'}`}
              >
                <p className={`font-semibold text-sm ${selected?.id === tpl.id ? 'text-ocean-700' : 'text-n-900'}`}>
                  {TEMPLATE_LABELS[tpl.type] || tpl.type}
                </p>
                <p className="text-xs text-n-400 truncate mt-0.5">{tpl.subject_pt}</p>
              </button>
            ))}
          </div>
        )}
      </Card>

      <div className="lg:col-span-2 space-y-4">
        {!selected || !form ? (
          <Card><p className="text-xs font-body text-n-400 text-center py-6">Seleccione um template para editar.</p></Card>
        ) : (
          <>
            <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Editar — {TEMPLATE_LABELS[selected.type] || selected.type}</h3>}>
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input label="Assunto (PT)" value={form.subject_pt} onChange={setField('subject_pt')} />
                  <Input label="Assunto (EN)" value={form.subject_en} onChange={setField('subject_en')} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Textarea label="Corpo (PT)" rows={6} value={form.body_pt} onChange={setField('body_pt')} />
                  <Textarea label="Corpo (EN)" rows={6} value={form.body_en} onChange={setField('body_en')} />
                </div>
                <p className="text-xs font-body text-n-400">
                  Variáveis disponíveis: {'{nome}'}, {'{tour}'}, {'{data}'}, {'{dias}'}, {'{link}'}
                </p>
                <div className="flex items-center gap-3">
                  <Button loading={saving} onClick={handleSave}>Guardar template</Button>
                  {saved && <span className="text-xs font-body text-[var(--success)]">Guardado.</span>}
                </div>
              </div>
            </Card>

            <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Pré-visualização</h3>}>
              <div className="flex gap-0.5 mb-3 bg-n-100 p-0.5 rounded-sm w-fit">
                {['pt', 'en'].map(l => (
                  <button
                    key={l}
                    onClick={() => setLang(l)}
                    className={`px-3 py-1 rounded-sm text-xs font-body font-medium transition-colors ${lang === l ? 'bg-white text-ocean-700 shadow-sm' : 'text-n-500 hover:text-n-700'}`}
                  >
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
              <div className="border border-n-200 rounded-sm p-4 bg-n-50">
                <p className="text-xs font-body text-n-400 mb-1">Assunto</p>
                <p className="font-semibold text-sm text-n-900 mb-3">{renderPreview(lang === 'en' ? form.subject_en : form.subject_pt)}</p>
                <p className="text-xs font-body text-n-400 mb-1">Corpo</p>
                <p className="text-sm text-n-700 whitespace-pre-wrap font-body">{renderPreview(lang === 'en' ? form.body_en : form.body_pt)}</p>
              </div>

              <div className="flex flex-wrap items-center gap-3 mt-4">
                <Input
                  placeholder="email@destino.cv (opcional — usa o seu por defeito)"
                  value={testTo} onChange={e => setTestTo(e.target.value)} className="w-72"
                />
                <Button variant="secondary" loading={sending} onClick={handleSendTest}>Enviar email de teste</Button>
                {sentMsg && <span className="text-xs font-body text-n-500">{sentMsg}</span>}
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   Configurações globais — lançamento, acesso, manutenção, redes
   ════════════════════════════════════════════════════════════ */
function SettingsSection() {
  const [form,   setForm]   = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  useEffect(() => {
    api.get('/admin/cms/settings').then(r => setForm(r.data.data || {})).catch(() => setForm({}));
  }, []);

  const setField = key => e => { setSaved(false); setForm(f => ({ ...f, [key]: e.target.value })); };

  async function handleSave() {
    setSaving(true); setSaved(false);
    try {
      const { data } = await api.put('/admin/cms/settings', form);
      setForm(data.data);
      setSaved(true);
    } catch {} finally { setSaving(false); }
  }

  if (!form) return <p className="text-xs font-body text-n-400 px-1 py-6">A carregar…</p>;

  return (
    <div className="space-y-4">
      <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Lançamento e acesso</h3>}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input label="Data de lançamento" type="date" value={form.launch_date || ''} onChange={setField('launch_date')} />
          <Select label="Modo coming soon" value={form.coming_soon_mode || 'false'} onChange={setField('coming_soon_mode')}>
            <option value="false">Desactivado</option>
            <option value="true">Activado</option>
          </Select>
          <Select label="Registo por convite" value={form.invite_only || 'false'} onChange={setField('invite_only')}>
            <option value="false">Desactivado</option>
            <option value="true">Activado</option>
          </Select>
        </div>
      </Card>

      <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Manutenção</h3>}>
        <Textarea
          label="Mensagem de manutenção" rows={3}
          value={form.maintenance_message || ''} onChange={setField('maintenance_message')}
          hint="Mostrada aos visitantes quando o site está em modo de manutenção."
        />
      </Card>

      <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Redes sociais</h3>}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input label="Instagram" value={form.social_instagram || ''} onChange={setField('social_instagram')} placeholder="https://instagram.com/saldesk" />
          <Input label="Facebook"  value={form.social_facebook  || ''} onChange={setField('social_facebook')}  placeholder="https://facebook.com/saldesk" />
          <Input label="LinkedIn"  value={form.social_linkedin  || ''} onChange={setField('social_linkedin')}  placeholder="https://linkedin.com/company/saldesk" />
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button loading={saving} onClick={handleSave}>Guardar configurações</Button>
        {saved && <span className="text-xs font-body text-[var(--success)]">Guardado.</span>}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   Navegação por separadores
   ════════════════════════════════════════════════════════════ */
const MAIN_TABS = [
  { key: 'website',  label: 'Website' },
  { key: 'connect',  label: 'SalDesk Connect' },
  { key: 'emails',   label: 'Emails' },
  { key: 'settings', label: 'Configurações' },
];

const WEBSITE_SUBTABS = [
  { key: 'testimonials', label: 'Testemunhos' },
  { key: 'faqs',         label: 'FAQs' },
  { key: 'pricing',      label: 'Preços' },
  { key: 'hero',         label: 'Hero' },
];

const CONNECT_SUBTABS = [
  { key: 'featured',    label: 'Destaques' },
  { key: 'banners',     label: 'Banners' },
  { key: 'experiences', label: 'Experiências' },
  { key: 'events',      label: 'Eventos' },
  { key: 'landmarks',   label: 'Pontos turísticos' },
];

function TabBar({ tabs, active, onChange }) {
  return (
    <div className="flex gap-0.5 mb-4 bg-n-100 p-0.5 rounded-sm w-fit flex-wrap">
      {tabs.map(t => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`px-3.5 py-1.5 rounded-sm text-xs font-body font-medium transition-colors ${
            active === t.key ? 'bg-white text-ocean-700 shadow-sm' : 'text-n-500 hover:text-n-700'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export default function AdminCms() {
  const [tab,        setTab]        = useState('website');
  const [websiteSub, setWebsiteSub] = useState('testimonials');
  const [connectSub, setConnectSub] = useState('featured');

  return (
    <div>
      <PageHeader title="CMS" subtitle="Gestão de conteúdo do website institucional e do SalDesk Connect" />

      <TabBar tabs={MAIN_TABS} active={tab} onChange={setTab} />

      {tab === 'website' && (
        <>
          <TabBar tabs={WEBSITE_SUBTABS} active={websiteSub} onChange={setWebsiteSub} />
          {websiteSub === 'testimonials' && <CmsSection key="testimonials" type="testimonials" />}
          {websiteSub === 'faqs'         && <CmsSection key="faqs" type="faqs" />}
          {websiteSub === 'pricing'      && <PricingSection />}
          {websiteSub === 'hero'         && <HeroSection />}
        </>
      )}

      {tab === 'connect' && (
        <>
          <TabBar tabs={CONNECT_SUBTABS} active={connectSub} onChange={setConnectSub} />
          {connectSub === 'featured'    && <FeaturedSection />}
          {connectSub === 'banners'     && <CmsSection key="banners" type="banners" />}
          {connectSub === 'experiences' && <CmsSection key="experiences" type="experiences" />}
          {connectSub === 'events'      && <CmsSection key="events" type="events" />}
          {connectSub === 'landmarks'   && <CmsSection key="landmarks" type="landmarks" />}
        </>
      )}

      {tab === 'emails'   && <EmailTemplatesSection />}
      {tab === 'settings' && <SettingsSection />}
    </div>
  );
}
