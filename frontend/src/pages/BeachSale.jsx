import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Plus, Minus,
  Check, User, Mail, Phone, Calendar,
  Clock, Users, MapPin, MessageCircle,
} from 'lucide-react';
import { listUnits } from '../services/unitsService';
import { createReservation } from '../services/reservationsService';
import FleetSelector from '../components/fleet/FleetSelector';
import {
  addCommissionLocal, getSellerCommissionPct, getSellerMeta,
} from '../services/sellerService';
import useAuthStore from '../store/authStore';
import Logo from '../components/shared/Logo';
import { buildWhatsAppLink } from '../utils/whatsapp';
import { getMonthGrid } from '../utils/calendar';

/* ── helpers ── */
const TODAY = new Date().toISOString().slice(0, 10);
const MONTHS_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const DAYS_PT   = ['Dom','Seg','Ter','Qua','Qui','Sex','Sab'];
const TOUR_ICON_BG = ['bg-turquoise-100 text-turquoise-700', 'bg-sand-100 text-sand-600', 'bg-ocean-100 text-ocean-700'];

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
          className="w-12 h-12 rounded-full border-2 border-n-200 flex items-center justify-center text-n-700 hover:border-turquoise-500 hover:text-turquoise-600 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all">
          <Minus size={18} strokeWidth={2} />
        </button>
        <span className="font-display font-bold text-xl text-n-900 w-8 text-center">{value}</span>
        <button
          type="button" onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="w-12 h-12 rounded-full bg-turquoise-500 text-white flex items-center justify-center hover:bg-turquoise-600 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all">
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
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
  });
  const [selectedTime, setSelectedTime] = useState('');
  const [adults,       setAdults]       = useState(1);
  const [kids,         setKids]         = useState(0);
  const [clientName,   setClientName]   = useState('');
  const [clientEmail,  setClientEmail]  = useState('');
  const [clientPhone,  setClientPhone]  = useState('');
  const [notes,        setNotes]        = useState('');

  /* Fleet state */
  const [availableFleet,  setAvailableFleet]  = useState([]);
  const [selectedFleetId, setSelectedFleetId] = useState(null);

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
        fleet_id:         selectedFleetId || null,
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
        clientName,
        clientPhone,
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
    setAvailableFleet([]); setSelectedFleetId(null);
    setError(''); setStep(1);
  }

  /* ── Progress bar ── */
  const STEPS = ['Tour', 'Data e Grupo', 'Cliente'];

  return (
    <div className="min-h-screen bg-n-50 flex flex-col max-w-md mx-auto">
      {/* Header */}
      <header className="bg-gradient-to-br from-ocean-900 to-ocean-700 px-4 py-4 flex items-center gap-3 sticky top-0 z-10 rounded-b-3xl shadow-md">
        {step < 4 && (
          <button
            onClick={() => step > 1 ? setStep(s => s - 1) : navigate('/vendedor')}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 active:scale-95 transition-colors shrink-0">
            <ChevronLeft size={20} strokeWidth={1.75} className="text-white" />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-display font-bold text-white text-base truncate">
            {step === 4 ? 'Reserva confirmada' : 'Nova Reserva'}
          </p>
          {step < 4 && (
            <p className="text-ocean-300 text-xs mt-0.5">Passo {step} de 3 — {STEPS[step - 1]}</p>
          )}
        </div>
        <Logo white size="sm" />
      </header>

      {/* Progress bar */}
      {step < 4 && (
        <div className="flex gap-1.5 px-4 py-3 bg-white">
          {[1, 2, 3].map(i => (
            <div key={i} className={`flex-1 h-1.5 rounded-full transition-colors ${
              i < step ? 'bg-sand-500' : i === step ? 'bg-ocean-700' : 'bg-n-200'
            }`} />
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
                {tours.map((tour, i) => {
                  const m = parseMeta(tour.description);
                  const iconBg = TOUR_ICON_BG[i % TOUR_ICON_BG.length];
                  return (
                    <button
                      key={tour.id}
                      onClick={() => { setSelectedTour(tour); setStep(2); }}
                      className="bg-white rounded-2xl border-2 border-n-200 shadow-sm p-4 flex items-center gap-4 text-left active:scale-[0.99] transition-all hover:border-turquoise-400">
                      {tour.images?.[0] ? (
                        <img src={tour.images[0]} alt={tour.name}
                          className="w-16 h-16 rounded-2xl object-cover shrink-0"
                          onError={e => { e.target.style.display = 'none'; }} />
                      ) : (
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 ${iconBg}`}>
                          <MapPin size={24} strokeWidth={1.25} />
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
            <div className="bg-ocean-50 border border-ocean-200 rounded-2xl px-4 py-3 flex items-center gap-3">
              <div className="flex-1">
                <p className="font-display font-semibold text-sm text-ocean-900">{selectedTour.name}</p>
                <p className="text-xs font-mono text-ocean-600">€{selectedTour.base_price}/pax</p>
              </div>
              <button onClick={() => setStep(1)} className="text-xs font-body text-ocean-700 underline">Mudar</button>
            </div>

            {/* Date picker — calendario mensal completo */}
            <div>
              <p className="font-display font-semibold text-sm text-n-800 mb-3 flex items-center gap-2">
                <Calendar size={16} strokeWidth={1.75} />Data
              </p>

              <div className="bg-white rounded-2xl border-2 border-n-200 p-4">
                {/* Navegacao de mes */}
                <div className="flex items-center justify-between mb-4">
                  <button
                    type="button"
                    onClick={() => setViewMonth(v => {
                      const m = v.month === 0 ? 11 : v.month - 1;
                      const y = v.month === 0 ? v.year - 1 : v.year;
                      return { year: y, month: m };
                    })}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-n-500 hover:bg-n-100 active:scale-95 transition-all"
                    aria-label="Mes anterior"
                  >
                    <ChevronLeft size={18} strokeWidth={2} />
                  </button>
                  <p className="font-display font-bold text-base text-n-900">
                    {MONTHS_PT[viewMonth.month]} {viewMonth.year}
                  </p>
                  <button
                    type="button"
                    onClick={() => setViewMonth(v => {
                      const m = v.month === 11 ? 0 : v.month + 1;
                      const y = v.month === 11 ? v.year + 1 : v.year;
                      return { year: y, month: m };
                    })}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-n-500 hover:bg-n-100 active:scale-95 transition-all"
                    aria-label="Mes seguinte"
                  >
                    <ChevronRight size={18} strokeWidth={2} />
                  </button>
                </div>

                {/* Cabecalho dos dias da semana */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {DAYS_PT.map(d => (
                    <div key={d} className="text-center text-[10px] font-mono uppercase tracking-wide text-n-400 py-1">
                      {d}
                    </div>
                  ))}
                </div>

                {/* Grelha de dias */}
                <div className="space-y-1">
                  {getMonthGrid(viewMonth.year, viewMonth.month).map((week, wi) => (
                    <div key={wi} className="grid grid-cols-7 gap-1">
                      {week.map((d, di) => {
                        if (!d) return <div key={di} />;
                        const isPast = d < TODAY;
                        const isT    = d === TODAY;
                        const isSel  = d === selectedDate;
                        const dayNum = Number(d.slice(8, 10));
                        return (
                          <button
                            key={d}
                            type="button"
                            disabled={isPast}
                            onClick={() => setSelectedDate(d)}
                            className={`aspect-square rounded-lg flex items-center justify-center text-sm font-body font-semibold transition-all active:scale-95 ${
                              isSel
                                ? 'bg-turquoise-500 text-white'
                                : isPast
                                ? 'text-n-300 cursor-not-allowed'
                                : isT
                                ? 'bg-ocean-50 text-ocean-700 border-2 border-ocean-300'
                                : 'text-n-700 hover:bg-n-100'
                            }`}
                          >
                            {dayNum}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
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
                    className={`py-3 rounded-2xl border-2 font-display font-semibold text-base transition-all active:scale-95 ${
                      selectedTime === slot
                        ? 'bg-turquoise-500 border-turquoise-500 text-white'
                        : 'bg-white border-n-200 text-n-700 hover:border-turquoise-300'
                    }`}>
                    {slot}
                  </button>
                ))}
              </div>
            </div>

            {/* Fleet selector — shown only when tour has associated vehicles */}
            <FleetSelector
              unitId={selectedTour?.id}
              date={selectedDate}
              value={selectedFleetId}
              onChange={setSelectedFleetId}
              onLoad={(data) => { setAvailableFleet(data); setSelectedFleetId(null); }}
            />

            {/* Counters */}
            <div>
              <p className="font-display font-semibold text-sm text-n-800 mb-2 flex items-center gap-2">
                <Users size={16} strokeWidth={1.75} />Composicao do grupo
              </p>
              <div className="bg-white rounded-2xl border border-n-200 px-4 divide-y divide-n-100">
                <Counter label="Adultos" value={adults} min={1} onChange={setAdults} />
                <Counter label="Criancas" value={kids} min={0} onChange={setKids} />
              </div>
            </div>

            {/* Total */}
            <div className="bg-gradient-to-br from-ocean-700 to-turquoise-600 rounded-2xl px-5 py-4 flex items-center justify-between text-white">
              <div>
                <p className="text-white/70 text-xs font-mono uppercase tracking-wide">Total</p>
                <p className="font-display font-bold text-2xl mt-0.5">€{totalPrice.toFixed(0)}</p>
                <p className="text-white/70 text-xs">{totalPax} pax × €{tourPrice}</p>
              </div>
              <div className="text-right">
                <p className="text-white/70 text-xs font-mono uppercase tracking-wide">A sua comissao</p>
                <p className="font-display font-bold text-xl mt-0.5 text-sand-300">€{commission.toFixed(0)}</p>
                <p className="text-white/70 text-xs">{commPct}%</p>
              </div>
            </div>

            <button
              onClick={() => {
                if (!selectedTime) { setError('Selecciona um horario.'); return; }
                if (availableFleet.length > 0) {
                  if (availableFleet.every(v => !v.available)) {
                    setError('Nao ha buggys disponiveis para esta data — escolhe outra data.');
                    return;
                  }
                  if (!selectedFleetId) {
                    setError('Por favor escolhe um buggy para continuar.');
                    return;
                  }
                }
                setError(''); setStep(3);
              }}
              className="w-full h-16 bg-gradient-to-r from-ocean-700 to-turquoise-600 text-white rounded-2xl font-display font-bold text-lg flex items-center justify-center gap-2 active:scale-[0.99] transition-all hover:opacity-90">
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
            <div className="bg-n-50 border border-n-200 rounded-2xl px-4 py-3 space-y-1.5">
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
                  className="w-full h-12 px-4 rounded-2xl border-2 border-n-200 text-base font-body bg-white focus:outline-none focus:border-turquoise-500 transition-colors"
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-sm font-body font-semibold text-n-700 mb-2">
                  <Mail size={14} strokeWidth={1.75} />Email
                </label>
                <input
                  type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)}
                  placeholder="cliente@email.com"
                  className="w-full h-12 px-4 rounded-2xl border-2 border-n-200 text-base font-body bg-white focus:outline-none focus:border-turquoise-500 transition-colors"
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-sm font-body font-semibold text-n-700 mb-2">
                  <Phone size={14} strokeWidth={1.75} />Telefone / WhatsApp
                </label>
                <input
                  type="tel" value={clientPhone} onChange={e => setClientPhone(e.target.value)}
                  placeholder="+238 900 0000"
                  className="w-full h-12 px-4 rounded-2xl border-2 border-n-200 text-base font-body bg-white focus:outline-none focus:border-turquoise-500 transition-colors"
                />
              </div>

              <div>
                <label className="text-sm font-body font-semibold text-n-700 mb-2 block">
                  Notas especiais (opcional)
                </label>
                <textarea
                  value={notes} onChange={e => setNotes(e.target.value)}
                  rows={3} placeholder="Ex: vegetariano, aniversario, necessidades especiais..."
                  className="w-full px-4 py-3 rounded-2xl border-2 border-n-200 text-base font-body bg-white focus:outline-none focus:border-turquoise-500 resize-none transition-colors"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
                <p className="text-sm text-error">{error}</p>
              </div>
            )}

            {/* Commission preview */}
            <div className="bg-turquoise-50 border border-turquoise-300 rounded-2xl px-4 py-3 flex items-center justify-between">
              <p className="text-sm font-body text-turquoise-700">A tua comissao nesta reserva</p>
              <p className="font-display font-bold text-xl text-turquoise-700">€{commission.toFixed(0)}</p>
            </div>

            <button
              onClick={handleConfirm}
              disabled={saving || !clientName.trim()}
              className="w-full h-16 bg-sand-500 text-ocean-900 rounded-full font-display font-bold text-lg flex items-center justify-center gap-2 active:scale-[0.99] transition-all hover:bg-sand-600 disabled:opacity-50 disabled:cursor-not-allowed">
              {saving ? (
                <span className="w-6 h-6 border-3 border-ocean-900/30 border-t-ocean-900 rounded-full animate-spin" />
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
            <div className="w-20 h-20 bg-turquoise-50 rounded-full flex items-center justify-center">
              <Check size={36} strokeWidth={2.5} className="text-turquoise-600" />
            </div>

            <div>
              <p className="font-display font-bold text-2xl text-n-900">Reserva confirmada!</p>
              <p className="text-n-500 font-body mt-1">{successData.tourName}</p>
              <p className="text-n-400 text-sm font-body">{fmtDatePT(successData.date)} — {successData.time}</p>
            </div>

            {/* Commission earned */}
            <div className="bg-gradient-to-br from-ocean-700 to-turquoise-600 rounded-3xl px-8 py-5 w-full">
              <p className="text-white/70 text-sm font-body">Ganhaste nesta reserva</p>
              <p className="font-display font-bold text-4xl text-white mt-1">€{successData.commission.toFixed(0)}</p>
              <p className="text-white/70 text-xs mt-1">{commPct}% de €{successData.total.toFixed(0)}</p>
            </div>

            <div className="bg-n-50 rounded-2xl px-4 py-3 w-full text-left space-y-1.5">
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
                className="w-full h-16 bg-sand-500 text-ocean-900 rounded-full font-display font-bold text-lg active:scale-[0.99] transition-all hover:bg-sand-600">
                Nova Reserva
              </button>
              <button
                onClick={() => navigate('/vendedor')}
                className="w-full h-12 bg-white border-2 border-n-200 text-n-700 rounded-2xl font-body font-semibold text-sm active:scale-[0.99] transition-all hover:border-turquoise-300">
                Ver Minhas Reservas
              </button>
              {successData.clientPhone && (
                <a
                  href={buildWhatsAppLink(
                    successData.clientPhone,
                    `Olá ${successData.clientName}! A sua reserva para ${successData.tourName} no dia ${fmtDatePT(successData.date)} às ${successData.time} está confirmada. Até breve!`
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full h-12 bg-[#25D366] text-white rounded-2xl font-body font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.99] transition-all hover:bg-[#1FB855]"
                >
                  <MessageCircle size={18} strokeWidth={1.75} />
                  Enviar confirmação por WhatsApp
                </a>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
