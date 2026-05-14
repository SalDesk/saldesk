import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { MapPin, Phone, Globe, ArrowRight, Check, Calendar, Users, Euro } from 'lucide-react';
import { getOperador, checkAvailability, criarReservaPublica } from '../services/publicService';
import useUiStore from '../store/uiStore';
import { useT } from '../i18n';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import LanguageToggle from '../components/shared/LanguageToggle';
import Logo from '../components/shared/Logo';

const STEPS = { SELECT: 1, DATES: 2, FORM: 3, PAYMENT: 4, CONFIRM: 5 };

const TYPE_LD = {
  hotel:      'LodgingBusiness',
  activity:   'TouristAttraction',
  rentacar:   'RentAction',
  restaurant: 'Restaurant',
};

function injectSeo(op, slug) {
  document.title = `${op.name} — Reservar em Ilha do Sal | SalDesk`;
  const desc = op.description || `Reserve directamente em ${op.name}, Ilha do Sal, Cabo Verde.`;
  const url  = window.location.href;

  const setMeta = (name, content, prop = false) => {
    const attr  = prop ? 'property' : 'name';
    let el = document.querySelector(`meta[${attr}="${name}"]`);
    if (!el) { el = document.createElement('meta'); el.setAttribute(attr, name); document.head.appendChild(el); }
    el.setAttribute('content', content);
    el.dataset.seo = '1';
  };

  setMeta('description', desc);
  setMeta('og:title', document.title, true);
  setMeta('og:description', desc, true);
  setMeta('og:url', url, true);
  setMeta('og:type', 'website', true);
  if (op.logo_url) setMeta('og:image', op.logo_url, true);
  setMeta('twitter:card', 'summary');
  setMeta('twitter:title', document.title);
  setMeta('twitter:description', desc);

  const ldType = TYPE_LD[op.operator_type] || 'LocalBusiness';
  const ld = {
    '@context': 'https://schema.org',
    '@type': ldType,
    name: op.name,
    description: desc,
    url,
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
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

export default function PublicBooking() {
  const { slug } = useParams();
  const t = useT();
  const [operador, setOperador] = useState(null);
  const [units, setUnits] = useState([]);
  const [loadingPage, setLoadingPage] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [step, setStep] = useState(STEPS.SELECT);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [dates, setDates] = useState({ checkIn: '', checkOut: '' });
  const [availability, setAvailability] = useState(null);
  const [checkingAvail, setCheckingAvail] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', country: '', guests: 1, notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [bookingRef, setBookingRef] = useState(null);
  const [reservationId, setReservationId] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('paypal');
  const [paypalOrderId, setPaypalOrderId] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getOperador(slug)
      .then(({ operator, units: u }) => {
        setOperador(operator);
        setUnits(u);
        /* SEO dinâmico */
        injectSeo(operator, slug);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoadingPage(false));
    return () => removeSeo();
  }, [slug]);

  const verifyAvailability = useCallback(async () => {
    if (!selectedUnit || !dates.checkIn || !dates.checkOut || dates.checkOut <= dates.checkIn) return;
    setCheckingAvail(true);
    try {
      const result = await checkAvailability(slug, selectedUnit.id, dates.checkIn, dates.checkOut);
      setAvailability(result);
    } catch {
      setAvailability(null);
    } finally {
      setCheckingAvail(false);
    }
  }, [slug, selectedUnit, dates]);

  useEffect(() => {
    if (step === STEPS.DATES) verifyAvailability();
  }, [dates.checkIn, dates.checkOut, step]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const result = await criarReservaPublica(slug, {
        unit_id: selectedUnit.id,
        customer_name: form.name,
        customer_email: form.email,
        customer_phone: form.phone || null,
        customer_country: form.country || null,
        check_in: dates.checkIn,
        check_out: dates.checkOut,
        guests: Number(form.guests),
        notes: form.notes || null,
      });
      setBookingRef(result.id);
      setReservationId(result.id);
      setStep(STEPS.PAYMENT);
    } catch (err) {
      setError(err.response?.data?.error || t('errors.generic'));
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-n-50">
        <LoadingSpinner size={32} />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-n-50 p-4 text-center">
        <Logo />
        <p className="mt-6 text-n-600 font-body">Pagina de reserva nao encontrada.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-n-50">
      {/* Header */}
      <header className="bg-ocean-900 text-white px-4 py-4">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <Logo white />
          <LanguageToggle variant="white" />
        </div>
      </header>

      {/* Info do operador */}
      <div className="bg-ocean-800 text-white px-4 py-5">
        <div className="max-w-xl mx-auto">
          <h1 className="font-display font-bold text-xl">{operador.name}</h1>
          <div className="flex flex-wrap gap-3 mt-2 text-sm text-ocean-200">
            {operador.address && (
              <span className="flex items-center gap-1">
                <MapPin size={13} strokeWidth={1.75} />
                {operador.address}
              </span>
            )}
            {operador.phone && (
              <span className="flex items-center gap-1">
                <Phone size={13} strokeWidth={1.75} />
                {operador.phone}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-6">
        {/* Passo 1 — Seleccionar unidade */}
        {step === STEPS.SELECT && (
          <div>
            <h2 className="font-display font-bold text-lg text-n-900 mb-4">
              Escolha o que pretende reservar
            </h2>
            <div className="space-y-3">
              {units.map((unit) => (
                <button
                  key={unit.id}
                  onClick={() => { setSelectedUnit(unit); setAvailability(null); setStep(STEPS.DATES); }}
                  className="w-full bg-white rounded-md border border-n-200 shadow-sm p-4 text-left hover:border-ocean-300 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-display font-semibold text-n-900">{unit.name}</p>
                      <p className="text-xs font-body text-n-500 mt-0.5">{unit.unit_type} · Cap. {unit.capacity}</p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="font-display font-bold text-ocean-700">€{Number(unit.base_price).toFixed(2)}</p>
                      <p className="text-xs font-body text-n-400">por noite</p>
                    </div>
                  </div>
                  {unit.description && (
                    <p className="text-xs font-body text-n-600 mt-2 line-clamp-2">{unit.description}</p>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Passo 2 — Datas */}
        {step === STEPS.DATES && selectedUnit && (
          <div>
            <button onClick={() => { setStep(STEPS.SELECT); setAvailability(null); }} className="text-xs font-body text-ocean-700 mb-4 flex items-center gap-1 hover:underline">
              ← Voltar
            </button>
            <h2 className="font-display font-bold text-lg text-n-900 mb-1">{selectedUnit.name}</h2>
            <p className="text-sm font-body text-n-500 mb-5">Seleccione as datas</p>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <Input
                label="Check-in"
                type="date"
                value={dates.checkIn}
                onChange={(e) => setDates({ ...dates, checkIn: e.target.value })}
                min={new Date().toISOString().split('T')[0]}
              />
              <Input
                label="Check-out"
                type="date"
                value={dates.checkOut}
                onChange={(e) => setDates({ ...dates, checkOut: e.target.value })}
                min={dates.checkIn || new Date().toISOString().split('T')[0]}
              />
            </div>

            {checkingAvail && (
              <div className="flex items-center gap-2 text-sm font-body text-n-500">
                <LoadingSpinner size={14} /> A verificar disponibilidade...
              </div>
            )}

            {availability && !checkingAvail && (
              <div className={`rounded-sm px-4 py-3 mb-4 ${availability.disponivel ? 'bg-[var(--success-light)] text-[var(--success)]' : 'bg-[var(--error-light)] text-[var(--error)]'}`}>
                {availability.disponivel ? (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-body font-semibold">Disponivel</span>
                    <span className="font-display font-bold">€{Number(availability.total_price).toFixed(2)}</span>
                  </div>
                ) : (
                  <p className="text-sm font-body font-semibold">Indisponivel nas datas seleccionadas</p>
                )}
              </div>
            )}

            <Button
              className="w-full"
              disabled={!availability?.disponivel}
              iconRight={ArrowRight}
              onClick={() => setStep(STEPS.FORM)}
            >
              Continuar
            </Button>
          </div>
        )}

        {/* Passo 3 — Formulario cliente */}
        {step === STEPS.FORM && (
          <div>
            <button onClick={() => setStep(STEPS.DATES)} className="text-xs font-body text-ocean-700 mb-4 flex items-center gap-1 hover:underline">
              ← Voltar
            </button>
            <h2 className="font-display font-bold text-lg text-n-900 mb-1">Os seus dados</h2>
            <p className="text-sm font-body text-n-500 mb-5">Preencha para concluir a reserva</p>

            {/* Sumario */}
            <div className="bg-ocean-50 rounded-md p-3 mb-5 space-y-1">
              <p className="text-xs font-body font-semibold text-ocean-700">{selectedUnit?.name}</p>
              <div className="flex items-center gap-3 text-xs font-body text-n-600">
                <span>{dates.checkIn} → {dates.checkOut}</span>
                <span className="font-bold text-ocean-700">€{Number(availability?.total_price || 0).toFixed(2)}</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input label="Nome completo" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Joao Silva" />
              <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required placeholder="email@exemplo.com" />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Telefone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+351 910 000 000" />
                <Input label="Pais (ISO)" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })} placeholder="PT" maxLength={2} />
              </div>
              <Input label="Hospedes" type="number" value={form.guests} onChange={(e) => setForm({ ...form, guests: e.target.value })} min="1" max={selectedUnit?.capacity} />

              {error && (
                <p className="text-sm font-body px-3 py-2 rounded-sm bg-[var(--error-light)] text-[var(--error)]">{error}</p>
              )}

              <Button type="submit" loading={submitting} className="w-full" iconRight={ArrowRight}>
                Confirmar Reserva
              </Button>
            </form>
          </div>
        )}

        {/* Passo 4 — Pagamento */}
        {step === STEPS.PAYMENT && (
          <div>
            <h2 className="font-display font-bold text-lg text-n-900 mb-1">Metodo de pagamento</h2>
            <p className="text-sm font-body text-n-500 mb-5">Escolha como pretende pagar</p>

            {/* Sumario */}
            <div className="bg-ocean-50 rounded-md p-3 mb-5 space-y-1">
              <p className="text-xs font-body font-semibold text-ocean-700">{selectedUnit?.name}</p>
              <div className="flex items-center justify-between text-xs font-body text-n-600">
                <span>{dates.checkIn} → {dates.checkOut}</span>
                <span className="font-bold text-ocean-700">€{Number(availability?.total_price || 0).toFixed(2)}</span>
              </div>
            </div>

            {/* Opcoes */}
            <div className="space-y-3 mb-5">
              {[
                { value: 'paypal', label: 'Cartao internacional (PayPal)', desc: 'Visa, Mastercard, American Express — pagamento seguro via PayPal' },
                { value: 'sisp',   label: 'Cartao cabo-verdiano (SISP Vinti4)', desc: 'Cartao de debito ou credito emitido em Cabo Verde' },
                { value: 'cash',   label: 'Pagar presencialmente', desc: 'Dinheiro ou transferencia no momento da actividade' },
              ].map((opt) => (
                <button key={opt.value} onClick={() => setPaymentMethod(opt.value)}
                  className={`w-full text-left p-4 rounded-md border-2 transition-all ${paymentMethod === opt.value ? 'border-ocean-700 bg-ocean-50' : 'border-n-200 hover:border-n-300'}`}>
                  <p className={`font-body font-semibold text-sm ${paymentMethod === opt.value ? 'text-ocean-700' : 'text-n-900'}`}>{opt.label}</p>
                  <p className="text-xs font-body text-n-500 mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>

            {error && (
              <p className="text-sm font-body px-3 py-2 rounded-sm bg-[var(--error-light)] text-[var(--error)] mb-4">{error}</p>
            )}

            <Button
              className="w-full"
              loading={paymentLoading}
              onClick={async () => {
                if (paymentMethod === 'cash') {
                  setStep(STEPS.CONFIRM);
                  return;
                }
                setPaymentLoading(true);
                setError('');
                try {
                  const amount = availability?.total_price || 0;
                  if (paymentMethod === 'paypal') {
                    const r = await fetch(`${API_BASE}/payments/create-intent`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ reservation_id: reservationId, amount }),
                    }).then(r => r.json());
                    if (r.data?.order_id) {
                      setPaypalOrderId(r.data.order_id);
                      window.open(`https://www.sandbox.paypal.com/checkoutnow?token=${r.data.order_id}`, '_blank');
                      setTimeout(() => setStep(STEPS.CONFIRM), 2000);
                    }
                  } else if (paymentMethod === 'sisp') {
                    const r = await fetch(`${API_BASE}/payments/sisp/init`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ reservation_id: reservationId, amount }),
                    }).then(r => r.json());
                    if (r.data?.payment_url) {
                      window.location.href = r.data.payment_url;
                    }
                  }
                } catch (err) {
                  setError('Erro ao iniciar pagamento. Tente novamente.');
                } finally {
                  setPaymentLoading(false);
                }
              }}
            >
              {paymentMethod === 'cash' ? 'Confirmar reserva' : 'Prosseguir para pagamento'}
            </Button>
          </div>
        )}

        {/* Passo 5 — Confirmacao */}
        {step === STEPS.CONFIRM && (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-[var(--success-light)] flex items-center justify-center mx-auto mb-4">
              <Check size={32} strokeWidth={1.75} className="text-[var(--success)]" />
            </div>
            <h2 className="font-display font-bold text-xl text-n-900 mb-2">Reserva submetida!</h2>
            <p className="text-sm font-body text-n-600 mb-6">
              Recebemos o seu pedido. Entraremos em contacto por email para confirmar.
            </p>
            <div className="bg-n-50 rounded-md p-4 text-left space-y-2">
              <SummaryRow label="Unidade"   value={selectedUnit?.name} />
              <SummaryRow label="Check-in"  value={dates.checkIn} />
              <SummaryRow label="Check-out" value={dates.checkOut} />
              <SummaryRow label="Total"     value={`€${Number(availability?.total_price || 0).toFixed(2)}`} />
              <SummaryRow label="Ref."      value={bookingRef?.slice(0, 8).toUpperCase()} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="font-body text-n-500">{label}</span>
      <span className="font-body font-semibold text-n-800">{value}</span>
    </div>
  );
}
