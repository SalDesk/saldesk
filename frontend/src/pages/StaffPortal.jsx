import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Route, Routes, NavLink } from 'react-router-dom';
import {
  Briefcase, Euro, LogOut, CheckCircle, PlayCircle, Clock, MapPin, User, Users, ChevronRight, ChevronLeft, Car, AlertTriangle,
  Calendar, CalendarCheck, MessageCircle, Camera, Upload, Phone, Lock, Mail, Sun, Send,
} from 'lucide-react';
import { io } from 'socket.io-client';
import api from '../services/api';
import { getMyProfile, updateMyProfile, setAvailability, listStaff } from '../services/staffService';
import { listGroups, listMessages, sendMessage } from '../services/messageService';
import { forgotPassword } from '../services/authService';
import { getMonthGrid } from '../utils/calendar';
import useAuthStore from '../store/authStore';
import { useToast } from '../store/toastStore';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import Logo from '../components/shared/Logo';

const STATUS_CFG = {
  pending:     { label: 'Pendente',   cls: 'bg-sand-100 text-sand-600' },
  confirmed:   { label: 'Confirmado', cls: 'bg-ocean-50 text-ocean-700' },
  in_progress: { label: 'Em curso',   cls: 'bg-turquoise-100 text-turquoise-700' },
  completed:   { label: 'Concluido',  cls: 'bg-n-100 text-n-500' },
  cancelled:   { label: 'Cancelado',  cls: 'bg-red-50 text-error' },
};
const TOUR_ICON_BG = ['bg-turquoise-100 text-turquoise-700', 'bg-sand-100 text-sand-600', 'bg-ocean-100 text-ocean-700'];
const MONTHS_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const DAYS_PT   = ['Dom','Seg','Ter','Qua','Qui','Sex','Sab'];
const TODAY = new Date().toISOString().slice(0, 10);

function formatDate(d) { if (!d) return '—'; const dt = new Date(d+'T00:00:00Z'); return dt.toLocaleDateString('pt-PT',{day:'2-digit',month:'short',year:'numeric'}); }

