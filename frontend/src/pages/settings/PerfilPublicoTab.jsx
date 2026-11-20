import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Download, ExternalLink, Eye, ArrowUpRight, Upload, Camera, ChevronUp, ChevronDown, X, Plus,
} from 'lucide-react';
import api from '../../services/api';
import { updateOperator } from '../../services/authService';
import { camposAlterados } from '../../utils/camposAlterados';
import useAuthStore from '../../store/authStore';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input, { Textarea, Select } from '../../components/ui/Input';
import Toggle from '../../components/ui/Toggle';
import { textoPoliticaGerada } from '../../utils/politicaCancelamento';
import ImageUploader from '../../components/shared/ImageUploader';
import { uploadImage, validateImageFile } from '../../services/uploadService';
import { CopyButton, SaveBanner } from './shared';
import { COR_ORIGINAL, corValida } from '../../utils/brandPalette';
import { useT } from '../../i18n';

/* ─────────────────────────────────────────────────────────
   TAB 2 — PERFIL PUBLICO
───────────────────────────────────────────────────────── */

/* Chat do site: resposta automatica fora de horas (hora de Cabo Verde). Dias 0 = domingo ... 6 = sabado. */
/* rotulo de cada dia: settings.perfil.days.<l> */
const DIAS_CHAT = [
  { v: 1, l: 'mon' }, { v: 2, l: 'tue' }, { v: 3, l: 'wed' }, { v: 4, l: 'thu' },
  { v: 5, l: 'fri' }, { v: 6, l: 'sat' }, { v: 0, l: 'sun' },
];
const CHAT_PADRAO = { enabled: false, days: [1, 2, 3, 4, 5], from: '09:00', to: '18:00', message_pt: '', message_en: '' };
const TEXTO_CHAT_PT = 'Obrigado pela sua mensagem. De momento estamos fora do horario de atendimento; responderemos assim que possivel.';
const TEXTO_CHAT_EN = 'Thank you for your message. We are currently outside our opening hours and will reply as soon as we can.';

/* Cor da pagina publica e do widget: sugestoes todas com texto branco legivel (contraste >= 4.5).
   Nome de cada cor: settings.perfil.colors.<nome> */
const CORES_SUGERIDAS = [
  { nome: 'ocean', hex: '#0d5470' }, { nome: 'emerald', hex: '#1f6f43' }, { nome: 'orange', hex: '#c2410c' },
  { nome: 'purple', hex: '#6d28d9' }, { nome: 'bordeaux', hex: '#9f1239' }, { nome: 'slate', hex: '#334155' },
];

function chatInicial(operator) {
  const c = operator?.chat_auto_reply;
  if (!c || typeof c !== 'object') return { ...CHAT_PADRAO };
  return {
    enabled: c.enabled === true,
    days: Array.isArray(c.days) ? c.days : CHAT_PADRAO.days,
    from: c.from || CHAT_PADRAO.from,
    to: c.to || CHAT_PADRAO.to,
    message_pt: c.message_pt || '',
    message_en: c.message_en || '',
  };
}


/* Prazos de cancelamento gratis (free_cancellation_hours): '' = sem prazo definido, 0 = sem cancelamento gratis.
   Texto de cada opcao: chave settings.perfil.deadlines.<chave> (com {{h}} para as horas) */
const PRAZOS_CANCELAMENTO = [
  { valor: '',    chave: 'none' },
  { valor: '24',  chave: 'hours', h: 24 },
  { valor: '48',  chave: 'hours', h: 48 },
  { valor: '72',  chave: 'hours', h: 72 },
  { valor: '168', chave: 'days7' },
  { valor: '0',   chave: 'noFree' },
];

