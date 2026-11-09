import { useState } from 'react';
import { User, Image as ImageIcon } from 'lucide-react';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input, { Textarea, Select } from '../../components/ui/Input';
import { PLATFORMS, STATUS_CONFIG } from './shared';

/* ── Constants ── */
const TEMPLATES = [
  { key: 'tour_disponivel', label: 'Tour disponivel',
    text_pt: 'Novo tour disponivel! Reserve ja o seu lugar e viva uma experiencia unica em Cabo Verde.',
    text_en: 'New tour available! Book your spot now and live a unique experience in Cabo Verde.' },
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
    text_pt: 'Mais um dia incrivel em Cabo Verde. Venha conhecer a nossa ilha e as nossas experiencias!',
    text_en: 'Another amazing day in Cabo Verde. Come discover our island and all it has to offer!' },
];

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
        <div className="w-8 h-8 rounded-full bg-[var(--info)] flex items-center justify-center shrink-0">
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
export default function PostModal({ post, onSave, onClose, operatorName }) {
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
                <button key={t.key} type="button" aria-pressed={selectedTemplate === t.key} onClick={() => applyTemplate(t.key)}
                  className={`text-left px-3 py-2 rounded-sm border text-xs font-body transition-colors ${selectedTemplate === t.key ? 'bg-ocean-50 border-ocean-300 text-ocean-700' : 'bg-n-50 border-n-200 text-n-600 hover:border-n-400'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <Textarea label="Texto PT" aria-label="Texto PT" value={form.text_pt} onChange={set('text_pt')} rows={3} required placeholder="Texto para publicar em portugues..." />
          <Textarea label="Texto EN" aria-label="Texto EN" value={form.text_en} onChange={set('text_en')} rows={2} placeholder="Text to post in English..." />
          <Input label="Foto (URL)" aria-label="Foto (URL)" value={form.photo_url} onChange={set('photo_url')} placeholder="https://exemplo.com/imagem.jpg" />

          <div className="grid grid-cols-2 gap-3">
            <Select label="Plataforma" aria-label="Plataforma" value={form.platform} onChange={set('platform')}>
              {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </Select>
            <Input label="Data e hora" aria-label="Data e hora" type="datetime-local" value={form.scheduled_at} onChange={set('scheduled_at')} required />
          </div>

          {!isNew && (
            <Select label="Estado" aria-label="Estado" value={form.status} onChange={set('status')}>
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
