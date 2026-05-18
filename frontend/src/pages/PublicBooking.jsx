import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  MapPin, Phone, ArrowRight, Check, Star, ChevronLeft,
  ChevronRight, MessageCircle, Clock,
} from 'lucide-react';
import { getOperador, checkAvailability, criarReservaPublica } from '../services/publicService';
import { useT } from '../i18n';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import LanguageToggle from '../components/shared/LanguageToggle';
import Logo from '../components/shared/Logo';

const STEPS = { DATES: 1, FORM: 2, PAYMENT: 3, CONFIRM: 4 };
const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1').replace('/api/v1', '');
const TYPE_LD  = { hotel:'LodgingBusiness', activity:'TouristAttraction', rentacar:'RentAction', restaurant:'Restaurant' };

function StarRating({ rating, max = 5 }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <Star key={i} size={13} strokeWidth={1.75}
          className={i < Math.round(rating) ? 'text-sand-500 fill-sand-500' : 'text-n-300'} />
      ))}
    </div>
  );
}

function injectSeo(op, slug) {
  const desc = op.description || `Reserve directamente em ${op.name}, Ilha do Sal, Cabo Verde.`;
  document.title = `${op.name} — Reservar em Ilha do Sal | SalDesk`;
  const setMeta = (n, c, p = false) => {
    const attr = p ? 'property' : 'name';
    let el = document.querySelector(`meta[${attr}="${n}"]`);
    if (!el) { el = document.createElement('meta'); el.setAttribute(attr, n); document.head.appendChild(el); }
    el.setAttribute('content', c); el.dataset.seo = '1';
  };
  setMeta('description', desc);
  setMeta('og:title', document.title, true);
  setMeta('og:description', desc, true);
  setMeta('og:url', window.location.href, true);
  setMeta('og:type', 'website', true);
  if (op.logo_url) setMeta('og:image', op.logo_url, true);
  setMeta('twitter:card', 'summary_large_image');
  const ld = { '@context':'https://schema.org', '@type': TYPE_LD[op.operator_type]||'LocalBusiness',
    name:op.name, description:desc, url:window.location.href,
    address:{'@type':'PostalAddress',addressLocality:'Santa Maria',addressCountry:'CV'},
    ...(op.phone?{telephone:op.phone}:{}),
  };
  let ldEl = document.getElementById('sd-jsonld');
  if (!ldEl) { ldEl = document.createElement('script'); ldEl.id='sd-jsonld'; ldEl.type='application/ld+json'; document.head.appendChild(ldEl); }
  ldEl.textContent = JSON.stringify(ld);
}
function removeSeo() {
  document.querySelectorAll('meta[data-seo]').forEach(el => el.remove());
  document.getElementById('sd-jsonld')?.remove();
}

