import { useState, useEffect, useRef } from 'react';
import {
  Copy, Check, Download, CreditCard, Globe, User, Bell,
  Link2, Shield, ExternalLink, Share2,
  Eye, EyeOff, RefreshCw, AlertCircle, CheckCircle2, XCircle, Upload,
  Camera, ChevronUp, ChevronDown, X, Plus, ArrowUpRight,
  Lock, Key, Smartphone, Phone, Wifi, WifiOff, Trash2,
  Clock, AlertTriangle, Monitor, ToggleLeft, ToggleRight,
} from 'lucide-react';
import api from '../services/api';
import {
  updateOperator, changePassword,
  sendTwoFactor, verifyTwoFactor, toggleTwoFactor, getLoginHistory,
  terminateSession, terminateAllSessions,
} from '../services/authService';
import PasswordStrength, { getPasswordStrength } from '../components/auth/PasswordStrength';
import { getStatus, connectChannel, disconnectChannel, syncManual } from '../services/integrationsService';
import useAuthStore from '../store/authStore';
import PageHeader from '../components/layout/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input, { Select, Textarea } from '../components/ui/Input';
import Modal from '../components/ui/Modal';

/* ── helpers ── */
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  function doCopy() {
    navigator.clipboard.writeText(text || '').then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <Button variant="ghost" size="sm" icon={copied ? Check : Copy} onClick={doCopy}>
      {copied ? 'Copiado' : 'Copiar'}
    </Button>
  );
}

function SaveBanner({ saved }) {
  if (!saved) return null;
  return (
    <div className="flex items-center gap-2 text-sm font-body text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
      <CheckCircle2 size={14} strokeWidth={1.75} />
      Guardado com sucesso
    </div>
  );
}

function Toggle({ checked, onChange, label, hint }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-n-100 last:border-0">
      <div>
        <p className="text-sm font-display font-semibold text-n-800">{label}</p>
        {hint && <p className="text-xs font-body text-n-500 mt-0.5">{hint}</p>}
      </div>
      <button type="button" onClick={() => onChange(!checked)}
        className={`shrink-0 w-10 h-5 rounded-full transition-colors relative mt-0.5 ${checked ? 'bg-ocean-700' : 'bg-n-300'}`}>
        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   TAB 1 — CONTA
───────────────────────────────────────────────────────── */
const TIMEZONES = ['Atlantic/Cape_Verde', 'Europe/Lisbon', 'Europe/London', 'America/New_York', 'America/Sao_Paulo'];
const CURRENCIES = ['CVE', 'EUR', 'USD', 'GBP'];
const LANGS      = ['pt', 'en', 'de', 'nl', 'fr', 'es'];

function ContaTab({ operator, onSaved }) {
  const { setOperator } = useAuthStore();
  const [form, setForm] = useState({
    name:      operator?.name      || '',
    email:     operator?.email     || '',
    phone:     operator?.phone     || '',
    whatsapp:  operator?.whatsapp  || '',
    address:   operator?.address   || '',
    language:  operator?.language  || 'pt',
    currency:  operator?.currency  || 'CVE',
    timezone:  operator?.timezone  || 'Atlantic/Cape_Verde',
  });
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState('');
  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      const updated = await updateOperator(form);
      setOperator(updated);
      setSaved(true); setTimeout(() => setSaved(false), 3000);
      onSaved?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao guardar');
    } finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
      <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Dados da empresa</h3>}>
        <div className="space-y-4">
          <Input label="Nome da empresa" value={form.name} onChange={set('name')} required />
          <Input label="Email" type="email" value={form.email} onChange={set('email')} required />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Telefone" type="tel" value={form.phone} onChange={set('phone')} placeholder="+238 900 0000" />
            <Input label="WhatsApp" type="tel" value={form.whatsapp} onChange={set('whatsapp')} placeholder="+238 900 0000" />
          </div>
          <Input label="Morada" value={form.address} onChange={set('address')} placeholder="Rua, localidade" />
        </div>
      </Card>

      <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Preferencias</h3>}>
        <div className="grid grid-cols-3 gap-3">
          <Select label="Idioma" value={form.language} onChange={set('language')}>
            {LANGS.map(l => <option key={l} value={l}>{l.toUpperCase()}</option>)}
          </Select>
          <Select label="Moeda" value={form.currency} onChange={set('currency')}>
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Select label="Fuso horario" value={form.timezone} onChange={set('timezone')}>
            {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz.replace('_', ' ')}</option>)}
          </Select>
        </div>
      </Card>

      {error && <p className="text-sm font-body px-3 py-2 rounded bg-red-50 text-error">{error}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" loading={saving}>Guardar alteracoes</Button>
        <SaveBanner saved={saved} />
      </div>
    </form>
  );
}

/* ─────────────────────────────────────────────────────────
   TAB 2 — PERFIL PUBLICO
───────────────────────────────────────────────────────── */
const WEEK_DAYS = [
  { key: 'seg', label: 'Segunda' }, { key: 'ter', label: 'Terca' },
  { key: 'qua', label: 'Quarta' },  { key: 'qui', label: 'Quinta' },
  { key: 'sex', label: 'Sexta' },   { key: 'sab', label: 'Sabado' },
  { key: 'dom', label: 'Domingo' },
];
const SPOKEN_LANGS = ['PT', 'EN', 'FR', 'ES', 'DE', 'NL', 'IT'];

