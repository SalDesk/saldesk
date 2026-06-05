import { useState, useEffect, useMemo } from 'react';
import {
  Plus, Pencil, Trash2, Star, ChefHat, X,
  QrCode, Link, CheckCircle, Image as ImageIcon, Copy,
} from 'lucide-react';
import { listUnits, createUnit, updateUnit, deleteUnit } from '../services/unitsService';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import Input, { Textarea, Select } from '../components/ui/Input';
import ImageUploader from '../components/shared/ImageUploader';

const CATEGORIES = [
  { key: 'entradas',         label: 'Entradas'          },
  { key: 'pratos_principais',label: 'Pratos Principais' },
  { key: 'sobremesas',       label: 'Sobremesas'        },
  { key: 'bebidas',          label: 'Bebidas'           },
  { key: 'outros',           label: 'Outros'            },
];

const ALLERGENS = [
  { key: 'gluten',   label: 'Gluten'       },
  { key: 'lactose',  label: 'Lactose'      },
  { key: 'frutos_secos', label: 'Frutos secos' },
  { key: 'marisco',  label: 'Marisco'      },
  { key: 'ovos',     label: 'Ovos'         },
  { key: 'soja',     label: 'Soja'         },
  { key: 'peixe',    label: 'Peixe'        },
  { key: 'amendoim', label: 'Amendoim'     },
];

const DIETS = [
  { key: 'vegetariano',  label: 'Vegetariano'   },
  { key: 'vegan',        label: 'Vegan'          },
  { key: 'sem_gluten',   label: 'Sem gluten'     },
  { key: 'halal',        label: 'Halal'          },
];

