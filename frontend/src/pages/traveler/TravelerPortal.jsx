import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, CalendarCheck, Heart, LogOut, MapPin, Compass, Trash2, ExternalLink,
  Eye, EyeOff, ShieldCheck, Lock, Star, Search, LayoutDashboard, Receipt,
  Menu, X, HelpCircle, ArrowRight, Camera, Upload, Bell, Sun, Settings, Download,
} from 'lucide-react';
import useTravelerAuthStore from '../../store/travelerAuthStore';
import useUiStore from '../../store/uiStore';
import { useThemeEffect } from '../../hooks/useThemeEffect';
import * as travelerService from '../../services/travelerService';
import { logout as apiLogout, changePassword } from '../../services/travelerAuthService';
import { discoverUnits } from '../../services/publicService';
import { validateImageFile } from '../../services/uploadService';
import Logo from '../../components/shared/Logo';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input, { Select } from '../../components/ui/Input';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import PasswordStrength, { getPasswordStrength } from '../../components/auth/PasswordStrength';

const APP = 'https://app.saldesk.cv';

const STATUS_LABEL = {
  pending: 'Pendente', confirmed: 'Confirmada', checked_in: 'Em curso',
  checked_out: 'Concluida', cancelled: 'Cancelada',
};
const STATUS_BADGE = {
  pending: 'pending', confirmed: 'confirmed', checked_in: 'info',
  checked_out: 'default', cancelled: 'cancelled',
};
const PAYMENT_LABEL = { pending: 'Pendente', paid: 'Pago', partial: 'Parcial', refunded: 'Reembolsado' };
const PAYMENT_BADGE = { pending: 'pending', paid: 'confirmed', partial: 'info', refunded: 'cancelled' };

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtRelative(iso) {
  if (!iso) return '—';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `ha ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `ha ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `ha ${days}d`;
  return fmtDate(iso);
}

function initials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join('');
}

function splitBookings(bookings) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const upcoming = bookings.filter(b => !['checked_out', 'cancelled'].includes(b.status) && new Date(b.check_out) >= today);
  const past = bookings.filter(b => !upcoming.includes(b));
  return { upcoming, past };
}

