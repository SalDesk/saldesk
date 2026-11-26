import { useState, useEffect, useRef } from 'react';
import {
  Plus, Pencil, Trash2, Star, Camera, Upload, X, Tag,
  Briefcase, Search,
  Users, Shield, UserPlus, CheckCircle,
} from 'lucide-react';
import {
  listStaff, createStaff, updateStaff, deleteStaff,
  getStaffJobs, setAvailability,
} from '../services/staffService';
import { listUnits } from '../services/unitsService';
import { listReservations } from '../services/reservationsService';
import { createAssignment } from '../services/assignmentService';
import AssignCompositeModal from '../components/assignments/AssignCompositeModal';
import useAuthStore from '../store/authStore';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input, { Textarea, Select } from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import FilterChips from '../components/ui/FilterChips';
import Tabs from '../components/ui/Tabs';
import Table from '../components/ui/Table';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import MareStat from '../components/shared/MareStat';
import { useT } from '../i18n';
import { mensagemErro } from '../utils/mensagemErro';
import { formatarData, useLingua } from '../utils/formatoLingua';
import { DAYS, CARGO_VENDEDOR, rotuloCargo, rotuloDia } from './staff/shared';
import { IconBtn, EDIT_HOVER, DELETE_HOVER } from '../components/shared/IconBtn';

const LANGUAGES   = ['PT', 'EN', 'DE', 'NL', 'FR', 'ES'];
/* Funcoes gravadas tal como estao; o ecra mostra o rotulo de staff.roles */
const GUIDE_ROLES = ['Guia', 'Instrutor', 'Guia-Instrutor', 'Assistente', 'Outro'];
/* O texto gravado nas certificacoes e o da lista; isto e so o que se le no ecra (guides.certs). */
const CERT_CHAVE = { 'Guia Turistico Certificado': 'guiaTuristico', 'Primeiros Socorros': 'primeirosSocorros', 'CPR / DAE': 'cprDae' };
const certRotulo = (c, t) => (CERT_CHAVE[c] ? t(`guides.certs.${CERT_CHAVE[c]}`) : c);

const PRESET_CERTS = [
  'PADI Open Water', 'PADI Advanced', 'PADI Rescue Diver',
  'IKO Kitesurf', 'ACSI Kitesurf', 'Surf Coach',
  'Primeiros Socorros', 'CPR / DAE', 'Guia Turistico Certificado',
];

/* Cada estado do guia usa uma variante do Badge do sistema */
const STATUS_META = {
  active:    { rotulo: 'guides.status.active',   variant: 'confirmed'  },
  busy:      { rotulo: 'guides.status.busy',     variant: 'checked_in' },
  day_off:   { rotulo: 'guides.status.dayOff',   variant: 'direct'     },
  inactive:  { rotulo: 'guides.status.inactive', variant: 'cancelled'  },
};

/* Etiqueta de grupo de campos: igual a etiqueta dos campos do sistema */
const GROUP_LABEL = 'text-xs font-body font-bold uppercase tracking-wide text-n-600 mb-2 app:normal-case app:tracking-normal app:text-[13px] app:text-n-700';

const DOT_META = {
  active:   'bg-[var(--success)]',
  busy:     'bg-ocean-500',
  day_off:  'bg-sand-500',
  inactive: 'bg-n-300',
};

/* ───────── Avatar ───────── */
function GuideAvatar({ guide, size = 40 }) {
  const initials = guide.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const dot = DOT_META[guide.status] || DOT_META.inactive;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {guide.photo_url ? (
        <img src={guide.photo_url} alt={guide.name}
          className="w-full h-full rounded-full object-cover" />
      ) : (
        <div className="w-full h-full rounded-full bg-ocean-700 flex items-center justify-center text-white font-display font-bold"
          style={{ fontSize: Math.round(size * 0.36) }}>
          {initials}
        </div>
      )}
      <span className={`absolute bottom-0 right-0 rounded-full border-2 border-white ${size >= 36 ? 'w-3 h-3' : 'w-2.5 h-2.5'} ${dot}`} />
    </div>
  );
}

