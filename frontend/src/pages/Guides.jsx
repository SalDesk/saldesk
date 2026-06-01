import { useState, useEffect, useRef } from 'react';
import {
  Plus, Pencil, Trash2, Star, Camera, Upload, X, Tag,
  Phone, Mail, Award, Globe2, Clock, Briefcase, Search,
  UserCheck, Users,
} from 'lucide-react';
import { listStaff, createStaff, updateStaff, deleteStaff, getStaffJobs } from '../services/staffService';
import { listUnits } from '../services/unitsService';
import useAuthStore from '../store/authStore';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input, { Textarea, Select } from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import LoadingSpinner from '../components/shared/LoadingSpinner';

const LANGUAGES  = ['PT', 'EN', 'DE', 'NL', 'FR', 'ES'];
const DAYS       = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];
const GUIDE_ROLES = ['Guia', 'Instrutor', 'Guia-Instrutor', 'Assistente', 'Outro'];
const PRESET_CERTS = [
  'PADI Open Water',
  'PADI Advanced',
  'PADI Rescue Diver',
  'IKO Kitesurf',
  'ACSI Kitesurf',
  'Surf Coach',
  'Primeiros Socorros',
  'CPR / DAE',
  'Guia Turistico Certificado',
];

const DIFF_COLORS = {
  Facil:    'bg-[#ECFDF5] text-[#1A7A4A]',
  Moderado: 'bg-[#FFF7E6] text-[#B45309]',
  Dificil:  'bg-[#FEF2F2] text-[#B91C1C]',
};

function GuideAvatar({ guide, size = 40 }) {
  const initials = guide.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {guide.photo_url ? (
        <img src={guide.photo_url} alt={guide.name} className="w-full h-full rounded-full object-cover" />
      ) : (
        <div className="w-full h-full rounded-full bg-ocean-700 flex items-center justify-center text-white font-display font-bold"
          style={{ fontSize: Math.round(size * 0.36) }}>
          {initials}
        </div>
      )}
      <span className={`absolute bottom-0 right-0 rounded-full border-2 border-white ${size >= 36 ? 'w-3 h-3' : 'w-2.5 h-2.5'} ${guide.status === 'active' ? 'bg-green-500' : 'bg-n-300'}`} />
    </div>
  );
}

