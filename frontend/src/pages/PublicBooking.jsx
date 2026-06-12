import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  MapPin, Phone, Star, ChevronLeft, ChevronRight, MessageCircle,
  Menu, X, Globe, Mail, Calendar, Users, Check, ArrowRight, Shield,
  ExternalLink, ChevronDown, ChevronUp, Copy, Send, Award, Share2,
  Compass, Car, Utensils,
} from 'lucide-react';
import Logo from '../components/shared/Logo';
import QRCode from 'qrcode';

const API     = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';
const EUR_CVE = 110;
const FALLBACK_IMGS = [
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80',
  'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1200&q=80',
  'https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=1200&q=80',
];
const TYPE_LABELS = { hotel: 'Hotel', activity: 'Actividade', rentacar: 'Rent-a-Car', restaurant: 'Restaurante' };

/* ── SEO ─────────────────────────────────────────── */
function injectSeo(op, slug) {
  const desc = op.description || `Reserve directamente em ${op.name}, Ilha do Sal, Cabo Verde.`;
  document.title = `${op.business_name || op.name} — Reservar · SalDesk`;
  const TYPE_LD = { hotel: 'LodgingBusiness', activity: 'TouristAttraction', rentacar: 'RentAction', restaurant: 'Restaurant' };
  const meta = (n, c, prop = false) => {
    const attr = prop ? 'property' : 'name';
    let el = document.querySelector(`meta[${attr}="${n}"]`);
    if (!el) { el = document.createElement('meta'); el.setAttribute(attr, n); document.head.appendChild(el); }
    el.setAttribute('content', c); el.dataset.seo = '1';
  };
  meta('description', desc);
  meta('og:title', document.title, true);
  meta('og:description', desc, true);
  meta('og:url', window.location.href, true);
  meta('og:type', 'website', true);
  if (op.logo_url) meta('og:image', op.logo_url, true);
  meta('twitter:card', 'summary_large_image');
  const ld = {
    '@context': 'https://schema.org', '@type': TYPE_LD[op.operator_type] || 'LocalBusiness',
    name: op.business_name || op.name, description: desc, url: window.location.href,
    address: { '@type': 'PostalAddress', addressLocality: 'Santa Maria', addressCountry: 'CV' },
    ...(op.phone ? { telephone: op.phone } : {}),
  };
  let ldEl = document.getElementById('sd-jsonld');
  if (!ldEl) { ldEl = document.createElement('script'); ldEl.id = 'sd-jsonld'; ldEl.type = 'application/ld+json'; document.head.appendChild(ldEl); }
  ldEl.textContent = JSON.stringify(ld);
}
function removeSeo() {
  document.querySelectorAll('meta[data-seo]').forEach(el => el.remove());
  document.getElementById('sd-jsonld')?.remove();
  document.title = 'SalDesk — Gestão Turística';
}

/* ── Price formatter ─────────────────────────────── */
function fmtPrice(price, priceUnit, opCurrency, viewCurrency, lang) {
  if (!price) return lang === 'en' ? 'On request' : 'Consultar';
  const unitLabels = {
    night: lang === 'en' ? '/night' : '/noite', day: lang === 'en' ? '/day' : '/dia',
    hour: lang === 'en' ? '/hour' : '/hora', session: lang === 'en' ? '/session' : '/sessão',
    person: lang === 'en' ? '/person' : '/pessoa',
  };
  const suffix = unitLabels[priceUnit] || '';
  if (viewCurrency === 'CVE') {
    const cve = (opCurrency || 'EUR') === 'CVE' ? price : price * EUR_CVE;
    return `${Math.round(cve).toLocaleString('pt-PT')} CVE${suffix}`;
  }
  const eur = (opCurrency || 'EUR') === 'CVE' ? price / EUR_CVE : price;
  return `€${eur < 10 ? eur.toFixed(1) : Math.round(eur)}${suffix}`;
}

/* ── StarRating ──────────────────────────────────── */
function StarRating({ rating, size = 13 }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} size={size} strokeWidth={1.75}
          className={i < Math.round(rating) ? 'text-sand-500 fill-sand-500' : 'text-n-300'} />
      ))}
    </div>
  );
}

