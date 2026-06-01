import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  QrCode, Link2, Copy, Check, Share2, Code2, ChevronLeft,
  ChevronRight, Plus, Pencil, Trash2, Calendar, Instagram,
  Facebook, Globe2, Image, Clock, BarChart2, Eye, MousePointerClick,
  TrendingUp, X, CheckCircle2,
} from 'lucide-react';
import { getBookingLink, getMarketingStats, getWidgetCode, getQrCode } from '../services/marketingService';
import useAuthStore from '../store/authStore';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input, { Textarea, Select } from '../components/ui/Input';
import LoadingSpinner from '../components/shared/LoadingSpinner';

/* ── Social planner localStorage ── */
const STORAGE_KEY = 'saldesk_social_posts_v1';

function loadPosts() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function savePosts(posts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
}

/* ── Templates ── */
const TEMPLATES = [
  { key: 'tour_disponivel', label: 'Tour disponivel',
    text_pt: 'Novo tour disponivel! Reserve ja o seu lugar e viva uma experiencia unica na Ilha do Sal.',
    text_en: 'New tour available! Book your spot now and live a unique experience on Sal Island.' },
  { key: 'ultimas_vagas',   label: 'Ultimas vagas',
    text_pt: 'Ultimas vagas para este tour! Nao perca a oportunidade de explorar a ilha connosco.',
    text_en: 'Last spots available for this tour! Do not miss the chance to explore the island with us.' },
  { key: 'avaliacao',       label: 'Avaliacao de cliente',
    text_pt: 'Os nossos clientes falam por nos. Obrigado pela sua confianca e avaliacoes incriveis!',
    text_en: 'Our guests speak for themselves. Thank you for trusting us and for the amazing reviews!' },
  { key: 'promocao',        label: 'Promocao especial',
    text_pt: 'Promocao especial disponivel! Reserve agora e aproveite as nossas tarifas exclusivas.',
    text_en: 'Special offer available! Book now and enjoy our exclusive rates for this season.' },
];

const PLATFORMS = [
  { value: 'instagram', label: 'Instagram', icon: Instagram },
  { value: 'facebook',  label: 'Facebook',  icon: Facebook  },
  { value: 'ambos',     label: 'Instagram + Facebook', icon: Globe2 },
];

const STATUS_CONFIG = {
  agendado:  { label: 'Agendado',  cls: 'bg-ocean-50 text-ocean-700 border-ocean-100'        },
  publicado: { label: 'Publicado', cls: 'bg-[#ECFDF5] text-[#1A7A4A] border-[#BBF7D0]'      },
  cancelado: { label: 'Cancelado', cls: 'bg-red-50 text-error border-red-100'                },
};

/* ── Calendar helpers ── */
function calendarDays(year, month) {
  const first    = new Date(year, month, 1);
  const last     = new Date(year, month + 1, 0);
  const startDow = (first.getDay() + 6) % 7; // Mon=0
  const days = [];
  for (let i = 0; i < startDow; i++) days.push(null);
  for (let d = 1; d <= last.getDate(); d++) days.push(d);
  return days;
}
const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];
const MONTHS_PT = ['Janeiro','Fevereiro','Marco','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function postDateKey(p) { return p.scheduled_at?.slice(0, 10) || ''; }

/* ─────────────────────── Components ─────────────────────── */

function CopyBtn({ text, small }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button onClick={copy}
      className={`flex items-center gap-1.5 transition-colors font-body font-medium ${small ? 'text-xs px-2 py-1 rounded-xs' : 'text-sm px-3 py-2 rounded-sm'} ${copied ? 'text-[#1A7A4A] bg-[#ECFDF5]' : 'text-ocean-700 bg-ocean-50 hover:bg-ocean-100'}`}>
      {copied ? <Check size={small ? 11 : 14} strokeWidth={2} /> : <Copy size={small ? 11 : 14} strokeWidth={1.75} />}
      {copied ? 'Copiado' : 'Copiar'}
    </button>
  );
}

