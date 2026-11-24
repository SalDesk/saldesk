import { useState } from 'react';
import { User, Image as ImageIcon } from 'lucide-react';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input, { Textarea, Select } from '../../components/ui/Input';
import { useT } from '../../i18n';
import { PLATFORMS, STATUS_CONFIG, rotuloEstadoPost } from './shared';

/* ── Constants ── */
/* Os textos text_pt e text_en sao o conteudo que o operador publica nas redes: ficam sempre como estao,
   qualquer que seja a lingua do painel. So o nome do template (key) se traduz. */
const TEMPLATES = [
  { key: 'tour_disponivel',
    text_pt: 'Novo tour disponível! Reserve já o seu lugar e viva uma experiência única em Cabo Verde.',
    text_en: 'New tour available! Book your spot now and live a unique experience in Cabo Verde.' },
  { key: 'ultimas_vagas',
    text_pt: 'Últimas vagas para este tour! Não perca a oportunidade de explorar a ilha connosco.',
    text_en: 'Last spots available for this tour! Do not miss the chance to explore the island with us.' },
  { key: 'avaliacao',
    text_pt: 'Os nossos clientes falam por nós. Obrigado pela sua confiança e avaliações incríveis!',
    text_en: 'Our guests speak for themselves. Thank you for trusting us and for the amazing reviews!' },
  { key: 'promocao',
    text_pt: 'Promoção especial disponível! Reserve agora e aproveite as nossas tarifas exclusivas.',
    text_en: 'Special offer available! Book now and enjoy our exclusive rates for this season.' },
  { key: 'foto_do_dia',
    text_pt: 'Mais um dia incrível em Cabo Verde. Venha conhecer a nossa ilha e as nossas experiências!',
    text_en: 'Another amazing day in Cabo Verde. Come discover our island and all it has to offer!' },
];

/* ── InstagramPreview ── */
function InstagramPreview({ text, photoUrl, username }) {
  const t = useT();
  return (
    <div className="w-full max-w-[240px] rounded-xl overflow-hidden border border-n-200 shadow-sm bg-white text-left">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-n-100">
        <div className="w-7 h-7 rounded-full bg-ocean-100 flex items-center justify-center shrink-0">
          <User size={12} strokeWidth={1.75} className="text-ocean-700" />
        </div>
        <span className="text-xs font-body font-semibold text-n-800 truncate">{username || t('marketingPage.post.profileFallback')}</span>
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
        <p className="text-[11px] font-body font-semibold text-n-900">{username || t('marketingPage.post.profileFallback')}</p>
        <p className="text-[11px] font-body text-n-700 leading-relaxed mt-0.5 line-clamp-3">
          {text || t('marketingPage.post.captionPlaceholder')}
        </p>
      </div>
    </div>
  );
}

/* ── FacebookPreview ── */
function FacebookPreview({ text, photoUrl, username }) {
  const t = useT();
  return (
    <div className="w-full max-w-[240px] rounded-md overflow-hidden border border-n-200 shadow-sm bg-white text-left">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-n-100">
        <div className="w-8 h-8 rounded-full bg-[var(--info)] flex items-center justify-center shrink-0">
          <User size={13} strokeWidth={1.75} className="text-white" />
        </div>
        <div>
          <p className="text-xs font-body font-semibold text-n-900">{username || t('marketingPage.post.pageFallback')}</p>
          <p className="text-[10px] font-body text-n-400">{t('marketingPage.post.now')}</p>
        </div>
      </div>
      <div className="px-3 py-2">
        <p className="text-[11px] font-body text-n-700 leading-relaxed line-clamp-3">
          {text || t('marketingPage.post.bodyPlaceholder')}
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
export default function PostModal({ post, onSave, onClose, operatorName }) {
  const t = useT();
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
    const tpl = TEMPLATES.find(x => x.key === key);
    if (!tpl) return;
    setForm(p => ({ ...p, text_pt: tpl.text_pt, text_en: tpl.text_en }));
    setSelectedTemplate(key);
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSave({ ...base, ...form, id: base?.id || Date.now().toString() });
  }

  return (
    <Modal open onClose={onClose} title={isNew ? t('marketingPage.post.newTitle') : t('marketingPage.post.editTitle')} size="xl">
      <div className="flex gap-6">
        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 min-w-0 space-y-4">
          {/* Templates */}
          <div>
            <p className="text-xs font-body font-bold uppercase tracking-wide text-n-600 mb-2">{t('marketingPage.post.template')}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {TEMPLATES.map(tpl => (
                <button key={tpl.key} type="button" aria-pressed={selectedTemplate === tpl.key} onClick={() => applyTemplate(tpl.key)}
                  className={`text-left px-3 py-2 rounded-sm border text-xs font-body transition-colors ${selectedTemplate === tpl.key ? 'bg-ocean-50 border-ocean-300 text-ocean-700' : 'bg-n-50 border-n-200 text-n-600 hover:border-n-400'}`}>
                  {t(`marketingPage.post.templates.${tpl.key}`)}
                </button>
              ))}
            </div>
          </div>

          <Textarea label={t('marketingPage.post.textPt')} aria-label={t('marketingPage.post.textPt')} value={form.text_pt} onChange={set('text_pt')} rows={3} required placeholder={t('marketingPage.post.textPtPlaceholder')} />
          <Textarea label={t('marketingPage.post.textEn')} aria-label={t('marketingPage.post.textEn')} value={form.text_en} onChange={set('text_en')} rows={2} placeholder={t('marketingPage.post.textEnPlaceholder')} />
          <Input label={t('marketingPage.post.photo')} aria-label={t('marketingPage.post.photo')} value={form.photo_url} onChange={set('photo_url')} placeholder={t('marketingPage.post.photoPlaceholder')} />

          <div className="grid grid-cols-2 gap-3">
            <Select label={t('marketingPage.post.platform')} aria-label={t('marketingPage.post.platform')} value={form.platform} onChange={set('platform')}>
              {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </Select>
            <Input label={t('marketingPage.post.dateTime')} aria-label={t('marketingPage.post.dateTime')} type="datetime-local" value={form.scheduled_at} onChange={set('scheduled_at')} required />
          </div>

          {!isNew && (
            <Select label={t('marketingPage.post.state')} aria-label={t('marketingPage.post.state')} value={form.status} onChange={set('status')}>
              {Object.keys(STATUS_CONFIG).map(k => <option key={k} value={k}>{rotuloEstadoPost(k, t)}</option>)}
            </Select>
          )}

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">{t('common.cancel')}</Button>
            <Button type="submit" className="flex-1">{isNew ? t('marketingPage.post.schedule') : t('common.save')}</Button>
          </div>
        </form>

        {/* Preview pane */}
        <div className="hidden lg:flex flex-col gap-3 w-56 shrink-0">
          <p className="text-xs font-mono uppercase tracking-wider text-n-500">{t('marketingPage.post.preview')}</p>
          <div className="flex gap-1 mb-1">
            {['instagram', 'facebook'].map(pl => (
              <button key={pl} type="button" aria-pressed={previewPlatform === pl} onClick={() => setPreviewPlatform(pl)}
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