function GuideCard({ guide, units, onEdit, onDelete, onHistory }) {
  const langs  = guide.languages || [];
  const certs  = guide.certifications || guide.skills || [];
  const rating = Number(guide.average_rating || 0);

  return (
    <div className="bg-white rounded-md border border-n-200 shadow-sm overflow-hidden flex flex-col">
      {/* Header */}
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

      {/* Body */}
      <div className="px-4 pb-3 flex-1 space-y-3">
        {/* Languages */}
        {langs.length > 0 && (
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-n-400 mb-1.5">Idiomas</p>
            <div className="flex flex-wrap gap-1">
              {langs.map(l => (
                <span key={l} className="text-xs font-mono font-medium px-2 py-0.5 bg-ocean-50 text-ocean-700 border border-ocean-100 rounded-xs uppercase">
                  {l}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Certifications */}
        {certs.length > 0 && (
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-n-400 mb-1.5">Certificacoes</p>
            <div className="flex flex-wrap gap-1">
              {certs.slice(0, 3).map(c => (
                <span key={c} className="text-xs font-body px-2 py-0.5 bg-n-50 text-n-600 border border-n-200 rounded-xs">
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

        {/* Bio */}
        {guide.bio && (
          <p className="text-xs font-body text-n-600 line-clamp-2 leading-relaxed">{guide.bio}</p>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-n-100 flex items-center justify-between gap-2">
        <Badge variant={guide.status === 'active' ? 'confirmed' : 'cancelled'}>
          {guide.status === 'active' ? 'Activo' : 'Inactivo'}
        </Badge>
        <Button variant="secondary" size="sm" onClick={() => onHistory(guide)}>
          Ver historial
        </Button>
      </div>
    </div>
  );
}

function GuideForm({ guide, units, onSave, onCancel, loading, error }) {
  const meta = guide?.guide_meta ? (() => { try { return JSON.parse(guide.guide_meta); } catch { return {}; } })() : {};

  const [form, setForm]         = useState({
    name:      guide?.name      || '',
    role:      guide?.role      || 'Guia',
    phone:     guide?.phone     || '',
    email:     guide?.email     || '',
    whatsapp:  guide?.whatsapp  || '',
    status:    guide?.status    || 'active',
    bio:       guide?.bio || meta.bio || '',
  });
  const [photoPreview, setPhotoPreview] = useState(guide?.photo_url || null);
  const [languages,   setLanguages]     = useState(guide?.languages || meta.languages || []);
  const [certs,       setCerts]         = useState(guide?.certifications || guide?.skills || meta.certifications || []);
  const [schedule,    setSchedule]      = useState(guide?.schedule || meta.schedule || []);
  const [tourIds,     setTourIds]       = useState(guide?.tour_ids || meta.tour_ids || []);
  const [certInput,   setCertInput]     = useState('');
  const fileRef = useRef(null);

  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result);
    reader.readAsDataURL(file);
  }

  function toggleLang(l) {
    setLanguages(p => p.includes(l) ? p.filter(x => x !== l) : [...p, l]);
  }
  function toggleCert(c) {
    setCerts(p => p.includes(c) ? p.filter(x => x !== c) : [...p, c]);
  }
  function addCustomCert(e) {
    if (e.key === 'Enter' && certInput.trim()) {
      e.preventDefault();
      if (!certs.includes(certInput.trim())) setCerts(p => [...p, certInput.trim()]);
      setCertInput('');
    }
  }
  function toggleDay(d) {
    setSchedule(p => p.includes(d) ? p.filter(x => x !== d) : [...p, d]);
  }
  function toggleTour(id) {
    setTourIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  }

  function handleSubmit(e) {
    e.preventDefault();
    const payload = {
      ...form,
      photo_url: photoPreview || guide?.photo_url || null,
      languages,
      certifications: certs,
      skills: certs,
      schedule,
      tour_ids: tourIds,
      guide_meta: JSON.stringify({ bio: form.bio, languages, certifications: certs, schedule, tour_ids: tourIds }),
    };
    onSave(payload);
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
        <p className="text-xs font-body font-bold uppercase tracking-wide text-n-600 mb-2">Idiomas falados</p>
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
              className={`px-2.5 py-1 rounded-sm text-xs font-body transition-colors border ${certs.includes(c) ? 'bg-ocean-50 border-ocean-300 text-ocean-700' : 'bg-n-50 border-n-200 text-n-600 hover:border-n-400'}`}>
              {c}
            </button>
          ))}
        </div>
        {certs.filter(c => !PRESET_CERTS.includes(c)).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {certs.filter(c => !PRESET_CERTS.includes(c)).map(c => (
              <span key={c} className="flex items-center gap-1 px-2 py-0.5 bg-sand-50 text-sand-600 border border-sand-200 rounded-xs text-xs font-body">
                <Tag size={9} strokeWidth={1.75} />{c}
                <button type="button" onClick={() => setCerts(p => p.filter(x => x !== c))}><X size={9} strokeWidth={2} /></button>
              </span>
            ))}
          </div>
        )}
        <input type="text" value={certInput} onChange={e => setCertInput(e.target.value)} onKeyDown={addCustomCert}
          placeholder="Outra certificacao + Enter"
          className="w-full h-8 px-3 rounded-sm border border-n-300 text-sm font-body bg-n-100 text-n-900 placeholder:text-n-400 focus:outline-none focus:ring-2 focus:ring-ocean-300 focus:border-ocean-700 focus:bg-white" />
      </div>

      {/* Tours */}
      {units.length > 0 && (
        <div>
          <p className="text-xs font-body font-bold uppercase tracking-wide text-n-600 mb-2">Tours que pode conduzir</p>
          <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto">
            {units.map(u => (
              <label key={u.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-sm border cursor-pointer transition-colors ${tourIds.includes(u.id) ? 'bg-ocean-50 border-ocean-200' : 'bg-n-50 border-n-200 hover:border-n-300'}`}>
                <input type="checkbox" className="w-3.5 h-3.5 accent-ocean-700" checked={tourIds.includes(u.id)} onChange={() => toggleTour(u.id)} />
                <span className="text-sm font-body text-n-800">{u.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Schedule */}
      <div>
        <p className="text-xs font-body font-bold uppercase tracking-wide text-n-600 mb-2">Disponibilidade</p>
        <div className="flex gap-1.5 flex-wrap">
          {DAYS.map(d => (
            <button key={d} type="button" onClick={() => toggleDay(d)}
              className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors ${schedule.includes(d) ? 'bg-ocean-700 text-white' : 'bg-n-100 text-n-600 hover:bg-n-200'}`}>
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Bio */}
      <Textarea label="Bio curta" value={form.bio} onChange={set('bio')} rows={2} placeholder="Experiencia, especialidade, curiosidade..." />

      {guide && (
        <Select label="Estado" value={form.status} onChange={set('status')}>
          <option value="active">Activo</option>
          <option value="inactive">Inactivo</option>
        </Select>
      )}

      {error && (
        <p className="text-sm font-body px-3 py-2 rounded-sm bg-red-50 text-error">{error}</p>
      )}
      <div className="flex gap-3 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">Cancelar</Button>
        <Button type="submit" loading={loading} className="flex-1">
          {guide ? 'Guardar alteracoes' : 'Adicionar guia'}
        </Button>
      </div>
    </form>
  );
}

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
  const STATUS_COLOR = { completed: 'bg-[#ECFDF5] text-[#1A7A4A]', cancelled: 'bg-red-50 text-error', pending: 'bg-yellow-50 text-yellow-700', confirmed: 'bg-ocean-50 text-ocean-700', in_progress: 'bg-ocean-50 text-ocean-700' };

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
      )}
    </Modal>
  );
}

export default function Guides() {
  const [guides,       setGuides]      = useState([]);
  const [units,        setUnits]       = useState([]);
  const [loading,      setLoading]     = useState(true);
  const [modal,        setModal]       = useState(null);
  const [formLoading,  setFormLoading] = useState(false);
  const [formError,    setFormError]   = useState('');
  const [deleteTarget, setDeleteTarget]= useState(null);
  const [historyGuide, setHistoryGuide]= useState(null);
  const [search,       setSearch]      = useState('');

  useEffect(() => {
    Promise.all([listStaff(), listUnits()])
      .then(([staff, uns]) => {
        setGuides(staff);
        setUnits(uns.filter(u => u.status === 'active'));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(dados) {
    setFormError('');
    setFormLoading(true);
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
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDelete() {
    try {
      await deleteStaff(deleteTarget.id);
      setGuides(p => p.filter(x => x.id !== deleteTarget.id));
    } catch (err) {
      console.error(err);
    } finally {
      setDeleteTarget(null);
    }
  }

  const filtered = search
    ? guides.filter(g =>
        g.name.toLowerCase().includes(search.toLowerCase()) ||
        (g.role || '').toLowerCase().includes(search.toLowerCase())
      )
    : guides;

  const active = guides.filter(g => g.status === 'active').length;

  return (
    <div>
      <PageHeader
        title="Guias"
        subtitle={`${active} activo(s) · ${guides.length} total`}
        actions={
          <Button icon={Plus} onClick={() => { setFormError(''); setModal('create'); }}>
            Adicionar guia
          </Button>
        }
      />

      {/* Search */}
      {guides.length > 3 && (
        <div className="relative mb-5 max-w-xs">
          <Search size={14} strokeWidth={1.75} className="absolute left-3 top-1/2 -translate-y-1/2 text-n-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Pesquisar guia..."
            className="w-full h-9 pl-8 pr-3 rounded-sm border border-n-200 text-sm font-body bg-white placeholder:text-n-400 focus:outline-none focus:border-ocean-700"
          />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><LoadingSpinner size={32} /></div>
      ) : filtered.length === 0 && !search ? (
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
            <GuideCard
              key={g.id}
              guide={g}
              units={units}
              onEdit={g => { setFormError(''); setModal(g); }}
              onDelete={setDeleteTarget}
              onHistory={setHistoryGuide}
            />
          ))}
        </div>
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

      {/* Tour history */}
      <HistoryModal guide={historyGuide} onClose={() => setHistoryGuide(null)} />
    </div>
  );
}