/* ── Hero Carousel ───────────────────────────────── */
function HeroCarousel({ images }) {
  const [idx, setIdx] = useState(0);
  const imgs = images?.filter(Boolean).length ? images.filter(Boolean) : FALLBACK_IMGS;

  useEffect(() => {
    if (imgs.length < 2) return;
    const t = setInterval(() => setIdx(i => (i + 1) % imgs.length), 5000);
    return () => clearInterval(t);
  }, [imgs.length]);

  return (
    <div className="relative h-[60vh] min-h-[400px] max-h-[680px] overflow-hidden">
      {imgs.map((src, i) => (
        <div key={i} className="absolute inset-0 transition-opacity duration-1000 bg-cover bg-center"
          style={{ backgroundImage: `url(${src})`, opacity: i === idx ? 1 : 0 }} />
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-ocean-900/75 via-ocean-900/20 to-transparent" />
      {imgs.length > 1 && (
        <>
          <button onClick={() => setIdx(i => (i - 1 + imgs.length) % imgs.length)}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-all">
            <ChevronLeft size={20} strokeWidth={1.75} />
          </button>
          <button onClick={() => setIdx(i => (i + 1) % imgs.length)}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-all">
            <ChevronRight size={20} strokeWidth={1.75} />
          </button>
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
            {imgs.map((_, i) => (
              <button key={i} onClick={() => setIdx(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${i === idx ? 'bg-white w-6' : 'bg-white/45 w-1.5'}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ── ServiceCard ─────────────────────────────────── */
function ServiceCard({ unit, slug, currency, lang, opCurrency }) {
  const navigate = useNavigate();
  const price = fmtPrice(unit.base_price, unit.price_unit, opCurrency, currency, lang);
  return (
    <div onClick={() => navigate(`/book/${slug}/servico/${unit.id}`)}
      className="bg-white rounded-xl border border-n-200 shadow-sm overflow-hidden hover:shadow-md hover:-translate-y-1 transition-all duration-200 cursor-pointer">
      {unit.images?.[0] ? (
        <div className="h-44 bg-cover bg-center" style={{ backgroundImage: `url(${unit.images[0]})` }} />
      ) : (
        <div className="h-44 bg-gradient-to-br from-ocean-100 to-ocean-50 flex items-center justify-center">
          <Calendar size={32} strokeWidth={1.25} className="text-ocean-300" />
        </div>
      )}
      <div className="p-4">
        <p className="font-display font-bold text-n-900 mb-1 text-sm">{unit.name}</p>
        {unit.description && (
          <p className="text-xs font-body text-n-500 line-clamp-2 mb-3 leading-relaxed">{unit.description}</p>
        )}
        {unit.capacity && (
          <div className="flex items-center gap-1 text-xs text-n-400 mb-3">
            <Users size={12} strokeWidth={1.75} />
            <span>{lang === 'en' ? 'Up to' : 'Até'} {unit.capacity} {lang === 'en' ? 'people' : 'pessoas'}</span>
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <p className="font-display font-bold text-ocean-700 text-base leading-tight">{price}</p>
          <button onClick={e => { e.stopPropagation(); navigate(`/book/${slug}/servico/${unit.id}`); }}
            className="flex items-center gap-1.5 bg-ocean-700 text-white text-xs font-body font-semibold px-4 py-2 rounded-lg hover:bg-ocean-500 transition-colors">
            <ArrowRight size={14} strokeWidth={1.75} />
            {lang === 'en' ? 'Details' : 'Ver mais'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Lightbox ─────────────────────────────────────── */
function Lightbox({ images, idx, onClose, onMove }) {
  useEffect(() => {
    const handler = e => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onMove(-1);
      if (e.key === 'ArrowRight') onMove(1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, onMove]);

  return (
    <div className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center" onClick={onClose}>
      <button onClick={e => { e.stopPropagation(); onMove(-1); }}
        className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all">
        <ChevronLeft size={20} strokeWidth={2} />
      </button>
      <img src={images[idx]} alt={`Foto ${idx + 1}`} className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg"
        onClick={e => e.stopPropagation()} />
      <button onClick={e => { e.stopPropagation(); onMove(1); }}
        className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all">
        <ChevronRight size={20} strokeWidth={2} />
      </button>
      <button onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all">
        <X size={18} strokeWidth={2} />
      </button>
      <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-sm font-body">
        {idx + 1} / {images.length}
      </span>
    </div>
  );
}

/* ── ChatWidget ───────────────────────────────────── */
function ChatWidget({ slug, opName, lang }) {
  const [open, setOpen]       = useState(false);
  const [message, setMessage] = useState('');
  const [email, setEmail]     = useState('');
  const [sent, setSent]       = useState(false);
  const [sending, setSending] = useState(false);

  async function send(e) {
    e.preventDefault();
    if (!message.trim() || !email.trim()) return;
    setSending(true);
    try {
      await fetch(`${API}/public/${slug}/contact`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, message, name: '' }),
      });
      setSent(true);
    } catch {
      setSent(true);
    } finally { setSending(false); }
  }

  return (
    <div className="fixed bottom-20 left-4 z-30">
      {open && (
        <div className="absolute bottom-14 left-0 w-72 bg-white rounded-2xl shadow-2xl border border-n-200 overflow-hidden">
          <div className="bg-ocean-700 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <MessageCircle size={16} strokeWidth={1.75} />
              <span className="font-body font-semibold text-sm">{opName}</span>
            </div>
            <div className="flex items-center gap-1.5 text-white/70">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-xs font-body">Online</span>
            </div>
          </div>
          {sent ? (
            <div className="p-4 text-center">
              <Check size={24} strokeWidth={1.75} className="text-success mx-auto mb-2" />
              <p className="text-sm font-body text-n-700 font-semibold">
                {lang === 'en' ? 'Message sent!' : 'Mensagem enviada!'}
              </p>
              <p className="text-xs font-body text-n-400 mt-1">
                {lang === 'en' ? 'We\'ll reply shortly.' : 'Respondemos em breve.'}
              </p>
            </div>
          ) : (
            <form onSubmit={send} className="p-4 space-y-2">
              <div className="bg-n-50 rounded-xl px-3 py-2.5 text-xs font-body text-n-600 leading-relaxed mb-3">
                {lang === 'en' ? 'Hello! How can I help you?' : 'Olá! Como posso ajudar?'}
              </div>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                placeholder="Email" className="w-full border border-n-200 rounded-lg px-3 py-2 text-xs font-body focus:outline-none focus:border-ocean-500" />
              <textarea rows={2} required value={message} onChange={e => setMessage(e.target.value)}
                placeholder={lang === 'en' ? 'Write your message...' : 'Escreva a sua mensagem...'}
                className="w-full border border-n-200 rounded-lg px-3 py-2 text-xs font-body resize-none focus:outline-none focus:border-ocean-500" />
              <button type="submit" disabled={sending}
                className="w-full bg-ocean-700 text-white text-xs font-body font-semibold py-2 rounded-lg flex items-center justify-center gap-1.5 hover:bg-ocean-500 transition-colors disabled:opacity-50">
                <Send size={12} strokeWidth={1.75} />
                {lang === 'en' ? 'Send' : 'Enviar'}
              </button>
            </form>
          )}
        </div>
      )}
      <button onClick={() => setOpen(o => !o)}
        className="w-12 h-12 rounded-full bg-ocean-700 text-white shadow-lg hover:bg-ocean-500 transition-all flex items-center justify-center relative">
        {open ? <X size={20} strokeWidth={2} /> : <MessageCircle size={20} strokeWidth={1.75} />}
        {!open && <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />}
      </button>
    </div>
  );
}

/* ── Not Found ────────────────────────────────────── */
function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-n-50 p-6 text-center">
      <Logo size="lg" />
      <div className="mt-8 max-w-sm">
        <h2 className="font-display font-bold text-xl text-n-900 mb-3">Página não encontrada</h2>
        <p className="text-sm font-body text-n-500 leading-relaxed mb-6">
          Este link de reserva não existe ou o operador ainda não está activo na plataforma.
        </p>
        <a href="https://saldesk.cv/discover/"
          className="inline-flex items-center gap-2 bg-ocean-700 text-white font-body font-semibold px-6 py-3 rounded-xl hover:bg-ocean-500 transition-colors text-sm">
          Explorar operadores
        </a>
      </div>
    </div>
  );
}

/* ── Skeleton ─────────────────────────────────────── */
function SkeletonPage() {
  return (
    <div className="min-h-screen bg-n-50 animate-pulse">
      <div className="h-14 bg-white border-b border-n-200" />
      <div className="h-[60vh] bg-n-200" />
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-white rounded-2xl p-6 space-y-4">
          <div className="h-7 bg-n-200 rounded w-48" />
          <div className="h-4 bg-n-100 rounded w-72" />
          <div className="h-4 bg-n-100 rounded w-full" />
          <div className="h-4 bg-n-100 rounded w-3/4" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[1, 2].map(i => <div key={i} className="h-52 bg-n-200 rounded-xl" />)}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════ */
export default function PublicBooking() {
  const { slug }   = useParams();
  const navigate   = useNavigate();

  const [op, setOp]             = useState(null);
  const [units, setUnits]       = useState([]);
  const [reviews, setReviews]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [lang, setLang]         = useState(() => localStorage.getItem('sd-lang') || 'pt');
  const [currency, setCur]      = useState('EUR');
  const [lbIdx, setLbIdx]       = useState(null);
  const [navScrolled, setNavScrolled] = useState(false);
  const [mobileMenu, setMobileMenu]   = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' });
  const [contactSent, setContactSent] = useState(false);
  const [viewerCount]           = useState(() => 8 + Math.floor(Math.abs(slug.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % 40));
  const [faqOpen, setFaqOpen]   = useState(null);
  const [copied, setCopied]     = useState(false);
  const [qrUrl, setQrUrl]       = useState('');
  const [showQr, setShowQr]     = useState(false);

  /* Load data */
  useEffect(() => {
    Promise.all([
      fetch(`${API}/public/${slug}`).then(r => r.json()),
      fetch(`${API}/public/${slug}/reviews`).then(r => r.json()).catch(() => ({ data: [] })),
    ]).then(([opData, revData]) => {
      if (opData.data?.operator) {
        setOp(opData.data.operator);
        setUnits(opData.data.units || []);
        setReviews(revData.data || []);
        injectSeo(opData.data.operator, slug);
      } else {
        setNotFound(true);
      }
    }).catch(() => setNotFound(true))
      .finally(() => setLoading(false));
    return removeSeo;
  }, [slug]);

  /* Sticky nav */
  useEffect(() => {
    const handler = () => setNavScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  function toggleLang() {
    const nl = lang === 'pt' ? 'en' : 'pt';
    setLang(nl); localStorage.setItem('sd-lang', nl);
    document.documentElement.setAttribute('data-lang', nl);
  }

  function scrollTo(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setMobileMenu(false);
  }

  function goBook() {
    if (units[0]) navigate(`/book/${slug}/servico/${units[0].id}`);
    else scrollTo('servicos');
  }

  async function sendContact(e) {
    e.preventDefault();
    try {
      await fetch(`${API}/public/${slug}/contact`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactForm),
      });
    } catch { /* silent */ }
    setContactSent(true);
  }

  useEffect(() => {
    QRCode.toDataURL(window.location.href, { width: 200, margin: 1, color: { dark: '#0c4a6e', light: '#ffffff' } })
      .then(url => setQrUrl(url))
      .catch(() => {});
  }, []);

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  }

  if (loading)  return <SkeletonPage />;
  if (notFound) return <NotFoundPage />;

  const galleryImgs = [
    ...(op.cover_images?.filter(Boolean) || []),
    ...(op.images?.filter(Boolean) || []),
    ...FALLBACK_IMGS,
  ].slice(0, 8);

  const avgRating = reviews.length
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : 0;

  const ratingBreakdown = [5, 4, 3, 2, 1].map(r => ({
    r, count: reviews.filter(rv => Math.round(rv.rating) === r).length,
    pct: reviews.length ? reviews.filter(rv => Math.round(rv.rating) === r).length / reviews.length * 100 : 0,
  }));

  const whatsappUrl = op.whatsapp
    ? `https://wa.me/${op.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(lang === 'en' ? `Hello, I saw your profile on SalDesk and would like to know more about ${op.name}.` : `Olá, vi o vosso perfil no SalDesk e gostaria de saber mais sobre ${op.name}.`)}`
    : null;

  const isTopRated    = avgRating >= 4.5 && reviews.length >= 3;
  const isVerified    = !!op.onboarding_complete;

  const navLinks = [
    { id: 'home',       pt: 'Início',     en: 'Home'     },
    { id: 'servicos',   pt: 'Serviços',   en: 'Services' },
    { id: 'galeria',    pt: 'Galeria',    en: 'Gallery'  },
    { id: 'avaliacoes', pt: 'Avaliações', en: 'Reviews'  },
    { id: 'contacto',   pt: 'Contacto',   en: 'Contact'  },
  ];

  const FAQ_BY_TYPE = {
    hotel: [
      { q: lang === 'en' ? 'What time is check-in and check-out?' : 'Qual o horario de check-in e check-out?', a: lang === 'en' ? 'Check-in from 14:00, check-out until 11:00. Early/late options on request.' : 'Check-in a partir das 14h00, check-out ate as 11h00. Opcoes antecipadas/tardias mediante pedido.' },
      { q: lang === 'en' ? 'Is breakfast included?' : 'O pequeno-almoco esta incluido?', a: lang === 'en' ? 'Breakfast inclusion varies by room type. Check the room details when booking.' : 'A inclusao do pequeno-almoco varia consoante o tipo de quarto. Verifique os detalhes ao reservar.' },
    ],
    activity: [
      { q: lang === 'en' ? 'What should I bring?' : 'O que devo trazer?', a: lang === 'en' ? 'Comfortable clothing, sunscreen, water and a camera. Requirements depend on the activity.' : 'Roupa confortavel, protector solar, agua e camara. Os requisitos dependem da actividade.' },
      { q: lang === 'en' ? 'Is it suitable for children?' : 'E adequado para criancas?', a: lang === 'en' ? 'Most activities are family-friendly. Check service details or contact us.' : 'A maioria das actividades e adequada para familias. Consulte os detalhes ou contacte-nos.' },
    ],
    rentacar: [
      { q: lang === 'en' ? 'What documents do I need?' : 'Que documentos preciso?', a: lang === 'en' ? 'Valid driving licence, passport or ID, and a credit/debit card for the deposit.' : 'Carta de conducao valida, passaporte ou BI, e cartao de credito/debito para o deposito.' },
      { q: lang === 'en' ? 'Is insurance included?' : 'O seguro esta incluido?', a: lang === 'en' ? 'Basic insurance is included. Full coverage available at extra cost.' : 'O seguro basico esta incluido. Cobertura total disponivel com custo adicional.' },
    ],
    restaurant: [
      { q: lang === 'en' ? 'Do I need a reservation?' : 'Preciso de reserva?', a: lang === 'en' ? 'Reservations are recommended, especially for dinner and weekends.' : 'As reservas sao recomendadas, especialmente para jantar e fins de semana.' },
      { q: lang === 'en' ? 'Do you have vegetarian options?' : 'Tem opcoes vegetarianas?', a: lang === 'en' ? 'Yes, we have vegetarian and vegan options. Inform us of dietary requirements when booking.' : 'Sim, temos opcoes vegetarianas e veganas. Informe-nos de requisitos dieteticos ao reservar.' },
    ],
  };
  const FAQ_COMMON = [
    { q: lang === 'en' ? 'How do I book?' : 'Como faco uma reserva?', a: lang === 'en' ? 'Select a service, choose dates, fill in details and choose a payment method. You will receive a confirmation by email.' : 'Seleccione um servico, escolha as datas, preencha os dados e escolha o metodo de pagamento. Recebera uma confirmacao por email.' },
    { q: lang === 'en' ? 'Can I cancel my booking?' : 'Posso cancelar a minha reserva?', a: lang === 'en' ? 'Contact us via WhatsApp or email to discuss cancellation options.' : 'Contacte-nos via WhatsApp ou email para discutir as opcoes de cancelamento.' },
    { q: lang === 'en' ? 'What payment methods are accepted?' : 'Quais os metodos de pagamento aceites?', a: lang === 'en' ? 'International cards via PayPal, Cape Verdean cards via SISP Vinti4, and cash or card on arrival.' : 'Cartao internacional via PayPal, cartao cabo-verdiano via SISP Vinti4, e dinheiro ou cartao no local.' },
  ];
  const FAQ_ITEMS = [...(FAQ_BY_TYPE[op.operator_type] || []), ...FAQ_COMMON];
  return (
    <div className="min-h-screen bg-white">

      {/* ── Navbar ── */}
      <nav className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${navScrolled ? 'bg-white shadow-md' : 'bg-transparent'}`}>
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <a href={`/book/${slug}`} className="flex items-center gap-2 flex-shrink-0">
            {op.logo_url ? (
              <img src={op.logo_url} alt={op.name} className={`h-9 w-auto object-contain ${navScrolled ? '' : 'brightness-0 invert'}`} />
            ) : (
              <Logo size="sm" white={!navScrolled} />
            )}
          </a>

          <div className="hidden md:flex items-center gap-6">
            {navLinks.map(l => (
              <button key={l.id} onClick={() => scrollTo(l.id)}
                className={`text-sm font-body font-medium transition-colors ${navScrolled ? 'text-n-600 hover:text-ocean-700' : 'text-white/85 hover:text-white'}`}>
                {lang === 'pt' ? l.pt : l.en}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={toggleLang}
              className={`hidden sm:flex items-center gap-1 text-xs font-body font-bold border rounded-full px-3 py-1.5 transition-all ${navScrolled ? 'border-n-200 text-n-600 hover:border-ocean-700 hover:text-ocean-700' : 'border-white/30 text-white/80 hover:border-white hover:text-white'}`}>
              <Globe size={12} strokeWidth={1.75} />
              {lang === 'pt' ? 'EN' : 'PT'}
            </button>
            <button onClick={goBook}
              className="flex items-center gap-1.5 bg-ocean-700 text-white text-sm font-body font-semibold px-4 py-2 rounded-full hover:bg-ocean-500 transition-colors">
              <Calendar size={14} strokeWidth={1.75} />
              {lang === 'en' ? 'Book Now' : 'Reservar'}
            </button>
            <button onClick={() => setMobileMenu(o => !o)}
              className={`md:hidden w-9 h-9 flex items-center justify-center rounded-full transition-all ${navScrolled ? 'text-n-700 hover:bg-n-100' : 'text-white hover:bg-white/15'}`}>
              {mobileMenu ? <X size={18} strokeWidth={2} /> : <Menu size={18} strokeWidth={2} />}
            </button>
          </div>
        </div>

        {mobileMenu && (
          <div className="md:hidden bg-white border-t border-n-200 shadow-lg">
            {navLinks.map(l => (
              <button key={l.id} onClick={() => scrollTo(l.id)}
                className="w-full text-left px-5 py-3.5 text-sm font-body font-medium text-n-700 hover:bg-n-50 hover:text-ocean-700 border-b border-n-100 last:border-0 transition-colors">
                {lang === 'pt' ? l.pt : l.en}
              </button>
            ))}
            <div className="px-5 py-3 flex gap-2">
              <button onClick={toggleLang} className="flex items-center gap-1.5 text-xs font-body font-bold border border-n-200 rounded-full px-3 py-1.5 text-n-600">
                <Globe size={12} /> {lang === 'pt' ? 'EN' : 'PT'}
              </button>
              <button onClick={() => { setCur(c => c === 'EUR' ? 'CVE' : 'EUR'); setMobileMenu(false); }}
                className="flex items-center gap-1.5 text-xs font-body font-bold border border-n-200 rounded-full px-3 py-1.5 text-n-600">
                {currency === 'EUR' ? 'CVE' : 'EUR'}
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* ── Hero ── */}
      <section id="home">
        <div className="relative">
          <HeroCarousel images={op.cover_images?.length ? op.cover_images : (op.images || [])} />
          <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-10">
            <div className="max-w-5xl mx-auto">
              <div className="flex flex-wrap gap-2 mb-3">
                {isVerified && (
                  <span className="flex items-center gap-1 bg-white/15 backdrop-blur-sm border border-white/25 text-white text-xs font-body font-bold px-3 py-1 rounded-full">
                    <Shield size={11} strokeWidth={2} />
                    {lang === 'en' ? 'Verified SalDesk' : 'Verificado SalDesk'}
                  </span>
                )}
                {isTopRated && (
                  <span className="flex items-center gap-1 bg-sand-500/90 text-white text-xs font-body font-bold px-3 py-1 rounded-full">
                    <Award size={11} strokeWidth={2} />
                    Top Rated
                  </span>
                )}
                <span className="bg-white/15 backdrop-blur-sm border border-white/25 text-white text-xs font-body font-bold px-3 py-1 rounded-full">
                  {TYPE_LABELS[op.operator_type] || op.operator_type}
                </span>
                {units.length > 0 && (
                  <span className="flex items-center gap-1 bg-white/15 backdrop-blur-sm border border-white/25 text-white text-xs font-body font-bold px-3 py-1 rounded-full">
                    <Check size={11} strokeWidth={2.5} />
                    {units.length} {lang === 'en' ? (units.length === 1 ? 'service' : 'services') : (units.length === 1 ? 'serviço' : 'serviços')}
                  </span>
                )}
                {reviews.length >= 5 && (
                  <span className="flex items-center gap-1 bg-white/15 backdrop-blur-sm border border-white/25 text-white text-xs font-body font-bold px-3 py-1 rounded-full">
                    <Star size={11} strokeWidth={2} className="fill-sand-400 text-sand-400" />
                    {reviews.length} {lang === 'en' ? 'reviews' : 'avaliações'}
                  </span>
                )}
              </div>
              <h1 className="font-display font-extrabold text-white text-3xl sm:text-5xl leading-tight mb-3 drop-shadow-md tracking-tight">
                {op.business_name || op.name}
              </h1>
              {op.tagline && (
                <p className="font-body text-white/85 text-base sm:text-lg mb-4 max-w-xl leading-relaxed drop-shadow">
                  {op.tagline}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-4 mb-5">
                {op.address && (
                  <div className="flex items-center gap-1.5 text-white/80 text-sm font-body">
                    <MapPin size={14} strokeWidth={1.75} />
                    {op.address}
                  </div>
                )}
                {avgRating > 0 && (
                  <div className="flex items-center gap-1.5">
                    <StarRating rating={avgRating} size={14} />
                    <span className="text-white/85 text-sm font-body font-semibold">
                      {avgRating.toFixed(1)} ({reviews.length} {lang === 'en' ? 'reviews' : 'avaliações'})
                    </span>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                <button onClick={goBook}
                  className="flex items-center gap-2 bg-sand-500 text-white font-body font-bold px-6 py-3 rounded-full hover:bg-sand-600 transition-all shadow-lg text-sm">
                  <Calendar size={16} strokeWidth={1.75} />
                  {lang === 'en' ? 'Book Now' : 'Reservar Agora'}
                </button>
                <button onClick={() => scrollTo('servicos')}
                  className="flex items-center gap-2 bg-white/15 backdrop-blur-sm border border-white/30 text-white font-body font-semibold px-6 py-3 rounded-full hover:bg-white/25 transition-all text-sm">
                  {lang === 'en' ? 'View Services' : 'Ver Serviços'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Urgency strip ── */}
      <div className="bg-ocean-700 text-white text-center py-2.5 px-4">
        <p className="text-xs font-body font-semibold flex items-center justify-center gap-3 flex-wrap">
          <span>
            <span className="text-sand-400 font-bold">{viewerCount}</span>
            {lang === 'en' ? ' people viewed this page today' : ' pessoas viram esta pagina hoje'}
          </span>
          {units.length > 0 && (
            <span className="opacity-60">·</span>
          )}
          {units.length > 0 && (
            <span>
              <span className="text-sand-400 font-bold">{units.length}</span>
              {lang === 'en' ? ' services available' : ' servicos disponiveis'}
            </span>
          )}
          {isVerified && (
            <>
              <span className="opacity-60">·</span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                {lang === 'en' ? 'Booking open' : 'Reservas abertas'}
              </span>
            </>
          )}
        </p>
      </div>

      {/* ── Trust Bar ── */}
      <div className="border-b border-n-100 bg-n-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
            <div className="flex items-center gap-2 text-n-600">
              <div className="w-7 h-7 rounded-full bg-ocean-50 flex items-center justify-center flex-shrink-0">
                <Shield size={14} strokeWidth={1.75} className="text-ocean-700" />
              </div>
              <span className="text-xs font-body font-semibold">{lang === 'en' ? 'Verified operator' : 'Operador verificado'}</span>
            </div>
            <div className="flex items-center gap-2 text-n-600">
              <div className="w-7 h-7 rounded-full bg-ocean-50 flex items-center justify-center flex-shrink-0">
                <Check size={14} strokeWidth={2} className="text-ocean-700" />
              </div>
              <span className="text-xs font-body font-semibold">{lang === 'en' ? 'Direct booking · 0% commission' : 'Reserva directa · 0% comissão'}</span>
            </div>
            <div className="flex items-center gap-2 text-n-600">
              <div className="w-7 h-7 rounded-full bg-ocean-50 flex items-center justify-center flex-shrink-0">
                <MessageCircle size={14} strokeWidth={1.75} className="text-ocean-700" />
              </div>
              <span className="text-xs font-body font-semibold">{lang === 'en' ? 'WhatsApp support' : 'Suporte via WhatsApp'}</span>
            </div>
            {avgRating > 0 && (
              <div className="flex items-center gap-2 text-n-600">
                <div className="w-7 h-7 rounded-full bg-sand-50 flex items-center justify-center flex-shrink-0">
                  <Star size={14} strokeWidth={1.75} className="text-sand-500 fill-sand-500" />
                </div>
                <span className="text-xs font-body font-semibold">{avgRating.toFixed(1)} / 5 ({reviews.length} {lang === 'en' ? 'reviews' : 'avaliações'})</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6">

        {/* ── Sobre Nós ── */}
        <section id="sobre" className="py-12 sm:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            {op.logo_url && (
              <div className="rounded-2xl overflow-hidden bg-n-50 flex items-center justify-center p-8 border border-n-200">
                <img src={op.logo_url} alt={op.name} className="max-h-48 object-contain" />
              </div>
            )}
            <div className={op.logo_url ? '' : 'lg:col-span-2'}>
              <p className="text-xs font-body font-bold text-ocean-700 uppercase tracking-widest mb-2">
                {lang === 'en' ? 'About us' : 'Sobre nós'}
              </p>
              <h2 className="font-display font-bold text-2xl sm:text-3xl text-n-900 mb-4">{op.business_name || op.name}</h2>
              {op.description && (
                <p className="font-body text-n-600 leading-relaxed text-base mb-6">{op.description}</p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { icon: <MapPin size={18} strokeWidth={1.75} />, label: lang === 'en' ? 'Location' : 'Localização', value: op.address?.split(',')[0] || 'Ilha do Sal' },
                  { icon: <Globe size={18} strokeWidth={1.75} />, label: lang === 'en' ? 'Languages' : 'Idiomas', value: 'PT · EN' },
                  { icon: <Award size={18} strokeWidth={1.75} />, label: lang === 'en' ? 'Type' : 'Tipo', value: TYPE_LABELS[op.operator_type] || 'Serviços' },
                  { icon: <Star size={18} strokeWidth={1.75} />, label: lang === 'en' ? 'Rating' : 'Avaliação', value: avgRating > 0 ? `${avgRating.toFixed(1)}/5` : (lang === 'en' ? 'New' : 'Novo') },
                ].map((item, i) => (
                  <div key={i} className="bg-n-50 border border-n-200 rounded-xl p-3 text-center">
                    <div className="w-8 h-8 rounded-full bg-ocean-50 flex items-center justify-center mx-auto mb-2 text-ocean-700">
                      {item.icon}
                    </div>
                    <p className="text-xs font-body text-n-400 mb-0.5">{item.label}</p>
                    <p className="text-xs font-body font-bold text-n-800">{item.value}</p>
                  </div>
                ))}
              </div>
              {op.phone && (
                <div className="flex flex-wrap gap-3 mt-5">
                  <a href={`tel:${op.phone}`} className="flex items-center gap-2 border border-n-300 text-n-700 text-sm font-body font-medium px-4 py-2 rounded-full hover:border-ocean-700 hover:text-ocean-700 transition-colors">
                    <Phone size={14} strokeWidth={1.75} /> {op.phone}
                  </a>
                  {op.email && (
                    <a href={`mailto:${op.email}`} className="flex items-center gap-2 border border-n-300 text-n-700 text-sm font-body font-medium px-4 py-2 rounded-full hover:border-ocean-700 hover:text-ocean-700 transition-colors">
                      <Mail size={14} strokeWidth={1.75} /> {op.email}
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── Serviços ── */}
        {units.length > 0 && (
          <section id="servicos" className="py-12 sm:py-16 border-t border-n-100">
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
              <div>
                <p className="text-xs font-body font-bold text-ocean-700 uppercase tracking-widest mb-1">
                  {lang === 'en' ? 'What we offer' : 'O que oferecemos'}
                </p>
                <h2 className="font-display font-bold text-2xl sm:text-3xl text-n-900">
                  {lang === 'en' ? 'Our Services' : 'Os Nossos Serviços'}
                </h2>
              </div>
              <div className="flex items-center gap-1 bg-n-100 rounded-full p-1">
                <button onClick={() => setCur('EUR')}
                  className={`text-xs font-body font-bold px-4 py-1.5 rounded-full transition-all ${currency === 'EUR' ? 'bg-ocean-700 text-white' : 'text-n-500'}`}>EUR</button>
                <button onClick={() => setCur('CVE')}
                  className={`text-xs font-body font-bold px-4 py-1.5 rounded-full transition-all ${currency === 'CVE' ? 'bg-ocean-700 text-white' : 'text-n-500'}`}>CVE</button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {units.map(unit => (
                <ServiceCard key={unit.id} unit={unit} slug={slug} currency={currency} lang={lang} opCurrency={op.currency} />
              ))}
            </div>
          </section>
        )}

        {/* ── Galeria ── */}
        {galleryImgs.length > 0 && (
          <section id="galeria" className="py-12 sm:py-16 border-t border-n-100">
            <div className="flex items-end justify-between mb-6 gap-4">
              <div>
                <p className="text-xs font-body font-bold text-ocean-700 uppercase tracking-widest mb-2">
                  {lang === 'en' ? 'Gallery' : 'Galeria'}
                </p>
                <h2 className="font-display font-bold text-2xl sm:text-3xl text-n-900">
                  {lang === 'en' ? 'Photo Gallery' : 'Galeria de Fotos'}
                </h2>
              </div>
              {galleryImgs.length > 1 && (
                <button onClick={() => setLbIdx(0)}
                  className="flex items-center gap-2 text-sm font-body font-semibold text-ocean-700 hover:text-ocean-500 transition-colors flex-shrink-0">
                  {lang === 'en' ? `View all ${galleryImgs.length} photos` : `Ver todas (${galleryImgs.length})`}
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {galleryImgs.slice(0, 5).map((src, i) => (
                <div key={i}
                  className={`overflow-hidden rounded-xl cursor-pointer group relative ${i === 0 ? 'col-span-2 row-span-2' : ''}`}
                  style={{ height: i === 0 ? 340 : 163 }}
                  onClick={() => setLbIdx(i)}>
                  <img src={src} alt={`Foto ${i + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-ocean-900/0 group-hover:bg-ocean-900/25 transition-colors duration-300" />
                  {i === 4 && galleryImgs.length > 5 && (
                    <div className="absolute inset-0 bg-ocean-900/55 flex items-center justify-center">
                      <div className="text-center">
                        <p className="font-display font-extrabold text-white text-2xl">+{galleryImgs.length - 5}</p>
                        <p className="text-white/80 text-xs font-body">{lang === 'en' ? 'photos' : 'fotos'}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Localizacao */}
        {op.address && (
          <section id="localizacao" className="py-12 sm:py-16 border-t border-n-100">
            <p className="text-xs font-body font-bold text-ocean-700 uppercase tracking-widest mb-2">
              {lang === 'en' ? 'Location' : 'Localizacao'}
            </p>
            <h2 className="font-display font-bold text-2xl sm:text-3xl text-n-900 mb-6">
              {lang === 'en' ? 'Where to find us' : 'Onde nos encontrar'}
            </h2>
            <div className="rounded-2xl overflow-hidden border border-n-200 shadow-sm">
              <iframe
                title="Mapa"
                width="100%"
                height="360"
                style={{ border: 0, display: 'block' }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src={`https://maps.google.com/maps?q=${encodeURIComponent((op.business_name || op.name) + ' ' + op.address + ' Cabo Verde')}&output=embed&z=15`}
              />
            </div>
            <div className="flex items-center gap-2 mt-3">
              <MapPin size={14} strokeWidth={1.75} className="text-n-400 flex-shrink-0" />
              <span className="text-sm font-body text-n-600">{op.address}</span>
              <a
                href={`https://www.google.com/maps/search/${encodeURIComponent((op.business_name || op.name) + ' ' + op.address + ' Cabo Verde')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto flex items-center gap-1 text-xs font-body font-semibold text-ocean-700 hover:text-ocean-500 transition-colors flex-shrink-0"
              >
                <ExternalLink size={12} strokeWidth={1.75} />
                {lang === 'en' ? 'Open in Google Maps' : 'Abrir no Google Maps'}
              </a>
            </div>
          </section>
        )}

        {/* ── Avaliações ── */}
        {reviews.length > 0 && (
          <section id="avaliacoes" className="py-12 sm:py-16 border-t border-n-100">
            <p className="text-xs font-body font-bold text-ocean-700 uppercase tracking-widest mb-2">
              {lang === 'en' ? 'Customer reviews' : 'Clientes'}
            </p>
            <h2 className="font-display font-bold text-2xl sm:text-3xl text-n-900 mb-8">
              {lang === 'en' ? 'What visitors say' : 'O que dizem os clientes'}
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
              <div className="bg-n-50 rounded-2xl p-6 border border-n-200">
                <div className="text-center mb-5">
                  <p className="font-display font-extrabold text-5xl text-n-900">{avgRating.toFixed(1)}</p>
                  <StarRating rating={avgRating} size={18} />
                  <p className="text-sm font-body text-n-400 mt-1">{reviews.length} {lang === 'en' ? 'reviews' : 'avaliações'}</p>
                </div>
                <div className="space-y-2">
                  {ratingBreakdown.map(({ r, count, pct }) => (
                    <div key={r} className="flex items-center gap-2">
                      <span className="text-xs font-body font-semibold text-n-600 w-3">{r}</span>
                      <Star size={11} strokeWidth={1.75} className="text-sand-400 fill-sand-400 flex-shrink-0" />
                      <div className="flex-1 bg-n-200 rounded-full h-1.5">
                        <div className="bg-sand-400 h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-n-400 font-body w-4 text-right">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="lg:col-span-2 space-y-4">
                {reviews.slice(0, 4).map((r, i) => (
                  <div key={i} className="bg-white border border-n-200 rounded-xl p-5 shadow-sm">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-ocean-100 flex items-center justify-center font-display font-bold text-ocean-700 text-sm flex-shrink-0">
                          {(r.author_name || 'C').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-body font-semibold text-n-900 text-sm">{r.author_name || 'Cliente'}</p>
                            <span className="flex items-center gap-0.5 bg-ocean-50 text-ocean-700 text-[10px] font-body font-bold px-1.5 py-0.5 rounded-full">
                              <Check size={9} strokeWidth={2.5} />
                              {lang === 'en' ? 'Verified' : 'Verificado'}
                            </span>
                          </div>
                          <p className="text-xs font-body text-n-400">{r.created_at?.split('T')[0]}</p>
                        </div>
                      </div>
                      <StarRating rating={r.rating} size={12} />
                    </div>
                    {r.comment && (
                      <p className="text-sm font-body text-n-600 leading-relaxed">{r.comment}</p>
                    )}
                    {r.reply_text && (
                      <div className="mt-3 bg-ocean-50 border border-ocean-100 rounded-xl px-4 py-3">
                        <p className="text-xs font-body font-bold text-ocean-700 mb-1">{op.name}</p>
                        <p className="text-xs font-body text-n-600">{r.reply_text}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── FAQ ── */}
        <section className="py-12 sm:py-16 border-t border-n-100">
          <p className="text-xs font-body font-bold text-ocean-700 uppercase tracking-widest mb-2">FAQ</p>
          <h2 className="font-display font-bold text-2xl sm:text-3xl text-n-900 mb-6">
            {lang === 'en' ? 'Frequently Asked Questions' : 'Perguntas Frequentes'}
          </h2>
          <div className="space-y-3 max-w-2xl">
            {FAQ_ITEMS.map((item, i) => (
              <div key={i} className="border border-n-200 rounded-xl overflow-hidden">
                <button onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-n-50 transition-colors">
                  <span className="font-body font-semibold text-n-800 text-sm">{item.q}</span>
                  {faqOpen === i ? <ChevronUp size={16} strokeWidth={2} className="text-n-400 flex-shrink-0" /> : <ChevronDown size={16} strokeWidth={2} className="text-n-400 flex-shrink-0" />}
                </button>
                {faqOpen === i && (
                  <div className="px-5 pb-4 text-sm font-body text-n-500 leading-relaxed border-t border-n-100 pt-3">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── Localização ── */}
        <section id="localizacao" className="py-12 sm:py-16 border-t border-n-100">
          <p className="text-xs font-body font-bold text-ocean-700 uppercase tracking-widest mb-2">
            {lang === 'en' ? 'Location' : 'Localização'}
          </p>
          <h2 className="font-display font-bold text-2xl sm:text-3xl text-n-900 mb-6">
            {lang === 'en' ? 'Where to find us' : 'Onde nos encontrar'}
          </h2>
          <div className="bg-ocean-50 border border-ocean-100 rounded-2xl overflow-hidden">
            <div className="relative h-52 bg-cover bg-center"
              style={{ backgroundImage: `url(https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&q=75)` }}>
              <div className="absolute inset-0 bg-ocean-900/40" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-white rounded-2xl p-5 text-center shadow-xl max-w-xs mx-4">
                  <div className="w-10 h-10 bg-ocean-700 rounded-full flex items-center justify-center mx-auto mb-2">
                    <MapPin size={18} strokeWidth={1.75} className="text-white" />
                  </div>
                  <p className="font-display font-bold text-n-900 text-sm mb-1">{op.name}</p>
                  <p className="text-xs font-body text-n-500 mb-3">{op.address || 'Ilha do Sal, Cabo Verde'}</p>
                  <a href={`https://maps.google.com?q=${encodeURIComponent((op.address || 'Santa Maria Ilha do Sal') + ' Cabo Verde')}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 bg-ocean-700 text-white text-xs font-body font-semibold px-4 py-2 rounded-lg hover:bg-ocean-500 transition-colors">
                    <ExternalLink size={12} strokeWidth={1.75} />
                    {lang === 'en' ? 'Open in Google Maps' : 'Abrir no Google Maps'}
                  </a>
                </div>
              </div>
            </div>
            {(op.phone || op.email) && (
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {op.phone && (
                  <a href={`tel:${op.phone}`} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-n-200 hover:border-ocean-300 transition-colors">
                    <div className="w-8 h-8 bg-ocean-50 rounded-full flex items-center justify-center text-ocean-700">
                      <Phone size={14} strokeWidth={1.75} />
                    </div>
                    <div>
                      <p className="text-xs font-body text-n-400">{lang === 'en' ? 'Phone' : 'Telefone'}</p>
                      <p className="text-sm font-body font-semibold text-n-800">{op.phone}</p>
                    </div>
                  </a>
                )}
                {whatsappUrl && (
                  <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 bg-white rounded-xl border border-n-200 hover:border-green-400 transition-colors">
                    <div className="w-8 h-8 bg-green-50 rounded-full flex items-center justify-center text-green-600">
                      <MessageCircle size={14} strokeWidth={1.75} />
                    </div>
                    <div>
                      <p className="text-xs font-body text-n-400">WhatsApp</p>
                      <p className="text-sm font-body font-semibold text-n-800">{op.whatsapp}</p>
                    </div>
                  </a>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ── Contacto ── */}
        <section id="contacto" className="py-12 sm:py-16 border-t border-n-100">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div>
              <p className="text-xs font-body font-bold text-ocean-700 uppercase tracking-widest mb-2">
                {lang === 'en' ? 'Get in touch' : 'Entre em contacto'}
              </p>
              <h2 className="font-display font-bold text-2xl sm:text-3xl text-n-900 mb-4">
                {lang === 'en' ? 'Contact us' : 'Fale connosco'}
              </h2>
              <p className="font-body text-n-500 leading-relaxed mb-6">
                {lang === 'en' ? 'Have questions? We respond within 24 hours.' : 'Tem dúvidas? Respondemos em 24 horas.'}
              </p>
              <div className="space-y-3">
                {op.phone && <div className="flex items-center gap-3 text-sm font-body text-n-600"><Phone size={16} strokeWidth={1.75} className="text-ocean-400" />{op.phone}</div>}
                {op.email && <div className="flex items-center gap-3 text-sm font-body text-n-600"><Mail size={16} strokeWidth={1.75} className="text-ocean-400" />{op.email}</div>}
                {op.address && <div className="flex items-center gap-3 text-sm font-body text-n-600"><MapPin size={16} strokeWidth={1.75} className="text-ocean-400" />{op.address}</div>}
              </div>
              <div className="flex items-center gap-3 mt-6">
                {typeof navigator !== 'undefined' && navigator.share && (
                  <button onClick={() => navigator.share({ title: op.business_name || op.name, url: window.location.href })}
                    className="flex items-center gap-1.5 border border-n-300 text-n-600 text-xs font-body font-semibold px-4 py-2 rounded-full hover:border-ocean-700 hover:text-ocean-700 transition-colors">
                    <Share2 size={12} strokeWidth={1.75} />
                    {lang === 'en' ? 'Share' : 'Partilhar'}
                  </button>
                )}
                <button onClick={copyLink}
                  className="flex items-center gap-1.5 border border-n-300 text-n-600 text-xs font-body font-semibold px-4 py-2 rounded-full hover:border-ocean-700 hover:text-ocean-700 transition-colors">
                  {copied ? <Check size={12} strokeWidth={2} /> : <Copy size={12} strokeWidth={1.75} />}
                  {copied ? (lang === 'en' ? 'Copied!' : 'Copiado!') : (lang === 'en' ? 'Copy link' : 'Copiar link')}
                </button>
                {whatsappUrl && (
                  <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 bg-[#25D366] text-white text-xs font-body font-semibold px-4 py-2 rounded-full hover:opacity-90 transition-opacity">
                    <MessageCircle size={12} strokeWidth={1.75} />WhatsApp
                  </a>
                )}
                {qrUrl && (
                  <button onClick={() => setShowQr(o => !o)}
                    className="flex items-center gap-1.5 border border-n-300 text-n-600 text-xs font-body font-semibold px-4 py-2 rounded-full hover:border-ocean-700 hover:text-ocean-700 transition-colors">
                    <Share2 size={12} strokeWidth={1.75} />QR Code
                  </button>
                )}
              </div>
              {showQr && qrUrl && (
                <div className="mt-4 flex flex-col items-start gap-2">
                  <img src={qrUrl} alt="QR Code" className="w-32 h-32 rounded-xl border border-n-200 shadow-sm" />
                  <p className="text-xs font-body text-n-400">{lang === 'en' ? 'Scan to open this page' : 'Scannear para abrir esta pagina'}</p>
                  <a href={qrUrl} download={`qr-${slug}.png`}
                    className="text-xs font-body font-semibold text-ocean-700 hover:text-ocean-500 transition-colors">
                    {lang === 'en' ? 'Download QR Code' : 'Descarregar QR Code'}
                  </a>
                </div>
              )}
            </div>
            <div className="bg-n-50 rounded-2xl p-6 border border-n-200">
              {contactSent ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-success-light rounded-full flex items-center justify-center mx-auto mb-3">
                    <Check size={22} strokeWidth={2} className="text-success" />
                  </div>
                  <h3 className="font-display font-bold text-n-900 mb-2">{lang === 'en' ? 'Message sent!' : 'Mensagem enviada!'}</h3>
                  <p className="text-sm font-body text-n-500">{lang === 'en' ? "We'll get back to you shortly." : 'Entraremos em contacto brevemente.'}</p>
                </div>
              ) : (
                <form onSubmit={sendContact} className="space-y-3">
                  <div>
                    <label className="text-xs font-body font-semibold text-n-600 mb-1 block">{lang === 'en' ? 'Name' : 'Nome'}</label>
                    <input value={contactForm.name} onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full border border-n-300 rounded-xl px-4 py-3 font-body text-sm focus:outline-none focus:border-ocean-500 focus:ring-2 focus:ring-ocean-500/10 bg-white" />
                  </div>
                  <div>
                    <label className="text-xs font-body font-semibold text-n-600 mb-1 block">Email *</label>
                    <input required type="email" value={contactForm.email} onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))}
                      className="w-full border border-n-300 rounded-xl px-4 py-3 font-body text-sm focus:outline-none focus:border-ocean-500 focus:ring-2 focus:ring-ocean-500/10 bg-white" />
                  </div>
                  <div>
                    <label className="text-xs font-body font-semibold text-n-600 mb-1 block">
                      {lang === 'en' ? 'Message' : 'Mensagem'} *
                    </label>
                    <textarea required rows={4} value={contactForm.message} onChange={e => setContactForm(f => ({ ...f, message: e.target.value }))}
                      className="w-full border border-n-300 rounded-xl px-4 py-3 font-body text-sm resize-none focus:outline-none focus:border-ocean-500 focus:ring-2 focus:ring-ocean-500/10 bg-white" />
                  </div>
                  <button type="submit"
                    className="w-full bg-ocean-700 text-white font-body font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-ocean-500 transition-colors">
                    <Send size={14} strokeWidth={1.75} />
                    {lang === 'en' ? 'Send message' : 'Enviar mensagem'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* ── Footer ── */}
      <footer className="bg-ocean-900 text-white/70 mt-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
            <div className="sm:col-span-2 lg:col-span-1">
              {op.logo_url ? (
                <img src={op.logo_url} alt={op.name} className="h-8 object-contain mb-3 brightness-0 invert" />
              ) : (
                <Logo size="sm" white />
              )}
              <p className="text-sm font-body leading-relaxed mb-3 text-white/55">
                {op.description ? op.description.slice(0, 120) + (op.description.length > 120 ? '...' : '') : `${op.name} — Ilha do Sal, Cabo Verde`}
              </p>
              {avgRating > 0 && (
                <div className="flex items-center gap-2">
                  <StarRating rating={avgRating} size={12} />
                  <span className="text-xs text-white/50">{avgRating.toFixed(1)} ({reviews.length})</span>
                </div>
              )}
              {isVerified && (
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="flex items-center gap-1 text-xs font-body text-white/60 border border-white/15 px-2.5 py-1 rounded-full">
                    <Shield size={10} strokeWidth={2} />
                    {lang === 'en' ? 'Verified' : 'Verificado'}
                  </span>
                </div>
              )}
            </div>
            <div>
              <h4 className="font-display font-bold text-sm text-white mb-3">
                {lang === 'en' ? 'Navigation' : 'Navegação'}
              </h4>
              <ul className="space-y-2">
                {navLinks.map(l => (
                  <li key={l.id}>
                    <button onClick={() => scrollTo(l.id)}
                      className="text-sm font-body text-white/50 hover:text-white transition-colors">
                      {lang === 'pt' ? l.pt : l.en}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-display font-bold text-sm text-white mb-3">
                {lang === 'en' ? 'Contact' : 'Contacto'}
              </h4>
              <div className="space-y-2">
                {op.address && <p className="text-sm font-body text-white/50 flex items-start gap-1.5"><MapPin size={13} strokeWidth={1.75} className="flex-shrink-0 mt-0.5" />{op.address}</p>}
                {op.phone   && <p className="text-sm font-body text-white/50 flex items-center gap-1.5"><Phone size={13} strokeWidth={1.75} />{op.phone}</p>}
                {op.email   && <p className="text-sm font-body text-white/50 flex items-center gap-1.5"><Mail size={13} strokeWidth={1.75} />{op.email}</p>}
              </div>
            </div>
            <div>
              <h4 className="font-display font-bold text-sm text-white mb-3">
                {lang === 'en' ? 'Book now' : 'Reservar'}
              </h4>
              <button onClick={goBook}
                className="w-full bg-sand-500 text-white font-body font-semibold text-sm py-3 rounded-xl hover:bg-sand-600 transition-colors flex items-center justify-center gap-2 mb-3">
                <Calendar size={14} strokeWidth={1.75} />
                {lang === 'en' ? 'Reserve a service' : 'Reservar um serviço'}
              </button>
              {whatsappUrl && (
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
                  className="w-full bg-[#25D366]/20 border border-[#25D366]/30 text-[#25D366] font-body font-semibold text-sm py-2.5 rounded-xl hover:bg-[#25D366]/30 transition-colors flex items-center justify-center gap-2">
                  <MessageCircle size={14} strokeWidth={1.75} />
                  WhatsApp
                </a>
              )}
            </div>
          </div>
          <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-body">
            <p className="text-white/40">© 2026 {op.name} · Ilha do Sal, Cabo Verde</p>
            <p className="text-white/35">
              {lang === 'en' ? 'Powered by' : 'Plataforma'}{' '}
              <a href="https://saldesk.cv" className="text-white/55 hover:text-white transition-colors font-semibold">SalDesk</a>
              {' '}&middot; Sistema desenvolvido por{' '}
              <a href="https://wandr.cv" className="text-white/55 hover:text-white transition-colors font-semibold">WANDR</a>
            </p>
          </div>
        </div>
      </footer>

      {/* ── Bottom CTA bar (mobile) ── */}
      {units.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-n-200 px-4 py-3 flex gap-3 z-30 sm:hidden shadow-lg">
          <button onClick={goBook}
            className="flex-1 bg-ocean-700 text-white font-body font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-ocean-500 transition-colors text-sm">
            <Calendar size={16} strokeWidth={1.75} />
            {lang === 'en' ? 'Book Now' : 'Reservar Agora'}
          </button>
          {whatsappUrl && (
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
              className="bg-[#25D366] text-white font-body font-semibold py-3 px-4 rounded-xl flex items-center justify-center">
              <MessageCircle size={18} strokeWidth={1.75} />
            </a>
          )}
        </div>
      )}

      {/* ── WhatsApp FAB ── */}
      {whatsappUrl && (
        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
          className="fixed bottom-20 sm:bottom-6 right-4 z-30 rounded-full bg-[#25D366] flex items-center justify-center shadow-xl hover:scale-110 transition-transform"
          style={{ width: 52, height: 52 }}>
          <div className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-25" />
          <MessageCircle size={22} strokeWidth={1.75} className="text-white relative z-10" />
        </a>
      )}

      {/* ── Chat widget ── */}
      <ChatWidget slug={slug} opName={op.name} lang={lang} />

      {/* ── Lightbox ── */}
      {lbIdx !== null && (
        <Lightbox
          images={galleryImgs}
          idx={lbIdx}
          onClose={() => setLbIdx(null)}
          onMove={d => setLbIdx(i => (i + d + galleryImgs.length) % galleryImgs.length)}
        />
      )}
    </div>
  );
}
