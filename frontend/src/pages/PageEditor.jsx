import { useState } from 'react';
import {
  Eye, ChevronUp, ChevronDown, X, Plus, ExternalLink,
  Layers, Grid3x3, Info, Clock3, Image as ImageIcon, Star,
  BarChart3, CalendarCheck, HelpCircle,
  Handshake, Video, MessageCircle as GoogleIcon,
  Globe, Share2, MapPinned,
} from 'lucide-react';
import useAuthStore from '../store/authStore';
import { updateOperator } from '../services/authService';
import PageHeader from '../components/layout/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Toggle from '../components/ui/Toggle';

const DEFAULT_SECTIONS = [
  { key: 'featured',           enabled: true },
  { key: 'services',           enabled: true },
  { key: 'about',              enabled: true },
  { key: 'timeline',           enabled: true },
  { key: 'gallery',            enabled: true },
  { key: 'reviews',            enabled: true },
  { key: 'comparison',         enabled: true },
  { key: 'availability',       enabled: true },
  { key: 'contact',            enabled: true },
  { key: 'faq',                enabled: true },
  { key: 'partners',           enabled: false },
  { key: 'video_testimonials', enabled: false },
  { key: 'google_reviews',     enabled: false },
  { key: 'instagram',          enabled: false },
];

const SECTION_META = {
  featured:           { label: 'Destaques',                 icon: Star },
  services:           { label: 'Serviços',                  icon: Grid3x3 },
  about:              { label: 'Sobre Nós',                 icon: Info },
  timeline:           { label: 'Como Funciona',             icon: Clock3 },
  gallery:            { label: 'Galeria',                   icon: ImageIcon },
  reviews:            { label: 'Avaliações',                icon: BarChart3 },
  comparison:         { label: 'Comparação de Serviços',    icon: Layers },
  availability:       { label: 'Disponibilidade ao Vivo',    icon: CalendarCheck },
  contact:            { label: 'Localização & Contacto',     icon: MapPinned },
  faq:                { label: 'Perguntas Frequentes',       icon: HelpCircle },
  partners:           { label: 'Parceiros',                  icon: Handshake },
  video_testimonials: { label: 'Testemunhos em Vídeo',       icon: Video },
  google_reviews:     { label: 'Avaliações Google',          icon: GoogleIcon },
  instagram:          { label: 'Instagram',                  icon: Globe },
};

const WEEK_DAYS = [
  { key: 'seg', label: 'Segunda' }, { key: 'ter', label: 'Terça' },
  { key: 'qua', label: 'Quarta' },  { key: 'qui', label: 'Quinta' },
  { key: 'sex', label: 'Sexta' },   { key: 'sab', label: 'Sábado' },
  { key: 'dom', label: 'Domingo' },
];
const SPOKEN_LANGS = ['PT', 'EN', 'FR', 'ES', 'DE', 'NL', 'IT'];

function SaveBanner({ saved }) {
  if (!saved) return null;
  return (
    <div className="flex items-center gap-2 text-sm font-body text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
      Guardado com sucesso
    </div>
  );
}

function move(list, idx, dir) {
  const arr = [...list];
  const [item] = arr.splice(idx, 1);
  arr.splice(idx + dir, 0, item);
  return arr;
}

