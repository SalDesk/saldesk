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
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Toggle from '../components/ui/Toggle';
import { IconBtn, EDIT_HOVER, DELETE_HOVER } from '../components/shared/IconBtn';
import { useT } from '../i18n';

/* Estilo Mare da pagina: cartao, caixa interna, titulo de bloco, dica, figuras e campo de hora */
const CARTAO = 'bg-white rounded-[18px] border border-mare-card p-[22px] min-w-0';
const CAIXA  = 'rounded-[14px] bg-mare-head p-4 min-w-0';
const TITULO_BLOCO = 'font-display text-lg font-semibold text-ocean-900 mb-4';
const DICA = 'text-xs font-body text-n-600 mb-3';
const NUM = 'font-mono tabular-nums';
/* Anel de foco da marca nos controlos nativos */
const FOCO = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sand-500';
const CAMPO_HORA = `h-11 md:h-8 px-2 border border-mare-field rounded text-sm text-n-800 bg-white focus:outline-none focus:border-ocean-700 ${FOCO}`;

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

/* Icone de cada seccao; o rotulo vem de pageEditor.sections.<chave> */
const SECTION_ICON = {
  featured: Star,
  services: Grid3x3,
  about: Info,
  timeline: Clock3,
  gallery: ImageIcon,
  reviews: BarChart3,
  comparison: Layers,
  availability: CalendarCheck,
  contact: MapPinned,
  faq: HelpCircle,
  partners: Handshake,
  video_testimonials: Video,
  google_reviews: GoogleIcon,
  instagram: Globe,
};

/* Rotulo e icone de uma seccao; uma chave desconhecida mostra a propria chave */
function metaSeccao(key, t) {
  return SECTION_ICON[key]
    ? { label: t(`pageEditor.sections.${key}`), icon: SECTION_ICON[key] }
    : { label: key, icon: Layers };
}

/* Os valores gravados no horario sao as chaves; o rotulo vem de pageEditor.days.<chave> */
const WEEK_DAYS = [
  { key: 'seg' }, { key: 'ter' }, { key: 'qua' }, { key: 'qui' }, { key: 'sex' }, { key: 'sab' }, { key: 'dom' },
];
const SPOKEN_LANGS = ['PT', 'EN', 'FR', 'ES', 'DE', 'NL', 'IT'];

function SaveBanner({ saved }) {
  const t = useT();
  if (!saved) return null;
  return (
    <div role="status" className="flex items-center gap-2 text-sm font-body text-[var(--success)] bg-[var(--success-light)] border border-n-200 rounded px-3 py-2">
      {t('pageEditor.saved')}
    </div>
  );
}

