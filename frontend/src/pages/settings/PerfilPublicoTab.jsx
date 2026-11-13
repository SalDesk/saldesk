import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Download, ExternalLink, Eye, ArrowUpRight, Upload, Camera, ChevronUp, ChevronDown, X, Plus,
} from 'lucide-react';
import api from '../../services/api';
import { updateOperator } from '../../services/authService';
import useAuthStore from '../../store/authStore';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input, { Textarea } from '../../components/ui/Input';
import ImageUploader from '../../components/shared/ImageUploader';
import { uploadImage, validateImageFile } from '../../services/uploadService';
import { CopyButton, SaveBanner } from './shared';

/* ─────────────────────────────────────────────────────────
   TAB 2 — PERFIL PUBLICO
───────────────────────────────────────────────────────── */

/* Chat do site: resposta automatica fora de horas (hora de Cabo Verde). Dias 0 = domingo ... 6 = sabado. */
const DIAS_CHAT = [
  { v: 1, l: 'Seg' }, { v: 2, l: 'Ter' }, { v: 3, l: 'Qua' }, { v: 4, l: 'Qui' },
  { v: 5, l: 'Sex' }, { v: 6, l: 'Sab' }, { v: 0, l: 'Dom' },
];
const CHAT_PADRAO = { enabled: false, days: [1, 2, 3, 4, 5], from: '09:00', to: '18:00', message_pt: '', message_en: '' };
const TEXTO_CHAT_PT = 'Obrigado pela sua mensagem. De momento estamos fora do horario de atendimento; responderemos assim que possivel.';
const TEXTO_CHAT_EN = 'Thank you for your message. We are currently outside our opening hours and will reply as soon as we can.';

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