function PerfilPublicoTab({ operator }) {
  const { setOperator } = useAuthStore();
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [logoPreview, setLogoPreview] = useState(operator?.logo_url || null);
  const [covers, setCovers]         = useState([]);
  const [descPt,  setDescPt]        = useState(operator?.description_pt || '');
  const [descEn,  setDescEn]        = useState(operator?.description_en || '');
  const [faqs, setFaqs] = useState(operator?.custom_faqs || []);
  const [social,  setSocial]        = useState({
    instagram:   operator?.social?.instagram   || '',
    facebook:    operator?.social?.facebook    || '',
    tripadvisor: operator?.social?.tripadvisor || '',
    google_maps: operator?.social?.google_maps || '',
    whatsapp:    operator?.social?.whatsapp    || '',
    linkedin:    operator?.social?.linkedin    || '',
  });
  const [hours, setHours] = useState(() =>
    WEEK_DAYS.reduce((acc, d) => ({
      ...acc,
      [d.key]: operator?.opening_hours?.[d.key] || { open: d.key !== 'dom', start: '09:00', end: '18:00' },
    }), {})
  );
  const [spokenLangs, setSpokenLangs] = useState(operator?.spoken_languages || ['PT', 'EN']);
  const [lat, setLat] = useState(operator?.lat || '16.8948');
  const [lng, setLng] = useState(operator?.lng || '-22.9144');

  /* marketing — loaded separately */
  const [bookingLink, setBookingLink] = useState('');
  const [widget,      setWidget]      = useState('');
  const apiBase   = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1').replace('/api/v1', '');
  const qrcodeUrl = operator?.booking_link_slug || operator?.slug ? `${apiBase}/api/v1/public/${operator.booking_link_slug || operator.slug}/qrcode` : null;

  const logoRef  = useRef(null);
  const coverRef = useRef(null);

  useEffect(() => {
    api.get('/marketing/booking-link').then(r => setBookingLink(r.data?.data?.url || '')).catch(() => {});
    api.get('/marketing/widget-code').then(r => setWidget(r.data?.data?.html || '')).catch(() => {});
  }, []);

  function handleLogo(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result);
    reader.readAsDataURL(file);
  }

  function handleCovers(e) {
    [...e.target.files].forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => setCovers(p => [...p, { id: Date.now() + Math.random(), preview: reader.result }]);
      reader.readAsDataURL(file);
    });
  }

  function moveCover(idx, dir) {
    setCovers(p => {
      const arr = [...p];
      const [item] = arr.splice(idx, 1);
      arr.splice(idx + dir, 0, item);
      return arr;
    });
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

  function toggleSpokenLang(l) {
    setSpokenLangs(p => p.includes(l) ? p.filter(x => x !== l) : [...p, l]);
  }

  function setHourField(day, field, value) {
    setHours(p => ({ ...p, [day]: { ...p[day], [field]: value } }));
  }

  async function handleSave(e) {
    e.preventDefault(); setSaving(true);
    try {
      const payload = {
        logo_url:       logoPreview,
        description_pt: descPt,
        description_en: descEn,
        social,
        opening_hours:  hours,
        spoken_languages: spokenLangs,
        lat: parseFloat(lat) || null,
        lng: parseFloat(lng) || null,
        custom_faqs: faqs.filter(f => f.question_pt || f.question_en),
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
            <input ref={logoRef} type="file" accept="image/*" onChange={handleLogo} className="hidden" />
            <p className="text-xs font-body text-n-400">PNG ou SVG · fundo transparente recomendado</p>
          </div>
        </div>
      </Card>

      {/* Cover photos */}
      <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Fotos de capa</h3>}>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3">
            {covers.map((c, i) => (
              <div key={c.id} className="relative w-28 h-20 rounded border border-n-200 overflow-hidden group">
                <img src={c.preview} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-ocean-900/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                  {i > 0 && (
                    <button type="button" onClick={() => moveCover(i, -1)}
                      className="w-6 h-6 bg-white/90 rounded flex items-center justify-center">
                      <ChevronUp size={12} strokeWidth={2} />
                    </button>
                  )}
                  {i < covers.length - 1 && (
                    <button type="button" onClick={() => moveCover(i, 1)}
                      className="w-6 h-6 bg-white/90 rounded flex items-center justify-center">
                      <ChevronDown size={12} strokeWidth={2} />
                    </button>
                  )}
                  <button type="button" onClick={() => setCovers(p => p.filter((_, j) => j !== i))}
                    className="w-6 h-6 bg-error/90 rounded flex items-center justify-center">
                    <X size={11} strokeWidth={2} className="text-white" />
                  </button>
                </div>
                {i === 0 && (
                  <span className="absolute top-1 left-1 bg-ocean-700 text-white text-xs font-mono px-1.5 py-0.5 rounded">
                    Capa
                  </span>
                )}
              </div>
            ))}
            <button type="button" onClick={() => coverRef.current?.click()}
              className="w-28 h-20 rounded border-2 border-dashed border-n-200 bg-n-50 flex flex-col items-center justify-center gap-1 text-n-400 hover:border-ocean-300 hover:text-ocean-700 transition-colors">
              <Plus size={18} strokeWidth={1.75} />
              <span className="text-xs font-body">Adicionar</span>
            </button>
            <input ref={coverRef} type="file" accept="image/*" multiple onChange={handleCovers} className="hidden" />
          </div>
          <p className="text-xs font-body text-n-400">A primeira foto e a capa principal · arrastar para reordenar</p>
        </div>
      </Card>

      {/* Description */}
      <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Descricao</h3>}>
        <div className="space-y-3">
          <Textarea label="Portugues" value={descPt} onChange={e => setDescPt(e.target.value)}
            rows={4} placeholder="Descricao do operador em portugues..." />
          <Textarea label="Ingles (EN)" value={descEn} onChange={e => setDescEn(e.target.value)}
            rows={4} placeholder="Operator description in English..." />
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
                  <button type="button" onClick={() => moveFaq(i, -1)} disabled={i === 0}
                    className="w-6 h-6 flex items-center justify-center rounded bg-n-100 text-n-500 disabled:opacity-30">
                    <ChevronUp size={12} strokeWidth={2} />
                  </button>
                  <button type="button" onClick={() => moveFaq(i, 1)} disabled={i === faqs.length - 1}
                    className="w-6 h-6 flex items-center justify-center rounded bg-n-100 text-n-500 disabled:opacity-30">
                    <ChevronDown size={12} strokeWidth={2} />
                  </button>
                  <button type="button" onClick={() => removeFaq(i)}
                    className="w-6 h-6 flex items-center justify-center rounded bg-error/10 text-error">
                    <X size={12} strokeWidth={2} />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input label="Pergunta PT" value={f.question_pt} onChange={e => updateFaq(i, 'question_pt', e.target.value)} />
                <Input label="Pergunta EN" value={f.question_en} onChange={e => updateFaq(i, 'question_en', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Textarea label="Resposta PT" rows={2} value={f.answer_pt} onChange={e => updateFaq(i, 'answer_pt', e.target.value)} />
                <Textarea label="Resposta EN" rows={2} value={f.answer_en} onChange={e => updateFaq(i, 'answer_en', e.target.value)} />
              </div>
            </div>
          ))}
          <Button type="button" variant="secondary" icon={Plus} size="sm" onClick={addFaq}>
            Adicionar pergunta
          </Button>
        </div>
      </Card>

      {/* Social */}
      <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Redes sociais</h3>}>
        <div className="space-y-3">
          {[
            { key: 'instagram',   label: 'Instagram',            icon: ExternalLink, ph: 'https://instagram.com/...',           preview: true  },
            { key: 'facebook',    label: 'Facebook',             icon: Share2,       ph: 'https://facebook.com/...',            preview: true  },
            { key: 'tripadvisor', label: 'TripAdvisor',          icon: Globe,        ph: 'https://tripadvisor.com/...',         preview: true  },
            { key: 'google_maps', label: 'Google Maps',          icon: Globe,        ph: 'https://maps.app.goo.gl/...',         preview: true  },
            { key: 'whatsapp',    label: 'WhatsApp Business',    icon: Phone,        ph: '+238 900 0000',                       preview: false },
            { key: 'linkedin',    label: 'LinkedIn (opcional)',   icon: ExternalLink, ph: 'https://linkedin.com/company/...',    preview: true  },
          ].map(({ key, label, icon: Icon, ph, preview }) => (
            <div key={key} className="flex items-start gap-2">
              <Icon size={16} strokeWidth={1.75} className="text-n-400 shrink-0 mt-7" />
              <div className="flex-1">
                <Input label={label} value={social[key]} placeholder={ph}
                  onChange={e => setSocial(p => ({ ...p, [key]: e.target.value }))} />
              </div>
              {preview && social[key] && (
                <a
                  href={social[key].startsWith('http') ? social[key] : `https://${social[key]}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Abrir ${label}`}
                  className="mt-6 w-9 h-9 flex items-center justify-center border border-n-200 rounded-sm bg-n-50 text-ocean-700 hover:bg-ocean-50 hover:border-ocean-300 transition-colors shrink-0"
                >
                  <ExternalLink size={14} strokeWidth={1.75} />
                </a>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Opening hours */}
      <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Horario de funcionamento</h3>}>
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
                  <span className="text-xs text-n-400">ate</span>
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

      {/* Spoken languages + location */}
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

      <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Localizacao (coordenadas GPS)</h3>}>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Latitude" value={lat} onChange={e => setLat(e.target.value)} placeholder="16.8948" />
          <Input label="Longitude" value={lng} onChange={e => setLng(e.target.value)} placeholder="-22.9144" />
        </div>
        <p className="text-xs font-body text-n-400 mt-2">
          Encontrar coordenadas em <strong>maps.google.com</strong> → clique direito → "What's here?"
        </p>
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

      <div className="flex items-center gap-3">
        <Button type="submit" loading={saving}>Guardar perfil</Button>
        <SaveBanner saved={saved} />
      </div>
    </form>
  );
}

