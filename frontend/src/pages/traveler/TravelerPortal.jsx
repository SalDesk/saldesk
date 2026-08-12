import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, CalendarCheck, Heart, LogOut, MapPin, Compass, Trash2, ExternalLink,
} from 'lucide-react';
import useTravelerAuthStore from '../../store/travelerAuthStore';
import * as travelerService from '../../services/travelerService';
import { logout as apiLogout } from '../../services/travelerAuthService';
import { discoverUnits } from '../../services/publicService';
import Logo from '../../components/shared/Logo';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input, { Select } from '../../components/ui/Input';
import LoadingSpinner from '../../components/shared/LoadingSpinner';

const APP = 'https://app.saldesk.cv';

const STATUS_LABEL = {
  pending: 'Pendente', confirmed: 'Confirmada', checked_in: 'Em curso',
  checked_out: 'Concluida', cancelled: 'Cancelada',
};
const STATUS_BADGE = {
  pending: 'pending', confirmed: 'confirmed', checked_in: 'info',
  checked_out: 'default', cancelled: 'cancelled',
};

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ─── Perfil ─── */
function ProfileTab({ traveler, onUpdate }) {
  const [form, setForm] = useState({
    name: traveler?.name || '', phone: traveler?.phone || '',
    country: traveler?.country || '', language: traveler?.language || 'pt',
  });
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true); setSavedOk(false);
    try {
      const updated = await travelerService.updateProfile(form);
      onUpdate(updated);
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2000);
    } catch (err) {
      window.alert(err?.response?.data?.error || 'Nao foi possivel guardar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <form onSubmit={handleSave} className="space-y-4 max-w-md">
        <Input label="Nome" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
        <Input label="Email" value={traveler?.email || ''} disabled />
        <Input label="Telefone" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
        <Input label="Pais" value={form.country} onChange={e => setForm(p => ({ ...p, country: e.target.value }))} />
        <Select label="Idioma" value={form.language} onChange={e => setForm(p => ({ ...p, language: e.target.value }))}>
          <option value="pt">Portugues</option>
          <option value="en">English</option>
        </Select>
        <Button type="submit" loading={saving}>
          {savedOk ? 'Guardado' : 'Guardar alteracoes'}
        </Button>
      </form>
    </Card>
  );
}

