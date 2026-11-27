import { useState } from 'react';
import {
  Plus,
  AlertTriangle,
  CheckCircle2,
  X,
  Settings2,
} from 'lucide-react';
import Button from '../../components/ui/Button';
import { CHECKLIST_KEY, DEFAULT_TASKS, rotuloTarefa } from './shared';
import { IconBtn, EDIT_HOVER, DELETE_HOVER } from '../../components/shared/IconBtn';
import Input from '../../components/ui/Input';
import { useT } from '../../i18n';
import { localeDe, useLingua } from '../../utils/formatoLingua';

/* ── Checklist Tab ── */
/* As tarefas guardam-se com o texto (as por omissao em portugues); o ecra mostra o rotulo na lingua do painel. */
function ChecklistTab() {
  const t = useT();
  const lang = useLingua();
  const todayStr = new Date().toISOString().split('T')[0];

  function load() {
    try { return JSON.parse(localStorage.getItem(CHECKLIST_KEY) || '{}'); } catch { return {}; }
  }
  function save(data) { localStorage.setItem(CHECKLIST_KEY, JSON.stringify(data)); }

  const stored      = load();
  const [tasks,     setTasks]     = useState(stored.tasks     || DEFAULT_TASKS);
  const [completions, setCompletions] = useState(stored.completions || {});
  const [configOpen,  setConfig]  = useState(false);
  const [newTask,     setNewTask] = useState('');

  const todayCompletions = completions[todayStr] || {};
  const doneCount  = Object.keys(todayCompletions).length;
  const allDone    = doneCount === tasks.length;

  function toggle(idx) {
    const current = { ...completions };
    const day     = { ...(current[todayStr] || {}) };
    if (day[idx]) {
      delete day[idx];
    } else {
      day[idx] = { at: new Date().toISOString(), by: 'manager' };
    }
    current[todayStr] = day;
    setCompletions(current);
    save({ tasks, completions: current });
  }

  function addTask() {
    if (!newTask.trim()) return;
    const updated = [...tasks, newTask.trim()];
    setTasks(updated);
    setNewTask('');
    save({ tasks: updated, completions });
  }

  function removeTask(idx) {
    const updated = tasks.filter((_, i) => i !== idx);
    setTasks(updated);
    save({ tasks: updated, completions });
  }

  const incomplete = tasks.length - doneCount;
  const isLate     = incomplete > 0 && new Date().getHours() >= 8;

  return (
    <div className="space-y-4">
      {/* Alert */}
      {isLate && !allDone && (
        <div className="flex items-center gap-2 px-4 py-3 bg-[var(--warning-light)] border border-[var(--warning)] rounded-[14px] text-sm font-body text-[var(--warning)]">
          <AlertTriangle size={16} strokeWidth={1.75} className="shrink-0" />
          <span>{t('staff.checklist.lateAlert', { n: incomplete })}</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-lg font-semibold text-ocean-900">{t('staff.checklist.title')}</p>
          <p className="text-xs font-mono tabular-nums text-n-600 mt-0.5">
            {t('staff.checklist.progress', { date: todayStr, done: doneCount, total: tasks.length })}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {allDone && (
            <span className="flex items-center gap-1.5 text-xs font-body text-[var(--success)] bg-[var(--success-light)] px-3 py-1.5 rounded-[10px] border border-[var(--success)]">
              <CheckCircle2 size={13} strokeWidth={1.75} />
              {t('staff.checklist.allDone')}
            </span>
          )}
          <IconBtn icon={Settings2} label={t('staff.checklist.configure')} title={t('staff.checklist.configure')}
            onClick={() => setConfig(v => !v)} hover={EDIT_HOVER} className="text-n-600" />
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-mare-head rounded-full overflow-hidden">
        <div className="h-full bg-ocean-700 rounded-full transition-all" style={{ width: `${tasks.length ? (doneCount / tasks.length) * 100 : 0}%` }} />
      </div>

      {/* Task list */}
      <div className="bg-white rounded-[18px] border border-mare-card overflow-hidden">
      <div className="divide-y divide-mare-card">
        {tasks.map((task, idx) => {
          const done = !!todayCompletions[idx];
          const at   = todayCompletions[idx]?.at;
          return (
            <label key={idx}
              className={`flex items-start gap-3 px-4 py-3.5 min-h-11 cursor-pointer hover:bg-mare-head transition-colors ${done ? 'opacity-70' : ''}`}>
              <input type="checkbox" checked={done} onChange={() => toggle(idx)}
                className="mt-0.5 w-4 h-4 accent-ocean-700 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sand-500" />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-body break-words ${done ? 'line-through text-n-600' : 'text-n-800'}`}>{rotuloTarefa(task, t, lang)}</p>
                {done && at && (
                  <p className="text-xs font-mono tabular-nums text-n-600 mt-0.5">
                    {t('staff.checklist.confirmedAt', { time: new Date(at).toLocaleTimeString(localeDe(lang), { hour: '2-digit', minute: '2-digit' }) })}
                  </p>
                )}
              </div>
              {done && <CheckCircle2 size={16} strokeWidth={1.75} className="text-[var(--success)] shrink-0 mt-0.5" />}
            </label>
          );
        })}
        {tasks.length === 0 && (
          <div className="px-4 py-8 text-center text-n-600 text-sm font-body">
            {t('staff.checklist.empty')}
          </div>
        )}
      </div>
      </div>

      {/* Config panel */}
      {configOpen && (
        <div className="bg-mare-head border border-mare-card rounded-[14px] p-4 space-y-3">
          <p className="text-xs font-mono uppercase tracking-wide text-n-600">{t('staff.checklist.manage')}</p>
          <div className="space-y-1.5">
            {tasks.map((task, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="flex-1 min-w-0 break-words text-sm font-body text-n-800 px-3 py-1.5 bg-white border border-mare-card rounded-[10px]">{rotuloTarefa(task, t, lang)}</span>
                <IconBtn icon={X} label={t('staff.checklist.removeTask', { task: rotuloTarefa(task, t, lang) })}
                  onClick={() => removeTask(idx)} hover={DELETE_HOVER} className="text-n-600" />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <div className="flex-1 min-w-0">
              <Input aria-label={t('staff.checklist.newTask')} value={newTask} onChange={e => setNewTask(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTask()}
                placeholder={t('staff.checklist.newTaskPlaceholder')} />
            </div>
            <Button size="sm" className="min-h-11 md:min-h-0" onClick={addTask} icon={Plus}>{t('staff.checklist.add')}</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChecklistTab;