/* ─────────────────────────────────────────────────────────
   TAB 3 — PAGAMENTOS
───────────────────────────────────────────────────────── */
function PagamentosTab() {
  const [settings, setSettings]     = useState(null);
  const [form, setForm]             = useState({ paypal_client_id: '', paypal_client_secret: '', sisp_merchant_id: '', sisp_api_key: '' });
  const [saving,  setSaving]        = useState(false);
  const [saved,   setSaved]         = useState(false);
  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));

  useEffect(() => {
    api.get('/marketing/payment-settings').then(r => setSettings(r.data?.data)).catch(() => {});
  }, []);

  async function handleSave(e) {
    e.preventDefault(); setSaving(true);
    try {
      const body = {};
      if (form.paypal_client_id)     body.paypal_client_id     = form.paypal_client_id;
      if (form.paypal_client_secret) body.paypal_client_secret = form.paypal_client_secret;
      if (form.sisp_merchant_id)     body.sisp_merchant_id     = form.sisp_merchant_id;
      if (form.sisp_api_key)         body.sisp_api_key         = form.sisp_api_key;
      await api.put('/marketing/payment-settings', body);
      const r = await api.get('/marketing/payment-settings');
      setSettings(r.data?.data);
      setForm({ paypal_client_id: '', paypal_client_secret: '', sisp_merchant_id: '', sisp_api_key: '' });
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } finally { setSaving(false); }
  }

  function StatusBadge({ active, label }) {
    return (
      <div className={`flex items-center gap-2 px-4 py-3 rounded border text-sm font-body ${active ? 'bg-green-50 border-green-200 text-green-700' : 'bg-n-50 border-n-200 text-n-500'}`}>
        {active ? <CheckCircle2 size={14} strokeWidth={1.75} /> : <XCircle size={14} strokeWidth={1.75} />}
        <div>
          <p className="font-semibold">{label}</p>
          <p className="text-xs mt-0.5">{active ? 'Configurado' : 'Nao configurado'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-2xl">
      {settings && (
        <div className="grid grid-cols-2 gap-3">
          <StatusBadge active={settings.has_paypal} label="PayPal" />
          <StatusBadge active={settings.has_sisp}   label="SISP Vinti4" />
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        <Card header={<h3 className="font-display font-semibold text-sm text-n-700">PayPal</h3>}>
          <div className="space-y-3">
            <p className="text-xs font-body text-n-500">
              Credenciais em <strong>developer.paypal.com</strong> → My Apps &amp; Credentials
            </p>
            <Input label="Client ID" type="password" value={form.paypal_client_id} onChange={set('paypal_client_id')}
              placeholder={settings?.paypal_client_id ? '••••••••••••' : 'AaBbCc...'} />
            <Input label="Client Secret" type="password" value={form.paypal_client_secret} onChange={set('paypal_client_secret')}
              placeholder="EeFfGg..." />
          </div>
        </Card>

        <Card header={<h3 className="font-display font-semibold text-sm text-n-700">SISP Vinti4</h3>}>
          <div className="space-y-3">
            <p className="text-xs font-body text-n-500">
              Credenciais fornecidas pela SISP apos contrato formal. Iniciar processo em <strong>sisp.cv</strong> (2-6 semanas).
            </p>
            <Input label="Merchant ID" type="password" value={form.sisp_merchant_id} onChange={set('sisp_merchant_id')}
              placeholder={settings?.sisp_merchant_id ? '••••••••••••' : 'MID...'} />
            <Input label="API Key" type="password" value={form.sisp_api_key} onChange={set('sisp_api_key')}
              placeholder="KEY..." />
          </div>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" loading={saving} icon={CreditCard}>Guardar credenciais</Button>
          <SaveBanner saved={saved} />
        </div>
      </form>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   TAB 4 — NOTIFICACOES
───────────────────────────────────────────────────────── */
const NOTIF_ITEMS = [
  { key: 'new_booking',       label: 'Nova reserva',             hint: 'Alertar imediatamente quando uma nova reserva for criada' },
  { key: 'cancellation',      label: 'Cancelamento',             hint: 'Notificar quando uma reserva for cancelada' },
  { key: 'payment_confirmed', label: 'Pagamento confirmado',     hint: 'Confirmacao de pagamento online recebido' },
  { key: 'review_received',   label: 'Nova avaliacao',           hint: 'Quando um cliente submete uma avaliacao' },
  { key: 'new_message',       label: 'Mensagem interna',         hint: 'Mensagem de um colaborador no chat interno' },
  { key: 'checkin_reminder',  label: 'Lembrete de check-in',     hint: 'Lembrete 24h antes do check-in do cliente' },
];

function NotificacoesTab() {
  const { operator, setOperator } = useAuthStore();
  const [prefs, setPrefs] = useState(() => ({
    new_booking:       true,
    cancellation:      true,
    payment_confirmed: true,
    review_received:   true,
    new_message:       true,
    checkin_reminder:  false,
    ...operator?.notification_prefs,
  }));
  const [channel, setChannel] = useState(operator?.notif_channel || 'both');
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);

  async function handleSave(e) {
    e.preventDefault(); setSaving(true);
    try {
      const updated = await updateOperator({ notification_prefs: prefs, notif_channel: channel });
      setOperator(updated);
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSave} className="space-y-5 max-w-2xl">
      <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Canal de notificacoes</h3>}>
        <div className="grid grid-cols-3 gap-2">
          {[['email', 'Email'], ['push', 'Push (PWA)'], ['both', 'Ambos']].map(([v, l]) => (
            <label key={v} className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded border cursor-pointer text-sm font-body transition-colors ${channel === v ? 'bg-ocean-700 text-white border-ocean-700' : 'bg-n-50 text-n-700 border-n-200 hover:border-n-300'}`}>
              <input type="radio" value={v} checked={channel === v} onChange={() => setChannel(v)} className="hidden" />
              {l}
            </label>
          ))}
        </div>
      </Card>

      <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Tipos de notificacao</h3>}>
        <div>
          {NOTIF_ITEMS.map(item => (
            <Toggle key={item.key} checked={prefs[item.key]} onChange={v => setPrefs(p => ({ ...p, [item.key]: v }))}
              label={item.label} hint={item.hint} />
          ))}
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" loading={saving}>Guardar preferencias</Button>
        <SaveBanner saved={saved} />
      </div>
    </form>
  );
}

/* ─────────────────────────────────────────────────────────
   TAB 5 — INTEGRACOES
───────────────────────────────────────────────────────── */
function IntegracoesTab() {
  const [status,   setStatus]   = useState(null);
  const [syncing,  setSyncing]  = useState('');
  const [syncMsg,  setSyncMsg]  = useState('');
  const [connect,  setConnect]  = useState(null); // { channel, apiKey, supplierId }

  useEffect(() => {
    getStatus().then(setStatus).catch(() => {});
  }, []);

  async function handleSync(channel) {
    setSyncing(channel); setSyncMsg('');
    try {
      await syncManual(channel);
      setSyncMsg(`${channel} sincronizado com sucesso`);
      setTimeout(() => setSyncMsg(''), 3000);
      const s = await getStatus();
      setStatus(s);
    } catch (err) {
      setSyncMsg(`Erro ao sincronizar: ${err.response?.data?.error || 'tente de novo'}`);
    } finally { setSyncing(''); }
  }

  async function handleConnect(e) {
    e.preventDefault();
    try {
      await connectChannel(connect.channel, { api_key: connect.apiKey, supplier_id: connect.supplierId });
      const s = await getStatus();
      setStatus(s);
      setConnect(null);
    } catch (err) { console.error(err); }
  }

  async function handleDisconnect(channel) {
    try {
      await disconnectChannel(channel);
      const s = await getStatus();
      setStatus(s);
    } catch (err) { console.error(err); }
  }

  const CHANNELS = [
    { key: 'viator',       label: 'Viator',        color: '#00A680', desc: 'Synchronize bookings from Viator / TripAdvisor Experiences.' },
    { key: 'getyourguide', label: 'GetYourGuide',  color: '#FF5533', desc: 'Synchronize bookings from GetYourGuide.' },
  ];

  return (
    <div className="space-y-4 max-w-2xl">
      {syncMsg && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded border text-sm font-body ${syncMsg.startsWith('Erro') ? 'bg-red-50 border-red-200 text-error' : 'bg-green-50 border-green-200 text-green-700'}`}>
          {syncMsg.startsWith('Erro') ? <AlertCircle size={14} strokeWidth={1.75} /> : <CheckCircle2 size={14} strokeWidth={1.75} />}
          {syncMsg}
        </div>
      )}

      {CHANNELS.map(ch => {
        const chStatus = status?.[ch.key];
        const isActive = chStatus?.is_active;
        return (
          <Card key={ch.key}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded border border-n-200 bg-n-50 flex items-center justify-center">
                  <Link2 size={18} strokeWidth={1.75} className="text-n-400" />
                </div>
                <div>
                  <p className="font-display font-semibold text-sm text-n-900">{ch.label}</p>
                  <p className="text-xs font-body text-n-500">{ch.desc}</p>
                  {isActive && chStatus.last_sync_at && (
                    <p className="text-xs font-mono text-n-400 mt-0.5">
                      Ultima sync: {new Date(chStatus.last_sync_at).toLocaleString('pt-PT')}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isActive ? (
                  <>
                    <span className="flex items-center gap-1 text-xs font-body text-green-700">
                      <Wifi size={12} strokeWidth={1.75} />
                      Ligado
                    </span>
                    <Button size="sm" variant="secondary" icon={RefreshCw}
                      loading={syncing === ch.key} onClick={() => handleSync(ch.key)}>
                      Sync
                    </Button>
                    <Button size="sm" variant="secondary"
                      onClick={() => handleDisconnect(ch.key)}>
                      Desligar
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex items-center gap-1 text-xs font-body text-n-400">
                      <WifiOff size={12} strokeWidth={1.75} />
                      Desligado
                    </span>
                    <Button size="sm" icon={Plus}
                      onClick={() => setConnect({ channel: ch.key, apiKey: '', supplierId: '' })}>
                      Ligar
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>
        );
      })}

      <Card>
        <div className="flex items-center gap-3 text-n-500">
          <AlertCircle size={16} strokeWidth={1.75} />
          <p className="text-xs font-body">
            Viator e GetYourGuide requerem conta de parceiro activa. As reservas externas sao sincronizadas automaticamente via webhook.
          </p>
        </div>
      </Card>

      {/* Connect modal */}
      <Modal open={!!connect} onClose={() => setConnect(null)} title={`Ligar ${connect?.channel}`} size="sm">
        {connect && (
          <form onSubmit={handleConnect} className="space-y-4">
            <Input label="API Key" value={connect.apiKey} required
              onChange={e => setConnect(p => ({ ...p, apiKey: e.target.value }))}
              placeholder="Chave de API do parceiro" />
            <Input label="Supplier / Partner ID" value={connect.supplierId}
              onChange={e => setConnect(p => ({ ...p, supplierId: e.target.value }))}
              placeholder="ID de parceiro (opcional)" />
            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={() => setConnect(null)} className="flex-1">Cancelar</Button>
              <Button type="submit" className="flex-1">Ligar</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   TAB 6 — SEGURANCA
───────────────────────────────────────────────────────── */
function SegurancaTab() {
  const { user } = useAuthStore();

  /* ── Password change ── */
  const [pwForm,   setPwForm]  = useState({ current: '', newPw: '', confirm: '' });
  const [pwSaving, setPwSave]  = useState(false);
  const [pwSaved,  setPwSaved] = useState(false);
  const [pwError,  setPwError] = useState('');
  const [showPw,   setShowPw]  = useState({ current: false, newPw: false, confirm: false });

  async function handlePwChange(e) {
    e.preventDefault(); setPwError('');
    if (getPasswordStrength(pwForm.newPw) < 2) {
      setPwError('A password deve ser forte: 8+ caracteres, maiuscula, numero e especial.');
      return;
    }
    if (pwForm.newPw !== pwForm.confirm) { setPwError('As passwords nao coincidem.'); return; }
    setPwSave(true);
    try {
      await changePassword(pwForm.newPw);
      setPwForm({ current: '', newPw: '', confirm: '' });
      setPwSaved(true); setTimeout(() => setPwSaved(false), 3000);
    } catch (err) {
      setPwError(err.response?.data?.error || 'Erro ao alterar password.');
    } finally { setPwSave(false); }
  }

  /* ── 2FA ── */
  const twoFaEnabled2FAKey = `saldesk_2fa_${user?.id}`;
  const [twoFaEnabled, setTwoFaEnabled] = useState(() => {
    try { return JSON.parse(localStorage.getItem(twoFaEnabled2FAKey) || 'false'); } catch { return false; }
  });
  const [twoFaModal,  setTwoFaModal]  = useState(false);
  const [twoFaCode,   setTwoFaCode]   = useState('');
  const [twoFaSaving, setTwoFaSaving] = useState(false);
  const [twoFaError,  setTwoFaError]  = useState('');
  const [twoFaSent,   setTwoFaSent]   = useState(false);
  const [resendCount, setResendCount] = useState(0);

  async function handleToggle2FA() {
    if (twoFaEnabled) {
      setTwoFaEnabled(false);
      localStorage.setItem(twoFaEnabled2FAKey, 'false');
      try { await toggleTwoFactor(false); } catch {}
      return;
    }
    /* Activating — send test code */
    setTwoFaSaving(true); setTwoFaError('');
    try {
      await sendTwoFactor(user?.email || '');
      setTwoFaSent(true);
      setTwoFaModal(true);
    } catch {
      setTwoFaError('Nao foi possivel enviar o codigo. Verifica o email configurado.');
    } finally { setTwoFaSaving(false); }
  }

  async function handleVerify2FA(e) {
    e.preventDefault(); setTwoFaError('');
    if (twoFaCode.length !== 6) { setTwoFaError('Introduce os 6 digitos do codigo.'); return; }
    setTwoFaSaving(true);
    try {
      await verifyTwoFactor(user?.email || '', twoFaCode);
      await toggleTwoFactor(true);
      setTwoFaEnabled(true);
      localStorage.setItem(twoFaEnabled2FAKey, 'true');
      setTwoFaModal(false); setTwoFaCode('');
    } catch {
      setTwoFaError('Codigo incorrecto ou expirado.');
    } finally { setTwoFaSaving(false); }
  }

  async function handleResend2FA() {
    try { await sendTwoFactor(user?.email || ''); setResendCount(c => c + 1); } catch {}
  }

  /* ── Sessions ── */
  const [sessions,    setSessions]    = useState([]);
  const [loadSessions, setLoadSess]   = useState(false);
  const [sesLoaded,   setSesLoaded]   = useState(false);

  async function loadSessionsData() {
    setLoadSess(true);
    try { setSessions(await getLoginHistory()); setSesLoaded(true); }
    catch { setSessions([]); } finally { setLoadSess(false); }
  }

  function fmtDevice(ua) {
    if (!ua) return 'Dispositivo desconhecido';
    if (/Mobile|Android|iPhone/i.test(ua)) return 'Dispositivo movel';
    if (/Mac/i.test(ua)) return 'Mac';
    if (/Windows/i.test(ua)) return 'Windows';
    return 'Desktop';
  }

  function fmtBrowser(ua) {
    if (!ua) return '—';
    if (/Chrome/i.test(ua) && !/Edge/i.test(ua)) return 'Chrome';
    if (/Firefox/i.test(ua)) return 'Firefox';
    if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) return 'Safari';
    if (/Edge/i.test(ua)) return 'Edge';
    return 'Browser';
  }

  function fmtTS(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleString('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  async function handleTerminateAll() {
    if (!window.confirm('Terminar todas as sessoes activas? Seras desligado de todos os dispositivos.')) return;
    await terminateAllSessions();
    setSessions([]);
  }

  return (
    <div className="space-y-5 max-w-2xl">
      {/* ── Alterar password ── */}
      <form onSubmit={handlePwChange}>
        <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Alterar password</h3>}>
          <div className="space-y-3">
            {[
              { field: 'current', label: 'Password actual',          ac: 'current-password' },
              { field: 'newPw',   label: 'Nova password',            ac: 'new-password'     },
              { field: 'confirm', label: 'Confirmar nova password',  ac: 'new-password'     },
            ].map(({ field, label, ac }) => (
              <div key={field} className="flex flex-col gap-1">
                <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600">{label}</label>
                <div className="relative">
                  <input
                    type={showPw[field] ? 'text' : 'password'}
                    value={pwForm[field]}
                    onChange={e => setPwForm(p => ({ ...p, [field]: e.target.value }))}
                    required autoComplete={ac}
                    className="w-full h-9 px-3 pr-10 rounded-sm border border-n-300 text-sm font-body bg-n-100 text-n-900 placeholder:text-n-400 focus:outline-none focus:ring-2 focus:ring-ocean-300 focus:border-ocean-700 focus:bg-white transition-colors"
                  />
                  <button type="button"
                    onClick={() => setShowPw(p => ({ ...p, [field]: !p[field] }))}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-n-400 hover:text-n-600 transition-colors">
                    {showPw[field] ? <EyeOff size={14} strokeWidth={1.75} /> : <Eye size={14} strokeWidth={1.75} />}
                  </button>
                </div>
                {field === 'newPw' && pwForm.newPw && <PasswordStrength password={pwForm.newPw} />}
                {field === 'confirm' && pwForm.confirm && pwForm.newPw !== pwForm.confirm && (
                  <p className="text-xs text-error">As passwords nao coincidem.</p>
                )}
              </div>
            ))}
            {pwError && <p className="text-sm font-body px-3 py-2 rounded bg-red-50 text-error">{pwError}</p>}
            <div className="flex items-center gap-3 pt-1">
              <Button type="submit" loading={pwSaving} icon={Lock}>Alterar password</Button>
              <SaveBanner saved={pwSaved} />
            </div>
          </div>
        </Card>
      </form>

      {/* ── 2FA ── */}
      <Card header={
        <div className="flex items-center justify-between">
          <h3 className="font-display font-semibold text-sm text-n-700">Autenticacao de dois factores</h3>
          <button onClick={handleToggle2FA} disabled={twoFaSaving}
            className={`flex items-center gap-1.5 text-xs font-body font-semibold px-3 py-1.5 rounded-sm border transition-colors ${
              twoFaEnabled
                ? 'bg-[#ECFDF5] text-[#1A7A4A] border-green-200 hover:bg-green-100'
                : 'bg-n-100 text-n-600 border-n-200 hover:bg-n-200'
            }`}>
            {twoFaEnabled
              ? <ToggleRight size={14} strokeWidth={1.75} />
              : <ToggleLeft  size={14} strokeWidth={1.75} />}
            {twoFaEnabled ? 'Activo' : 'Inactivo'}
          </button>
        </div>
      }>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <Shield size={16} strokeWidth={1.75} className="text-ocean-700 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-body text-n-700">
                {twoFaEnabled
                  ? 'A autenticacao de dois factores esta activa. Cada login requer um codigo enviado por email.'
                  : 'Activa a verificacao em dois passos para proteger a tua conta com um codigo por email.'}
              </p>
              <p className="text-xs font-body text-n-500 mt-1">
                Metodo: codigo por email · Validade: 10 minutos
              </p>
            </div>
          </div>
          {twoFaError && <p className="text-xs text-error px-3 py-2 bg-red-50 rounded">{twoFaError}</p>}
        </div>
      </Card>

      {/* 2FA verification modal */}
      {twoFaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ocean-900/60 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="font-display font-bold text-sm text-n-900">Confirmar activacao do 2FA</p>
              <button onClick={() => setTwoFaModal(false)} className="p-1 text-n-400 hover:text-n-600">
                <X size={18} strokeWidth={1.75} />
              </button>
            </div>
            <p className="text-xs font-body text-n-500 mb-4">
              Enviamos um codigo de 6 digitos para <span className="font-semibold">{user?.email}</span>.
              Introduz-o abaixo para confirmar a activacao.
            </p>
            <form onSubmit={handleVerify2FA} className="space-y-4">
              <div>
                <input
                  type="text" inputMode="numeric" maxLength={6}
                  value={twoFaCode}
                  onChange={e => setTwoFaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full h-12 text-center font-mono font-bold text-2xl tracking-widest rounded-lg border-2 border-n-200 focus:outline-none focus:border-ocean-700 bg-n-50"
                />
                {twoFaError && <p className="text-xs text-error mt-1">{twoFaError}</p>}
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setTwoFaModal(false)} type="button" className="flex-1">Cancelar</Button>
                <Button type="submit" loading={twoFaSaving} className="flex-1">Confirmar</Button>
              </div>
              <button type="button" onClick={handleResend2FA}
                className="w-full text-xs font-body text-ocean-700 hover:underline">
                Reenviar codigo {resendCount > 0 ? `(${resendCount})` : ''}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Sessoes activas ── */}
      <Card header={
        <div className="flex items-center justify-between">
          <h3 className="font-display font-semibold text-sm text-n-700">Historico de acessos</h3>
          {!sesLoaded && (
            <Button variant="secondary" size="sm" icon={RefreshCw} onClick={loadSessionsData} loading={loadSessions}>
              Carregar
            </Button>
          )}
          {sesLoaded && sessions.length > 0 && (
            <Button variant="secondary" size="sm" icon={Trash2} onClick={handleTerminateAll}
              className="text-error border-red-200 hover:bg-red-50">
              Terminar todas
            </Button>
          )}
        </div>
      }>
        {!sesLoaded ? (
          <p className="text-xs font-body text-n-400">
            Clica em "Carregar" para ver os ultimos acessos e gerir sessoes activas.
          </p>
        ) : sessions.length === 0 ? (
          <p className="text-xs font-body text-n-400">Sem historico de acessos disponivel.</p>
        ) : (
          <div className="space-y-2">
            {sessions.slice(0, 10).map((s, i) => {
              const isRecent = i === 0;
              const isSuspect = s.status === 'failed' || s.status === 'blocked';
              return (
                <div key={s.id || i}
                  className={`flex items-start gap-3 px-3 py-2.5 rounded-sm border transition-colors ${
                    isSuspect ? 'bg-red-50 border-red-100' : isRecent ? 'bg-ocean-50 border-ocean-100' : 'bg-n-50 border-n-100'
                  }`}>
                  <Monitor size={15} strokeWidth={1.75} className={`shrink-0 mt-0.5 ${isSuspect ? 'text-error' : 'text-n-500'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-body font-semibold text-n-700">
                        {fmtDevice(s.user_agent)} · {fmtBrowser(s.user_agent)}
                      </p>
                      {isRecent && !isSuspect && (
                        <span className="text-[9px] font-mono text-ocean-700 bg-ocean-100 px-1 py-0.5 rounded-xs">ACTUAL</span>
                      )}
                      {isSuspect && (
                        <span className="text-[9px] font-mono text-error bg-red-100 px-1 py-0.5 rounded-xs flex items-center gap-0.5">
                          <AlertTriangle size={8} strokeWidth={2} />SUSPEITO
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[10px] font-mono text-n-400 flex items-center gap-1">
                        <Clock size={9} strokeWidth={1.75} />{fmtTS(s.created_at)}
                      </span>
                      {s.ip_address && (
                        <span className="text-[10px] font-mono text-n-400">{s.ip_address}</span>
                      )}
                      {s.location && (
                        <span className="text-[10px] font-body text-n-400">{s.location}</span>
                      )}
                    </div>
                  </div>
                  {!isRecent && s.id && (
                    <button
                      onClick={() => { terminateSession(s.id); setSessions(p => p.filter(x => x.id !== s.id)); }}
                      className="p-1 text-n-400 hover:text-error transition-colors shrink-0">
                      <X size={13} strokeWidth={1.75} />
                    </button>
                  )}
                </div>
              );
            })}
            <p className="text-[10px] font-mono text-n-400 text-right">
              A mostrar ultimos {Math.min(10, sessions.length)} acessos
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   MAIN
───────────────────────────────────────────────────────── */
const TABS = [
  { id: 'conta',      label: 'Conta',          Icon: User },
  { id: 'perfil',     label: 'Perfil Publico', Icon: Globe },
  { id: 'pagamentos', label: 'Pagamentos',      Icon: CreditCard },
  { id: 'notificacoes', label: 'Notificacoes', Icon: Bell },
  { id: 'integracoes',  label: 'Integracoes',  Icon: Link2 },
  { id: 'seguranca',    label: 'Seguranca',    Icon: Shield },
];

export default function Settings() {
  const { operator } = useAuthStore();
  const [tab, setTab] = useState('conta');

  return (
    <div>
      <PageHeader title="Definicoes" />

      {/* Tab bar — horizontal scroll on mobile */}
      <div className="flex gap-0.5 mb-6 bg-n-100 p-1 rounded-md overflow-x-auto w-full">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-3 py-2 rounded text-sm font-display font-medium whitespace-nowrap transition-colors shrink-0 ${tab === id ? 'bg-white text-ocean-700 shadow-sm' : 'text-n-500 hover:text-n-700'}`}>
            <Icon size={14} strokeWidth={1.75} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'conta'        && <ContaTab       operator={operator} />}
      {tab === 'perfil'       && <PerfilPublicoTab operator={operator} />}
      {tab === 'pagamentos'   && <PagamentosTab />}
      {tab === 'notificacoes' && <NotificacoesTab />}
      {tab === 'integracoes'  && <IntegracoesTab />}
      {tab === 'seguranca'    && <SegurancaTab />}
    </div>
  );
}
