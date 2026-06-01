import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  QrCode, Link2, Copy, Check, Share2, Code2, ChevronLeft,
  ChevronRight, Plus, Pencil, Trash2, Calendar, ExternalLink,
  Globe2, Clock, BarChart2, Eye, MousePointerClick,
  TrendingUp, CheckCircle2, Download, Image as ImageIcon,
  User, RefreshCw,
} from 'lucide-react';
import { getBookingLink, getMarketingStats, getWidgetCode, getQrCode } from '../services/marketingService';
import { listUnits } from '../services/unitsService';
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
function savePosts(posts) { localStorage.setItem(STORAGE_KEY, JSON.stringify(posts)); }

/* ── Constants ── */
const TEMPLATES = [
  { key: 'tour_disponivel', label: 'Tour disponivel',
    text_pt: 'Novo tour disponivel! Reserve ja o seu lugar e viva uma experiencia unica na Ilha do Sal.',
    text_en: 'New tour available! Book your spot now and live a unique experience on Sal Island.' },
  { key: 'ultimas_vagas', label: 'Ultimas vagas',
    text_pt: 'Ultimas vagas para este tour! Nao perca a oportunidade de explorar a ilha connosco.',
    text_en: 'Last spots available for this tour! Do not miss the chance to explore the island with us.' },
  { key: 'avaliacao', label: 'Avaliacao de cliente',
    text_pt: 'Os nossos clientes falam por nos. Obrigado pela sua confianca e avaliacoes incriveis!',
    text_en: 'Our guests speak for themselves. Thank you for trusting us and for the amazing reviews!' },
  { key: 'promocao', label: 'Promocao especial',
    text_pt: 'Promocao especial disponivel! Reserve agora e aproveite as nossas tarifas exclusivas.',
    text_en: 'Special offer available! Book now and enjoy our exclusive rates for this season.' },
  { key: 'foto_do_dia', label: 'Foto do dia',
    text_pt: 'Mais um dia incrivel na Ilha do Sal. Venha conhecer a nossa ilha e as nossas experiencias!',
    text_en: 'Another amazing day on Sal Island. Come discover our island and all it has to offer!' },
];

const PLATFORMS = [
  { value: 'instagram', label: 'Instagram',            icon: ExternalLink },
  { value: 'facebook',  label: 'Facebook',             icon: Share2       },
  { value: 'ambos',     label: 'Instagram + Facebook', icon: Globe2       },
];

const STATUS_CONFIG = {
  agendado:  { label: 'Agendado',  cls: 'bg-ocean-50 text-ocean-700 border-ocean-100'    },
  publicado: { label: 'Publicado', cls: 'bg-[#ECFDF5] text-[#1A7A4A] border-[#BBF7D0]' },
  cancelado: { label: 'Cancelado', cls: 'bg-red-50 text-error border-red-100'           },
};

const QR_COLORS     = ['#0D5470', '#062A38', '#D4A82A', '#1A7A4A', '#B91C1C', '#1A2332'];
const WIDGET_COLORS = ['#0D5470', '#062A38', '#D4A82A', '#1A7A4A', '#1480A8', '#1A2332'];

const MKTG_TABS = [
  { key: 'planeador', label: 'Planeador',     Icon: Calendar  },
  { key: 'qrcode',    label: 'QR Code',       Icon: QrCode    },
  { key: 'widget',    label: 'Widget',        Icon: Code2     },
  { key: 'stats',     label: 'Estatisticas',  Icon: BarChart2 },
];

