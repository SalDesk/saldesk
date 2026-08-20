import { useState, useEffect } from 'react';
import { Check, X, ArrowRight } from 'lucide-react';

/* Extraído de PublicBooking.jsx para ser reutilizado também pela ficha
   própria de um prato/menu de degustação (ServiceDetail.jsx) -- mesmo
   widget de reserva completo (data/hora/pessoas/zona/escolha de mesa/
   pré-pedido/contactos), sem duplicar lógica. */

const API     = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';
const EUR_CVE = 110;

export const MENU_CATEGORY_LABELS = {
  entradas:           { pt: 'Entradas',          en: 'Starters' },
  pratos_principais:  { pt: 'Pratos Principais',  en: 'Main Courses' },
  sobremesas:         { pt: 'Sobremesas',         en: 'Desserts' },
  bebidas:            { pt: 'Bebidas',            en: 'Drinks' },
  outros:             { pt: 'Outros',             en: 'Others' },
};
export const MENU_ALLERGEN_LABELS = {
  gluten: { pt: 'Glúten', en: 'Gluten' }, lactose: { pt: 'Lactose', en: 'Lactose' },
  frutos_secos: { pt: 'Frutos secos', en: 'Nuts' }, marisco: { pt: 'Marisco', en: 'Shellfish' },
  ovos: { pt: 'Ovos', en: 'Eggs' }, soja: { pt: 'Soja', en: 'Soy' },
  peixe: { pt: 'Peixe', en: 'Fish' }, amendoim: { pt: 'Amendoim', en: 'Peanuts' },
};
export const MENU_DIET_LABELS = {
  vegetariano: { pt: 'Vegetariano', en: 'Vegetarian' }, vegan: { pt: 'Vegan', en: 'Vegan' },
  sem_gluten: { pt: 'Sem glúten', en: 'Gluten-free' }, halal: { pt: 'Halal', en: 'Halal' },
};
export const ZONE_LABELS = {
  interior: { pt: 'Interior',  en: 'Indoor' },
  esplanada:{ pt: 'Esplanada', en: 'Terrace' },
  terraco:  { pt: 'Terraço',   en: 'Rooftop' },
  vip:      { pt: 'VIP',       en: 'VIP' },
  privado:  { pt: 'Privado',   en: 'Private' },
};
export const REST_SLOTS = ['12:00','12:30','13:00','13:30','14:00','14:30','19:00','19:30','20:00','20:30','21:00','21:30','22:00','22:30'];

export function parseMenuMeta(unit) {
  try { return JSON.parse(unit?.description || '{}'); } catch { return {}; }
}

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

export function fmtMoney(amount, opCurrency, viewCurrency) {
  if (viewCurrency === 'CVE') {
    const cve = (opCurrency || 'EUR') === 'CVE' ? amount : amount * EUR_CVE;
    return `${Math.round(cve).toLocaleString('pt-PT')} CVE`;
  }
  const eur = (opCurrency || 'EUR') === 'CVE' ? amount / EUR_CVE : amount;
  return `€${eur.toFixed(2)}`;
}

/* ── MenuCartPicker ──────────────────────────────────
   Grelha de pratos/menus de degustação com stepper de quantidade + nota por
   item. Estado do carrinho (cart/itemNotes/setQty) vive sempre no chamador. ── */