export default function PageEditor() {
  const { operator, setOperator } = useAuthStore();
  const cfg = operator?.page_config || {};

  const [sections, setSections] = useState(cfg.sections?.length ? cfg.sections : DEFAULT_SECTIONS);
  const [partners, setPartners] = useState(cfg.partners || []);
  const [videos, setVideos]     = useState(cfg.video_testimonials || []);
  const [gReviews, setGReviews] = useState(cfg.google_reviews || []);
  const [social, setSocial] = useState({
    instagram:   cfg.social?.instagram   || '',
    facebook:    cfg.social?.facebook    || '',
    tripadvisor: cfg.social?.tripadvisor || '',
    google_maps: cfg.social?.google_maps || '',
    linkedin:    cfg.social?.linkedin    || '',
  });
  const [hours, setHours] = useState(() =>
    WEEK_DAYS.reduce((acc, d) => ({
      ...acc,
      [d.key]: cfg.opening_hours?.[d.key] || { open: d.key !== 'dom', start: '09:00', end: '18:00' },
    }), {})
  );
  const [spokenLangs, setSpokenLangs] = useState(cfg.spoken_languages || ['PT', 'EN']);
  const [lat, setLat] = useState(cfg.lat ?? '16.8948');
  const [lng, setLng] = useState(cfg.lng ?? '-22.9144');

  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  function toggleSection(key) {
    setSections(p => p.map(s => s.key === key ? { ...s, enabled: !s.enabled } : s));
  }
  function moveSection(idx, dir) {
    setSections(p => move(p, idx, dir));
  }

  function addItem(setter, empty) {
    setter(p => [...p, empty]);
  }
  function updateItem(setter, idx, field, value) {
    setter(p => p.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  }
  function removeItem(setter, idx) {
    setter(p => p.filter((_, i) => i !== idx));
  }
  function moveItem(setter, idx, dir) {
    setter(p => move(p, idx, dir));
  }

  function toggleSpokenLang(l) {
    setSpokenLangs(p => p.includes(l) ? p.filter(x => x !== l) : [...p, l]);
  }
  function setHourField(day, field, value) {
    setHours(p => ({ ...p, [day]: { ...p[day], [field]: value } }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const page_config = {
        sections,
        partners,
        video_testimonials: videos,
        google_reviews: gReviews,
        social,
        opening_hours: hours,
        spoken_languages: spokenLangs,
        lat: parseFloat(lat) || null,
        lng: parseFloat(lng) || null,
      };
      const updated = await updateOperator({ page_config });
      setOperator(updated);
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  const previewUrl = operator?.slug ? `/book/${operator.slug}` : null;

  return (
    <div>
      <PageHeader
        title="Editor da Página Pública"
        subtitle="Activa, desactiva e reordena as secções da tua página de reservas. Adiciona parceiros, testemunhos e redes sociais."
        actions={previewUrl && (
          <a href={previewUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="secondary" icon={Eye} size="sm">Ver a minha página</Button>
          </a>
        )}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Coluna principal ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Secções */}
          <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Secções da página</h3>}>
            <p className="text-xs font-body text-n-400 mb-3">
              Usa as setas para reordenar. Desliga secções que não queres mostrar.
            </p>
            <div className="space-y-1">
              {sections.map((s, i) => {
                const meta = SECTION_META[s.key] || { label: s.key, icon: Layers };
                const Icon = meta.icon;
                return (
                  <div key={s.key} className="flex items-center gap-3 py-2 border-b border-n-100 last:border-0">
                    <div className="flex flex-col shrink-0">
                      <button type="button" onClick={() => moveSection(i, -1)} disabled={i === 0}
                        className="w-5 h-4 flex items-center justify-center text-n-400 disabled:opacity-20 hover:text-ocean-700">
                        <ChevronUp size={12} strokeWidth={2} />
                      </button>
                      <button type="button" onClick={() => moveSection(i, 1)} disabled={i === sections.length - 1}
                        className="w-5 h-4 flex items-center justify-center text-n-400 disabled:opacity-20 hover:text-ocean-700">
                        <ChevronDown size={12} strokeWidth={2} />
                      </button>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-ocean-50 flex items-center justify-center text-ocean-700 shrink-0">
                      <Icon size={15} strokeWidth={1.75} />
                    </div>
                    <p className="text-sm font-display font-semibold text-n-800 flex-1">{meta.label}</p>
                    <Toggle checked={s.enabled} onChange={() => toggleSection(s.key)} />
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Parceiros */}
          <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Parceiros</h3>}>
            <div className="space-y-3">
              {partners.map((p, i) => (
                <div key={i} className="border border-n-200 rounded-md p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-body font-bold uppercase tracking-wide text-n-500">Parceiro {i + 1}</span>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => moveItem(setPartners, i, -1)} disabled={i === 0}
                        className="w-6 h-6 flex items-center justify-center rounded bg-n-100 text-n-500 disabled:opacity-30">
                        <ChevronUp size={12} strokeWidth={2} />
                      </button>
                      <button type="button" onClick={() => moveItem(setPartners, i, 1)} disabled={i === partners.length - 1}
                        className="w-6 h-6 flex items-center justify-center rounded bg-n-100 text-n-500 disabled:opacity-30">
                        <ChevronDown size={12} strokeWidth={2} />
                      </button>
                      <button type="button" onClick={() => removeItem(setPartners, i)}
                        className="w-6 h-6 flex items-center justify-center rounded bg-error/10 text-error">
                        <X size={12} strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                  <Input label="Nome" value={p.name || ''} onChange={e => updateItem(setPartners, i, 'name', e.target.value)} />
                  <Input label="URL do logótipo" value={p.logo_url || ''} onChange={e => updateItem(setPartners, i, 'logo_url', e.target.value)} placeholder="https://..." />
                  <Input label="Link (opcional)" value={p.url || ''} onChange={e => updateItem(setPartners, i, 'url', e.target.value)} placeholder="https://..." />
                </div>
              ))}
              <Button type="button" variant="secondary" icon={Plus} size="sm"
                onClick={() => addItem(setPartners, { name: '', logo_url: '', url: '' })}>
                Adicionar parceiro
              </Button>
            </div>
          </Card>

          {/* Testemunhos em vídeo */}
          <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Testemunhos em vídeo</h3>}>
            <div className="space-y-3">
              {videos.map((v, i) => (
                <div key={i} className="border border-n-200 rounded-md p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-body font-bold uppercase tracking-wide text-n-500">Vídeo {i + 1}</span>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => moveItem(setVideos, i, -1)} disabled={i === 0}
                        className="w-6 h-6 flex items-center justify-center rounded bg-n-100 text-n-500 disabled:opacity-30">
                        <ChevronUp size={12} strokeWidth={2} />
                      </button>
                      <button type="button" onClick={() => moveItem(setVideos, i, 1)} disabled={i === videos.length - 1}
                        className="w-6 h-6 flex items-center justify-center rounded bg-n-100 text-n-500 disabled:opacity-30">
                        <ChevronDown size={12} strokeWidth={2} />
                      </button>
                      <button type="button" onClick={() => removeItem(setVideos, i)}
                        className="w-6 h-6 flex items-center justify-center rounded bg-error/10 text-error">
                        <X size={12} strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                  <Input label="URL do vídeo" value={v.url || ''} onChange={e => updateItem(setVideos, i, 'url', e.target.value)} placeholder="https://..." />
                  <Input label="URL da miniatura (opcional)" value={v.thumbnail_url || ''} onChange={e => updateItem(setVideos, i, 'thumbnail_url', e.target.value)} placeholder="https://..." />
                </div>
              ))}
              <Button type="button" variant="secondary" icon={Plus} size="sm"
                onClick={() => addItem(setVideos, { url: '', thumbnail_url: '' })}>
                Adicionar vídeo
              </Button>
            </div>
          </Card>

          {/* Avaliações Google */}
          <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Avaliações Google</h3>}>
            <div className="space-y-3">
              {gReviews.map((r, i) => (
                <div key={i} className="border border-n-200 rounded-md p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-body font-bold uppercase tracking-wide text-n-500">Avaliação {i + 1}</span>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => moveItem(setGReviews, i, -1)} disabled={i === 0}
                        className="w-6 h-6 flex items-center justify-center rounded bg-n-100 text-n-500 disabled:opacity-30">
                        <ChevronUp size={12} strokeWidth={2} />
                      </button>
                      <button type="button" onClick={() => moveItem(setGReviews, i, 1)} disabled={i === gReviews.length - 1}
                        className="w-6 h-6 flex items-center justify-center rounded bg-n-100 text-n-500 disabled:opacity-30">
                        <ChevronDown size={12} strokeWidth={2} />
                      </button>
                      <button type="button" onClick={() => removeItem(setGReviews, i)}
                        className="w-6 h-6 flex items-center justify-center rounded bg-error/10 text-error">
                        <X size={12} strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                  <Input label="Nome do autor" value={r.author_name || ''} onChange={e => updateItem(setGReviews, i, 'author_name', e.target.value)} />
                  <Input label="URL da foto (opcional)" value={r.author_photo || ''} onChange={e => updateItem(setGReviews, i, 'author_photo', e.target.value)} placeholder="https://..." />
                  <Input label="Texto da avaliação" value={r.text || ''} onChange={e => updateItem(setGReviews, i, 'text', e.target.value)} />
                </div>
              ))}
              <Button type="button" variant="secondary" icon={Plus} size="sm"
                onClick={() => addItem(setGReviews, { author_name: '', author_photo: '', text: '' })}>
                Adicionar avaliação
              </Button>
            </div>
          </Card>

          {/* Redes sociais */}
          <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Redes sociais</h3>}>
            <div className="space-y-3">
              {[
                { key: 'instagram',   label: 'Instagram',   icon: Globe, ph: 'https://instagram.com/...' },
                { key: 'facebook',    label: 'Facebook',     icon: Share2,    ph: 'https://facebook.com/...' },
                { key: 'tripadvisor', label: 'TripAdvisor',  icon: Globe,     ph: 'https://tripadvisor.com/...' },
                { key: 'google_maps', label: 'Google Maps',  icon: Globe,     ph: 'https://maps.app.goo.gl/...' },
                { key: 'linkedin',    label: 'LinkedIn (opcional)', icon: ExternalLink, ph: 'https://linkedin.com/company/...' },
              ].map(({ key, label, icon: Icon, ph }) => (
                <div key={key} className="flex items-start gap-2">
                  <Icon size={16} strokeWidth={1.75} className="text-n-400 shrink-0 mt-7" />
                  <div className="flex-1">
                    <Input label={label} value={social[key]} placeholder={ph}
                      onChange={e => setSocial(p => ({ ...p, [key]: e.target.value }))} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Horário de funcionamento */}
          <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Horário de funcionamento</h3>}>
            <div className="space-y-2">
              {WEEK_DAYS.map(d => (
                <div key={d.key} className="flex items-center gap-3">
                  <button type="button" onClick={() => setHourField(d.key, 'open', !hours[d.key].open)}
                    className={`w-8 h-4 rounded-full transition-colors relative shrink-0 ${hours[d.key].open ? 'bg-ocean-700' : 'bg-n-300'}`}>
                    <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all ${hours[d.key].open ? 'left-4.5' : 'left-0.5'}`} />
                  </button>
                  <span className="text-sm font-body text-n-700 w-16 shrink-0">{d.label}</span>
                  {hours[d.key].open ? (
                    <div className="flex items-center gap-2">
                      <input type="time" value={hours[d.key].start}
                        onChange={e => setHourField(d.key, 'start', e.target.value)}
                        className="h-8 px-2 border border-n-200 rounded text-sm font-mono text-n-800 bg-n-50 focus:outline-none focus:border-ocean-700" />
                      <span className="text-xs text-n-400">até</span>
                      <input type="time" value={hours[d.key].end}
                        onChange={e => setHourField(d.key, 'end', e.target.value)}
                        className="h-8 px-2 border border-n-200 rounded text-sm font-mono text-n-800 bg-n-50 focus:outline-none focus:border-ocean-700" />
                    </div>
                  ) : (
                    <span className="text-xs font-body text-n-400 italic">Fechado</span>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* Idiomas + GPS */}
          <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Idiomas falados</h3>}>
            <div className="flex gap-2 flex-wrap">
              {SPOKEN_LANGS.map(l => (
                <button key={l} type="button" onClick={() => toggleSpokenLang(l)}
                  className={`px-3 py-1.5 rounded text-sm font-mono font-medium transition-colors ${spokenLangs.includes(l) ? 'bg-ocean-700 text-white' : 'bg-n-100 text-n-600 hover:bg-n-200'}`}>
                  {l}
                </button>
              ))}
            </div>
          </Card>

          <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Localização (coordenadas GPS)</h3>}>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Latitude" value={lat} onChange={e => setLat(e.target.value)} placeholder="16.8948" />
              <Input label="Longitude" value={lng} onChange={e => setLng(e.target.value)} placeholder="-22.9144" />
            </div>
            <p className="text-xs font-body text-n-400 mt-2">
              Encontrar coordenadas em <strong>maps.google.com</strong> → clique direito → "What's here?"
            </p>
          </Card>

          <div className="flex items-center gap-3">
            <Button onClick={handleSave} loading={saving}>Guardar alterações</Button>
            <SaveBanner saved={saved} />
          </div>
        </div>

        {/* ── Preview (wireframe) ── */}
        <div className="lg:col-span-1">
          <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Pré-visualização (esquema)</h3>}>
            <p className="text-xs font-body text-n-400 mb-3">
              Ordem final da tua página. Para ver o resultado real, usa "Ver a minha página" acima.
            </p>
            <div className="border border-n-200 rounded-md overflow-hidden">
              <div className="bg-ocean-900 text-white text-[10px] font-body font-bold uppercase tracking-wide px-3 py-2">
                Navbar
              </div>
              <div className="bg-ocean-50 text-ocean-800 text-[10px] font-body font-bold uppercase tracking-wide px-3 py-2 border-t border-n-200">
                Hero
              </div>
              {sections.filter(s => s.enabled).map(s => {
                const meta = SECTION_META[s.key] || { label: s.key, icon: Layers };
                const Icon = meta.icon;
                return (
                  <div key={s.key} className="flex items-center gap-2 px-3 py-2 border-t border-n-200 text-xs font-body text-n-700">
                    <Icon size={12} strokeWidth={1.75} className="text-ocean-700 shrink-0" />
                    {meta.label}
                  </div>
                );
              })}
              <div className="bg-n-800 text-white/70 text-[10px] font-body font-bold uppercase tracking-wide px-3 py-2 border-t border-n-200">
                Footer
              </div>
            </div>
            {sections.filter(s => !s.enabled).length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-body font-bold text-n-400 uppercase tracking-wide mb-1.5">Desactivadas</p>
                <div className="flex flex-wrap gap-1.5">
                  {sections.filter(s => !s.enabled).map(s => (
                    <span key={s.key} className="text-[10px] font-body text-n-400 bg-n-100 px-2 py-1 rounded-full">
                      {(SECTION_META[s.key] || {}).label || s.key}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
