import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import {
  Plus, Pencil, Trash2, Star, Briefcase, Phone, Mail, MessageSquare,
  Users, CheckSquare, AlertTriangle, Camera, Send, Upload, Shield,
  Search, MoreVertical, CheckCircle2, XCircle, Clock, X, Tag,
  Circle, ChevronRight, ArrowRight, Hash, Volume2,
} from 'lucide-react';
import {
  listStaff, createStaff, updateStaff, deleteStaff,
} from '../services/staffService';
import {
  listAssignments, startAssignment, completeAssignment,
  cancelAssignment, createAssignment,
} from '../services/assignmentService';
import {
  listMessages, sendMessage, getUnreadCount, listGroups, createGroup,
} from '../services/messageService';
import useAuthStore from '../store/authStore';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input, { Select, Textarea } from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import LoadingSpinner from '../components/shared/LoadingSpinner';

/* ── Constants ── */
const ROLES = ['Instrutor', 'Guia', 'Motorista', 'Assistente', 'Recepcao', 'Coordenador', 'Outro'];
const DAYS  = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];
const PRIO  = { low: 'Baixa', medium: 'Media', high: 'Alta', urgent: 'Urgente' };
const PRIO_COLORS = {
  low:    'text-n-500 bg-n-100',
  medium: 'text-[var(--warning)] bg-yellow-50',
  high:   'text-error bg-red-50',
  urgent: 'text-white bg-error',
};
const KANBAN_COLS = [
  { key: 'pending',     label: 'Pendente',    color: 'border-yellow-300 text-yellow-800 bg-yellow-50' },
  { key: 'in_progress', label: 'Em Progresso', color: 'border-ocean-300 text-ocean-700 bg-ocean-50' },
  { key: 'completed',   label: 'Concluida',   color: 'border-green-300 text-green-800 bg-green-50' },
  { key: 'cancelled',   label: 'Bloqueada',   color: 'border-red-300 text-error bg-red-50' },
];

function tryParseNotes(str) {
  try { return JSON.parse(str || ''); } catch { return null; }
}

/* ── StaffAvatar ── */
function StaffAvatar({ member, size = 40, showStatus = true }) {
  const initials = member.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {member.photo_url ? (
        <img src={member.photo_url} alt={member.name}
          className="w-full h-full rounded-full object-cover" />
      ) : (
        <div className="w-full h-full rounded-full bg-ocean-700 flex items-center justify-center text-white font-display font-bold"
          style={{ fontSize: Math.round(size * 0.36) }}>
          {initials}
        </div>
      )}
      {showStatus && (
        <span className={`absolute bottom-0 right-0 rounded-full border-2 border-white ${size >= 36 ? 'w-3 h-3' : 'w-2.5 h-2.5'} ${member.status === 'active' ? 'bg-green-500' : 'bg-n-300'}`} />
      )}
    </div>
  );
}

/* ── StaffCard ── */
function StaffCard({ member, onEdit, onDelete }) {
  return (
    <div className="bg-white rounded-md border border-n-200 shadow-sm p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <StaffAvatar member={member} size={44} />
          <div>
            <p className="font-display font-semibold text-sm text-n-900">{member.name}</p>
            <p className="text-xs font-body text-n-500">{member.role}</p>
          </div>
        </div>
        <div className="flex gap-0.5">
          <button onClick={() => onEdit(member)}
            className="p-1.5 rounded text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors">
            <Pencil size={14} strokeWidth={1.75} />
          </button>
          <button onClick={() => onDelete(member)}
            className="p-1.5 rounded text-n-400 hover:text-error hover:bg-red-50 transition-colors">
            <Trash2 size={14} strokeWidth={1.75} />
          </button>
        </div>
      </div>
      <div className="space-y-1">
        {member.phone && (
          <p className="text-xs font-body text-n-600 flex items-center gap-1.5">
            <Phone size={11} strokeWidth={1.75} className="text-n-400" />{member.phone}
          </p>
        )}
        {member.email && (
          <p className="text-xs font-body text-n-600 flex items-center gap-1.5">
            <Mail size={11} strokeWidth={1.75} className="text-n-400" />{member.email}
          </p>
        )}
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-n-100 text-xs font-body text-n-500">
        <span className="flex items-center gap-1">
          <Briefcase size={11} strokeWidth={1.75} />{member.total_jobs_completed || 0} trabalhos
        </span>
        {member.average_rating > 0 && (
          <span className="flex items-center gap-1">
            <Star size={11} strokeWidth={1.75} className="text-sand-500 fill-sand-500" />
            {Number(member.average_rating).toFixed(1)}
          </span>
        )}
        <span className={`flex items-center gap-1 ${member.status === 'active' ? 'text-green-600' : 'text-n-400'}`}>
          <Circle size={7} strokeWidth={0} className={member.status === 'active' ? 'fill-green-500' : 'fill-n-300'} />
          {member.status === 'active' ? 'Activo' : 'Inactivo'}
        </span>
      </div>
    </div>
  );
}

