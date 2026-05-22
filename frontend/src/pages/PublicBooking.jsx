import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  MapPin, Phone, Star, ChevronLeft, ChevronRight, MessageCircle, Clock,
  Menu, X, Globe, Mail, Calendar, Users, Check, ArrowRight, Shield,
  ExternalLink, ChevronDown, ChevronUp, Copy, Send, Award, Share2,
  Compass, Car, Utensils,
} from 'lucide-react';
import Logo from '../components/shared/Logo';

const API     = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';
const EUR_CVE = 110;
const FALLBACK_IMGS = [
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80',
  'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1200&q=80',
  'https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=1200&q=80',
];
const TYPE_LABELS = { hotel: 'Hotel', activity: 'Actividade', rentacar: 'Rent-a-Car', restaurant: 'Restaurante' };

/* â”€â”€ SEO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function injectSeo(op, slug) {
  const desc = op.description || `Reserve directamente em ${op.name}, Ilha do Sal, Cabo Verde.`;
  document.title = `${op.name} â€” Reservar Â· SalDesk`;
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
    name: op.name, description: desc, url: window.location.href,
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
  document.title = 'SalDesk â€” GestÃ£o TurÃ­stica';
}

/* â”€â”€ Price formatter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function fmtPrice(price, priceUnit, opCurrency, viewCurrency, lang) {
  if (!price) return lang === 'en' ? 'On request' : 'Consultar';
  const unitLabels = {
    night: lang === 'en' ? '/night' : '/noite', day: lang === 'en' ? '/day' : '/dia',
    hour: lang === 'en' ? '/hour' : '/hora', session: lang === 'en' ? '/session' : '/sessÃ£o',
    person: lang === 'en' ? '/person' : '/pessoa',
  };
  const suffix = unitLabels[priceUnit] || '';
  if (viewCurrency === 'CVE') {
    const cve = (opCurrency || 'EUR') === 'CVE' ? price : price * EUR_CVE;
    return `${Math.round(cve).toLocaleString('pt-PT')} CVE${suffix}`;
  }
  const eur = (opCurrency || 'EUR') === 'CVE' ? price / EUR_CVE : price;
  return `â‚¬${eur < 10 ? eur.toFixed(1) : Math.round(eur)}${suffix}`;
}

/* â”€â”€ StarRating â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

/* â”€â”€ Hero Carousel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

/* â”€â”€ ServiceCard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function ServiceCard({ unit, onBook, currency, lang, opCurrency }) {
  const price = fmtPrice(unit.base_price, unit.price_unit, opCurrency, currency, lang);
  return (
    <div className="bg-white rounded-xl border border-n-200 shadow-sm overflow-hidden hover:shadow-md hover:-translate-y-1 transition-all duration-200">
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
            <span>{lang === 'en' ? 'Up to' : 'AtÃ©'} {unit.capacity} {lang === 'en' ? 'people' : 'pessoas'}</span>
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="font-display font-bold text-ocean-700 text-base leading-tight">{price}</p>
          </div>
          <button onClick={() => onBook(unit)}
            className="flex items-center gap-1.5 bg-ocean-700 text-white text-xs font-body font-semibold px-4 py-2 rounded-lg hover:bg-ocean-500 transition-colors">
            <Calendar size={14} strokeWidth={1.75} />
            {lang === 'en' ? 'Book' : 'Reservar'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* â”€â”€ Booking Modal System â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

// â”€â”€ constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const IN  = 'w-full border border-n-300 rounded-xl px-4 py-2.5 font-body text-sm focus:outline-none focus:border-ocean-500 focus:ring-2 focus:ring-ocean-500/10 bg-white transition-all';
const LB  = 'block text-xs font-body font-semibold text-n-600 mb-1.5';
const SH  = 'font-display font-semibold text-n-900 text-sm mb-4';
const SEL = IN + ' appearance-none cursor-pointer';

const TODAY_STR = () => new Date().toISOString().split('T')[0];
function nts(a, b) { return (a && b && b > a) ? Math.round((new Date(b) - new Date(a)) / 864e5) : 0; }
function dys(a, b) { return (a && b && b > a) ? Math.max(1, Math.ceil((new Date(b) - new Date(a)) / 864e5)) : 0; }

const TOUR_SLOTS  = ['07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00'];
const REST_SLOTS  = ['12:00','12:30','13:00','13:30','14:00','14:30','19:00','19:30','20:00','20:30','21:00','21:30','22:00','22:30'];
const CV_LOCS_PT  = ['Aeroporto (SID)','Hotel / Alojamento','EscritÃ³rio da empresa','Outro endereÃ§o'];
const CV_LOCS_EN  = ['Airport (SID)','Hotel / Accommodation','Company office','Other address'];
const CAR_EXTRAS  = [
  { k:'insurance',    pt:'Seguro adicional',    en:'Additional insurance' },
  { k:'gps',          pt:'GPS incluÃ­do',         en:'GPS navigation' },
  { k:'baby_seat',    pt:'Cadeira de bebÃ©',      en:'Baby / child seat' },
  { k:'extra_driver', pt:'Condutor adicional',   en:'Additional driver' },
];
const OCCASIONS = [
  { v:'',          pt:'Sem ocasiÃ£o especial',   en:'No special occasion' },
  { v:'birthday',  pt:'AniversÃ¡rio',            en:'Birthday' },
  { v:'honeymoon', pt:'Lua-de-mel',             en:'Honeymoon' },
  { v:'business',  pt:'ReuniÃ£o de negÃ³cios',    en:'Business meeting' },
  { v:'other',     pt:'Outra ocasiÃ£o',          en:'Other occasion' },
];

// â”€â”€ Counter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function Cnt({ label, val, set, min = 0, max = 20 }) {
  return (
    <div>
      <label className={LB}>{label}</label>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => set(Math.max(min, val - 1))}
          className="w-9 h-9 rounded-full border border-n-300 flex items-center justify-center text-n-500 hover:border-ocean-700 hover:text-ocean-700 transition-all select-none text-xl font-light leading-none">âˆ’</button>
        <span className="flex-1 text-center font-display font-bold text-n-900 text-lg tabular-nums">{val}</span>
        <button type="button" onClick={() => set(Math.min(max, val + 1))}
          className="w-9 h-9 rounded-full border border-n-300 flex items-center justify-center text-n-500 hover:border-ocean-700 hover:text-ocean-700 transition-all select-none text-xl font-light leading-none">+</button>
      </div>
    </div>
  );
}

// â”€â”€ GuestForm (shared name/email/phone/country) â”€â”€â”€â”€â”€â”€
function GF({ d, set, lang, children }) {
  const u = k => e => set(p => ({ ...p, [k]: e.target.value }));
  return (
    <div className="space-y-3">
      <div>
        <label className={LB}>{lang === 'en' ? 'Full name' : 'Nome completo'} *</label>
        <input className={IN} value={d.name || ''} onChange={u('name')} required placeholder={lang === 'en' ? 'John Smith' : 'JoÃ£o Silva'} />
      </div>
      <div>
        <label className={LB}>Email *</label>
        <input className={IN} type="email" value={d.email || ''} onChange={u('email')} required placeholder="joao@email.com" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LB}>{lang === 'en' ? 'Phone / WhatsApp' : 'Telefone / WhatsApp'}</label>
          <input className={IN} type="tel" value={d.phone || ''} onChange={u('phone')} placeholder="+351 9XX XXX XXX" />
        </div>
        <div>
          <label className={LB}>{lang === 'en' ? 'Country' : 'PaÃ­s de origem'}</label>
          <input className={IN} value={d.country || ''} onChange={u('country')} placeholder={lang === 'en' ? 'Portugal' : 'Portugal'} />
        </div>
      </div>
      {children}
    </div>
  );
}

// â”€â”€ Summary table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ST({ lines }) {
  return (
    <div className="bg-ocean-50 border border-ocean-100 rounded-xl p-4 space-y-2.5">
      {lines.map((l, i) => (
        <div key={i} className="flex items-start justify-between gap-3">
          <span className="text-xs font-body text-n-500 leading-relaxed flex-shrink-0">{l.label}</span>
          <span className={`text-xs font-body text-right ${l.hi ? 'text-ocean-700 text-sm font-bold' : 'text-n-800 font-semibold'}`}>{l.value}</span>
        </div>
      ))}
    </div>
  );
}

// â”€â”€ Payment options â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function PO({ lang, v, set }) {
  return (
    <div className="space-y-2.5">
      {[
        { k:'paypal', l:lang==='en'?'International card (PayPal)':'CartÃ£o internacional (PayPal)',   s:'Visa Â· Mastercard Â· American Express' },
        { k:'sisp',   l:lang==='en'?'Cape Verdean card (Vinti4)':'CartÃ£o cabo-verdiano (Vinti4)',    s:'SISP Vinti4 Â· MasterCard local' },
        { k:'cash',   l:lang==='en'?'Pay on arrival':'Pagar presencialmente', s:lang==='en'?'Cash or card on site':'Dinheiro ou cartÃ£o no local' },
      ].map(o => (
        <button key={o.k} type="button" onClick={() => set(o.k)}
          className={`w-full text-left p-3.5 rounded-xl border-2 transition-all ${v===o.k?'border-ocean-700 bg-ocean-50':'border-n-200 hover:border-n-300'}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className={`text-sm font-body font-semibold ${v===o.k?'text-ocean-700':'text-n-800'}`}>{o.l}</p>
              <p className="text-xs font-body text-n-400 mt-0.5">{o.s}</p>
            </div>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${v===o.k?'border-ocean-700 bg-ocean-700':'border-n-300'}`}>
              {v===o.k && <div className="w-2 h-2 bg-white rounded-full" />}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

// â”€â”€ Success screen â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function BS({ resId, lang, type, onClose }) {
  const T = { hotel:{pt:'Quarto reservado!',en:'Room booked!'},activity:{pt:'Tour reservado!',en:'Tour booked!'},rentacar:{pt:'Viatura reservada!',en:'Vehicle reserved!'},restaurant:{pt:'Mesa reservada!',en:'Table reserved!'} };
  const m = T[type] || T.activity;
  return (
    <div className="text-center py-8 px-4">
      <div className="w-16 h-16 rounded-full bg-success-light flex items-center justify-center mx-auto mb-4">
        <Check size={28} strokeWidth={2.5} className="text-success" />
      </div>
      <h3 className="font-display font-bold text-xl text-n-900 mb-3">{lang==='en'?m.en:m.pt}</h3>
      <p className="text-sm font-body text-n-500 leading-relaxed mb-6 max-w-xs mx-auto">
        {lang==='en'?'You will receive a confirmation email shortly. The operator will confirm within 24h.':'ReceberÃ¡ um email de confirmaÃ§Ã£o em breve. O operador confirmarÃ¡ a sua reserva em 24h.'}
      </p>
      {resId && (
        <div className="bg-n-50 border border-n-200 rounded-xl px-4 py-3 inline-block mb-6">
          <p className="text-xs text-n-400 font-body mb-1">{lang==='en'?'Booking reference':'ReferÃªncia da reserva'}</p>
          <p className="font-mono font-bold text-n-800 text-sm tracking-widest">{resId.slice(0,8).toUpperCase()}</p>
        </div>
      )}
      <button onClick={onClose} className="border-2 border-n-200 text-n-700 font-body font-semibold py-3 px-8 rounded-xl hover:border-ocean-700 hover:text-ocean-700 transition-all">
        {lang==='en'?'Close':'Fechar'}
      </button>
    </div>
  );
}

// â”€â”€ Modal shell â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function MS({ icon, title, step, lang, onClose, children, onPrev, onNext, nextLabel, nextDis, sub, err, ok }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ocean-900/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-[480px] rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {!ok && (
          <div className="flex-shrink-0 px-5 pt-5 pb-4 border-b border-n-100">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-ocean-50 flex items-center justify-center text-ocean-700 flex-shrink-0">{icon}</div>
                <div>
                  <p className="font-display font-bold text-n-900 text-sm leading-snug">{title}</p>
                  <p className="text-xs font-body text-n-400 mt-0.5">{lang==='en'?`Step ${step} of 3`:`Passo ${step} de 3`}</p>
                </div>
              </div>
              <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-n-400 hover:text-n-700 hover:bg-n-100 transition-all mt-0.5 flex-shrink-0">
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>
            <div className="flex gap-1.5">
              {[1,2,3].map(s => <div key={s} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${s<=step?'bg-ocean-700':'bg-n-200'}`} />)}
            </div>
          </div>
        )}
        <div className="flex-1 overflow-y-auto">{children}</div>
        {!ok && (
          <div className="flex-shrink-0 px-5 py-4 border-t border-n-100">
            {err && <p className="text-xs text-error font-body text-center mb-3 bg-error-light rounded-lg px-3 py-2">{err}</p>}
            <div className="flex gap-3">
              {step > 1 && (
                <button type="button" onClick={onPrev}
                  className="flex-1 border-2 border-n-200 text-n-700 font-body font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-1.5 hover:border-ocean-700 hover:text-ocean-700 transition-all">
                  <ChevronLeft size={15} strokeWidth={2.5} />{lang==='en'?'Back':'Anterior'}
                </button>
              )}
              <button type="button" onClick={onNext} disabled={nextDis || sub}
                className={`font-body font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-ocean-700 text-white hover:bg-ocean-500 ${step===1?'w-full':'flex-[2]'}`}>
                {sub
                  ? <><div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />{lang==='en'?'Please wait...':'A aguardar...'}</>
                  : <>{nextLabel}<ArrowRight size={15} strokeWidth={2.5} /></>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// â”€â”€ Submit helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function postReservation(slug, payload) {
  const r = await fetch(`${API}/public/${slug}/reservations`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || 'Erro ao submeter reserva');
  return j.data?.id || 'ok';
}

/* â”€â”€ HotelModal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function HotelModal({ unit, op, slug, lang, onClose }) {
  const [step, ss]     = useState(1);
  const [ci, sci]      = useState('');
  const [co, sco]      = useState('');
  const [adults, sa]   = useState(2);
  const [kids, sk]     = useState(0);
  const [info, si]     = useState({ name:'', email:'', phone:'', country:'', notes:'' });
  const [pay, sp]      = useState('cash');
  const [sub, ssub]    = useState(false);
  const [resId, sr]    = useState(null);
  const [err, se]      = useState('');
  const [avail, sav]   = useState(null);
  const [chk, sc]      = useState(false);

  const nights  = nts(ci, co);
  const total   = nights > 0 && unit.base_price ? fmtPrice(nights * unit.base_price, null, op.currency||'EUR', 'EUR', lang) : null;

  useEffect(() => {
    if (!ci || !co || co <= ci) { sav(null); return; }
    const t = setTimeout(async () => {
      sc(true);
      try { sav((await (await fetch(`${API}/public/${slug}/availability?unitId=${unit.id}&checkIn=${ci}&checkOut=${co}`)).json()).data); }
      catch { sav(null); } finally { sc(false); }
    }, 700);
    return () => clearTimeout(t);
  }, [ci, co]);

  function valid() {
    if (step===1) {
      if (!ci||!co)  { se(lang==='en'?'Select both dates':'Seleccione ambas as datas'); return false; }
      if (co<=ci)    { se(lang==='en'?'Check-out must be after check-in':'Check-out deve ser posterior ao check-in'); return false; }
      if (!avail?.disponivel) { se(lang==='en'?'Room unavailable for these dates':'Quarto indisponÃ­vel nestas datas'); return false; }
    }
    if (step===2 && (!info.name||!info.email)) { se(lang==='en'?'Name and email required':'Nome e email obrigatÃ³rios'); return false; }
    se(''); return true;
  }

  async function submit() {
    ssub(true); se('');
    try {
      const notes = [`${adults} ${lang==='en'?'adults':'adultos'}, ${kids} ${lang==='en'?'children':'crianÃ§as'}`, info.notes].filter(Boolean).join('. ');
      sr(await postReservation(slug, { unit_id:unit.id, customer_name:info.name, customer_email:info.email, customer_phone:info.phone||null, customer_country:info.country||null, check_in:ci, check_out:co, guests:adults+kids, notes }));
    } catch(e) { se(e.message); } finally { ssub(false); }
  }

  function next() { if (!valid()) return; step<3 ? ss(s=>s+1) : submit(); }
  const nl = step<3 ? (lang==='en'?'Continue':'Continuar') : (lang==='en'?'Confirm booking':'Confirmar reserva');
  const icon = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M2 22V10a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12"/><path d="M2 22h20"/><path d="M7 22v-4h10v4"/><rect x="7" y="10" width="4" height="4" rx="1"/><rect x="13" y="10" width="4" height="4" rx="1"/></svg>;
  const sumL = [
    { label:lang==='en'?'Room':'Quarto',      value:unit.name },
    { label:'Check-in',                        value:ci },
    { label:'Check-out',                       value:co },
    { label:lang==='en'?'Nights':'Noites',     value:`${nights}` },
    { label:lang==='en'?'Guests':'HÃ³spedes',   value:`${adults} ${lang==='en'?'adults':'adultos'}${kids>0?` + ${kids} ${lang==='en'?'children':'crianÃ§as'}`:''}`},
    ...(total ? [{ label:'Total', value:total, hi:true }] : []),
  ];

  const today = TODAY_STR();
  return (
    <MS icon={icon} title={lang==='en'?'Book room':'Reservar quarto'} step={step} lang={lang} onClose={onClose}
        onPrev={() => ss(s=>s-1)} onNext={next} nextLabel={nl} nextDis={step===1&&(!avail?.disponivel||chk)} sub={sub} err={err} ok={!!resId}>
      {resId ? <div className="p-5"><BS resId={resId} lang={lang} type="hotel" onClose={onClose} /></div>
      : step===1 ? (
        <div className="p-5 space-y-4">
          <p className={SH}>{lang==='en'?'Select dates & guests':'Seleccione datas e hÃ³spedes'}</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LB}>Check-in *</label>
              <input type="date" className={IN} min={today} value={ci} onChange={e=>sci(e.target.value)} />
            </div>
            <div>
              <label className={LB}>Check-out *</label>
              <input type="date" className={IN} min={ci||today} value={co} onChange={e=>sco(e.target.value)} />
            </div>
          </div>
          {nights > 0 && (
            <div className="flex justify-between items-center bg-ocean-50 border border-ocean-100 rounded-xl px-4 py-2.5">
              <span className="text-sm font-body font-semibold text-ocean-700">{nights} {lang==='en'?(nights===1?'night':'nights'):(nights===1?'noite':'noites')}</span>
              {total && <span className="font-display font-bold text-ocean-700 text-sm">{total}</span>}
            </div>
          )}
          {(chk || avail) && (
            <div className={`rounded-xl px-4 py-3 flex items-center gap-2 text-sm font-body font-semibold ${chk?'bg-n-50 text-n-400':avail?.disponivel?'bg-success-light text-success':'bg-error-light text-error'}`}>
              {chk ? <><div className="w-3.5 h-3.5 rounded-full border-2 border-ocean-300 border-t-ocean-700 animate-spin flex-shrink-0" />{lang==='en'?'Checking availability...':'A verificar disponibilidade...'}</>
                   : <>{avail?.disponivel?(lang==='en'?'Available':'DisponÃ­vel'):(lang==='en'?'Not available for these dates':'IndisponÃ­vel nestas datas')}</>}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Cnt label={lang==='en'?'Adults (1-10)':'Adultos (1-10)'} val={adults} set={sa} min={1} max={10} />
            <Cnt label={lang==='en'?'Children (0-5)':'CrianÃ§as (0-5)'} val={kids} set={sk} min={0} max={5} />
          </div>
        </div>
      ) : step===2 ? (
        <div className="p-5">
          <p className={SH}>{lang==='en'?'Guest details':'Dados do hÃ³spede'}</p>
          <GF d={info} set={si} lang={lang}>
            <div>
              <label className={LB}>{lang==='en'?'Special requests (optional)':'Pedidos especiais (opcional)'}</label>
              <textarea className={IN+' resize-none'} rows={3} value={info.notes}
                onChange={e=>si(i=>({...i,notes:e.target.value}))}
                placeholder={lang==='en'?'Early check-in, late check-out, high floor, quiet room...':'Early check-in, late check-out, andar alto, quarto silencioso...'} />
            </div>
          </GF>
        </div>
      ) : (
        <div className="p-5 space-y-4">
          <p className={SH}>{lang==='en'?'Review & payment':'Resumo e pagamento'}</p>
          <ST lines={sumL} />
          <p className="text-xs font-body font-semibold text-n-700">{lang==='en'?'Payment method':'MÃ©todo de pagamento'}</p>
          <PO lang={lang} v={pay} set={sp} />
        </div>
      )}
    </MS>
  );
}

/* â”€â”€ ActivityModal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function ActivityModal({ unit, op, slug, lang, onClose }) {
  const [step, ss]    = useState(1);
  const [date, sd]    = useState('');
  const [time, st]    = useState('');
  const [adults, sa]  = useState(2);
  const [kids, sk]    = useState(0);
  const [info, si]    = useState({ name:'', email:'', phone:'', country:'', needs:'' });
  const [pay, sp]     = useState('cash');
  const [sub, ssub]   = useState(false);
  const [resId, sr]   = useState(null);
  const [err, se]     = useState('');

  const total = unit.base_price
    ? fmtPrice((adults + kids) * unit.base_price, 'person', op.currency||'EUR', 'EUR', lang)
    : null;

  function valid() {
    if (step===1) {
      if (!date)        { se(lang==='en'?'Select a date':'Seleccione uma data'); return false; }
      if (!time)        { se(lang==='en'?'Select a time slot':'Seleccione um horÃ¡rio'); return false; }
      if (adults < 1)   { se(lang==='en'?'At least 1 adult required':'MÃ­nimo 1 adulto'); return false; }
    }
    if (step===2 && (!info.name||!info.email)) { se(lang==='en'?'Name and email required':'Nome e email obrigatÃ³rios'); return false; }
    se(''); return true;
  }

  async function submit() {
    ssub(true); se('');
    try {
      const notes = [`${lang==='en'?'Time':'Hora'}: ${time}`, `${adults} ${lang==='en'?'adults':'adultos'}, ${kids} ${lang==='en'?'children':'crianÃ§as'}`, info.needs ? (lang==='en'?'Needs:':'Necessidades:')+' '+info.needs : ''].filter(Boolean).join('. ');
      sr(await postReservation(slug, { unit_id:unit.id, customer_name:info.name, customer_email:info.email, customer_phone:info.phone||null, customer_country:info.country||null, check_in:date, check_out:date, guests:adults+kids, notes }));
    } catch(e) { se(e.message); } finally { ssub(false); }
  }

  function next() { if (!valid()) return; step<3 ? ss(s=>s+1) : submit(); }
  const nl = step<3 ? (lang==='en'?'Continue':'Continuar') : (lang==='en'?'Confirm booking':'Confirmar reserva');
  const today = TODAY_STR();
  const sumL = [
    { label:lang==='en'?'Tour / Activity':'Tour / Actividade', value:unit.name },
    { label:lang==='en'?'Date':'Data', value:date },
    { label:lang==='en'?'Time':'HorÃ¡rio', value:time },
    { label:lang==='en'?'Group':'Grupo', value:`${adults} ${lang==='en'?'adults':'adultos'}${kids>0?` + ${kids} ${lang==='en'?'children':'crianÃ§as'}`:''}`},
    ...(total ? [{ label:'Total', value:total, hi:true }] : []),
  ];

  return (
    <MS icon={<Compass size={18} strokeWidth={1.75} />} title={lang==='en'?'Book tour':'Reservar tour'} step={step} lang={lang} onClose={onClose}
        onPrev={() => ss(s=>s-1)} onNext={next} nextLabel={nl} nextDis={step===1&&(!date||!time)} sub={sub} err={err} ok={!!resId}>
      {resId ? <div className="p-5"><BS resId={resId} lang={lang} type="activity" onClose={onClose} /></div>
      : step===1 ? (
        <div className="p-5 space-y-4">
          <p className={SH}>{lang==='en'?'Select date, time & group':'Seleccione data, horÃ¡rio e grupo'}</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LB}>{lang==='en'?'Date':'Data'} *</label>
              <input type="date" className={IN} min={today} value={date} onChange={e=>sd(e.target.value)} />
            </div>
            <div>
              <label className={LB}>{lang==='en'?'Time slot':'HorÃ¡rio'} *</label>
              <select className={SEL} value={time} onChange={e=>st(e.target.value)}>
                <option value="">{lang==='en'?'-- Select --':'-- Seleccionar --'}</option>
                {TOUR_SLOTS.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>
          {total && (date||adults) && (
            <div className="flex justify-between items-center bg-ocean-50 border border-ocean-100 rounded-xl px-4 py-2.5">
              <span className="text-xs font-body text-ocean-600">{adults+kids} {lang==='en'?'people':'pessoas'}</span>
              <span className="font-display font-bold text-ocean-700 text-sm">{total}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Cnt label={lang==='en'?'Adults (1-20)':'Adultos (1-20)'} val={adults} set={sa} min={1} max={20} />
            <Cnt label={lang==='en'?'Children (0-10)':'CrianÃ§as (0-10)'} val={kids} set={sk} min={0} max={10} />
          </div>
        </div>
      ) : step===2 ? (
        <div className="p-5">
          <p className={SH}>{lang==='en'?'Contact details':'Dados de contacto'}</p>
          <GF d={info} set={si} lang={lang}>
            <div>
              <label className={LB}>{lang==='en'?'Special needs (optional)':'Necessidades especiais (opcional)'}</label>
              <textarea className={IN+' resize-none'} rows={3} value={info.needs}
                onChange={e=>si(i=>({...i,needs:e.target.value}))}
                placeholder={lang==='en'?'Wheelchair accessible, vegetarian, allergies...':'Cadeira de rodas, vegetariano, alergias alimentares...'} />
            </div>
          </GF>
        </div>
      ) : (
        <div className="p-5 space-y-4">
          <p className={SH}>{lang==='en'?'Review & payment':'Resumo e pagamento'}</p>
          <ST lines={sumL} />
          <p className="text-xs font-body font-semibold text-n-700">{lang==='en'?'Payment method':'MÃ©todo de pagamento'}</p>
          <PO lang={lang} v={pay} set={sp} />
        </div>
      )}
    </MS>
  );
}

/* â”€â”€ RentACarModal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function RentACarModal({ unit, op, slug, lang, onClose }) {
  const [step, ss]    = useState(1);
  const [pu, spu]     = useState({ date:'', time:'09:00', loc:'' });
  const [re, sre]     = useState({ date:'', time:'09:00', loc:'' });
  const [drv, sd]     = useState({ name:'', email:'', phone:'', country:'', license:'', licCountry:'', age:'' });
  const [ext, sex]    = useState({ insurance:false, gps:false, baby_seat:false, extra_driver:false });
  const [pay, sp]     = useState('cash');
  const [sub, ssub]   = useState(false);
  const [resId, sr]   = useState(null);
  const [err, se]     = useState('');

  const days    = dys(pu.date, re.date);
  const total   = days > 0 && unit.base_price ? fmtPrice(days * unit.base_price, 'day', op.currency||'EUR', 'EUR', lang) : null;
  const locs    = lang==='en' ? CV_LOCS_EN : CV_LOCS_PT;
  const extList = CAR_EXTRAS.filter(e => ext[e.k]);

  function valid() {
    if (step===1) {
      if (!pu.date||!re.date) { se(lang==='en'?'Select pickup and return dates':'Seleccione datas de levantamento e devoluÃ§Ã£o'); return false; }
      if (re.date <= pu.date) { se(lang==='en'?'Return date must be after pickup':'Data de devoluÃ§Ã£o deve ser posterior ao levantamento'); return false; }
      if (!pu.loc)            { se(lang==='en'?'Select pickup location':'Seleccione o local de levantamento'); return false; }
    }
    if (step===2) {
      if (!drv.name||!drv.email) { se(lang==='en'?'Name and email required':'Nome e email obrigatÃ³rios'); return false; }
      if (!drv.license)          { se(lang==='en'?'Driving licence number required':'NÃºmero de carta de conduÃ§Ã£o obrigatÃ³rio'); return false; }
    }
    se(''); return true;
  }

  async function submit() {
    ssub(true); se('');
    try {
      const extNames = extList.map(e => lang==='en'?e.en:e.pt).join(', ');
      const notes = [
        `${lang==='en'?'Pickup':'Levantamento'}: ${pu.loc} ${pu.date} ${pu.time}`,
        `${lang==='en'?'Return':'DevoluÃ§Ã£o'}: ${re.loc||pu.loc} ${re.date} ${re.time}`,
        `${lang==='en'?'Driver':'Condutor'}: ${drv.age?`${drv.age}${lang==='en'?' years old':' anos'}, `:''} ${lang==='en'?'Licence:':'Carta:'} ${drv.license} (${drv.licCountry||''})`,
        extNames ? `${lang==='en'?'Extras':'Extras'}: ${extNames}` : '',
      ].filter(Boolean).join('. ');
      sr(await postReservation(slug, { unit_id:unit.id, customer_name:drv.name, customer_email:drv.email, customer_phone:drv.phone||null, customer_country:drv.country||null, check_in:pu.date, check_out:re.date, guests:1, notes }));
    } catch(e) { se(e.message); } finally { ssub(false); }
  }

  function next() { if (!valid()) return; step<3 ? ss(s=>s+1) : submit(); }
  const nl  = step<3 ? (lang==='en'?'Continue':'Continuar') : (lang==='en'?'Confirm booking':'Confirmar reserva');
  const today = TODAY_STR();
  const sumL = [
    { label:lang==='en'?'Vehicle':'Viatura',     value:unit.name },
    { label:lang==='en'?'Pickup':'Levantamento', value:`${pu.date} ${pu.time} Â· ${pu.loc}` },
    { label:lang==='en'?'Return':'DevoluÃ§Ã£o',    value:`${re.date} ${re.time} Â· ${re.loc||pu.loc}` },
    { label:lang==='en'?'Duration':'DuraÃ§Ã£o',    value:`${days} ${lang==='en'?(days===1?'day':'days'):(days===1?'dia':'dias')}` },
    ...(extList.length ? [{ label:lang==='en'?'Extras':'Extras', value:extList.map(e=>lang==='en'?e.en:e.pt).join(' Â· ') }] : []),
    ...(total ? [{ label:'Total', value:total, hi:true }] : []),
  ];

  return (
    <MS icon={<Car size={18} strokeWidth={1.75} />} title={lang==='en'?'Book vehicle':'Reservar viatura'} step={step} lang={lang} onClose={onClose}
        onPrev={() => ss(s=>s-1)} onNext={next} nextLabel={nl} nextDis={step===1&&(!pu.date||!re.date||!pu.loc)} sub={sub} err={err} ok={!!resId}>
      {resId ? <div className="p-5"><BS resId={resId} lang={lang} type="rentacar" onClose={onClose} /></div>
      : step===1 ? (
        <div className="p-5 space-y-4">
          <p className={SH}>{lang==='en'?'Pickup & return details':'Levantamento e devoluÃ§Ã£o'}</p>
          <div>
            <p className="text-xs font-body font-bold text-ocean-700 uppercase tracking-widest mb-3">{lang==='en'?'Pickup':'Levantamento'}</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className={LB}>{lang==='en'?'Date':'Data'} *</label>
                <input type="date" className={IN} min={today} value={pu.date} onChange={e=>spu(p=>({...p,date:e.target.value}))} />
              </div>
              <div>
                <label className={LB}>{lang==='en'?'Time':'Hora'}</label>
                <input type="time" className={IN} value={pu.time} onChange={e=>spu(p=>({...p,time:e.target.value}))} />
              </div>
            </div>
            <div>
              <label className={LB}>{lang==='en'?'Location':'Local'} *</label>
              <select className={SEL} value={pu.loc} onChange={e=>spu(p=>({...p,loc:e.target.value}))}>
                <option value="">{lang==='en'?'-- Select location --':'-- Seleccionar local --'}</option>
                {locs.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>
          <div>
            <p className="text-xs font-body font-bold text-ocean-700 uppercase tracking-widest mb-3">{lang==='en'?'Return':'DevoluÃ§Ã£o'}</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className={LB}>{lang==='en'?'Date':'Data'} *</label>
                <input type="date" className={IN} min={pu.date||today} value={re.date} onChange={e=>sre(p=>({...p,date:e.target.value}))} />
              </div>
              <div>
                <label className={LB}>{lang==='en'?'Time':'Hora'}</label>
                <input type="time" className={IN} value={re.time} onChange={e=>sre(p=>({...p,time:e.target.value}))} />
              </div>
            </div>
            <div>
              <label className={LB}>{lang==='en'?'Location (leave blank if same)':'Local (deixar em branco se igual)'}</label>
              <select className={SEL} value={re.loc} onChange={e=>sre(p=>({...p,loc:e.target.value}))}>
                <option value="">{lang==='en'?'Same as pickup':'Mesmo local de levantamento'}</option>
                {locs.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>
          {days > 0 && (
            <div className="flex justify-between items-center bg-ocean-50 border border-ocean-100 rounded-xl px-4 py-2.5">
              <span className="text-sm font-body font-semibold text-ocean-700">{days} {lang==='en'?(days===1?'day':'days'):(days===1?'dia':'dias')}</span>
              {total && <span className="font-display font-bold text-ocean-700 text-sm">{total}</span>}
            </div>
          )}
        </div>
      ) : step===2 ? (
        <div className="p-5 space-y-4">
          <p className={SH}>{lang==='en'?'Driver details':'Dados do condutor'}</p>
          <GF d={drv} set={sd} lang={lang}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LB}>{lang==='en'?'Driving licence no.':'NÂº carta de conduÃ§Ã£o'} *</label>
                <input className={IN} value={drv.license} onChange={e=>sd(d=>({...d,license:e.target.value}))} required placeholder="PT-123456" />
              </div>
              <div>
                <label className={LB}>{lang==='en'?'Issuing country':'PaÃ­s emissor'}</label>
                <input className={IN} value={drv.licCountry} onChange={e=>sd(d=>({...d,licCountry:e.target.value}))} placeholder="Portugal" />
              </div>
            </div>
            <div>
              <label className={LB}>{lang==='en'?'Driver age':'Idade do condutor'}</label>
              <input className={IN} type="number" min={18} max={99} value={drv.age} onChange={e=>sd(d=>({...d,age:e.target.value}))} placeholder="28" />
            </div>
          </GF>
          <div>
            <p className="text-xs font-body font-bold text-n-700 mb-3">{lang==='en'?'Extras (optional)':'Extras (opcional)'}</p>
            <div className="grid grid-cols-2 gap-2.5">
              {CAR_EXTRAS.map(e => (
                <button key={e.k} type="button" onClick={() => sex(x=>({...x,[e.k]:!x[e.k]}))}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${ext[e.k]?'border-ocean-700 bg-ocean-50':'border-n-200 hover:border-n-300'}`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${ext[e.k]?'border-ocean-700 bg-ocean-700':'border-n-300'}`}>
                      {ext[e.k] && <Check size={10} strokeWidth={3} className="text-white" />}
                    </div>
                    <span className={`text-xs font-body font-semibold ${ext[e.k]?'text-ocean-700':'text-n-700'}`}>{lang==='en'?e.en:e.pt}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-5 space-y-4">
          <p className={SH}>{lang==='en'?'Review & payment':'Resumo e pagamento'}</p>
          <ST lines={sumL} />
          <p className="text-xs font-body font-semibold text-n-700">{lang==='en'?'Payment method':'MÃ©todo de pagamento'}</p>
          <PO lang={lang} v={pay} set={sp} />
        </div>
      )}
    </MS>
  );
}

/* â”€â”€ RestaurantModal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function RestaurantModal({ unit, op, slug, lang, onClose }) {
  const [step, ss]     = useState(1);
  const [date, sd]     = useState('');
  const [time, st]     = useState('');
  const [party, spa]   = useState(2);
  const [occasion, so] = useState('');
  const [info, si]     = useState({ name:'', email:'', phone:'', country:'', notes:'' });
  const [sub, ssub]    = useState(false);
  const [resId, sr]    = useState(null);
  const [err, se]      = useState('');

  function valid() {
    if (step===1) {
      if (!date) { se(lang==='en'?'Select a date':'Seleccione uma data'); return false; }
      if (!time) { se(lang==='en'?'Select a time':'Seleccione um horÃ¡rio'); return false; }
    }
    if (step===2 && (!info.name||!info.email)) { se(lang==='en'?'Name and email required':'Nome e email obrigatÃ³rios'); return false; }
    se(''); return true;
  }

  async function submit() {
    ssub(true); se('');
    try {
      const occLabel = OCCASIONS.find(o=>o.v===occasion)?.[lang==='en'?'en':'pt'] || '';
      const notes = [
        time ? `${lang==='en'?'Time':'Hora'}: ${time}` : '',
        occLabel && occasion ? `${lang==='en'?'Occasion':'OcasiÃ£o'}: ${occLabel}` : '',
        info.notes,
      ].filter(Boolean).join('. ');
      sr(await postReservation(slug, { unit_id:unit.id, customer_name:info.name, customer_email:info.email, customer_phone:info.phone||null, customer_country:info.country||null, check_in:date, check_out:date, guests:party, notes }));
    } catch(e) { se(e.message); } finally { ssub(false); }
  }

  function next() { if (!valid()) return; step<3 ? ss(s=>s+1) : submit(); }
  const nl  = step<3 ? (lang==='en'?'Continue':'Continuar') : (lang==='en'?'Confirm reservation':'Confirmar reserva');
  const today = TODAY_STR();
  const occLabel = OCCASIONS.find(o=>o.v===occasion)?.[lang==='en'?'en':'pt'] || '';
  const sumL = [
    { label:lang==='en'?'Restaurant':'Restaurante', value:unit.name },
    { label:lang==='en'?'Date':'Data',   value:date },
    { label:lang==='en'?'Time':'Hora',   value:time },
    { label:lang==='en'?'Guests':'Pessoas', value:`${party}` },
    ...(occasion ? [{ label:lang==='en'?'Occasion':'OcasiÃ£o', value:occLabel }] : []),
  ];

  return (
    <MS icon={<Utensils size={18} strokeWidth={1.75} />} title={lang==='en'?'Book table':'Reservar mesa'} step={step} lang={lang} onClose={onClose}
        onPrev={() => ss(s=>s-1)} onNext={next} nextLabel={nl} nextDis={step===1&&(!date||!time)} sub={sub} err={err} ok={!!resId}>
      {resId ? <div className="p-5"><BS resId={resId} lang={lang} type="restaurant" onClose={onClose} /></div>
      : step===1 ? (
        <div className="p-5 space-y-4">
          <p className={SH}>{lang==='en'?'Date, time & party size':'Data, hora e nÃºmero de pessoas'}</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LB}>{lang==='en'?'Date':'Data'} *</label>
              <input type="date" className={IN} min={today} value={date} onChange={e=>sd(e.target.value)} />
            </div>
            <div>
              <label className={LB}>{lang==='en'?'Time':'Hora'} *</label>
              <select className={SEL} value={time} onChange={e=>st(e.target.value)}>
                <option value="">{lang==='en'?'-- Select --':'-- Seleccionar --'}</option>
                {REST_SLOTS.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>
          <Cnt label={lang==='en'?'Number of guests (1-20)':'NÃºmero de pessoas (1-20)'} val={party} set={spa} min={1} max={20} />
          <div>
            <label className={LB}>{lang==='en'?'Special occasion':'OcasiÃ£o especial'}</label>
            <select className={SEL} value={occasion} onChange={e=>so(e.target.value)}>
              {OCCASIONS.map(o => <option key={o.v} value={o.v}>{lang==='en'?o.en:o.pt}</option>)}
            </select>
          </div>
        </div>
      ) : step===2 ? (
        <div className="p-5">
          <p className={SH}>{lang==='en'?'Contact details':'Dados de contacto'}</p>
          <GF d={info} set={si} lang={lang}>
            <div>
              <label className={LB}>{lang==='en'?'Special requests (allergies, dietary, decoration...)':'Pedidos especiais (alergias, vegetariano, decoraÃ§Ã£o...)'}</label>
              <textarea className={IN+' resize-none'} rows={3} value={info.notes}
                onChange={e=>si(i=>({...i,notes:e.target.value}))}
                placeholder={lang==='en'?'Vegetarian menu, allergy to nuts, birthday cake...':'Menu vegetariano, alergia a frutos secos, bolo de aniversÃ¡rio...'} />
            </div>
          </GF>
        </div>
      ) : (
        <div className="p-5 space-y-4">
          <p className={SH}>{lang==='en'?'Confirm reservation':'Confirmar reserva'}</p>
          <ST lines={sumL} />
          <div className="bg-sand-50 border border-sand-200 rounded-xl px-4 py-3 text-sm font-body text-n-700 leading-relaxed">
            <span className="font-semibold text-sand-700">{lang==='en'?'No advance payment required.':'Sem pagamento antecipado.'}</span>
            {' '}{lang==='en'?'Payment on arrival. We will confirm your reservation within 2 hours.':'Pagamento Ã  chegada. Confirmaremos a sua reserva em 2 horas.'}
          </div>
        </div>
      )}
    </MS>
  );
}

/* â”€â”€ BookingModal dispatcher â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function BookingModal({ unit, op, slug, lang, onClose }) {
  if (!unit || !op) return null;
  const t = op.operator_type;
  const props = { unit, op, slug, lang, onClose };
  if (t === 'hotel')      return <HotelModal {...props} />;
  if (t === 'activity')   return <ActivityModal {...props} />;
  if (t === 'rentacar')   return <RentACarModal {...props} />;
  if (t === 'restaurant') return <RestaurantModal {...props} />;
  return <ActivityModal {...props} />; /* fallback */
}


