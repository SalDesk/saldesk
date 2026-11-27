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
import { PRIO_NIVEIS, PRIO_COLORS, KANBAN_COLS, tryParseNotes, StaffAvatar, rotuloPrio } from './shared';
import { useT } from '../../i18n';
import { mensagemErro } from '../../utils/mensagemErro';
import { formatarData, useLingua } from '../../utils/formatoLingua';

/* ── Kanban Task Card ── */
function TaskCard({ task, staffList, onMove, onOpen }) {
  const t = useT();
  const lang = useLingua();
  const meta  = tryParseNotes(task.notes_manager);
  const title = meta?.title || task.notes_manager || t('staff.tasks.assignmentN', { id: String(task.id).slice(-6) });
  const prio  = meta?.priority || 'medium';
  const staffMember = staffList.find(s => s.id === task.staff_id);
  const dueDate = meta?.due ? new Date(meta.due) : null;
  const isOverdue = dueDate && dueDate < new Date() && !['completed', 'cancelled'].includes(task.status);

  const nextStatus = {
    pending: 'in_progress', in_progress: 'completed',
    confirmed: 'in_progress',
  };
  const proxima = KANBAN_COLS.find(c => c.key === nextStatus[task.status]);

  return (
    <div onClick={() => onOpen(task)}
      className={`bg-white border rounded-[18px] p-3.5 min-w-0 cursor-pointer hover:shadow-md transition-all ${isOverdue ? 'border-[var(--error)]' : 'border-mare-card'}`}>
      {isOverdue && (
        <div className="flex items-center gap-1 mb-1.5 text-[var(--error)] text-xs font-body">
          <AlertTriangle size={11} strokeWidth={1.75} />
          <span>{t('staff.tasks.overdue')}</span>
        </div>
      )}
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="min-w-0 break-words text-sm font-display font-semibold text-n-900 line-clamp-2 leading-tight">{title}</p>
        <span className={`shrink-0 text-xs font-mono font-medium px-1.5 py-0.5 rounded ${PRIO_COLORS[prio]}`}>
          {rotuloPrio(prio, t)}
        </span>
      </div>
      {meta?.checklist?.length > 0 && (
        <p className="text-xs font-body text-n-600 mb-2">
          <CheckSquare size={10} strokeWidth={1.75} className="inline mr-1" />
          {t('staff.tasks.subtasks', { n: meta.checklist.filter(Boolean).length })}
        </p>
      )}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-mare-card">
        {staffMember ? (
          <div className="flex items-center gap-1.5 min-w-0">
            <StaffAvatar member={staffMember} size={20} showStatus={false} />
            <span className="text-xs font-body text-n-600 truncate">{staffMember.name.split(' ')[0]}</span>
          </div>
        ) : <span />}
        {dueDate && (
          <span className={`shrink-0 text-xs font-mono tabular-nums ${isOverdue ? 'text-[var(--error)]' : 'text-n-600'}`}>
            <Clock size={10} strokeWidth={1.75} className="inline mr-0.5" />
            {formatarData(dueDate, { day: '2-digit', month: 'short', timeZone: 'UTC' }, lang)}
          </span>
        )}
      </div>
      {proxima && (
        <button
          onClick={e => { e.stopPropagation(); onMove(nextStatus[task.status]); }}
          className="mt-2 w-full flex items-center justify-center gap-1 min-h-11 md:min-h-8 py-1 rounded-[10px] text-xs font-body text-ocean-700 bg-ocean-50 hover:bg-ocean-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sand-500">
          <ArrowRight size={11} strokeWidth={1.75} />
          {t('staff.tasks.moveTo', { col: t(proxima.rotulo) })}
        </button>
      )}
    </div>
  );
}