/* ── StaffForm ── */
function StaffForm({ member, onSave, onCancel, loading, error }) {
  const [form, setForm] = useState({
    name:       member?.name      || '',
    role:       member?.role      || ROLES[0],
    phone:      member?.phone     || '',
    email:      member?.email     || '',
    whatsapp:   member?.whatsapp  || '',
    photo_url:  member?.photo_url || '',
    status:     member?.status    || 'active',
  });
  const [photoPreview, setPhotoPreview] = useState(member?.photo_url || null);
  const [createAccess, setCreateAccess]  = useState(false);
  const [skillInput, setSkillInput]      = useState('');
  const [skills,  setSkills]   = useState([]);
  const [schedule, setSchedule] = useState([]);
  const fileRef = useRef(null);

  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result);
      setForm(p => ({ ...p, photo_url: reader.result }));
    };
    reader.readAsDataURL(file);
  }

  function addSkill(e) {
    if (e.key === 'Enter' && skillInput.trim()) {
      e.preventDefault();
      if (!skills.includes(skillInput.trim())) setSkills(s => [...s, skillInput.trim()]);
      setSkillInput('');
    }
  }

  function toggleDay(d) {
    setSchedule(p => p.includes(d) ? p.filter(x => x !== d) : [...p, d]);
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSave({ ...form, skills, schedule, create_access: createAccess });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Photo */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-full bg-n-100 border-2 border-n-200 flex items-center justify-center overflow-hidden">
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
          <p className="text-sm font-display font-semibold text-n-800">Foto de perfil</p>
          <p className="text-xs font-body text-n-500">JPG, PNG ate 2MB</p>
        </div>
      </div>

      <Input label="Nome completo" value={form.name} onChange={set('name')} required placeholder="Nome e apelido" />

      <div className="grid grid-cols-2 gap-3">
        <Select label="Cargo" value={form.role} onChange={set('role')} required>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </Select>
        {member && (
          <Select label="Estado" value={form.status} onChange={set('status')}>
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
          </Select>
        )}
      </div>

      <Input label="Telefone" value={form.phone} onChange={set('phone')} type="tel" placeholder="+238 900 0000" />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Email" value={form.email} onChange={set('email')} type="email" placeholder="nome@email.com" />
        <Input label="WhatsApp" value={form.whatsapp} onChange={set('whatsapp')} type="tel" placeholder="+238 900 0000" />
      </div>

      {/* Schedule */}
      <div>
        <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600 mb-2 block">
          Horario habitual
        </label>
        <div className="flex gap-1.5 flex-wrap">
          {DAYS.map(d => (
            <button key={d} type="button" onClick={() => toggleDay(d)}
              className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors ${schedule.includes(d) ? 'bg-ocean-700 text-white' : 'bg-n-100 text-n-600 hover:bg-n-200'}`}>
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Skills */}
      <div>
        <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600 mb-2 block">
          Competencias e certificacoes
        </label>
        {skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {skills.map(s => (
              <span key={s} className="flex items-center gap-1 px-2 py-0.5 bg-ocean-50 text-ocean-700 rounded text-xs font-body">
                <Tag size={9} strokeWidth={1.75} />{s}
                <button type="button" onClick={() => setSkills(p => p.filter(x => x !== s))}>
                  <X size={10} strokeWidth={2} />
                </button>
              </span>
            ))}
          </div>
        )}
        <input
          type="text" value={skillInput}
          onChange={e => setSkillInput(e.target.value)} onKeyDown={addSkill}
          placeholder="Escrever competencia + Enter"
          className="w-full h-9 px-3 rounded-sm border border-n-300 text-sm font-body bg-n-100 text-n-900 placeholder:text-n-400 focus:outline-none focus:ring-2 focus:ring-ocean-300 focus:border-ocean-700 focus:bg-white"
        />
      </div>

      {/* Create access account */}
      {!member && (
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
              Sera criada uma conta de acesso com email e password temporaria. O colaborador recebera as credenciais por WhatsApp.
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm font-body px-3 py-2 rounded-sm bg-red-50 text-error">{error}</p>
      )}

      <div className="flex gap-3 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">Cancelar</Button>
        <Button type="submit" loading={loading} className="flex-1">
          {member ? 'Guardar alteracoes' : 'Criar colaborador'}
        </Button>
      </div>
    </form>
  );
}

/* ── Kanban Task Card ── */
function TaskCard({ task, staffList, onMove, onOpen }) {
  const meta  = tryParseNotes(task.notes_manager);
  const title = meta?.title || task.notes_manager || `Atribuicao #${String(task.id).slice(-6)}`;
  const prio  = meta?.priority || 'medium';
  const staffMember = staffList.find(s => s.id === task.staff_id);
  const dueDate = meta?.due ? new Date(meta.due) : null;
  const isOverdue = dueDate && dueDate < new Date() && !['completed', 'cancelled'].includes(task.status);

  const nextStatus = {
    pending: 'in_progress', in_progress: 'completed',
    confirmed: 'in_progress',
  };

  return (
    <div onClick={() => onOpen(task)}
      className={`bg-white border rounded-md p-3 cursor-pointer hover:shadow-md transition-all ${isOverdue ? 'border-error' : 'border-n-200'}`}>
      {isOverdue && (
        <div className="flex items-center gap-1 mb-1.5 text-error text-xs font-body">
          <AlertTriangle size={11} strokeWidth={1.75} />
          <span>Atrasada</span>
        </div>
      )}
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-display font-semibold text-n-900 line-clamp-2 leading-tight">{title}</p>
        <span className={`shrink-0 text-xs font-mono font-medium px-1.5 py-0.5 rounded ${PRIO_COLORS[prio]}`}>
          {PRIO[prio]}
        </span>
      </div>
      {meta?.checklist?.length > 0 && (
        <p className="text-xs font-body text-n-400 mb-2">
          <CheckSquare size={10} strokeWidth={1.75} className="inline mr-1" />
          {meta.checklist.filter(Boolean).length} sub-tarefas
        </p>
      )}
      <div className="flex items-center justify-between pt-2 border-t border-n-100">
        {staffMember ? (
          <div className="flex items-center gap-1.5">
            <StaffAvatar member={staffMember} size={20} showStatus={false} />
            <span className="text-xs font-body text-n-500">{staffMember.name.split(' ')[0]}</span>
          </div>
        ) : <span />}
        {dueDate && (
          <span className={`text-xs font-mono ${isOverdue ? 'text-error' : 'text-n-400'}`}>
            <Clock size={10} strokeWidth={1.75} className="inline mr-0.5" />
            {dueDate.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })}
          </span>
        )}
      </div>
      {nextStatus[task.status] && (
        <button
          onClick={e => { e.stopPropagation(); onMove(nextStatus[task.status]); }}
          className="mt-2 w-full flex items-center justify-center gap-1 py-1 rounded text-xs font-body text-ocean-700 bg-ocean-50 hover:bg-ocean-100 transition-colors">
          <ArrowRight size={11} strokeWidth={1.75} />
          Mover para {KANBAN_COLS.find(c => c.key === nextStatus[task.status])?.label}
        </button>
      )}
    </div>
  );
}

/* ── Kanban Board ── */
function KanbanBoard({ staffList }) {
  const [tasks, setTasks]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState(null);
  const [taskModal, setTaskModal] = useState(false);
  const [taskForm, setTaskForm]   = useState({ title: '', desc: '', priority: 'medium', due: '', staff_id: '', checklist: '' });
  const [saving, setSaving]       = useState(false);
  const [filterStaff, setFilter]  = useState('');

  useEffect(() => {
    listAssignments().then(setTasks).finally(() => setLoading(false));
  }, []);

  async function moveTask(task, newStatus) {
    try {
      if      (newStatus === 'in_progress') await startAssignment(task.id);
      else if (newStatus === 'completed')   await completeAssignment(task.id);
      else if (newStatus === 'cancelled')   await cancelAssignment(task.id);
      setTasks(p => p.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
    } catch (err) { console.error(err); }
  }

  async function handleCreateTask(e) {
    e.preventDefault(); setSaving(true);
    try {
      const meta = {
        title: taskForm.title,
        desc: taskForm.desc,
        priority: taskForm.priority,
        due: taskForm.due,
        checklist: taskForm.checklist.split('\n').filter(Boolean),
      };
      const payload = {
        staff_id: taskForm.staff_id || null,
        notes_manager: JSON.stringify(meta),
      };
      const created = await createAssignment(payload);
      setTasks(p => [created, ...p]);
      setTaskModal(false);
      setTaskForm({ title: '', desc: '', priority: 'medium', due: '', staff_id: '', checklist: '' });
    } catch (err) {
      console.error(err);
    } finally { setSaving(false); }
  }

  const filtered = filterStaff
    ? tasks.filter(t => t.staff_id === filterStaff)
    : tasks;

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size={32} /></div>;

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <select
            value={filterStaff}
            onChange={e => setFilter(e.target.value)}
            className="h-8 px-2 text-xs font-body border border-n-200 rounded bg-white text-n-700 focus:outline-none">
            <option value="">Todos os colaboradores</option>
            {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <span className="text-xs font-body text-n-400">{filtered.length} tarefa(s)</span>
        </div>
        <Button icon={Plus} size="sm" onClick={() => setTaskModal(true)}>Nova tarefa</Button>
      </div>

      {/* Overdue alert */}
      {filtered.some(t => {
        const m = tryParseNotes(t.notes_manager);
        return m?.due && new Date(m.due) < new Date() && !['completed','cancelled'].includes(t.status);
      }) && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-md text-xs font-body text-error">
          <AlertTriangle size={14} strokeWidth={1.75} />
          Existem tarefas com prazo ultrapassado
        </div>
      )}

      {/* Kanban columns */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {KANBAN_COLS.map(col => {
          const colTasks = filtered.filter(t =>
            t.status === col.key || (col.key === 'in_progress' && t.status === 'confirmed')
          );
          return (
            <div key={col.key}>
              <div className={`flex items-center justify-between px-3 py-2 rounded-t-md border mb-2 ${col.color}`}>
                <span className="text-xs font-mono font-semibold uppercase tracking-wider">{col.label}</span>
                <span className="text-xs font-mono font-bold">{colTasks.length}</span>
              </div>
              <div className="space-y-2">
                {colTasks.map(task => (
                  <TaskCard key={task.id} task={task} staffList={staffList}
                    onMove={s => moveTask(task, s)} onOpen={setSelected} />
                ))}
                {colTasks.length === 0 && (
                  <div className="border-2 border-dashed border-n-200 rounded-md p-4 text-center">
                    <p className="text-xs font-body text-n-400">Sem tarefas</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Task detail modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Detalhe da tarefa" size="md">
        {selected && (() => {
          const meta = tryParseNotes(selected.notes_manager);
          const staffMember = staffList.find(s => s.id === selected.staff_id);
          return (
            <div className="space-y-4">
              <p className="font-display font-semibold text-n-900">{meta?.title || selected.notes_manager}</p>
              {meta?.desc && <p className="text-sm font-body text-n-600">{meta.desc}</p>}
              <div className="flex gap-2 text-xs font-body text-n-500 flex-wrap">
                {meta?.priority && <span className={`px-2 py-0.5 rounded font-mono ${PRIO_COLORS[meta.priority]}`}>{PRIO[meta.priority]}</span>}
                {meta?.due && <span className="flex items-center gap-1"><Clock size={11} strokeWidth={1.75} />{new Date(meta.due).toLocaleDateString('pt-PT')}</span>}
                {staffMember && (
                  <span className="flex items-center gap-1.5">
                    <StaffAvatar member={staffMember} size={16} showStatus={false} />
                    {staffMember.name}
                  </span>
                )}
              </div>
              {meta?.checklist?.length > 0 && (
                <div>
                  <p className="text-xs font-mono uppercase tracking-wider text-n-500 mb-2">Checklist</p>
                  <div className="space-y-1.5">
                    {meta.checklist.map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm font-body text-n-700">
                        <CheckSquare size={14} strokeWidth={1.75} className="text-n-300 shrink-0" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2 pt-2 border-t border-n-100 flex-wrap">
                {selected.status === 'pending' && (
                  <Button size="sm" onClick={() => { moveTask(selected, 'in_progress'); setSelected(null); }}>
                    Iniciar
                  </Button>
                )}
                {['pending','confirmed','in_progress'].includes(selected.status) && (
                  <Button size="sm" variant="secondary" onClick={() => { moveTask(selected, 'completed'); setSelected(null); }}>
                    Concluir
                  </Button>
                )}
                {selected.status !== 'cancelled' && (
                  <Button size="sm" variant="danger" onClick={() => { moveTask(selected, 'cancelled'); setSelected(null); }}>
                    Bloquear
                  </Button>
                )}
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Create task modal */}
      <Modal open={taskModal} onClose={() => setTaskModal(false)} title="Nova tarefa" size="md">
        <form onSubmit={handleCreateTask} className="space-y-4">
          <Input label="Titulo" value={taskForm.title} onChange={e => setTaskForm(p => ({ ...p, title: e.target.value }))} required placeholder="Titulo da tarefa" />
          <Textarea label="Descricao" value={taskForm.desc} onChange={e => setTaskForm(p => ({ ...p, desc: e.target.value }))} placeholder="Descricao opcional" rows={2} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Prioridade" value={taskForm.priority} onChange={e => setTaskForm(p => ({ ...p, priority: e.target.value }))}>
              {Object.entries(PRIO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
            <Input label="Data limite" type="date" value={taskForm.due} onChange={e => setTaskForm(p => ({ ...p, due: e.target.value }))} />
          </div>
          <Select label="Colaborador" value={taskForm.staff_id} onChange={e => setTaskForm(p => ({ ...p, staff_id: e.target.value }))}>
            <option value="">Sem atribuicao</option>
            {staffList.filter(s => s.status === 'active').map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
          <Textarea label="Checklist (uma por linha)" value={taskForm.checklist} onChange={e => setTaskForm(p => ({ ...p, checklist: e.target.value }))} placeholder={"Item 1\nItem 2\nItem 3"} rows={3} />
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={() => setTaskModal(false)} className="flex-1">Cancelar</Button>
            <Button type="submit" loading={saving} className="flex-1">Criar tarefa</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

/* ── Chat Message ── */
function MessageBubble({ msg, isOwn, staffList }) {
  const sender = staffList.find(s => s.id === msg.sender_id);
  return (
    <div className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
      {!isOwn && sender && <StaffAvatar member={sender} size={24} showStatus={false} />}
      {!isOwn && !sender && (
        <div className="w-6 h-6 rounded-full bg-n-200 flex items-center justify-center shrink-0">
          <Hash size={10} strokeWidth={1.75} className="text-n-500" />
        </div>
      )}
      <div className={`max-w-[72%] px-3 py-2 rounded-lg text-sm font-body ${isOwn ? 'bg-ocean-700 text-white rounded-br-sm' : 'bg-n-100 text-n-900 rounded-bl-sm'}`}>
        {!isOwn && sender && (
          <p className={`text-xs font-mono font-semibold mb-0.5 ${isOwn ? 'text-ocean-200' : 'text-ocean-700'}`}>{sender.name.split(' ')[0]}</p>
        )}
        <p>{msg.content}</p>
        <p className={`text-xs mt-1 ${isOwn ? 'text-ocean-200' : 'text-n-400'}`}>
          {new Date(msg.created_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}

/* ── Chat Tab ── */
function ChatTab({ staffList }) {
  const { user }  = useAuthStore();
  const [groups, setGroups]         = useState([]);
  const [messages, setMessages]     = useState([]);
  const [conversation, setConvo]    = useState(null);
  const [input, setInput]           = useState('');
  const [loadingMsgs, setLoadMsgs]  = useState(false);
  const [groupModal, setGroupModal] = useState(false);
  const [groupName, setGroupName]   = useState('');
  const socketRef   = useRef(null);
  const endRef      = useRef(null);

  useEffect(() => {
    listGroups().then(setGroups).catch(() => {});

    const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1').replace('/api/v1', '');
    const sock = io(BASE, {
      auth: { token: useAuthStore.getState().token },
      transports: ['websocket'],
      reconnectionAttempts: 3,
    });
    socketRef.current = sock;
    sock.on('new_message', msg => {
      setMessages(p => [...p, msg]);
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
    return () => sock.disconnect();
  }, []);

  useEffect(() => {
    if (!conversation) return;
    setLoadMsgs(true);
    const params = conversation.type === 'group'
      ? { group_id: conversation.id }
      : { recipient_id: conversation.id };
    listMessages(params)
      .then(data => {
        setMessages(data.data || []);
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
      })
      .catch(() => setMessages([]))
      .finally(() => setLoadMsgs(false));
  }, [conversation]);

  async function handleSend(e) {
    e.preventDefault();
    if (!input.trim() || !conversation) return;
    const payload = {
      content: input.trim(),
      message_type: conversation.type === 'group' ? 'group' : 'direct',
      ...(conversation.type === 'group'
        ? { group_id: conversation.id }
        : { recipient_id: conversation.id, recipient_type: 'staff' }),
    };
    try {
      const msg = await sendMessage(payload);
      setMessages(p => [...p, msg]);
      setInput('');
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch (err) { console.error(err); }
  }

  async function handleCreateGroup(e) {
    e.preventDefault();
    if (!groupName.trim()) return;
    try {
      const g = await createGroup({ name: groupName.trim() });
      setGroups(p => [...p, g]);
      setGroupModal(false);
      setGroupName('');
    } catch (err) { console.error(err); }
  }

  const isAnnouncements = conversation?.type === 'group' && conversation?.isAnnouncements;

  return (
    <div className="flex border border-n-200 rounded-md overflow-hidden" style={{ height: 'calc(100vh - 220px)', minHeight: 420 }}>
      {/* Sidebar */}
      <div className="w-56 shrink-0 border-r border-n-200 bg-n-50 flex flex-col">
        <div className="px-3 py-2.5 border-b border-n-200 flex items-center justify-between">
          <span className="text-xs font-mono uppercase tracking-wider text-n-500">Mensagens</span>
          <button onClick={() => setGroupModal(true)}
            className="p-1 rounded text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors" title="Novo grupo">
            <Plus size={13} strokeWidth={1.75} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {/* Announcements */}
          <button
            onClick={() => setConvo({ type: 'group', id: 'announcements', name: 'Anuncios', isAnnouncements: true })}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-white transition-colors ${conversation?.id === 'announcements' ? 'bg-white border-r-2 border-ocean-700' : ''}`}>
            <div className="w-7 h-7 rounded-full bg-sand-300 flex items-center justify-center shrink-0">
              <Volume2 size={12} strokeWidth={1.75} className="text-sand-500" />
            </div>
            <span className="text-sm font-body text-n-800 truncate">Anuncios</span>
          </button>

          {/* Groups */}
          {groups.length > 0 && (
            <>
              <div className="px-3 pt-3 pb-1">
                <span className="text-xs font-mono text-n-400 uppercase">Grupos</span>
              </div>
              {groups.map(g => (
                <button key={g.id} onClick={() => setConvo({ type: 'group', id: g.id, name: g.name })}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white transition-colors ${conversation?.id === g.id ? 'bg-white border-r-2 border-ocean-700' : ''}`}>
                  <div className="w-7 h-7 rounded-full bg-ocean-50 flex items-center justify-center shrink-0">
                    <Users size={12} strokeWidth={1.75} className="text-ocean-700" />
                  </div>
                  <span className="text-sm font-body text-n-800 truncate">{g.name}</span>
                </button>
              ))}
            </>
          )}

          {/* Direct messages */}
          <div className="px-3 pt-3 pb-1">
            <span className="text-xs font-mono text-n-400 uppercase">Direto</span>
          </div>
          {staffList.map(s => (
            <button key={s.id} onClick={() => setConvo({ type: 'direct', id: s.id, name: s.name })}
              className={`w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white transition-colors ${conversation?.id === s.id ? 'bg-white border-r-2 border-ocean-700' : ''}`}>
              <StaffAvatar member={s} size={28} showStatus />
              <span className="text-sm font-body text-n-800 truncate">{s.name.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Chat area */}
      {conversation ? (
        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-4 py-3 border-b border-n-200 bg-white flex items-center gap-2 shrink-0">
            <MessageSquare size={15} strokeWidth={1.75} className="text-ocean-700" />
            <p className="font-display font-semibold text-sm text-n-900">{conversation.name}</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-n-50">
            {loadingMsgs
              ? <div className="flex justify-center pt-8"><LoadingSpinner size={24} /></div>
              : messages.length === 0
                ? <p className="text-xs font-body text-n-400 text-center pt-8">Sem mensagens ainda</p>
                : messages.map(msg => (
                  <MessageBubble key={msg.id} msg={msg} isOwn={msg.sender_id === user?.id} staffList={staffList} />
                ))
            }
            <div ref={endRef} />
          </div>
          {!isAnnouncements ? (
            <form onSubmit={handleSend} className="p-3 border-t border-n-200 bg-white flex gap-2 shrink-0">
              <input value={input} onChange={e => setInput(e.target.value)}
                placeholder="Escrever mensagem..."
                className="flex-1 h-9 px-3 rounded-sm border border-n-200 text-sm font-body bg-n-100 text-n-900 placeholder:text-n-400 focus:outline-none focus:border-ocean-700 focus:bg-white"
              />
              <button type="submit" disabled={!input.trim()}
                className="px-3 bg-ocean-700 text-white rounded-sm hover:bg-ocean-500 disabled:opacity-40 transition-colors">
                <Send size={15} strokeWidth={1.75} />
              </button>
            </form>
          ) : (
            <div className="p-3 border-t border-n-200 bg-n-50 shrink-0">
              <p className="text-xs font-body text-n-400 text-center">Canal de leitura — apenas gestores podem enviar</p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-n-50">
          <div className="text-center text-n-400">
            <MessageSquare size={32} strokeWidth={1.25} className="mx-auto mb-2" />
            <p className="text-sm font-body">Seleccionar uma conversa</p>
          </div>
        </div>
      )}

      {/* Create group modal */}
      <Modal open={groupModal} onClose={() => setGroupModal(false)} title="Novo grupo" size="sm">
        <form onSubmit={handleCreateGroup} className="space-y-4">
          <Input label="Nome do grupo" value={groupName} onChange={e => setGroupName(e.target.value)} required placeholder="Ex: Equipa de campo" />
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={() => setGroupModal(false)} className="flex-1">Cancelar</Button>
            <Button type="submit" className="flex-1">Criar grupo</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

/* ── Main Staff Page ── */
export default function Staff() {
  const [tab, setTab]               = useState('staff');
  const [staffList, setStaffList]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [modal, setModal]           = useState(null);
  const [formLoading, setFormLoad]  = useState(false);
  const [formError, setFormError]   = useState('');
  const [deleteTarget, setDelTarget]= useState(null);
  const [unread, setUnread]         = useState(0);
  const [search, setSearch]         = useState('');

  useEffect(() => {
    listStaff().then(setStaffList).finally(() => setLoading(false));
    getUnreadCount().then(setUnread).catch(() => {});
  }, []);

  async function handleSave(dados) {
    setFormError(''); setFormLoad(true);
    try {
      if (modal === 'create') {
        const m = await createStaff(dados);
        setStaffList(p => [m, ...p]);
      } else {
        const m = await updateStaff(modal.id, dados);
        setStaffList(p => p.map(s => s.id === m.id ? m : s));
      }
      setModal(null);
    } catch (err) {
      setFormError(err.response?.data?.error || 'Erro ao guardar');
    } finally { setFormLoad(false); }
  }

  async function handleDelete() {
    try {
      await deleteStaff(deleteTarget.id);
      setStaffList(p => p.filter(s => s.id !== deleteTarget.id));
    } finally { setDelTarget(null); }
  }

  const active    = staffList.filter(s => s.status === 'active').length;
  const filtered  = search
    ? staffList.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.role.toLowerCase().includes(search.toLowerCase()))
    : staffList;

  const TABS = [
    { key: 'staff', label: 'Colaboradores', Icon: Users },
    { key: 'tasks', label: 'Tarefas',        Icon: CheckSquare },
    { key: 'chat',  label: 'Chat',           Icon: MessageSquare, badge: unread },
  ];

  return (
    <div>
      <PageHeader
        title="Colaboradores"
        subtitle={`${active} activo(s) · ${staffList.length} total`}
        actions={
          tab === 'staff' && (
            <Button icon={Plus} onClick={() => { setFormError(''); setModal('create'); }}>
              Novo colaborador
            </Button>
          )
        }
      />

      {/* Tab bar */}
      <div className="flex gap-0.5 mb-5 bg-n-100 p-1 rounded-md w-fit">
        {TABS.map(({ key, label, Icon, badge }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`relative flex items-center gap-2 px-4 py-2 rounded text-sm font-display font-medium transition-colors ${tab === key ? 'bg-white text-ocean-700 shadow-sm' : 'text-n-500 hover:text-n-700'}`}>
            <Icon size={15} strokeWidth={1.75} />
            {label}
            {badge > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-error text-white text-xs rounded-full flex items-center justify-center font-mono leading-none">
                {badge > 9 ? '9+' : badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Colaboradores tab */}
      {tab === 'staff' && (
        <div>
          {/* Search */}
          {staffList.length > 3 && (
            <div className="relative mb-4 max-w-xs">
              <Search size={14} strokeWidth={1.75} className="absolute left-3 top-1/2 -translate-y-1/2 text-n-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Pesquisar..."
                className="w-full h-9 pl-8 pr-3 rounded-sm border border-n-200 text-sm font-body bg-white placeholder:text-n-400 focus:outline-none focus:border-ocean-700"
              />
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-20"><LoadingSpinner size={32} /></div>
          ) : filtered.length === 0 && !search ? (
            <div className="bg-white border border-n-200 rounded-md flex flex-col items-center py-14 text-n-400">
              <Briefcase size={36} strokeWidth={1.25} className="mb-3" />
              <p className="font-body text-sm">Sem colaboradores registados</p>
              <p className="font-body text-xs mt-1 text-center max-w-xs">
                Adicione guias, instrutores e motoristas para atribuir trabalhos
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(m => (
                <StaffCard key={m.id} member={m}
                  onEdit={m => { setFormError(''); setModal(m); }}
                  onDelete={setDelTarget} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tarefas tab */}
      {tab === 'tasks' && <KanbanBoard staffList={staffList} />}

      {/* Chat tab */}
      {tab === 'chat' && <ChatTab staffList={staffList} />}

      {/* Create / Edit modal */}
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal === 'create' ? 'Novo colaborador' : `Editar: ${modal?.name}`}
        size="md">
        {modal && (
          <StaffForm
            member={modal !== 'create' ? modal : null}
            onSave={handleSave}
            onCancel={() => setModal(null)}
            loading={formLoading}
            error={formError}
          />
        )}
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteTarget} onClose={() => setDelTarget(null)} title="Confirmar" size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDelTarget(null)}>Cancelar</Button>
            <Button variant="danger" onClick={handleDelete}>Eliminar</Button>
          </>
        }>
        <p className="text-sm font-body text-n-700">
          Eliminar o colaborador <strong>"{deleteTarget?.name}"</strong>? Esta accao nao pode ser desfeita.
        </p>
      </Modal>
    </div>
  );
}
