import { useState, useEffect, useRef } from 'react';
import PlanGuard from '../components/PlanGuard';
import {
  Plus, Pencil, Trash2, Star, Camera, Upload, X, Tag,
  Phone, Mail, Award, Globe2, Clock, Briefcase, Search,
  UserCheck, Users, Shield, CalendarDays, UserPlus,
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
import LoadingSpinner from '../components/shared/LoadingSpinner';

const LANGUAGES   = ['PT', 'EN', 'DE', 'NL', 'FR', 'ES'];
const DAYS        = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];
const GUIDE_ROLES = ['Guia', 'Instrutor', 'Guia-Instrutor', 'Assistente', 'Outro'];
const PRESET_CERTS = [
  'PADI Open Water', 'PADI Advanced', 'PADI Rescue Diver',
  'IKO Kitesurf', 'ACSI Kitesurf', 'Surf Coach',
  'Primeiros Socorros', 'CPR / DAE', 'Guia Turistico Certificado',
];

const STATUS_META = {
  active:    { label: 'Disponivel', cls: 'bg-[#ECFDF5] text-[#1A7A4A] border border-green-200'  },
  busy:      { label: 'Ocupado',    cls: 'bg-ocean-50 text-ocean-700 border border-ocean-200'    },
  day_off:   { label: 'Folga',      cls: 'bg-n-100 text-n-500 border border-n-200'              },
  inactive:  { label: 'Inactivo',   cls: 'bg-red-50 text-error border border-red-200'           },
};

