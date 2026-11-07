import { useState } from 'react';
import {
  Plus,
  AlertTriangle,
  CheckCircle2,
  X,
  Settings2,
} from 'lucide-react';
import Button from '../../components/ui/Button';
import { CHECKLIST_KEY, DEFAULT_TASKS } from './shared';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';

/* ── Checklist Tab ── */
function ChecklistTab() {
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
        <div className="flex items-center gap-2 px-4 py-3 bg-[var(--warning-light)] border border-[var(--warning)] rounded-sm text-sm font-body text-[var(--warning)]">
          <AlertTriangle size={16} strokeWidth={1.75} className="shrink-0" />
          <span>{incomplete} tarefa(s) por completar — verifique antes do tour</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <p className="font-display font-semibold text-n-900">Checklist do dia</p>
          <p className="text-xs font-body text-n-500 mt-0.5">
            {todayStr} · {doneCount}/{tasks.length} concluidas
          </p>
        </div>
        <div className="flex items-center gap-2">
          {allDone && (
            <span className="flex items-center gap-1.5 text-xs font-body text-[var(--success)] bg-[var(--success-light)] px-3 py-1.5 rounded-sm border border-[var(--success)]">
              <CheckCircle2 size={13} strokeWidth={1.75} />
              Tudo concluido
            </span>
          )}
          <button onClick={() => setConfig(v => !v)} aria-label="Configurar checklist"
            className="p-2 rounded-sm text-n-500 hover:text-ocean-700 hover:bg-ocean-50 transition-colors" title="Configurar checklist">
            <Settings2 size={16} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-n-100 rounded-full overflow-hidden">
        <div className="h-full bg-ocean-700 rounded-full transition-all" style={{ width: `${tasks.length ? (doneCount / tasks.length) * 100 : 0}%` }} />
      </div>

      {/* Task list */}
      <Card padding="p-0">
      <div className="divide-y divide-n-100">
        {tasks.map((task, idx) => {
          const done = !!todayCompletions[idx];
          const at   = todayCompletions[idx]?.at;
          return (
            <label key={idx}
              className={`flex items-start gap-3 px-4 py-3.5 cursor-pointer hover:bg-n-50 transition-colors ${done ? 'opacity-70' : ''}`}>
              <input type="checkbox" checked={done} onChange={() => toggle(idx)}
                className="mt-0.5 w-4 h-4 accent-ocean-700 cursor-pointer" />
              <div className="flex-1">
                <p className={`text-sm font-body text-n-800 ${done ? 'line-through text-n-400' : ''}`}>{task}</p>
                {done && at && (
                  <p className="text-xs font-body text-n-400 mt-0.5">
                    Confirmado as {new Date(at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
              {done && <CheckCircle2 size={16} strokeWidth={1.75} className="text-[var(--success)] shrink-0 mt-0.5" />}
            </label>
          );
        })}
        {tasks.length === 0 && (
          <div className="px-4 py-8 text-center text-n-400 text-sm font-body">
            Sem tarefas configuradas. Use o icone de configuracoes para adicionar.
          </div>
        )}
      </div>
      </Card>

      {/* Config panel */}
      {configOpen && (
        <div className="bg-n-50 border border-n-200 rounded-md p-4 space-y-3">
          <p className="text-xs font-mono uppercase tracking-wide text-n-500">Gerir tarefas</p>
          <div className="space-y-1.5">
            {tasks.map((task, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="flex-1 text-sm font-body text-n-800 px-3 py-1.5 bg-white border border-n-200 rounded-sm">{task}</span>
                <button onClick={() => removeTask(idx)} aria-label={`Remover tarefa - ${task}`}
                  className="p-1.5 rounded text-n-400 hover:text-[var(--error)] hover:bg-[var(--error-light)] transition-colors">
                  <X size={13} strokeWidth={2} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input aria-label="Nova tarefa" value={newTask} onChange={e => setNewTask(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTask()}
                placeholder="Nova tarefa + Enter" />
            </div>
            <Button size="sm" onClick={addTask} icon={Plus}>Adicionar</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChecklistTab;