function StatusBadge({ status }) {
  const sc = STATUS_CFG[status] || STATUS_CFG.pending;
  return <span className={`text-xs font-mono px-2 py-1 rounded-lg ${sc.cls}`}>{sc.label}</span>;
}

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
        <p className="text-xs font-mono font-bold uppercase tracking-wide text-n-500 mb-2">Proximo trabalho</p>
        {nextJob ? (
          <button onClick={() => navigate(`/staff/jobs/${nextJob.id}`)}
            className="w-full bg-gradient-to-br from-ocean-700 to-turquoise-600 rounded-2xl p-4 flex items-center justify-between text-left active:scale-[0.99] transition-all">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
                <MapPin size={18} strokeWidth={1.75} className="text-white" />
              </div>
              <div>
                <p className="font-display font-bold text-base text-white">{nextJob.reservations?.units?.name || '—'}</p>
                <p className="text-xs font-body text-white/80 mt-0.5">
                  {nextJob.reservations?.customer_name} · {formatDate(nextJob.reservations?.check_in)}
                </p>
              </div>
            </div>
            <ChevronRight size={18} strokeWidth={1.75} className="text-white/70 shrink-0" />
          </button>
        ) : (
          <div className="bg-white rounded-2xl border border-n-200 p-5 text-center text-n-400">
            <Briefcase size={24} strokeWidth={1.25} className="mx-auto mb-2" />
            <p className="text-sm font-body">Sem trabalhos agendados</p>
          </div>
        )}
        <p className="text-xs font-body text-n-400 mt-2 text-center">{weeklyCount} trabalho(s) esta semana</p>
      </div>

      <div>
        <p className="text-xs font-mono font-bold uppercase tracking-wide text-n-500 mb-3">Proximos trabalhos</p>
        {upcoming.length === 0 ? (
          <div className="text-center py-8 text-n-400"><Briefcase size={28} strokeWidth={1.25} className="mx-auto mb-2"/><p className="text-sm font-body">Sem trabalhos pendentes</p></div>
        ) : upcoming.map((j, i) => (
          <button key={j.id} onClick={() => navigate(`/staff/jobs/${j.id}`)}
            className="w-full bg-white rounded-3xl border border-n-200 shadow-sm px-4 py-4 mb-3 flex items-center gap-3 text-left hover:border-turquoise-300 transition-colors">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${TOUR_ICON_BG[i % TOUR_ICON_BG.length]}`}>
              <MapPin size={18} strokeWidth={1.75} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display font-bold text-sm text-n-900 truncate">{j.reservations?.units?.name}</p>
              <p className="text-xs font-body text-n-500 mt-0.5 truncate">{j.reservations?.customer_name} · {formatDate(j.reservations?.check_in)}</p>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <StatusBadge status={j.status} />
              <ChevronRight size={16} strokeWidth={1.75} className="text-n-300"/>
            </div>
          </button>
        ))}
      </div>

      {history.length > 0 && (
        <div>
          <p className="text-xs font-mono font-bold uppercase tracking-wide text-n-500 mb-3">Historico recente</p>
          {history.map(j => (
            <div key={j.id} className="bg-white rounded-2xl border border-n-100 px-4 py-3 mb-2 flex items-center justify-between opacity-70">
              <div>
                <p className="text-sm font-body font-semibold text-n-700">{j.reservations?.units?.name}</p>
                <p className="text-xs font-body text-n-400">{formatDate(j.reservations?.check_in)}</p>
              </div>
              <StatusBadge status={j.status} />
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
      <button onClick={() => navigate('/staff/jobs')} className="text-xs font-body font-semibold text-ocean-700 mb-4 flex items-center gap-1">
        <ChevronLeft size={14} strokeWidth={2}/> Voltar
      </button>

      <div className="bg-white rounded-3xl border border-n-200 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-base text-n-900">{r?.units?.name}</h2>
          <StatusBadge status={job.status} />
        </div>

        <div className="space-y-3 py-3 border-y border-n-100">
          <InfoRow icon={User}    label="Cliente"   value={r?.customer_name} />
          <InfoRow icon={Clock}   label="Check-in"  value={formatDate(r?.check_in)} />
          <InfoRow icon={Clock}   label="Check-out" value={formatDate(r?.check_out)} />
          {job.fleet?.name && <InfoRow icon={Car} label="Viatura" value={job.fleet.name} />}
          {job.earnings_amount > 0 && <InfoRow icon={Euro} label="Ganho" value={`€${Number(job.earnings_amount).toFixed(2)}`} />}
        </div>

        {job.notes_manager && (
          <div className="bg-n-50 rounded-xl px-3 py-2">
            <p className="text-xs font-mono font-bold uppercase tracking-wide text-n-500 mb-1">Notas do gestor</p>
            <p className="text-sm font-body text-n-700">{job.notes_manager}</p>
          </div>
        )}

        <div className="space-y-2 pt-2">
          {job.status === 'pending' && (
            <button onClick={() => updateStatus('confirm')} disabled={acting}
              className="w-full h-12 bg-turquoise-600 hover:bg-turquoise-700 text-white rounded-2xl font-display font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.99] transition-all disabled:opacity-50">
              <CheckCircle size={17} strokeWidth={1.75} />
              {acting ? 'A confirmar...' : 'Confirmar trabalho'}
            </button>
          )}
          {job.status === 'confirmed' && (
            <button onClick={() => updateStatus('start')} disabled={acting}
              className="w-full h-12 bg-turquoise-600 hover:bg-turquoise-700 text-white rounded-2xl font-display font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.99] transition-all disabled:opacity-50">
              <PlayCircle size={17} strokeWidth={1.75} />
              {acting ? 'A iniciar...' : 'Iniciar'}
            </button>
          )}
          {job.status === 'in_progress' && (
            <button onClick={() => updateStatus('complete')} disabled={acting}
              className="w-full h-12 bg-sand-500 hover:bg-sand-600 text-ocean-900 rounded-2xl font-display font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.99] transition-all disabled:opacity-50">
              {acting ? 'A concluir...' : 'Marcar como concluido'}
            </button>
          )}
        </div>

        {job.fleet?.name && (
          <div className="pt-2 border-t border-n-100">
            {reportDone && (
              <p className="text-xs font-body text-turquoise-700 mb-2">Problema reportado ao gestor.</p>
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
                  className="w-full px-3 py-2 rounded-xl border border-n-300 text-sm font-body bg-n-100 focus:outline-none focus:ring-2 focus:ring-turquoise-300 focus:border-turquoise-600 focus:bg-white resize-none"
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

/* ─── Vista: Chat de equipa ─── */
function StaffChat({ staffId }) {
  const { token } = useAuthStore();
  const [view,            setView]      = useState('list'); // 'list' | 'conversation'
  const [selectedContact, setSelected]  = useState(null);  // { id, name, type:'group'|'dm', ... }
  const [groups,      setGroups]     = useState([]);
  const [colleagues,  setColleagues] = useState([]);
  const [messages,    setMessages]   = useState([]);
  const [text,        setText]       = useState('');
  const [loading,     setLoading]    = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const socketRef    = useRef(null);
  const bottomRef    = useRef(null);
  const selectedRef  = useRef(null);

  useEffect(() => { selectedRef.current = selectedContact; }, [selectedContact]);

  /* Carregar grupos + colegas ao montar */
  useEffect(() => {
    Promise.all([listGroups(), listStaff({ status: 'active' })])
      .then(([g, s]) => {
        setGroups(g || []);
        setColleagues((s || []).filter(m => m.id !== staffId));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [staffId]);

  /* WebSocket — ligado enquanto a aba Chat estiver aberta */
  useEffect(() => {
    if (!token) return;
    const socketUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1').replace('/api/v1', '');
    const socket = io(socketUrl, { auth: { token } });
    socketRef.current = socket;
    socket.on('message:new', (msg) => {
      const cur = selectedRef.current;
      if (!cur) return;
      const isRelevant =
        (cur.type === 'group' && msg.group_id === cur.id) ||
        (cur.type === 'dm' && !msg.group_id && (
          msg.sender_id === cur.id ||
          (msg.sender_id === staffId && msg.recipient_id === cur.id)
        ));
      if (isRelevant) {
        setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg]);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      }
    });
    return () => socket.disconnect();
  }, [token, staffId]);

  async function openConversation(contact) {
    setSelected(contact);
    selectedRef.current = contact;
    setView('conversation');
    setMessages([]);
    setLoadingMsgs(true);
    try {
      const params = contact.type === 'group'
        ? { group_id: contact.id }
        : { recipient_id: contact.id };
      const result = await listMessages(params);
      setMessages(result?.data || []);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'auto' }), 50);
    } finally {
      setLoadingMsgs(false);
    }
  }

  async function handleSend() {
    const content = text.trim();
    if (!content || !selectedContact) return;
    setText('');
    const payload = selectedContact.type === 'group'
      ? { content, group_id: selectedContact.id, message_type: 'group', recipient_type: 'group' }
      : { content, recipient_id: selectedContact.id, recipient_type: 'staff', message_type: 'direct' };
    try {
      const msg = await sendMessage(payload);
      if (msg) {
        setMessages(prev => [...prev, msg]);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      }
    } catch {
      setText(content);
    }
  }

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner size={28}/></div>;

  /* === Vista: lista de contactos === */
  if (view === 'list') {
    const hasAnything = groups.length > 0 || colleagues.length > 0;
    return (
      <div className="px-4 py-4 space-y-5">
        {!hasAnything && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <MessageCircle size={40} strokeWidth={1} className="text-n-300 mb-3"/>
            <p className="font-display font-bold text-n-700">Sem conversas</p>
            <p className="text-sm font-body text-n-400 mt-2">Ainda nao existem grupos nem colaboradores associados.</p>
          </div>
        )}

        {groups.length > 0 && (
          <div>
            <p className="text-xs font-mono font-bold uppercase tracking-wide text-n-500 mb-3">Grupos</p>
            {groups.map(g => (
              <button key={g.id}
                onClick={() => openConversation({ id: g.id, name: g.name, type: 'group', memberCount: (g.members || []).length })}
                className="w-full bg-white rounded-2xl border border-n-200 shadow-sm px-4 py-3 mb-2 flex items-center gap-3 text-left hover:border-turquoise-300 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-sand-100 flex items-center justify-center shrink-0">
                  <Users size={16} strokeWidth={1.75} className="text-sand-600"/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display font-bold text-sm text-n-900">{g.name}</p>
                  <p className="text-xs font-body text-n-400 mt-0.5">{(g.members || []).length} membros</p>
                </div>
                <ChevronRight size={16} strokeWidth={1.75} className="text-n-300 shrink-0"/>
              </button>
            ))}
          </div>
        )}

        {colleagues.length > 0 && (
          <div>
            <p className="text-xs font-mono font-bold uppercase tracking-wide text-n-500 mb-3">Equipa</p>
            {colleagues.map((c, i) => (
              <button key={c.id}
                onClick={() => openConversation({ id: c.id, name: c.name, type: 'dm', role: c.role })}
                className="w-full bg-white rounded-2xl border border-n-200 shadow-sm px-4 py-3 mb-2 flex items-center gap-3 text-left hover:border-turquoise-300 transition-colors">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${TOUR_ICON_BG[i % TOUR_ICON_BG.length]}`}>
                  <User size={16} strokeWidth={1.75}/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display font-bold text-sm text-n-900">{c.name}</p>
                  {c.role && <p className="text-xs font-body text-n-400 mt-0.5">{c.role}</p>}
                </div>
                <ChevronRight size={16} strokeWidth={1.75} className="text-n-300 shrink-0"/>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  /* === Vista: conversa activa === */
  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 13rem)' }}>
      {/* Cabeçalho */}
      <div className="px-4 py-3 border-b border-n-200 flex items-center gap-3 bg-white">
        <button onClick={() => { setView('list'); setSelected(null); selectedRef.current = null; }}
          className="w-8 h-8 rounded-xl flex items-center justify-center text-n-500 hover:bg-n-100 transition-colors shrink-0">
          <ChevronLeft size={18} strokeWidth={2}/>
        </button>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${selectedContact.type === 'group' ? 'bg-sand-100' : 'bg-turquoise-100'}`}>
          {selectedContact.type === 'group'
            ? <Users size={16} strokeWidth={1.75} className="text-sand-600"/>
            : <User  size={16} strokeWidth={1.75} className="text-turquoise-700"/>}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display font-bold text-sm text-n-900 truncate">{selectedContact.name}</p>
          <p className="text-xs font-body text-n-400">
            {selectedContact.type === 'group'
              ? `${selectedContact.memberCount} membros`
              : selectedContact.role || 'Colaborador'}
          </p>
        </div>
      </div>

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {loadingMsgs ? (
          <div className="flex justify-center py-8"><LoadingSpinner size={24}/></div>
        ) : messages.length === 0 ? (
          <div className="flex justify-center py-12">
            <p className="text-xs font-body text-n-400">Sem mensagens ainda. Comece a conversa.</p>
          </div>
        ) : messages.map((msg, i) => {
          const isOwn = msg.sender_type === 'staff' && msg.sender_id === staffId;
          return (
            <div key={msg.id || i} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm font-body ${
                isOwn
                  ? 'bg-ocean-700 text-white rounded-br-sm'
                  : 'bg-white border border-n-200 text-n-800 rounded-bl-sm'
              }`}>
                {!isOwn && selectedContact.type === 'group' && (
                  <p className="text-[10px] font-mono text-n-400 mb-0.5">
                    {msg.sender_name || (msg.sender_type === 'manager' ? 'Gestor' : 'Equipa')}
                  </p>
                )}
                <p className="leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 bg-white border-t border-n-200 flex items-center gap-2">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Escreva uma mensagem..."
          className="flex-1 bg-n-50 rounded-xl px-4 py-2.5 text-sm font-body outline-none focus:ring-2 focus:ring-turquoise-300 transition-all"
        />
        <button
          onClick={handleSend}
          disabled={!text.trim()}
          className="w-10 h-10 bg-ocean-700 hover:bg-ocean-500 rounded-xl flex items-center justify-center text-white disabled:opacity-40 active:scale-95 transition-all"
        >
          <Send size={16} strokeWidth={1.75}/>
        </button>
      </div>
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

      <div className="bg-white rounded-2xl border border-n-200 p-4">
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
            <ChevronLeft size={18} strokeWidth={2} />
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
            <ChevronRight size={18} strokeWidth={2} />
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
                    className={`aspect-square rounded-xl flex items-center justify-center text-sm font-body font-semibold transition-all active:scale-95 ${
                      isPast
                        ? 'text-n-300 cursor-not-allowed'
                        : isAvailable
                        ? `text-turquoise-700 bg-turquoise-50 ${isT ? 'border-2 border-turquoise-400' : ''}`
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
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-turquoise-50 border border-turquoise-200" />Disponivel</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-red-50 border border-red-200" />Indisponivel</span>
      </div>

      <button
        onClick={handleSave}
        disabled={!hasChanges || saving}
        className="w-full h-12 bg-sand-500 hover:bg-sand-600 text-ocean-900 rounded-2xl font-display font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.99] transition-all disabled:opacity-50">
        {saving ? 'A guardar...' : 'Guardar'}
      </button>
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
    <div className="pb-6">
      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner size={28}/></div>
      ) : (
        <>
          {/* Foto de perfil */}
          <div className="flex flex-col items-center pt-6 pb-2">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-ocean-100 flex items-center justify-center overflow-hidden border-4 border-ocean-200 shadow-md">
                {photoPreview
                  ? <img src={photoPreview} alt={staffName} className="w-full h-full object-cover" />
                  : <Camera size={28} strokeWidth={1.5} className="text-ocean-400" />}
              </div>
              <button type="button" onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-8 h-8 bg-sand-500 text-ocean-900 rounded-full flex items-center justify-center shadow-md hover:bg-sand-600 active:scale-95 transition-all">
                <Upload size={14} strokeWidth={2} />
              </button>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
            </div>
          </div>

          <div className="px-4 pt-5 space-y-6">
            {/* Editable fields */}
            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-1.5 text-sm font-body font-semibold text-n-700 mb-2">
                  <Phone size={14} strokeWidth={1.75} />Telefone
                </label>
                <input
                  type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="+238 900 0000"
                  className="w-full h-11 px-4 rounded-xl border border-n-300 text-sm font-body bg-n-100 focus:outline-none focus:ring-2 focus:ring-turquoise-300 focus:border-turquoise-500 focus:bg-white transition-colors"
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-sm font-body font-semibold text-n-700 mb-2">
                  <MessageCircle size={14} strokeWidth={1.75} />WhatsApp
                </label>
                <input
                  type="tel" value={whatsapp} onChange={e => setWhatsapp(e.target.value)}
                  placeholder="+238 900 0000"
                  className="w-full h-11 px-4 rounded-xl border border-n-300 text-sm font-body bg-n-100 focus:outline-none focus:ring-2 focus:ring-turquoise-300 focus:border-turquoise-500 focus:bg-white transition-colors"
                />
              </div>
            </div>

            {/* Read-only info */}
            <div>
              <p className="text-xs font-mono uppercase tracking-wider text-n-400 mb-2">Definido pelo operador</p>
              <div className="bg-white rounded-2xl border border-n-200 divide-y divide-n-100">
                <ReadOnlyRow icon={User} label="Nome" value={staffName} />
                {profile?.role && <ReadOnlyRow icon={Briefcase} label="Cargo" value={profile.role} />}
                {staffEmail && <ReadOnlyRow icon={Mail} label="Email" value={staffEmail} />}
              </div>
            </div>

            {/* Change password */}
            <button
              onClick={handleChangePassword}
              disabled={sendingReset}
              className="w-full h-12 bg-white border border-n-300 text-n-700 rounded-2xl font-body font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.99] transition-all hover:border-turquoise-300 disabled:opacity-50">
              <Lock size={16} strokeWidth={1.75} />
              {sendingReset ? 'A enviar...' : 'Alterar password'}
            </button>

            {/* Save */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full h-12 bg-sand-500 hover:bg-sand-600 text-ocean-900 rounded-2xl font-display font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.99] transition-all disabled:opacity-50">
              {saving ? 'A guardar...' : 'Guardar alteracoes'}
            </button>
          </div>
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
  const staffName = user?.user_metadata?.name || 'Colaborador';

  if (!staffId) {
    navigate('/login');
    return null;
  }

  const navClass = ({ isActive }) =>
    `flex-1 flex flex-col items-center gap-1 py-2.5 text-xs font-body font-semibold transition-colors ${isActive ? 'text-turquoise-700' : 'text-n-400'}`;

  function handleLogout() { logout(); navigate('/login'); }

  return (
    <div className="min-h-screen bg-n-50 flex flex-col max-w-md mx-auto">
      {/* Header */}
      <header className="bg-gradient-to-br from-ocean-900 to-ocean-700 px-5 pt-6 pb-5 rounded-b-3xl shadow-lg">
        <div className="flex items-center justify-between mb-5">
          <Logo white size="sm" />
          <button onClick={handleLogout}
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all">
            <LogOut size={18} strokeWidth={1.75} className="text-ocean-200" />
          </button>
        </div>

        <div className="flex items-center gap-2 mb-1">
          <Sun size={20} strokeWidth={1.75} className="text-sand-400" />
          <p className="font-display font-bold text-2xl text-white">Ola, {staffName}</p>
        </div>
        {staffRole && (
          <span className="text-[10px] font-mono uppercase tracking-wide text-sand-400">{staffRole}</span>
        )}
      </header>

      {/* Conteudo */}
      <div className="flex-1 overflow-y-auto pb-20">
        <Routes>
          <Route index element={<JobsList staffId={staffId}/>}/>
          <Route path="jobs"      element={<JobsList staffId={staffId}/>}/>
          <Route path="jobs/:jobId" element={<JobDetail staffId={staffId}/>}/>
          <Route path="calendario"     element={<StaffCalendar/>}/>
          <Route path="disponibilidade" element={<StaffAvailability staffId={staffId}/>}/>
          <Route path="chat"           element={<StaffChat staffId={staffId}/>}/>
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