/* ── Kanban Board ── */
function KanbanBoard({ staffList }) {
  const t = useT();
  const lang = useLingua();
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
      setTasks(p => p.map(x => x.id === task.id ? { ...x, status: newStatus } : x));
    } catch (err) {
      console.error(err);
      toast.error(mensagemErro(err, t, t('staff.errors.updateTask')));
    }
  }

  async function handleCreateTask(e) {
    e.preventDefault();
    if (!taskForm.reservation_id) {
      toast.error(t('staff.errors.chooseBooking'));
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
      toast.error(mensagemErro(err, t, t('staff.errors.createTask')));
    } finally { setSaving(false); }
  }

  const filtered = filterStaff
    ? tasks.filter(x => x.staff_id === filterStaff)
    : tasks;

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size={32} /></div>;

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-56">
            <Select aria-label={t('staff.tasks.filterLabel')} value={filterStaff} onChange={e => setFilter(e.target.value)}>
              <option value="">{t('staff.tasks.allStaff')}</option>
              {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </div>
          <span className="text-xs font-body text-n-600">{t('staff.tasks.count', { n: filtered.length })}</span>
        </div>
        <Button icon={Plus} size="sm" className="min-h-11 md:min-h-0" onClick={() => setTaskModal(true)}>{t('staff.tasks.newTask')}</Button>
      </div>

      {/* Overdue alert */}
      {filtered.some(x => {
        const m = tryParseNotes(x.notes_manager);
        return m?.due && new Date(m.due) < new Date() && !['completed','cancelled'].includes(x.status);
      }) && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-[var(--error-light)] border border-[var(--error)] rounded-[14px] text-xs font-body text-[var(--error)]">
          <AlertTriangle size={14} strokeWidth={1.75} />
          {t('staff.tasks.overdueAlert')}
        </div>
      )}

      {/* Kanban columns */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {KANBAN_COLS.map(col => {
          const colTasks = filtered.filter(x =>
            x.status === col.key || (col.key === 'in_progress' && x.status === 'confirmed')
          );
          return (
            <div key={col.key} className="bg-mare-head border border-mare-card rounded-[14px] p-2 min-w-0">
              <div className={`flex items-center justify-between px-3 py-2 rounded-[10px] border mb-2 ${col.color}`}>
                <span className="text-xs font-mono font-semibold uppercase tracking-wider">{t(col.rotulo)}</span>
                <span className="text-xs font-mono tabular-nums font-bold">{colTasks.length}</span>
              </div>
              <div className="space-y-2">
                {colTasks.map(task => (
                  <TaskCard key={task.id} task={task} staffList={staffList}
                    onMove={s => moveTask(task, s)} onOpen={setSelected} />
                ))}
                {colTasks.length === 0 && (
                  <div className="border-2 border-dashed border-mare-card rounded-[14px] bg-white p-4 text-center">
                    <p className="text-xs font-body text-n-600">{t('staff.tasks.noTasks')}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Task detail modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={t('staff.tasks.detailTitle')} size="md">
        {selected && (() => {
          const meta = tryParseNotes(selected.notes_manager);
          const staffMember = staffList.find(s => s.id === selected.staff_id);
          return (
            <div className="space-y-4">
              <p className="font-display font-semibold text-n-900">{meta?.title || selected.notes_manager}</p>
              {meta?.desc && <p className="text-sm font-body text-n-600">{meta.desc}</p>}
              <div className="flex gap-2 text-xs font-body text-n-500 flex-wrap">
                {meta?.priority && <span className={`px-2 py-0.5 rounded font-mono ${PRIO_COLORS[meta.priority]}`}>{rotuloPrio(meta.priority, t)}</span>}
                {meta?.due && <span className="flex items-center gap-1"><Clock size={11} strokeWidth={1.75} />{formatarData(new Date(meta.due), { timeZone: 'UTC' }, lang)}</span>}
                {staffMember && (
                  <span className="flex items-center gap-1.5">
                    <StaffAvatar member={staffMember} size={16} showStatus={false} />
                    {staffMember.name}
                  </span>
                )}
              </div>
              {meta?.checklist?.length > 0 && (
                <div>
                  <p className="text-xs font-mono uppercase tracking-wider text-n-500 mb-2">{t('staff.tasks.checklist')}</p>
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
                    {t('staff.tasks.start')}
                  </Button>
                )}
                {['pending','confirmed','in_progress'].includes(selected.status) && (
                  <Button size="sm" variant="secondary" onClick={() => { moveTask(selected, 'completed'); setSelected(null); }}>
                    {t('staff.tasks.complete')}
                  </Button>
                )}
                {selected.status !== 'cancelled' && (
                  <Button size="sm" variant="danger" onClick={() => { moveTask(selected, 'cancelled'); setSelected(null); }}>
                    {t('staff.tasks.block')}
                  </Button>
                )}
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Create task modal */}
      <Modal open={taskModal} onClose={() => setTaskModal(false)} title={t('staff.tasks.newTask')} size="md">
        <form onSubmit={handleCreateTask} className="space-y-4">
          <Input label={t('staff.tasks.title')} aria-label={t('staff.tasks.title')} value={taskForm.title} onChange={e => setTaskForm(p => ({ ...p, title: e.target.value }))} required placeholder={t('staff.tasks.titlePlaceholder')} />
          <Select label={t('staff.tasks.booking')} aria-label={t('staff.tasks.booking')} value={taskForm.reservation_id} onChange={e => setTaskForm(p => ({ ...p, reservation_id: e.target.value }))} required>
            <option value="">{t('staff.tasks.chooseBooking')}</option>
            {reservations.map(r => (
              <option key={r.id} value={r.id}>
                {r.customer_name} — {r.units?.name || t('staff.tasks.service')} ({r.check_in})
              </option>
            ))}
          </Select>
          <Textarea label={t('staff.tasks.description')} aria-label={t('staff.tasks.description')} value={taskForm.desc} onChange={e => setTaskForm(p => ({ ...p, desc: e.target.value }))} placeholder={t('staff.tasks.descriptionPlaceholder')} rows={2} />
          <div className="grid grid-cols-2 gap-3">
            <Select label={t('staff.tasks.priority')} aria-label={t('staff.tasks.priority')} value={taskForm.priority} onChange={e => setTaskForm(p => ({ ...p, priority: e.target.value }))}>
              {PRIO_NIVEIS.map(k => <option key={k} value={k}>{rotuloPrio(k, t)}</option>)}
            </Select>
            <Input label={t('staff.tasks.due')} aria-label={t('staff.tasks.due')} type="date" value={taskForm.due} onChange={e => setTaskForm(p => ({ ...p, due: e.target.value }))} />
          </div>
          <Select label={t('staff.tasks.staffMember')} aria-label={t('staff.tasks.staffMember')} value={taskForm.staff_id} onChange={e => setTaskForm(p => ({ ...p, staff_id: e.target.value }))}>
            <option value="">{t('staff.tasks.unassigned')}</option>
            {staffList.filter(s => s.status === 'active').map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
          <Textarea label={t('staff.tasks.checklistLabel')} aria-label={t('staff.tasks.checklistLabel')} value={taskForm.checklist} onChange={e => setTaskForm(p => ({ ...p, checklist: e.target.value }))} placeholder={"Item 1\nItem 2\nItem 3"} rows={3} />
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={() => setTaskModal(false)} className="flex-1">{t('common.cancel')}</Button>
            <Button type="submit" loading={saving} className="flex-1">{t('staff.tasks.createTask')}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default KanbanBoard;