const SRC_LABEL = { direct: 'Directa', public: 'Directa', manual: 'Manual', booking_com: 'Booking', airbnb: 'Airbnb', viator: 'Viator', getyourguide: 'GYG', social: 'Social' };

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
const MONTHS_PT = ['Janeiro','Fevereiro','Marco','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
function postDateKey(p) { return p.scheduled_at?.slice(0, 10) || ''; }

/* ── CopyBtn ── */
function CopyBtn({ text, small }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }
  return (
    <button onClick={copy}
      className={`flex items-center gap-1.5 transition-colors font-body font-medium ${small ? 'text-xs px-2 py-1 rounded-xs' : 'text-sm px-3 py-2 rounded-sm'} ${copied ? 'text-[#1A7A4A] bg-[#ECFDF5]' : 'text-ocean-700 bg-ocean-50 hover:bg-ocean-100'}`}>
      {copied ? <Check size={small ? 11 : 14} strokeWidth={2} /> : <Copy size={small ? 11 : 14} strokeWidth={1.75} />}
      {copied ? 'Copiado' : 'Copiar'}
    </button>
  );
}

/* ── KpiCard ── */
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

/* ── InstagramPreview ── */
function InstagramPreview({ text, photoUrl, username }) {
  return (
    <div className="w-full max-w-[240px] rounded-xl overflow-hidden border border-n-200 shadow-sm bg-white text-left">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-n-100">
        <div className="w-7 h-7 rounded-full bg-ocean-100 flex items-center justify-center shrink-0">
          <User size={12} strokeWidth={1.75} className="text-ocean-700" />
        </div>
        <span className="text-xs font-body font-semibold text-n-800 truncate">{username || 'o_seu_perfil'}</span>
      </div>
      <div className="w-full aspect-square bg-n-100 flex items-center justify-center overflow-hidden">
        {photoUrl ? (
          <img src={photoUrl} alt="" className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; }} />
        ) : (
          <ImageIcon size={28} strokeWidth={1.25} className="text-n-300" />
        )}
      </div>
      <div className="flex items-center gap-3 px-3 py-2">
        {[0,1,2].map(i => <div key={i} className="w-4 h-4 rounded-full bg-n-200" />)}
      </div>
      <div className="px-3 pb-3">
        <p className="text-[11px] font-body font-semibold text-n-900">{username || 'o_seu_perfil'}</p>
        <p className="text-[11px] font-body text-n-700 leading-relaxed mt-0.5 line-clamp-3">
          {text || 'A legenda aparecera aqui...'}
        </p>
      </div>
    </div>
  );
}

/* ── FacebookPreview ── */
function FacebookPreview({ text, photoUrl, username }) {
  return (
    <div className="w-full max-w-[240px] rounded-md overflow-hidden border border-n-200 shadow-sm bg-white text-left">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-n-100">
        <div className="w-8 h-8 rounded-full bg-[#1877F2] flex items-center justify-center shrink-0">
          <User size={13} strokeWidth={1.75} className="text-white" />
        </div>
        <div>
          <p className="text-xs font-body font-semibold text-n-900">{username || 'Pagina'}</p>
          <p className="text-[10px] font-body text-n-400">Agora</p>
        </div>
      </div>
      <div className="px-3 py-2">
        <p className="text-[11px] font-body text-n-700 leading-relaxed line-clamp-3">
          {text || 'O texto do post aparecera aqui...'}
        </p>
      </div>
      {photoUrl && (
        <div className="w-full aspect-video bg-n-100 overflow-hidden">
          <img src={photoUrl} alt="" className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; }} />
        </div>
      )}
    </div>
  );
}