/* ─── Reservas ─── */
function BookingsTab() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    travelerService.getBookings().then(setBookings).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>;

  if (!bookings.length) {
    return (
      <Card>
        <div className="text-center py-10">
          <CalendarCheck size={32} strokeWidth={1.5} className="mx-auto text-n-300 mb-3" />
          <p className="text-sm font-body text-n-500">Ainda nao tem nenhuma reserva registada com este email.</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {bookings.map(b => (
        <Card key={b.id}>
          <div className="flex gap-4">
            <div className="w-16 h-16 rounded-sm bg-n-100 overflow-hidden shrink-0 flex items-center justify-center">
              {b.unit_image
                ? <img src={b.unit_image} alt={b.unit_name} className="w-full h-full object-cover" />
                : <MapPin size={20} strokeWidth={1.5} className="text-n-300" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <p className="font-display font-bold text-n-900">{b.unit_name || 'Servico'}</p>
                  <p className="text-xs font-body text-n-500">{b.operator_name || '—'}</p>
                </div>
                <Badge variant={STATUS_BADGE[b.status] || 'default'}>{STATUS_LABEL[b.status] || b.status}</Badge>
              </div>
              <p className="text-xs font-body text-n-500 mt-1.5">
                {fmtDate(b.check_in)} → {fmtDate(b.check_out)} · {b.guests} pessoa(s) · €{b.total_price}
              </p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ─── Wishlist ─── */
function WishlistCard({ item, onRemove }) {
  return (
    <Card>
      <div className="flex gap-3">
        <div className="w-20 h-20 rounded-sm bg-n-100 overflow-hidden shrink-0 flex items-center justify-center">
          {item.images?.[0]
            ? <img src={item.images[0]} alt={item.unit_name} className="w-full h-full object-cover" />
            : <MapPin size={18} strokeWidth={1.5} className="text-n-300" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-bold text-sm text-n-900 truncate">{item.unit_name}</p>
          <p className="text-xs font-body text-n-500">{item.operator_name}</p>
          {!item.still_published && (
            <p className="text-xs font-body text-n-400 mt-1">Ja nao disponivel no catalogo</p>
          )}
          <div className="flex items-center justify-between mt-2">
            <span className="font-mono text-sm font-bold text-ocean-700">€{item.base_price ?? '—'}</span>
            <div className="flex gap-1.5">
              {item.still_published && item.operator_slug && (
                <a href={`${APP}/book/${item.operator_slug}/servico/${item.unit_id}`} target="_blank" rel="noopener"
                  className="p-1.5 rounded-sm text-ocean-700 hover:bg-ocean-50" title="Ver / reservar">
                  <ExternalLink size={14} strokeWidth={1.75} />
                </a>
              )}
              <button onClick={() => onRemove(item.unit_id)} className="p-1.5 rounded-sm text-error hover:bg-red-50" title="Remover">
                <Trash2 size={14} strokeWidth={1.75} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function ExploreCard({ item, saved, onToggle }) {
  return (
    <Card>
      <div className="flex gap-3">
        <div className="w-20 h-20 rounded-sm bg-n-100 overflow-hidden shrink-0 flex items-center justify-center">
          {item.images?.[0]
            ? <img src={item.images[0]} alt={item.unit_name} className="w-full h-full object-cover" />
            : <MapPin size={18} strokeWidth={1.5} className="text-n-300" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-bold text-sm text-n-900 truncate">{item.unit_name}</p>
          <p className="text-xs font-body text-n-500">{item.operator_name}</p>
          <div className="flex items-center justify-between mt-2">
            <span className="font-mono text-sm font-bold text-ocean-700">€{item.base_price ?? '—'}</span>
            <button
              onClick={() => onToggle(item.unit_id, saved)}
              className={`p-1.5 rounded-sm ${saved ? 'text-error' : 'text-n-400 hover:text-error'}`}
              title={saved ? 'Remover da wishlist' : 'Guardar'}
            >
              <Heart size={16} strokeWidth={1.75} fill={saved ? 'currentColor' : 'none'} />
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function WishlistTab() {
  const [view, setView] = useState('guardados'); // 'guardados' | 'explorar'
  const [saved, setSaved]     = useState([]);
  const [explore, setExplore] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadSaved = useCallback(() => {
    travelerService.getWishlist().then(setSaved).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    loadSaved();
    discoverUnits().then(setExplore).catch(() => {}).finally(() => setLoading(false));
  }, [loadSaved]);

  async function handleRemove(unitId) {
    setSaved(prev => prev.filter(s => s.unit_id !== unitId));
    try { await travelerService.removeFromWishlist(unitId); } catch { loadSaved(); }
  }

  async function handleToggle(unitId, isSaved) {
    if (isSaved) {
      setSaved(prev => prev.filter(s => s.unit_id !== unitId));
      try { await travelerService.removeFromWishlist(unitId); } catch { loadSaved(); }
    } else {
      try {
        await travelerService.addToWishlist(unitId);
        loadSaved();
      } catch (err) {
        window.alert(err?.response?.data?.error || 'Nao foi possivel guardar.');
      }
    }
  }

  const savedIds = new Set(saved.map(s => s.unit_id));

  return (
    <div>
      <div className="inline-flex rounded-sm border border-n-200 bg-white overflow-hidden mb-4">
        <button
          onClick={() => setView('guardados')}
          className={`px-4 h-8 text-xs font-body font-semibold transition-colors ${view === 'guardados' ? 'bg-ocean-700 text-white' : 'text-n-500 hover:text-n-700'}`}
        >
          Guardados ({saved.length})
        </button>
        <button
          onClick={() => setView('explorar')}
          className={`px-4 h-8 text-xs font-body font-semibold transition-colors border-l border-n-200 ${view === 'explorar' ? 'bg-ocean-700 text-white' : 'text-n-500 hover:text-n-700'}`}
        >
          Explorar
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner /></div>
      ) : view === 'guardados' ? (
        saved.length === 0 ? (
          <Card>
            <div className="text-center py-10">
              <Heart size={32} strokeWidth={1.5} className="mx-auto text-n-300 mb-3" />
              <p className="text-sm font-body text-n-500">Ainda nao guardou nenhuma experiencia.</p>
              <Button variant="ghost" size="sm" className="mt-3" onClick={() => setView('explorar')}>
                Explorar catalogo
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {saved.map(item => <WishlistCard key={item.unit_id} item={item} onRemove={handleRemove} />)}
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {explore.map(item => (
            <ExploreCard key={item.unit_id} item={item} saved={savedIds.has(item.unit_id)} onToggle={handleToggle} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Portal ─── */
const TABS = [
  { id: 'perfil',   label: 'Perfil',           icon: User },
  { id: 'reservas', label: 'As minhas reservas', icon: CalendarCheck },
  { id: 'wishlist', label: 'Wishlist',         icon: Heart },
];

export default function TravelerPortal() {
  const { traveler, setTraveler, logout } = useTravelerAuthStore();
  const navigate = useNavigate();
  const [tab, setTab] = useState('perfil');

  async function handleLogout() {
    await apiLogout();
    logout();
    navigate('/viajante/entrar');
  }

  return (
    <div className="min-h-screen bg-n-50">
      <nav className="bg-white border-b border-n-200 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo size="sm" dark />
            <span className="text-xs font-body font-bold uppercase tracking-wide text-ocean-600 flex items-center gap-1">
              <Compass size={12} strokeWidth={2} /> Conect
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-body text-n-600 hidden sm:inline">{traveler?.name}</span>
            <Button variant="ghost" size="sm" icon={LogOut} onClick={handleLogout}>Sair</Button>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex gap-1 mb-6 border-b border-n-200 overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-body font-semibold whitespace-nowrap border-b-2 transition-colors ${
                tab === id ? 'border-ocean-700 text-ocean-700' : 'border-transparent text-n-500 hover:text-n-700'
              }`}
            >
              <Icon size={14} strokeWidth={1.75} /> {label}
            </button>
          ))}
        </div>

        {tab === 'perfil'   && <ProfileTab traveler={traveler} onUpdate={setTraveler} />}
        {tab === 'reservas' && <BookingsTab />}
        {tab === 'wishlist' && <WishlistTab />}
      </div>
    </div>
  );
}
