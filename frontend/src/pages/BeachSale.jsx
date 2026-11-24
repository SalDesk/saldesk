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
  getSellerCommissionPct, getSellerMeta,
} from '../services/sellerService';
import { getMyProfile } from '../services/staffService';
import useAuthStore from '../store/authStore';
import Logo from '../components/shared/Logo';
import { buildWhatsAppLink } from '../utils/whatsapp';
import { getMonthGrid } from '../utils/calendar';
import { useT } from '../i18n';
import useUiStore from '../store/uiStore';
import {
  opcoesValidas, nomeOpcao, unidadeOpcao, limitarVeiculos, precoEstimado, opcaoMaisBarata,
} from '../utils/opcoesActividade';
import { mensagemErro } from '../utils/mensagemErro';
import LanguageToggle from '../components/shared/LanguageToggle';
import { rotuloMes } from '../utils/rotuloMes';
import { rotuloDiaMes, euroPreco } from '../utils/formatoVendedor';
import { eurosInteiros } from './reservations/shared';

/* ── helpers ── */
/* Data local do dispositivo, nao UTC -- ver nota em BeachSeller.jsx */
const TODAY = new Date().toLocaleDateString('en-CA');
const DIAS_SEMANA = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const TOUR_ICON_BG = ['bg-turquoise-100 text-turquoise-700', 'bg-sand-100 text-sand-600', 'bg-ocean-100 text-ocean-700'];

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
  const t = useT();
  const lang = useUiStore((s) => s.lang);
  const eur = (v) => eurosInteiros(v, lang);
  const preco = (v) => euroPreco(v, lang);
  const langOpcao = lang === 'pt' ? 'pt' : 'en';

  const sellerId   = user?.user_metadata?.staff_id || user?.id;
  const sellerName = user?.user_metadata?.name || user?.email || 'Vendedor'; /* so vai nas notas internas da reserva, nunca se mostra */
  const sellerMeta = getSellerMeta(sellerId);

  const [profile, setProfile] = useState(null);
  /* commission_pct real vem do proprio perfil (GET /staff/me) -- o
     mecanismo antigo (getSellerCommissionPct/localStorage) nunca era
     preenchido em lado nenhum do codigo, por isso mostrava sempre o
     valor por omissao (10%) em vez da percentagem real configurada
     pelo operador. Fica so como ultimo recurso se o perfil falhar. */
  const commPct = profile?.commission_pct ?? getSellerCommissionPct(sellerId, 10);

  useEffect(() => {
    getMyProfile().then(setProfile).catch(() => {});
  }, []);

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
  const [clientHotel,  setClientHotel]  = useState('');
  const [clientRoom,   setClientRoom]   = useState('');
  const [notes,        setNotes]        = useState('');
  /* Opcao (variante) escolhida e veiculos pedidos -- so para tours com opcoes */
  const [selectedOptionId, setSelectedOptionId] = useState(null);
  const [vehiclesReq,      setVehiclesReq]      = useState(null);

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

  const meta = selectedTour ? parseMeta(selectedTour.description) : {};
  /* Tour com opcoes: o preco vem da opcao (a mais barata se nada for escolhido, como no
     servidor) e todos contam como adultos -- sem preco de crianca neste ecra. */
  const tourOptions = opcoesValidas(meta);
  const selectedOption = tourOptions.length > 0
    ? (tourOptions.find(o => o.id === selectedOptionId) || opcaoMaisBarata(meta))
    : null;
  const porVeiculo   = selectedOption?.type === 'per_vehicle';
  const vehiclesMin  = porVeiculo ? limitarVeiculos(selectedOption.seats, totalPax) : 0;
  const vehicles     = porVeiculo ? limitarVeiculos(selectedOption.seats, totalPax, vehiclesReq) : null;
  const totalPrice   = selectedOption
    ? precoEstimado(selectedOption, { adults: totalPax, children: 0, vehicles })
    : tourPrice * totalPax;
  const commission  = (totalPrice * commPct) / 100;
  /* O TourForm grava os horarios como { time, capacity }; descricoes antigas
     podem ter texto simples. Aqui so interessa a hora (sem repeticoes). */
  const extraSlots = (Array.isArray(meta.time_slots) ? meta.time_slots : [])
    .map(s => (typeof s === 'string' ? s : s?.time))
    .filter(t => typeof t === 'string' && t);
  /* Com horarios configurados (time_slots) o servidor so aceita essas horas e exige-as em
     start_time (senao recusa com INVALID_TIME_SLOT): mostram-se so esses. Sem horarios, a hora
     de inicio do tour; sem nenhuma, os horarios por omissao (a hora fica so nas notas). */
  const temHorarios = extraSlots.length > 0;
  const horariosDoTour = temHorarios
    ? [...new Set(extraSlots)]
    : [meta.start_time].filter(t => typeof t === 'string' && t);
  const timeSlots = horariosDoTour.length ? horariosDoTour : ['09:00', '11:00', '14:00', '16:00'];

  async function handleConfirm() {
    if (!clientName.trim()) { setError(t('beachSeller.sale.errName')); return; }
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
          hotel:         clientHotel,
          room:          clientRoom,
          special_requirements: notes,
        }),
        customer_name:    clientName,
        customer_email:   clientEmail,
        customer_phone:   clientPhone,
        fleet_id:         selectedFleetId || null,
        ...(temHorarios ? { start_time: selectedTime } : {}),
        ...(selectedOption ? { option_id: selectedOption.id } : {}),
        ...(porVeiculo ? { vehicles } : {}),
      });

      // A comissao e criada automaticamente no backend ao criar a reserva
      // (com base em staff.commission_pct do vendedor autenticado)
      setSuccessData({
        reservation,
        commission,
        tourName:   selectedTour.name,
        date:       selectedDate,
        time:       selectedTime,
        pax:        totalPax,
        total:      totalPrice,
        clientName,
        clientPhone,
        clientHotel,
        clientRoom,
      });
      setStep(4);
    } catch (err) {
      setError(mensagemErro(err, t, t('beachSeller.sale.errCreate')));
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setSelectedTour(null); setSelectedDate(TODAY); setSelectedTime('');
    setAdults(1); setKids(0); setClientName(''); setClientEmail('');
    setClientPhone(''); setClientHotel(''); setClientRoom('');
    setNotes(''); setSuccessData(null);
    setSelectedOptionId(null); setVehiclesReq(null);
    setAvailableFleet([]); setSelectedFleetId(null);
    setError(''); setStep(1);
  }

  /* ── Progress bar ── */
  const STEPS = [t('beachSeller.sale.stepTour'), t('beachSeller.sale.stepDateGroup'), t('beachSeller.sale.stepCustomer')];

  return (
    <div className="min-h-screen bg-n-50 flex flex-col max-w-md md:max-w-2xl lg:max-w-3xl xl:max-w-4xl mx-auto">
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
            {step === 4 ? t('beachSeller.sale.confirmed') : t('beachSeller.newBooking')}
          </p>
          {step < 4 && (
            <p className="text-ocean-300 text-xs mt-0.5">{t('beachSeller.sale.step', { step, name: STEPS[step - 1] })}</p>
          )}
        </div>
        <LanguageToggle variant="white" />
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
            <p className="font-display font-semibold text-base text-n-900 mb-4">{t('beachSeller.sale.selectTour')}</p>
            {loading ? (
              <div className="flex justify-center py-16">
                <div className="w-8 h-8 border-3 border-ocean-200 border-t-ocean-700 rounded-full animate-spin" />
              </div>
            ) : tours.length === 0 ? (
              <div className="text-center py-12 text-n-400">
                <MapPin size={32} strokeWidth={1.25} className="mx-auto mb-3" />
                <p className="font-body">{t('beachSeller.sale.noTours')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {tours.map((tour, i) => {
                  const m = parseMeta(tour.description);
                  const maisBarata = opcaoMaisBarata(m);
                  const iconBg = TOUR_ICON_BG[i % TOUR_ICON_BG.length];
                  return (
                    <button
                      key={tour.id}
                      onClick={() => {
                        setSelectedTour(tour); setSelectedOptionId(maisBarata?.id ?? null); setVehiclesReq(null); setStep(2);
                      }}
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
                            <Users size={11} strokeWidth={1.75} />{t('beachSeller.sale.maxPax', { n: tour.capacity })}
                          </p>
                        )}
                      </div>
                      {maisBarata ? (
                        <div className="text-right shrink-0">
                          <p className="text-[10px] font-mono text-n-400">{t('opcoesActividade.from')}</p>
                          <p className="font-display font-bold text-lg text-ocean-700">{preco(maisBarata.price)}</p>
                          <p className="text-[10px] font-mono text-n-400">{unidadeOpcao(maisBarata, langOpcao)}</p>
                        </div>
                      ) : (
                        <div className="text-right shrink-0">
                          <p className="font-display font-bold text-lg text-ocean-700">{preco(tour.base_price)}</p>
                          <p className="text-[10px] font-mono text-n-400">{t('beachSeller.sale.perPerson')}</p>
                        </div>
                      )}
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
                <p className="text-xs font-mono text-ocean-600">
                  {selectedOption
                    ? `${nomeOpcao(selectedOption, langOpcao)} · ${preco(selectedOption.price)} ${unidadeOpcao(selectedOption, langOpcao)}`
                    : t('beachSeller.sale.perPax', { price: preco(selectedTour.base_price) })}
                </p>
              </div>
              <button onClick={() => setStep(1)} className="text-xs font-body text-ocean-700 underline">{t('beachSeller.sale.change')}</button>
            </div>

            {/* Opcoes do tour (variantes) -- so quando o tour as tem */}
            {tourOptions.length > 0 && (
              <div>
                <p className="font-display font-semibold text-sm text-n-800 mb-3">{t('opcoesActividade.option')}</p>
                <div className="grid grid-cols-1 gap-2">
                  {tourOptions.map(o => {
                    const activa = o.id === selectedOption?.id;
                    return (
                      <button
                        key={o.id} type="button" aria-pressed={activa}
                        onClick={() => { setSelectedOptionId(o.id); setVehiclesReq(null); }}
                        className={`px-4 py-3 rounded-2xl border-2 flex items-center justify-between gap-3 text-left transition-all active:scale-[0.99] ${
                          activa
                            ? 'bg-turquoise-500 border-turquoise-500 text-white'
                            : 'bg-white border-n-200 text-n-800 hover:border-turquoise-300'
                        }`}>
                        <span className="font-display font-semibold text-base">{nomeOpcao(o, langOpcao)}</span>
                        <span className="text-sm font-body shrink-0">{preco(o.price)} {unidadeOpcao(o, langOpcao)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Date picker — calendario mensal completo */}
            <div>
              <p className="font-display font-semibold text-sm text-n-800 mb-3 flex items-center gap-2">
                <Calendar size={16} strokeWidth={1.75} />{t('beachSeller.sale.date')}
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
                    aria-label={t('beachSeller.prevMonth')}
                  >
                    <ChevronLeft size={18} strokeWidth={2} />
                  </button>
                  <p className="font-display font-bold text-base text-n-900">
                    {rotuloMes(viewMonth.month, t)} {viewMonth.year}
                  </p>
                  <button
                    type="button"
                    onClick={() => setViewMonth(v => {
                      const m = v.month === 11 ? 0 : v.month + 1;
                      const y = v.month === 11 ? v.year + 1 : v.year;
                      return { year: y, month: m };
                    })}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-n-500 hover:bg-n-100 active:scale-95 transition-all"
                    aria-label={t('beachSeller.nextMonth')}
                  >
                    <ChevronRight size={18} strokeWidth={2} />
                  </button>
                </div>

                {/* Cabecalho dos dias da semana */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {DIAS_SEMANA.map(d => (
                    <div key={d} className="text-center text-[10px] font-mono uppercase tracking-wide text-n-400 py-1">
                      {t(`staff.days.${d}`)}
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
                <Clock size={16} strokeWidth={1.75} />{t('beachSeller.sale.time')}
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
                <Users size={16} strokeWidth={1.75} />{t('beachSeller.sale.group')}
              </p>
              <div className="bg-white rounded-2xl border border-n-200 px-4 divide-y divide-n-100">
                <Counter label={t('beachSeller.sale.adults')} value={adults} min={1} onChange={v => { setAdults(v); setVehiclesReq(null); }} />
                <Counter label={t('beachSeller.sale.children')} value={kids} min={0} onChange={v => { setKids(v); setVehiclesReq(null); }} />
                {porVeiculo && (
                  <Counter label={t('opcoesActividade.vehicles')} value={vehicles} min={vehiclesMin} max={Math.max(vehiclesMin, totalPax)} onChange={setVehiclesReq} />
                )}
              </div>
            </div>

            {/* Total */}
            <div className="bg-gradient-to-br from-ocean-700 to-turquoise-600 rounded-2xl px-5 py-4 flex items-center justify-between text-white">
              <div>
                <p className="text-white/70 text-xs font-mono uppercase tracking-wide">{t('beachSeller.sale.total')}</p>
                <p className="font-display font-bold text-2xl mt-0.5">{eur(totalPrice)}</p>
                <p className="text-white/70 text-xs">
                  {!selectedOption
                    ? t('beachSeller.sale.paxTimes', { pax: totalPax, price: preco(tourPrice) })
                    : porVeiculo
                      ? t('beachSeller.sale.vehiclesTimes', { vehicles: t('opcoesActividade.vehiclesCount', { n: vehicles }), price: preco(selectedOption.price) })
                      : selectedOption.type === 'per_group'
                        ? t('beachSeller.sale.paxOption', { pax: totalPax, name: nomeOpcao(selectedOption, langOpcao) })
                        : t('beachSeller.sale.paxTimes', { pax: totalPax, price: preco(selectedOption.price) })}
                </p>
              </div>
              <div className="text-right">
                <p className="text-white/70 text-xs font-mono uppercase tracking-wide">{t('beachSeller.sale.yourCommission')}</p>
                <p className="font-display font-bold text-xl mt-0.5 text-sand-300">{eur(commission)}</p>
                <p className="text-white/70 text-xs">{commPct}%</p>
              </div>
            </div>

            <button
              onClick={() => {
                if (!selectedTime) { setError(t('beachSeller.sale.errTime')); return; }
                if (availableFleet.length > 0) {
                  if (availableFleet.every(v => !v.available)) {
                    setError(t('beachSeller.sale.errNoBuggies'));
                    return;
                  }
                  if (!selectedFleetId) {
                    setError(t('beachSeller.sale.errPickBuggy'));
                    return;
                  }
                }
                setError(''); setStep(3);
              }}
              className="w-full h-16 bg-gradient-to-r from-ocean-700 to-turquoise-600 text-white rounded-2xl font-display font-bold text-lg flex items-center justify-center gap-2 active:scale-[0.99] transition-all hover:opacity-90">
              {t('beachSeller.sale.next')}
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
                <Calendar size={12} strokeWidth={1.75} />{rotuloDiaMes(selectedDate, t)} — {selectedTime}
              </p>
              <p className="text-xs font-body text-n-500 flex items-center gap-1.5">
                <Users size={12} strokeWidth={1.75} />{t('beachSeller.sale.adultsCount', { n: adults })}{kids > 0 ? t('beachSeller.sale.childrenExtra', { n: kids }) : ''}
              </p>
              <p className="font-display font-semibold text-ocean-700">{eur(totalPrice)}</p>
            </div>

            {/* Client fields */}
            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-1.5 text-sm font-body font-semibold text-n-700 mb-2">
                  <User size={14} strokeWidth={1.75} />{t('beachSeller.sale.fullName')}
                </label>
                <input
                  type="text" required value={clientName} onChange={e => setClientName(e.target.value)}
                  placeholder={t('beachSeller.sale.fullNamePh')}
                  className="w-full h-12 px-4 rounded-2xl border-2 border-n-200 text-base font-body bg-white focus:outline-none focus:border-turquoise-500 transition-colors"
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-sm font-body font-semibold text-n-700 mb-2">
                  <Mail size={14} strokeWidth={1.75} />{t('beachSeller.sale.email')}
                </label>
                <input
                  type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)}
                  placeholder={t('beachSeller.sale.emailPh')}
                  className="w-full h-12 px-4 rounded-2xl border-2 border-n-200 text-base font-body bg-white focus:outline-none focus:border-turquoise-500 transition-colors"
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-sm font-body font-semibold text-n-700 mb-2">
                  <Phone size={14} strokeWidth={1.75} />{t('beachSeller.sale.phone')}
                </label>
                <input
                  type="tel" value={clientPhone} onChange={e => setClientPhone(e.target.value)}
                  placeholder="+238 900 0000"
                  className="w-full h-12 px-4 rounded-2xl border-2 border-n-200 text-base font-body bg-white focus:outline-none focus:border-turquoise-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center gap-1.5 text-sm font-body font-semibold text-n-700 mb-2">
                    <MapPin size={14} strokeWidth={1.75} />{t('beachSeller.sale.hotel')}
                  </label>
                  <input
                    type="text" value={clientHotel} onChange={e => setClientHotel(e.target.value)}
                    placeholder={t('beachSeller.sale.hotelPh')}
                    className="w-full h-12 px-4 rounded-2xl border-2 border-n-200 text-base font-body bg-white focus:outline-none focus:border-turquoise-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-sm font-body font-semibold text-n-700 mb-2 block">
                    {t('beachSeller.sale.room')}
                  </label>
                  <input
                    type="text" value={clientRoom} onChange={e => setClientRoom(e.target.value)}
                    placeholder={t('beachSeller.sale.roomPh')}
                    className="w-full h-12 px-4 rounded-2xl border-2 border-n-200 text-base font-body bg-white focus:outline-none focus:border-turquoise-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-body font-semibold text-n-700 mb-2 block">
                  {t('beachSeller.sale.notes')}
                </label>
                <textarea
                  value={notes} onChange={e => setNotes(e.target.value)}
                  rows={3} placeholder={t('beachSeller.sale.notesPh')}
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
              <p className="text-sm font-body text-turquoise-700">{t('beachSeller.sale.commissionPreview')}</p>
              <p className="font-display font-bold text-xl text-turquoise-700">{eur(commission)}</p>
            </div>

            <button
              onClick={handleConfirm}
              disabled={saving || !clientName.trim()}
              className="w-full h-16 bg-sand-500 text-ocean-900 rounded-full font-display font-bold text-lg flex items-center justify-center gap-2 active:scale-[0.99] transition-all hover:bg-sand-600 disabled:opacity-50 disabled:cursor-not-allowed">
              {saving ? (
                <span className="w-6 h-6 border-3 border-ocean-900/30 border-t-ocean-900 rounded-full animate-spin" />
              ) : (
                <>{t('beachSeller.sale.confirm')} <Check size={20} strokeWidth={2.5} /></>
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
              <p className="font-display font-bold text-2xl text-n-900">{t('beachSeller.sale.done')}</p>
              <p className="text-n-500 font-body mt-1">{successData.tourName}</p>
              <p className="text-n-400 text-sm font-body">{rotuloDiaMes(successData.date, t)} — {successData.time}</p>
            </div>

            {/* Commission earned */}
            <div className="bg-gradient-to-br from-ocean-700 to-turquoise-600 rounded-3xl px-8 py-5 w-full">
              <p className="text-white/70 text-sm font-body">{t('beachSeller.sale.earned')}</p>
              <p className="font-display font-bold text-4xl text-white mt-1">{eur(successData.commission)}</p>
              <p className="text-white/70 text-xs mt-1">{t('beachSeller.sale.pctOf', { pct: commPct, amount: eur(successData.total) })}</p>
            </div>

            <div className="bg-n-50 rounded-2xl px-4 py-3 w-full text-left space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-n-500">{t('beachSeller.sale.pax')}</span>
                <span className="font-body font-semibold text-n-800">{t('beachSeller.sale.people', { n: successData.pax })}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-n-500">{t('beachSeller.sale.charged')}</span>
                <span className="font-display font-bold text-ocean-700">{eur(successData.total)}</span>
              </div>
              {successData.clientHotel && (
                <div className="flex justify-between text-sm">
                  <span className="text-n-500">{t('beachSeller.sale.hotel')}</span>
                  <span className="font-body font-semibold text-n-800">
                    {successData.clientHotel}{successData.clientRoom ? t('beachSeller.sale.roomSuffix', { room: successData.clientRoom }) : ''}
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 w-full">
              <button
                onClick={resetForm}
                className="w-full h-16 bg-sand-500 text-ocean-900 rounded-full font-display font-bold text-lg active:scale-[0.99] transition-all hover:bg-sand-600">
                {t('beachSeller.newBooking')}
              </button>
              <button
                onClick={() => navigate('/vendedor')}
                className="w-full h-12 bg-white border-2 border-n-200 text-n-700 rounded-2xl font-body font-semibold text-sm active:scale-[0.99] transition-all hover:border-turquoise-300">
                {t('beachSeller.sale.viewMine')}
              </button>
              {successData.clientPhone && (
                <a
                  href={buildWhatsAppLink(
                    successData.clientPhone,
                    t('beachSeller.sale.whatsappConfirm', { name: successData.clientName, tour: successData.tourName, date: rotuloDiaMes(successData.date, t), time: successData.time })
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full h-12 bg-[#25D366] text-white rounded-2xl font-body font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.99] transition-all hover:bg-[#1FB855]"
                >
                  <MessageCircle size={18} strokeWidth={1.75} />
                  {t('beachSeller.sale.sendWhatsapp')}
                </a>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