/* Cabecalho de um item de lista: rotulo e botoes subir, descer e remover (44 px no telemovel) */
function CabecalhoItem({ rotulo, subirAria, descerAria, removerAria, onSubir, onDescer, onRemover, noTopo, noFim }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs font-body font-bold uppercase tracking-wide text-n-600 min-w-0 break-words">{rotulo}</span>
      <div className="flex shrink-0">
        <IconBtn icon={ChevronUp} label={subirAria} onClick={onSubir} disabled={noTopo} hover={EDIT_HOVER} />
        <IconBtn icon={ChevronDown} label={descerAria} onClick={onDescer} disabled={noFim} hover={EDIT_HOVER} />
        <IconBtn icon={X} label={removerAria} onClick={onRemover} hover={DELETE_HOVER} />
      </div>
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
  const t = useT();
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
        eyebrow={t('nav.sections.configuracao')}
        title={t('pageEditor.title')}
        subtitle={t('pageEditor.subtitle')}
        actions={previewUrl && (
          <a href={previewUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="secondary" icon={Eye} size="sm" className="min-h-11 md:min-h-0">{t('pageEditor.viewMyPage')}</Button>
          </a>
        )}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Coluna principal ── */}
        <div className="lg:col-span-2 space-y-5 min-w-0">

          {/* Secções */}
          <section className={CARTAO}>
            <h2 className={TITULO_BLOCO}>{t('pageEditor.sectionsTitle')}</h2>
            <p className={DICA}>
              {t('pageEditor.sectionsHint')}
            </p>
            <div className="space-y-1">
              {sections.map((s, i) => {
                const meta = metaSeccao(s.key, t);
                const Icon = meta.icon;
                return (
                  <div key={s.key} className="flex items-center gap-2 py-1 border-b border-n-100 last:border-0">
                    <div className="flex shrink-0">
                      <IconBtn icon={ChevronUp} label={t('pageEditor.moveSectionUp', { label: meta.label })} onClick={() => moveSection(i, -1)} disabled={i === 0} hover={EDIT_HOVER} />
                      <IconBtn icon={ChevronDown} label={t('pageEditor.moveSectionDown', { label: meta.label })} onClick={() => moveSection(i, 1)} disabled={i === sections.length - 1} hover={EDIT_HOVER} />
                    </div>
                    <div className="w-8 h-8 rounded-full bg-ocean-50 flex items-center justify-center text-ocean-700 shrink-0">
                      <Icon size={15} strokeWidth={1.75} />
                    </div>
                    <p className="text-sm font-display font-semibold text-n-800 flex-1 min-w-0 break-words">{meta.label}</p>
                    <Toggle checked={s.enabled} onChange={() => toggleSection(s.key)} aria-label={t('pageEditor.showSection', { label: meta.label })} />
                  </div>
                );
              })}
            </div>
          </section>

          {/* Parceiros */}
          <section className={CARTAO}>
            <h2 className={TITULO_BLOCO}>{t('pageEditor.partnersTitle')}</h2>
            <div className="space-y-3">
              {partners.map((p, i) => (
                <div key={i} className={`${CAIXA} space-y-2`}>
                  <CabecalhoItem rotulo={t('pageEditor.partnerN', { n: i + 1 })}
                    subirAria={t('pageEditor.movePartnerUp', { n: i + 1 })} descerAria={t('pageEditor.movePartnerDown', { n: i + 1 })} removerAria={t('pageEditor.removePartner', { n: i + 1 })}
                    onSubir={() => moveItem(setPartners, i, -1)} onDescer={() => moveItem(setPartners, i, 1)} onRemover={() => removeItem(setPartners, i)}
                    noTopo={i === 0} noFim={i === partners.length - 1} />
                  <Input label={t('pageEditor.name')} aria-label={t('pageEditor.partnerNameAria', { n: i + 1 })} value={p.name || ''} onChange={e => updateItem(setPartners, i, 'name', e.target.value)} />
                  <Input label={t('pageEditor.logoUrl')} aria-label={t('pageEditor.partnerLogoAria', { n: i + 1 })} value={p.logo_url || ''} onChange={e => updateItem(setPartners, i, 'logo_url', e.target.value)} placeholder="https://..." />
                  <Input label={t('pageEditor.link')} aria-label={t('pageEditor.partnerLinkAria', { n: i + 1 })} value={p.url || ''} onChange={e => updateItem(setPartners, i, 'url', e.target.value)} placeholder="https://..." />
                </div>
              ))}
              <Button type="button" variant="secondary" icon={Plus} size="sm" className="min-h-11 md:min-h-0"
                onClick={() => addItem(setPartners, { name: '', logo_url: '', url: '' })}>
                {t('pageEditor.addPartner')}
              </Button>
            </div>
          </section>

          {/* Testemunhos em vídeo */}
          <section className={CARTAO}>
            <h2 className={TITULO_BLOCO}>{t('pageEditor.videosTitle')}</h2>
            <div className="space-y-3">
              {videos.map((v, i) => (
                <div key={i} className={`${CAIXA} space-y-2`}>
                  <CabecalhoItem rotulo={t('pageEditor.videoN', { n: i + 1 })}
                    subirAria={t('pageEditor.moveVideoUp', { n: i + 1 })} descerAria={t('pageEditor.moveVideoDown', { n: i + 1 })} removerAria={t('pageEditor.removeVideo', { n: i + 1 })}
                    onSubir={() => moveItem(setVideos, i, -1)} onDescer={() => moveItem(setVideos, i, 1)} onRemover={() => removeItem(setVideos, i)}
                    noTopo={i === 0} noFim={i === videos.length - 1} />
                  <Input label={t('pageEditor.videoUrl')} aria-label={t('pageEditor.videoUrlAria', { n: i + 1 })} value={v.url || ''} onChange={e => updateItem(setVideos, i, 'url', e.target.value)} placeholder="https://..." />
                  <Input label={t('pageEditor.thumbnailUrl')} aria-label={t('pageEditor.thumbnailAria', { n: i + 1 })} value={v.thumbnail_url || ''} onChange={e => updateItem(setVideos, i, 'thumbnail_url', e.target.value)} placeholder="https://..." />
                </div>
              ))}
              <Button type="button" variant="secondary" icon={Plus} size="sm" className="min-h-11 md:min-h-0"
                onClick={() => addItem(setVideos, { url: '', thumbnail_url: '' })}>
                {t('pageEditor.addVideo')}
              </Button>
            </div>
          </section>

          {/* Avaliações Google */}
          <section className={CARTAO}>
            <h2 className={TITULO_BLOCO}>{t('pageEditor.googleTitle')}</h2>
            <div className="space-y-3">
              {gReviews.map((r, i) => (
                <div key={i} className={`${CAIXA} space-y-2`}>
                  <CabecalhoItem rotulo={t('pageEditor.reviewN', { n: i + 1 })}
                    subirAria={t('pageEditor.moveReviewUp', { n: i + 1 })} descerAria={t('pageEditor.moveReviewDown', { n: i + 1 })} removerAria={t('pageEditor.removeReview', { n: i + 1 })}
                    onSubir={() => moveItem(setGReviews, i, -1)} onDescer={() => moveItem(setGReviews, i, 1)} onRemover={() => removeItem(setGReviews, i)}
                    noTopo={i === 0} noFim={i === gReviews.length - 1} />
                  <Input label={t('pageEditor.authorName')} aria-label={t('pageEditor.authorNameAria', { n: i + 1 })} value={r.author_name || ''} onChange={e => updateItem(setGReviews, i, 'author_name', e.target.value)} />
                  <Input label={t('pageEditor.photoUrl')} aria-label={t('pageEditor.photoAria', { n: i + 1 })} value={r.author_photo || ''} onChange={e => updateItem(setGReviews, i, 'author_photo', e.target.value)} placeholder="https://..." />
                  <Input label={t('pageEditor.reviewText')} aria-label={t('pageEditor.reviewTextAria', { n: i + 1 })} value={r.text || ''} onChange={e => updateItem(setGReviews, i, 'text', e.target.value)} />
                </div>
              ))}
              <Button type="button" variant="secondary" icon={Plus} size="sm" className="min-h-11 md:min-h-0"
                onClick={() => addItem(setGReviews, { author_name: '', author_photo: '', text: '' })}>
                {t('pageEditor.addReview')}
              </Button>
            </div>
          </section>

          {/* Redes sociais */}
          <section className={CARTAO}>
            <h2 className={TITULO_BLOCO}>{t('pageEditor.socialTitle')}</h2>
            <div className="space-y-3">
              {[
                { key: 'instagram',   label: 'Instagram',   icon: Globe, ph: 'https://instagram.com/...' },
                { key: 'facebook',    label: 'Facebook',     icon: Share2,    ph: 'https://facebook.com/...' },
                { key: 'tripadvisor', label: 'TripAdvisor',  icon: Globe,     ph: 'https://tripadvisor.com/...' },
                { key: 'google_maps', label: 'Google Maps',  icon: Globe,     ph: 'https://maps.app.goo.gl/...' },
                { key: 'linkedin',    label: t('pageEditor.linkedinOptional'), icon: ExternalLink, ph: 'https://linkedin.com/company/...' },
              ].map(({ key, label, icon: Icon, ph }) => (
                <div key={key} className="flex items-start gap-2">
                  <Icon size={16} strokeWidth={1.75} className="text-n-500 shrink-0 mt-7" />
                  <div className="flex-1 min-w-0">
                    <Input label={label} aria-label={label} value={social[key]} placeholder={ph}
                      onChange={e => setSocial(p => ({ ...p, [key]: e.target.value }))} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Horário de funcionamento */}
          <section className={CARTAO}>
            <h2 className={TITULO_BLOCO}>{t('pageEditor.hoursTitle')}</h2>
            <div className="space-y-1">
              {WEEK_DAYS.map(d => {
                const diaRotulo = t(`pageEditor.days.${d.key}`);
                return (
                <div key={d.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 min-h-11">
                  <button type="button" role="switch" aria-checked={hours[d.key].open} aria-label={t('pageEditor.openDay', { day: diaRotulo })}
                    onClick={() => setHourField(d.key, 'open', !hours[d.key].open)}
                    className={`w-8 h-4 rounded-full transition-colors relative shrink-0 before:content-[''] before:absolute before:-inset-x-2 before:-inset-y-3.5 ${FOCO} ${hours[d.key].open ? 'bg-ocean-700' : 'bg-n-300'}`}>
                    <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all ${hours[d.key].open ? 'left-[18px]' : 'left-0.5'}`} />
                  </button>
                  <span className="text-sm font-body text-n-700 w-16 shrink-0">{diaRotulo}</span>
                  {hours[d.key].open ? (
                    <div className="flex items-center gap-2">
                      <input type="time" aria-label={t('pageEditor.openingOf', { day: diaRotulo })} value={hours[d.key].start}
                        onChange={e => setHourField(d.key, 'start', e.target.value)}
                        className={`${CAMPO_HORA} ${NUM}`} />
                      <span className="text-xs text-n-600">{t('pageEditor.until')}</span>
                      <input type="time" aria-label={t('pageEditor.closingOf', { day: diaRotulo })} value={hours[d.key].end}
                        onChange={e => setHourField(d.key, 'end', e.target.value)}
                        className={`${CAMPO_HORA} ${NUM}`} />
                    </div>
                  ) : (
                    <span className="text-xs font-body text-n-600 italic">{t('pageEditor.closed')}</span>
                  )}
                </div>
                );
              })}
            </div>
          </section>

          {/* Idiomas + GPS */}
          <section className={CARTAO}>
            <h2 className={TITULO_BLOCO}>{t('pageEditor.languagesTitle')}</h2>
            <div className="flex gap-2 flex-wrap">
              {SPOKEN_LANGS.map(l => (
                <button key={l} type="button" aria-pressed={spokenLangs.includes(l)} onClick={() => toggleSpokenLang(l)}
                  className={`px-3 py-1.5 min-h-11 md:min-h-0 rounded text-sm font-mono font-medium transition-colors ${FOCO} ${spokenLangs.includes(l) ? 'bg-ocean-700 text-white' : 'bg-n-100 text-n-700 hover:bg-n-200'}`}>
                  {l}
                </button>
              ))}
            </div>
          </section>

          <section className={CARTAO}>
            <h2 className={TITULO_BLOCO}>{t('pageEditor.locationTitle')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label={t('pageEditor.latitude')} aria-label={t('pageEditor.latitude')} value={lat} onChange={e => setLat(e.target.value)} placeholder="16.8948" />
              <Input label={t('pageEditor.longitude')} aria-label={t('pageEditor.longitude')} value={lng} onChange={e => setLng(e.target.value)} placeholder="-22.9144" />
            </div>
            <p className="text-xs font-body text-n-600 mt-2">
              {t('pageEditor.coordsHelpBefore')} <strong>maps.google.com</strong> {t('pageEditor.coordsHelpAfter')}
            </p>
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleSave} loading={saving}>{t('pageEditor.save')}</Button>
            <SaveBanner saved={saved} />
          </div>
        </div>

        {/* ── Preview (wireframe) ── */}
        <div className="lg:col-span-1 min-w-0">
          <section className={CARTAO}>
            <h2 className={TITULO_BLOCO}>{t('pageEditor.previewTitle')}</h2>
            <p className={DICA}>
              {t('pageEditor.previewHelp')}
            </p>
            <div className="rounded-[14px] bg-mare-head border border-mare-card overflow-hidden min-w-0">
              <div className="bg-ocean-900 text-white text-[10px] font-body font-bold uppercase tracking-wide px-3 py-2">
                Navbar
              </div>
              <div className="bg-ocean-50 text-ocean-800 text-[10px] font-body font-bold uppercase tracking-wide px-3 py-2 border-t border-mare-card">
                Hero
              </div>
              {sections.filter(s => s.enabled).map(s => {
                const meta = metaSeccao(s.key, t);
                const Icon = meta.icon;
                return (
                  <div key={s.key} className="flex items-center gap-2 px-3 py-2 border-t border-mare-card text-xs font-body text-n-700 min-w-0 break-words">
                    <Icon size={12} strokeWidth={1.75} className="text-ocean-700 shrink-0" />
                    {meta.label}
                  </div>
                );
              })}
              <div className="bg-n-800 text-white/70 text-[10px] font-body font-bold uppercase tracking-wide px-3 py-2 border-t border-mare-card">
                Footer
              </div>
            </div>
            {sections.filter(s => !s.enabled).length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-body font-bold text-n-600 uppercase tracking-wide mb-1.5">{t('pageEditor.disabled')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {sections.filter(s => !s.enabled).map(s => (
                    <span key={s.key} className="text-xs font-body text-n-600 bg-white border border-mare-card px-2 py-1 rounded-full min-w-0 break-words">
                      {metaSeccao(s.key, t).label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
