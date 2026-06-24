import { useState, useEffect } from 'react';
import { useParams, useNavigate, Route, Routes, NavLink } from 'react-router-dom';
import { Briefcase, Euro, LogOut, CheckCircle, PlayCircle, Clock, MapPin, User, ChevronRight } from 'lucide-react';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import { useT } from '../i18n';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import Logo from '../components/shared/Logo';

const STATUS_BADGE  = { pending:'pending', confirmed:'info', in_progress:'checked_in', completed:'checked_out', cancelled:'cancelled' };
const STATUS_LABELS = { pending:'Pendente', confirmed:'Confirmado', in_progress:'Em curso', completed:'Concluido', cancelled:'Cancelado' };

function formatDate(d) { if (!d) return '—'; const dt = new Date(d+'T00:00:00Z'); return dt.toLocaleDateString('pt-PT',{day:'2-digit',month:'short',year:'numeric'}); }
function formatTime(d) { if (!d) return ''; return new Date(d).toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit'}); }

/* ─── Vista: Lista de trabalhos ─── */
function JobsList({ staffId }) {
  const [jobs, setJobs]     = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get(`/staff/${staffId}/jobs`).then(r => setJobs(r.data.data || [])).finally(() => setLoading(false));
  }, [staffId]);

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner size={28}/></div>;

  const upcoming  = jobs.filter(j => ['pending','confirmed','in_progress'].includes(j.status));
  const history   = jobs.filter(j => ['completed','cancelled'].includes(j.status)).slice(0,10);

  return (
    <div className="px-4 py-4 space-y-6">
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

/* ─── Vista: Ganhos ─── */
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

/* ─── Portal Principal ─── */
export default function StaffPortal() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const staffId  = user?.user_metadata?.staff_id;

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
          <span className="text-sm font-body opacity-80">{user?.user_metadata?.name}</span>
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
          <Route path="earnings"  element={<Earnings staffId={staffId}/>}/>
        </Routes>
      </div>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-n-200 flex z-50">
        <NavLink to="/staff/jobs"     className={navClass}><Briefcase size={20} strokeWidth={1.75}/><span>Trabalhos</span></NavLink>
        <NavLink to="/staff/earnings" className={navClass}><Euro size={20} strokeWidth={1.75}/><span>Ganhos</span></NavLink>
      </nav>
    </div>
  );
}