/* ─── Dashboard ─── */
function DashboardTab({ traveler, onNavigate }) {
  const [bookings, setBookings] = useState(null);
  const [wishlist, setWishlist] = useState(null);

  useEffect(() => {
    travelerService.getBookings().then(setBookings).catch(() => setBookings([]));
    travelerService.getWishlist().then(setWishlist).catch(() => setWishlist([]));
  }, []);

  const { upcoming } = bookings ? splitBookings(bookings) : { upcoming: [] };
  const nextTrip = upcoming[0];

  return (
    <div>
      <Card className="mb-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="w-16 h-16 rounded-full bg-ocean-700 text-white flex items-center justify-center font-display font-bold text-xl shrink-0 overflow-hidden">
            {traveler?.avatar_url
              ? <img src={traveler.avatar_url} alt={traveler.name} className="w-full h-full object-cover" />
              : initials(traveler?.name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display font-bold text-lg text-n-900 dark:text-n-50">Ola, {traveler?.name?.split(' ')[0]}</p>
            <p className="text-sm font-body text-n-500 dark:text-n-400">{traveler?.email}</p>
            <p className="text-xs font-body text-n-400 dark:text-n-500 mt-0.5">Membro desde {fmtDate(traveler?.created_at)}</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        <button onClick={() => onNavigate('reservas')} className="text-left px-4 py-3 rounded-md bg-white dark:bg-n-800 border border-n-200 dark:border-n-700 hover:border-ocean-300 dark:hover:border-ocean-600 transition-colors">
          <p className="font-display font-bold text-xl text-ocean-700 dark:text-ocean-300">{bookings?.length ?? '—'}</p>
          <p className="text-xs font-body text-n-500 dark:text-n-400">Reservas</p>
        </button>
        <button onClick={() => onNavigate('wishlist')} className="text-left px-4 py-3 rounded-md bg-white dark:bg-n-800 border border-n-200 dark:border-n-700 hover:border-ocean-300 dark:hover:border-ocean-600 transition-colors">
          <p className="font-display font-bold text-xl text-ocean-700 dark:text-ocean-300">{wishlist?.length ?? '—'}</p>
          <p className="text-xs font-body text-n-500 dark:text-n-400">Guardados</p>
        </button>
        <button onClick={() => onNavigate('avaliacoes')} className="text-left px-4 py-3 rounded-md bg-white dark:bg-n-800 border border-n-200 dark:border-n-700 hover:border-ocean-300 dark:hover:border-ocean-600 transition-colors">
          <p className="font-display font-bold text-xl text-ocean-700 dark:text-ocean-300">{bookings?.filter(b => b.review).length ?? '—'}</p>
          <p className="text-xs font-body text-n-500 dark:text-n-400">Avaliacoes dadas</p>
        </button>
      </div>

      <Card header={<h3 className="font-display font-semibold text-sm text-n-700 dark:text-n-300">Proxima viagem</h3>}>
        {!bookings ? (
          <div className="flex justify-center py-8"><LoadingSpinner /></div>
        ) : !nextTrip ? (
          <div className="text-center py-6">
            <CalendarCheck size={28} strokeWidth={1.5} className="mx-auto text-n-300 dark:text-n-600 mb-2" />
            <p className="text-sm font-body text-n-500 dark:text-n-400">Sem viagens agendadas.</p>
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => onNavigate('wishlist')}>
              Explorar experiencias
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-sm bg-n-100 dark:bg-n-700 overflow-hidden shrink-0 flex items-center justify-center">
              {nextTrip.unit_image
                ? <img src={nextTrip.unit_image} alt={nextTrip.unit_name} className="w-full h-full object-cover" />
                : <MapPin size={18} strokeWidth={1.5} className="text-n-300 dark:text-n-600" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display font-bold text-n-900 dark:text-n-50">{nextTrip.unit_name}</p>
              <p className="text-xs font-body text-n-500 dark:text-n-400">{nextTrip.operator_name} · {fmtDate(nextTrip.check_in)}</p>
            </div>
            <Badge variant={STATUS_BADGE[nextTrip.status]}>{STATUS_LABEL[nextTrip.status]}</Badge>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ─── Editar perfil ─── */
function AvatarUploader({ traveler, onUpdate }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  async function handleFile(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const invalid = validateImageFile(file);
    if (invalid) { setError(invalid); return; }
    setError(''); setUploading(true); setProgress(0);
    try {
      const { url } = await travelerService.uploadAvatar(file, setProgress);
      const updated = await travelerService.updateProfile({ avatar_url: url });
      onUpdate(updated);
    } catch (err) {
      setError(err?.response?.data?.error || 'Nao foi possivel carregar a foto.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col items-center pb-2">
      <div className="relative">
        <div className="w-28 h-28 rounded-full bg-ocean-100 dark:bg-n-700 flex items-center justify-center overflow-hidden border-4 border-ocean-200 dark:border-n-600 shadow-md">
          {traveler?.avatar_url
            ? <img src={traveler.avatar_url} alt={traveler.name} className="w-full h-full object-cover" />
            : <Camera size={30} strokeWidth={1.5} className="text-ocean-400 dark:text-ocean-300" />}
        </div>
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
          className="absolute -bottom-1 -right-1 w-9 h-9 bg-sand-500 text-ocean-900 rounded-full flex items-center justify-center shadow-md hover:bg-sand-600 active:scale-95 transition-all disabled:opacity-60">
          {uploading ? <LoadingSpinner size={15} className="!text-ocean-900" /> : <Upload size={15} strokeWidth={2} />}
        </button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile} className="hidden" />
      </div>
      {uploading && <p className="text-xs font-body text-n-500 dark:text-n-400 mt-2">A carregar... {progress}%</p>}
      {error && <p className="text-xs text-error mt-2">{error}</p>}
    </div>
  );
}

function EditProfileTab({ traveler, onUpdate }) {
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
    <Card header={<h3 className="font-display font-semibold text-sm text-n-700 dark:text-n-300">Dados pessoais</h3>}>
      <AvatarUploader traveler={traveler} onUpdate={onUpdate} />
      <form onSubmit={handleSave} className="space-y-4 max-w-md">
        <Input label="Nome" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
        <Input label="Email" value={traveler?.email || ''} disabled hint="O email nao pode ser alterado." />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Telefone" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
          <Input label="Pais" value={form.country} onChange={e => setForm(p => ({ ...p, country: e.target.value }))} />
        </div>
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

/* ─── Alterar password ─── */
function ChangePasswordTab() {
  const [form, setForm]       = useState({ newPw: '', confirm: '' });
  const [show, setShow]       = useState({ newPw: false, confirm: false });
  const [saving, setSaving]   = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [error, setError]     = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (getPasswordStrength(form.newPw) < 2) {
      setError('A password deve ser forte: 8+ caracteres, maiuscula, numero e especial.');
      return;
    }
    if (form.newPw !== form.confirm) {
      setError('As passwords nao coincidem.');
      return;
    }
    setSaving(true);
    try {
      await changePassword(form.newPw);
      setForm({ newPw: '', confirm: '' });
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 3000);
    } catch (err) {
      setError(err?.response?.data?.error || 'Nao foi possivel alterar a password.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card header={<h3 className="font-display font-semibold text-sm text-n-700 dark:text-n-300 flex items-center gap-1.5"><ShieldCheck size={14} strokeWidth={1.75} /> Seguranca</h3>}>
      <form onSubmit={handleSubmit} className="space-y-3 max-w-md">
        {[
          { field: 'newPw',   label: 'Nova password' },
          { field: 'confirm', label: 'Confirmar nova password' },
        ].map(({ field, label }) => (
          <div key={field} className="flex flex-col gap-1">
            <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600 dark:text-n-400">{label}</label>
            <div className="relative">
              <input
                type={show[field] ? 'text' : 'password'}
                value={form[field]}
                onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
                required autoComplete="new-password"
                className="w-full h-9 px-3 pr-10 rounded-sm border border-n-300 dark:border-n-600 text-sm font-body bg-n-100 dark:bg-n-800 text-n-900 dark:text-n-100 placeholder:text-n-400 focus:outline-none focus:ring-2 focus:ring-ocean-300 focus:border-ocean-700 focus:bg-white dark:focus:bg-n-800 transition-colors"
              />
              <button type="button"
                onClick={() => setShow(p => ({ ...p, [field]: !p[field] }))}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-n-400 dark:text-n-500 hover:text-n-600 dark:hover:text-n-300 transition-colors">
                {show[field] ? <EyeOff size={14} strokeWidth={1.75} /> : <Eye size={14} strokeWidth={1.75} />}
              </button>
            </div>
            {field === 'newPw' && form.newPw && <PasswordStrength password={form.newPw} />}
          </div>
        ))}

        {error && <p className="text-xs text-error">{error}</p>}

        <Button type="submit" loading={saving} icon={Lock}>
          {savedOk ? 'Password alterada' : 'Alterar password'}
        </Button>
      </form>
    </Card>
  );
}

/* ─── Reservas ─── */
function BookingRow({ booking }) {
  return (
    <Card>
      <div className="flex gap-4">
        <div className="w-16 h-16 rounded-sm bg-n-100 dark:bg-n-700 overflow-hidden shrink-0 flex items-center justify-center">
          {booking.unit_image
            ? <img src={booking.unit_image} alt={booking.unit_name} className="w-full h-full object-cover" />
            : <MapPin size={20} strokeWidth={1.5} className="text-n-300 dark:text-n-600" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <p className="font-display font-bold text-n-900 dark:text-n-50">{booking.unit_name || 'Servico'}</p>
              <p className="text-xs font-body text-n-500 dark:text-n-400">{booking.operator_name || '—'}</p>
            </div>
            <Badge variant={STATUS_BADGE[booking.status] || 'default'}>{STATUS_LABEL[booking.status] || booking.status}</Badge>
          </div>
          <p className="text-xs font-body text-n-500 dark:text-n-400 mt-1.5">
            {fmtDate(booking.check_in)} → {fmtDate(booking.check_out)} · {booking.guests} pessoa(s) · €{booking.total_price}
          </p>
        </div>
      </div>
    </Card>
  );
}

function BookingsTab({ onNavigate }) {
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
          <CalendarCheck size={32} strokeWidth={1.5} className="mx-auto text-n-300 dark:text-n-600 mb-3" />
          <p className="text-sm font-body text-n-500 dark:text-n-400">Ainda nao tem nenhuma reserva registada com este email.</p>
        </div>
      </Card>
    );
  }

  const { upcoming, past } = splitBookings(bookings);
  const pendingReview = bookings.filter(b => b.can_review).length;

  return (
    <div className="space-y-6">
      {pendingReview > 0 && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-md bg-sand-50 dark:bg-n-800 border border-sand-100 dark:border-n-700">
          <p className="text-sm font-body text-n-700 dark:text-n-300">
            Tem <strong>{pendingReview}</strong> reserva(s) por avaliar.
          </p>
          <Button size="sm" variant="ghost" icon={ArrowRight} onClick={() => onNavigate('avaliacoes')}>Avaliar</Button>
        </div>
      )}
      {upcoming.length > 0 && (
        <div>
          <h3 className="text-xs font-body font-bold uppercase tracking-wide text-n-500 dark:text-n-400 mb-2">Proximas ({upcoming.length})</h3>
          <div className="space-y-3">
            {upcoming.map(b => <BookingRow key={b.id} booking={b} />)}
          </div>
        </div>
      )}
      {past.length > 0 && (
        <div>
          <h3 className="text-xs font-body font-bold uppercase tracking-wide text-n-500 dark:text-n-400 mb-2">Anteriores ({past.length})</h3>
          <div className="space-y-3">
            {past.map(b => <BookingRow key={b.id} booking={b} />)}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Facturas ─── */
function InvoicesTab() {
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
          <Receipt size={32} strokeWidth={1.5} className="mx-auto text-n-300 dark:text-n-600 mb-3" />
          <p className="text-sm font-body text-n-500 dark:text-n-400">Sem facturas — ainda nao tem reservas.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card padding="p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-n-200 dark:border-n-700">
              <th className="px-4 py-3 text-left text-xs font-body font-bold uppercase tracking-wide text-n-500 dark:text-n-400">Tour</th>
              <th className="px-4 py-3 text-left text-xs font-body font-bold uppercase tracking-wide text-n-500 dark:text-n-400">Data</th>
              <th className="px-4 py-3 text-left text-xs font-body font-bold uppercase tracking-wide text-n-500 dark:text-n-400">Total</th>
              <th className="px-4 py-3 text-left text-xs font-body font-bold uppercase tracking-wide text-n-500 dark:text-n-400">Pago</th>
              <th className="px-4 py-3 text-left text-xs font-body font-bold uppercase tracking-wide text-n-500 dark:text-n-400">Estado</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map(b => (
              <tr key={b.id} className="border-b border-n-100 dark:border-n-800">
                <td className="px-4 py-3">
                  <p className="font-body font-semibold text-n-900 dark:text-n-50">{b.unit_name || 'Servico'}</p>
                  <p className="text-xs font-body text-n-400 dark:text-n-500">{b.operator_name}</p>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-n-600 dark:text-n-400">{fmtDate(b.check_in)}</td>
                <td className="px-4 py-3 font-mono text-sm font-semibold text-n-900 dark:text-n-50">€{b.total_price}</td>
                <td className="px-4 py-3 font-mono text-xs text-n-600 dark:text-n-400">€{b.amount_paid ?? 0}</td>
                <td className="px-4 py-3">
                  <Badge variant={PAYMENT_BADGE[b.payment_status] || 'default'}>{PAYMENT_LABEL[b.payment_status] || b.payment_status || '—'}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ─── Avaliacoes ─── */
function StarRating({ value, onChange, size = 18, readOnly = false }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(n)}
          onMouseEnter={() => !readOnly && setHover(n)}
          onMouseLeave={() => !readOnly && setHover(0)}
          className={readOnly ? 'cursor-default' : 'cursor-pointer'}
        >
          <Star
            size={size}
            strokeWidth={1.75}
            className={(hover || value) >= n ? 'text-sand-500' : 'text-n-300 dark:text-n-600'}
            fill={(hover || value) >= n ? 'currentColor' : 'none'}
          />
        </button>
      ))}
    </div>
  );
}

function PendingReviewCard({ booking, onSubmitted }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (!rating) { setError('Escolha uma classificacao.'); return; }
    setSaving(true); setError('');
    try {
      const review = await travelerService.submitReview(booking.id, rating, comment.trim());
      onSubmitted(booking.id, review);
    } catch (err) {
      setError(err?.response?.data?.error || 'Nao foi possivel enviar a avaliacao.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 rounded-sm bg-n-100 dark:bg-n-700 overflow-hidden shrink-0 flex items-center justify-center">
          {booking.unit_image
            ? <img src={booking.unit_image} alt={booking.unit_name} className="w-full h-full object-cover" />
            : <MapPin size={16} strokeWidth={1.5} className="text-n-300 dark:text-n-600" />}
        </div>
        <div className="min-w-0">
          <p className="font-display font-bold text-sm text-n-900 dark:text-n-50 truncate">{booking.unit_name}</p>
          <p className="text-xs font-body text-n-500 dark:text-n-400">{booking.operator_name} · {fmtDate(booking.check_in)}</p>
        </div>
      </div>
      <div className="space-y-2">
        <StarRating value={rating} onChange={setRating} />
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Como foi a experiencia? (opcional)"
          rows={2}
          className="w-full px-3 py-2 rounded-sm border border-n-300 dark:border-n-600 text-sm font-body bg-n-100 dark:bg-n-800 text-n-900 dark:text-n-100 placeholder:text-n-400 focus:outline-none focus:ring-2 focus:ring-ocean-300 focus:border-ocean-700 focus:bg-white dark:focus:bg-n-800 transition-colors resize-none"
        />
        {error && <p className="text-xs text-error">{error}</p>}
        <Button size="sm" loading={saving} onClick={handleSubmit}>Enviar avaliacao</Button>
      </div>
    </Card>
  );
}

function GivenReviewCard({ booking }) {
  return (
    <Card>
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-sm bg-n-100 dark:bg-n-700 overflow-hidden shrink-0 flex items-center justify-center">
          {booking.unit_image
            ? <img src={booking.unit_image} alt={booking.unit_name} className="w-full h-full object-cover" />
            : <MapPin size={16} strokeWidth={1.5} className="text-n-300 dark:text-n-600" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display font-bold text-sm text-n-900 dark:text-n-50 truncate">{booking.unit_name}</p>
          <p className="text-xs font-body text-n-500 dark:text-n-400">{booking.operator_name}</p>
          <div className="mt-1">
            <StarRating value={booking.review.rating} readOnly size={13} />
          </div>
        </div>
      </div>
      {booking.review.comment && (
        <p className="text-xs font-body text-n-600 dark:text-n-400 mt-2 italic">"{booking.review.comment}"</p>
      )}
    </Card>
  );
}

function ReviewsTab() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    travelerService.getBookings().then(setBookings).catch(() => {}).finally(() => setLoading(false));
  }, []);

  function handleSubmitted(reservationId, review) {
    setBookings(prev => prev.map(b => b.id === reservationId ? { ...b, review, can_review: false } : b));
  }

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>;

  const pending = bookings.filter(b => b.can_review);
  const given   = bookings.filter(b => b.review);

  if (!pending.length && !given.length) {
    return (
      <Card>
        <div className="text-center py-10">
          <Star size={32} strokeWidth={1.5} className="mx-auto text-n-300 dark:text-n-600 mb-3" />
          <p className="text-sm font-body text-n-500 dark:text-n-400">Sem avaliacoes por agora — conclua uma reserva para poder avaliar.</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {pending.length > 0 && (
        <div>
          <h3 className="text-xs font-body font-bold uppercase tracking-wide text-n-500 dark:text-n-400 mb-2">Por avaliar ({pending.length})</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {pending.map(b => <PendingReviewCard key={b.id} booking={b} onSubmitted={handleSubmitted} />)}
          </div>
        </div>
      )}
      {given.length > 0 && (
        <div>
          <h3 className="text-xs font-body font-bold uppercase tracking-wide text-n-500 dark:text-n-400 mb-2">As minhas avaliacoes ({given.length})</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {given.map(b => <GivenReviewCard key={b.id} booking={b} />)}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Wishlist ─── */
function WishlistCard({ item, onRemove }) {
  return (
    <Card>
      <div className="flex gap-3">
        <div className="w-20 h-20 rounded-sm bg-n-100 dark:bg-n-700 overflow-hidden shrink-0 flex items-center justify-center">
          {item.images?.[0]
            ? <img src={item.images[0]} alt={item.unit_name} className="w-full h-full object-cover" />
            : <MapPin size={18} strokeWidth={1.5} className="text-n-300 dark:text-n-600" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-bold text-sm text-n-900 dark:text-n-50 truncate">{item.unit_name}</p>
          <p className="text-xs font-body text-n-500 dark:text-n-400">{item.operator_name}</p>
          {!item.still_published && (
            <p className="text-xs font-body text-n-400 dark:text-n-500 mt-1">Ja nao disponivel no catalogo</p>
          )}
          <div className="flex items-center justify-between mt-2">
            <span className="font-mono text-sm font-bold text-ocean-700 dark:text-ocean-300">€{item.base_price ?? '—'}</span>
            <div className="flex gap-1.5">
              {item.still_published && item.operator_slug && (
                <a href={`${APP}/book/${item.operator_slug}/servico/${item.unit_id}`} target="_blank" rel="noopener"
                  className="p-1.5 rounded-sm text-ocean-700 dark:text-ocean-300 hover:bg-ocean-50 dark:hover:bg-n-700" title="Ver / reservar">
                  <ExternalLink size={14} strokeWidth={1.75} />
                </a>
              )}
              <button onClick={() => onRemove(item.unit_id)} className="p-1.5 rounded-sm text-error hover:bg-red-50 dark:hover:bg-red-950" title="Remover">
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
        <div className="w-20 h-20 rounded-sm bg-n-100 dark:bg-n-700 overflow-hidden shrink-0 flex items-center justify-center">
          {item.images?.[0]
            ? <img src={item.images[0]} alt={item.unit_name} className="w-full h-full object-cover" />
            : <MapPin size={18} strokeWidth={1.5} className="text-n-300 dark:text-n-600" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-bold text-sm text-n-900 dark:text-n-50 truncate">{item.unit_name}</p>
          <p className="text-xs font-body text-n-500 dark:text-n-400">{item.operator_name}</p>
          <div className="flex items-center justify-between mt-2">
            <span className="font-mono text-sm font-bold text-ocean-700 dark:text-ocean-300">€{item.base_price ?? '—'}</span>
            <button
              onClick={() => onToggle(item.unit_id, saved)}
              className={`p-1.5 rounded-sm ${saved ? 'text-error' : 'text-n-400 dark:text-n-500 hover:text-error'}`}
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
  const [recommended, setRecommended] = useState({ items: [], personalized: false });
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('');
  const [search, setSearch]     = useState('');

  const loadSaved = useCallback(() => {
    travelerService.getWishlist().then(setSaved).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    loadSaved();
    discoverUnits().then(setExplore).catch(() => {}).finally(() => setLoading(false));
    travelerService.getRecommendations().then(setRecommended).catch(() => {});
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

  const categoryOf = item => item.category_label_pt || item.operator_type;

  const categories = useMemo(() => {
    const counts = {};
    explore.forEach(item => {
      const key = categoryOf(item);
      if (key) counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [explore]);

  const filteredExplore = useMemo(() => {
    const q = search.trim().toLowerCase();
    return explore.filter(item => {
      const matchCategory = !category || categoryOf(item) === category;
      const matchSearch = !q
        || item.unit_name?.toLowerCase().includes(q)
        || item.operator_name?.toLowerCase().includes(q);
      return matchCategory && matchSearch;
    });
  }, [explore, category, search]);

  return (
    <div>
      <div className="inline-flex rounded-sm border border-n-200 dark:border-n-700 bg-white dark:bg-n-800 overflow-hidden mb-4">
        <button
          onClick={() => setView('guardados')}
          className={`px-4 h-8 text-xs font-body font-semibold transition-colors ${view === 'guardados' ? 'bg-ocean-700 text-white' : 'text-n-500 dark:text-n-400 hover:text-n-700 dark:hover:text-n-200'}`}
        >
          Guardados ({saved.length})
        </button>
        <button
          onClick={() => setView('explorar')}
          className={`px-4 h-8 text-xs font-body font-semibold transition-colors border-l border-n-200 dark:border-n-700 ${view === 'explorar' ? 'bg-ocean-700 text-white' : 'text-n-500 dark:text-n-400 hover:text-n-700 dark:hover:text-n-200'}`}
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
              <Heart size={32} strokeWidth={1.5} className="mx-auto text-n-300 dark:text-n-600 mb-3" />
              <p className="text-sm font-body text-n-500 dark:text-n-400">Ainda nao guardou nenhuma experiencia.</p>
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
        <div>
          {recommended.items.length > 0 && (
            <div className="mb-5">
              <p className="text-xs font-body font-bold uppercase tracking-wide text-n-500 dark:text-n-400 mb-2">
                {recommended.personalized ? 'Baseado no que já viu e reservou' : 'Populares agora'}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {recommended.items.map(item => (
                  <ExploreCard key={item.unit_id} item={item} saved={savedIds.has(item.unit_id)} onToggle={handleToggle} />
                ))}
              </div>
            </div>
          )}

          <div className="relative mb-3">
            <Search size={14} strokeWidth={1.75} className="absolute left-3 top-1/2 -translate-y-1/2 text-n-400 dark:text-n-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Pesquisar experiencias..."
              className="w-full h-9 pl-9 pr-3 rounded-sm border border-n-300 dark:border-n-600 text-sm font-body bg-n-100 dark:bg-n-800 text-n-900 dark:text-n-100 placeholder:text-n-400 focus:outline-none focus:ring-2 focus:ring-ocean-300 focus:border-ocean-700 focus:bg-white dark:focus:bg-n-800 transition-colors"
            />
          </div>

          {categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              <button
                onClick={() => setCategory('')}
                className={`px-3 h-7 rounded-full text-xs font-body font-semibold transition-colors ${!category ? 'bg-ocean-700 text-white' : 'bg-white dark:bg-n-800 border border-n-200 dark:border-n-700 text-n-600 dark:text-n-400 hover:border-ocean-300 dark:hover:border-ocean-600'}`}
              >
                Todas ({explore.length})
              </button>
              {categories.map(([key, count]) => (
                <button
                  key={key}
                  onClick={() => setCategory(c => c === key ? '' : key)}
                  className={`px-3 h-7 rounded-full text-xs font-body font-semibold transition-colors ${category === key ? 'bg-ocean-700 text-white' : 'bg-white dark:bg-n-800 border border-n-200 dark:border-n-700 text-n-600 dark:text-n-400 hover:border-ocean-300 dark:hover:border-ocean-600'}`}
                >
                  {key} ({count})
                </button>
              ))}
            </div>
          )}

          {filteredExplore.length === 0 ? (
            <Card>
              <div className="text-center py-10">
                <Search size={28} strokeWidth={1.5} className="mx-auto text-n-300 dark:text-n-600 mb-3" />
                <p className="text-sm font-body text-n-500 dark:text-n-400">Nenhum resultado para este filtro.</p>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredExplore.map(item => (
                <ExploreCard key={item.unit_id} item={item} saved={savedIds.has(item.unit_id)} onToggle={handleToggle} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Notificacoes ─── */
function NotificationRow({ notification, onRead, onNavigate }) {
  function handleClick() {
    if (notification.synthetic) {
      onNavigate('avaliacoes');
      return;
    }
    if (!notification.is_read) onRead(notification.id);
    if (notification.link) window.location.href = notification.link;
  }

  return (
    <button
      onClick={handleClick}
      className={`w-full text-left flex items-start gap-3 px-4 py-3 rounded-md border transition-colors ${
        notification.is_read
          ? 'bg-white dark:bg-n-800 border-n-200 dark:border-n-700'
          : 'bg-ocean-50 dark:bg-n-700 border-ocean-100 dark:border-n-600'
      }`}
    >
      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${notification.is_read ? 'bg-transparent' : 'bg-ocean-600 dark:bg-ocean-300'}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-body text-n-800 dark:text-n-100">{notification.content}</p>
        <p className="text-xs font-body text-n-400 dark:text-n-500 mt-1">{fmtRelative(notification.created_at)}</p>
      </div>
    </button>
  );
}

function NotificationsTab({ notifications, onRead, onNavigate }) {
  if (!notifications) return <div className="flex justify-center py-16"><LoadingSpinner /></div>;

  if (!notifications.items.length) {
    return (
      <Card>
        <div className="text-center py-10">
          <Bell size={32} strokeWidth={1.5} className="mx-auto text-n-300 dark:text-n-600 mb-3" />
          <p className="text-sm font-body text-n-500 dark:text-n-400">Sem notificacoes por agora.</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {notifications.items.map(n => (
        <NotificationRow key={n.id} notification={n} onRead={onRead} onNavigate={onNavigate} />
      ))}
    </div>
  );
}

/* ─── Portal shell (sidebar) ─── */
const NAV_GROUPS = [
  {
    label: 'A minha conta',
    items: [
      { id: 'dashboard', label: 'Dashboard',       icon: LayoutDashboard },
      { id: 'perfil',    label: 'Editar perfil',    icon: User },
      { id: 'password',  label: 'Alterar password', icon: Lock },
    ],
  },
  {
    label: 'Reservas',
    items: [
      { id: 'reservas',   label: 'As minhas reservas', icon: CalendarCheck },
      { id: 'facturas',   label: 'Facturas',           icon: Receipt },
      { id: 'avaliacoes', label: 'Avaliacoes',         icon: Star },
      { id: 'wishlist',   label: 'Wishlist',           icon: Heart },
    ],
  },
];

const TAB_LABEL = {
  ...Object.fromEntries(NAV_GROUPS.flatMap(g => g.items).map(i => [i.id, i.label])),
  notificacoes: 'Notificacoes',
};

const THEME_OPTIONS = [
  { value: 'light',  label: 'Claro' },
  { value: 'dark',   label: 'Escuro' },
  { value: 'system', label: 'Automatico' },
];

export default function TravelerPortal() {
  useThemeEffect();
  const { traveler, setTraveler, logout } = useTravelerAuthStore();
  const { theme, setTheme } = useUiStore();
  const navigate = useNavigate();
  const [tab, setTab] = useState('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState(null);

  const loadNotifications = useCallback(() => {
    travelerService.getNotifications().then(setNotifications).catch(() => {});
  }, []);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  async function handleMarkRead(id) {
    setNotifications(prev => prev && {
      items: prev.items.map(n => n.id === id ? { ...n, is_read: true } : n),
      unreadCount: Math.max(0, prev.unreadCount - 1),
    });
    try { await travelerService.markNotificationRead(id); } catch { loadNotifications(); }
  }

  async function handleLogout() {
    await apiLogout();
    logout();
    navigate('/viajante/entrar');
  }

  function goTo(id) {
    setTab(id);
    setMobileOpen(false);
  }

  return (
    <div className="flex h-screen bg-n-50 dark:bg-n-900 overflow-hidden">
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={[
        'fixed md:relative z-40 h-full w-64 bg-white dark:bg-n-800 border-r border-n-200 dark:border-n-700 flex flex-col shrink-0 transition-transform duration-200',
        mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
      ].join(' ')}>
        <div className="px-4 py-4 border-b border-n-200 dark:border-n-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo size="sm" dark />
            <span className="text-xs font-body font-bold uppercase tracking-wide text-ocean-600 dark:text-ocean-300 flex items-center gap-1">
              <Compass size={12} strokeWidth={2} /> Conect
            </span>
          </div>
          <button onClick={() => setMobileOpen(false)} className="md:hidden text-n-400 dark:text-n-500 hover:text-n-700 dark:hover:text-n-200 p-1" aria-label="Fechar">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <div className="relative border-b border-n-200 dark:border-n-700">
          <button
            onClick={() => setProfileMenuOpen(o => !o)}
            className="w-full px-4 py-3 flex items-center gap-2.5 hover:bg-n-50 dark:hover:bg-n-700 transition-colors"
          >
            <div className="w-9 h-9 rounded-full bg-ocean-700 text-white flex items-center justify-center font-display font-bold text-xs shrink-0 overflow-hidden">
              {traveler?.avatar_url
                ? <img src={traveler.avatar_url} alt={traveler.name} className="w-full h-full object-cover" />
                : initials(traveler?.name)}
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="text-sm font-body font-semibold text-n-900 dark:text-n-50 truncate">{traveler?.name}</p>
              <p className="text-xs font-body text-n-400 dark:text-n-500 truncate">{traveler?.email}</p>
            </div>
            {notifications?.unreadCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-error shrink-0" />
            )}
          </button>

          {profileMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setProfileMenuOpen(false)} />
              <div className="absolute left-3 right-3 top-full mt-1 z-50 bg-white dark:bg-n-800 border border-n-200 dark:border-n-700 rounded-md shadow-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-n-100 dark:border-n-700">
                  <p className="text-sm font-body font-semibold text-n-900 dark:text-n-50 truncate">{traveler?.name}</p>
                  <p className="text-xs font-body text-n-400 dark:text-n-500 truncate">{traveler?.email}</p>
                </div>

                <button
                  onClick={() => { goTo('notificacoes'); setProfileMenuOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-body text-n-700 dark:text-n-300 hover:bg-n-50 dark:hover:bg-n-700 transition-colors"
                >
                  <Bell size={16} strokeWidth={1.75} className="shrink-0" />
                  <span className="flex-1 text-left">Atualizacoes</span>
                  {notifications?.unreadCount > 0 && (
                    <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-error text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                      {notifications.unreadCount}
                    </span>
                  )}
                </button>

                <div className="px-4 py-2.5 border-t border-n-100 dark:border-n-700">
                  <p className="text-[10px] font-body font-bold uppercase tracking-wider text-n-400 dark:text-n-500 mb-1.5 flex items-center gap-1.5">
                    <Sun size={12} strokeWidth={1.75} /> Aparencia
                  </p>
                  <div className="flex gap-1.5">
                    {THEME_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setTheme(opt.value)}
                        className={`flex-1 px-2 py-1.5 rounded-sm text-xs font-body font-semibold transition-colors ${
                          theme === opt.value
                            ? 'bg-ocean-700 text-white'
                            : 'bg-n-100 dark:bg-n-700 text-n-600 dark:text-n-300 hover:bg-n-200 dark:hover:bg-n-600'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => { goTo('perfil'); setProfileMenuOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-body text-n-700 dark:text-n-300 hover:bg-n-50 dark:hover:bg-n-700 transition-colors border-t border-n-100 dark:border-n-700"
                >
                  <Settings size={16} strokeWidth={1.75} className="shrink-0" />
                  <span className="flex-1 text-left">Definicoes</span>
                </button>

                <a
                  href="mailto:hello@saldesk.cv"
                  onClick={() => setProfileMenuOpen(false)}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-body text-n-700 dark:text-n-300 hover:bg-n-50 dark:hover:bg-n-700 transition-colors"
                >
                  <HelpCircle size={16} strokeWidth={1.75} className="shrink-0" />
                  <span className="flex-1 text-left">Apoio</span>
                </a>

                <button
                  onClick={() => {
                    const estado = window.installPwa?.();
                    setProfileMenuOpen(false);
                    if (estado === 'already-installed') window.alert('Ja tens a aplicacao instalada.');
                    else if (estado === 'ios') window.alert('Para instalar: toca em Partilhar (o icone do quadrado com a seta) e depois em "Adicionar ao Ecra Principal".');
                    else if (estado === 'unsupported') window.alert('O teu navegador nao suporta instalacao directa. Usa o menu do navegador para adicionar esta pagina ao ecra principal ou aos favoritos.');
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-body text-n-700 dark:text-n-300 hover:bg-n-50 dark:hover:bg-n-700 transition-colors"
                >
                  <Download size={16} strokeWidth={1.75} className="shrink-0" />
                  <span className="flex-1 text-left">Transferir a aplicacao</span>
                </button>

                <button
                  onClick={() => { setProfileMenuOpen(false); handleLogout(); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-body text-error hover:bg-red-50 dark:hover:bg-red-950 transition-colors border-t border-n-100 dark:border-n-700"
                >
                  <LogOut size={16} strokeWidth={1.75} className="shrink-0" />
                  <span className="flex-1 text-left">Encerrar sessao</span>
                </button>
              </div>
            </>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
          {NAV_GROUPS.map(group => (
            <div key={group.label}>
              <p className="px-3 mb-1 text-[10px] font-body font-bold uppercase tracking-wider text-n-400 dark:text-n-500">{group.label}</p>
              <div className="space-y-0.5">
                {group.items.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => goTo(id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-sm text-sm font-body font-medium transition-colors ${
                      tab === id ? 'bg-ocean-50 dark:bg-n-700 text-ocean-700 dark:text-ocean-300' : 'text-n-600 dark:text-n-400 hover:bg-n-50 dark:hover:bg-n-700'
                    }`}
                  >
                    <Icon size={16} strokeWidth={1.75} className="shrink-0" />
                    <span className="flex-1 text-left">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className="md:hidden sticky top-0 z-20 bg-white dark:bg-n-800 border-b border-n-200 dark:border-n-700 px-4 h-14 flex items-center gap-3">
          <button onClick={() => setMobileOpen(true)} className="text-n-600 dark:text-n-400" aria-label="Abrir menu">
            <Menu size={20} strokeWidth={1.75} />
          </button>
          <span className="font-display font-bold text-sm text-n-900 dark:text-n-50">{TAB_LABEL[tab]}</span>
        </div>

        <div className="max-w-4xl w-full mx-auto px-4 py-6 md:py-8">
          <h1 className="hidden md:block font-display font-bold text-xl text-n-900 dark:text-n-50 mb-6">{TAB_LABEL[tab]}</h1>

          {tab === 'dashboard'   && <DashboardTab traveler={traveler} onNavigate={goTo} />}
          {tab === 'perfil'      && <EditProfileTab traveler={traveler} onUpdate={setTraveler} />}
          {tab === 'password'    && <ChangePasswordTab />}
          {tab === 'reservas'    && <BookingsTab onNavigate={goTo} />}
          {tab === 'facturas'    && <InvoicesTab />}
          {tab === 'avaliacoes'  && <ReviewsTab />}
          {tab === 'wishlist'    && <WishlistTab />}
          {tab === 'notificacoes' && <NotificationsTab notifications={notifications} onRead={handleMarkRead} onNavigate={goTo} />}
        </div>
      </div>
    </div>
  );
}
