import { useState, useEffect, useMemo } from 'react';
import {
  Plus, Pencil, Trash2, Star, ChefHat, X,
  QrCode, Link, CheckCircle, Copy,
} from 'lucide-react';
import { listUnits, createUnit, updateUnit, deleteUnit, updateConectStatus } from '../services/unitsService';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import Input, { Textarea, Select } from '../components/ui/Input';
import ImageUploader from '../components/shared/ImageUploader';
import ConectRow from '../components/shared/ConectRow';
import FilterChips from '../components/ui/FilterChips';
import EmptyState from '../components/ui/EmptyState';
import Badge from '../components/ui/Badge';
import { IconBtn, EDIT_HOVER, DELETE_HOVER, TOGGLE_HOVER_ACTIVE, TOGGLE_HOVER_INACTIVE } from '../components/shared/IconBtn';
import { useT } from '../i18n';
import { mensagemErro } from '../utils/mensagemErro';
import { eurosDuasCasas } from '../utils/formatoEuros';

/* Os valores gravados sao as chaves; o rotulo vem de menuDigital.<grupo>.<chave> */
const CATEGORIES = [
  { key: 'entradas' }, { key: 'pratos_principais' }, { key: 'sobremesas' }, { key: 'bebidas' }, { key: 'outros' },
];

const ALLERGENS = [
  { key: 'gluten' }, { key: 'lactose' }, { key: 'frutos_secos' }, { key: 'marisco' },
  { key: 'ovos' }, { key: 'soja' }, { key: 'peixe' }, { key: 'amendoim' },
];

const DIETS = [
  { key: 'vegetariano' }, { key: 'vegan' }, { key: 'sem_gluten' }, { key: 'halal' },
];

/* key = getDay() (0 = domingo); l = chave do rotulo em menuDigital.weekdays */
const WEEKDAYS = [
  { key: '1', l: 'mon' }, { key: '2', l: 'tue' }, { key: '3', l: 'wed' }, { key: '4', l: 'thu' },
  { key: '5', l: 'fri' }, { key: '6', l: 'sat' }, { key: '0', l: 'sun' },
];

/* Rotulo de uma categoria, alergenio ou dieta gravados; um valor desconhecido mostra-se tal e qual */
function rotuloGrupo(grupo, lista, key, t) {
  return lista.some(x => x.key === key) ? t(`menuDigital.${grupo}.${key}`) : key;
}

function parseDishMeta(unit) {
  try { return JSON.parse(unit?.description || '{}'); } catch { return {}; }
}

function buildDishPayload(form) {
  const meta = {
    name_en:       form.name_en      || null,
    desc_pt:       form.desc_pt      || null,
    desc_en:       form.desc_en      || null,
    category:      form.category,
    allergens:     form.allergens,
    diets:         form.diets,
    featured:      form.featured,
    daily_special: form.daily_special,
  };
  return {
    name:        form.name_pt || 'Sem nome',
    description: JSON.stringify(meta),
    unit_type:   'menu_item',
    base_price:  Number(form.price) || 0,
    price_unit:  'person',
    capacity:    1,
    is_active:   form.available,
    status:      form.available ? 'active' : 'inactive',
    images:      form.images,
  };
}

