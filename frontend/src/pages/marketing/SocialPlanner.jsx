import { useState, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, Plus, Pencil, Trash2, Calendar, Clock, CheckCircle2, Globe2,
} from 'lucide-react';
import Button from '../../components/ui/Button';
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

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-semibold text-base text-n-900">Planeador de Social Media</h2>
        <Button icon={Plus} size="sm" onClick={() => onAdd(null)}>Novo post</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2 bg-white rounded-md border border-n-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-n-200">
            <button onClick={() => setMonth(new Date(year, mon - 1, 1))} className="p-1 rounded hover:bg-n-100 text-n-500 transition-colors">
              <ChevronLeft size={18} strokeWidth={1.75} />
            </button>
            <p className="font-display font-semibold text-sm text-n-900">{MONTHS_PT[mon]} {year}</p>
            <button onClick={() => setMonth(new Date(year, mon + 1, 1))} className="p-1 rounded hover:bg-n-100 text-n-500 transition-colors">
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
                <div key={key} onClick={() => onAdd(key)}
                  className={`h-16 border-r border-b border-n-100 p-1.5 cursor-pointer hover:bg-ocean-50 transition-colors flex flex-col ${isToday ? 'bg-ocean-50' : ''}`}>
                  <span className={`text-xs font-mono font-semibold w-5 h-5 flex items-center justify-center rounded-full ${isToday ? 'bg-ocean-700 text-white' : 'text-n-600'}`}>{d}</span>
                  <div className="flex flex-wrap gap-0.5 mt-0.5">
                    {dayPosts.slice(0, 3).map(p => (
                      <span key={p.id} className={`w-2 h-2 rounded-full ${p.status === 'publicado' ? 'bg-[#1A7A4A]' : p.status === 'cancelado' ? 'bg-error' : 'bg-ocean-500'}`} />
                    ))}
                    {dayPosts.length > 3 && <span className="text-[9px] font-mono text-n-400">+{dayPosts.length - 3}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-mono uppercase tracking-wider text-n-500">Proximos posts</p>
          {upcoming.length === 0 ? (
            <div className="bg-white rounded-md border border-n-200 flex flex-col items-center py-10 text-n-400">
              <Calendar size={28} strokeWidth={1.25} className="mb-2" />
              <p className="text-xs font-body text-center">Sem posts agendados</p>
            </div>
          ) : upcoming.map(p => {
            const dt       = new Date(p.scheduled_at);
            const isToday2 = postDateKey(p) === todayStr;
            return (
              <div key={p.id} className={`bg-white rounded-md border p-3 flex flex-col gap-2 ${isToday2 ? 'border-sand-300 bg-[#FFF7E6]' : 'border-n-200'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <PlatformIcon platform={p.platform} />
                    <p className="text-xs font-body text-n-700 truncate">{p.text_pt.slice(0, 50)}{p.text_pt.length > 50 ? '…' : ''}</p>
                  </div>
                  <div className="flex gap-0.5 shrink-0">
                    <button onClick={() => onEdit(p)} className="p-1 text-n-400 hover:text-ocean-700 transition-colors"><Pencil size={12} strokeWidth={1.75} /></button>
                    <button onClick={() => onDelete(p.id)} className="p-1 text-n-400 hover:text-error transition-colors"><Trash2 size={12} strokeWidth={1.75} /></button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-n-400 flex items-center gap-1">
                    <Clock size={10} strokeWidth={1.75} />
                    {dt.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })} {dt.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {isToday2 && (
                    <button onClick={() => onMarkPublished(p.id)}
                      className="flex items-center gap-1 text-[10px] font-body px-2 py-0.5 bg-[#1A7A4A] text-white rounded-xs hover:bg-[#15623c] transition-colors">
                      <CheckCircle2 size={10} strokeWidth={2} />Publicado
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* All posts table */}
      {posts.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-mono uppercase tracking-wider text-n-500 mb-3">Historico ({posts.length})</p>
          <div className="bg-white rounded-md border border-n-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-n-200 bg-n-50">
                  {['Texto', 'Plataforma', 'Data', 'Estado', ''].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-mono uppercase tracking-wider text-n-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-n-100">
                {[...posts].sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at)).map(p => {
                  const cfg   = STATUS_CONFIG[p.status] || STATUS_CONFIG.agendado;
                  const PlatIc = PLATFORMS.find(pl => pl.value === p.platform)?.icon || Globe2;
                  return (
                    <tr key={p.id} className="hover:bg-n-50">
                      <td className="px-4 py-2.5 max-w-[200px] truncate text-sm font-body text-n-900">{p.text_pt}</td>
                      <td className="px-4 py-2.5"><PlatIc size={15} strokeWidth={1.75} className="text-n-500" /></td>
                      <td className="px-4 py-2.5 text-xs font-mono text-n-600 whitespace-nowrap">
                        {p.scheduled_at ? new Date(p.scheduled_at).toLocaleDateString('pt-PT') : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs font-mono px-2 py-0.5 rounded-xs border uppercase tracking-wide ${cfg.cls}`}>{cfg.label}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => onEdit(p)} className="p-1 text-n-400 hover:text-ocean-700 transition-colors"><Pencil size={13} strokeWidth={1.75} /></button>
                          <button onClick={() => onDelete(p.id)} className="p-1 text-n-400 hover:text-error transition-colors"><Trash2 size={13} strokeWidth={1.75} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