/* â”€â”€ Lightbox â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

/* â”€â”€ ChatWidget â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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
              <span className="text-xs font-body">{lang === 'en' ? 'Online' : 'Online'}</span>
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
                {lang === 'en' ? 'Hello! How can I help you?' : 'OlÃ¡! Como posso ajudar?'}
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

/* â”€â”€ Not Found â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-n-50 p-6 text-center">
      <Logo size="lg" />
      <div className="mt-8 max-w-sm">
        <h2 className="font-display font-bold text-xl text-n-900 mb-3">PÃ¡gina nÃ£o encontrada</h2>
        <p className="text-sm font-body text-n-500 leading-relaxed mb-6">
          Este link de reserva nÃ£o existe ou o operador ainda nÃ£o estÃ¡ activo na plataforma.
        </p>
        <a href="https://saldesk.cv/discover/"
          className="inline-flex items-center gap-2 bg-ocean-700 text-white font-body font-semibold px-6 py-3 rounded-xl hover:bg-ocean-500 transition-colors text-sm">
          Explorar operadores
        </a>
      </div>
    </div>
  );
}

/* â”€â”€ Skeleton â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   MAIN COMPONENT
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
export default function PublicBooking() {
  const { slug } = useParams();

  const [op, setOp]             = useState(null);
  const [units, setUnits]       = useState([]);
  const [reviews, setReviews]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [lang, setLang]         = useState(() => localStorage.getItem('sd-lang') || 'pt');
  const [currency, setCur]      = useState('EUR');
  const [bookUnit, setBook]     = useState(null);
  const [lbIdx, setLbIdx]       = useState(null);
  const [navScrolled, setNavScrolled] = useState(false);
  const [mobileMenu, setMobileMenu]   = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' });
  const [contactSent, setContactSent] = useState(false);
  const [viewerCount]           = useState(() => 8 + Math.floor(Math.abs(slug.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % 40));
  const [faqOpen, setFaqOpen]   = useState(null);
  const [copied, setCopied]     = useState(false);

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

  /* Lang sync */
  function toggleLang() {
    const nl = lang === 'pt' ? 'en' : 'pt';
    setLang(nl); localStorage.setItem('sd-lang', nl);
    document.documentElement.setAttribute('data-lang', nl);
  }

  function scrollTo(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setMobileMenu(false);
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

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  }

  if (loading)  return <SkeletonPage />;
  if (notFound) return <NotFoundPage />;

  const galleryImgs = [
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
    ? `https://wa.me/${op.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(lang === 'en' ? `Hello, I saw your profile on SalDesk and would like to know more about ${op.name}.` : `OlÃ¡, vi o vosso perfil no SalDesk e gostaria de saber mais sobre ${op.name}.`)}`
    : null;

  const isTopRated    = avgRating >= 4.5 && reviews.length >= 3;
  const isVerified    = !!op.onboarding_complete;

  const navLinks = [
    { id: 'home',       pt: 'InÃ­cio',     en: 'Home'     },
    { id: 'servicos',   pt: 'ServiÃ§os',   en: 'Services' },
    { id: 'galeria',    pt: 'Galeria',    en: 'Gallery'  },
    { id: 'avaliacoes', pt: 'AvaliaÃ§Ãµes', en: 'Reviews'  },
    { id: 'contacto',   pt: 'Contacto',   en: 'Contact'  },
  ];

  const FAQ_ITEMS = [
    {
      q: lang === 'en' ? 'How do I book?' : 'Como faÃ§o uma reserva?',
      a: lang === 'en' ? 'Select a service, choose your dates, fill in your details and choose a payment method. You\'ll receive a confirmation by email.' : 'Seleccione um serviÃ§o, escolha as datas, preencha os seus dados e escolha o mÃ©todo de pagamento. ReceberÃ¡ uma confirmaÃ§Ã£o por email.',
    },
    {
      q: lang === 'en' ? 'Can I cancel my booking?' : 'Posso cancelar a minha reserva?',
      a: lang === 'en' ? 'Please contact us via WhatsApp or email to discuss cancellation options for your booking.' : 'Por favor contacte-nos via WhatsApp ou email para discutir as opÃ§Ãµes de cancelamento da sua reserva.',
    },
    {
      q: lang === 'en' ? 'What payment methods are accepted?' : 'Quais os mÃ©todos de pagamento aceites?',
      a: lang === 'en' ? 'We accept international cards via PayPal, Cape Verdean cards via SISP Vinti4, and cash or card on arrival.' : 'Aceitamos cartÃ£o internacional via PayPal, cartÃ£o cabo-verdiano via SISP Vinti4, e dinheiro ou cartÃ£o no local.',
    },
  ];

  return (
    <div className="min-h-screen bg-white">

      {/* â”€â”€ Navbar â”€â”€ */}
      <nav className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${navScrolled ? 'bg-white shadow-md' : 'bg-transparent'}`}>
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <a href={`/book/${slug}`} className="flex items-center gap-2 flex-shrink-0">
            {op.logo_url ? (
              <img src={op.logo_url} alt={op.name} className={`h-9 w-auto object-contain ${navScrolled ? '' : 'brightness-0 invert'}`} />
            ) : (
              <Logo size="sm" white={!navScrolled} />
            )}
          </a>

          {/* Desktop nav links */}
          <div className={`hidden md:flex items-center gap-6 ${navScrolled ? '' : ''}`}>
            {navLinks.map(l => (
              <button key={l.id} onClick={() => scrollTo(l.id)}
                className={`text-sm font-body font-medium transition-colors ${navScrolled ? 'text-n-600 hover:text-ocean-700' : 'text-white/85 hover:text-white'}`}>
                {lang === 'pt' ? l.pt : l.en}
              </button>
            ))}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <button onClick={toggleLang}
              className={`hidden sm:flex items-center gap-1 text-xs font-body font-bold border rounded-full px-3 py-1.5 transition-all ${navScrolled ? 'border-n-200 text-n-600 hover:border-ocean-700 hover:text-ocean-700' : 'border-white/30 text-white/80 hover:border-white hover:text-white'}`}>
              <Globe size={12} strokeWidth={1.75} />
              {lang === 'pt' ? 'EN' : 'PT'}
            </button>
            <button onClick={() => setBook(units[0] || null)}
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

        {/* Mobile drawer */}
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

      {/* â”€â”€ Hero â”€â”€ */}
      <section id="home">
        <div className="relative">
          <HeroCarousel images={op.images || []} />
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
              </div>
              <h1 className="font-display font-extrabold text-white text-3xl sm:text-5xl leading-tight mb-3 drop-shadow-md tracking-tight">
                {op.name}
              </h1>
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
                      {avgRating.toFixed(1)} ({reviews.length} {lang === 'en' ? 'reviews' : 'avaliaÃ§Ãµes'})
                    </span>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                <button onClick={() => setBook(units[0] || null)}
                  className="flex items-center gap-2 bg-sand-500 text-white font-body font-bold px-6 py-3 rounded-full hover:bg-sand-600 transition-all shadow-lg text-sm">
                  <Calendar size={16} strokeWidth={1.75} />
                  {lang === 'en' ? 'Book Now' : 'Reservar Agora'}
                </button>
                <button onClick={() => scrollTo('servicos')}
                  className="flex items-center gap-2 bg-white/15 backdrop-blur-sm border border-white/30 text-white font-body font-semibold px-6 py-3 rounded-full hover:bg-white/25 transition-all text-sm">
                  {lang === 'en' ? 'View Services' : 'Ver ServiÃ§os'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* â”€â”€ Urgency strip â”€â”€ */}
      <div className="bg-ocean-700 text-white text-center py-2.5 px-4">
        <p className="text-xs font-body font-semibold">
          <span className="text-sand-400 font-bold">{viewerCount}</span>
          {lang === 'en' ? ' people viewed this page today' : ' pessoas viram esta pÃ¡gina hoje'}
          {units.length > 0 && <> Â· <span className="text-sand-400 font-bold">{units.length}</span> {lang === 'en' ? 'services available' : 'serviÃ§os disponÃ­veis'}</>}
        </p>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6">

        {/* â”€â”€ Sobre NÃ³s â”€â”€ */}
        <section id="sobre" className="py-12 sm:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            {op.logo_url && (
              <div className="rounded-2xl overflow-hidden bg-n-50 flex items-center justify-center p-8 border border-n-200">
                <img src={op.logo_url} alt={op.name} className="max-h-48 object-contain" />
              </div>
            )}
            <div className={op.logo_url ? '' : 'lg:col-span-2'}>
              <p className="text-xs font-body font-bold text-ocean-700 uppercase tracking-widest mb-2">
                {lang === 'en' ? 'About us' : 'Sobre nÃ³s'}
              </p>
              <h2 className="font-display font-bold text-2xl sm:text-3xl text-n-900 mb-4">{op.name}</h2>
              {op.description && (
                <p className="font-body text-n-600 leading-relaxed text-base mb-6">{op.description}</p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { icon: <MapPin size={18} strokeWidth={1.75} />, label: lang === 'en' ? 'Location' : 'LocalizaÃ§Ã£o', value: op.address?.split(',')[0] || 'Ilha do Sal' },
                  { icon: <Globe size={18} strokeWidth={1.75} />, label: lang === 'en' ? 'Languages' : 'Idiomas', value: 'PT Â· EN' },
                  { icon: <Award size={18} strokeWidth={1.75} />, label: lang === 'en' ? 'Type' : 'Tipo', value: TYPE_LABELS[op.operator_type] || 'ServiÃ§os' },
                  { icon: <Star size={18} strokeWidth={1.75} />, label: lang === 'en' ? 'Rating' : 'AvaliaÃ§Ã£o', value: avgRating > 0 ? `${avgRating.toFixed(1)}/5` : (lang === 'en' ? 'New' : 'Novo') },
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

        {/* â”€â”€ ServiÃ§os â”€â”€ */}
        {units.length > 0 && (
          <section id="servicos" className="py-12 sm:py-16 border-t border-n-100">
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
              <div>
                <p className="text-xs font-body font-bold text-ocean-700 uppercase tracking-widest mb-1">
                  {lang === 'en' ? 'What we offer' : 'O que oferecemos'}
                </p>
                <h2 className="font-display font-bold text-2xl sm:text-3xl text-n-900">
                  {lang === 'en' ? 'Our Services' : 'Os Nossos ServiÃ§os'}
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
                <ServiceCard key={unit.id} unit={unit} onBook={setBook} currency={currency} lang={lang} opCurrency={op.currency} />
              ))}
            </div>
          </section>
        )}

        {/* â”€â”€ Galeria â”€â”€ */}
        {galleryImgs.length > 0 && (
          <section id="galeria" className="py-12 sm:py-16 border-t border-n-100">
            <p className="text-xs font-body font-bold text-ocean-700 uppercase tracking-widest mb-2">
              {lang === 'en' ? 'Gallery' : 'Galeria'}
            </p>
            <h2 className="font-display font-bold text-2xl sm:text-3xl text-n-900 mb-6">
              {lang === 'en' ? 'Photo Gallery' : 'Galeria de Fotos'}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {galleryImgs.slice(0, 6).map((src, i) => (
                <div key={i}
                  className={`overflow-hidden rounded-xl cursor-pointer group relative ${i === 0 ? 'col-span-2 row-span-2' : ''}`}
                  style={{ height: i === 0 ? 320 : 155 }}
                  onClick={() => setLbIdx(i)}>
                  <img src={src} alt={`Foto ${i + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  <div className="absolute inset-0 bg-ocean-900/0 group-hover:bg-ocean-900/20 transition-colors" />
                </div>
              ))}
            </div>
            {galleryImgs.length > 6 && (
              <button onClick={() => setLbIdx(6)}
                className="mt-3 text-sm font-body font-semibold text-ocean-700 hover:text-ocean-500 transition-colors">
                {lang === 'en' ? `+${galleryImgs.length - 6} more photos` : `+${galleryImgs.length - 6} fotos`}
              </button>
            )}
          </section>
        )}

        {/* â”€â”€ AvaliaÃ§Ãµes â”€â”€ */}
        {reviews.length > 0 && (
          <section id="avaliacoes" className="py-12 sm:py-16 border-t border-n-100">
            <p className="text-xs font-body font-bold text-ocean-700 uppercase tracking-widest mb-2">
              {lang === 'en' ? 'Customer reviews' : 'Clientes'}
            </p>
            <h2 className="font-display font-bold text-2xl sm:text-3xl text-n-900 mb-8">
              {lang === 'en' ? 'What visitors say' : 'O que dizem os clientes'}
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
              {/* Breakdown */}
              <div className="bg-n-50 rounded-2xl p-6 border border-n-200">
                <div className="text-center mb-5">
                  <p className="font-display font-extrabold text-5xl text-n-900">{avgRating.toFixed(1)}</p>
                  <StarRating rating={avgRating} size={18} />
                  <p className="text-sm font-body text-n-400 mt-1">{reviews.length} {lang === 'en' ? 'reviews' : 'avaliaÃ§Ãµes'}</p>
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
              {/* Review cards */}
              <div className="lg:col-span-2 space-y-4">
                {reviews.slice(0, 4).map((r, i) => (
                  <div key={i} className="bg-white border border-n-200 rounded-xl p-5 shadow-sm">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-ocean-100 flex items-center justify-center font-display font-bold text-ocean-700 text-sm flex-shrink-0">
                          {(r.author_name || 'C').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-body font-semibold text-n-900 text-sm">{r.author_name || 'Cliente'}</p>
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

        {/* â”€â”€ FAQ â”€â”€ */}
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

        {/* â”€â”€ LocalizaÃ§Ã£o â”€â”€ */}
        <section id="localizacao" className="py-12 sm:py-16 border-t border-n-100">
          <p className="text-xs font-body font-bold text-ocean-700 uppercase tracking-widest mb-2">
            {lang === 'en' ? 'Location' : 'LocalizaÃ§Ã£o'}
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

        {/* â”€â”€ Contacto â”€â”€ */}
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
                {lang === 'en' ? 'Have questions? We respond within 24 hours.' : 'Tem dÃºvidas? Respondemos em 24 horas.'}
              </p>
              <div className="space-y-3">
                {op.phone && <div className="flex items-center gap-3 text-sm font-body text-n-600"><Phone size={16} strokeWidth={1.75} className="text-ocean-400" />{op.phone}</div>}
                {op.email && <div className="flex items-center gap-3 text-sm font-body text-n-600"><Mail size={16} strokeWidth={1.75} className="text-ocean-400" />{op.email}</div>}
                {op.address && <div className="flex items-center gap-3 text-sm font-body text-n-600"><MapPin size={16} strokeWidth={1.75} className="text-ocean-400" />{op.address}</div>}
              </div>
              <div className="flex items-center gap-3 mt-6">
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
              </div>
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

      {/* â”€â”€ Footer â”€â”€ */}
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
                {op.description ? op.description.slice(0, 120) + (op.description.length > 120 ? '...' : '') : `${op.name} â€” Ilha do Sal, Cabo Verde`}
              </p>
              {avgRating > 0 && (
                <div className="flex items-center gap-2">
                  <StarRating rating={avgRating} size={12} />
                  <span className="text-xs text-white/50">{avgRating.toFixed(1)} ({reviews.length})</span>
                </div>
              )}
              <div className="flex flex-wrap gap-2 mt-3">
                {isVerified && (
                  <span className="flex items-center gap-1 text-xs font-body text-white/60 border border-white/15 px-2.5 py-1 rounded-full">
                    <Shield size={10} strokeWidth={2} />
                    {lang === 'en' ? 'Verified' : 'Verificado'}
                  </span>
                )}
              </div>
            </div>
            <div>
              <h4 className="font-display font-bold text-sm text-white mb-3">
                {lang === 'en' ? 'Navigation' : 'NavegaÃ§Ã£o'}
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
              <button onClick={() => setBook(units[0] || null)}
                className="w-full bg-sand-500 text-white font-body font-semibold text-sm py-3 rounded-xl hover:bg-sand-600 transition-colors flex items-center justify-center gap-2 mb-3">
                <Calendar size={14} strokeWidth={1.75} />
                {lang === 'en' ? 'Reserve a service' : 'Reservar um serviÃ§o'}
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
            <p className="text-white/40">
              Â© 2026 {op.name} Â· Ilha do Sal, Cabo Verde
            </p>
            <p className="text-white/35">
              {lang === 'en' ? 'Powered by' : 'Plataforma'}{' '}
              <a href="https://saldesk.cv" className="text-white/55 hover:text-white transition-colors font-semibold">SalDesk</a>
              {' '}&middot; Sistema desenvolvido por{' '}
              <a href="https://wandr.cv" className="text-white/55 hover:text-white transition-colors font-semibold">WANDR</a>
            </p>
          </div>
        </div>
      </footer>

      {/* â”€â”€ Bottom CTA bar (mobile) â”€â”€ */}
      {units.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-n-200 px-4 py-3 flex gap-3 z-30 sm:hidden shadow-lg">
          <button onClick={() => setBook(units[0])}
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

      {/* â”€â”€ WhatsApp FAB â”€â”€ */}
      {whatsappUrl && (
        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
          className="fixed bottom-20 sm:bottom-6 right-4 z-30 w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-[#25D366] flex items-center justify-center shadow-xl hover:scale-110 transition-transform"
          style={{ width: 52, height: 52 }}>
          <div className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-25" />
          <MessageCircle size={22} strokeWidth={1.75} className="text-white relative z-10" />
        </a>
      )}

      {/* â”€â”€ Chat widget â”€â”€ */}
      <ChatWidget slug={slug} opName={op.name} lang={lang} />

      {/* â”€â”€ Modals â”€â”€ */}
      {bookUnit !== null && bookUnit !== undefined && (
        <BookingModal
          unit={bookUnit}
          op={op}
          slug={slug}
          lang={lang}
          onClose={() => setBook(null)}
        />
      )}
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