export function MenuCartPicker({ units, lang, opCurrency, currency, cart, setQty, itemNotes, setItemNotes, dark = false }) {
  const today = String(new Date().getDay());
  const dishes   = units.filter(u => u.unit_type === 'menu_item' && u.status !== 'inactive');
  const tastings = units.filter(u => u.unit_type === 'tasting_menu' && u.status !== 'inactive');

  if (dishes.length === 0 && tastings.length === 0) return null;

  const byCategory = {};
  dishes.forEach(d => {
    const meta = parseMenuMeta(d);
    const cat = meta.category || 'outros';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push({ unit: d, meta });
  });
  const categoryOrder = Object.keys(MENU_CATEGORY_LABELS).filter(c => byCategory[c]?.length);

  const cardCls     = dark ? 'bg-white/10 border border-white/15' : 'bg-white border border-n-100';
  const titleCls    = dark ? 'text-white' : 'text-n-900';
  const descCls      = dark ? 'text-white/60' : 'text-n-500';
  const mutedCls      = dark ? 'text-white/40' : 'text-n-400';
  const headingCls  = dark ? 'text-white border-white/10' : 'text-n-900 border-n-100';
  const priceCls    = dark ? 'text-sand-400' : 'text-ocean-700';
  const stepperBtn  = dark
    ? 'border-white/30 text-white hover:border-sand-400 hover:text-sand-400'
    : 'border-n-300 text-n-500 hover:border-ocean-700 hover:text-ocean-700';
  const noteInputCls = dark
    ? 'bg-white/10 border-white/20 text-white placeholder-white/40 focus:border-sand-400'
    : 'border-n-200 focus:border-ocean-500';

  function Stepper({ unitId }) {
    const qty = cart[unitId] || 0;
    return (
      <div className="flex items-center gap-2 shrink-0">
        {qty > 0 && (
          <button type="button" onClick={() => setQty(unitId, -1)}
            className={`w-7 h-7 rounded-full border flex items-center justify-center transition-colors text-lg font-light leading-none ${stepperBtn}`}>−</button>
        )}
        {qty > 0 && <span className={`w-4 text-center font-display font-bold tabular-nums ${titleCls}`}>{qty}</span>}
        <button type="button" onClick={() => setQty(unitId, 1)}
          className={`w-7 h-7 rounded-full border flex items-center justify-center transition-colors text-lg font-light leading-none ${stepperBtn}`}>+</button>
      </div>
    );
  }

  return (
    <div>
      {categoryOrder.map(cat => (
        <div key={cat} className="mb-8 last:mb-0">
          <h3 className={`font-display font-bold text-base mb-3 pb-2 border-b ${headingCls}`}>
            {lang === 'en' ? MENU_CATEGORY_LABELS[cat].en : MENU_CATEGORY_LABELS[cat].pt}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {byCategory[cat].map(({ unit, meta }) => {
              const isToday = !!meta.daily_special?.[today];
              const name = lang === 'en' && meta.name_en ? meta.name_en : unit.name;
              const desc = lang === 'en' && meta.desc_en ? meta.desc_en : meta.desc_pt;
              return (
                <div key={unit.id} className={`flex gap-3 rounded-xl p-3 ${cardCls}`}>
                  {unit.images?.[0] && (
                    <img src={unit.images[0]} alt={name} className="w-16 h-16 rounded-lg object-cover shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`font-display font-semibold text-sm ${titleCls}`}>{name}</p>
                      <span className={`font-display font-bold text-sm shrink-0 ${priceCls}`}>
                        {fmtPrice(unit.base_price, 'person', opCurrency, currency, lang)}
                      </span>
                    </div>
                    {desc && <p className={`text-xs font-body mt-0.5 leading-relaxed ${descCls}`}>{desc}</p>}
                    {(meta.diets?.length > 0 || meta.allergens?.length > 0 || isToday) && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {isToday && (
                          <span className="text-[9px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded bg-ocean-50 text-ocean-700">
                            {lang === 'en' ? "Today's special" : 'Prato do dia'}
                          </span>
                        )}
                        {meta.diets?.map(d => (
                          <span key={d} className="text-[9px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded bg-[#ECFDF5] text-[#1A7A4A]">
                            {lang === 'en' ? MENU_DIET_LABELS[d]?.en || d : MENU_DIET_LABELS[d]?.pt || d}
                          </span>
                        ))}
                        {meta.allergens?.map(a => (
                          <span key={a} className="text-[9px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded bg-[#FEF2F2] text-error">
                            {lang === 'en' ? MENU_ALLERGEN_LABELS[a]?.en || a : MENU_ALLERGEN_LABELS[a]?.pt || a}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <Stepper unitId={unit.id} />
                    </div>
                    {cart[unit.id] > 0 && (
                      <input
                        type="text" value={itemNotes[unit.id] || ''}
                        onChange={e => setItemNotes(n => ({ ...n, [unit.id]: e.target.value }))}
                        placeholder={lang === 'en' ? 'Note (optional, e.g. no onion)' : 'Nota (opcional, ex: sem cebola)'}
                        className={`mt-2 w-full text-xs font-body border rounded-md px-2 py-1.5 focus:outline-none ${noteInputCls}`}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {tastings.length > 0 && (
        <div>
          <h3 className={`font-display font-bold text-base mb-3 pb-2 border-b ${headingCls}`}>
            {lang === 'en' ? 'Tasting Menus' : 'Menus de Degustação'}
          </h3>
          <div className="space-y-3">
            {tastings.map(t => {
              const meta = parseMenuMeta(t);
              const desc = lang === 'en' && meta.desc_en ? meta.desc_en : meta.desc_pt;
              const items = meta.items || [];
              return (
                <div key={t.id} className={`rounded-xl p-4 ${cardCls}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`font-display font-bold ${titleCls}`}>{t.name}</p>
                      {desc && <p className={`text-xs font-body mt-1 ${descCls}`}>{desc}</p>}
                      {items.length > 0 && (
                        <p className={`text-xs font-body mt-1.5 ${mutedCls}`}>{items.map(i => i.name_pt).join(' · ')}</p>
                      )}
                    </div>
                    <span className={`font-display font-bold shrink-0 ${priceCls}`}>
                      {fmtPrice(t.base_price, 'person', opCurrency, currency, lang)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <Stepper unitId={t.id} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── RestaurantReservationSection ────────────────────
   Widget de reserva completo: data/hora/pessoas/zona → cliente escolhe a
   mesa exacta a partir da lista real de mesas disponíveis → pré-pedido
   opcional (MenuCartPicker) → contactos → submissão única. Usado tanto na
   página do restaurante (sem prato pré-seleccionado) como na ficha própria
   de um prato (ServiceDetail.jsx, com `preselectedDishId` fixo). ── */
export function RestaurantReservationSection({ slug, lang, units, opCurrency, currency, preselectedDishId }) {
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate]           = useState('');
  const [time, setTime]           = useState('');
  const [party, setParty]         = useState(2);
  const [zone, setZone]           = useState('');
  const [checking, setChecking]   = useState(false);
  const [tables, setTables]       = useState(null); // null | array de mesas disponiveis
  const [selectedTableId, setSelectedTableId] = useState(null);
  const [cart, setCart]           = useState({});      // pre-pedido: { unitId: quantidade }
  const [itemNotes, setItemNotes] = useState({});
  const [contact, setContact]     = useState({ name: '', email: '', phone: '', country: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState('');
  const [resId, setResId]         = useState(null);
  const [preOrderFailed, setPreOrderFailed] = useState(false);

  // Deep-link/"Reservar" a partir de um prato -- pre-preenche o carrinho.
  useEffect(() => {
    if (preselectedDishId) {
      setCart(c => (c[preselectedDishId] ? c : { ...c, [preselectedDishId]: 1 }));
    }
  }, [preselectedDishId]);

  function resetAvailability() {
    setTables(null);
    setSelectedTableId(null);
    setError('');
  }

  function setQty(unitId, delta) {
    setCart(c => {
      const next = Math.max(0, Math.min(20, (c[unitId] || 0) + delta));
      const copy = { ...c };
      if (next === 0) delete copy[unitId]; else copy[unitId] = next;
      return copy;
    });
  }

  async function checkAvailability() {
    if (!date || !time || !party) return;
    setChecking(true);
    setError('');
    try {
      const params = new URLSearchParams({ date, time, party_size: String(party) });
      if (zone) params.set('zone', zone);
      const r = await fetch(`${API}/public/${slug}/restaurant-availability?${params}`);
      const j = await r.json();
      setTables(j.data?.tables || []);
    } catch {
      setError(lang === 'en' ? 'Could not check availability. Try again.' : 'Não foi possível verificar disponibilidade. Tente novamente.');
    } finally {
      setChecking(false);
    }
  }

  const hasMenu = units.some(u => (u.unit_type === 'menu_item' || u.unit_type === 'tasting_menu') && u.status !== 'inactive');
  const dishUnitById = Object.fromEntries(units.filter(u => u.unit_type === 'menu_item' || u.unit_type === 'tasting_menu').map(u => [u.id, u]));
  const cartEntries = Object.entries(cart).filter(([, q]) => q > 0);
  const preOrderTotal = cartEntries.reduce((s, [id, q]) => s + Number(dishUnitById[id]?.base_price || 0) * q, 0);

  async function submitReservation(e) {
    e.preventDefault();
    if (!contact.name || !contact.email) {
      setError(lang === 'en' ? 'Name and email required' : 'Nome e email obrigatórios');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const r = await fetch(`${API}/public/${slug}/reservations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unit_id: selectedTableId,
          customer_name: contact.name,
          customer_email: contact.email,
          customer_phone: contact.phone || null,
          customer_country: contact.country || null,
          check_in: date,
          reservation_time: time,
          party_size: party,
          zone_preference: zone || null,
          items: cartEntries.length
            ? cartEntries.map(([unit_id, quantity]) => ({ unit_id, quantity, notes: itemNotes[unit_id] || undefined }))
            : undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || (lang === 'en' ? 'Could not submit reservation' : 'Erro ao submeter reserva'));
      if (cartEntries.length && j.pre_order?.created === false) setPreOrderFailed(true);
      setResId(j.data?.id || 'ok');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section id="servicos" className="bg-ocean-900 text-white">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <p className="text-xs font-body font-bold text-sand-400 uppercase tracking-widest mb-2">
          {lang === 'en' ? 'Reservations' : 'Reservas'}
        </p>
        <h2 className="font-display font-bold text-2xl sm:text-3xl text-white mb-2">
          {lang === 'en' ? 'Book a table' : 'Reservar mesa'}
        </h2>
        <p className="text-sm font-body text-white/55 mb-8 max-w-lg">
          {lang === 'en'
            ? 'Choose date, time and party size, then pick your table.'
            : 'Escolha data, hora e número de pessoas, depois a sua mesa.'}
        </p>

        {resId ? (
          <div className="bg-white/10 border border-white/20 rounded-2xl p-6 flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-sand-500 flex items-center justify-center flex-shrink-0">
              <Check size={20} strokeWidth={2.5} className="text-ocean-900" />
            </div>
            <div>
              <p className="font-display font-bold text-white mb-1">
                {lang === 'en' ? 'Reservation submitted!' : 'Reserva submetida!'}
              </p>
              <p className="text-sm font-body text-white/70">
                {lang === 'en'
                  ? 'Awaiting confirmation from the restaurant. You will receive an email shortly.'
                  : 'A aguardar confirmação do restaurante. Vai receber um email em breve.'}
              </p>
              {preOrderFailed && (
                <p className="text-sm font-body text-red-300 mt-2">
                  {lang === 'en'
                    ? 'We could not register your pre-order — please add your dishes when you arrive.'
                    : 'Não foi possível registar o pré-pedido — adicione os pratos ao chegar.'}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-body font-semibold text-white/60 mb-2">
                  {lang === 'en' ? 'Date' : 'Data'}
                </label>
                <input
                  type="date" min={today} value={date}
                  onChange={e => { setDate(e.target.value); resetAvailability(); }}
                  className="w-full bg-white/10 border border-white/20 text-white rounded-xl px-4 py-3 font-body text-sm focus:outline-none focus:border-sand-400 focus:ring-1 focus:ring-sand-400 [color-scheme:dark]"
                />
              </div>
              <div>
                <label className="block text-xs font-body font-semibold text-white/60 mb-2">
                  {lang === 'en' ? 'Time' : 'Hora'}
                </label>
                <select
                  value={time}
                  onChange={e => { setTime(e.target.value); resetAvailability(); }}
                  className="w-full bg-white/10 border border-white/20 text-white rounded-xl px-4 py-3 font-body text-sm focus:outline-none focus:border-sand-400 focus:ring-1 focus:ring-sand-400 [color-scheme:dark]"
                >
                  <option value="" className="text-n-900">{lang === 'en' ? '-- Select --' : '-- Seleccionar --'}</option>
                  {REST_SLOTS.map(h => <option key={h} value={h} className="text-n-900">{h}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-body font-semibold text-white/60 mb-2">
                  {lang === 'en' ? 'Party size' : 'Número de pessoas'}
                </label>
                <div className="flex items-center gap-3 bg-white/10 border border-white/20 rounded-xl px-4 py-2">
                  <button type="button" onClick={() => { setParty(p => Math.max(1, p - 1)); resetAvailability(); }}
                    className="w-7 h-7 rounded-full border border-white/30 flex items-center justify-center text-white hover:border-sand-400 hover:text-sand-400 transition-colors text-lg font-light leading-none">−</button>
                  <span className="flex-1 text-center font-display font-bold text-white tabular-nums">{party}</span>
                  <button type="button" onClick={() => { setParty(p => Math.min(20, p + 1)); resetAvailability(); }}
                    className="w-7 h-7 rounded-full border border-white/30 flex items-center justify-center text-white hover:border-sand-400 hover:text-sand-400 transition-colors text-lg font-light leading-none">+</button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-body font-semibold text-white/60 mb-2">
                  {lang === 'en' ? 'Preferred area (optional)' : 'Zona preferida (opcional)'}
                </label>
                <select
                  value={zone}
                  onChange={e => { setZone(e.target.value); resetAvailability(); }}
                  className="w-full bg-white/10 border border-white/20 text-white rounded-xl px-4 py-3 font-body text-sm focus:outline-none focus:border-sand-400 focus:ring-1 focus:ring-sand-400 [color-scheme:dark]"
                >
                  <option value="" className="text-n-900">{lang === 'en' ? 'No preference' : 'Sem preferência'}</option>
                  {Object.entries(ZONE_LABELS).map(([key, l]) => (
                    <option key={key} value={key} className="text-n-900">{lang === 'en' ? l.en : l.pt}</option>
                  ))}
                </select>
              </div>
            </div>

            {tables === null && (
              <button
                onClick={checkAvailability}
                disabled={!date || !time || checking}
                className="flex items-center gap-2 bg-sand-500 text-ocean-900 font-body font-bold text-sm px-6 py-3 rounded-xl hover:bg-sand-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {checking
                  ? <span className="w-4 h-4 border-2 border-ocean-900/30 border-t-ocean-900 rounded-full animate-spin" />
                  : <Check size={16} strokeWidth={2} />}
                {lang === 'en' ? 'Check availability' : 'Verificar disponibilidade'}
              </button>
            )}

            {tables !== null && tables.length === 0 && (
              <div className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                <X size={16} strokeWidth={2} className="text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm font-body text-white/70">
                  {lang === 'en'
                    ? 'No tables available for this date/time/party size. Try a different time.'
                    : 'Sem mesas disponíveis para esta data/hora/número de pessoas. Tente outro horário.'}
                </p>
              </div>
            )}

            {tables !== null && tables.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-white/10">
                <p className="flex items-center gap-2 text-sm font-body font-semibold text-sand-400">
                  <Check size={14} strokeWidth={2.5} />
                  {lang === 'en' ? 'Choose your table' : 'Escolha a sua mesa'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {tables.map(t => {
                    const zoneLabel = t.zone ? (lang === 'en' ? ZONE_LABELS[t.zone]?.en : ZONE_LABELS[t.zone]?.pt) : null;
                    const selected = selectedTableId === t.id;
                    return (
                      <button
                        key={t.id} type="button"
                        onClick={() => setSelectedTableId(t.id)}
                        className={`text-left rounded-xl border p-3 transition-colors ${
                          selected ? 'bg-sand-500/10 border-sand-400' : 'bg-white/10 border-white/20 hover:border-white/40'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {t.images?.[0] && (
                            <img src={t.images[0]} alt={t.name} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="font-display font-semibold text-sm text-white truncate">{t.name}</p>
                            <p className="text-xs font-body text-white/60">
                              {zoneLabel ? `${zoneLabel} · ` : ''}
                              {t.capacity_min}-{t.capacity_max} {lang === 'en' ? 'people' : 'pessoas'}
                            </p>
                          </div>
                          {selected && <Check size={16} strokeWidth={2.5} className="text-sand-400 ml-auto shrink-0" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {selectedTableId && (
              <form onSubmit={submitReservation} className="space-y-4 pt-2 border-t border-white/10">
                {hasMenu && (
                  <div>
                    <p className="text-sm font-body font-semibold text-white mb-3">
                      {lang === 'en' ? 'Add dishes (optional)' : 'Adicionar pratos (opcional)'}
                    </p>
                    <MenuCartPicker
                      units={units} lang={lang} opCurrency={opCurrency} currency={currency}
                      cart={cart} setQty={setQty} itemNotes={itemNotes} setItemNotes={setItemNotes}
                      dark
                    />
                    {cartEntries.length > 0 && (
                      <div className="flex items-center justify-between text-sm font-body text-white/80 pt-3 mt-3 border-t border-white/10">
                        <span>{lang === 'en' ? 'Pre-order total' : 'Total do pré-pedido'}</span>
                        <span className="font-display font-bold text-white">{fmtMoney(preOrderTotal, opCurrency, currency)}</span>
                      </div>
                    )}
                  </div>
                )}

                <p className="flex items-center gap-2 text-sm font-body font-semibold text-sand-400 pt-2">
                  <Check size={14} strokeWidth={2.5} />
                  {lang === 'en' ? 'Your details' : 'Os seus dados'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input required placeholder={lang === 'en' ? 'Name' : 'Nome'} value={contact.name}
                    onChange={e => setContact(c => ({ ...c, name: e.target.value }))}
                    className="bg-white/10 border border-white/20 text-white placeholder-white/40 rounded-xl px-4 py-3 font-body text-sm focus:outline-none focus:border-sand-400 focus:ring-1 focus:ring-sand-400" />
                  <input required type="email" placeholder="Email" value={contact.email}
                    onChange={e => setContact(c => ({ ...c, email: e.target.value }))}
                    className="bg-white/10 border border-white/20 text-white placeholder-white/40 rounded-xl px-4 py-3 font-body text-sm focus:outline-none focus:border-sand-400 focus:ring-1 focus:ring-sand-400" />
                  <input placeholder={lang === 'en' ? 'Phone' : 'Telefone'} value={contact.phone}
                    onChange={e => setContact(c => ({ ...c, phone: e.target.value }))}
                    className="bg-white/10 border border-white/20 text-white placeholder-white/40 rounded-xl px-4 py-3 font-body text-sm focus:outline-none focus:border-sand-400 focus:ring-1 focus:ring-sand-400" />
                  <input placeholder={lang === 'en' ? 'Country (PT, DE...)' : 'País (PT, DE...)'} value={contact.country}
                    onChange={e => setContact(c => ({ ...c, country: e.target.value }))}
                    className="bg-white/10 border border-white/20 text-white placeholder-white/40 rounded-xl px-4 py-3 font-body text-sm focus:outline-none focus:border-sand-400 focus:ring-1 focus:ring-sand-400" />
                </div>
                <button type="submit" disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 bg-sand-500 text-ocean-900 font-body font-bold text-sm px-6 py-3 rounded-xl hover:bg-sand-400 transition-colors disabled:opacity-50">
                  {submitting
                    ? <span className="w-4 h-4 border-2 border-ocean-900/30 border-t-ocean-900 rounded-full animate-spin" />
                    : <ArrowRight size={16} strokeWidth={2} />}
                  {lang === 'en' ? 'Confirm reservation' : 'Confirmar reserva'}
                </button>
              </form>
            )}

            {error && (
              <p className="text-sm font-body text-red-300">{error}</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