function DishForm({ dish, onSave, onCancel, loading, error }) {
  const t = useT();
  const meta = parseDishMeta(dish);

  const [form, setForm] = useState({
    name_pt:      dish?.name          || '',
    name_en:      meta.name_en         || '',
    desc_pt:      meta.desc_pt         || '',
    desc_en:      meta.desc_en         || '',
    category:     meta.category        || 'pratos_principais',
    price:        dish?.base_price != null ? String(dish.base_price) : '',
    allergens:    meta.allergens        || [],
    diets:        meta.diets            || [],
    featured:     meta.featured         ?? false,
    available:    dish ? (dish.status !== 'inactive') : true,
    daily_special:meta.daily_special    || {},
    images:       dish?.images          || [],
  });

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  function toggle(field, key) {
    setForm(f => ({
      ...f,
      [field]: f[field].includes(key)
        ? f[field].filter(x => x !== key)
        : [...f[field], key],
    }));
  }

  function toggleDay(day) {
    setForm(f => ({
      ...f,
      daily_special: { ...f.daily_special, [day]: !f.daily_special[day] },
    }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSave(buildDishPayload(form));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* Nome */}
      <div className="grid grid-cols-2 gap-3">
        <Input label={t('menuDigital.namePt')} value={form.name_pt} onChange={set('name_pt')} required autoFocus placeholder={t('menuDigital.namePtPlaceholder')} />
        <Input label={t('menuDigital.nameEn')} value={form.name_en} onChange={set('name_en')} placeholder={t('menuDigital.nameEnPlaceholder')} />
      </div>

      {/* Descricao */}
      <div className="grid grid-cols-2 gap-3">
        <Textarea label={t('menuDigital.descPt')} value={form.desc_pt} onChange={set('desc_pt')} rows={2} placeholder={t('menuDigital.descPtPlaceholder')} />
        <Textarea label={t('menuDigital.descEn')} value={form.desc_en} onChange={set('desc_en')} rows={2} placeholder={t('menuDigital.descEnPlaceholder')} />
      </div>

      {/* Categoria + preco */}
      <div className="grid grid-cols-2 gap-3">
        <Select label={t('menuDigital.category')} value={form.category} onChange={set('category')} required>
          {CATEGORIES.map(c => <option key={c.key} value={c.key}>{t(`menuDigital.categories.${c.key}`)}</option>)}
        </Select>
        <Input label={t('menuDigital.price')} type="number" value={form.price} onChange={set('price')} min="0" step="0.01" required placeholder="0.00" />
      </div>

      {/* Foto */}
      <div>
        <p className="text-xs font-body font-bold uppercase tracking-wide text-ocean-700 border-b border-n-100 pb-1 mb-2">{t('menuDigital.photo')}</p>
        <ImageUploader value={form.images} onChange={urls => setForm(f => ({ ...f, images: urls }))} maxImages={1} hint={t('menuDigital.photoHint')} />
      </div>

      {/* Alérgenos */}
      <div>
        <p className="text-xs font-body font-bold uppercase tracking-wide text-ocean-700 border-b border-n-100 pb-1 mb-2">{t('menuDigital.allergensTitle')}</p>
        <div className="flex flex-wrap gap-2">
          {ALLERGENS.map(a => (
            <label key={a.key} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm border text-xs font-body font-medium cursor-pointer transition-colors select-none ${
              form.allergens.includes(a.key) ? 'bg-[var(--error-light)] border-n-300 text-[var(--error)]' : 'bg-n-50 border-n-300 text-n-600 hover:border-n-400'
            }`}>
              <input type="checkbox" className="sr-only" checked={form.allergens.includes(a.key)} onChange={() => toggle('allergens', a.key)} />
              {t(`menuDigital.allergens.${a.key}`)}
            </label>
          ))}
        </div>
      </div>

      {/* Dietas */}
      <div>
        <p className="text-xs font-body font-bold uppercase tracking-wide text-ocean-700 border-b border-n-100 pb-1 mb-2">{t('menuDigital.dietsTitle')}</p>
        <div className="flex flex-wrap gap-2">
          {DIETS.map(d => (
            <label key={d.key} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm border text-xs font-body font-medium cursor-pointer transition-colors select-none ${
              form.diets.includes(d.key) ? 'bg-[var(--success-light)] border-n-300 text-[var(--success)]' : 'bg-n-50 border-n-300 text-n-600 hover:border-n-400'
            }`}>
              <input type="checkbox" className="sr-only" checked={form.diets.includes(d.key)} onChange={() => toggle('diets', d.key)} />
              {t(`menuDigital.diets.${d.key}`)}
            </label>
          ))}
        </div>
      </div>

      {/* Opcoes */}
      <div>
        <p className="text-xs font-body font-bold uppercase tracking-wide text-ocean-700 border-b border-n-100 pb-1 mb-2">{t('menuDigital.optionsTitle')}</p>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.available} onChange={e => setForm(f => ({ ...f, available: e.target.checked }))} className="w-4 h-4 accent-ocean-700" />
            <span className="text-sm font-body text-n-700">{t('menuDigital.available')}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.featured} onChange={e => setForm(f => ({ ...f, featured: e.target.checked }))} className="w-4 h-4 accent-ocean-700" />
            <span className="text-sm font-body text-n-700">{t('menuDigital.featured')}</span>
          </label>
        </div>
      </div>

      {/* Prato do dia */}
      <div>
        <p className="text-xs font-body font-bold uppercase tracking-wide text-ocean-700 border-b border-n-100 pb-1 mb-2">{t('menuDigital.dailySpecial')}</p>
        <div className="flex gap-2 flex-wrap">
          {WEEKDAYS.map(d => (
            <label key={d.key} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm border text-xs font-mono font-medium cursor-pointer transition-colors select-none ${
              form.daily_special[d.key] ? 'bg-ocean-700 border-ocean-700 text-white' : 'bg-n-50 border-n-300 text-n-600 hover:border-ocean-400'
            }`}>
              <input type="checkbox" className="sr-only" checked={!!form.daily_special[d.key]} onChange={() => toggleDay(d.key)} />
              {t(`menuDigital.weekdays.${d.l}`)}
            </label>
          ))}
        </div>
      </div>

      {error && <p className="text-sm font-body px-3 py-2 rounded-sm bg-[var(--error-light)] text-[var(--error)]">{error}</p>}

      <div className="flex gap-3 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">{t('menuDigital.cancel')}</Button>
        <Button type="submit" loading={loading} className="flex-1">
          {dish ? t('menuDigital.saveChanges') : t('menuDigital.addDish')}
        </Button>
      </div>
    </form>
  );
}

function TastingMenuForm({ menu, onSave, onCancel, loading }) {
  const t = useT();
  const meta = menu ? parseDishMeta(menu) : {};
  const [form, setForm] = useState({
    name:       menu?.name        || '',
    price:      menu?.base_price  != null ? String(menu.base_price) : '',
    desc_pt:    meta.desc_pt      || '',
    desc_en:    meta.desc_en      || '',
    items:      meta.items        || [{ name_pt: '', price: '' }],
    available:  menu ? menu.status !== 'inactive' : true,
  });

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  function setItem(i, k, v) {
    setForm(f => {
      const items = [...f.items];
      items[i] = { ...items[i], [k]: v };
      return { ...f, items };
    });
  }
  function addItem()     { setForm(f => ({ ...f, items: [...f.items, { name_pt: '', price: '' }] })); }
  function removeItem(i) { setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) })); }

  function handleSubmit(e) {
    e.preventDefault();
    const meta2 = {
      desc_pt:  form.desc_pt  || null,
      desc_en:  form.desc_en  || null,
      items:    form.items.filter(it => it.name_pt),
    };
    onSave({
      name:        form.name || 'Menu Degustação',
      description: JSON.stringify(meta2),
      unit_type:   'tasting_menu',
      base_price:  Number(form.price) || 0,
      price_unit:  'person',
      capacity:    1,
      status:      form.available ? 'active' : 'inactive',
      images:      menu?.images || [],
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Input label={t('menuDigital.menuName')} value={form.name} onChange={set('name')} required placeholder={t('menuDigital.menuNamePlaceholder')} autoFocus />
        <Input label={t('menuDigital.pricePerPerson')} type="number" value={form.price} onChange={set('price')} min="0" step="0.01" required placeholder="0.00" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Textarea label={t('menuDigital.descPt')} value={form.desc_pt} onChange={set('desc_pt')} rows={2} />
        <Textarea label={t('menuDigital.descEn')} value={form.desc_en} onChange={set('desc_en')} rows={2} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-body font-bold uppercase tracking-wide text-ocean-700">{t('menuDigital.includedDishes')}</p>
          <button type="button" onClick={addItem} className="text-xs font-body text-ocean-700 hover:underline flex items-center gap-1">
            <Plus size={11} strokeWidth={2} /> {t('menuDigital.add')}
          </button>
        </div>
        <div className="space-y-2">
          {form.items.map((item, i) => (
            <div key={i} className="flex gap-2 items-center">
              <div className="flex-1">
                <Input type="text" value={item.name_pt} onChange={e => setItem(i, 'name_pt', e.target.value)} placeholder={t('menuDigital.dishNamePlaceholder')} />
              </div>
              <button type="button" onClick={() => removeItem(i)} className="p-1 text-n-400 hover:text-error">
                <X size={14} strokeWidth={1.75} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={form.available} onChange={e => setForm(f => ({ ...f, available: e.target.checked }))} className="w-4 h-4 accent-ocean-700" />
        <span className="text-sm font-body text-n-700">{t('menuDigital.menuAvailable')}</span>
      </label>

      <div className="flex gap-3 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">{t('menuDigital.cancel')}</Button>
        <Button type="submit" loading={loading} className="flex-1">{menu ? t('menuDigital.save') : t('menuDigital.createMenu')}</Button>
      </div>
    </form>
  );
}

function DishCard({ dish, onEdit, onDelete, onToggleAvailable, onSubmitConect }) {
  const t = useT();
  const meta     = parseDishMeta(dish);
  const photo    = dish.images?.[0];
  const catLabel = rotuloGrupo('categories', CATEGORIES, meta.category, t) || '';
  const available = dish.status !== 'inactive';
  const today    = String(new Date().getDay()); // 0=Sun
  const isToday  = !!meta.daily_special?.[today];

  return (
    <div className={`rounded-[18px] border border-mare-card bg-white overflow-hidden flex flex-col ${!available ? 'opacity-60' : ''}`}>
      {photo ? (
        <div className="w-full aspect-video bg-mare-head overflow-hidden">
          <img src={photo} alt={dish.name} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="w-full aspect-video bg-mare-head flex items-center justify-center">
          <ChefHat size={28} strokeWidth={1.25} className="text-n-300" />
        </div>
      )}
      <div className="p-3 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="font-display font-semibold text-sm text-n-900 truncate">{dish.name}</p>
          {meta.featured && <Star size={12} strokeWidth={1.75} className="text-sand-500 shrink-0 mt-0.5 fill-sand-400" />}
        </div>
        <p className="text-xs font-body text-n-500 truncate mb-2">{catLabel}</p>

        {/* Tags */}
        {(meta.allergens?.length > 0 || meta.diets?.length > 0) && (
          <div className="flex flex-wrap gap-1 mb-2">
            {meta.diets?.slice(0, 2).map(d => (
              <span key={d} className="text-[9px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded bg-[var(--success-light)] text-[var(--success)]">
                {rotuloGrupo('diets', DIETS, d, t)}
              </span>
            ))}
            {meta.allergens?.slice(0, 2).map(a => (
              <span key={a} className="text-[9px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded bg-[var(--error-light)] text-[var(--error)]">
                {rotuloGrupo('allergens', ALLERGENS, a, t)}
              </span>
            ))}
          </div>
        )}

        {isToday && (
          <span className="text-[9px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded bg-ocean-50 text-ocean-700 mb-2 w-fit">
            {t('menuDigital.dailySpecial')}
          </span>
        )}

        <div className="flex flex-wrap items-center justify-between gap-1 mt-auto">
          <span className="font-mono tabular-nums font-bold text-sm text-ocean-700">{eurosDuasCasas(dish.base_price || 0)}</span>
          <div className="flex items-center gap-1" title={available ? t('menuDigital.availableHint') : t('menuDigital.unavailableHint')}>
            <IconBtn icon={CheckCircle} label={t('menuDigital.toggleAvailability')} hover={available ? TOGGLE_HOVER_ACTIVE : TOGGLE_HOVER_INACTIVE} onClick={() => onToggleAvailable(dish)} />
            <IconBtn icon={Pencil} label={t('menuDigital.edit')} hover={EDIT_HOVER} onClick={() => onEdit(dish)} />
            <IconBtn icon={Trash2} label={t('menuDigital.delete')} hover={DELETE_HOVER} onClick={() => onDelete(dish)} />
          </div>
        </div>
        <ConectRow unit={dish} onSubmitConect={onSubmitConect} />
      </div>
    </div>
  );
}

export default function MenuDigital() {
  const t = useT();
  const { operator } = useAuthStore();
  const slug         = operator?.slug;

  const [units,       setUnits]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [modal,       setModal]       = useState(null); // 'create'|unit|'tasting_create'|tasting_unit
  const [modalType,   setModalType]   = useState('dish'); // 'dish'|'tasting'
  const [formLoading, setFormLoading] = useState(false);
  const [formError,   setFormError]   = useState('');
  const [deleteTarget,setDeleteTarget]= useState(null);
  const [activeTab,   setActiveTab]   = useState('all');
  const [copied,      setCopied]      = useState(false);

  async function carregar() {
    try {
      const data = await listUnits();
      setUnits(data.filter(u => u.unit_type === 'menu_item' || u.unit_type === 'tasting_menu') || []);
    } catch {}
    finally { setLoading(false); }
  }
  useEffect(() => { carregar(); }, []);

  const dishes  = units.filter(u => u.unit_type === 'menu_item');
  const tastings = units.filter(u => u.unit_type === 'tasting_menu');

  const filtered = useMemo(() => {
    if (activeTab === 'all') return dishes;
    return dishes.filter(u => {
      const meta = parseDishMeta(u);
      return meta.category === activeTab;
    });
  }, [dishes, activeTab]);

  async function handleSave(dados) {
    setFormError(''); setFormLoading(true);
    try {
      if (modal === 'create' || modal === 'tasting_create') {
        const u = await createUnit(dados);
        setUnits(prev => [u, ...prev]);
      } else {
        const u = await updateUnit(modal.id, dados);
        setUnits(prev => prev.map(x => x.id === u.id ? u : x));
      }
      setModal(null);
    } catch (err) { setFormError(mensagemErro(err, t, t('menuDigital.saveError'))); }
    finally { setFormLoading(false); }
  }

  async function handleSubmitConect(unit) {
    const next = ['published', 'paused'].includes(unit.conect_status) ? 'draft' : 'pending_review';
    try {
      const updated = await updateConectStatus(unit.id, next);
      setUnits(prev => prev.map(u => (u.id === updated.id ? updated : u)));
    } catch (err) { console.error(err); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteUnit(deleteTarget.id);
      setUnits(prev => prev.filter(u => u.id !== deleteTarget.id));
    } catch {}
    finally { setDeleteTarget(null); }
  }

  async function handleToggleAvailable(dish) {
    const nextStatus = dish.status === 'inactive' ? 'active' : 'inactive';
    try {
      const u = await updateUnit(dish.id, { status: nextStatus, is_active: nextStatus === 'active' });
      setUnits(prev => prev.map(x => x.id === u.id ? u : x));
    } catch {}
  }

  function copyMenuUrl() {
    if (!slug) return;
    navigator.clipboard.writeText(`https://saldesk.cv/book/${slug}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function downloadQrCode() {
    try {
      const { data } = await api.get('/marketing/qrcode', { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'qrcode-menu.png';
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  }

  const menuUrl = slug ? `https://saldesk.cv/book/${slug}` : null;

  return (
    <div>
      <PageHeader
        eyebrow={t('nav.sections.operacao')}
        title={t('menuDigital.title')}
        subtitle={t('menuDigital.subtitle', { dishes: dishes.length, menus: tastings.length })}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={ChefHat} onClick={() => { setModalType('tasting'); setModal('tasting_create'); }}>
              {t('menuDigital.tastingMenuButton')}
            </Button>
            <Button icon={Plus} onClick={() => { setModalType('dish'); setModal('create'); }}>
              {t('menuDigital.newDish')}
            </Button>
          </div>
        }
      />

      {/* Category tabs */}
      <div className="mb-6">
        <FilterChips
          options={[
            { value: 'all', label: t('menuDigital.all', { n: dishes.length }) },
            ...CATEGORIES.map(c => ({
              value: c.key,
              label: t('menuDigital.categoryCount', {
                label: t(`menuDigital.categories.${c.key}`),
                n: dishes.filter(u => parseDishMeta(u).category === c.key).length,
              }),
            })),
          ]}
          value={activeTab}
          onChange={setActiveTab}
        />
      </div>

      {/* Dishes grid */}
      {loading ? (
        <div className="flex justify-center py-20"><LoadingSpinner size={32} /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[18px] border border-mare-card bg-white mb-8">
          <EmptyState
            icon={ChefHat}
            title={t('menuDigital.emptyCategory')}
            action={<Button icon={Plus} onClick={() => { setModalType('dish'); setModal('create'); }}>{t('menuDigital.addDish')}</Button>}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-8">
          {filtered.map(dish => (
            <DishCard
              key={dish.id}
              dish={dish}
              onEdit={d => { setModalType('dish'); setModal(d); }}
              onDelete={setDeleteTarget}
              onToggleAvailable={handleToggleAvailable}
              onSubmitConect={handleSubmitConect}
            />
          ))}
        </div>
      )}

      {/* Menus Degustacao */}
      {tastings.length > 0 && (
        <div className="rounded-[18px] border border-mare-card bg-white overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-mare-card flex items-center gap-2">
            <Star size={14} strokeWidth={1.75} className="text-sand-500" />
            <h2 className="font-display font-semibold text-sm text-n-700">{t('menuDigital.tastingMenusTitle')}</h2>
          </div>
          <div className="divide-y divide-mare-card">
            {tastings.map(menu => {
              const meta = parseDishMeta(menu);
              const items = meta.items || [];
              return (
                <div key={menu.id} className="px-5 py-4 flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <p className="font-display font-semibold text-sm text-n-900">{menu.name}</p>
                      <span className="font-mono tabular-nums font-bold text-sm text-ocean-700">{eurosDuasCasas(menu.base_price || 0)}</span>
                      {menu.status === 'inactive' && (
                        <Badge variant="default">{t('menuDigital.inactive')}</Badge>
                      )}
                    </div>
                    {meta.desc_pt && <p className="text-xs font-body text-n-500 mt-0.5">{meta.desc_pt}</p>}
                    {items.length > 0 && (
                      <p className="text-xs font-body text-n-400 mt-1">{items.map(i => i.name_pt).join(' · ')}</p>
                    )}
                    <ConectRow unit={menu} onSubmitConect={handleSubmitConect} />
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <IconBtn icon={Pencil} label={t('menuDigital.editMenu')} hover={EDIT_HOVER} onClick={() => { setModalType('tasting'); setModal(menu); }} />
                    <IconBtn icon={Trash2} label={t('menuDigital.deleteMenu')} hover={DELETE_HOVER} onClick={() => setDeleteTarget(menu)} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* QR Code / Link */}
      <div className="rounded-[18px] border border-mare-card bg-white p-5">
        <div className="flex items-center gap-2 mb-4">
          <QrCode size={14} strokeWidth={1.75} className="text-n-500" />
          <h2 className="font-display font-semibold text-sm text-n-700">{t('menuDigital.qrTitle')}</h2>
        </div>
        {menuUrl ? (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-body text-n-500 mb-1.5">{t('menuDigital.shareUrl')}</p>
              <div className="flex items-center gap-2 bg-mare-head border border-mare-card rounded-[14px] px-3 py-2">
                <Link size={12} strokeWidth={1.75} className="text-n-400 shrink-0" />
                <span className="text-xs font-mono text-n-700 truncate flex-1">{menuUrl}</span>
                <IconBtn icon={copied ? CheckCircle : Copy} label={t('menuDigital.copyLink')} hover={EDIT_HOVER} onClick={copyMenuUrl} />
              </div>
            </div>
            <Button icon={QrCode} onClick={downloadQrCode} className="shrink-0">
              {t('menuDigital.downloadQr')}
            </Button>
          </div>
        ) : (
          <p className="text-sm font-body text-n-400">{t('menuDigital.noSlug')}</p>
        )}
      </div>

      {/* Dish modal */}
      <Modal
        open={!!modal && modalType === 'dish'}
        onClose={() => setModal(null)}
        title={modal === 'create' ? t('menuDigital.newDish') : t('menuDigital.editDish')}
        size="lg"
        footer={null}
      >
        {modal && modalType === 'dish' && (
          <DishForm
            dish={modal !== 'create' ? modal : null}
            onSave={handleSave}
            onCancel={() => setModal(null)}
            loading={formLoading}
            error={formError}
          />
        )}
      </Modal>

      {/* Tasting menu modal */}
      <Modal
        open={!!modal && modalType === 'tasting'}
        onClose={() => setModal(null)}
        title={modal === 'tasting_create' ? t('menuDigital.newTastingMenu') : t('menuDigital.editMenuTitle')}
        size="md"
        footer={null}
      >
        {modal && modalType === 'tasting' && (
          <TastingMenuForm
            menu={modal === 'tasting_create' ? null : modal}
            onSave={handleSave}
            onCancel={() => setModal(null)}
            loading={formLoading}
          />
        )}
      </Modal>

      {/* Delete confirm */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={t('menuDigital.confirmDeleteTitle')}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>{t('menuDigital.cancel')}</Button>
            <Button variant="danger" onClick={handleDelete}>{t('menuDigital.delete')}</Button>
          </>
        }
      >
        <p className="text-sm font-body text-n-700">
          {t('menuDigital.deleteBefore')} <strong>{deleteTarget?.name}</strong>{t('menuDigital.deleteAfter')}
        </p>
      </Modal>
    </div>
  );
}
