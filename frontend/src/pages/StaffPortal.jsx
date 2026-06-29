import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Route, Routes, NavLink } from 'react-router-dom';
import {
  Briefcase, Euro, LogOut, CheckCircle, PlayCircle, Clock, MapPin, User, ChevronRight, Car, AlertTriangle,
  Calendar, CalendarCheck, MessageCircle, Camera, Upload, Phone, Lock, Mail,
} from 'lucide-react';
import api from '../services/api';
import { getMyProfile, updateMyProfile, setAvailability } from '../services/staffService';
import { forgotPassword } from '../services/authService';
import { getMonthGrid } from '../utils/calendar';
import useAuthStore from '../store/authStore';
import { useToast } from '../store/toastStore';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import Logo from '../components/shared/Logo';

const STATUS_BADGE  = { pending:'pending', confirmed:'info', in_progress:'checked_in', completed:'checked_out', cancelled:'cancelled' };
const STATUS_LABELS = { pending:'Pendente', confirmed:'Confirmado', in_progress:'Em curso', completed:'Concluido', cancelled:'Cancelado' };
const MONTHS_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const DAYS_PT   = ['Dom','Seg','Ter','Qua','Qui','Sex','Sab'];
const TODAY = new Date().toISOString().slice(0, 10);

function formatDate(d) { if (!d) return '—'; const dt = new Date(d+'T00:00:00Z'); return dt.toLocaleDateString('pt-PT',{day:'2-digit',month:'short',year:'numeric'}); }
function formatTime(d) { if (!d) return ''; return new Date(d).toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit'}); }

function getWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(now); monday.setDate(now.getDate() + mondayOffset);
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  return { monday: monday.toISOString().slice(0, 10), sunday: sunday.toISOString().slice(0, 10) };
}