export default function PerfilPublicoTab({ operator }) {
  const { setOperator } = useAuthStore();
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [logoPreview, setLogoPreview] = useState(operator?.logo_url || null);
  /* Fotos de capa: os URLs guardados no operador (cover_images); o ImageUploader trata do upload, da ordem e da remocao. */
  const [covers, setCovers]         = useState(() => (Array.isArray(operator?.cover_images) ? operator.cover_images.filter(Boolean) : []));
  const [logoError, setLogoError]    = useState('');
  const [descPt,  setDescPt]        = useState(operator?.description_pt || '');
  const [descEn,  setDescEn]        = useState(operator?.description_en || '');
  const [cancelPolicyPt, setCancelPolicyPt] = useState(operator?.cancellation_policy_pt || '');
  const [cancelPolicyEn, setCancelPolicyEn] = useState(operator?.cancellation_policy_en || '');
  const [faqs, setFaqs] = useState(operator?.custom_faqs || []);
  const [chatAuto, setChatAuto] = useState(() => chatInicial(operator));

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
      setLogoError('Erro ao carregar logo. Tenta novamente.');
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
    : chatAuto.days.length === 0 ? 'Escolhe pelo menos um dia de atendimento.'
    : chatAuto.to <= chatAuto.from ? 'A hora de fecho tem de ser posterior a hora de abertura.'
    : '';

  function alternarDia(dia) {
    setChatAuto(c => ({ ...c, days: c.days.includes(dia) ? c.days.filter(d => d !== dia) : [...c.days, dia].sort((a, b) => a - b) }));
  }

  async function handleSave(e) {
    e.preventDefault();
    if (erroChat) return;
    setSaving(true);
    try {
      const payload = {
        logo_url:       logoPreview,
        cover_images:   covers,
        description_pt: descPt,
        description_en: descEn,
        cancellation_policy_pt: cancelPolicyPt,
        cancellation_policy_en: cancelPolicyEn,
        custom_faqs: faqs.filter(f => f.question_pt || f.question_en),
        /* null quando nunca foi configurado e esta desligado (nao escreve valores por omissao) */
        chat_auto_reply: chatAuto.enabled || operator?.chat_auto_reply ? chatAuto : null,
      };
      const updated = await updateOperator(payload);
      setOperator(updated);
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSave} className="space-y-5 max-w-2xl">
      {/* Logo */}
      <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Logo</h3>}>
        <div className="flex items-center gap-5">
          <div className="relative w-20 h-20 rounded-md border-2 border-dashed border-n-200 bg-n-50 flex items-center justify-center overflow-hidden shrink-0">
            {logoPreview
              ? <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-1" />
              : <Camera size={22} strokeWidth={1.75} className="text-n-400" />}
          </div>
          <div className="space-y-2">
            <Button type="button" variant="secondary" icon={Upload} size="sm" onClick={() => logoRef.current?.click()}>
              Escolher logo
            </Button>
            <input ref={logoRef} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Ficheiro do logo" onChange={handleLogo} className="hidden" />
            {logoError
              ? <p className="text-xs font-body text-[var(--error)]">{logoError}</p>
              : <p className="text-xs font-body text-n-400">JPG, PNG ou WebP · fundo transparente recomendado</p>}
          </div>
        </div>
      </Card>

      {/* Cover photos */}
      <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Fotos de capa</h3>}>
        <ImageUploader
          value={covers}
          onChange={setCovers}
          maxImages={5}
          label="Fotos"
          hint="Aparecem no carousel da pagina publica · ate 5 fotos · a primeira e a principal · JPG, PNG, WebP · max 5MB cada"
        />
      </Card>

      {/* Description */}
      <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Descricao</h3>}>
        <div className="space-y-3">
          <Textarea label="Portugues" aria-label="Descricao em Portugues" value={descPt} onChange={e => setDescPt(e.target.value)}
            rows={4} placeholder="Descricao do operador em portugues..." />
          <Textarea label="Ingles (EN)" aria-label="Descricao em Ingles" value={descEn} onChange={e => setDescEn(e.target.value)}
            rows={4} placeholder="Operator description in English..." />
        </div>
      </Card>

      {/* Politica de cancelamento -- mostrada na pagina publica antes do
          pagamento (checkbox obrigatorio), exigida pela SISP no checklist
          de validacao de site. Sem isto configurado, a pagina publica avisa
          que ainda nao foi definida em vez de inventar uma politica. */}
      <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Politica de cancelamento</h3>}>
        <div className="space-y-3">
          <p className="text-xs font-body text-n-400">
            Mostrada na pagina publica de reserva. O cliente tem de aceitar esta politica antes de pagar.
          </p>
          <Textarea label="Portugues" aria-label="Politica de cancelamento em Portugues" value={cancelPolicyPt} onChange={e => setCancelPolicyPt(e.target.value)}
            rows={4} placeholder="Ex: Cancelamento gratuito ate 48h antes. Apos esse prazo, 50% do valor e retido..." />
          <Textarea label="Ingles (EN)" aria-label="Politica de cancelamento em Ingles" value={cancelPolicyEn} onChange={e => setCancelPolicyEn(e.target.value)}
            rows={4} placeholder="Ex: Free cancellation up to 48h before. After that, 50% of the value is retained..." />
        </div>
      </Card>

      {/* Chat do site: resposta automatica fora de horas */}
      <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Chat do site: resposta automatica</h3>}>
        <div className="space-y-3">
          <p className="text-xs font-body text-n-400">
            Quando um visitante escreve no chat da sua pagina fora do horario de atendimento (hora de Cabo Verde), recebe esta mensagem uma vez.
            Nao responde a quem o operador ja respondeu nas ultimas 12 horas.
          </p>
          <label className="flex items-center gap-2 text-sm font-body text-n-700 cursor-pointer">
            <input type="checkbox" checked={chatAuto.enabled} onChange={e => setChatAuto(c => ({ ...c, enabled: e.target.checked }))}
              className="w-4 h-4 accent-[var(--ocean-700)]" />
            Responder automaticamente fora do horario
          </label>

          {chatAuto.enabled && (
            <div className="space-y-3 pt-1">
              <div>
                <p className="text-xs font-body font-bold uppercase tracking-wide text-n-600 mb-1.5">Dias de atendimento</p>
                <div className="flex flex-wrap gap-3">
                  {DIAS_CHAT.map(d => (
                    <label key={d.v} className="flex items-center gap-1.5 text-sm font-body text-n-700 cursor-pointer">
                      <input type="checkbox" checked={chatAuto.days.includes(d.v)} onChange={() => alternarDia(d.v)}
                        className="w-4 h-4 accent-[var(--ocean-700)]" />
                      {d.l}
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 max-w-xs">
                <Input label="Abre as" aria-label="Abre as" type="time" value={chatAuto.from} onChange={e => setChatAuto(c => ({ ...c, from: e.target.value }))} />
                <Input label="Fecha as" aria-label="Fecha as" type="time" value={chatAuto.to} onChange={e => setChatAuto(c => ({ ...c, to: e.target.value }))} />
              </div>
              {erroChat && <p role="alert" className="text-xs font-body text-[var(--error)]">{erroChat}</p>}
              <Textarea label="Portugues" aria-label="Mensagem em Portugues" value={chatAuto.message_pt}
                onChange={e => setChatAuto(c => ({ ...c, message_pt: e.target.value }))} rows={3} maxLength={500} placeholder={TEXTO_CHAT_PT} />
              <Textarea label="Ingles (EN)" aria-label="Mensagem em Ingles" value={chatAuto.message_en}
                onChange={e => setChatAuto(c => ({ ...c, message_en: e.target.value }))} rows={3} maxLength={500} placeholder={TEXTO_CHAT_EN} />
              <p className="text-xs font-body text-n-400">Se deixares uma mensagem em branco, usa-se o texto sugerido.</p>
            </div>
          )}
        </div>
      </Card>

      {/* FAQ personalizado */}
      <Card header={<h3 className="font-display font-semibold text-sm text-n-700">FAQ personalizado</h3>}>
        <div className="space-y-4">
          <p className="text-xs font-body text-n-400">
            Se adicionares perguntas aqui, substituem as FAQ genéricas na página pública.
          </p>
          {faqs.map((f, i) => (
            <div key={i} className="border border-n-200 rounded-md p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-body font-bold uppercase tracking-wide text-n-500">Pergunta {i + 1}</span>
                <div className="flex gap-1">
                  <button type="button" aria-label={`Mover pergunta ${i + 1} para cima`} onClick={() => moveFaq(i, -1)} disabled={i === 0}
                    className="w-6 h-6 flex items-center justify-center rounded bg-n-100 text-n-500 disabled:opacity-30">
                    <ChevronUp size={12} strokeWidth={2} />
                  </button>
                  <button type="button" aria-label={`Mover pergunta ${i + 1} para baixo`} onClick={() => moveFaq(i, 1)} disabled={i === faqs.length - 1}
                    className="w-6 h-6 flex items-center justify-center rounded bg-n-100 text-n-500 disabled:opacity-30">
                    <ChevronDown size={12} strokeWidth={2} />
                  </button>
                  <button type="button" aria-label={`Remover pergunta ${i + 1}`} onClick={() => removeFaq(i)}
                    className="w-6 h-6 flex items-center justify-center rounded bg-[var(--error-light)] text-[var(--error)]">
                    <X size={12} strokeWidth={2} />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input label="Pergunta PT" aria-label={`Pergunta ${i + 1} PT`} value={f.question_pt} onChange={e => updateFaq(i, 'question_pt', e.target.value)} />
                <Input label="Pergunta EN" aria-label={`Pergunta ${i + 1} EN`} value={f.question_en} onChange={e => updateFaq(i, 'question_en', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Textarea label="Resposta PT" aria-label={`Resposta ${i + 1} PT`} rows={2} value={f.answer_pt} onChange={e => updateFaq(i, 'answer_pt', e.target.value)} />
                <Textarea label="Resposta EN" aria-label={`Resposta ${i + 1} EN`} rows={2} value={f.answer_en} onChange={e => updateFaq(i, 'answer_en', e.target.value)} />
              </div>
            </div>
          ))}
          <Button type="button" variant="secondary" icon={Plus} size="sm" onClick={addFaq}>
            Adicionar pergunta
          </Button>
        </div>
      </Card>

      {/* Editor da pagina publica */}
      <Card>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-display font-semibold text-sm text-n-700">Secções, redes sociais, horário e mais</h3>
            <p className="text-xs font-body text-n-500 mt-0.5">
              Activar/desactivar secções, reordenar, parceiros, testemunhos, redes sociais, horário, idiomas e localização agora vivem no Editor da Página Pública.
            </p>
          </div>
          <Link to="/editor-pagina" className="shrink-0">
            <Button type="button" variant="secondary" icon={ExternalLink} size="sm">Abrir editor</Button>
          </Link>
        </div>
      </Card>

      {/* Marketing tools */}
      <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Ferramentas de marketing</h3>}>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600 mb-1.5 block">
              Link de reserva directa
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-n-50 border border-n-200 rounded px-3 py-2 text-sm font-mono text-ocean-700 truncate">{bookingLink || '...'}</code>
              <CopyButton text={bookingLink} />
              {bookingLink && (
                <a href={bookingLink} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="sm" icon={ArrowUpRight}>Abrir</Button>
                </a>
              )}
            </div>
          </div>

          {qrcodeUrl && (
            <div>
              <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600 mb-1.5 block">QR Code</label>
              <div className="flex items-center gap-4">
                <img src={qrcodeUrl} alt="QR Code" className="w-24 h-24 rounded border border-n-200"
                  onError={e => e.target.style.display = 'none'} />
                <div className="space-y-2">
                  <p className="text-xs font-body text-n-500">Imprimir e colocar na recepcao ou material promocional.</p>
                  <a href={qrcodeUrl} download="qrcode.png">
                    <Button variant="secondary" icon={Download} size="sm">Descarregar PNG</Button>
                  </a>
                </div>
              </div>
            </div>
          )}

          {widget && (
            <div>
              <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600 mb-1.5 block">Widget embebivel</label>
              <div className="bg-n-50 border border-n-200 rounded p-3 font-mono text-xs text-n-700 whitespace-pre-wrap break-all mb-2">{widget}</div>
              <CopyButton text={widget} />
            </div>
          )}

          <div className="pt-2 border-t border-n-100">
            <a href={operator?.booking_link_slug || operator?.slug ? `/book/${operator.booking_link_slug || operator.slug}` : '#'} target="_blank" rel="noopener noreferrer">
              <Button variant="secondary" icon={Eye} size="sm">Pre-visualizar pagina publica</Button>
            </a>
          </div>
        </div>
      </Card>

      {/* Programa de indicacao -- 1 mes gratis para ti e para o operador que
          indicares, aplicado automaticamente quando ele se tornar cliente
          pagante (ver aplicarRecompensaReferencia em billingController.js). */}
      {operator?.slug && (
        <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Indique um operador</h3>}>
          <div className="space-y-3">
            <p className="text-sm font-body text-n-600">
              Partilhe este link com outro operador turístico. Quando ele se tornar cliente pagante, ganham os dois <strong>1 mês grátis</strong> — aplicado automaticamente, sem precisar de pedir nada.
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
        <Button type="submit" loading={saving}>Guardar perfil</Button>
        <SaveBanner saved={saved} />
      </div>
    </form>
  );
}