function KpiCard({ icon: Icon, label, value, sub, loading }) {
  return (
    <div className="bg-white rounded-md border border-n-200 p-4 flex items-start gap-3">
      <div className="w-9 h-9 rounded-sm bg-ocean-50 flex items-center justify-center shrink-0">
        <Icon size={18} strokeWidth={1.75} className="text-ocean-700" />
      </div>
      <div>
        {loading ? <div className="h-6 w-16 bg-n-100 rounded animate-pulse" /> : (
          <p className="font-display font-bold text-xl text-n-900">{value ?? '—'}</p>
        )}
        <p className="text-xs font-body text-n-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs font-body text-n-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function PostModal({ post, onSave, onClose }) {
  const isNew = !post || post._new;
  const base = post && !post._new ? post : null;

  const [form, setForm] = useState({
    text_pt:      base?.text_pt      || '',
    text_en:      base?.text_en      || '',
    photo_url:    base?.photo_url    || '',
    platform:     base?.platform     || 'instagram',
    scheduled_at: base?.scheduled_at || '',
    status:       base?.status       || 'agendado',
  });
  const [selectedTemplate, setSelectedTemplate] = useState('');

  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));

  function applyTemplate(key) {
    const tpl = TEMPLATES.find(t => t.key === key);
    if (!tpl) return;
    setForm(p => ({ ...p, text_pt: tpl.text_pt, text_en: tpl.text_en }));
    setSelectedTemplate(key);
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSave({ ...base, ...form, id: base?.id || Date.now().toString() });
  }

  return (
    <Modal open onClose={onClose} title={isNew ? 'Novo post' : 'Editar post'} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Templates */}
        <div>
          <p className="text-xs font-body font-bold uppercase tracking-wide text-n-600 mb-2">Template</p>
          <div className="grid grid-cols-2 gap-1.5">
            {TEMPLATES.map(t => (
              <button key={t.key} type="button" onClick={() => applyTemplate(t.key)}
                className={`text-left px-3 py-2 rounded-sm border text-xs font-body transition-colors ${selectedTemplate === t.key ? 'bg-ocean-50 border-ocean-300 text-ocean-700' : 'bg-n-50 border-n-200 text-n-600 hover:border-n-400'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <Textarea label="Texto PT" value={form.text_pt} onChange={set('text_pt')} rows={3} required placeholder="Texto para publicar em portugues..." />
        <Textarea label="Texto EN" value={form.text_en} onChange={set('text_en')} rows={3} placeholder="Text to post in English..." />

        <Input label="Foto (URL)" value={form.photo_url} onChange={set('photo_url')} placeholder="https://exemplo.com/imagem.jpg" />

        <div className="grid grid-cols-2 gap-3">
          <Select label="Plataforma" value={form.platform} onChange={set('platform')}>
            {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </Select>
          <Input label="Data e hora" type="datetime-local" value={form.scheduled_at} onChange={set('scheduled_at')} required />
        </div>

        {!isNew && (
          <Select label="Estado" value={form.status} onChange={set('status')}>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
        )}

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button type="submit" className="flex-1">{isNew ? 'Agendar post' : 'Guardar'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function SocialPlanner({ posts, onAdd, onEdit, onDelete, onMarkPublished }) {
  const today = new Date();
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [calDate, setCalDate] = useState(null);

  const year = month.getFullYear();
  const mon  = month.getMonth();
  const days = calendarDays(year, mon);

  const todayStr = today.toISOString().slice(0, 10);

  const postsByDate = useMemo(() => {
    const map = {};
    posts.forEach(p => {
      const k = postDateKey(p);
      if (!map[k]) map[k] = [];
      map[k].push(p);
    });
    return map;
  }, [posts]);

  function prevMonth() { setMonth(new Date(year, mon - 1, 1)); }
  function nextMonth() { setMonth(new Date(year, mon + 1, 1)); }

  function dayKey(d) {
    return `${year}-${String(mon + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  const upcoming = posts
    .filter(p => p.status === 'agendado' && postDateKey(p) >= todayStr)
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
    .slice(0, 8);

  const PlatformIcon = ({ platform, size = 13 }) => {
    const Ic = PLATFORMS.find(p => p.value === platform)?.icon || Globe2;
    return <Ic size={size} strokeWidth={1.75} className="text-n-500 shrink-0" />;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-semibold text-base text-n-900">Planeador de Social Media</h2>
        <Button icon={Plus} size="sm" onClick={() => onAdd(calDate)}>Novo post</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2 bg-white rounded-md border border-n-200 overflow-hidden">
          {/* Month nav */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-n-200">
            <button onClick={prevMonth} className="p-1 rounded hover:bg-n-100 text-n-500 transition-colors">
              <ChevronLeft size={18} strokeWidth={1.75} />
            </button>
            <p className="font-display font-semibold text-sm text-n-900">
              {MONTHS_PT[mon]} {year}
            </p>
            <button onClick={nextMonth} className="p-1 rounded hover:bg-n-100 text-n-500 transition-colors">
              <ChevronRight size={18} strokeWidth={1.75} />
            </button>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-7 border-b border-n-100">
            {WEEKDAYS.map(d => (
              <div key={d} className="py-2 text-center text-[10px] font-mono font-semibold uppercase tracking-wider text-n-400">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d, i) => {
              if (d === null) return <div key={`empty-${i}`} className="h-16 border-r border-b border-n-100 bg-n-50" />;
              const key     = dayKey(d);
              const dayPost = postsByDate[key] || [];
              const isToday = key === todayStr;
              return (
                <div
                  key={key}
                  onClick={() => { setCalDate(key); onAdd(key); }}
                  className={`h-16 border-r border-b border-n-100 p-1.5 cursor-pointer hover:bg-ocean-50 transition-colors flex flex-col ${isToday ? 'bg-ocean-50' : ''}`}
                >
                  <span className={`text-xs font-mono font-semibold w-5 h-5 flex items-center justify-center rounded-full ${isToday ? 'bg-ocean-700 text-white' : 'text-n-600'}`}>
                    {d}
                  </span>
                  <div className="flex flex-wrap gap-0.5 mt-0.5">
                    {dayPost.slice(0, 3).map(p => (
                      <span key={p.id} className={`w-2 h-2 rounded-full ${p.status === 'publicado' ? 'bg-[#1A7A4A]' : p.status === 'cancelado' ? 'bg-error' : 'bg-ocean-500'}`} />
                    ))}
                    {dayPost.length > 3 && <span className="text-[9px] font-mono text-n-400">+{dayPost.length - 3}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming posts */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-mono uppercase tracking-wider text-n-500">Proximos posts</p>
          {upcoming.length === 0 ? (
            <div className="bg-white rounded-md border border-n-200 flex flex-col items-center py-10 text-n-400">
              <Calendar size={28} strokeWidth={1.25} className="mb-2" />
              <p className="text-xs font-body text-center">Sem posts agendados</p>
            </div>
          ) : upcoming.map(p => {
            const dt = new Date(p.scheduled_at);
            const isToday2 = postDateKey(p) === todayStr;
            return (
              <div key={p.id} className={`bg-white rounded-md border p-3 flex flex-col gap-2 ${isToday2 ? 'border-sand-300 bg-[#FFF7E6]' : 'border-n-200'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <PlatformIcon platform={p.platform} />
                    <p className="text-xs font-body text-n-700 truncate">{p.text_pt.slice(0, 50)}{p.text_pt.length > 50 ? '…' : ''}</p>
                  </div>
                  <div className="flex gap-0.5 shrink-0">
                    <button onClick={() => onEdit(p)} className="p-1 text-n-400 hover:text-ocean-700 transition-colors">
                      <Pencil size={12} strokeWidth={1.75} />
                    </button>
                    <button onClick={() => onDelete(p.id)} className="p-1 text-n-400 hover:text-error transition-colors">
                      <Trash2 size={12} strokeWidth={1.75} />
                    </button>
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
                      <CheckCircle2 size={10} strokeWidth={2} />
                      Publicado
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* All posts list */}
      {posts.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-mono uppercase tracking-wider text-n-500 mb-3">Todos os posts ({posts.length})</p>
          <div className="bg-white rounded-md border border-n-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-n-200 bg-n-50">
                  <th className="text-left px-4 py-2.5 text-xs font-body font-bold uppercase tracking-wide text-n-500">Texto</th>
                  <th className="text-left px-4 py-2.5 text-xs font-body font-bold uppercase tracking-wide text-n-500 whitespace-nowrap">Plataforma</th>
                  <th className="text-left px-4 py-2.5 text-xs font-body font-bold uppercase tracking-wide text-n-500 whitespace-nowrap">Data</th>
                  <th className="text-left px-4 py-2.5 text-xs font-body font-bold uppercase tracking-wide text-n-500">Estado</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-n-100">
                {posts.sort((a,b) => b.scheduled_at.localeCompare(a.scheduled_at)).map(p => {
                  const cfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.agendado;
                  const PlatIc = PLATFORMS.find(pl => pl.value === p.platform)?.icon || Globe2;
                  return (
                    <tr key={p.id} className="hover:bg-n-50">
                      <td className="px-4 py-2.5">
                        <p className="text-sm font-body text-n-900 truncate max-w-[200px]">{p.text_pt}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <PlatIc size={15} strokeWidth={1.75} className="text-n-500" />
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs font-mono text-n-600">
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

/* ─────────────────────── Main ─────────────────────── */
export default function Marketing() {
  const { operator } = useAuthStore();
  const slug = operator?.booking_link_slug;

  const [bookingLink, setBookingLink] = useState('');
  const [widgetCode,  setWidgetCode]  = useState('');
  const [qrUrl,       setQrUrl]       = useState('');
  const [stats,       setStats]       = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [posts,       setPosts]       = useState(loadPosts);
  const [postModal,   setPostModal]   = useState(null); // null | { _new, scheduled_at? } | existing post
  const [widgetOpen,  setWidgetOpen]  = useState(false);

  useEffect(() => {
    getBookingLink()
      .then(d => setBookingLink(d?.url || d || ''))
      .catch(() => setBookingLink(slug ? `https://saldesk.cv/book/${slug}` : ''));

    getWidgetCode()
      .then(d => setWidgetCode(d?.html || d || ''))
      .catch(() => {});

    getQrCode()
      .then(blob => setQrUrl(URL.createObjectURL(blob)))
      .catch(() => {});

    getMarketingStats()
      .then(setStats)
      .catch(() => setStats({ profile_views: 0, bookings_direct: 0, conversion_rate: 0, clicks: 0 }))
      .finally(() => setStatsLoading(false));
  }, []);

  function downloadQr() {
    if (!qrUrl) return;
    const a = document.createElement('a');
    a.href = qrUrl;
    a.download = `qrcode-${slug || 'saldesk'}.png`;
    a.click();
  }

  function shareWhatsApp() {
    const url = `https://wa.me/?text=${encodeURIComponent(`Reserve o seu tour directo: ${bookingLink}`)}`;
    window.open(url, '_blank', 'noopener');
  }
  function shareFacebook() {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(bookingLink)}`;
    window.open(url, '_blank', 'noopener');
  }

  /* Social planner handlers */
  const savePersist = useCallback((next) => {
    setPosts(next);
    savePosts(next);
  }, []);

  function handleAddPost(scheduledAt) {
    setPostModal({ _new: true, scheduled_at: scheduledAt ? `${scheduledAt}T09:00` : '' });
  }
  function handleEditPost(p) { setPostModal(p); }
  function handleSavePost(p) {
    savePersist(prev => {
      const exists = prev.find(x => x.id === p.id);
      return exists ? prev.map(x => x.id === p.id ? p : x) : [...prev, p];
    });
    setPostModal(null);
  }
  function handleDeletePost(id) {
    savePersist(prev => prev.filter(p => p.id !== id));
  }
  function handleMarkPublished(id) {
    savePersist(prev => prev.map(p => p.id === id ? { ...p, status: 'publicado' } : p));
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Marketing" subtitle="Ferramentas de divulgacao e planeador de conteudos" />

      {/* ── Ferramentas ── */}
      <section>
        <p className="text-xs font-mono uppercase tracking-wider text-n-500 mb-4">Ferramentas de divulgacao</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* QR Code */}
          <div className="bg-white rounded-md border border-n-200 p-5 flex flex-col items-center gap-4">
            <div className="w-9 h-9 rounded-sm bg-ocean-50 flex items-center justify-center">
              <QrCode size={20} strokeWidth={1.75} className="text-ocean-700" />
            </div>
            <div className="text-center">
              <p className="font-display font-semibold text-sm text-n-900">QR Code</p>
              <p className="text-xs font-body text-n-500 mt-0.5">Link de reserva directa</p>
            </div>
            {qrUrl ? (
              <img src={qrUrl} alt="QR Code" className="w-32 h-32 object-contain" />
            ) : (
              <div className="w-32 h-32 bg-n-100 rounded flex items-center justify-center">
                <QrCode size={40} strokeWidth={1} className="text-n-300" />
              </div>
            )}
            <Button variant="secondary" size="sm" onClick={downloadQr} disabled={!qrUrl} className="w-full justify-center">
              Download PNG
            </Button>
          </div>

          {/* Booking link */}
          <div className="bg-white rounded-md border border-n-200 p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-sm bg-ocean-50 flex items-center justify-center shrink-0">
                <Link2 size={18} strokeWidth={1.75} className="text-ocean-700" />
              </div>
              <div>
                <p className="font-display font-semibold text-sm text-n-900">Link de reserva</p>
                <p className="text-xs font-body text-n-500 mt-0.5">Partilhe nas redes sociais</p>
              </div>
            </div>
            {bookingLink && (
              <div className="bg-n-50 border border-n-200 rounded-sm px-3 py-2">
                <p className="text-xs font-mono text-n-700 break-all">{bookingLink}</p>
              </div>
            )}
            <div className="flex gap-2">
              {bookingLink && <CopyBtn text={bookingLink} />}
              <button onClick={shareWhatsApp} disabled={!bookingLink}
                className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-sm bg-[#25D366] text-white font-body font-medium hover:bg-[#1ebe5a] transition-colors disabled:opacity-40">
                <Share2 size={14} strokeWidth={1.75} />
                WhatsApp
              </button>
              <button onClick={shareFacebook} disabled={!bookingLink}
                className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-sm bg-[#1877F2] text-white font-body font-medium hover:bg-[#1565d8] transition-colors disabled:opacity-40">
                <Facebook size={14} strokeWidth={1.75} />
                Facebook
              </button>
            </div>
          </div>

          {/* Widget */}
          <div className="bg-white rounded-md border border-n-200 p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-sm bg-ocean-50 flex items-center justify-center shrink-0">
                <Code2 size={18} strokeWidth={1.75} className="text-ocean-700" />
              </div>
              <div>
                <p className="font-display font-semibold text-sm text-n-900">Widget embebivel</p>
                <p className="text-xs font-body text-n-500 mt-0.5">Para o seu website</p>
              </div>
            </div>
            <p className="text-xs font-body text-n-600 leading-relaxed flex-1">
              Incorpore o formulario de reservas directamente no seu website com este codigo HTML.
            </p>
            <div className="flex gap-2">
              {widgetCode && <CopyBtn text={widgetCode} />}
              <button onClick={() => setWidgetOpen(true)} disabled={!widgetCode}
                className="text-sm px-3 py-2 rounded-sm bg-n-100 text-n-700 font-body hover:bg-n-200 transition-colors disabled:opacity-40">
                Ver codigo
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section>
        <p className="text-xs font-mono uppercase tracking-wider text-n-500 mb-4">Estatisticas do perfil</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard icon={Eye} label="Visitas ao perfil" value={stats?.profile_views ?? 0} sub="ultimos 30 dias" loading={statsLoading} />
          <KpiCard icon={MousePointerClick} label="Cliques no link" value={stats?.clicks ?? 0} sub="ultimos 30 dias" loading={statsLoading} />
          <KpiCard icon={TrendingUp} label="Reservas via link" value={stats?.bookings_direct ?? 0} sub="ultimos 30 dias" loading={statsLoading} />
          <KpiCard icon={BarChart2} label="Taxa de conversao" value={stats ? `${stats.conversion_rate ?? 0}%` : null} sub="cliques → reservas" loading={statsLoading} />
        </div>
      </section>

      {/* ── Social Planner ── */}
      <section>
        <SocialPlanner
          posts={posts}
          onAdd={handleAddPost}
          onEdit={handleEditPost}
          onDelete={handleDeletePost}
          onMarkPublished={handleMarkPublished}
        />
      </section>

      {/* Post modal */}
      {postModal && (
        <PostModal post={postModal} onSave={handleSavePost} onClose={() => setPostModal(null)} />
      )}

      {/* Widget code modal */}
      <Modal open={widgetOpen} onClose={() => setWidgetOpen(false)} title="Codigo do widget" size="md">
        <div className="space-y-3">
          <p className="text-sm font-body text-n-600">Cole este codigo HTML no seu website onde quer que o formulario de reservas apareca.</p>
          <div className="bg-n-900 rounded-md p-4 overflow-auto">
            <pre className="text-xs font-mono text-green-400 whitespace-pre-wrap break-all">{widgetCode || '<script src="https://saldesk.cv/widget.js"></script>'}</pre>
          </div>
          <CopyBtn text={widgetCode} />
        </div>
      </Modal>
    </div>
  );
}
