import { useState, useEffect } from 'react';
import {
  Plus,
  CheckSquare,
  AlertTriangle,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { listAssignments, startAssignment, completeAssignment, cancelAssignment, createAssignment } from '../../services/assignmentService';
import { listReservations } from '../../services/reservationsService';
import { useToast } from '../../store/toastStore';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input, { Select, Textarea } from '../../components/ui/Input';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import { PRIO, PRIO_COLORS, KANBAN_COLS, tryParseNotes, StaffAvatar } from './shared';

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
            {dueDate.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', timeZone: 'UTC' })}
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
  const toast = useToast();
  const [tasks, setTasks]         = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState(null);
  const [taskModal, setTaskModal] = useState(false);
  const [taskForm, setTaskForm]   = useState({ title: '', desc: '', priority: 'medium', due: '', staff_id: '', reservation_id: '', checklist: '' });
  const [saving, setSaving]       = useState(false);
  const [filterStaff, setFilter]  = useState('');

  useEffect(() => {
    listAssignments().then(setTasks).finally(() => setLoading(false));
    /* Tarefas sao sempre job_assignments (reservation_id obrigatorio na BD)
       -- precisamos da lista de reservas para o operador escolher a que a
       tarefa pertence, nunca so titulo/prazo soltos. */
    listReservations().then(rows => setReservations(rows.filter(r => r.status !== 'cancelled'))).catch(() => {});
  }, []);

  async function moveTask(task, newStatus) {
    try {
      if      (newStatus === 'in_progress') await startAssignment(task.id);
      else if (newStatus === 'completed')   await completeAssignment(task.id);
      else if (newStatus === 'cancelled')   await cancelAssignment(task.id);
      setTasks(p => p.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Erro ao actualizar tarefa');
    }
  }

  async function handleCreateTask(e) {
    e.preventDefault();
    if (!taskForm.reservation_id) {
      toast.error('Escolha a reserva a que esta tarefa pertence');
      return;
    }
    setSaving(true);
    try {
      const meta = {
        title: taskForm.title,
        desc: taskForm.desc,
        priority: taskForm.priority,
        due: taskForm.due,
        checklist: taskForm.checklist.split('\n').filter(Boolean),
      };
      const payload = {
        reservation_id: taskForm.reservation_id,
        staff_id: taskForm.staff_id || null,
        notes_manager: JSON.stringify(meta),
      };
      const created = await createAssignment(payload);
      setTasks(p => [created, ...p]);
      setTaskModal(false);
      setTaskForm({ title: '', desc: '', priority: 'medium', due: '', staff_id: '', reservation_id: '', checklist: '' });
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Erro ao criar tarefa');
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
                {meta?.due && <span className="flex items-center gap-1"><Clock size={11} strokeWidth={1.75} />{new Date(meta.due).toLocaleDateString('pt-PT', { timeZone: 'UTC' })}</span>}
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
          <Select label="Reserva" value={taskForm.reservation_id} onChange={e => setTaskForm(p => ({ ...p, reservation_id: e.target.value }))} required>
            <option value="">Escolha a reserva...</option>
            {reservations.map(r => (
              <option key={r.id} value={r.id}>
                {r.customer_name} — {r.units?.name || 'Servico'} ({r.check_in})
              </option>
            ))}
          </Select>
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

export default KanbanBoard;
