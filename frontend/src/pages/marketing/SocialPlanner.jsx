import { useState, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, Plus, Pencil, Trash2, Calendar, Clock, CheckCircle2, Globe2,
} from 'lucide-react';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Table from '../../components/ui/Table';
import EmptyState from '../../components/ui/EmptyState';
import { IconBtn, EDIT_HOVER, DELETE_HOVER } from '../../components/shared/IconBtn';
import { useT } from '../../i18n';
import { formatarData, localeDe, useLingua } from '../../utils/formatoLingua';
import { nomeMes, diaAbreviado } from '../../components/calendar/rotulosCalendario';
import { PLATFORMS, STATUS_CONFIG, rotuloEstadoPost, postDateKey, CARTAO, TITULO, NUM } from './shared';

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
/* a semana comeca na segunda: indices de diaAbreviado (0 = domingo) */
const WEEKDAYS  = [1, 2, 3, 4, 5, 6, 0];

/* ── SocialPlanner ── */
export default function SocialPlanner({ posts, onAdd, onEdit, onDelete, onMarkPublished }) {
  const t = useT();
  const lang = useLingua();
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
    { key: 'texto', label: t('marketingPage.planner.cols.text'), render: p => <span className="block max-w-[200px] truncate text-sm font-body text-n-900">{p.text_pt}</span> },
    {
      key: 'plataforma', label: t('marketingPage.planner.cols.platform'),
      render: p => {
        const PlatIc = PLATFORMS.find(pl => pl.value === p.platform)?.icon || Globe2;
        return <PlatIc size={15} strokeWidth={1.75} className="text-n-500" />;
      },
    },
    {
      key: 'data', label: t('marketingPage.planner.cols.date'),
      render: p => (
        <span className={`text-xs ${NUM} text-n-600 whitespace-nowrap`}>
          {p.scheduled_at ? formatarData(p.scheduled_at, {}, lang) : '—'}
        </span>
      ),
    },
    {
      key: 'estado', label: t('marketingPage.planner.cols.status'),
      render: p => {
        const estado = STATUS_CONFIG[p.status] ? p.status : 'agendado';
        return <Badge variant={STATUS_CONFIG[estado].variant}>{rotuloEstadoPost(estado, t)}</Badge>;
      },
    },
    {
      key: 'acoes', label: '',
      render: p => (
        <div className="flex gap-1 justify-end">
          <IconBtn icon={Pencil} label={t('marketingPage.planner.editPost', { text: (p.text_pt || '').slice(0, 30) })} onClick={() => onEdit(p)} hover={EDIT_HOVER} />
          <IconBtn icon={Trash2} label={t('marketingPage.planner.deletePost', { text: (p.text_pt || '').slice(0, 30) })} onClick={() => onDelete(p.id)} hover={DELETE_HOVER} />
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className={TITULO}>{t('marketingPage.planner.title')}</h2>
        <Button icon={Plus} size="sm" onClick={() => onAdd(null)} className="min-h-11 md:min-h-0">{t('marketingPage.planner.newPost')}</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <section className="bg-white rounded-[18px] border border-mare-card overflow-hidden min-w-0 lg:col-span-2">
          <div className="flex items-center justify-between px-4 py-3 border-b border-mare-card">
            <IconBtn icon={ChevronLeft} label={t('marketingPage.planner.prevMonth')} onClick={() => setMonth(new Date(year, mon - 1, 1))} hover={EDIT_HOVER} />
            <p className={TITULO}>{nomeMes(mon, t)} {year}</p>
            <IconBtn icon={ChevronRight} label={t('marketingPage.planner.nextMonth')} onClick={() => setMonth(new Date(year, mon + 1, 1))} hover={EDIT_HOVER} />
          </div>
          <div className="grid grid-cols-7 border-b border-mare-card bg-mare-head">
            {WEEKDAYS.map(d => (
              <div key={d} className="py-2 text-center text-[11px] font-body font-semibold uppercase tracking-wider text-n-600">{diaAbreviado(d, t)}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d, i) => {
              if (d === null) return <div key={`e${i}`} className="h-16 border-r border-b border-mare-card bg-n-50" />;
              const key      = dayKey(d);
              const dayPosts = postsByDate[key] || [];
              const isToday  = key === todayStr;
              return (
                <button key={key} type="button" aria-label={t('marketingPage.planner.newPostOn', { date: key })} onClick={() => onAdd(key)}
                  className={`h-16 w-full text-left border-r border-b border-mare-card p-1.5 cursor-pointer hover:bg-ocean-50 transition-colors flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sand-500 ${isToday ? 'bg-ocean-50' : ''}`}>
                  <span className={`text-xs ${NUM} font-semibold w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-ocean-700 text-white' : 'text-n-700'}`}>{d}</span>
                  <span className="flex flex-wrap gap-0.5 mt-0.5">
                    {dayPosts.slice(0, 3).map(p => (
                      <span key={p.id} className={`w-2 h-2 rounded-full ${p.status === 'publicado' ? 'bg-[var(--success)]' : p.status === 'cancelado' ? 'bg-[var(--error)]' : 'bg-ocean-500'}`} />
                    ))}
                    {dayPosts.length > 3 && <span className={`text-[10px] ${NUM} text-n-600`}>+{dayPosts.length - 3}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Upcoming */}
        <div className="flex flex-col gap-3 min-w-0">
          <p className={TITULO}>{t('marketingPage.planner.upcoming')}</p>
          {upcoming.length === 0 ? (
            <section className={CARTAO}>
              <EmptyState icon={Calendar} title={t('marketingPage.planner.noScheduled')} />
            </section>
          ) : upcoming.map(p => {
            const dt       = new Date(p.scheduled_at);
            const isToday2 = postDateKey(p) === todayStr;
            return (
              <section key={p.id} className={`rounded-[18px] border p-4 flex flex-col gap-2 min-w-0 ${isToday2 ? 'border-sand-300 bg-sand-50' : 'border-mare-card bg-white'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <PlatformIcon platform={p.platform} />
                    <p className="text-sm font-body text-n-800 truncate">{p.text_pt.slice(0, 50)}{p.text_pt.length > 50 ? '…' : ''}</p>
                  </div>
                  <div className="flex gap-0.5 shrink-0">
                    <IconBtn icon={Pencil} label={t('marketingPage.planner.editPost', { text: p.text_pt.slice(0, 30) })} onClick={() => onEdit(p)} hover={EDIT_HOVER} />
                    <IconBtn icon={Trash2} label={t('marketingPage.planner.deletePost', { text: p.text_pt.slice(0, 30) })} onClick={() => onDelete(p.id)} hover={DELETE_HOVER} />
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={`text-xs ${NUM} text-n-600 flex items-center gap-1`}>
                    <Clock size={11} strokeWidth={1.75} />
                    {formatarData(dt, { day: '2-digit', month: 'short' }, lang)} {dt.toLocaleTimeString(localeDe(lang), { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {isToday2 && (
                    <button type="button" onClick={() => onMarkPublished(p.id)}
                      className="flex items-center gap-1 text-xs font-body font-medium px-3 py-1 min-h-11 md:min-h-0 bg-[var(--success)] text-white rounded-full hover:opacity-90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sand-500">
                      <CheckCircle2 size={12} strokeWidth={2} />{t('marketingPage.planner.published')}
                    </button>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {/* All posts table */}
      {posts.length > 0 && (
        <section className={`${CARTAO} mt-6`}>
          <p className={`${TITULO} mb-3`}>{t('marketingPage.planner.history', { n: posts.length })}</p>
          <div className="overflow-x-auto">
            <Table
              columns={historyColumns}
              rows={[...posts].sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at))}
            />
          </div>
        </section>
      )}
    </div>
  );
}