/* Hero image carousel */
function HeroCarousel({ images, operatorName }) {
  const [idx, setIdx] = useState(0);
  const imgs = images?.length ? images : ['https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80'];
  useEffect(() => {
    if (imgs.length < 2) return;
    const t = setInterval(() => setIdx(i => (i + 1) % imgs.length), 4000);
    return () => clearInterval(t);
  }, [imgs.length]);
  return (
    <div className="relative h-72 sm:h-96 overflow-hidden rounded-none">
      {imgs.map((src, i) => (
        <div key={i} className="absolute inset-0 bg-cover bg-center transition-opacity duration-700"
          style={{ backgroundImage: `url(${src})`, opacity: i === idx ? 1 : 0 }} />
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-ocean-900/80 via-ocean-900/30 to-transparent" />
      {imgs.length > 1 && (
        <>
          <button onClick={() => setIdx(i => (i - 1 + imgs.length) % imgs.length)}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30">
            <ChevronLeft size={18} strokeWidth={1.75} />
          </button>
          <button onClick={() => setIdx(i => (i + 1) % imgs.length)}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30">
            <ChevronRight size={18} strokeWidth={1.75} />
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {imgs.map((_, i) => (
              <button key={i} onClick={() => setIdx(i)}
                className={`w-1.5 h-1.5 rounded-full transition-all ${i === idx ? 'bg-white w-4' : 'bg-white/50'}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* Card de serviço/unidade */
function ServiceCard({ unit, onBook, lang }) {
  const priceLabels = { night:'/noite', day:'/dia', hour:'/hora', session:'/sessao', person:'/pessoa' };
  const priceLabel  = priceLabels[unit.price_unit] || '';
  return (
    <div className="bg-white rounded-md border border-n-200 shadow-sm overflow-hidden">
      {unit.images?.[0] && (
        <img src={unit.images[0]} alt={unit.name} className="w-full h-40 object-cover" />
      )}
      <div className="p-4">
        <p className="font-display font-bold text-n-900 mb-1">{unit.name}</p>
        {unit.description && <p className="text-xs font-body text-n-500 line-clamp-2 mb-3">{unit.description}</p>}
        <div className="flex items-center justify-between">
          <p className="font-display font-bold text-ocean-700">
            €{Number(unit.base_price).toFixed(2)}<span className="text-xs font-body text-n-400 font-normal">{priceLabel}</span>
          </p>
          <Button size="sm" onClick={() => onBook(unit)}>
            {lang === 'en' ? 'Book' : 'Reservar'}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* Modal de reserva */
function BookingModal({ unit, operador, slug, onClose }) {
  const t = useT();
  const [step, setStep]           = useState(STEPS.DATES);
  const [dates, setDates]         = useState({ checkIn: '', checkOut: '' });
  const [availability, setAvail]  = useState(null);
  const [checking, setChecking]   = useState(false);
  const [form, setForm]           = useState({ name:'', email:'', phone:'', country:'', guests:1 });
  const [submitting, setSub]      = useState(false);
  const [reservationId, setResId] = useState(null);
  const [payMethod, setPay]       = useState('paypal');
  const [payLoading, setPayLoad]  = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError]         = useState('');

  const verifyDates = useCallback(async () => {
    if (!dates.checkIn || !dates.checkOut || dates.checkOut <= dates.checkIn) return;
    setChecking(true);
    try {
      const r = await checkAvailability(slug, unit.id, dates.checkIn, dates.checkOut);
      setAvail(r);
    } catch { setAvail(null); } finally { setChecking(false); }
  }, [slug, unit.id, dates]);

  useEffect(() => { verifyDates(); }, [dates.checkIn, dates.checkOut]);

  async function handleSubmitForm(e) {
    e.preventDefault(); setError(''); setSub(true);
    try {
      const r = await criarReservaPublica(slug, {
        unit_id: unit.id, customer_name: form.name, customer_email: form.email,
        customer_phone: form.phone || null, customer_country: form.country || null,
        check_in: dates.checkIn, check_out: dates.checkOut, guests: Number(form.guests),
      });
      setResId(r.id);
      setStep(STEPS.PAYMENT);
    } catch (err) { setError(err.response?.data?.error || t('errors.generic')); } finally { setSub(false); }
  }

  async function handlePayment() {
    if (payMethod === 'cash') { setConfirmed(true); setStep(STEPS.CONFIRM); return; }
    setPayLoad(true);
    try {
      if (payMethod === 'paypal') {
        const r = await fetch(`${API_BASE}/api/v1/payments/create-intent`, {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ reservation_id: reservationId, amount: availability?.total_price }),
        }).then(r => r.json());
        if (r.data?.order_id) {
          window.open(`https://www.sandbox.paypal.com/checkoutnow?token=${r.data.order_id}`, '_blank');
          setTimeout(() => { setConfirmed(true); setStep(STEPS.CONFIRM); }, 2000);
        }
      } else if (payMethod === 'sisp') {
        const r = await fetch(`${API_BASE}/api/v1/payments/sisp/init`, {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ reservation_id: reservationId, amount: availability?.total_price }),
        }).then(r => r.json());
        if (r.data?.payment_url) window.location.href = r.data.payment_url;
      }
    } finally { setPayLoad(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ocean-900/50 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-n-200">
          <div>
            <p className="font-display font-bold text-n-900">{unit.name}</p>
            <p className="text-xs font-body text-n-500">€{Number(unit.base_price).toFixed(2)}</p>
          </div>
          <button onClick={onClose} className="text-n-400 hover:text-n-700 text-xl leading-none p-1">&times;</button>
        </div>

        <div className="p-5">
          {step === STEPS.DATES && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Input label="Check-in" type="date" value={dates.checkIn}
                  onChange={e => setDates({...dates, checkIn: e.target.value})}
                  min={new Date().toISOString().split('T')[0]} />
                <Input label="Check-out" type="date" value={dates.checkOut}
                  onChange={e => setDates({...dates, checkOut: e.target.value})}
                  min={dates.checkIn || new Date().toISOString().split('T')[0]} />
              </div>
              {checking && <p className="text-xs text-n-400 flex items-center gap-1"><LoadingSpinner size={12}/>A verificar...</p>}
              {availability && !checking && (
                <div className={`rounded-sm px-3 py-2 ${availability.disponivel ? 'bg-[var(--success-light)] text-[var(--success)]' : 'bg-[var(--error-light)] text-[var(--error)]'}`}>
                  {availability.disponivel
                    ? <div className="flex justify-between text-sm font-body font-semibold"><span>Disponivel</span><span>€{Number(availability.total_price).toFixed(2)}</span></div>
                    : <p className="text-sm font-body font-semibold">Indisponivel neste periodo</p>
                  }
                </div>
              )}
              <Button className="w-full" disabled={!availability?.disponivel} iconRight={ArrowRight} onClick={() => setStep(STEPS.FORM)}>Continuar</Button>
            </div>
          )}

          {step === STEPS.FORM && (
            <form onSubmit={handleSubmitForm} className="space-y-3">
              <div className="bg-ocean-50 rounded-sm px-3 py-2 text-xs font-body text-ocean-700 mb-2">
                {dates.checkIn} → {dates.checkOut} · €{Number(availability?.total_price||0).toFixed(2)}
              </div>
              <Input label="Nome completo" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required />
              <Input label="Email" type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Telefone" type="tel" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} />
                <Input label="Pais (ISO)" value={form.country} onChange={e=>setForm({...form,country:e.target.value.toUpperCase()})} placeholder="PT" maxLength={2} />
              </div>
              {error && <p className="text-xs text-[var(--error)]">{error}</p>}
              <Button type="submit" loading={submitting} className="w-full" iconRight={ArrowRight}>Confirmar dados</Button>
            </form>
          )}

          {step === STEPS.PAYMENT && (
            <div className="space-y-3">
              {[
                {v:'paypal',l:'Cartao internacional (PayPal)'},
                {v:'sisp',  l:'Cartao cabo-verdiano (SISP Vinti4)'},
                {v:'cash',  l:'Pagar presencialmente'},
              ].map(opt => (
                <button key={opt.v} onClick={() => setPay(opt.v)}
                  className={`w-full text-left p-3 rounded-md border-2 text-sm font-body font-medium transition-all ${payMethod===opt.v?'border-ocean-700 bg-ocean-50 text-ocean-700':'border-n-200 text-n-700 hover:border-n-300'}`}>
                  {opt.l}
                </button>
              ))}
              <Button className="w-full" loading={payLoading} onClick={handlePayment}>
                {payMethod==='cash' ? 'Confirmar reserva' : 'Prosseguir para pagamento'}
              </Button>
            </div>
          )}

          {step === STEPS.CONFIRM && (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-full bg-[var(--success-light)] flex items-center justify-center mx-auto mb-3">
                <Check size={28} strokeWidth={1.75} className="text-[var(--success)]" />
              </div>
              <h3 className="font-display font-bold text-lg text-n-900 mb-2">Reserva submetida!</h3>
              <p className="text-sm font-body text-n-500 mb-4">Receberá um email de confirmacao em breve.</p>
              <Button variant="secondary" onClick={onClose} className="w-full">Fechar</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PublicBooking() {
  const { slug } = useParams();
  const t = useT();
  const [operador, setOperador]   = useState(null);
  const [units, setUnits]         = useState([]);
  const [reviews, setReviews]     = useState([]);
  const [loadingPage, setLoading] = useState(true);
  const [notFound, setNotFound]   = useState(false);
  const [bookingUnit, setBookingUnit] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/api/v1/public/${slug}`).then(r => r.json()),
      fetch(`${API_BASE}/api/v1/reviews/public/${slug}`).then(r => r.json()).catch(() => ({ data: [] })),
    ]).then(([opData, revData]) => {
      if (opData.data) {
        setOperador(opData.data.operator);
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

  const lang   = document.documentElement.getAttribute('data-lang') || 'pt';
  const avgRating = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const whatsappUrl = operador?.whatsapp
    ? `https://wa.me/${operador.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Ola, quero fazer uma reserva em ${operador.name}`)}`
    : null;

  if (loadingPage) return (
    <div className="min-h-screen flex items-center justify-center bg-n-50">
      <LoadingSpinner size={36} />
    </div>
  );

  if (notFound) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-n-50 p-4">
      <Logo size="lg" />
      <p className="mt-6 text-n-600 font-body">Pagina de reserva nao encontrada.</p>
      <p className="text-sm text-n-400 mt-1">Verifique o link ou contacte o operador.</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-n-50 pb-16">
      {/* Nav */}
      <nav className="bg-ocean-900 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <Logo white size="sm" />
        <div className="flex items-center gap-3">
          {reviews.length > 0 && (
            <div className="flex items-center gap-1.5">
              <StarRating rating={avgRating} />
              <span className="text-xs text-white/70 font-body">{avgRating.toFixed(1)} ({reviews.length})</span>
            </div>
          )}
          <LanguageToggle variant="white" authMode />
        </div>
      </nav>

      {/* Hero — carousel de imagens */}
      <HeroCarousel images={operador.images || (operador.logo_url ? [operador.logo_url] : [])} operatorName={operador.name} />

      {/* Info principal */}
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md -mt-8 relative z-10 p-5 mb-6">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              {operador.logo_url && (
                <img src={operador.logo_url} alt={operador.name} className="h-10 object-contain mb-2" />
              )}
              <h1 className="font-display font-bold text-xl text-n-900">{operador.name}</h1>
              {reviews.length > 0 && (
                <div className="flex items-center gap-2 mt-1">
                  <StarRating rating={avgRating} />
                  <span className="text-xs font-body text-n-500">{avgRating.toFixed(1)} — {reviews.length} {lang === 'en' ? 'reviews' : 'avaliacoes'}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-3 text-xs font-body text-n-600">
            {operador.address && <span className="flex items-center gap-1"><MapPin size={12} strokeWidth={1.75} className="text-n-400"/>{operador.address}</span>}
            {operador.phone   && <a href={`tel:${operador.phone}`} className="flex items-center gap-1 hover:text-ocean-700"><Phone size={12} strokeWidth={1.75} className="text-n-400"/>{operador.phone}</a>}
          </div>
          {operador.description && (
            <p className="text-sm font-body text-n-600 mt-3 leading-relaxed">{operador.description}</p>
          )}
        </div>

        {/* Servicos */}
        {units.length > 0 && (
          <section className="mb-8">
            <h2 className="font-display font-bold text-lg text-n-900 mb-4">
              {lang === 'en' ? 'Our Services' : 'Os Nossos Servicos'}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {units.map(unit => (
                <ServiceCard key={unit.id} unit={unit} onBook={setBookingUnit} lang={lang} />
              ))}
            </div>
          </section>
        )}

        {/* Avaliacoes */}
        {reviews.length > 0 && (
          <section className="mb-8">
            <h2 className="font-display font-bold text-lg text-n-900 mb-4">
              {lang === 'en' ? 'Reviews' : 'Avaliacoes'}
            </h2>
            <div className="space-y-3">
              {reviews.slice(0, 6).map((r, i) => (
                <div key={i} className="bg-white rounded-md border border-n-200 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <StarRating rating={r.rating} />
                    <span className="text-xs font-body text-n-400">{r.created_at?.split('T')[0]}</span>
                  </div>
                  <p className="text-sm font-body text-n-700 leading-relaxed">{r.comment}</p>
                  {r.reply_text && (
                    <div className="mt-2 bg-ocean-50 rounded-sm px-3 py-2">
                      <p className="text-xs font-body font-bold text-ocean-700 mb-0.5">{lang === 'en' ? 'Response' : 'Resposta'}</p>
                      <p className="text-xs font-body text-n-600">{r.reply_text}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Mapa */}
        <section className="mb-8">
          <h2 className="font-display font-bold text-lg text-n-900 mb-4">
            {lang === 'en' ? 'Location' : 'Localizacao'}
          </h2>
          <div className="bg-n-100 rounded-md h-48 flex items-center justify-center border border-n-200">
            <div className="text-center text-n-400">
              <MapPin size={28} strokeWidth={1.25} className="mx-auto mb-2" />
              <p className="text-sm font-body">{operador.address || 'Santa Maria, Ilha do Sal'}</p>
              <a href={`https://maps.google.com?q=${encodeURIComponent(operador.address || 'Santa Maria Ilha do Sal Cabo Verde')}`}
                target="_blank" rel="noopener noreferrer"
                className="text-xs text-ocean-700 hover:underline mt-1 block">
                {lang === 'en' ? 'Open in Google Maps' : 'Abrir no Google Maps'}
              </a>
            </div>
          </div>
        </section>
      </div>

      {/* CTA fixo no fundo */}
      {units.length > 0 && !bookingUnit && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-n-200 px-4 py-3 flex gap-3 z-30">
          <Button className="flex-1" onClick={() => setBookingUnit(units[0])}>
            {lang === 'en' ? 'Book now' : 'Reservar agora'}
          </Button>
          {whatsappUrl && (
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="secondary" icon={MessageCircle}>WhatsApp</Button>
            </a>
          )}
        </div>
      )}

      {/* Botao WhatsApp flutuante */}
      {whatsappUrl && bookingUnit === null && (
        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
          className="fixed bottom-20 right-4 w-12 h-12 rounded-full bg-[#25D366] flex items-center justify-center shadow-lg hover:scale-110 transition-transform z-30">
          <MessageCircle size={22} strokeWidth={1.75} className="text-white" />
        </a>
      )}

      {/* Modal de reserva */}
      {bookingUnit && (
        <BookingModal
          unit={bookingUnit}
          operador={operador}
          slug={slug}
          onClose={() => setBookingUnit(null)}
        />
      )}

      {/* Footer */}
      <div className="max-w-2xl mx-auto px-4 py-6 text-center">
        <p className="text-xs font-body text-n-400">
          {lang === 'en' ? 'Powered by' : 'Plataforma'}{' '}
          <a href="https://saldesk.cv" className="text-ocean-700 hover:underline font-semibold">SalDesk</a>
          {' '}— Sistema desenvolvido por <span className="font-semibold">WANDR</span>
        </p>
      </div>
    </div>
  );
}