export default function PerfilPublicoTab({ operator }) {
  const t = useT();
  const { setOperator } = useAuthStore();
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [logoPreview, setLogoPreview] = useState(operator?.logo_url || null);
  /* Fotos de capa: os URLs guardados no operador (cover_images); o ImageUploader trata do upload, da ordem e da remocao. */
  const [covers, setCovers]         = useState(() => (Array.isArray(operator?.cover_images) ? operator.cover_images.filter(Boolean) : []));
  const [logoError, setLogoError]    = useState('');
  /* operators.description: a do registo, mostrada na pagina publica e na lista de operadores do catalogo */
  const [descricao, setDescricao]   = useState(operator?.description || '');
  const [cancelPolicyPt, setCancelPolicyPt] = useState(operator?.cancellation_policy_pt || '');
  const [cancelPolicyEn, setCancelPolicyEn] = useState(operator?.cancellation_policy_en || '');
  /* prazo de cancelamento gratis em horas, como texto do select ('' = sem prazo definido) */
  const [horasCancel, setHorasCancel] = useState(operator?.free_cancellation_hours != null ? String(operator.free_cancellation_hours) : '');
  const [autoConfirm, setAutoConfirm] = useState(operator?.auto_confirm_bookings === true);
  const [faqs, setFaqs] = useState(operator?.custom_faqs || []);
  const [chatAuto, setChatAuto] = useState(() => chatInicial(operator));
  const [corMarca, setCorMarca] = useState(operator?.brand_color || '');

  /* marketing — loaded separately */
  const [bookingLink, setBookingLink] = useState('');
  const [widget,      setWidget]      = useState('');
  const apiBase   = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1').replace('/api/v1', '');
  const qrcodeUrl = operator?.booking_link_slug || operator?.slug ? `${apiBase}/api/v1/public/${operator.booking_link_slug || operator.slug}/qrcode` : null;

  const logoRef  = useRef(null);

  useEffect(() => {
    api.get('/marketing/booking-link').then(r => setBookingLink(r.data?.data?.url || '')).catch(() => {});
    api.get('/marketing/widget-code').then(r => setWidget(r.data?.data?.html || '')).catch(() => {});
  }, []);

  /* O logo e enviado para o servidor e guarda-se o URL (antes guardava-se o ficheiro inteiro em base64). */
  async function handleLogo(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const erro = validateImageFile(file);
    if (erro) { setLogoError(erro); return; }
    setLogoError('');
    try {
      const result = await uploadImage(file, () => {});
      setLogoPreview(result.url);
    } catch {
      setLogoError(t('settings.perfil.logoUploadError'));
    }
  }

  function addFaq() {
    setFaqs(p => [...p, { question_pt: '', question_en: '', answer_pt: '', answer_en: '' }]);
  }

  function updateFaq(idx, field, value) {
    setFaqs(p => p.map((f, i) => i === idx ? { ...f, [field]: value } : f));
  }

  function removeFaq(idx) {
    setFaqs(p => p.filter((_, i) => i !== idx));
  }

  function moveFaq(idx, dir) {
    setFaqs(p => {
      const arr = [...p];
      const [item] = arr.splice(idx, 1);
      arr.splice(idx + dir, 0, item);
      return arr;
    });
  }

  /* Validacao do cartao do chat (so conta quando esta ligado); o backend volta a validar */
  const erroChat = !chatAuto.enabled ? ''
    : chatAuto.days.length === 0 ? t('settings.perfil.chatErrorDays')
    : chatAuto.to === chatAuto.from ? t('settings.perfil.chatErrorHours')
    : '';

  /* Cor da marca: vazio = cor original; o backend volta a validar (formato e contraste) */
  const corNormal = corMarca.trim().toLowerCase();
  const validacaoCor = corNormal === '' ? { ok: true } : corValida(corNormal);
  const erroCor = validacaoCor.ok ? ''
    : validacaoCor.motivo === 'clara' ? t('settings.perfil.colorErrorLight')
    : t('settings.perfil.colorErrorFormat');
  const corEmUso = validacaoCor.ok && corNormal ? corNormal : COR_ORIGINAL;

  function alternarDia(dia) {
    setChatAuto(c => ({ ...c, days: c.days.includes(dia) ? c.days.filter(d => d !== dia) : [...c.days, dia].sort((a, b) => a - b) }));
  }

  const temPoliticaEscrita = !!(cancelPolicyPt.trim() || cancelPolicyEn.trim());

  /* O que o formulario gravaria agora */
  function montarPayload() {
    return {
      logo_url:       logoPreview,
      cover_images:   covers,
      description:    descricao,
      cancellation_policy_pt: cancelPolicyPt,
      cancellation_policy_en: cancelPolicyEn,
      free_cancellation_hours: horasCancel === '' ? null : Number(horasCancel),
      auto_confirm_bookings: autoConfirm,
      custom_faqs: faqs.filter(f => f.question_pt || f.question_en),
      /* null quando nunca foi configurado e esta desligado (nao escreve valores por omissao) */
      chat_auto_reply: chatAuto.enabled || operator?.chat_auto_reply ? chatAuto : null,
      /* null repoe a cor original */
      brand_color: corNormal || null,
    };
  }
  /* O que estava gravado quando o separador abriu (e depois, o da ultima gravacao): guardar so envia
     o que mudou desde ai, para nao apagar o que outro separador do browser gravou entretanto */
  const baseRef = useRef(null);
  if (baseRef.current === null) baseRef.current = montarPayload();

  async function handleSave(e) {
    e.preventDefault();
    if (erroChat || erroCor) return;
    setSaving(true);
    try {
      const payload = montarPayload();
      const alterados = camposAlterados(baseRef.current, payload);
      if (Object.keys(alterados).length) {
        const updated = await updateOperator(alterados);
        setOperator(updated);
      }
      baseRef.current = payload;
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSave} className="space-y-5 max-w-2xl">
      {/* Logo */}
      <Card header={<h3 className="font-display font-semibold text-sm text-n-700">{t('settings.perfil.logo')}</h3>}>
        <div className="flex items-center gap-5">
          <div className="relative w-20 h-20 rounded-md border-2 border-dashed border-n-200 bg-n-50 flex items-center justify-center overflow-hidden shrink-0">
            {logoPreview
              ? <img src={logoPreview} alt={t('settings.perfil.logo')} className="w-full h-full object-contain p-1" />
              : <Camera size={22} strokeWidth={1.75} className="text-n-400" />}
          </div>
          <div className="space-y-2">
            <Button type="button" variant="secondary" icon={Upload} size="sm" onClick={() => logoRef.current?.click()}>
              {t('settings.perfil.chooseLogo')}
            </Button>
            <input ref={logoRef} type="file" accept="image/jpeg,image/png,image/webp" aria-label={t('settings.perfil.logoFile')} onChange={handleLogo} className="hidden" />
            {logoError
              ? <p className="text-xs font-body text-[var(--error)]">{logoError}</p>
              : <p className="text-xs font-body text-n-400">{t('settings.perfil.logoHint')}</p>}
          </div>
        </div>
      </Card>

      {/* Cover photos */}
      <Card header={<h3 className="font-display font-semibold text-sm text-n-700">{t('settings.perfil.covers')}</h3>}>
        <ImageUploader
          value={covers}
          onChange={setCovers}
          maxImages={5}
          label={t('settings.perfil.coversLabel')}
          hint={t('settings.perfil.coversHint')}
        />
      </Card>

      {/* Description */}
      <Card header={<h3 className="font-display font-semibold text-sm text-n-700">{t('settings.perfil.description')}</h3>}>
        <div className="space-y-3">
          <Textarea label={t('settings.perfil.descriptionLabel')} value={descricao} onChange={e => setDescricao(e.target.value)}
            rows={4} placeholder={t('settings.perfil.descriptionPlaceholder')}
            hint={t('settings.perfil.descriptionHint')} />
        </div>
      </Card>

      {/* Politica de cancelamento -- mostrada na pagina publica antes do
          pagamento (checkbox obrigatorio), exigida pela SISP no checklist
          de validacao de site. Sem isto configurado, a pagina publica avisa
          que ainda nao foi definida em vez de inventar uma politica. */}
      <Card header={<h3 className="font-display font-semibold text-sm text-n-700">{t('settings.perfil.cancelPolicy')}</h3>}>
        <div className="space-y-3">
          <p className="text-xs font-body text-n-400">
            {t('settings.perfil.cancelPolicyIntro')}
          </p>
          <Select label={t('settings.perfil.freeCancellation')} value={horasCancel} onChange={e => setHorasCancel(e.target.value)}
            hint={t('settings.perfil.freeCancellationHint')}>
            {PRAZOS_CANCELAMENTO.map(p => <option key={p.valor} value={p.valor}>{t(`settings.perfil.deadlines.${p.chave}`, { h: p.h })}</option>)}
          </Select>
          {horasCancel !== '' && !temPoliticaEscrita && (
            <div className="rounded-sm bg-n-50 border border-n-200 px-3 py-2">
              <p className="text-xs font-body font-semibold text-n-600">{t('settings.perfil.generatedText')}</p>
              <p className="text-sm font-body text-n-700 mt-0.5">{textoPoliticaGerada(Number(horasCancel), 'pt')}</p>
            </div>
          )}
          {horasCancel !== '' && temPoliticaEscrita && (
            <p className="text-xs font-body text-n-600">{t('settings.perfil.confirmSameDeadline')}</p>
          )}
          <Textarea label={t('settings.perfil.portuguese')} aria-label={t('settings.perfil.cancelPolicyPtAria')} value={cancelPolicyPt} onChange={e => setCancelPolicyPt(e.target.value)}
            rows={4} placeholder="Ex: Cancelamento gratuito ate 48h antes. Apos esse prazo, 50% do valor e retido..." />
          <Textarea label={t('settings.perfil.englishEn')} aria-label={t('settings.perfil.cancelPolicyEnAria')} value={cancelPolicyEn} onChange={e => setCancelPolicyEn(e.target.value)}
            rows={4} placeholder="Ex: Free cancellation up to 48h before. After that, 50% of the value is retained..." />
        </div>
      </Card>

      {/* Confirmacao automatica: so as reservas pagas presencialmente entram confirmadas;
          as pagas online ficam confirmadas quando o pagamento e capturado. */}
      <Card header={<h3 className="font-display font-semibold text-sm text-n-700">{t('settings.perfil.bookingConfirmation')}</h3>}>
        <Toggle checked={autoConfirm} onChange={setAutoConfirm} label={t('settings.perfil.autoConfirm')}
          hint={t('settings.perfil.autoConfirmHint')} />
      </Card>

      {/* Cor da pagina publica e do widget */}
      <Card header={<h3 className="font-display font-semibold text-sm text-n-700">{t('settings.perfil.brandColor')}</h3>}>
        <div className="space-y-3">
          <p className="text-xs font-body text-n-400">
            {t('settings.perfil.brandColorIntro')}
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <input type="color" aria-label={t('settings.perfil.pickColor')} value={corEmUso} onChange={e => setCorMarca(e.target.value)}
              className="h-10 w-12 cursor-pointer rounded-sm border border-n-200 bg-white p-1" />
            <div className="w-36">
              <Input label={t('settings.perfil.colorHex')} aria-label={t('settings.perfil.colorHexAria')} value={corMarca} placeholder={COR_ORIGINAL} maxLength={9}
                onChange={e => setCorMarca(e.target.value)} />
            </div>
            <div data-testid="previa-cor" style={{ backgroundColor: corEmUso }}
              className="h-10 px-5 rounded-md text-white text-sm font-body font-semibold flex items-center">{t('settings.perfil.previewButton')}</div>
            {corNormal && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setCorMarca('')}>{t('settings.perfil.resetColor')}</Button>
            )}
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('settings.perfil.suggestedColors')}>
            {CORES_SUGERIDAS.map(c => (
              <button key={c.hex} type="button" title={t(`settings.perfil.colors.${c.nome}`)} aria-label={t('settings.perfil.useColor', { hex: c.hex })} onClick={() => setCorMarca(c.hex)}
                style={{ backgroundColor: c.hex }}
                className={`h-8 w-8 rounded-full border-2 ${corNormal === c.hex ? 'border-n-900' : 'border-white shadow-sm'}`} />
            ))}
          </div>
          {erroCor && <p role="alert" className="text-xs font-body text-[var(--error)]">{erroCor}</p>}
        </div>
      </Card>

      {/* Chat do site: resposta automatica fora de horas */}
      <Card header={<h3 className="font-display font-semibold text-sm text-n-700">{t('settings.perfil.chatTitle')}</h3>}>
        <div className="space-y-3">
          <p className="text-xs font-body text-n-400">
            {t('settings.perfil.chatIntro')}
          </p>
          <label className="flex items-center gap-2 text-sm font-body text-n-700 cursor-pointer">
            <input type="checkbox" checked={chatAuto.enabled} onChange={e => setChatAuto(c => ({ ...c, enabled: e.target.checked }))}
              className="w-4 h-4 accent-[var(--ocean-700)]" />
            {t('settings.perfil.chatEnable')}
          </label>

          {chatAuto.enabled && (
            <div className="space-y-3 pt-1">
              <div>
                <p className="text-xs font-body font-bold uppercase tracking-wide text-n-600 mb-1.5">{t('settings.perfil.chatDays')}</p>
                <div className="flex flex-wrap gap-3">
                  {DIAS_CHAT.map(d => (
                    <label key={d.v} className="flex items-center gap-1.5 text-sm font-body text-n-700 cursor-pointer">
                      <input type="checkbox" checked={chatAuto.days.includes(d.v)} onChange={() => alternarDia(d.v)}
                        className="w-4 h-4 accent-[var(--ocean-700)]" />
                      {t(`settings.perfil.days.${d.l}`)}
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 max-w-xs">
                <Input label={t('settings.perfil.opensAt')} aria-label={t('settings.perfil.opensAt')} type="time" value={chatAuto.from} onChange={e => setChatAuto(c => ({ ...c, from: e.target.value }))} />
                <Input label={t('settings.perfil.closesAt')} aria-label={t('settings.perfil.closesAt')} type="time" value={chatAuto.to} onChange={e => setChatAuto(c => ({ ...c, to: e.target.value }))} />
              </div>
              {erroChat && <p role="alert" className="text-xs font-body text-[var(--error)]">{erroChat}</p>}
              {!erroChat && chatAuto.to < chatAuto.from && (
                <p className="text-xs font-body text-n-400">
                  {t('settings.perfil.chatOvernight')}
                </p>
              )}
              <Textarea label={t('settings.perfil.portuguese')} aria-label={t('settings.perfil.messagePtAria')} value={chatAuto.message_pt}
                onChange={e => setChatAuto(c => ({ ...c, message_pt: e.target.value }))} rows={3} maxLength={500} placeholder={TEXTO_CHAT_PT} />
              <Textarea label={t('settings.perfil.englishEn')} aria-label={t('settings.perfil.messageEnAria')} value={chatAuto.message_en}
                onChange={e => setChatAuto(c => ({ ...c, message_en: e.target.value }))} rows={3} maxLength={500} placeholder={TEXTO_CHAT_EN} />
              <p className="text-xs font-body text-n-400">{t('settings.perfil.chatBlankHint')}</p>
            </div>
          )}
        </div>
      </Card>

      {/* FAQ personalizado */}
      <Card header={<h3 className="font-display font-semibold text-sm text-n-700">{t('settings.perfil.faqTitle')}</h3>}>
        <div className="space-y-4">
          <p className="text-xs font-body text-n-400">
            {t('settings.perfil.faqIntro')}
          </p>
          {faqs.map((f, i) => (
            <div key={i} className="border border-n-200 rounded-md p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-body font-bold uppercase tracking-wide text-n-500">{t('settings.perfil.question', { n: i + 1 })}</span>
                <div className="flex gap-1">
                  <button type="button" aria-label={t('settings.perfil.moveUp', { n: i + 1 })} onClick={() => moveFaq(i, -1)} disabled={i === 0}
                    className="w-6 h-6 flex items-center justify-center rounded bg-n-100 text-n-500 disabled:opacity-30">
                    <ChevronUp size={12} strokeWidth={2} />
                  </button>
                  <button type="button" aria-label={t('settings.perfil.moveDown', { n: i + 1 })} onClick={() => moveFaq(i, 1)} disabled={i === faqs.length - 1}
                    className="w-6 h-6 flex items-center justify-center rounded bg-n-100 text-n-500 disabled:opacity-30">
                    <ChevronDown size={12} strokeWidth={2} />
                  </button>
                  <button type="button" aria-label={t('settings.perfil.remove', { n: i + 1 })} onClick={() => removeFaq(i)}
                    className="w-6 h-6 flex items-center justify-center rounded bg-[var(--error-light)] text-[var(--error)]">
                    <X size={12} strokeWidth={2} />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input label={t('settings.perfil.questionPt')} aria-label={t('settings.perfil.questionPtAria', { n: i + 1 })} value={f.question_pt} onChange={e => updateFaq(i, 'question_pt', e.target.value)} />
                <Input label={t('settings.perfil.questionEn')} aria-label={t('settings.perfil.questionEnAria', { n: i + 1 })} value={f.question_en} onChange={e => updateFaq(i, 'question_en', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Textarea label={t('settings.perfil.answerPt')} aria-label={t('settings.perfil.answerPtAria', { n: i + 1 })} rows={2} value={f.answer_pt} onChange={e => updateFaq(i, 'answer_pt', e.target.value)} />
                <Textarea label={t('settings.perfil.answerEn')} aria-label={t('settings.perfil.answerEnAria', { n: i + 1 })} rows={2} value={f.answer_en} onChange={e => updateFaq(i, 'answer_en', e.target.value)} />
              </div>
            </div>
          ))}
          <Button type="button" variant="secondary" icon={Plus} size="sm" onClick={addFaq}>
            {t('settings.perfil.addQuestion')}
          </Button>
        </div>
      </Card>

      {/* Editor da pagina publica */}
      <Card>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-display font-semibold text-sm text-n-700">{t('settings.perfil.editorTitle')}</h3>
            <p className="text-xs font-body text-n-500 mt-0.5">
              {t('settings.perfil.editorText')}
            </p>
          </div>
          <Link to="/editor-pagina" className="shrink-0">
            <Button type="button" variant="secondary" icon={ExternalLink} size="sm">{t('settings.perfil.openEditor')}</Button>
          </Link>
        </div>
      </Card>

      {/* Marketing tools */}
      <Card header={<h3 className="font-display font-semibold text-sm text-n-700">{t('settings.perfil.marketingTitle')}</h3>}>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600 mb-1.5 block">
              {t('settings.perfil.directLink')}
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-n-50 border border-n-200 rounded px-3 py-2 text-sm font-mono text-ocean-700 truncate">{bookingLink || '...'}</code>
              <CopyButton text={bookingLink} />
              {bookingLink && (
                <a href={bookingLink} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="sm" icon={ArrowUpRight}>{t('settings.perfil.open')}</Button>
                </a>
              )}
            </div>
          </div>

          {qrcodeUrl && (
            <div>
              <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600 mb-1.5 block">{t('settings.perfil.qrCode')}</label>
              <div className="flex items-center gap-4">
                <img src={qrcodeUrl} alt={t('settings.perfil.qrCode')} className="w-24 h-24 rounded border border-n-200"
                  onError={e => e.target.style.display = 'none'} />
                <div className="space-y-2">
                  <p className="text-xs font-body text-n-500">{t('settings.perfil.qrHint')}</p>
                  <a href={qrcodeUrl} download="qrcode.png">
                    <Button variant="secondary" icon={Download} size="sm">{t('settings.perfil.downloadPng')}</Button>
                  </a>
                </div>
              </div>
            </div>
          )}

          {widget && (
            <div>
              <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600 mb-1.5 block">{t('settings.perfil.widget')}</label>
              <div className="bg-n-50 border border-n-200 rounded p-3 font-mono text-xs text-n-700 whitespace-pre-wrap break-all mb-2">{widget}</div>
              <CopyButton text={widget} />
            </div>
          )}

          <div className="pt-2 border-t border-n-100">
            <a href={operator?.booking_link_slug || operator?.slug ? `/book/${operator.booking_link_slug || operator.slug}` : '#'} target="_blank" rel="noopener noreferrer">
              <Button variant="secondary" icon={Eye} size="sm">{t('settings.perfil.preview')}</Button>
            </a>
          </div>
        </div>
      </Card>

      {/* Programa de indicacao -- 1 mes gratis para ti e para o operador que
          indicares, aplicado automaticamente quando ele se tornar cliente
          pagante (ver aplicarRecompensaReferencia em billingController.js). */}
      {operator?.slug && (
        <Card header={<h3 className="font-display font-semibold text-sm text-n-700">{t('settings.perfil.referralTitle')}</h3>}>
          <div className="space-y-3">
            <p className="text-sm font-body text-n-600">
              {t('settings.perfil.referralBefore')}<strong>{t('settings.perfil.referralBold')}</strong>{t('settings.perfil.referralAfter')}
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-n-50 border border-n-200 rounded px-3 py-2 text-sm font-mono text-ocean-700 truncate">
                {`https://saldesk.cv/operadores.html?ref=${operator.slug}`}
              </code>
              <CopyButton text={`https://saldesk.cv/operadores.html?ref=${operator.slug}`} />
            </div>
          </div>
        </Card>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" loading={saving}>{t('settings.perfil.save')}</Button>
        <SaveBanner saved={saved} />
      </div>
    </form>
  );
}