const WEEKDAYS = [
  { key: '1', label: 'Seg' },
  { key: '2', label: 'Ter' },
  { key: '3', label: 'Qua' },
  { key: '4', label: 'Qui' },
  { key: '5', label: 'Sex' },
  { key: '6', label: 'Sab' },
  { key: '0', label: 'Dom' },
];

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
        <Input label="Nome PT" value={form.name_pt} onChange={set('name_pt')} required autoFocus placeholder="Ex: Atum Grelhado" />
        <Input label="Nome EN" value={form.name_en} onChange={set('name_en')} placeholder="Ex: Grilled Tuna" />
      </div>

      {/* Descricao */}
      <div className="grid grid-cols-2 gap-3">
        <Textarea label="Descricao PT" value={form.desc_pt} onChange={set('desc_pt')} rows={2} placeholder="Descricao em portugues..." />
        <Textarea label="Descricao EN" value={form.desc_en} onChange={set('desc_en')} rows={2} placeholder="Description in English..." />
      </div>

      {/* Categoria + preco */}
      <div className="grid grid-cols-2 gap-3">
        <Select label="Categoria" value={form.category} onChange={set('category')} required>
          {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
        </Select>
        <Input label="Preco (€)" type="number" value={form.price} onChange={set('price')} min="0" step="0.01" required placeholder="0.00" />
      </div>

      {/* Foto */}
      <div>
        <p className="text-xs font-body font-bold uppercase tracking-wide text-ocean-700 border-b border-n-100 pb-1 mb-2">Foto</p>
        <ImageUploader value={form.images} onChange={urls => setForm(f => ({ ...f, images: urls }))} maxImages={1} hint="1 foto · 5MB max" />
      </div>

      {/* Alérgenos */}
      <div>
        <p className="text-xs font-body font-bold uppercase tracking-wide text-ocean-700 border-b border-n-100 pb-1 mb-2">Alergenos</p>
        <div className="flex flex-wrap gap-2">
          {ALLERGENS.map(a => (
            <label key={a.key} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm border text-xs font-body font-medium cursor-pointer transition-colors select-none ${
              form.allergens.includes(a.key) ? 'bg-[#FEF2F2] border-[#FCA5A5] text-error' : 'bg-n-50 border-n-300 text-n-600 hover:border-n-400'
            }`}>
              <input type="checkbox" className="sr-only" checked={form.allergens.includes(a.key)} onChange={() => toggle('allergens', a.key)} />
              {a.label}
            </label>
          ))}
        </div>
      </div>

      {/* Dietas */}
      <div>
        <p className="text-xs font-body font-bold uppercase tracking-wide text-ocean-700 border-b border-n-100 pb-1 mb-2">Dietas</p>
        <div className="flex flex-wrap gap-2">
          {DIETS.map(d => (
            <label key={d.key} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm border text-xs font-body font-medium cursor-pointer transition-colors select-none ${
              form.diets.includes(d.key) ? 'bg-[#ECFDF5] border-[#BBF7D0] text-[#1A7A4A]' : 'bg-n-50 border-n-300 text-n-600 hover:border-n-400'
            }`}>
              <input type="checkbox" className="sr-only" checked={form.diets.includes(d.key)} onChange={() => toggle('diets', d.key)} />
              {d.label}
            </label>
          ))}
        </div>
      </div>

      {/* Opcoes */}
      <div>
        <p className="text-xs font-body font-bold uppercase tracking-wide text-ocean-700 border-b border-n-100 pb-1 mb-2">Opcoes</p>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.available} onChange={e => setForm(f => ({ ...f, available: e.target.checked }))} className="w-4 h-4 accent-ocean-700" />
            <span className="text-sm font-body text-n-700">Disponivel</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.featured} onChange={e => setForm(f => ({ ...f, featured: e.target.checked }))} className="w-4 h-4 accent-ocean-700" />
            <span className="text-sm font-body text-n-700">Destaque (landing page)</span>
          </label>
        </div>
      </div>

      {/* Prato do dia */}
      <div>
        <p className="text-xs font-body font-bold uppercase tracking-wide text-ocean-700 border-b border-n-100 pb-1 mb-2">Prato do dia</p>
        <div className="flex gap-2 flex-wrap">
          {WEEKDAYS.map(d => (
            <label key={d.key} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm border text-xs font-mono font-medium cursor-pointer transition-colors select-none ${
              form.daily_special[d.key] ? 'bg-ocean-700 border-ocean-700 text-white' : 'bg-n-50 border-n-300 text-n-600 hover:border-ocean-400'
            }`}>
              <input type="checkbox" className="sr-only" checked={!!form.daily_special[d.key]} onChange={() => toggleDay(d.key)} />
              {d.label}
            </label>
          ))}
        </div>
      </div>

      {error && <p className="text-sm font-body px-3 py-2 rounded-sm bg-[var(--error-light)] text-[var(--error)]">{error}</p>}

      <div className="flex gap-3 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">Cancelar</Button>
        <Button type="submit" loading={loading} className="flex-1">
          {dish ? 'Guardar alteracoes' : 'Adicionar prato'}
        </Button>
      </div>
    </form>
  );
}

function TastingMenuForm({ menu, onSave, onCancel, loading }) {
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
      name:        form.name || 'Menu Degustacao',
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
        <Input label="Nome do menu" value={form.name} onChange={set('name')} required placeholder="Menu Degustacao Chef" autoFocus />
        <Input label="Preco por pessoa (€)" type="number" value={form.price} onChange={set('price')} min="0" step="0.01" required placeholder="0.00" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Textarea label="Descricao PT" value={form.desc_pt} onChange={set('desc_pt')} rows={2} />
        <Textarea label="Descricao EN" value={form.desc_en} onChange={set('desc_en')} rows={2} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-body font-bold uppercase tracking-wide text-ocean-700">Pratos incluidos</p>
          <button type="button" onClick={addItem} className="text-xs font-body text-ocean-700 hover:underline flex items-center gap-1">
            <Plus size={11} strokeWidth={2} /> Adicionar
          </button>
        </div>
        <div className="space-y-2">
          {form.items.map((item, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input type="text" value={item.name_pt} onChange={e => setItem(i, 'name_pt', e.target.value)}
                placeholder="Nome do prato"
                className="flex-1 h-8 rounded-md border border-n-200 bg-n-50 px-3 text-sm font-body text-n-900 focus:outline-none focus:ring-2 focus:ring-ocean-700" />
              <button type="button" onClick={() => removeItem(i)} className="p-1 text-n-400 hover:text-error">
                <X size={14} strokeWidth={1.75} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={form.available} onChange={e => setForm(f => ({ ...f, available: e.target.checked }))} className="w-4 h-4 accent-ocean-700" />
        <span className="text-sm font-body text-n-700">Menu disponivel</span>
      </label>

      <div className="flex gap-3 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">Cancelar</Button>
        <Button type="submit" loading={loading} className="flex-1">{menu ? 'Guardar' : 'Criar menu'}</Button>
      </div>
    </form>
  );
}

function DishCard({ dish, onEdit, onDelete, onToggleAvailable }) {
  const meta     = parseDishMeta(dish);
  const photo    = dish.images?.[0];
  const catLabel = CATEGORIES.find(c => c.key === meta.category)?.label || meta.category || '';
  const available = dish.status !== 'inactive';
  const today    = String(new Date().getDay()); // 0=Sun
  const isToday  = !!meta.daily_special?.[today];

  return (
    <div className={`bg-white rounded-md border border-n-200 shadow-sm overflow-hidden flex flex-col ${!available ? 'opacity-60' : ''}`}>
      {photo ? (
        <div className="w-full aspect-video bg-n-100 overflow-hidden">
          <img src={photo} alt={dish.name} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="w-full aspect-video bg-n-100 flex items-center justify-center">
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
              <span key={d} className="text-[9px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded bg-[#ECFDF5] text-[#1A7A4A]">
                {DIETS.find(x => x.key === d)?.label || d}
              </span>
            ))}
            {meta.allergens?.slice(0, 2).map(a => (
              <span key={a} className="text-[9px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded bg-[#FEF2F2] text-error">
                {ALLERGENS.find(x => x.key === a)?.label || a}
              </span>
            ))}
          </div>
        )}

        {isToday && (
          <span className="text-[9px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded bg-ocean-50 text-ocean-700 mb-2 w-fit">
            Prato do dia
          </span>
        )}

        <div className="flex items-center justify-between mt-auto">
          <span className="font-display font-bold text-sm text-ocean-700">€{Number(dish.base_price || 0).toFixed(2)}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => onToggleAvailable(dish)}
              className={`p-1.5 rounded transition-colors ${available ? 'text-[#1A7A4A] hover:bg-[#ECFDF5]' : 'text-n-400 hover:bg-n-100'}`}
              title={available ? 'Disponivel — clique para desactivar' : 'Indisponivel — clique para activar'}>
              <CheckCircle size={13} strokeWidth={1.75} />
            </button>
            <button onClick={() => onEdit(dish)} className="p-1.5 rounded text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors">
              <Pencil size={13} strokeWidth={1.75} />
            </button>
            <button onClick={() => onDelete(dish)} className="p-1.5 rounded text-n-400 hover:text-error hover:bg-red-50 transition-colors">
              <Trash2 size={13} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MenuDigital() {
  const { operator } = useAuthStore();
  const slug         = operator?.booking_link_slug;

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
    } catch (err) { setFormError(err.response?.data?.error || 'Erro ao guardar'); }
    finally { setFormLoading(false); }
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

  const menuUrl = slug ? `https://saldesk.cv/book/${slug}` : null;

  return (
    <div>
      <PageHeader
        title="Menu Digital"
        subtitle={`${dishes.length} prato(s) · ${tastings.length} menu(s) degustacao`}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" icon={ChefHat} onClick={() => { setModalType('tasting'); setModal('tasting_create'); }}>
              Menu Degustacao
            </Button>
            <Button icon={Plus} onClick={() => { setModalType('dish'); setModal('create'); }}>
              Novo Prato
            </Button>
          </div>
        }
      />

      {/* Category tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-mono font-medium transition-colors whitespace-nowrap ${
            activeTab === 'all' ? 'bg-ocean-700 text-white' : 'bg-n-100 text-n-600 hover:bg-n-200'
          }`}
        >
          Todos ({dishes.length})
        </button>
        {CATEGORIES.map(c => {
          const count = dishes.filter(u => parseDishMeta(u).category === c.key).length;
          return (
            <button
              key={c.key}
              onClick={() => setActiveTab(c.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-mono font-medium transition-colors whitespace-nowrap ${
                activeTab === c.key ? 'bg-ocean-700 text-white' : 'bg-n-100 text-n-600 hover:bg-n-200'
              }`}
            >
              {c.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Dishes grid */}
      {loading ? (
        <div className="flex justify-center py-20"><LoadingSpinner size={32} /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-n-400">
          <ChefHat size={40} strokeWidth={1.25} className="mb-3" />
          <p className="font-body text-sm">Nenhum prato nesta categoria.</p>
          <Button icon={Plus} className="mt-4" onClick={() => { setModalType('dish'); setModal('create'); }}>Adicionar prato</Button>
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
            />
          ))}
        </div>
      )}

      {/* Menus Degustacao */}
      {tastings.length > 0 && (
        <div className="bg-white rounded-md border border-n-200 shadow-sm overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-n-100 flex items-center gap-2">
            <Star size={14} strokeWidth={1.75} className="text-sand-500" />
            <h2 className="font-display font-semibold text-sm text-n-700">Menus Degustacao</h2>
          </div>
          <div className="divide-y divide-n-100">
            {tastings.map(t => {
              const meta = parseDishMeta(t);
              const items = meta.items || [];
              return (
                <div key={t.id} className="px-5 py-4 flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <p className="font-display font-semibold text-sm text-n-900">{t.name}</p>
                      <span className="font-display font-bold text-sm text-ocean-700">€{Number(t.base_price || 0).toFixed(2)}</span>
                      {t.status === 'inactive' && (
                        <span className="text-[9px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded bg-n-100 text-n-500">Inactivo</span>
                      )}
                    </div>
                    {meta.desc_pt && <p className="text-xs font-body text-n-500 mt-0.5">{meta.desc_pt}</p>}
                    {items.length > 0 && (
                      <p className="text-xs font-body text-n-400 mt-1">{items.map(i => i.name_pt).join(' · ')}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => { setModalType('tasting'); setModal(t); }}
                      className="p-1.5 rounded text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors">
                      <Pencil size={13} strokeWidth={1.75} />
                    </button>
                    <button onClick={() => setDeleteTarget(t)}
                      className="p-1.5 rounded text-n-400 hover:text-error hover:bg-red-50 transition-colors">
                      <Trash2 size={13} strokeWidth={1.75} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* QR Code / Link */}
      <div className="bg-white rounded-md border border-n-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <QrCode size={14} strokeWidth={1.75} className="text-n-500" />
          <h2 className="font-display font-semibold text-sm text-n-700">QR Code do Menu</h2>
        </div>
        {menuUrl ? (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-body text-n-500 mb-1.5">URL do menu para partilhar:</p>
              <div className="flex items-center gap-2 bg-n-50 border border-n-200 rounded-md px-3 py-2">
                <Link size={12} strokeWidth={1.75} className="text-n-400 shrink-0" />
                <span className="text-xs font-mono text-n-700 truncate flex-1">{menuUrl}</span>
                <button onClick={copyMenuUrl} className="p-1 text-n-400 hover:text-ocean-700 transition-colors shrink-0">
                  {copied ? <CheckCircle size={13} strokeWidth={1.75} className="text-[#1A7A4A]" /> : <Copy size={13} strokeWidth={1.75} />}
                </button>
              </div>
            </div>
            <a
              href={`https://api.saldesk.cv/api/v1/marketing/qrcode`}
              download="qrcode-menu.png"
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-ocean-700 text-white text-sm font-body hover:bg-ocean-500 transition-colors whitespace-nowrap shrink-0"
            >
              <QrCode size={14} strokeWidth={1.75} />
              Descarregar QR Code
            </a>
          </div>
        ) : (
          <p className="text-sm font-body text-n-400">Configure o link do restaurante nas Definicoes para gerar o QR Code.</p>
        )}
      </div>

      {/* Dish modal */}
      <Modal
        open={!!modal && modalType === 'dish'}
        onClose={() => setModal(null)}
        title={modal === 'create' ? 'Novo Prato' : 'Editar Prato'}
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
        title={modal === 'tasting_create' ? 'Novo Menu Degustacao' : 'Editar Menu'}
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
        title="Confirmar eliminacao"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="danger" onClick={handleDelete}>Eliminar</Button>
          </>
        }
      >
        <p className="text-sm font-body text-n-700">
          Eliminar <strong>{deleteTarget?.name}</strong>? Esta acao nao pode ser desfeita.
        </p>
      </Modal>
    </div>
  );
}
