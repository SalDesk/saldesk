import { useState, useEffect } from 'react';
import PlanGuard from '../components/PlanGuard';
import {
  Package, Plus, Pencil, Trash2, Eye, EyeOff,
  BarChart2, Image as ImageIcon, Copy, Check,
} from 'lucide-react';
import { listUnits } from '../services/unitsService';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import Input, { Textarea, Select } from '../components/ui/Input';

const STORAGE_KEY = 'saldesk_packages_v1';
function load() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } }
function persist(v) { localStorage.setItem(STORAGE_KEY, JSON.stringify(v)); }

const STATUS_CFG = {
  activo:   { label: 'Activo',   cls: 'bg-[#ECFDF5] text-[#1A7A4A] border-[#BBF7D0]'  },
  inactivo: { label: 'Inactivo', cls: 'bg-n-100 text-n-500 border-n-200'              },
  esgotado: { label: 'Esgotado', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
};

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00Z').toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ── PackageModal ── */
function PackageModal({ pkg, units, onSave, onClose }) {
  const isNew = !pkg || pkg._new;
  const base  = isNew ? null : pkg;

  const [form, setForm] = useState({
    name_pt:       base?.name_pt       || '',
    name_en:       base?.name_en       || '',
    description_pt: base?.description_pt || '',
    description_en: base?.description_en || '',
    tour_ids:      base?.tour_ids      || [],
    valid_from:    base?.valid_from    || '',
    valid_to:      base?.valid_to      || '',
    price:         base?.price         || '',
    limit:         base?.limit         || '',
    photo_url:     base?.photo_url     || '',
    status:        base?.status        || 'activo',
  });

  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));

  function toggleTour(id) {
    setForm(p => ({
      ...p,
      tour_ids: p.tour_ids.includes(id)
        ? p.tour_ids.filter(x => x !== id)
        : [...p.tour_ids, id],
    }));
  }

  const originalPrice = form.tour_ids
    .map(id => Number(units.find(u => u.id === id)?.base_price || 0))
    .reduce((s, p) => s + p, 0);

  const savings = originalPrice > 0 && form.price > 0
    ? originalPrice - Number(form.price)
    : 0;

  function handleSubmit(e) {
    e.preventDefault();
    onSave({
      ...base,
      ...form,
      price:   Number(form.price),
      limit:   form.limit ? Number(form.limit) : 0,
      original_price: originalPrice,
      bookings_count: base?.bookings_count || 0,
      id:      base?.id || Date.now().toString(),
      created_at: base?.created_at || new Date().toISOString(),
    });
  }

  return (
    <Modal open onClose={onClose} title={isNew ? 'Novo pacote' : 'Editar pacote'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Nome PT" value={form.name_pt} onChange={set('name_pt')} required placeholder="Ex: Pacote Kite + Mergulho" />
          <Input label="Nome EN" value={form.name_en} onChange={set('name_en')} placeholder="Ex: Kite + Diving Package" />
        </div>

        <Textarea label="Descricao PT" value={form.description_pt} onChange={set('description_pt')} rows={2} />
        <Textarea label="Descricao EN" value={form.description_en} onChange={set('description_en')} rows={2} />

        {/* Tour selection */}
        <div>
          <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600 block mb-2">
            Tours incluidos ({form.tour_ids.length} seleccionado(s))
          </label>
          {units.length === 0 ? (
            <p className="text-xs font-body text-n-400">Sem tours disponiveis. Cria tours primeiro em Unidades.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {units.map(u => (
                <button key={u.id} type="button" onClick={() => toggleTour(u.id)}
                  className={`text-xs px-3 py-1.5 rounded-sm border font-body transition-colors ${
                    form.tour_ids.includes(u.id)
                      ? 'bg-ocean-700 text-white border-ocean-700'
                      : 'bg-white text-n-600 border-n-200 hover:border-ocean-300'
                  }`}>
                  {u.name}
                  {u.base_price > 0 && <span className="ml-1 opacity-70">€{u.base_price}</span>}
                </button>
              ))}
            </div>
          )}
          {originalPrice > 0 && (
            <p className="text-xs font-body text-n-400 mt-1.5">
              Soma dos tours individuais: <span className="font-semibold text-n-700">€{originalPrice}</span>
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Input label="Preco do pacote (€)" type="number" min="0" step="0.01"
              value={form.price} onChange={set('price')} required placeholder="Ex: 85.00" />
            {savings > 0 && (
              <p className="text-xs font-body text-[#1A7A4A] mt-1">
                Cliente poupa €{savings.toFixed(0)} vs compra individual
              </p>
            )}
          </div>
          <Input label="Limite de vendas (0 = ilimitado)" type="number" min="0"
            value={form.limit} onChange={set('limit')} placeholder="0" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Valido de" type="date" value={form.valid_from} onChange={set('valid_from')} />
          <Input label="Valido ate" type="date" value={form.valid_to} onChange={set('valid_to')} />
        </div>

        <Input label="Foto (URL)" value={form.photo_url} onChange={set('photo_url')} placeholder="https://exemplo.com/foto.jpg" />

        {!isNew && (
          <Select label="Estado" value={form.status} onChange={set('status')}>
            {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
        )}

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button type="submit" className="flex-1">{isNew ? 'Criar pacote' : 'Guardar'}</Button>
        </div>
      </form>
    </Modal>
  );
}

/* ─────────────────────── Main ─────────────────────── */
export default function Packages() {
  const [packages, setPackages] = useState(load);
  const [units,    setUnits]    = useState([]);
  const [modal,    setModal]    = useState(null);

  useEffect(() => { listUnits().then(d => setUnits(d || [])).catch(() => {}); }, []);

  function handleSave(pkg) {
    setPackages(prev => {
      const next = prev.find(x => x.id === pkg.id)
        ? prev.map(x => x.id === pkg.id ? pkg : x)
        : [...prev, pkg];
      persist(next);
      return next;
    });
    setModal(null);
  }

  function handleDelete(id) {
    if (!window.confirm('Eliminar este pacote?')) return;
    setPackages(prev => { const next = prev.filter(p => p.id !== id); persist(next); return next; });
  }

  function handleToggleStatus(id) {
    setPackages(prev => {
      const next = prev.map(p => {
        if (p.id !== id) return p;
        const nextStatus = p.status === 'activo' ? 'inactivo' : 'activo';
        return { ...p, status: nextStatus };
      });
      persist(next);
      return next;
    });
  }

  const totalRevenue = packages.reduce((s, p) => s + (p.bookings_count || 0) * (p.price || 0), 0);
  const totalBookings = packages.reduce((s, p) => s + (p.bookings_count || 0), 0);
  const activeCount = packages.filter(p => p.status === 'activo').length;

  return (
    <div>
      <PageHeader
        title="Pacotes Sazonais"
        subtitle="Combina tours em pacotes com preco especial"
        actions={
          <Button icon={Plus} onClick={() => setModal({ _new: true })}>Novo pacote</Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Pacotes activos',   value: activeCount,                            color: 'text-n-900'     },
          { label: 'Reservas por pacotes', value: totalBookings,                       color: 'text-ocean-700' },
          { label: 'Receita gerada',    value: `€${Math.round(totalRevenue).toLocaleString('pt-PT')}`, color: 'text-[#1A7A4A]' },
        ].map(m => (
          <div key={m.label} className="bg-white border border-n-200 rounded-md px-4 py-3 flex items-center gap-3">
            <Package size={16} strokeWidth={1.75} className="text-n-300 shrink-0" />
            <div>
              <p className={`font-display font-bold text-xl ${m.color}`}>{m.value}</p>
              <p className="text-xs font-body text-n-500">{m.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Note about public visibility */}
      <div className="mb-4 px-4 py-2.5 bg-ocean-50 border border-ocean-100 rounded-sm">
        <p className="text-xs font-body text-ocean-700">
          Os pacotes activos aparecem automaticamente na pagina publica de reservas quando o backend implementar o endpoint <span className="font-mono">/public/:slug/packages</span>.
        </p>
      </div>

      {packages.length === 0 ? (
        <Card>
          <div className="text-center py-14">
            <Package size={36} strokeWidth={1.25} className="mx-auto mb-3 text-n-300" />
            <p className="font-display font-semibold text-n-700 mb-1">Sem pacotes criados</p>
            <p className="text-sm font-body text-n-400 mb-4">Cria o primeiro pacote combinando tours com preco especial.</p>
            <Button icon={Plus} onClick={() => setModal({ _new: true })}>Criar pacote</Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {packages.map(pkg => {
            const cfg     = STATUS_CFG[pkg.status] || STATUS_CFG.activo;
            const tours   = (pkg.tour_ids || []).map(id => units.find(u => u.id === id)).filter(Boolean);
            const savings = (pkg.original_price || 0) - (pkg.price || 0);
            const isExpired = pkg.valid_to && new Date(pkg.valid_to + 'T00:00:00Z') < new Date();
            const isFull = pkg.limit > 0 && pkg.bookings_count >= pkg.limit;

            return (
              <div key={pkg.id} className={`bg-white border rounded-md overflow-hidden ${pkg.status !== 'activo' ? 'opacity-70' : 'border-n-200'}`}>
                {/* Photo */}
                <div className="h-32 bg-n-100 relative overflow-hidden">
                  {pkg.photo_url ? (
                    <img src={pkg.photo_url} alt={pkg.name_pt}
                      className="w-full h-full object-cover"
                      onError={e => { e.target.style.display = 'none'; }} />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <ImageIcon size={28} strokeWidth={1.25} className="text-n-300" />
                    </div>
                  )}
                  <span className={`absolute top-2 right-2 text-xs font-mono px-2 py-0.5 rounded-xs border ${cfg.cls}`}>
                    {isFull ? 'Esgotado' : isExpired ? 'Expirado' : cfg.label}
                  </span>
                </div>

                <div className="p-4 space-y-3">
                  <div>
                    <p className="font-display font-semibold text-sm text-n-900">{pkg.name_pt}</p>
                    {pkg.description_pt && (
                      <p className="text-xs font-body text-n-500 mt-0.5 line-clamp-2">{pkg.description_pt}</p>
                    )}
                  </div>

                  {/* Tours */}
                  <div className="flex flex-wrap gap-1">
                    {tours.slice(0, 3).map(t => (
                      <span key={t.id} className="text-[10px] font-body bg-ocean-50 text-ocean-700 px-1.5 py-0.5 rounded-xs">
                        {t.name}
                      </span>
                    ))}
                    {tours.length > 3 && (
                      <span className="text-[10px] font-mono text-n-400">+{tours.length - 3}</span>
                    )}
                  </div>

                  {/* Price */}
                  <div className="flex items-end gap-3">
                    <div>
                      <p className="font-display font-bold text-lg text-ocean-700">€{pkg.price}</p>
                      {pkg.original_price > 0 && (
                        <p className="text-[10px] font-body text-n-400 line-through">€{pkg.original_price}</p>
                      )}
                    </div>
                    {savings > 0 && (
                      <span className="text-xs font-body font-semibold text-[#1A7A4A] bg-[#ECFDF5] px-1.5 py-0.5 rounded-xs">
                        Poupa €{savings.toFixed(0)}
                      </span>
                    )}
                  </div>

                  {/* Validity */}
                  {(pkg.valid_from || pkg.valid_to) && (
                    <p className="text-[10px] font-mono text-n-400">
                      {fmtDate(pkg.valid_from)} — {fmtDate(pkg.valid_to)}
                    </p>
                  )}

                  {/* Stats */}
                  <div className="flex items-center gap-3 pt-1 border-t border-n-100">
                    <span className="text-xs font-mono text-n-500">
                      {pkg.bookings_count || 0} reserva(s)
                    </span>
                    {pkg.limit > 0 && (
                      <span className="text-xs font-mono text-n-400">
                        {Math.max(0, pkg.limit - (pkg.bookings_count || 0))} restante(s)
                      </span>
                    )}
                    <div className="ml-auto flex gap-1">
                      <button onClick={() => handleToggleStatus(pkg.id)}
                        className="p-1.5 rounded text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors"
                        title={pkg.status === 'activo' ? 'Desactivar' : 'Activar'}>
                        {pkg.status === 'activo' ? <EyeOff size={13} strokeWidth={1.75} /> : <Eye size={13} strokeWidth={1.75} />}
                      </button>
                      <button onClick={() => setModal(pkg)}
                        className="p-1.5 rounded text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors">
                        <Pencil size={13} strokeWidth={1.75} />
                      </button>
                      <button onClick={() => handleDelete(pkg.id)}
                        className="p-1.5 rounded text-n-400 hover:text-error hover:bg-red-50 transition-colors">
                        <Trash2 size={13} strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <PackageModal
          pkg={modal}
          units={units}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
