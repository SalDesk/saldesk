import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Plus, Minus,
  Check, User, Mail, Phone, Calendar,
  Clock, Users, MapPin,
} from 'lucide-react';
import { listUnits } from '../services/unitsService';
import { createReservation } from '../services/reservationsService';
import {
  addCommissionLocal, getSellerCommissionPct, getSellerMeta,
} from '../services/sellerService';
import useAuthStore from '../store/authStore';

/* ── helpers ── */
const TODAY = new Date().toISOString().slice(0, 10);
const MONTHS_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const DAYS_PT   = ['Dom','Seg','Ter','Qua','Qui','Sex','Sab'];

function addDays(d, n) {
  const dt = new Date(d + 'T00:00:00Z'); dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

function fmtDatePT(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  return `${DAYS_PT[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS_PT[d.getUTCMonth()]}`;
}

function parseMeta(description) {
  if (!description?.startsWith('{')) return {};
  try { return JSON.parse(description); } catch { return {}; }
}

function Counter({ value, min = 0, max = 99, onChange, label }) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-n-100 last:border-0">
      <span className="text-base font-body text-n-800">{label}</span>
      <div className="flex items-center gap-4">
        <button
          type="button" onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="w-11 h-11 rounded-full border-2 border-n-200 flex items-center justify-center text-n-700 hover:border-ocean-700 hover:text-ocean-700 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all">
          <Minus size={18} strokeWidth={2} />
        </button>
        <span className="font-display font-bold text-xl text-n-900 w-8 text-center">{value}</span>
        <button
          type="button" onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="w-11 h-11 rounded-full bg-ocean-700 text-white flex items-center justify-center hover:bg-ocean-800 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all">
          <Plus size={18} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────── Main ─────────────────────── */
export default function BeachSale() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const sellerId   = user?.user_metadata?.staff_id || user?.id;
  const sellerName = user?.user_metadata?.name || user?.email || 'Vendedor';
  const sellerMeta = getSellerMeta(sellerId);
  const commPct    = getSellerCommissionPct(sellerId, 10);

  const [step,    setStep]    = useState(1);
  const [tours,   setTours]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  /* Form state */
  const [selectedTour, setSelectedTour] = useState(null);
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [selectedTime, setSelectedTime] = useState('');
  const [adults,       setAdults]       = useState(1);
  const [kids,         setKids]         = useState(0);
  const [clientName,   setClientName]   = useState('');
  const [clientEmail,  setClientEmail]  = useState('');
  const [clientPhone,  setClientPhone]  = useState('');
  const [notes,        setNotes]        = useState('');

  /* Success state */
  const [successData, setSuccessData] = useState(null);

  useEffect(() => {
    listUnits()
      .then(d => {
        const active = (d || []).filter(u => u.is_active !== false && u.status !== 'inactive');
        // Filter by seller's allowed tours if configured
        const allowed = sellerMeta.tour_ids;
        setTours(
          allowed?.length > 0
            ? active.filter(u => allowed.includes(u.id))
            : active,
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalPax    = adults + kids;
  const tourPrice   = Number(selectedTour?.base_price || 0);
  const totalPrice  = tourPrice * totalPax;
  const commission  = (totalPrice * commPct) / 100;

  const meta = selectedTour ? parseMeta(selectedTour.description) : {};
  const timeSlots = meta.start_time
    ? [meta.start_time, ...(meta.time_slots || [])]
    : ['09:00', '11:00', '14:00', '16:00'];

  const next7Days = useMemo(() => (
    Array.from({ length: 7 }, (_, i) => addDays(TODAY, i))
  ), []);

  async function handleConfirm() {
    if (!clientName.trim()) { setError('Nome do cliente obrigatorio.'); return; }
    setSaving(true);
    setError('');
    try {
      const reservation = await createReservation({
        unit_id:          selectedTour.id,
        check_in:         selectedDate,
        check_out:        selectedDate,
        guests:           totalPax,
        total_amount:     totalPrice,
        payment_method:   'cash',
        payment_status:   'pending',
        source:           'manual',
        notes_internal:   `Vendedor: ${sellerName} (${sellerId}) | Hora: ${selectedTime}`,
        notes_guest:      JSON.stringify({
          phone:         clientPhone,
          special_requirements: notes,
        }),
        customer_name:    clientName,
        customer_email:   clientEmail,
        customer_phone:   clientPhone,
      });

      const comm = addCommissionLocal({
        seller_id:      sellerId,
        reservation_id: reservation.id,
        tour_name:      selectedTour.name,
        total_amount:   totalPrice,
        percentage:     commPct,
      });

      setSuccessData({
        reservation,
        commission: comm.amount,
        tourName:   selectedTour.name,
        date:       selectedDate,
        time:       selectedTime,
        pax:        totalPax,
        total:      totalPrice,
      });
      setStep(4);
    } catch (err) {
      setError(err?.response?.data?.error || 'Erro ao criar reserva. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setSelectedTour(null); setSelectedDate(TODAY); setSelectedTime('');
    setAdults(1); setKids(0); setClientName(''); setClientEmail('');
    setClientPhone(''); setNotes(''); setSuccessData(null);
    setError(''); setStep(1);
  }

  /* ── Progress bar ── */
  const STEPS = ['Tour', 'Data e Grupo', 'Cliente'];

  return (
    <div className="min-h-screen bg-n-50 flex flex-col max-w-md mx-auto">
      {/* Header */}
      <header className="bg-ocean-900 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        {step < 4 && (
          <button
            onClick={() => step > 1 ? setStep(s => s - 1) : navigate('/vendedor')}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-ocean-800 transition-colors">
            <ChevronLeft size={20} strokeWidth={1.75} className="text-white" />
          </button>
        )}
        <div className="flex-1">
          <p className="font-display font-bold text-white text-base">
            {step === 4 ? 'Reserva confirmada' : 'Nova Reserva'}
          </p>
          {step < 4 && (
            <p className="text-ocean-400 text-xs mt-0.5">Passo {step} de 3 — {STEPS[step - 1]}</p>
          )}
        </div>
      </header>

      {/* Progress bar */}
      {step < 4 && (
        <div className="flex gap-0.5 px-4 py-2 bg-ocean-900">
          {[1, 2, 3].map(i => (
            <div key={i} className={`flex-1 h-1 rounded-full transition-colors ${i <= step ? 'bg-sand-500' : 'bg-ocean-800'}`} />
          ))}
        </div>
      )}

      <main className="flex-1 px-4 pb-8 pt-4">
        {/* ── Step 1: Select Tour ── */}
        {step === 1 && (
          <div>
            <p className="font-display font-semibold text-base text-n-900 mb-4">Selecciona o tour</p>
            {loading ? (
              <div className="flex justify-center py-16">
                <div className="w-8 h-8 border-3 border-ocean-200 border-t-ocean-700 rounded-full animate-spin" />
              </div>
            ) : tours.length === 0 ? (
              <div className="text-center py-12 text-n-400">
                <MapPin size={32} strokeWidth={1.25} className="mx-auto mb-3" />
                <p className="font-body">Nenhum tour disponivel para venda.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {tours.map(tour => {
                  const m = parseMeta(tour.description);
                  return (
                    <button
                      key={tour.id}
                      onClick={() => { setSelectedTour(tour); setStep(2); }}
                      className="bg-white rounded-xl border-2 border-n-200 p-4 flex items-center gap-4 text-left active:scale-[0.99] transition-all hover:border-ocean-400">
                      {tour.images?.[0] ? (
                        <img src={tour.images[0]} alt={tour.name}
                          className="w-16 h-16 rounded-lg object-cover shrink-0"
                          onError={e => { e.target.style.display = 'none'; }} />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-ocean-50 flex items-center justify-center shrink-0">
                          <MapPin size={24} strokeWidth={1.25} className="text-ocean-300" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-display font-semibold text-n-900">{tour.name}</p>
                        {m.duration_hours && (
                          <p className="text-xs font-body text-n-400 mt-0.5 flex items-center gap-1">
                            <Clock size={11} strokeWidth={1.75} />{m.duration_hours}h
                          </p>
                        )}
                        {tour.capacity > 0 && (
                          <p className="text-xs font-body text-n-400 flex items-center gap-1">
                            <Users size={11} strokeWidth={1.75} />max {tour.capacity} pax
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-display font-bold text-lg text-ocean-700">€{tour.base_price}</p>
                        <p className="text-[10px] font-mono text-n-400">/pessoa</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Date + Group ── */}
        {step === 2 && selectedTour && (
          <div className="space-y-6">
            {/* Selected tour summary */}
            <div className="bg-ocean-50 border border-ocean-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="flex-1">
                <p className="font-display font-semibold text-sm text-ocean-900">{selectedTour.name}</p>
                <p className="text-xs font-mono text-ocean-600">€{selectedTour.base_price}/pax</p>
              </div>
              <button onClick={() => setStep(1)} className="text-xs font-body text-ocean-700 underline">Mudar</button>
            </div>

            {/* Date picker */}
            <div>
              <p className="font-display font-semibold text-sm text-n-800 mb-3 flex items-center gap-2">
                <Calendar size={16} strokeWidth={1.75} />Data
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {next7Days.map(d => {
                  const dt   = new Date(d + 'T00:00:00Z');
                  const isT  = d === TODAY;
                  const isSel = d === selectedDate;
                  return (
                    <button key={d} onClick={() => setSelectedDate(d)}
                      className={`flex flex-col items-center px-3 py-2.5 rounded-xl border-2 min-w-[56px] transition-all active:scale-95 ${
                        isSel
                          ? 'bg-ocean-700 border-ocean-700 text-white'
                          : isT
                          ? 'border-ocean-300 text-ocean-700 bg-ocean-50'
                          : 'border-n-200 text-n-600 bg-white'
                      }`}>
                      <span className="text-[10px] font-mono uppercase tracking-wide opacity-75">
                        {DAYS_PT[dt.getUTCDay()]}
                      </span>
                      <span className="font-display font-bold text-lg leading-none mt-0.5">{dt.getUTCDate()}</span>
                      {isT && !isSel && <span className="text-[8px] font-mono text-ocean-600">Hoje</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time slots */}
            <div>
              <p className="font-display font-semibold text-sm text-n-800 mb-3 flex items-center gap-2">
                <Clock size={16} strokeWidth={1.75} />Horario
              </p>
              <div className="grid grid-cols-3 gap-2">
                {timeSlots.map(slot => (
                  <button key={slot} onClick={() => setSelectedTime(slot)}
                    className={`py-3 rounded-xl border-2 font-display font-semibold text-base transition-all active:scale-95 ${
                      selectedTime === slot
                        ? 'bg-ocean-700 border-ocean-700 text-white'
                        : 'bg-white border-n-200 text-n-700 hover:border-ocean-300'
                    }`}>
                    {slot}
                  </button>
                ))}
              </div>
            </div>

            {/* Counters */}
            <div>
              <p className="font-display font-semibold text-sm text-n-800 mb-2 flex items-center gap-2">
                <Users size={16} strokeWidth={1.75} />Composicao do grupo
              </p>
              <div className="bg-white rounded-xl border border-n-200 px-4 divide-y divide-n-100">
                <Counter label="Adultos" value={adults} min={1} onChange={setAdults} />
                <Counter label="Criancas" value={kids} min={0} onChange={setKids} />
              </div>
            </div>

            {/* Total */}
            <div className="bg-ocean-700 rounded-xl px-5 py-4 flex items-center justify-between text-white">
              <div>
                <p className="text-ocean-300 text-xs font-mono uppercase tracking-wide">Total</p>
                <p className="font-display font-bold text-2xl mt-0.5">€{totalPrice.toFixed(0)}</p>
                <p className="text-ocean-300 text-xs">{totalPax} pax × €{tourPrice}</p>
              </div>
              <div className="text-right">
                <p className="text-ocean-300 text-xs font-mono uppercase tracking-wide">A sua comissao</p>
                <p className="font-display font-bold text-xl mt-0.5 text-sand-300">€{commission.toFixed(0)}</p>
                <p className="text-ocean-300 text-xs">{commPct}%</p>
              </div>
            </div>

            <button
              onClick={() => { if (!selectedTime) { setError('Selecciona um horario.'); return; } setError(''); setStep(3); }}
              className="w-full h-16 bg-ocean-700 text-white rounded-xl font-display font-bold text-lg flex items-center justify-center gap-2 active:scale-[0.99] transition-all hover:bg-ocean-800">
              Continuar
              <ChevronRight size={20} strokeWidth={2} />
            </button>
            {error && <p className="text-center text-sm text-error">{error}</p>}
          </div>
        )}

        {/* ── Step 3: Client data ── */}
        {step === 3 && (
          <div className="space-y-5">
            {/* Summary */}
            <div className="bg-n-50 border border-n-200 rounded-xl px-4 py-3 space-y-1.5">
              <p className="font-display font-semibold text-sm text-n-800">{selectedTour?.name}</p>
              <p className="text-xs font-body text-n-500 flex items-center gap-1.5">
                <Calendar size={12} strokeWidth={1.75} />{fmtDatePT(selectedDate)} — {selectedTime}
              </p>
              <p className="text-xs font-body text-n-500 flex items-center gap-1.5">
                <Users size={12} strokeWidth={1.75} />{adults} adulto(s){kids > 0 ? ` + ${kids} crianca(s)` : ''}
              </p>
              <p className="font-display font-semibold text-ocean-700">€{totalPrice.toFixed(0)}</p>
            </div>

            {/* Client fields */}
            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-1.5 text-sm font-body font-semibold text-n-700 mb-2">
                  <User size={14} strokeWidth={1.75} />Nome completo *
                </label>
                <input
                  type="text" required value={clientName} onChange={e => setClientName(e.target.value)}
                  placeholder="Nome e apelido do cliente"
                  className="w-full h-12 px-4 rounded-xl border-2 border-n-200 text-base font-body bg-white focus:outline-none focus:border-ocean-700 transition-colors"
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-sm font-body font-semibold text-n-700 mb-2">
                  <Mail size={14} strokeWidth={1.75} />Email
                </label>
                <input
                  type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)}
                  placeholder="cliente@email.com"
                  className="w-full h-12 px-4 rounded-xl border-2 border-n-200 text-base font-body bg-white focus:outline-none focus:border-ocean-700 transition-colors"
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-sm font-body font-semibold text-n-700 mb-2">
                  <Phone size={14} strokeWidth={1.75} />Telefone / WhatsApp
                </label>
                <input
                  type="tel" value={clientPhone} onChange={e => setClientPhone(e.target.value)}
                  placeholder="+238 900 0000"
                  className="w-full h-12 px-4 rounded-xl border-2 border-n-200 text-base font-body bg-white focus:outline-none focus:border-ocean-700 transition-colors"
                />
              </div>

              <div>
                <label className="text-sm font-body font-semibold text-n-700 mb-2 block">
                  Notas especiais (opcional)
                </label>
                <textarea
                  value={notes} onChange={e => setNotes(e.target.value)}
                  rows={3} placeholder="Ex: vegetariano, aniversario, necessidades especiais..."
                  className="w-full px-4 py-3 rounded-xl border-2 border-n-200 text-base font-body bg-white focus:outline-none focus:border-ocean-700 resize-none transition-colors"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <p className="text-sm text-error">{error}</p>
              </div>
            )}

            {/* Commission preview */}
            <div className="bg-[#ECFDF5] border border-green-200 rounded-xl px-4 py-3 flex items-center justify-between">
              <p className="text-sm font-body text-[#1A7A4A]">A tua comissao nesta reserva</p>
              <p className="font-display font-bold text-xl text-[#1A7A4A]">€{commission.toFixed(0)}</p>
            </div>

            <button
              onClick={handleConfirm}
              disabled={saving || !clientName.trim()}
              className="w-full h-16 bg-ocean-700 text-white rounded-xl font-display font-bold text-lg flex items-center justify-center gap-2 active:scale-[0.99] transition-all hover:bg-ocean-800 disabled:opacity-50 disabled:cursor-not-allowed">
              {saving ? (
                <span className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>Confirmar Reserva <Check size={20} strokeWidth={2.5} /></>
              )}
            </button>
          </div>
        )}

        {/* ── Step 4: Success ── */}
        {step === 4 && successData && (
          <div className="flex flex-col items-center text-center py-8 space-y-6">
            {/* Success icon */}
            <div className="w-20 h-20 bg-[#ECFDF5] rounded-full flex items-center justify-center">
              <Check size={36} strokeWidth={2.5} className="text-[#1A7A4A]" />
            </div>

            <div>
              <p className="font-display font-bold text-2xl text-n-900">Reserva confirmada!</p>
              <p className="text-n-500 font-body mt-1">{successData.tourName}</p>
              <p className="text-n-400 text-sm font-body">{fmtDatePT(successData.date)} — {successData.time}</p>
            </div>

            {/* Commission earned */}
            <div className="bg-ocean-700 rounded-2xl px-8 py-5 w-full">
              <p className="text-ocean-300 text-sm font-body">Ganhaste nesta reserva</p>
              <p className="font-display font-bold text-4xl text-white mt-1">€{successData.commission.toFixed(0)}</p>
              <p className="text-ocean-300 text-xs mt-1">{commPct}% de €{successData.total.toFixed(0)}</p>
            </div>

            <div className="bg-n-50 rounded-xl px-4 py-3 w-full text-left space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-n-500">Pax</span>
                <span className="font-body font-semibold text-n-800">{successData.pax} pessoa(s)</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-n-500">Total cobrado</span>
                <span className="font-display font-bold text-ocean-700">€{successData.total.toFixed(0)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-3 w-full">
              <button
                onClick={resetForm}
                className="w-full h-14 bg-ocean-700 text-white rounded-xl font-display font-bold text-base active:scale-[0.99] transition-all hover:bg-ocean-800">
                Nova Reserva
              </button>
              <button
                onClick={() => navigate('/vendedor')}
                className="w-full h-12 bg-white border-2 border-n-200 text-n-700 rounded-xl font-body font-semibold text-sm active:scale-[0.99] transition-all hover:border-ocean-300">
                Ver Minhas Reservas
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