/* ─── Vista: Lista de trabalhos ─── */
function JobsList({ staffId }) {
  const [jobs, setJobs]     = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get(`/staff/${staffId}/jobs`).then(r => setJobs(r.data.data || [])).finally(() => setLoading(false));
  }, [staffId]);

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner size={28}/></div>;

  const upcoming  = jobs.filter(j => ['pending','confirmed','in_progress'].includes(j.status))
    .sort((a, b) => (a.reservations?.check_in || '').localeCompare(b.reservations?.check_in || ''));
  const history   = jobs.filter(j => ['completed','cancelled'].includes(j.status)).slice(0,10);
  const nextJob   = upcoming[0] || null;

  const { monday, sunday } = getWeekRange();
  const weeklyCount = jobs.filter(j => {
    const d = j.reservations?.check_in;
    return d && d >= monday && d <= sunday;
  }).length;

  return (
    <div className="px-4 py-4 space-y-6">
      {/* Proximo trabalho */}
      <div>
        <p className="text-xs font-body font-bold uppercase tracking-wide text-n-500 mb-2">Proximo trabalho</p>
        {nextJob ? (
          <button onClick={() => navigate(`/staff/jobs/${nextJob.id}`)}
            className="w-full bg-ocean-900 rounded-xl p-4 flex items-center justify-between text-left">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                <MapPin size={18} strokeWidth={1.75} className="text-sand-400" />
              </div>
              <div>
                <p className="font-display font-bold text-base text-white">{nextJob.reservations?.units?.name || '—'}</p>
                <p className="text-xs font-body text-ocean-200 mt-0.5">
                  {nextJob.reservations?.customer_name} · {formatDate(nextJob.reservations?.check_in)}
                </p>
              </div>
            </div>
            <ChevronRight size={18} strokeWidth={1.75} className="text-ocean-300 shrink-0" />
          </button>
        ) : (
          <div className="bg-white rounded-xl border border-n-200 p-4 text-center text-n-400">
            <Briefcase size={24} strokeWidth={1.25} className="mx-auto mb-2" />
            <p className="text-sm font-body">Sem trabalhos agendados</p>
          </div>
        )}
        <p className="text-xs font-body text-n-400 mt-2 text-center">{weeklyCount} trabalho(s) esta semana</p>
      </div>

      <div>
        <p className="text-xs font-body font-bold uppercase tracking-wide text-n-500 mb-3">Proximos trabalhos</p>
        {upcoming.length === 0 ? (
          <div className="text-center py-8 text-n-400"><Briefcase size={28} strokeWidth={1.25} className="mx-auto mb-2"/><p className="text-sm font-body">Sem trabalhos pendentes</p></div>
        ) : upcoming.map(j => (
          <button key={j.id} onClick={() => navigate(`/staff/jobs/${j.id}`)}
            className="w-full bg-white rounded-md border border-n-200 shadow-sm p-4 mb-3 flex items-center justify-between text-left hover:border-ocean-300">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant={STATUS_BADGE[j.status]}>{STATUS_LABELS[j.status]}</Badge>
              </div>
              <p className="font-display font-semibold text-sm text-n-900">{j.reservations?.units?.name}</p>
              <p className="text-xs font-body text-n-500 mt-0.5">{j.reservations?.customer_name} · {formatDate(j.reservations?.check_in)}</p>
            </div>
            <ChevronRight size={16} strokeWidth={1.75} className="text-n-300 shrink-0"/>
          </button>
        ))}
      </div>

      {history.length > 0 && (
        <div>
          <p className="text-xs font-body font-bold uppercase tracking-wide text-n-500 mb-3">Historico recente</p>
          {history.map(j => (
            <div key={j.id} className="bg-white rounded-md border border-n-100 p-3 mb-2 flex items-center justify-between opacity-70">
              <div>
                <p className="text-sm font-body font-semibold text-n-700">{j.reservations?.units?.name}</p>
                <p className="text-xs font-body text-n-400">{formatDate(j.reservations?.check_in)}</p>
              </div>
              <Badge variant={STATUS_BADGE[j.status]}>{STATUS_LABELS[j.status]}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Vista: Detalhe de trabalho ─── */
function JobDetail({ staffId }) {
  const { jobId } = useParams();
  const navigate  = useNavigate();
  const [job, setJob]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing]   = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportText, setReportText] = useState('');
  const [reporting, setReporting]   = useState(false);
  const [reportDone, setReportDone] = useState(false);

  useEffect(() => {
    api.get(`/staff/${staffId}/jobs`).then(r => {
      const found = (r.data.data || []).find(j => j.id === jobId);
      setJob(found || null);
    }).finally(() => setLoading(false));
  }, [staffId, jobId]);

  async function updateStatus(action, notes = '') {
    setActing(true);
    try {
      await api.put(`/assignments/${jobId}/${action}`, { notes_staff: notes });
      navigate('/staff/jobs');
    } finally { setActing(false); }
  }

  async function handleReportIssue() {
    if (!reportText.trim()) return;
    setReporting(true);
    try {
      await api.put(`/assignments/${jobId}/notes`, { notes_staff: reportText });
      setReportDone(true);
      setShowReport(false);
    } finally { setReporting(false); }
  }

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner size={28}/></div>;
  if (!job) return <div className="p-4 text-center text-n-400">Trabalho nao encontrado</div>;

  const r = job.reservations;

  return (
    <div className="px-4 py-4">
      <button onClick={() => navigate('/staff/jobs')} className="text-xs font-body text-ocean-700 mb-4 flex items-center gap-1">← Voltar</button>

      <div className="bg-white rounded-md border border-n-200 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-base text-n-900">{r?.units?.name}</h2>
          <Badge variant={STATUS_BADGE[job.status]}>{STATUS_LABELS[job.status]}</Badge>
        </div>

        <div className="space-y-3 py-3 border-y border-n-100">
          <InfoRow icon={User}    label="Cliente"   value={r?.customer_name} />
          <InfoRow icon={Clock}   label="Check-in"  value={formatDate(r?.check_in)} />
          <InfoRow icon={Clock}   label="Check-out" value={formatDate(r?.check_out)} />
          {job.fleet?.name && <InfoRow icon={Car} label="Viatura" value={job.fleet.name} />}
          {job.earnings_amount > 0 && <InfoRow icon={Euro} label="Ganho" value={`€${Number(job.earnings_amount).toFixed(2)}`} />}
        </div>

        {job.notes_manager && (
          <div className="bg-n-50 rounded-sm px-3 py-2">
            <p className="text-xs font-body font-bold uppercase tracking-wide text-n-500 mb-1">Notas do gestor</p>
            <p className="text-sm font-body text-n-700">{job.notes_manager}</p>
          </div>
        )}

        <div className="space-y-2 pt-2">
          {job.status === 'pending' && (
            <Button className="w-full" icon={CheckCircle} loading={acting} onClick={() => updateStatus('confirm')}>
              Confirmar trabalho
            </Button>
          )}
          {job.status === 'confirmed' && (
            <Button className="w-full" icon={PlayCircle} loading={acting} onClick={() => updateStatus('start')}>
              Iniciar
            </Button>
          )}
          {job.status === 'in_progress' && (
            <Button className="w-full" loading={acting} onClick={() => updateStatus('complete')}>
              Marcar como concluido
            </Button>
          )}
        </div>

        {job.fleet?.name && (
          <div className="pt-2 border-t border-n-100">
            {reportDone && (
              <p className="text-xs font-body text-[#1A7A4A] mb-2">Problema reportado ao gestor.</p>
            )}
            {!showReport ? (
              <button onClick={() => setShowReport(true)}
                className="w-full text-sm font-body font-semibold text-error flex items-center justify-center gap-1.5 py-2">
                <AlertTriangle size={14} strokeWidth={1.75} />
                Reportar problema com a viatura
              </button>
            ) : (
              <div className="space-y-2">
                <textarea
                  value={reportText} onChange={e => setReportText(e.target.value)}
                  rows={3} placeholder="Descreva o problema com a viatura..."
                  className="w-full px-3 py-2 rounded-sm border border-n-300 text-sm font-body bg-n-100 focus:outline-none focus:ring-2 focus:ring-ocean-300 focus:border-ocean-700 focus:bg-white resize-none"
                />
                <div className="flex gap-2">
                  <Button variant="secondary" className="flex-1" onClick={() => { setShowReport(false); setReportText(''); }}>
                    Cancelar
                  </Button>
                  <Button className="flex-1" loading={reporting} disabled={!reportText.trim()} onClick={handleReportIssue}>
                    Enviar
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3">
      <Icon size={15} strokeWidth={1.75} className="text-n-400 shrink-0"/>
      <span className="text-xs font-body text-n-500 w-20">{label}</span>
      <span className="text-sm font-body font-semibold text-n-800">{value || '—'}</span>
    </div>
  );
}

/* ─── Vista: Ganhos (mantida, sem rota/uso no portal generico) ─── */
function Earnings({ staffId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/staff/${staffId}/earnings`).then(r => setData(r.data.data)).finally(() => setLoading(false));
  }, [staffId]);

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner size={28}/></div>;

  return (
    <div className="px-4 py-4">
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-ocean-700 rounded-md p-4 text-white">
          <p className="font-display font-bold text-2xl">€{Number(data?.total || 0).toFixed(2)}</p>
          <p className="text-xs opacity-70 mt-1">Total ganho</p>
        </div>
        <div className="bg-white rounded-md border border-n-200 p-4">
          <p className="font-display font-bold text-2xl text-n-900">€{Number(data?.pending || 0).toFixed(2)}</p>
          <p className="text-xs text-n-500 mt-1">Por receber</p>
        </div>
      </div>
      <p className="text-xs font-body font-bold uppercase tracking-wide text-n-500 mb-3">Historico</p>
      {(data?.jobs || []).slice(0,20).map((j, i) => (
        <div key={i} className="bg-white rounded-sm border border-n-100 px-3 py-2.5 mb-2 flex items-center justify-between">
          <div>
            <p className="text-sm font-body font-semibold text-n-800">{formatDate(j.completed_at)}</p>
            <p className="text-xs font-body text-n-400">{j.earnings_paid ? 'Pago' : 'Pendente'}</p>
          </div>
          <p className="font-display font-bold text-ocean-700">€{Number(j.earnings_amount).toFixed(2)}</p>
        </div>
      ))}
    </div>
  );
}

/* ─── Vista: Calendario (placeholder) ─── */
function StaffCalendar() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-n-400 px-4">
      <Calendar size={36} strokeWidth={1.25} className="mb-3" />
      <p className="font-body font-semibold text-n-600">Em breve</p>
      <p className="text-sm font-body text-n-400 mt-1 text-center">A vista de calendario completa estara disponivel brevemente.</p>
    </div>
  );
}

/* ─── Vista: Chat (placeholder) ─── */
function StaffChat() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-n-400 px-4">
      <MessageCircle size={36} strokeWidth={1.25} className="mb-3" />
      <p className="font-body font-semibold text-n-600">Em breve</p>
      <p className="text-sm font-body text-n-400 mt-1 text-center">O chat com o gestor estara disponivel brevemente.</p>
    </div>
  );
}

/* ─── Vista: Disponibilidade ─── */
function StaffAvailability({ staffId }) {
  const toast = useToast();
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [avail,  setAvail]  = useState({});
  const [saving, setSaving] = useState(false);

  function toggle(dateStr) {
    setAvail(prev => ({ ...prev, [dateStr]: !(prev[dateStr] ?? true) }));
  }

  async function handleSave() {
    const dates = Object.entries(avail).map(([date, is_available]) => ({ date, is_available }));
    if (dates.length === 0) return;
    setSaving(true);
    try {
      await setAvailability(staffId, { dates });
      toast.success('Disponibilidade actualizada');
      setAvail({});
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao actualizar disponibilidade');
    } finally {
      setSaving(false);
    }
  }

  const hasChanges = Object.keys(avail).length > 0;

  return (
    <div className="px-4 py-4 space-y-4">
      <p className="text-sm font-body text-n-500">
        Toca num dia para marcar como indisponivel. Os dias nao marcados sao considerados disponiveis.
      </p>

      <div className="bg-white rounded-xl border border-n-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={() => setViewMonth(v => {
              const m = v.month === 0 ? 11 : v.month - 1;
              const y = v.month === 0 ? v.year - 1 : v.year;
              return { year: y, month: m };
            })}
            className="w-9 h-9 rounded-full flex items-center justify-center text-n-500 hover:bg-n-100 active:scale-95 transition-all"
            aria-label="Mes anterior"
          >
            ←
          </button>
          <p className="font-display font-bold text-base text-n-900">
            {MONTHS_PT[viewMonth.month]} {viewMonth.year}
          </p>
          <button
            type="button"
            onClick={() => setViewMonth(v => {
              const m = v.month === 11 ? 0 : v.month + 1;
              const y = v.month === 11 ? v.year + 1 : v.year;
              return { year: y, month: m };
            })}
            className="w-9 h-9 rounded-full flex items-center justify-center text-n-500 hover:bg-n-100 active:scale-95 transition-all"
            aria-label="Mes seguinte"
          >
            →
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-2">
          {DAYS_PT.map(d => (
            <div key={d} className="text-center text-[10px] font-mono uppercase tracking-wide text-n-400 py-1">{d}</div>
          ))}
        </div>

        <div className="space-y-1">
          {getMonthGrid(viewMonth.year, viewMonth.month).map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-1">
              {week.map((d, di) => {
                if (!d) return <div key={di} />;
                const isPast = d < TODAY;
                const isT    = d === TODAY;
                const isAvailable = avail[d] ?? true;
                const dayNum = Number(d.slice(8, 10));
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={isPast}
                    onClick={() => toggle(d)}
                    className={`aspect-square rounded-lg flex items-center justify-center text-sm font-body font-semibold transition-all active:scale-95 ${
                      isPast
                        ? 'text-n-300 cursor-not-allowed'
                        : isAvailable
                        ? `text-[#1A7A4A] bg-[#ECFDF5] ${isT ? 'border-2 border-ocean-300' : ''}`
                        : 'text-error bg-red-50'
                    }`}
                  >
                    {dayNum}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs font-body text-n-500">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-xs bg-[#ECFDF5] border border-[#BBF7D0]" />Disponivel</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-xs bg-red-50 border border-red-200" />Indisponivel</span>
      </div>

      <Button className="w-full" disabled={!hasChanges} loading={saving} onClick={handleSave}>
        Guardar
      </Button>
    </div>
  );
}

/* ─── Vista: Perfil ─── */
function StaffProfile() {
  const { user } = useAuthStore();
  const toast = useToast();

  const staffName  = user?.user_metadata?.name || user?.email || 'Colaborador';
  const staffEmail = user?.email;

  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  const [profile,      setProfile]      = useState(null);
  const [phone,        setPhone]        = useState('');
  const [whatsapp,     setWhatsapp]     = useState('');
  const [photoPreview, setPhotoPreview] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    getMyProfile()
      .then(data => {
        setProfile(data);
        setPhone(data?.phone || '');
        setWhatsapp(data?.whatsapp || '');
        setPhotoPreview(data?.photo_url || null);
      })
      .catch(() => toast.error('Erro ao carregar perfil'))
      .finally(() => setLoading(false));
  }, []);

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result);
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateMyProfile({ phone, whatsapp, photo_url: photoPreview });
      toast.success('Perfil actualizado');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao actualizar perfil');
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword() {
    if (!staffEmail) return;
    setSendingReset(true);
    try {
      await forgotPassword(staffEmail);
      toast.success('Email enviado para definir nova password');
    } catch {
      toast.success('Email enviado para definir nova password');
    } finally {
      setSendingReset(false);
    }
  }

  return (
    <div className="px-4 py-6 space-y-6">
      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner size={28}/></div>
      ) : (
        <>
          {/* Photo */}
          <div className="flex flex-col items-center">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-ocean-50 flex items-center justify-center overflow-hidden border-4 border-white shadow-md">
                {photoPreview
                  ? <img src={photoPreview} alt={staffName} className="w-full h-full object-cover" />
                  : <Camera size={28} strokeWidth={1.5} className="text-ocean-400" />}
              </div>
              <button type="button" onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-8 h-8 bg-ocean-700 text-white rounded-full flex items-center justify-center shadow-md hover:bg-ocean-500 active:scale-95 transition-all">
                <Upload size={14} strokeWidth={2} />
              </button>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
            </div>
            <p className="font-display font-bold text-lg text-n-900 mt-3">{staffName}</p>
            {profile?.role && (
              <span className="mt-1 text-[10px] font-mono uppercase tracking-wide text-sand-600 bg-sand-50 px-2 py-0.5 rounded-full">
                {profile.role}
              </span>
            )}
          </div>

          {/* Editable fields */}
          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-1.5 text-sm font-body font-semibold text-n-700 mb-2">
                <Phone size={14} strokeWidth={1.75} />Telefone
              </label>
              <input
                type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="+238 900 0000"
                className="w-full h-11 px-4 rounded-xl border border-n-300 text-sm font-body bg-n-100 focus:outline-none focus:ring-2 focus:ring-ocean-300 focus:border-ocean-700 focus:bg-white transition-colors"
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-sm font-body font-semibold text-n-700 mb-2">
                <MessageCircle size={14} strokeWidth={1.75} />WhatsApp
              </label>
              <input
                type="tel" value={whatsapp} onChange={e => setWhatsapp(e.target.value)}
                placeholder="+238 900 0000"
                className="w-full h-11 px-4 rounded-xl border border-n-300 text-sm font-body bg-n-100 focus:outline-none focus:ring-2 focus:ring-ocean-300 focus:border-ocean-700 focus:bg-white transition-colors"
              />
            </div>
          </div>

          {/* Read-only info */}
          <div>
            <p className="text-xs font-mono uppercase tracking-wider text-n-400 mb-2">Definido pelo operador</p>
            <div className="bg-white rounded-xl border border-n-200 divide-y divide-n-100">
              <ReadOnlyRow icon={User} label="Nome" value={staffName} />
              {profile?.role && <ReadOnlyRow icon={Briefcase} label="Cargo" value={profile.role} />}
              {staffEmail && <ReadOnlyRow icon={Mail} label="Email" value={staffEmail} />}
            </div>
          </div>

          {/* Change password */}
          <button
            onClick={handleChangePassword}
            disabled={sendingReset}
            className="w-full h-12 bg-white border border-n-300 text-n-700 rounded-xl font-body font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.99] transition-all hover:border-ocean-300 disabled:opacity-50">
            <Lock size={16} strokeWidth={1.75} />
            {sendingReset ? 'A enviar...' : 'Alterar password'}
          </button>

          {/* Save */}
          <Button className="w-full" size="lg" loading={saving} onClick={handleSave}>
            Guardar alterações
          </Button>
        </>
      )}
    </div>
  );
}

function ReadOnlyRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Icon size={15} strokeWidth={1.75} className="text-n-400 shrink-0" />
      <span className="text-sm font-body text-n-500 flex-1">{label}</span>
      <span className="text-sm font-body font-semibold text-n-800">{value}</span>
    </div>
  );
}

/* ─── Portal Principal ─── */
export default function StaffPortal() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const staffId  = user?.user_metadata?.staff_id;
  const staffRole = user?.user_metadata?.staff_role;

  if (!staffId) {
    navigate('/login');
    return null;
  }

  const navClass = ({ isActive }) =>
    `flex-1 flex flex-col items-center gap-1 py-2 text-xs font-body font-semibold transition-colors ${isActive ? 'text-ocean-700' : 'text-n-400'}`;

  return (
    <div className="min-h-screen bg-n-50 flex flex-col max-w-md mx-auto">
      {/* Header */}
      <div className="bg-ocean-900 text-white px-4 py-3 flex items-center justify-between">
        <Logo white size="sm"/>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-body opacity-80 leading-tight">{user?.user_metadata?.name}</p>
            {staffRole && (
              <span className="text-[9px] font-mono uppercase tracking-wide text-sand-400">{staffRole}</span>
            )}
          </div>
          <button onClick={() => { logout(); navigate('/login'); }} className="opacity-60 hover:opacity-100">
            <LogOut size={16} strokeWidth={1.75}/>
          </button>
        </div>
      </div>

      {/* Conteudo */}
      <div className="flex-1 overflow-y-auto pb-16">
        <Routes>
          <Route index element={<JobsList staffId={staffId}/>}/>
          <Route path="jobs"      element={<JobsList staffId={staffId}/>}/>
          <Route path="jobs/:jobId" element={<JobDetail staffId={staffId}/>}/>
          <Route path="calendario"     element={<StaffCalendar/>}/>
          <Route path="disponibilidade" element={<StaffAvailability staffId={staffId}/>}/>
          <Route path="chat"           element={<StaffChat/>}/>
          <Route path="perfil"         element={<StaffProfile/>}/>
        </Routes>
      </div>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-n-200 flex z-50">
        <NavLink to="/staff/jobs"           className={navClass}><Briefcase size={20} strokeWidth={1.75}/><span>Trabalhos</span></NavLink>
        <NavLink to="/staff/calendario"     className={navClass}><Calendar size={20} strokeWidth={1.75}/><span>Calendario</span></NavLink>
        <NavLink to="/staff/disponibilidade" className={navClass}><CalendarCheck size={20} strokeWidth={1.75}/><span>Disponib.</span></NavLink>
        <NavLink to="/staff/chat"           className={navClass}><MessageCircle size={20} strokeWidth={1.75}/><span>Chat</span></NavLink>
        <NavLink to="/staff/perfil"         className={navClass}><User size={20} strokeWidth={1.75}/><span>Perfil</span></NavLink>
      </nav>
    </div>
  );
}