/* ───────── Card ───────── */
function GuideCard({ guide, units, onEdit, onDelete, onHistory, onAssign }) {
  const t = useT();
  const lang = useLingua();
  const langs  = guide.languages || [];
  const certs  = guide.certifications || guide.skills || [];
  const rating = Number(guide.average_rating || 0);
  const statusMeta = STATUS_META[guide.status] || STATUS_META.inactive;

  return (
    <div className="flex flex-col overflow-hidden rounded-[18px] border border-mare-card bg-white">
      <div className="p-4 flex items-start gap-3">
        <GuideAvatar guide={guide} size={52} />
        <div className="flex-1 min-w-0">
          <p className="font-display font-semibold text-sm text-n-900 truncate">{guide.name}</p>
          <p className="text-xs font-body text-n-500 mt-0.5">{rotuloCargo(guide.role, t, lang)}</p>
          <div className="flex items-center gap-2 mt-1.5">
            {rating > 0 && (
              <span className="flex items-center gap-1 text-xs font-mono text-n-700 tabular-nums">
                <Star size={11} strokeWidth={0} className="fill-sand-500 text-sand-500" />
                {rating.toFixed(1)}
              </span>
            )}
            <span className="flex items-center gap-1 text-xs font-body text-n-500 tabular-nums">
              <Briefcase size={11} strokeWidth={1.75} className="text-n-400" />
              {t('guides.card.tours', { n: guide.total_jobs_completed || 0 })}
            </span>
          </div>
        </div>
        <div className="flex gap-0.5 shrink-0">
          <IconBtn icon={Pencil} label={t('common.edit')} hover={EDIT_HOVER} onClick={() => onEdit(guide)} />
          <IconBtn icon={Trash2} label={t('common.delete')} hover={DELETE_HOVER} onClick={() => onDelete(guide)} />
        </div>
      </div>

      <div className="px-4 pb-3 flex-1 space-y-3">
        {langs.length > 0 && (
          <div>
            <p className="text-xs font-body font-medium text-n-500 mb-1.5">{t('guides.card.languages')}</p>
            <div className="flex flex-wrap gap-1">
              {langs.map(l => (
                <span key={l}
                  className="text-xs font-mono font-medium px-2 py-0.5 bg-ocean-50 text-ocean-700 border border-ocean-100 rounded-full uppercase">
                  {l}
                </span>
              ))}
            </div>
          </div>
        )}
        {certs.length > 0 && (
          <div>
            <p className="text-xs font-body font-medium text-n-500 mb-1.5">{t('guides.card.certifications')}</p>
            <div className="flex flex-wrap gap-1">
              {certs.slice(0, 3).map(c => (
                <span key={c}
                  className="text-xs font-body px-2 py-0.5 bg-mare-head text-n-600 border border-mare-card rounded-full">
                  {certRotulo(c, t)}
                </span>
              ))}
              {certs.length > 3 && (
                <span className="text-xs font-body px-2 py-0.5 bg-n-100 text-n-500 rounded-full">
                  +{certs.length - 3}
                </span>
              )}
            </div>
          </div>
        )}
        {guide.bio && (
          <p className="text-xs font-body text-n-600 line-clamp-2 leading-relaxed">{guide.bio}</p>
        )}
      </div>

      <div className="px-4 py-3 border-t border-mare-card flex items-center justify-between gap-2">
        <Badge variant={statusMeta.variant} className="whitespace-nowrap">{t(statusMeta.rotulo)}</Badge>
        <div className="flex gap-1.5">
          <Button variant="secondary" size="sm" onClick={() => onAssign(guide)}>
            <UserPlus size={12} strokeWidth={1.75} className="mr-1" />
            {t('guides.card.assign')}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => onHistory(guide)}>
            {t('guides.card.history')}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ───────── Form ───────── */
/* Funcao, certificacoes e dias gravam o valor da lista (portugues); so o texto mostrado muda com a lingua. */
function GuideForm({ guide, units, onSave, onCancel, loading, error }) {
  const t = useT();
  const lang = useLingua();
  const meta = guide?.guide_meta
    ? (() => { try { return JSON.parse(guide.guide_meta); } catch { return {}; } })()
    : {};

  const [form, setForm]     = useState({
    name:     guide?.name     || '',
    role:     guide?.role     || 'Guia',
    phone:    guide?.phone    || '',
    email:    guide?.email    || '',
    whatsapp: guide?.whatsapp || '',
    status:   guide?.status   || 'active',
    bio:      guide?.bio || meta.bio || '',
  });
  const [photoPreview, setPhotoPreview] = useState(guide?.photo_url || null);
  const [languages,    setLanguages]    = useState(guide?.languages || meta.languages || []);
  const [certs,        setCerts]        = useState(guide?.certifications || guide?.skills || meta.certifications || []);
  const [schedule,     setSchedule]     = useState(guide?.schedule || meta.schedule || []);
  const [tourIds,      setTourIds]      = useState(guide?.tour_ids || meta.tour_ids || []);
  const [certInput,    setCertInput]    = useState('');
  const [createAccess, setCreateAccess] = useState(false);
  const fileRef = useRef(null);

  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result);
    reader.readAsDataURL(file);
  }

  function toggleLang(l)  { setLanguages(p => p.includes(l) ? p.filter(x => x !== l) : [...p, l]); }
  function toggleCert(c)  { setCerts(p => p.includes(c) ? p.filter(x => x !== c) : [...p, c]); }
  function toggleDay(d)   { setSchedule(p => p.includes(d) ? p.filter(x => x !== d) : [...p, d]); }
  function toggleTour(id) { setTourIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]); }

  function addCustomCert(e) {
    if (e.key === 'Enter' && certInput.trim()) {
      e.preventDefault();
      if (!certs.includes(certInput.trim())) setCerts(p => [...p, certInput.trim()]);
      setCertInput('');
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSave({
      ...form,
      photo_url: photoPreview || guide?.photo_url || null,
      languages,
      certifications: certs,
      skills: certs,
      schedule,
      tour_ids: tourIds,
      create_access: createAccess,
      guide_meta: JSON.stringify({ bio: form.bio, languages, certifications: certs, schedule, tour_ids: tourIds }),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Photo */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-full bg-n-100 border-2 border-n-200 overflow-hidden flex items-center justify-center">
            {photoPreview
              ? <img src={photoPreview} alt="" className="w-full h-full object-cover" />
              : <Camera size={20} strokeWidth={1.75} className="text-n-400" />}
          </div>
          <button type="button" onClick={() => fileRef.current?.click()} aria-label={t('staff.form.uploadPhoto')}
            className="absolute -bottom-1 -right-1 w-6 h-6 bg-ocean-700 text-white rounded-full flex items-center justify-center hover:bg-ocean-500 transition-colors">
            <Upload size={10} strokeWidth={2} />
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
        </div>
        <div>
          <p className="text-sm font-display font-semibold text-n-800">{t('guides.form.photo')}</p>
          <p className="text-xs font-body text-n-500">{t('staff.form.photoHint')}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input label={t('staff.form.fullName')} value={form.name} onChange={set('name')} required placeholder={t('staff.form.namePlaceholder')} />
        <Select label={t('guides.form.role')} value={form.role} onChange={set('role')} required>
          {GUIDE_ROLES.map(r => <option key={r} value={r}>{rotuloCargo(r, t, lang)}</option>)}
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input label={t('staff.form.phone')} value={form.phone} onChange={set('phone')} type="tel" placeholder="+238 900 0000" />
        <Input label={t('staff.form.whatsapp')} value={form.whatsapp} onChange={set('whatsapp')} type="tel" placeholder="+238 900 0000" />
      </div>
      <Input label={t('staff.form.email')} value={form.email} onChange={set('email')} type="email" placeholder={t('guides.form.emailPlaceholder')} />

      {/* Languages */}
      <div>
        <p className={GROUP_LABEL}>{t('guides.card.languages')}</p>
        <div className="flex gap-2 flex-wrap">
          {LANGUAGES.map(l => (
            <label key={l} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm border text-xs font-body font-medium cursor-pointer transition-colors select-none ${
              languages.includes(l) ? 'bg-ocean-700 border-ocean-700 text-white' : 'bg-n-50 border-n-300 text-n-600 hover:border-ocean-500'
            }`}>
              <input type="checkbox" className="sr-only" checked={languages.includes(l)} onChange={() => toggleLang(l)} />
              {l}
            </label>
          ))}
        </div>
      </div>

      {/* Certifications */}
      <div>
        <p className={GROUP_LABEL}>{t('guides.card.certifications')}</p>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {PRESET_CERTS.map(c => (
            <button key={c} type="button" onClick={() => toggleCert(c)}
              className={`px-2.5 py-1 rounded-sm text-xs font-body transition-colors border ${
                certs.includes(c) ? 'bg-ocean-50 border-ocean-300 text-ocean-700' : 'bg-n-50 border-n-200 text-n-600 hover:border-n-400'
              }`}>
              {certRotulo(c, t)}
            </button>
          ))}
        </div>
        {certs.filter(c => !PRESET_CERTS.includes(c)).map(c => (
          <span key={c} className="inline-flex items-center gap-1 mr-1.5 mb-1.5 px-2 py-0.5 bg-sand-50 text-sand-600 border border-sand-200 rounded-xs text-xs font-body">
            <Tag size={9} strokeWidth={1.75} />{c}
            <button type="button" onClick={() => setCerts(p => p.filter(x => x !== c))} aria-label={t('guides.form.remove')}><X size={9} strokeWidth={2} /></button>
          </span>
        ))}
        <Input type="text" value={certInput} onChange={e => setCertInput(e.target.value)} onKeyDown={addCustomCert}
          placeholder={t('guides.form.otherCert')} />
      </div>

      {/* Tours */}
      {units.length > 0 && (
        <div>
          <p className={GROUP_LABEL}>{t('guides.form.tours')}</p>
          <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto">
            {units.map(u => (
              <label key={u.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-sm border cursor-pointer transition-colors ${
                tourIds.includes(u.id) ? 'bg-ocean-50 border-ocean-200' : 'bg-n-50 border-n-200 hover:border-n-300'
              }`}>
                <input type="checkbox" className="w-3.5 h-3.5 accent-ocean-700" checked={tourIds.includes(u.id)} onChange={() => toggleTour(u.id)} />
                <span className="text-sm font-body text-n-800">{u.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Schedule */}
      <div>
        <p className={GROUP_LABEL}>{t('guides.form.days')}</p>
        <div className="flex gap-1.5 flex-wrap">
          {DAYS.map(d => (
            <button key={d} type="button" onClick={() => toggleDay(d)}
              className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors ${
                schedule.includes(d) ? 'bg-ocean-700 text-white' : 'bg-n-100 text-n-600 hover:bg-n-200'
              }`}>
              {rotuloDia(d, t)}
            </button>
          ))}
        </div>
      </div>

      <Textarea label={t('guides.form.bio')} value={form.bio} onChange={set('bio')} rows={2}
        placeholder={t('guides.form.bioPlaceholder')} />

      {guide && (
        <Select label={t('staff.form.status')} value={form.status} onChange={set('status')}>
          {Object.entries(STATUS_META).map(([v, m]) => <option key={v} value={v}>{t(m.rotulo)}</option>)}
        </Select>
      )}

      {/* Staff account */}
      {!guide && (
        <div className="border border-n-200 rounded-md p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield size={15} strokeWidth={1.75} className="text-ocean-700" />
              <span className="text-sm font-display font-semibold text-n-800">{t('staff.form.createAccess')}</span>
            </div>
            <button type="button" onClick={() => setCreateAccess(!createAccess)} aria-label={t('staff.form.createAccess')}
              className={`w-10 h-5 rounded-full transition-colors relative ${createAccess ? 'bg-ocean-700' : 'bg-n-300'}`}>
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${createAccess ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </div>
          {createAccess && (
            <p className="text-xs font-body text-n-500 bg-n-50 rounded p-2">
              {t('guides.form.accessHint')}
            </p>
          )}
        </div>
      )}

      {error && <p className="text-sm font-body px-3 py-2 rounded-sm bg-[var(--error-light)] text-[var(--error)]">{error}</p>}

      <div className="flex gap-3 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">{t('common.cancel')}</Button>
        <Button type="submit" loading={loading} className="flex-1">
          {guide ? t('staff.form.saveChanges') : t('guides.add')}
        </Button>
      </div>
    </form>
  );
}

/* ───────── History Modal ───────── */
function HistoryModal({ guide, onClose }) {
  const t = useT();
  const lang = useLingua();
  const [jobs,    setJobs]    = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!guide) return;
    getStaffJobs(guide.id)
      .then(setJobs)
      .catch(() => setJobs([]))
      .finally(() => setLoading(false));
  }, [guide?.id]);

  const STATUS_LABEL = {
    pending: t('guides.history.status.pending'), confirmed: t('guides.history.status.confirmed'),
    in_progress: t('guides.history.status.inProgress'), completed: t('guides.history.status.completed'),
    cancelled: t('guides.history.status.cancelled'),
  };
  const STATUS_VARIANT = {
    completed: 'confirmed',
    cancelled: 'cancelled',
    pending:   'pending',
    confirmed: 'checked_in',
    in_progress: 'checked_in',
  };

  const totalEarned = jobs.filter(j => j.status === 'completed').reduce((s, j) => s + Number(j.earnings_amount || 0), 0);

  return (
    <Modal open={!!guide} onClose={onClose} title={t('guides.history.title', { name: guide?.name })} size="md">
      {loading ? (
        <div className="flex justify-center py-10"><LoadingSpinner size={24} /></div>
      ) : jobs.length === 0 ? (
        <EmptyState icon={Briefcase} title={t('guides.history.empty')} />
      ) : (
        <>
          {totalEarned > 0 && (
            <div className="mb-4 px-4 py-3 bg-mare-head border border-mare-card rounded-[14px] flex items-center justify-between">
              <span className="text-xs font-body font-medium text-ocean-600">{t('guides.history.totalEarned')}</span>
              <span className="font-mono font-bold text-ocean-700 tabular-nums">€{totalEarned.toFixed(2)}</span>
            </div>
          )}
          <div className="space-y-2">
            {jobs.map(job => (
              <div key={job.id} className="flex items-start justify-between gap-3 p-3 bg-mare-head rounded-[14px] border border-mare-card">
                <div className="min-w-0">
                  <p className="text-sm font-display font-semibold text-n-900 truncate">
                    {job.reservations?.units?.name || job.reservation_id?.slice(0, 8) || '—'}
                  </p>
                  <p className="text-xs font-mono tabular-nums text-n-500 mt-0.5">
                    {job.assigned_at ? formatarData(new Date(job.assigned_at), {}, lang) : '—'}
                  </p>
                  {job.earnings_amount > 0 && (
                    <p className="text-xs font-mono tabular-nums text-ocean-700 mt-0.5">€{Number(job.earnings_amount).toFixed(2)}</p>
                  )}
                </div>
                <Badge variant={STATUS_VARIANT[job.status] || 'default'} className="whitespace-nowrap shrink-0">
                  {STATUS_LABEL[job.status] || job.status}
                </Badge>
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}

/* ───────── Assign Modal ───────── */
function AssignModal({ guide, reservations, onClose, onDone }) {
  const t = useT();
  const [selected, setSelected] = useState('');
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');

  const upcoming = reservations.filter(r =>
    ['pending', 'confirmed'].includes(r.status) &&
    r.check_in >= new Date().toISOString().split('T')[0]
  ).sort((a, b) => a.check_in.localeCompare(b.check_in));

  async function handleAssign() {
    if (!selected) return;
    setSaving(true); setError('');
    try {
      await createAssignment({ staff_id: guide.id, reservation_id: selected });
      onDone();
    } catch (err) {
      setError(mensagemErro(err, t, t('guides.assign.error')));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={!!guide} onClose={onClose} title={t('guides.assign.title', { name: guide?.name })} size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={handleAssign} loading={saving} disabled={!selected}>{t('guides.card.assign')}</Button>
        </>
      }>
      <div className="space-y-3">
        {upcoming.length === 0 ? (
          <p className="text-sm font-body text-n-500 text-center py-4">{t('guides.assign.none')}</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {upcoming.map(r => (
              <label key={r.id}
                className={`flex items-start gap-3 p-3 rounded-sm border cursor-pointer transition-colors ${
                  selected === r.id ? 'bg-ocean-50 border-ocean-300' : 'bg-n-50 border-n-200 hover:border-n-300'
                }`}>
                <input type="radio" name="res" value={r.id} checked={selected === r.id}
                  onChange={() => setSelected(r.id)} className="mt-0.5 accent-ocean-700" />
                <div>
                  <p className="text-sm font-display font-semibold text-n-900">
                    {r.units?.name || r.unit_id?.slice(0, 8)}
                  </p>
                  <p className="text-xs font-body text-n-500 mt-0.5">
                    {r.check_in} · {t('guides.assign.pax', { n: r.guests })} · {r.customer_name || '—'}
                  </p>
                </div>
              </label>
            ))}
          </div>
        )}
        {error && <p className="text-xs font-body text-error">{error}</p>}
      </div>
    </Modal>
  );
}

/* ───────── Weekly Availability View ───────── */
function AvailabilityTab({ guides }) {
  const t = useT();
  const lang = useLingua();
  const [savingId, setSavingId] = useState(null);

  const TODAY     = new Date();
  const MON_OFFSET = (TODAY.getDay() + 6) % 7;
  const weekDates  = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(TODAY);
    d.setDate(TODAY.getDate() - MON_OFFSET + i);
    return d.toISOString().split('T')[0];
  });

  const [avail, setAvail] = useState({});

  async function toggle(guideId, dateStr) {
    const key = `${guideId}_${dateStr}`;
    const cur = avail[key] ?? true;
    setSavingId(key);
    try {
      await setAvailability(guideId, { date: dateStr, is_available: !cur });
      setAvail(p => ({ ...p, [key]: !cur }));
    } catch {
      // silent
    } finally {
      setSavingId(null);
    }
  }

  const todayStr   = TODAY.toISOString().split('T')[0];

  if (guides.length === 0) {
    return (
      <Card padding="p-0">
        <EmptyState icon={Users} title={t('guides.availability.empty')} />
      </Card>
    );
  }

  /* Colunas: o guia e um dia da semana cada; as celulas de disponibilidade sao botoes proprios */
  const columns = [
    {
      key: 'guia',
      label: t('guides.availability.guide'),
      width: 160,
      render: (g) => (
        <div className="flex items-center gap-2.5">
          <GuideAvatar guide={g} size={28} />
          <div>
            <p className="font-body font-semibold text-n-800 text-xs truncate max-w-[90px]">{g.name.split(' ')[0]}</p>
            <p className="font-body text-n-400 text-xs">{rotuloCargo(g.role, t, lang)}</p>
          </div>
        </div>
      ),
    },
    ...weekDates.map((d, i) => {
      const isToday = d === todayStr;
      const dayNum  = parseInt(d.slice(8), 10);
      return {
        key: d,
        label: (
          <div className="flex flex-col items-center">
            <span className={isToday
              ? 'inline-flex items-center justify-center min-w-[22px] h-[22px] px-1 rounded-full bg-ocean-700 text-white font-display font-semibold tabular-nums'
              : 'font-display font-semibold text-n-700 tabular-nums'}>{dayNum}</span>
            <span className="font-body text-n-400 font-normal">{rotuloDia(DAYS[i], t)}</span>
          </div>
        ),
        align: 'center',
        width: 72,
        render: (g) => {
          const key  = `${g.id}_${d}`;
          const isAv = avail[key] ?? true;
          const isSaving = savingId === key;
          return (
            <button
              onClick={() => toggle(g.id, d)}
              disabled={isSaving}
              title={isAv ? t('guides.availability.availableTitle') : t('guides.availability.unavailableTitle')}
              className={`w-11 h-11 md:w-8 md:h-8 mx-auto rounded-sm flex items-center justify-center transition-colors ${
                isAv
                  ? 'bg-[var(--success-light)] text-[var(--success)] hover:brightness-95'
                  : 'bg-n-100 text-n-400 hover:bg-n-200'
              } ${isSaving ? 'opacity-50' : ''}`}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${isAv ? 'bg-[var(--success)]' : 'bg-n-300'}`} />
            </button>
          );
        },
      };
    }),
  ];

  return (
    <div className="overflow-x-auto rounded-[18px] border border-mare-card bg-white">
      <div style={{ minWidth: 620 }}>
        <Table columns={columns} rows={guides} />
      </div>
      <div className="flex items-center gap-4 px-4 py-2.5 border-t border-mare-card bg-mare-head">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-[var(--success-light)] border border-[var(--success)] inline-block" />
          <span className="text-xs font-body text-n-500">{t('guides.availability.available')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-n-100 border border-n-200 inline-block" />
          <span className="text-xs font-body text-n-500">{t('guides.availability.unavailable')}</span>
        </div>
        <span className="text-xs font-body text-n-400 ml-auto">{t('guides.availability.toggleHint')}</span>
      </div>
    </div>
  );
}

/* ───────── Main Page ───────── */
export default function Guides() {
  const t = useT();
  const lang = useLingua();
  const { operator } = useAuthStore();
  const [tab,          setTab]          = useState('lista');
  const [guides,       setGuides]       = useState([]);
  const [units,        setUnits]        = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [modal,        setModal]        = useState(null);
  const [formLoading,  setFormLoading]  = useState(false);
  const [formError,    setFormError]    = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [historyGuide, setHistoryGuide] = useState(null);
  const [assignGuide,  setAssignGuide]  = useState(null);
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    Promise.all([listStaff(), listUnits(), listReservations({})])
      .then(([staff, uns, res]) => {
        setGuides((staff || []).filter(s => s.role !== CARGO_VENDEDOR));
        setUnits(uns.filter(u => u.status === 'active' || u.is_active));
        setReservations(res);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(dados) {
    setFormError(''); setFormLoading(true);
    try {
      if (modal === 'create') {
        const g = await createStaff(dados);
        setGuides(p => [g, ...p]);
      } else {
        const g = await updateStaff(modal.id, dados);
        setGuides(p => p.map(x => x.id === g.id ? g : x));
      }
      setModal(null);
    } catch (err) {
      setFormError(mensagemErro(err, t, t('staff.errors.save')));
    } finally { setFormLoading(false); }
  }

  async function handleDelete() {
    try {
      await deleteStaff(deleteTarget.id);
      setGuides(p => p.filter(x => x.id !== deleteTarget.id));
    } catch (err) { console.error(err); }
    finally { setDeleteTarget(null); }
  }

  const filtered = guides.filter(g => {
    if (statusFilter && g.status !== statusFilter) return false;
    /* a funcao procura-se pelo valor gravado e pelo rotulo na lingua do painel */
    if (search && !g.name.toLowerCase().includes(search.toLowerCase()) &&
        !(g.role || '').toLowerCase().includes(search.toLowerCase()) &&
        !String(rotuloCargo(g.role, t, lang) || '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const active = guides.filter(g => g.status === 'active').length;
  const ocupados = guides.filter(g => g.status === 'busy').length;

  const TABS = [
    { id: 'lista',           label: t('guides.tabs.list') },
    { id: 'disponibilidade', label: t('guides.tabs.availability') },
  ];

  /* Chips de estado: Todos primeiro, depois um por estado do guia */
  const STATUS_OPTIONS = ['', 'active', 'busy', 'day_off', 'inactive'].map(s => ({
    value: s,
    label: s === '' ? t('guides.all') : t(STATUS_META[s].rotulo),
  }));

  return (
    <div>
      <PageHeader
        eyebrow={t('nav.sections.operacao')}
        title={t('guides.title')}
        subtitle={t('guides.subtitle', { active, n: guides.length })}
        actions={
          tab === 'lista' && (
            <Button icon={Plus} onClick={() => { setFormError(''); setModal('create'); }}>
              {t('guides.add')}
            </Button>
          )
        }
      />

      {!loading && guides.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <MareStat label={t('guides.stats.total')} value={guides.length} icon={Users} />
          <MareStat label={t('guides.stats.active')} value={active} icon={CheckCircle} tone="bom" />
          <MareStat label={t('guides.stats.busy')} value={ocupados} icon={Briefcase} tone="aviso" />
        </div>
      )}

      {/* Tab bar */}
      <div className="mb-5">
        <Tabs tabs={TABS} value={tab} onChange={setTab} />
      </div>

      {tab === 'lista' && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-5 items-center">
            <div className="relative">
              <Search size={14} strokeWidth={1.75} className="absolute left-3 top-1/2 -translate-y-1/2 text-n-400" />
              <Input value={search} onChange={e => setSearch(e.target.value)}
                placeholder={t('guides.search')} className="pl-8" />
            </div>
            <FilterChips options={STATUS_OPTIONS} value={statusFilter} onChange={setStatusFilter} />
          </div>

          {loading ? (
            <div className="flex justify-center py-20"><LoadingSpinner size={32} /></div>
          ) : filtered.length === 0 && !search && !statusFilter ? (
            <Card padding="p-0">
              <EmptyState
                icon={Users}
                title={t('guides.emptyTitle')}
                description={t('guides.emptyDesc')}
              />
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(g => (
                <GuideCard key={g.id} guide={g} units={units}
                  onEdit={g => { setFormError(''); setModal(g); }}
                  onDelete={setDeleteTarget}
                  onHistory={setHistoryGuide}
                  onAssign={setAssignGuide}
                />
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'disponibilidade' && (
        <AvailabilityTab guides={guides.filter(g => g.status !== 'inactive')} />
      )}

      {/* Create / Edit */}
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal === 'create' ? t('guides.newTitle') : t('guides.editTitle', { name: modal?.name })}
        size="lg"
      >
        {modal && (
          <GuideForm
            guide={modal !== 'create' ? modal : null}
            units={units}
            onSave={handleSave}
            onCancel={() => setModal(null)}
            loading={formLoading}
            error={formError}
          />
        )}
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={t('common.confirm')} size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>{t('common.cancel')}</Button>
            <Button variant="danger" onClick={handleDelete}>{t('common.delete')}</Button>
          </>
        }>
        <p className="text-sm font-body text-n-700">
          {t('guides.deleteBefore')}<strong>"{deleteTarget?.name}"</strong>{t('guides.deleteAfter')}
        </p>
      </Modal>

      <HistoryModal guide={historyGuide} onClose={() => setHistoryGuide(null)} />

      {assignGuide && (
        operator?.operator_type === 'activity' ? (
          <AssignCompositeModal
            guide={assignGuide}
            guides={guides}
            reservations={reservations}
            onClose={() => setAssignGuide(null)}
            onDone={() => setAssignGuide(null)}
          />
        ) : (
          <AssignModal
            guide={assignGuide}
            reservations={reservations}
            onClose={() => setAssignGuide(null)}
            onDone={() => setAssignGuide(null)}
          />
        )
      )}
    </div>
  );
}