/* ── PostModal ── */
function PostModal({ post, onSave, onClose, operatorName }) {
  const isNew = !post || post._new;
  const base  = post && !post._new ? post : null;
  const [form, setForm] = useState({
    text_pt:      base?.text_pt      || '',
    text_en:      base?.text_en      || '',
    photo_url:    base?.photo_url    || '',
    platform:     base?.platform     || 'instagram',
    scheduled_at: base?.scheduled_at || '',
    status:       base?.status       || 'agendado',
  });
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [previewPlatform,  setPreviewPlatform]  = useState('instagram');

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
    <Modal open onClose={onClose} title={isNew ? 'Novo post' : 'Editar post'} size="xl">
      <div className="flex gap-6">
        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 min-w-0 space-y-4">
          {/* Templates */}
          <div>
            <p className="text-xs font-body font-bold uppercase tracking-wide text-n-600 mb-2">Template</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {TEMPLATES.map(t => (
                <button key={t.key} type="button" onClick={() => applyTemplate(t.key)}
                  className={`text-left px-3 py-2 rounded-sm border text-xs font-body transition-colors ${selectedTemplate === t.key ? 'bg-ocean-50 border-ocean-300 text-ocean-700' : 'bg-n-50 border-n-200 text-n-600 hover:border-n-400'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <Textarea label="Texto PT" value={form.text_pt} onChange={set('text_pt')} rows={3} required placeholder="Texto para publicar em portugues..." />
          <Textarea label="Texto EN" value={form.text_en} onChange={set('text_en')} rows={2} placeholder="Text to post in English..." />
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

        {/* Preview pane */}
        <div className="hidden lg:flex flex-col gap-3 w-56 shrink-0">
          <p className="text-xs font-mono uppercase tracking-wider text-n-500">Preview</p>
          <div className="flex gap-1 mb-1">
            {['instagram', 'facebook'].map(pl => (
              <button key={pl} onClick={() => setPreviewPlatform(pl)}
                className={`text-xs px-2 py-1 rounded-xs font-body transition-colors capitalize ${previewPlatform === pl ? 'bg-ocean-700 text-white' : 'bg-n-100 text-n-600 hover:bg-n-200'}`}>
                {pl === 'instagram' ? 'Instagram' : 'Facebook'}
              </button>
            ))}
          </div>
          {previewPlatform === 'instagram' ? (
            <InstagramPreview text={form.text_pt} photoUrl={form.photo_url} username={operatorName} />
          ) : (
            <FacebookPreview text={form.text_pt} photoUrl={form.photo_url} username={operatorName} />
          )}
        </div>
      </div>
    </Modal>
  );
}

/* ── SocialPlanner ── */
function SocialPlanner({ posts, onAdd, onEdit, onDelete, onMarkPublished }) {
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

/* ── QrCodeTab ── */
function QrCodeTab({ slug, units }) {
  const [selectedUnit, setSelectedUnit] = useState('');
  const [qrColor,      setQrColor]      = useState('#0D5470');
  const [qrSize,       setQrSize]       = useState('300');
  const [qrUrl,        setQrUrl]        = useState('');
  const [loading,      setLoading]      = useState(false);

  function generateQr() {
    setLoading(true);
    const params = { size: qrSize, color: qrColor.replace('#', '') };
    if (selectedUnit) params.unit_id = selectedUnit;
    getQrCode(params)
      .then(blob => setQrUrl(URL.createObjectURL(blob)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { generateQr(); }, [selectedUnit]);

  function downloadPng() {
    if (!qrUrl) return;
    const a = document.createElement('a');
    a.href = qrUrl;
    a.download = `qrcode-${selectedUnit || slug || 'saldesk'}.png`;
    a.click();
  }

  function downloadSvg() {
    if (!qrUrl) return;
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const size = parseInt(qrSize);
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      canvas.getContext('2d').drawImage(img, 0, 0, size, size);
      const base64 = canvas.toDataURL('image/png');
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${size}" height="${size}"><image width="${size}" height="${size}" xlink:href="${base64}"/></svg>`;
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `qrcode-${selectedUnit || slug || 'saldesk'}.svg`; a.click();
      URL.revokeObjectURL(url);
    };
    img.src = qrUrl;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Controls */}
      <div className="space-y-5">
        <Select label="QR Code para" value={selectedUnit} onChange={e => setSelectedUnit(e.target.value)}>
          <option value="">Perfil publico — link de reserva</option>
          {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </Select>

        <div>
          <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600 block mb-2">Cor</label>
          <div className="flex items-center gap-2 flex-wrap">
            {QR_COLORS.map(c => (
              <button key={c} onClick={() => setQrColor(c)}
                className={`w-7 h-7 rounded-sm border-2 transition-all ${qrColor === c ? 'border-n-700 scale-110' : 'border-transparent hover:scale-105'}`}
                style={{ backgroundColor: c }} />
            ))}
            <input type="color" value={qrColor} onChange={e => setQrColor(e.target.value)}
              className="w-7 h-7 rounded-sm cursor-pointer border border-n-300" />
            <span className="text-xs font-mono text-n-500">{qrColor}</span>
          </div>
        </div>

        <div>
          <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600 block mb-2">
            Tamanho — {qrSize}px
          </label>
          <input type="range" min="200" max="600" step="50" value={qrSize}
            onChange={e => setQrSize(e.target.value)}
            className="w-full accent-ocean-700" />
          <div className="flex justify-between text-[10px] font-mono text-n-400 mt-1">
            <span>200px</span><span>600px</span>
          </div>
        </div>

        <Button icon={RefreshCw} onClick={generateQr} loading={loading} variant="secondary" className="w-full justify-center">
          Gerar preview
        </Button>

        <div className="flex gap-3">
          <Button variant="secondary" icon={Download} onClick={downloadPng} disabled={!qrUrl || loading} className="flex-1">
            PNG
          </Button>
          <Button variant="secondary" icon={Download} onClick={downloadSvg} disabled={!qrUrl || loading} className="flex-1">
            SVG
          </Button>
        </div>
      </div>

      {/* Preview */}
      <div className="flex flex-col items-center gap-4">
        <p className="text-xs font-mono uppercase tracking-wider text-n-500 self-start">Preview</p>
        <div className="bg-white border border-n-200 rounded-md p-8 flex items-center justify-center w-full min-h-56">
          {loading ? (
            <LoadingSpinner size={32} />
          ) : qrUrl ? (
            <img src={qrUrl} alt="QR Code" className="max-w-48 max-h-48" />
          ) : (
            <QrCode size={64} strokeWidth={0.75} className="text-n-200" />
          )}
        </div>
        <div className="bg-n-50 border border-n-200 rounded-sm px-3 py-2 w-full">
          <p className="text-xs font-mono text-n-600 break-all text-center">
            {selectedUnit
              ? `saldesk.cv/book/${slug || '...'}/servico/${selectedUnit}`
              : `saldesk.cv/book/${slug || '...'}`}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── WidgetTab ── */
function WidgetTab({ widgetCode, slug }) {
  const [color,       setColor]       = useState('#0D5470');
  const [previewMode, setPreviewMode] = useState(false);

  const finalCode = useMemo(() => {
    const base = widgetCode || `<script src="https://saldesk.cv/widget.js" data-slug="${slug}" data-color="${color}"></script>`;
    return base.replace(/data-color="[^"]*"/, `data-color="${color}"`);
  }, [widgetCode, color, slug]);

  return (
    <div className="space-y-5">
      <div>
        <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600 block mb-2">Cor primaria</label>
        <div className="flex items-center gap-2 flex-wrap">
          {WIDGET_COLORS.map(c => (
            <button key={c} onClick={() => setColor(c)}
              className={`w-7 h-7 rounded-sm border-2 transition-all ${color === c ? 'border-n-700 scale-110' : 'border-transparent hover:scale-105'}`}
              style={{ backgroundColor: c }} />
          ))}
          <input type="color" value={color} onChange={e => setColor(e.target.value)}
            className="w-7 h-7 rounded-sm cursor-pointer border border-n-300" />
          <span className="text-xs font-mono text-n-500">{color}</span>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600">Codigo HTML</label>
          <div className="flex gap-0.5 bg-n-100 rounded-xs p-0.5">
            {['Codigo', 'Preview'].map(m => (
              <button key={m} onClick={() => setPreviewMode(m === 'Preview')}
                className={`text-xs px-3 py-1 rounded-xs font-body transition-colors ${(previewMode ? 'Preview' : 'Codigo') === m ? 'bg-white text-ocean-700 shadow-sm' : 'text-n-500 hover:text-n-700'}`}>
                {m}
              </button>
            ))}
          </div>
        </div>

        {previewMode ? (
          <div className="border border-n-200 rounded-md min-h-40 bg-n-50 flex flex-col items-center justify-center p-8 gap-3">
            <div className="w-12 h-12 rounded-sm flex items-center justify-center" style={{ backgroundColor: color }}>
              <Code2 size={22} strokeWidth={1.75} className="text-white" />
            </div>
            <p className="text-sm font-body text-n-600 text-center">
              O widget de reservas aparecera aqui quando incorporado no seu website.
            </p>
            <p className="text-xs font-body text-n-400 text-center">
              Cor primaria: <span className="font-mono">{color}</span>
            </p>
          </div>
        ) : (
          <div className="bg-n-900 rounded-md p-4 overflow-auto">
            <pre className="text-xs font-mono text-green-400 whitespace-pre-wrap break-all">{finalCode}</pre>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <CopyBtn text={finalCode} />
        <p className="text-xs font-body text-n-400 flex-1">
          Cole este codigo no HTML do seu website onde quer que o formulario apareca.
        </p>
      </div>
    </div>
  );
}

/* ── StatsTab ── */
function StatsTab({ stats, statsLoading, posts, bookingLink }) {
  const now = new Date();
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const postsThisMonth = posts.filter(p => postDateKey(p).startsWith(monthStr));
  const agendados  = postsThisMonth.filter(p => p.status === 'agendado').length;
  const publicados = postsThisMonth.filter(p => p.status === 'publicado').length;
  const cancelados = postsThisMonth.filter(p => p.status === 'cancelado').length;

  const sources = stats?.sources
    ? Object.entries(stats.sources).sort((a, b) => b[1] - a[1])
    : null;
  const maxSource = sources ? Math.max(...sources.map(([, v]) => v), 1) : 1;

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Eye}             label="Visitas ao perfil"  value={stats?.profile_views ?? 0} sub="ultimos 30 dias"  loading={statsLoading} />
        <KpiCard icon={MousePointerClick} label="Cliques no link"  value={stats?.clicks ?? 0}        sub="ultimos 30 dias"  loading={statsLoading} />
        <KpiCard icon={TrendingUp}      label="Reservas via link"  value={stats?.bookings_direct ?? 0} sub="ultimos 30 dias" loading={statsLoading} />
        <KpiCard icon={BarChart2}       label="Taxa de conversao"  value={stats ? `${stats.conversion_rate ?? 0}%` : null} sub="cliques → reservas" loading={statsLoading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Posts this month */}
        <div className="bg-white rounded-md border border-n-200 p-5">
          <h3 className="font-display font-semibold text-sm text-n-700 mb-4">Posts — {MONTHS_PT[now.getMonth()]}</h3>
          <div className="flex gap-6">
            <div>
              <p className="font-display font-bold text-3xl text-n-900">{postsThisMonth.length}</p>
              <p className="text-xs font-body text-n-500 mt-0.5">Total</p>
            </div>
            <div>
              <p className="font-display font-bold text-3xl text-[#1A7A4A]">{publicados}</p>
              <p className="text-xs font-body text-n-500 mt-0.5">Publicados</p>
            </div>
            <div>
              <p className="font-display font-bold text-3xl text-ocean-500">{agendados}</p>
              <p className="text-xs font-body text-n-500 mt-0.5">Agendados</p>
            </div>
            {cancelados > 0 && (
              <div>
                <p className="font-display font-bold text-3xl text-error">{cancelados}</p>
                <p className="text-xs font-body text-n-500 mt-0.5">Cancelados</p>
              </div>
            )}
          </div>
        </div>

        {/* Origin */}
        <div className="bg-white rounded-md border border-n-200 p-5">
          <h3 className="font-display font-semibold text-sm text-n-700 mb-4">Origem das reservas</h3>
          {sources ? (
            <div className="space-y-2.5">
              {sources.map(([src, count]) => (
                <div key={src} className="flex items-center gap-3">
                  <span className="text-xs font-mono text-n-500 w-20 shrink-0">{SRC_LABEL[src] || src}</span>
                  <div className="flex-1 h-2 bg-n-100 rounded-full overflow-hidden">
                    <div className="h-full bg-ocean-500 rounded-full transition-all" style={{ width: `${(count / maxSource) * 100}%` }} />
                  </div>
                  <span className="text-xs font-mono font-semibold text-n-700 w-8 text-right shrink-0">{count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs font-body text-n-400">
              Dados de origem nao disponiveis. Configure o endpoint <span className="font-mono">/marketing/stats</span> com campo <span className="font-mono">sources</span>.
            </p>
          )}
        </div>
      </div>

      {/* Booking link */}
      {bookingLink && (
        <div className="bg-white rounded-md border border-n-200 p-5">
          <h3 className="font-display font-semibold text-sm text-n-700 mb-3">Link de reserva directa</h3>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="bg-n-50 border border-n-200 rounded-sm px-3 py-2 flex-1 min-w-0">
              <p className="text-xs font-mono text-n-700 truncate">{bookingLink}</p>
            </div>
            <CopyBtn text={bookingLink} />
            <a href={bookingLink} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-sm bg-n-100 text-n-700 font-body hover:bg-n-200 transition-colors">
              <ExternalLink size={14} strokeWidth={1.75} />Abrir
            </a>
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

  const [activeTab,   setActiveTab]   = useState('planeador');
  const [bookingLink, setBookingLink] = useState('');
  const [widgetCode,  setWidgetCode]  = useState('');
  const [units,       setUnits]       = useState([]);
  const [stats,       setStats]       = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [posts,       setPosts]       = useState(loadPosts);
  const [postModal,   setPostModal]   = useState(null);

  useEffect(() => {
    getBookingLink()
      .then(d => setBookingLink(d?.url || d || ''))
      .catch(() => setBookingLink(slug ? `https://saldesk.cv/book/${slug}` : ''));

    getWidgetCode()
      .then(d => setWidgetCode(d?.html || d || ''))
      .catch(() => {});

    getMarketingStats()
      .then(setStats)
      .catch(() => setStats({ profile_views: 0, bookings_direct: 0, conversion_rate: 0, clicks: 0 }))
      .finally(() => setStatsLoading(false));

    listUnits()
      .then(d => setUnits(d || []))
      .catch(() => {});
  }, []);

  const savePersist = useCallback(next => {
    setPosts(next);
    savePosts(typeof next === 'function' ? next([]) : next);
  }, []);

  function handleSavePost(p) {
    setPosts(prev => {
      const next = prev.find(x => x.id === p.id) ? prev.map(x => x.id === p.id ? p : x) : [...prev, p];
      savePosts(next);
      return next;
    });
    setPostModal(null);
  }
  function handleAddPost(scheduledAt) {
    setPostModal({ _new: true, scheduled_at: scheduledAt ? `${scheduledAt}T09:00` : '' });
  }

  return (
    <div>
      <PageHeader title="Marketing" subtitle="Ferramentas de divulgacao e planeador de conteudos" />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-n-200 mb-6">
        {MKTG_TABS.map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-body font-semibold border-b-2 -mb-px transition-colors ${
              activeTab === key ? 'border-ocean-700 text-ocean-700' : 'border-transparent text-n-500 hover:text-n-700'
            }`}>
            <Icon size={15} strokeWidth={1.75} />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'planeador' && (
        <SocialPlanner
          posts={posts}
          onAdd={handleAddPost}
          onEdit={p => setPostModal(p)}
          onDelete={id => { setPosts(prev => { const n = prev.filter(p => p.id !== id); savePosts(n); return n; }); }}
          onMarkPublished={id => { setPosts(prev => { const n = prev.map(p => p.id === id ? { ...p, status: 'publicado' } : p); savePosts(n); return n; }); }}
        />
      )}

      {activeTab === 'qrcode' && <QrCodeTab slug={slug} units={units} />}

      {activeTab === 'widget' && <WidgetTab widgetCode={widgetCode} slug={slug} />}

      {activeTab === 'stats' && (
        <StatsTab stats={stats} statsLoading={statsLoading} posts={posts} bookingLink={bookingLink} />
      )}

      {postModal && (
        <PostModal
          post={postModal}
          onSave={handleSavePost}
          onClose={() => setPostModal(null)}
          operatorName={operator?.name}
        />
      )}
    </div>
  );
}
