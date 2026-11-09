import { useState, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, Plus, Pencil, Trash2, Calendar, Clock, CheckCircle2, Globe2,
} from 'lucide-react';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Table from '../../components/ui/Table';
import EmptyState from '../../components/ui/EmptyState';
import { PLATFORMS, STATUS_CONFIG, MONTHS_PT, postDateKey } from './shared';

/* ── Calendar helpers ── */
function calendarDays(year, month) {
  const first = new Date(year, month, 1);
  const last  = new Date(year, month + 1, 0);
  const startDow = (first.getDay() + 6) % 7;
  const days = [];
  for (let i = 0; i < startDow; i++) days.push(null);
  for (let d = 1; d <= last.getDate(); d++) days.push(d);
  return days;
}
const WEEKDAYS  = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];

/* ── SocialPlanner ── */
export default function SocialPlanner({ posts, onAdd, onEdit, onDelete, onMarkPublished }) {
  const today    = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const year = month.getFullYear();
  const mon  = month.getMonth();
  const days = calendarDays(year, mon);

  const postsByDate = useMemo(() => {
    const map = {};
    posts.forEach(p => { const k = postDateKey(p); if (!map[k]) map[k] = []; map[k].push(p); });
    return map;
  }, [posts]);

  const upcoming = posts
    .filter(p => p.status === 'agendado' && postDateKey(p) >= todayStr)
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
    .slice(0, 8);

  function dayKey(d) {
    return `${year}-${String(mon + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  function PlatformIcon({ platform, size = 13 }) {
    const Ic = PLATFORMS.find(p => p.value === platform)?.icon || Globe2;
    return <Ic size={size} strokeWidth={1.75} className="text-n-500 shrink-0" />;
  }

  /* colunas do historico (precisam dos handlers) */
  const historyColumns = [
    { key: 'texto', label: 'Texto', render: p => <span className="block max-w-[200px] truncate text-sm font-body text-n-900">{p.text_pt}</span> },
    {
      key: 'plataforma', label: 'Plataforma',
      render: p => {
        const PlatIc = PLATFORMS.find(pl => pl.value === p.platform)?.icon || Globe2;
        return <PlatIc size={15} strokeWidth={1.75} className="text-n-500" />;
      },
    },
    {
      key: 'data', label: 'Data',
      render: p => (
        <span className="text-xs font-mono text-n-600 whitespace-nowrap">
          {p.scheduled_at ? new Date(p.scheduled_at).toLocaleDateString('pt-PT') : '—'}
        </span>
      ),
    },
    {
      key: 'estado', label: 'Estado',
      render: p => {
        const cfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.agendado;
        return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
      },
    },
    {
      key: 'acoes', label: '',
      render: p => (
        <div className="flex gap-1 justify-end">
          <button type="button" aria-label={`Editar post ${p.text_pt.slice(0, 30)}`} onClick={() => onEdit(p)} className="p-1 text-n-400 hover:text-ocean-700 transition-colors"><Pencil size={13} strokeWidth={1.75} /></button>
          <button type="button" aria-label={`Eliminar post ${p.text_pt.slice(0, 30)}`} onClick={() => onDelete(p.id)} className="p-1 text-n-400 hover:text-[var(--error)] transition-colors"><Trash2 size={13} strokeWidth={1.75} /></button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-semibold text-base text-n-900">Planeador de Social Media</h2>
        <Button icon={Plus} size="sm" onClick={() => onAdd(null)}>Novo post</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card padding="p-0" className="lg:col-span-2 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-n-200">
            <button type="button" aria-label="Mes anterior" onClick={() => setMonth(new Date(year, mon - 1, 1))} className="p-1 rounded hover:bg-n-100 text-n-500 transition-colors">
              <ChevronLeft size={18} strokeWidth={1.75} />
            </button>
            <p className="font-display font-semibold text-sm text-n-900">{MONTHS_PT[mon]} {year}</p>
            <button type="button" aria-label="Mes seguinte" onClick={() => setMonth(new Date(year, mon + 1, 1))} className="p-1 rounded hover:bg-n-100 text-n-500 transition-colors">
              <ChevronRight size={18} strokeWidth={1.75} />
            </button>
          </div>
          <div className="grid grid-cols-7 border-b border-n-100">
            {WEEKDAYS.map(d => (
              <div key={d} className="py-2 text-center text-[10px] font-mono font-semibold uppercase tracking-wider text-n-400">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d, i) => {
              if (d === null) return <div key={`e${i}`} className="h-16 border-r border-b border-n-100 bg-n-50" />;
              const key      = dayKey(d);
              const dayPosts = postsByDate[key] || [];
              const isToday  = key === todayStr;
              return (
                <button key={key} type="button" aria-label={`Novo post em ${key}`} onClick={() => onAdd(key)}
                  className={`h-16 w-full text-left border-r border-b border-n-100 p-1.5 cursor-pointer hover:bg-ocean-50 transition-colors flex flex-col ${isToday ? 'bg-ocean-50' : ''}`}>
                  <span className={`text-xs font-mono font-semibold w-5 h-5 flex items-center justify-center rounded-full ${isToday ? 'bg-ocean-700 text-white' : 'text-n-600'}`}>{d}</span>
                  <span className="flex flex-wrap gap-0.5 mt-0.5">
                    {dayPosts.slice(0, 3).map(p => (
                      <span key={p.id} className={`w-2 h-2 rounded-full ${p.status === 'publicado' ? 'bg-[var(--success)]' : p.status === 'cancelado' ? 'bg-[var(--error)]' : 'bg-ocean-500'}`} />
                    ))}
                    {dayPosts.length > 3 && <span className="text-[9px] font-mono text-n-400">+{dayPosts.length - 3}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Upcoming */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-mono uppercase tracking-wider text-n-500">Proximos posts</p>
          {upcoming.length === 0 ? (
            <Card padding="p-0">
              <EmptyState icon={Calendar} title="Sem posts agendados" />
            </Card>
          ) : upcoming.map(p => {
            const dt       = new Date(p.scheduled_at);
            const isToday2 = postDateKey(p) === todayStr;
            return (
              <Card key={p.id} padding="p-3 flex flex-col gap-2" className={isToday2 ? '!border-sand-300 !bg-sand-50' : ''}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <PlatformIcon platform={p.platform} />
                    <p className="text-xs font-body text-n-700 truncate">{p.text_pt.slice(0, 50)}{p.text_pt.length > 50 ? '…' : ''}</p>
                  </div>
                  <div className="flex gap-0.5 shrink-0">
                    <button type="button" aria-label={`Editar post ${p.text_pt.slice(0, 30)}`} onClick={() => onEdit(p)} className="p-1 text-n-400 hover:text-ocean-700 transition-colors"><Pencil size={12} strokeWidth={1.75} /></button>
                    <button type="button" aria-label={`Eliminar post ${p.text_pt.slice(0, 30)}`} onClick={() => onDelete(p.id)} className="p-1 text-n-400 hover:text-[var(--error)] transition-colors"><Trash2 size={12} strokeWidth={1.75} /></button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-n-400 flex items-center gap-1">
                    <Clock size={10} strokeWidth={1.75} />
                    {dt.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })} {dt.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {isToday2 && (
                    <button type="button" onClick={() => onMarkPublished(p.id)}
                      className="flex items-center gap-1 text-[10px] font-body px-2 py-0.5 bg-[var(--success)] text-white rounded-xs hover:opacity-90 transition-colors">
                      <CheckCircle2 size={10} strokeWidth={2} />Publicado
                    </button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* All posts table */}
      {posts.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-mono uppercase tracking-wider text-n-500 mb-3">Historico ({posts.length})</p>
          <Card padding="p-0" className="overflow-hidden">
            <Table
              columns={historyColumns}
              rows={[...posts].sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at))}
            />
          </Card>
        </div>
      )}
    </div>
  );
}