const DOT_META = {
  active:   'bg-green-500',
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
  const langs  = guide.languages || [];
  const certs  = guide.certifications || guide.skills || [];
  const rating = Number(guide.average_rating || 0);
  const statusMeta = STATUS_META[guide.status] || STATUS_META.inactive;

  return (
    <div className="bg-white rounded-md border border-n-200 shadow-sm overflow-hidden flex flex-col">
      <div className="p-4 flex items-start gap-3">
        <GuideAvatar guide={guide} size={52} />
        <div className="flex-1 min-w-0">
          <p className="font-display font-semibold text-sm text-n-900 truncate">{guide.name}</p>
          <p className="text-xs font-body text-n-500 mt-0.5">{guide.role}</p>
          <div className="flex items-center gap-2 mt-1.5">
            {rating > 0 && (
              <span className="flex items-center gap-1 text-xs font-body text-n-700">
                <Star size={11} strokeWidth={0} className="fill-sand-500 text-sand-500" />
                {rating.toFixed(1)}
              </span>
            )}
            <span className="flex items-center gap-1 text-xs font-body text-n-500">
              <Briefcase size={11} strokeWidth={1.75} className="text-n-400" />
              {guide.total_jobs_completed || 0} tours
            </span>
          </div>
        </div>
        <div className="flex gap-0.5 shrink-0">
          <button onClick={() => onEdit(guide)}
            className="p-1.5 rounded text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors">
            <Pencil size={14} strokeWidth={1.75} />
          </button>
          <button onClick={() => onDelete(guide)}
            className="p-1.5 rounded text-n-400 hover:text-error hover:bg-red-50 transition-colors">
            <Trash2 size={14} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      <div className="px-4 pb-3 flex-1 space-y-3">
        {langs.length > 0 && (
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-n-400 mb-1.5">Idiomas</p>
            <div className="flex flex-wrap gap-1">
              {langs.map(l => (
                <span key={l}
                  className="text-xs font-mono font-medium px-2 py-0.5 bg-ocean-50 text-ocean-700 border border-ocean-100 rounded-xs uppercase">
                  {l}
                </span>
              ))}
            </div>
          </div>
        )}
        {certs.length > 0 && (
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-n-400 mb-1.5">Certificacoes</p>
            <div className="flex flex-wrap gap-1">
              {certs.slice(0, 3).map(c => (
                <span key={c}
                  className="text-xs font-body px-2 py-0.5 bg-n-50 text-n-600 border border-n-200 rounded-xs">
                  {c}
                </span>
              ))}
              {certs.length > 3 && (
                <span className="text-xs font-body px-2 py-0.5 bg-n-100 text-n-500 rounded-xs">
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

      <div className="px-4 py-3 border-t border-n-100 flex items-center justify-between gap-2">
        <span className={`text-xs font-mono px-2 py-0.5 rounded-xs uppercase tracking-wide whitespace-nowrap ${statusMeta.cls}`}>
          {statusMeta.label}
        </span>
        <div className="flex gap-1.5">
          <Button variant="secondary" size="sm" onClick={() => onAssign(guide)}>
            <UserPlus size={12} strokeWidth={1.75} className="mr-1" />
            Atribuir
          </Button>
          <Button variant="secondary" size="sm" onClick={() => onHistory(guide)}>
            Historial
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ───────── Form ───────── */
function GuideForm({ guide, units, onSave, onCancel, loading, error }) {
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
          <button type="button" onClick={() => fileRef.current?.click()}
            className="absolute -bottom-1 -right-1 w-6 h-6 bg-ocean-700 text-white rounded-full flex items-center justify-center hover:bg-ocean-500 transition-colors">
            <Upload size={10} strokeWidth={2} />
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
        </div>
        <div>
          <p className="text-sm font-display font-semibold text-n-800">Foto do guia</p>
          <p className="text-xs font-body text-n-500">JPG, PNG ate 2MB</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input label="Nome completo" value={form.name} onChange={set('name')} required placeholder="Nome e apelido" />
        <Select label="Funcao" value={form.role} onChange={set('role')} required>
          {GUIDE_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input label="Telefone" value={form.phone} onChange={set('phone')} type="tel" placeholder="+238 900 0000" />
        <Input label="WhatsApp" value={form.whatsapp} onChange={set('whatsapp')} type="tel" placeholder="+238 900 0000" />
      </div>
      <Input label="Email" value={form.email} onChange={set('email')} type="email" placeholder="guia@email.com" />

      {/* Languages */}
      <div>
        <p className="text-xs font-body font-bold uppercase tracking-wide text-n-600 mb-2">Idiomas</p>
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
        <p className="text-xs font-body font-bold uppercase tracking-wide text-n-600 mb-2">Certificacoes</p>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {PRESET_CERTS.map(c => (
            <button key={c} type="button" onClick={() => toggleCert(c)}
              className={`px-2.5 py-1 rounded-sm text-xs font-body transition-colors border ${
                certs.includes(c) ? 'bg-ocean-50 border-ocean-300 text-ocean-700' : 'bg-n-50 border-n-200 text-n-600 hover:border-n-400'
              }`}>
              {c}
            </button>
          ))}
        </div>
        {certs.filter(c => !PRESET_CERTS.includes(c)).map(c => (
          <span key={c} className="inline-flex items-center gap-1 mr-1.5 mb-1.5 px-2 py-0.5 bg-sand-50 text-sand-600 border border-sand-200 rounded-xs text-xs font-body">
            <Tag size={9} strokeWidth={1.75} />{c}
            <button type="button" onClick={() => setCerts(p => p.filter(x => x !== c))}><X size={9} strokeWidth={2} /></button>
          </span>
        ))}
        <input type="text" value={certInput} onChange={e => setCertInput(e.target.value)} onKeyDown={addCustomCert}
          placeholder="Outra certificacao + Enter"
          className="w-full h-8 px-3 rounded-sm border border-n-300 text-sm font-body bg-n-100 text-n-900 placeholder:text-n-400 focus:outline-none focus:ring-2 focus:ring-ocean-300 focus:border-ocean-700 focus:bg-white" />
      </div>

      {/* Tours */}
      {units.length > 0 && (
        <div>
          <p className="text-xs font-body font-bold uppercase tracking-wide text-n-600 mb-2">Tours que pode conduzir</p>
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
        <p className="text-xs font-body font-bold uppercase tracking-wide text-n-600 mb-2">Dias disponiveis</p>
        <div className="flex gap-1.5 flex-wrap">
          {DAYS.map(d => (
            <button key={d} type="button" onClick={() => toggleDay(d)}
              className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors ${
                schedule.includes(d) ? 'bg-ocean-700 text-white' : 'bg-n-100 text-n-600 hover:bg-n-200'
              }`}>
              {d}
            </button>
          ))}
        </div>
      </div>

      <Textarea label="Bio curta" value={form.bio} onChange={set('bio')} rows={2}
        placeholder="Experiencia, especialidade..." />

      {guide && (
        <Select label="Estado" value={form.status} onChange={set('status')}>
          <option value="active">Disponivel</option>
          <option value="busy">Ocupado</option>
          <option value="day_off">Folga</option>
          <option value="inactive">Inactivo</option>
        </Select>
      )}

      {/* Staff account */}
      {!guide && (
        <div className="border border-n-200 rounded-md p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield size={15} strokeWidth={1.75} className="text-ocean-700" />
              <span className="text-sm font-display font-semibold text-n-800">Criar conta /staff</span>
            </div>
            <button type="button" onClick={() => setCreateAccess(!createAccess)}
              className={`w-10 h-5 rounded-full transition-colors relative ${createAccess ? 'bg-ocean-700' : 'bg-n-300'}`}>
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${createAccess ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </div>
          {createAccess && (
            <p className="text-xs font-body text-n-500 bg-n-50 rounded p-2">
              Sera criada uma conta de acesso ao portal /staff com email e password temporaria. O guia recebera as credenciais por WhatsApp.
            </p>
          )}
        </div>
      )}

      {error && <p className="text-sm font-body px-3 py-2 rounded-sm bg-red-50 text-error">{error}</p>}

      <div className="flex gap-3 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">Cancelar</Button>
        <Button type="submit" loading={loading} className="flex-1">
          {guide ? 'Guardar alteracoes' : 'Adicionar guia'}
        </Button>
      </div>
    </form>
  );
}

/* ───────── History Modal ───────── */
function HistoryModal({ guide, onClose }) {
  const [jobs,    setJobs]    = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!guide) return;
    getStaffJobs(guide.id)
      .then(setJobs)
      .catch(() => setJobs([]))
      .finally(() => setLoading(false));
  }, [guide?.id]);

  const STATUS_LABEL = { pending: 'Pendente', confirmed: 'Confirmado', in_progress: 'Em progresso', completed: 'Concluido', cancelled: 'Cancelado' };
  const STATUS_COLOR = {
    completed: 'bg-[#ECFDF5] text-[#1A7A4A]',
    cancelled: 'bg-red-50 text-error',
    pending:   'bg-yellow-50 text-yellow-700',
    confirmed: 'bg-ocean-50 text-ocean-700',
    in_progress: 'bg-ocean-50 text-ocean-700',
  };

  const totalEarned = jobs.filter(j => j.status === 'completed').reduce((s, j) => s + Number(j.earnings_amount || 0), 0);

  return (
    <Modal open={!!guide} onClose={onClose} title={`Historial — ${guide?.name}`} size="md">
      {loading ? (
        <div className="flex justify-center py-10"><LoadingSpinner size={24} /></div>
      ) : jobs.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-n-400">
          <Briefcase size={32} strokeWidth={1.25} className="mb-2" />
          <p className="text-sm font-body">Sem tours registados</p>
        </div>
      ) : (
        <>
          {totalEarned > 0 && (
            <div className="mb-4 px-4 py-3 bg-ocean-50 border border-ocean-100 rounded-sm flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wide text-ocean-600">Total ganho</span>
              <span className="font-display font-bold text-ocean-700">€{totalEarned.toFixed(2)}</span>
            </div>
          )}
          <div className="space-y-2">
            {jobs.map(job => (
              <div key={job.id} className="flex items-start justify-between gap-3 p-3 bg-n-50 rounded-sm border border-n-200">
                <div className="min-w-0">
                  <p className="text-sm font-display font-semibold text-n-900 truncate">
                    {job.reservations?.units?.name || job.reservation_id?.slice(0, 8) || '—'}
                  </p>
                  <p className="text-xs font-body text-n-500 mt-0.5">
                    {job.assigned_at ? new Date(job.assigned_at).toLocaleDateString('pt-PT') : '—'}
                  </p>
                  {job.earnings_amount > 0 && (
                    <p className="text-xs font-body text-ocean-700 mt-0.5">€{Number(job.earnings_amount).toFixed(2)}</p>
                  )}
                </div>
                <span className={`text-xs font-mono px-2 py-0.5 rounded-xs uppercase tracking-wide whitespace-nowrap shrink-0 ${STATUS_COLOR[job.status] || 'bg-n-100 text-n-500'}`}>
                  {STATUS_LABEL[job.status] || job.status}
                </span>
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
      setError(err.response?.data?.error || 'Erro ao atribuir');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={!!guide} onClose={onClose} title={`Atribuir a — ${guide?.name}`} size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleAssign} loading={saving} disabled={!selected}>Atribuir</Button>
        </>
      }>
      <div className="space-y-3">
        {upcoming.length === 0 ? (
          <p className="text-sm font-body text-n-500 text-center py-4">Sem reservas proximas pendentes.</p>
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
                    {r.check_in} · {r.guests} pax · {r.customer_name || '—'}
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

  const DAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];
  const todayStr   = TODAY.toISOString().split('T')[0];

  if (guides.length === 0) {
    return (
      <div className="flex flex-col items-center py-16 text-n-400">
        <Users size={36} strokeWidth={1.25} className="mb-3" />
        <p className="text-sm font-body">Sem guias para mostrar disponibilidade</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-n-200 rounded-md overflow-x-auto">
      <table className="w-full text-xs" style={{ minWidth: 540 }}>
        <thead>
          <tr className="bg-n-50 border-b border-n-200">
            <th className="text-left px-4 py-3 text-xs font-body font-bold uppercase tracking-wide text-n-500 min-w-[140px]">
              Guia
            </th>
            {weekDates.map((d, i) => {
              const isToday = d === todayStr;
              const dayNum  = parseInt(d.slice(8), 10);
              return (
                <th key={d} className={`px-3 py-3 text-center min-w-[72px] ${isToday ? 'bg-ocean-50' : ''}`}>
                  <div className={`font-display font-semibold ${isToday ? 'text-ocean-700' : 'text-n-700'}`}>{dayNum}</div>
                  <div className="font-body text-n-400 font-normal">{DAY_LABELS[i]}</div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-n-100">
          {guides.map(g => (
            <tr key={g.id} className="hover:bg-n-50/50">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <GuideAvatar guide={g} size={28} />
                  <div>
                    <p className="font-body font-semibold text-n-800 text-xs truncate max-w-[90px]">{g.name.split(' ')[0]}</p>
                    <p className="font-body text-n-400 text-xs">{g.role}</p>
                  </div>
                </div>
              </td>
              {weekDates.map(d => {
                const key  = `${g.id}_${d}`;
                const isAv = avail[key] ?? true;
                const isSaving = savingId === key;
                const isToday  = d === todayStr;
                return (
                  <td key={d} className={`px-3 py-3 text-center ${isToday ? 'bg-ocean-50/40' : ''}`}>
                    <button
                      onClick={() => toggle(g.id, d)}
                      disabled={isSaving}
                      title={isAv ? 'Disponivel — clicar para marcar indisponivel' : 'Indisponivel — clicar para marcar disponivel'}
                      className={`w-8 h-8 mx-auto rounded-sm flex items-center justify-center transition-colors ${
                        isAv
                          ? 'bg-[#ECFDF5] text-[#1A7A4A] hover:bg-green-100'
                          : 'bg-n-100 text-n-400 hover:bg-n-200'
                      } ${isSaving ? 'opacity-50' : ''}`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full ${isAv ? 'bg-[#1A7A4A]' : 'bg-n-300'}`} />
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-4 px-4 py-2.5 border-t border-n-100 bg-n-50">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-[#ECFDF5] border border-green-200 inline-block" />
          <span className="text-xs font-body text-n-500">Disponivel</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-n-100 border border-n-200 inline-block" />
          <span className="text-xs font-body text-n-500">Indisponivel</span>
        </div>
        <span className="text-xs font-body text-n-400 ml-auto">Clicar para alternar</span>
      </div>
    </div>
  );
}

/* ───────── Main Page ───────── */
export default function Guides() {
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
        setGuides((staff || []).filter(s => s.role !== 'Vendedor de Praia'));
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
      setFormError(err.response?.data?.error || 'Erro ao guardar');
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
    if (search && !g.name.toLowerCase().includes(search.toLowerCase()) &&
        !(g.role || '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const active = guides.filter(g => g.status === 'active').length;

  const TABS = [
    { key: 'lista',        label: 'Guias',         Icon: Users },
    { key: 'disponibilidade', label: 'Disponibilidade', Icon: CalendarDays },
  ];

  return (
    <div>
      <PageHeader
        title="Guias"
        subtitle={`${active} disponivel(is) · ${guides.length} total`}
        actions={
          tab === 'lista' && (
            <Button icon={Plus} onClick={() => { setFormError(''); setModal('create'); }}>
              Adicionar guia
            </Button>
          )
        }
      />

      {/* Tab bar */}
      <div className="flex gap-0.5 mb-5 bg-n-100 p-1 rounded-md w-fit">
        {TABS.map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-display font-medium transition-colors ${
              tab === key ? 'bg-white text-ocean-700 shadow-sm' : 'text-n-500 hover:text-n-700'
            }`}>
            <Icon size={15} strokeWidth={1.75} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'lista' && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-5 items-center">
            <div className="relative">
              <Search size={14} strokeWidth={1.75} className="absolute left-3 top-1/2 -translate-y-1/2 text-n-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Pesquisar guia..."
                className="h-9 pl-8 pr-3 rounded-sm border border-n-200 text-sm font-body bg-white placeholder:text-n-400 focus:outline-none focus:border-ocean-700" />
            </div>
            {['', 'active', 'busy', 'day_off', 'inactive'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-sm text-xs font-body font-semibold transition-colors ${
                  statusFilter === s ? 'bg-ocean-700 text-white' : 'bg-white border border-n-200 text-n-600 hover:border-ocean-300'
                }`}>
                {s === '' ? 'Todos' : STATUS_META[s]?.label || s}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-20"><LoadingSpinner size={32} /></div>
          ) : filtered.length === 0 && !search && !statusFilter ? (
            <div className="bg-white border border-n-200 rounded-md flex flex-col items-center py-16 text-n-400">
              <Users size={40} strokeWidth={1.25} className="mb-3" />
              <p className="font-body text-sm">Sem guias registados</p>
              <p className="font-body text-xs mt-1 text-center max-w-xs">
                Adicione os guias da sua equipa e associe-os aos tours que conduzem
              </p>
            </div>
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
        title={modal === 'create' ? 'Novo guia' : `Editar: ${modal?.name}`}
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
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Confirmar" size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="danger" onClick={handleDelete}>Eliminar</Button>
          </>
        }>
        <p className="text-sm font-body text-n-700">
          Eliminar o guia <strong>"{deleteTarget?.name}"</strong>? Esta accao nao pode ser desfeita.
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
