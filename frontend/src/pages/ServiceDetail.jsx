import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  MapPin, Phone, Star, ChevronLeft, ChevronRight, MessageCircle,
  Menu, X, Globe, Mail, Calendar, Users, Check, ArrowRight, Shield,
  ExternalLink, ChevronDown, ChevronUp, Copy, Send, Award, Share2,
  Heart, Compass, Car, Utensils, Clock, AlertCircle, RotateCcw,
  CreditCard, Lock, Building, Camera,
} from 'lucide-react';
import Logo from '../components/shared/Logo';

const API     = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';
const EUR_CVE = 110;

const FALLBACK_IMGS = [
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80',
  'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1200&q=80',
  'https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=1200&q=80',
  'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&q=75',
];

const TOUR_SLOTS = ['07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00'];
const REST_SLOTS = ['12:00','12:30','13:00','13:30','14:00','14:30','19:00','19:30','20:00','20:30','21:00','21:30','22:00','22:30'];
const CV_LOCS_PT = ['Aeroporto (SID)','Hotel / Alojamento','Escritório da empresa','Outro endereço'];
const CV_LOCS_EN = ['Airport (SID)','Hotel / Accommodation','Company office','Other address'];
const CAR_EXTRAS = [
  { k:'insurance',    pt:'Seguro adicional',  en:'Additional insurance' },
  { k:'gps',          pt:'GPS incluído',       en:'GPS navigation' },
  { k:'baby_seat',    pt:'Cadeira de bebé',    en:'Baby / child seat' },
  { k:'extra_driver', pt:'Condutor adicional', en:'Additional driver' },
];
const OCCASIONS = [
  { v:'',          pt:'Sem ocasião especial', en:'No special occasion' },
  { v:'birthday',  pt:'Aniversário',          en:'Birthday' },
  { v:'honeymoon', pt:'Lua-de-mel',           en:'Honeymoon' },
  { v:'business',  pt:'Reunião de negócios',  en:'Business meeting' },
  { v:'other',     pt:'Outra ocasião',        en:'Other occasion' },
];

/* ── helpers ─────────────────────────────────────── */
const TODAY = () => new Date().toISOString().split('T')[0];
function nts(a, b) { return a && b && b > a ? Math.round((new Date(b) - new Date(a)) / 864e5) : 0; }
function dys(a, b) { return a && b && b > a ? Math.max(1, Math.ceil((new Date(b) - new Date(a)) / 864e5)) : 0; }

function fmtPrice(price, priceUnit, opCurrency, viewCurrency, lang) {
  if (!price) return lang === 'en' ? 'On request' : 'Consultar';
  const labels = { night:lang==='en'?'/night':'/noite', day:lang==='en'?'/day':'/dia', hour:lang==='en'?'/hour':'/hora', session:lang==='en'?'/session':'/sessão', person:lang==='en'?'/person':'/pessoa' };
  const suffix = labels[priceUnit] || '';
  if (viewCurrency === 'CVE') {
    const cve = (opCurrency||'EUR') === 'CVE' ? price : price * EUR_CVE;
    return `${Math.round(cve).toLocaleString('pt-PT')} CVE${suffix}`;
  }
  const eur = (opCurrency||'EUR') === 'CVE' ? price / EUR_CVE : price;
  return `€${eur < 10 ? eur.toFixed(1) : Math.round(eur)}${suffix}`;
}

function fmtRaw(price, opCurrency, viewCurrency) {
  if (!price) return 0;
  if (viewCurrency === 'CVE') return Math.round((opCurrency||'EUR') === 'CVE' ? price : price * EUR_CVE);
  return Math.round((opCurrency||'EUR') === 'CVE' ? price / EUR_CVE : price);
}

/* ── StarRating ──────────────────────────────────── */
function StarRating({ rating, size = 13 }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} size={size} strokeWidth={1.75}
          className={i < Math.round(rating) ? 'text-sand-500 fill-sand-500' : 'text-n-200'} />
      ))}
    </div>
  );
}

/* ── Lightbox ─────────────────────────────────────── */
function Lightbox({ images, idx, onClose, onMove }) {
  useEffect(() => {
    const h = e => { if (e.key==='Escape') onClose(); if (e.key==='ArrowLeft') onMove(-1); if (e.key==='ArrowRight') onMove(1); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose, onMove]);
  return (
    <div className="fixed inset-0 z-[70] bg-black/95 flex items-center justify-center" onClick={onClose}>
      <button onClick={e=>{e.stopPropagation();onMove(-1);}} className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20"><ChevronLeft size={20} strokeWidth={2}/></button>
      <img src={images[idx]} alt="" className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg" onClick={e=>e.stopPropagation()}/>
      <button onClick={e=>{e.stopPropagation();onMove(1);}} className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20"><ChevronRight size={20} strokeWidth={2}/></button>
      <button onClick={onClose} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20"><X size={18} strokeWidth={2}/></button>
      <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-sm font-body">{idx+1} / {images.length}</span>
    </div>
  );
}

/* ── Modal shell ─────────────────────────────────── */
const IN  = 'w-full border border-n-300 rounded-xl px-4 py-2.5 font-body text-sm focus:outline-none focus:border-ocean-500 focus:ring-2 focus:ring-ocean-500/10 bg-white transition-all';
const LB  = 'block text-xs font-body font-semibold text-n-600 mb-1.5';
const SH  = 'font-display font-semibold text-n-900 text-sm mb-4';
const SEL = IN + ' appearance-none cursor-pointer';

function Cnt({ label, val, set, min=0, max=20 }) {
  return (
    <div>
      <label className={LB}>{label}</label>
      <div className="flex items-center gap-3">
        <button type="button" onClick={()=>set(Math.max(min,val-1))} className="w-9 h-9 rounded-full border border-n-300 flex items-center justify-center text-n-500 hover:border-ocean-700 hover:text-ocean-700 transition-all select-none text-xl font-light leading-none">−</button>
        <span className="flex-1 text-center font-display font-bold text-n-900 text-lg tabular-nums">{val}</span>
        <button type="button" onClick={()=>set(Math.min(max,val+1))} className="w-9 h-9 rounded-full border border-n-300 flex items-center justify-center text-n-500 hover:border-ocean-700 hover:text-ocean-700 transition-all select-none text-xl font-light leading-none">+</button>
      </div>
    </div>
  );
}

function GF({ d, set, lang, children }) {
  const u = k => e => set(p=>({...p,[k]:e.target.value}));
  return (
    <div className="space-y-3">
      <div><label className={LB}>{lang==='en'?'Full name':'Nome completo'} *</label><input className={IN} value={d.name||''} onChange={u('name')} required placeholder={lang==='en'?'John Smith':'João Silva'}/></div>
      <div><label className={LB}>Email *</label><input className={IN} type="email" value={d.email||''} onChange={u('email')} required placeholder="joao@email.com"/></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={LB}>{lang==='en'?'Phone / WhatsApp':'Telefone / WhatsApp'}</label><input className={IN} type="tel" value={d.phone||''} onChange={u('phone')} placeholder="+351 9XX XXX XXX"/></div>
        <div><label className={LB}>{lang==='en'?'Country':'País de origem'}</label><input className={IN} value={d.country||''} onChange={u('country')} placeholder="Portugal"/></div>
      </div>
      {children}
    </div>
  );
}

function ST({ lines }) {
  return (
    <div className="bg-ocean-50 border border-ocean-100 rounded-xl p-4 space-y-2.5">
      {lines.map((l,i)=>(
        <div key={i} className="flex items-start justify-between gap-3">
          <span className="text-xs font-body text-n-500 leading-relaxed flex-shrink-0">{l.label}</span>
          <span className={`text-xs font-body text-right ${l.hi?'text-ocean-700 text-sm font-bold':'text-n-800 font-semibold'}`}>{l.value}</span>
        </div>
      ))}
    </div>
  );
}

function PO({ lang, v, set }) {
  return (
    <div className="space-y-2.5">
      {[
        { k:'paypal', l:lang==='en'?'International card (PayPal)':'Cartão internacional (PayPal)', s:'Visa · Mastercard · American Express' },
        { k:'sisp',   l:lang==='en'?'Cape Verdean card (Vinti4)':'Cartão cabo-verdiano (Vinti4)',  s:'SISP Vinti4 · MasterCard local' },
        { k:'cash',   l:lang==='en'?'Pay on arrival':'Pagar presencialmente', s:lang==='en'?'Cash or card on site':'Dinheiro ou cartão no local' },
      ].map(o=>(
        <button key={o.k} type="button" onClick={()=>set(o.k)}
          className={`w-full text-left p-3.5 rounded-xl border-2 transition-all ${v===o.k?'border-ocean-700 bg-ocean-50':'border-n-200 hover:border-n-300'}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className={`text-sm font-body font-semibold ${v===o.k?'text-ocean-700':'text-n-800'}`}>{o.l}</p>
              <p className="text-xs font-body text-n-400 mt-0.5">{o.s}</p>
            </div>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${v===o.k?'border-ocean-700 bg-ocean-700':'border-n-300'}`}>
              {v===o.k&&<div className="w-2 h-2 bg-white rounded-full"/>}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

function BS({ resId, lang, type, onClose }) {
  const T = { hotel:{pt:'Quarto reservado!',en:'Room booked!'}, activity:{pt:'Tour reservado!',en:'Tour booked!'}, rentacar:{pt:'Viatura reservada!',en:'Vehicle reserved!'}, restaurant:{pt:'Mesa reservada!',en:'Table reserved!'} };
  const m = T[type]||T.activity;
  return (
    <div className="text-center py-8 px-4">
      <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
        <Check size={28} strokeWidth={2.5} className="text-green-600"/>
      </div>
      <h3 className="font-display font-bold text-xl text-n-900 mb-3">{lang==='en'?m.en:m.pt}</h3>
      <p className="text-sm font-body text-n-500 leading-relaxed mb-6 max-w-xs mx-auto">
        {lang==='en'?'You will receive a confirmation email shortly. The operator will confirm within 24h.':'Receberá um email de confirmação em breve. O operador confirmará a sua reserva em 24h.'}
      </p>
      {resId&&<div className="bg-n-50 border border-n-200 rounded-xl px-4 py-3 inline-block mb-6"><p className="text-xs text-n-400 font-body mb-1">{lang==='en'?'Booking reference':'Referência da reserva'}</p><p className="font-mono font-bold text-n-800 text-sm tracking-widest">{resId.slice(0,8).toUpperCase()}</p></div>}
      <button onClick={onClose} className="border-2 border-n-200 text-n-700 font-body font-semibold py-3 px-8 rounded-xl hover:border-ocean-700 hover:text-ocean-700 transition-all">{lang==='en'?'Close':'Fechar'}</button>
    </div>
  );
}

function MS({ icon, title, step, lang, onClose, children, onPrev, onNext, nextLabel, nextDis, sub, err, ok }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ocean-900/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-[480px] rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {!ok&&(
          <div className="flex-shrink-0 px-5 pt-5 pb-4 border-b border-n-100">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-ocean-50 flex items-center justify-center text-ocean-700 flex-shrink-0">{icon}</div>
                <div>
                  <p className="font-display font-bold text-n-900 text-sm leading-snug">{title}</p>
                  <p className="text-xs font-body text-n-400 mt-0.5">{lang==='en'?`Step ${step} of 3`:`Passo ${step} de 3`}</p>
                </div>
              </div>
              <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-n-400 hover:text-n-700 hover:bg-n-100 transition-all flex-shrink-0"><X size={16} strokeWidth={2.5}/></button>
            </div>
            <div className="flex gap-1.5">{[1,2,3].map(s=><div key={s} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${s<=step?'bg-ocean-700':'bg-n-200'}`}/>)}</div>
          </div>
        )}
        <div className="flex-1 overflow-y-auto">{children}</div>
        {!ok&&(
          <div className="flex-shrink-0 px-5 py-4 border-t border-n-100">
            {err&&<p className="text-xs text-red-600 font-body text-center mb-3 bg-red-50 rounded-lg px-3 py-2">{err}</p>}
            <div className="flex gap-3">
              {step>1&&<button type="button" onClick={onPrev} className="flex-1 border-2 border-n-200 text-n-700 font-body font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-1.5 hover:border-ocean-700 hover:text-ocean-700 transition-all"><ChevronLeft size={15} strokeWidth={2.5}/>{lang==='en'?'Back':'Anterior'}</button>}
              <button type="button" onClick={onNext} disabled={nextDis||sub}
                className={`font-body font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-ocean-700 text-white hover:bg-ocean-500 ${step===1?'w-full':'flex-[2]'}`}>
                {sub?<><div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"/>{lang==='en'?'Please wait...':'A aguardar...'}</>:<>{nextLabel}<ArrowRight size={15} strokeWidth={2.5}/></>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

async function postReservation(slug, payload) {
  const r = await fetch(`${API}/public/${slug}/reservations`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error||'Erro ao submeter reserva');
  return j.data?.id||'ok';
}

/* ── HotelModal ───────────────────────────────────── */
function HotelModal({ unit, op, slug, lang, onClose }) {
  const [step,ss]=useState(1); const [ci,sci]=useState(''); const [co,sco]=useState(''); const [adults,sa]=useState(2); const [kids,sk]=useState(0);
  const [info,si]=useState({name:'',email:'',phone:'',country:'',notes:''}); const [pay,sp]=useState('cash'); const [sub,ssub]=useState(false); const [resId,sr]=useState(null); const [err,se]=useState(''); const [avail,sav]=useState(null); const [chk,sc]=useState(false);
  const nights=nts(ci,co); const total=nights>0&&unit.base_price?fmtPrice(nights*unit.base_price,null,op.currency||'EUR','EUR',lang):null;
  useEffect(()=>{ if (!ci||!co||co<=ci){sav(null);return;} const t=setTimeout(async()=>{ sc(true); try{sav((await(await fetch(`${API}/public/${slug}/availability?unitId=${unit.id}&checkIn=${ci}&checkOut=${co}`)).json()).data);}catch{sav(null);}finally{sc(false);} },700); return()=>clearTimeout(t); },[ci,co]);
  function valid(){ if(step===1){if(!ci||!co){se(lang==='en'?'Select both dates':'Seleccione ambas as datas');return false;} if(co<=ci){se(lang==='en'?'Check-out must be after check-in':'Check-out deve ser posterior ao check-in');return false;} if(!avail?.disponivel){se(lang==='en'?'Room unavailable for these dates':'Quarto indisponível nestas datas');return false;}} if(step===2&&(!info.name||!info.email)){se(lang==='en'?'Name and email required':'Nome e email obrigatórios');return false;} se('');return true; }
  async function submit(){ ssub(true);se(''); try{ const notes=[`${adults} ${lang==='en'?'adults':'adultos'}, ${kids} ${lang==='en'?'children':'crianças'}`,info.notes].filter(Boolean).join('. '); sr(await postReservation(slug,{unit_id:unit.id,customer_name:info.name,customer_email:info.email,customer_phone:info.phone||null,customer_country:info.country||null,check_in:ci,check_out:co,guests:adults+kids,notes})); }catch(e){se(e.message);}finally{ssub(false);} }
  function next(){ if(!valid())return; step<3?ss(s=>s+1):submit(); }
  const sumL=[{label:lang==='en'?'Room':'Quarto',value:unit.name},{label:'Check-in',value:ci},{label:'Check-out',value:co},{label:lang==='en'?'Nights':'Noites',value:`${nights}`},{label:lang==='en'?'Guests':'Hóspedes',value:`${adults} ${lang==='en'?'adults':'adultos'}${kids>0?` + ${kids} ${lang==='en'?'children':'crianças'}`:''}`},...(total?[{label:'Total',value:total,hi:true}]:[])];
  const icon=<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M2 22V10a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12"/><path d="M2 22h20"/><path d="M7 22v-4h10v4"/><rect x="7" y="10" width="4" height="4" rx="1"/><rect x="13" y="10" width="4" height="4" rx="1"/></svg>;
  return (
    <MS icon={icon} title={lang==='en'?'Book room':'Reservar quarto'} step={step} lang={lang} onClose={onClose} onPrev={()=>ss(s=>s-1)} onNext={next} nextLabel={step<3?(lang==='en'?'Continue':'Continuar'):(lang==='en'?'Confirm booking':'Confirmar reserva')} nextDis={step===1&&(!avail?.disponivel||chk)} sub={sub} err={err} ok={!!resId}>
      {resId?<div className="p-5"><BS resId={resId} lang={lang} type="hotel" onClose={onClose}/></div>
      :step===1?<div className="p-5 space-y-4"><p className={SH}>{lang==='en'?'Select dates & guests':'Seleccione datas e hóspedes'}</p>
        <div className="grid grid-cols-2 gap-3"><div><label className={LB}>Check-in *</label><input type="date" className={IN} min={TODAY()} value={ci} onChange={e=>sci(e.target.value)}/></div><div><label className={LB}>Check-out *</label><input type="date" className={IN} min={ci||TODAY()} value={co} onChange={e=>sco(e.target.value)}/></div></div>
        {nights>0&&<div className="flex justify-between items-center bg-ocean-50 border border-ocean-100 rounded-xl px-4 py-2.5"><span className="text-sm font-body font-semibold text-ocean-700">{nights} {lang==='en'?(nights===1?'night':'nights'):(nights===1?'noite':'noites')}</span>{total&&<span className="font-display font-bold text-ocean-700 text-sm">{total}</span>}</div>}
        {(chk||avail)&&<div className={`rounded-xl px-4 py-3 flex items-center gap-2 text-sm font-body font-semibold ${chk?'bg-n-50 text-n-400':avail?.disponivel?'bg-green-50 text-green-700':'bg-red-50 text-red-700'}`}>{chk?<><div className="w-3.5 h-3.5 rounded-full border-2 border-ocean-300 border-t-ocean-700 animate-spin flex-shrink-0"/>{lang==='en'?'Checking...':'A verificar...'}</>:<>{avail?.disponivel?(lang==='en'?'Available':'Disponível'):(lang==='en'?'Not available':'Indisponível')}</>}</div>}
        <div className="grid grid-cols-2 gap-4"><Cnt label={lang==='en'?'Adults (1-10)':'Adultos (1-10)'} val={adults} set={sa} min={1} max={10}/><Cnt label={lang==='en'?'Children (0-5)':'Crianças (0-5)'} val={kids} set={sk} min={0} max={5}/></div>
      </div>
      :step===2?<div className="p-5"><p className={SH}>{lang==='en'?'Guest details':'Dados do hóspede'}</p><GF d={info} set={si} lang={lang}><div><label className={LB}>{lang==='en'?'Special requests':'Pedidos especiais'}</label><textarea className={IN+' resize-none'} rows={3} value={info.notes} onChange={e=>si(i=>({...i,notes:e.target.value}))} placeholder={lang==='en'?'Early check-in, quiet room...':'Early check-in, quarto silencioso...'}/></div></GF></div>
      :<div className="p-5 space-y-4"><p className={SH}>{lang==='en'?'Review & payment':'Resumo e pagamento'}</p><ST lines={sumL}/><p className="text-xs font-body font-semibold text-n-700">{lang==='en'?'Payment method':'Método de pagamento'}</p><PO lang={lang} v={pay} set={sp}/></div>}
    </MS>
  );
}

/* ── ActivityModal ────────────────────────────────── */
function ActivityModal({ unit, op, slug, lang, onClose }) {
  const [step,ss]=useState(1); const [date,sd]=useState(''); const [time,st]=useState(''); const [adults,sa]=useState(2); const [kids,sk]=useState(0);
  const [info,si]=useState({name:'',email:'',phone:'',country:'',needs:''}); const [pay,sp]=useState('cash'); const [sub,ssub]=useState(false); const [resId,sr]=useState(null); const [err,se]=useState('');
  const total=unit.base_price?fmtPrice((adults+kids)*unit.base_price,'person',op.currency||'EUR','EUR',lang):null;
  function valid(){ if(step===1){if(!date){se(lang==='en'?'Select a date':'Seleccione uma data');return false;} if(!time){se(lang==='en'?'Select a time slot':'Seleccione um horário');return false;} if(adults<1){se(lang==='en'?'At least 1 adult required':'Mínimo 1 adulto');return false;}} if(step===2&&(!info.name||!info.email)){se(lang==='en'?'Name and email required':'Nome e email obrigatórios');return false;} se('');return true; }
  async function submit(){ ssub(true);se(''); try{ const notes=[`${lang==='en'?'Time':'Hora'}: ${time}`,`${adults} ${lang==='en'?'adults':'adultos'}, ${kids} ${lang==='en'?'children':'crianças'}`,info.needs?(lang==='en'?'Needs:':'Necessidades:')+' '+info.needs:''].filter(Boolean).join('. '); sr(await postReservation(slug,{unit_id:unit.id,customer_name:info.name,customer_email:info.email,customer_phone:info.phone||null,customer_country:info.country||null,check_in:date,check_out:date,guests:adults+kids,notes})); }catch(e){se(e.message);}finally{ssub(false);} }
  function next(){ if(!valid())return; step<3?ss(s=>s+1):submit(); }
  const sumL=[{label:lang==='en'?'Tour / Activity':'Tour / Actividade',value:unit.name},{label:lang==='en'?'Date':'Data',value:date},{label:lang==='en'?'Time':'Horário',value:time},{label:lang==='en'?'Group':'Grupo',value:`${adults} ${lang==='en'?'adults':'adultos'}${kids>0?` + ${kids} ${lang==='en'?'children':'crianças'}`:''}`},...(total?[{label:'Total',value:total,hi:true}]:[])];
  return (
    <MS icon={<Compass size={18} strokeWidth={1.75}/>} title={lang==='en'?'Book tour':'Reservar tour'} step={step} lang={lang} onClose={onClose} onPrev={()=>ss(s=>s-1)} onNext={next} nextLabel={step<3?(lang==='en'?'Continue':'Continuar'):(lang==='en'?'Confirm booking':'Confirmar reserva')} nextDis={step===1&&(!date||!time)} sub={sub} err={err} ok={!!resId}>
      {resId?<div className="p-5"><BS resId={resId} lang={lang} type="activity" onClose={onClose}/></div>
      :step===1?<div className="p-5 space-y-4"><p className={SH}>{lang==='en'?'Select date, time & group':'Data, horário e grupo'}</p>
        <div className="grid grid-cols-2 gap-3"><div><label className={LB}>{lang==='en'?'Date':'Data'} *</label><input type="date" className={IN} min={TODAY()} value={date} onChange={e=>sd(e.target.value)}/></div><div><label className={LB}>{lang==='en'?'Time slot':'Horário'} *</label><select className={SEL} value={time} onChange={e=>st(e.target.value)}><option value="">{lang==='en'?'-- Select --':'-- Seleccionar --'}</option>{TOUR_SLOTS.map(h=><option key={h} value={h}>{h}</option>)}</select></div></div>
        {total&&(date||adults)&&<div className="flex justify-between items-center bg-ocean-50 border border-ocean-100 rounded-xl px-4 py-2.5"><span className="text-xs font-body text-ocean-600">{adults+kids} {lang==='en'?'people':'pessoas'}</span><span className="font-display font-bold text-ocean-700 text-sm">{total}</span></div>}
        <div className="grid grid-cols-2 gap-4"><Cnt label={lang==='en'?'Adults (1-20)':'Adultos (1-20)'} val={adults} set={sa} min={1} max={20}/><Cnt label={lang==='en'?'Children (0-10)':'Crianças (0-10)'} val={kids} set={sk} min={0} max={10}/></div>
      </div>
      :step===2?<div className="p-5"><p className={SH}>{lang==='en'?'Contact details':'Dados de contacto'}</p><GF d={info} set={si} lang={lang}><div><label className={LB}>{lang==='en'?'Special needs (optional)':'Necessidades especiais (opcional)'}</label><textarea className={IN+' resize-none'} rows={3} value={info.needs} onChange={e=>si(i=>({...i,needs:e.target.value}))} placeholder={lang==='en'?'Wheelchair, allergies...':'Cadeira de rodas, alergias...'}/></div></GF></div>
      :<div className="p-5 space-y-4"><p className={SH}>{lang==='en'?'Review & payment':'Resumo e pagamento'}</p><ST lines={sumL}/><p className="text-xs font-body font-semibold text-n-700">{lang==='en'?'Payment method':'Método de pagamento'}</p><PO lang={lang} v={pay} set={sp}/></div>}
    </MS>
  );
}

/* ── RentACarModal ────────────────────────────────── */
function RentACarModal({ unit, op, slug, lang, onClose }) {
  const [step,ss]=useState(1); const [pu,spu]=useState({date:'',time:'09:00',loc:''}); const [re,sre]=useState({date:'',time:'09:00',loc:''});
  const [drv,sd]=useState({name:'',email:'',phone:'',country:'',license:'',licCountry:'',age:''}); const [ext,sex]=useState({insurance:false,gps:false,baby_seat:false,extra_driver:false});
  const [pay,sp]=useState('cash'); const [sub,ssub]=useState(false); const [resId,sr]=useState(null); const [err,se]=useState('');
  const days=dys(pu.date,re.date); const total=days>0&&unit.base_price?fmtPrice(days*unit.base_price,'day',op.currency||'EUR','EUR',lang):null;
  const locs=lang==='en'?CV_LOCS_EN:CV_LOCS_PT; const extList=CAR_EXTRAS.filter(e=>ext[e.k]);
  function valid(){ if(step===1){if(!pu.date||!re.date){se(lang==='en'?'Select pickup and return dates':'Seleccione datas');return false;} if(re.date<=pu.date){se(lang==='en'?'Return after pickup':'Devolução após levantamento');return false;} if(!pu.loc){se(lang==='en'?'Select pickup location':'Seleccione o local');return false;}} if(step===2&&(!drv.name||!drv.email)){se(lang==='en'?'Name and email required':'Nome e email obrigatórios');return false;} if(step===2&&!drv.license){se(lang==='en'?'Driving licence required':'Carta de condução obrigatória');return false;} se('');return true; }
  async function submit(){ ssub(true);se(''); try{ const notes=[`${lang==='en'?'Pickup':'Levantamento'}: ${pu.loc} ${pu.date} ${pu.time}`,`${lang==='en'?'Return':'Devolução'}: ${re.loc||pu.loc} ${re.date} ${re.time}`,extList.length?`Extras: ${extList.map(e=>lang==='en'?e.en:e.pt).join(', ')}`:''  ].filter(Boolean).join('. '); sr(await postReservation(slug,{unit_id:unit.id,customer_name:drv.name,customer_email:drv.email,customer_phone:drv.phone||null,customer_country:drv.country||null,check_in:pu.date,check_out:re.date,guests:1,notes})); }catch(e){se(e.message);}finally{ssub(false);} }
  function next(){ if(!valid())return; step<3?ss(s=>s+1):submit(); }
  const sumL=[{label:lang==='en'?'Vehicle':'Viatura',value:unit.name},{label:lang==='en'?'Pickup':'Levantamento',value:`${pu.date} ${pu.time} · ${pu.loc}`},{label:lang==='en'?'Return':'Devolução',value:`${re.date} ${re.time} · ${re.loc||pu.loc}`},{label:lang==='en'?'Duration':'Duração',value:`${days} ${lang==='en'?(days===1?'day':'days'):(days===1?'dia':'dias')}`},...(extList.length?[{label:'Extras',value:extList.map(e=>lang==='en'?e.en:e.pt).join(' · ')}]:[]),...(total?[{label:'Total',value:total,hi:true}]:[])];
  return (
    <MS icon={<Car size={18} strokeWidth={1.75}/>} title={lang==='en'?'Book vehicle':'Reservar viatura'} step={step} lang={lang} onClose={onClose} onPrev={()=>ss(s=>s-1)} onNext={next} nextLabel={step<3?(lang==='en'?'Continue':'Continuar'):(lang==='en'?'Confirm booking':'Confirmar reserva')} nextDis={step===1&&(!pu.date||!re.date||!pu.loc)} sub={sub} err={err} ok={!!resId}>
      {resId?<div className="p-5"><BS resId={resId} lang={lang} type="rentacar" onClose={onClose}/></div>
      :step===1?<div className="p-5 space-y-4"><p className={SH}>{lang==='en'?'Pickup & return':'Levantamento e devolução'}</p>
        <div><p className="text-xs font-body font-bold text-ocean-700 uppercase tracking-widest mb-2">{lang==='en'?'Pickup':'Levantamento'}</p><div className="grid grid-cols-2 gap-3 mb-2"><div><label className={LB}>{lang==='en'?'Date':'Data'} *</label><input type="date" className={IN} min={TODAY()} value={pu.date} onChange={e=>spu(p=>({...p,date:e.target.value}))}/></div><div><label className={LB}>{lang==='en'?'Time':'Hora'}</label><input type="time" className={IN} value={pu.time} onChange={e=>spu(p=>({...p,time:e.target.value}))}/></div></div><select className={SEL} value={pu.loc} onChange={e=>spu(p=>({...p,loc:e.target.value}))}><option value="">{lang==='en'?'-- Select location --':'-- Seleccionar local --'}</option>{locs.map(l=><option key={l} value={l}>{l}</option>)}</select></div>
        <div><p className="text-xs font-body font-bold text-ocean-700 uppercase tracking-widest mb-2">{lang==='en'?'Return':'Devolução'}</p><div className="grid grid-cols-2 gap-3 mb-2"><div><label className={LB}>{lang==='en'?'Date':'Data'} *</label><input type="date" className={IN} min={pu.date||TODAY()} value={re.date} onChange={e=>sre(p=>({...p,date:e.target.value}))}/></div><div><label className={LB}>{lang==='en'?'Time':'Hora'}</label><input type="time" className={IN} value={re.time} onChange={e=>sre(p=>({...p,time:e.target.value}))}/></div></div><select className={SEL} value={re.loc} onChange={e=>sre(p=>({...p,loc:e.target.value}))}><option value="">{lang==='en'?'Same as pickup':'Mesmo local'}</option>{locs.map(l=><option key={l} value={l}>{l}</option>)}</select></div>
        {days>0&&<div className="flex justify-between items-center bg-ocean-50 border border-ocean-100 rounded-xl px-4 py-2.5"><span className="text-sm font-body font-semibold text-ocean-700">{days} {lang==='en'?(days===1?'day':'days'):(days===1?'dia':'dias')}</span>{total&&<span className="font-display font-bold text-ocean-700 text-sm">{total}</span>}</div>}
      </div>
      :step===2?<div className="p-5 space-y-4"><p className={SH}>{lang==='en'?'Driver details':'Dados do condutor'}</p><GF d={drv} set={sd} lang={lang}><div className="grid grid-cols-2 gap-3"><div><label className={LB}>{lang==='en'?'Licence no.':'Nº carta'} *</label><input className={IN} value={drv.license} onChange={e=>sd(d=>({...d,license:e.target.value}))} required placeholder="PT-123456"/></div><div><label className={LB}>{lang==='en'?'Issuing country':'País emissor'}</label><input className={IN} value={drv.licCountry} onChange={e=>sd(d=>({...d,licCountry:e.target.value}))} placeholder="Portugal"/></div></div><div><label className={LB}>{lang==='en'?'Driver age':'Idade do condutor'}</label><input className={IN} type="number" min={18} max={99} value={drv.age} onChange={e=>sd(d=>({...d,age:e.target.value}))} placeholder="28"/></div></GF>
        <div><p className="text-xs font-body font-bold text-n-700 mb-3">{lang==='en'?'Extras (optional)':'Extras (opcional)'}</p><div className="grid grid-cols-2 gap-2.5">{CAR_EXTRAS.map(e=><button key={e.k} type="button" onClick={()=>sex(x=>({...x,[e.k]:!x[e.k]}))} className={`p-3 rounded-xl border-2 text-left transition-all ${ext[e.k]?'border-ocean-700 bg-ocean-50':'border-n-200 hover:border-n-300'}`}><div className="flex items-center gap-2"><div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${ext[e.k]?'border-ocean-700 bg-ocean-700':'border-n-300'}`}>{ext[e.k]&&<Check size={10} strokeWidth={3} className="text-white"/>}</div><span className={`text-xs font-body font-semibold ${ext[e.k]?'text-ocean-700':'text-n-700'}`}>{lang==='en'?e.en:e.pt}</span></div></button>)}</div></div>
      </div>
      :<div className="p-5 space-y-4"><p className={SH}>{lang==='en'?'Review & payment':'Resumo e pagamento'}</p><ST lines={sumL}/><p className="text-xs font-body font-semibold text-n-700">{lang==='en'?'Payment method':'Método de pagamento'}</p><PO lang={lang} v={pay} set={sp}/></div>}
    </MS>
  );
}

/* ── RestaurantModal ──────────────────────────────── */
function RestaurantModal({ unit, op, slug, lang, onClose }) {
  const [step,ss]=useState(1); const [date,sd]=useState(''); const [time,st]=useState(''); const [party,spa]=useState(2); const [occasion,so]=useState('');
  const [info,si]=useState({name:'',email:'',phone:'',country:'',notes:''}); const [sub,ssub]=useState(false); const [resId,sr]=useState(null); const [err,se]=useState('');
  function valid(){ if(step===1){if(!date){se(lang==='en'?'Select a date':'Seleccione uma data');return false;} if(!time){se(lang==='en'?'Select a time':'Seleccione um horário');return false;}} if(step===2&&(!info.name||!info.email)){se(lang==='en'?'Name and email required':'Nome e email obrigatórios');return false;} se('');return true; }
  async function submit(){ ssub(true);se(''); try{ const occLabel=OCCASIONS.find(o=>o.v===occasion)?.[lang==='en'?'en':'pt']||''; const notes=[time?`${lang==='en'?'Time':'Hora'}: ${time}`:'',occLabel&&occasion?`${lang==='en'?'Occasion':'Ocasião'}: ${occLabel}`:'',info.notes].filter(Boolean).join('. '); sr(await postReservation(slug,{unit_id:unit.id,customer_name:info.name,customer_email:info.email,customer_phone:info.phone||null,customer_country:info.country||null,check_in:date,check_out:date,guests:party,notes})); }catch(e){se(e.message);}finally{ssub(false);} }
  function next(){ if(!valid())return; step<3?ss(s=>s+1):submit(); }
  const occLabel=OCCASIONS.find(o=>o.v===occasion)?.[lang==='en'?'en':'pt']||'';
  const sumL=[{label:lang==='en'?'Restaurant':'Restaurante',value:unit.name},{label:lang==='en'?'Date':'Data',value:date},{label:lang==='en'?'Time':'Hora',value:time},{label:lang==='en'?'Guests':'Pessoas',value:`${party}`},...(occasion?[{label:lang==='en'?'Occasion':'Ocasião',value:occLabel}]:[])];
  return (
    <MS icon={<Utensils size={18} strokeWidth={1.75}/>} title={lang==='en'?'Book table':'Reservar mesa'} step={step} lang={lang} onClose={onClose} onPrev={()=>ss(s=>s-1)} onNext={next} nextLabel={step<3?(lang==='en'?'Continue':'Continuar'):(lang==='en'?'Confirm reservation':'Confirmar reserva')} nextDis={step===1&&(!date||!time)} sub={sub} err={err} ok={!!resId}>
      {resId?<div className="p-5"><BS resId={resId} lang={lang} type="restaurant" onClose={onClose}/></div>
      :step===1?<div className="p-5 space-y-4"><p className={SH}>{lang==='en'?'Date, time & party size':'Data, hora e número de pessoas'}</p>
        <div className="grid grid-cols-2 gap-3"><div><label className={LB}>{lang==='en'?'Date':'Data'} *</label><input type="date" className={IN} min={TODAY()} value={date} onChange={e=>sd(e.target.value)}/></div><div><label className={LB}>{lang==='en'?'Time':'Hora'} *</label><select className={SEL} value={time} onChange={e=>st(e.target.value)}><option value="">{lang==='en'?'-- Select --':'-- Seleccionar --'}</option>{REST_SLOTS.map(h=><option key={h} value={h}>{h}</option>)}</select></div></div>
        <Cnt label={lang==='en'?'Number of guests (1-20)':'Número de pessoas (1-20)'} val={party} set={spa} min={1} max={20}/>
        <div><label className={LB}>{lang==='en'?'Special occasion':'Ocasião especial'}</label><select className={SEL} value={occasion} onChange={e=>so(e.target.value)}>{OCCASIONS.map(o=><option key={o.v} value={o.v}>{lang==='en'?o.en:o.pt}</option>)}</select></div>
      </div>
      :step===2?<div className="p-5"><p className={SH}>{lang==='en'?'Contact details':'Dados de contacto'}</p><GF d={info} set={si} lang={lang}><div><label className={LB}>{lang==='en'?'Special requests':'Pedidos especiais'}</label><textarea className={IN+' resize-none'} rows={3} value={info.notes} onChange={e=>si(i=>({...i,notes:e.target.value}))} placeholder={lang==='en'?'Allergies, vegetarian, birthday cake...':'Alergias, vegetariano, bolo de aniversário...'}/></div></GF></div>
      :<div className="p-5 space-y-4"><p className={SH}>{lang==='en'?'Confirm reservation':'Confirmar reserva'}</p><ST lines={sumL}/><div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm font-body text-n-700 leading-relaxed"><span className="font-semibold text-amber-700">{lang==='en'?'No advance payment required.':'Sem pagamento antecipado.'}</span>{' '}{lang==='en'?'Payment on arrival.':'Pagamento à chegada.'}</div></div>}
    </MS>
  );
}

function BookingModal({ unit, op, slug, lang, onClose }) {
  if (!unit||!op) return null;
  const t=op.operator_type;
  const props={unit,op,slug,lang,onClose};
  if (t==='hotel') return <HotelModal {...props}/>;
  if (t==='activity') return <ActivityModal {...props}/>;
  if (t==='rentacar') return <RentACarModal {...props}/>;
  if (t==='restaurant') return <RestaurantModal {...props}/>;
  return <ActivityModal {...props}/>;
}

/* ── HeroGallery ─────────────────────────────────── */
function HeroGallery({ images, unitName, onOpen }) {
  const imgs = images?.filter(Boolean).length ? images.filter(Boolean) : FALLBACK_IMGS;
  const main = imgs[0];
  const thumbs = imgs.slice(1, 5);

  return (
    <div className="relative">
      <div className="grid grid-cols-4 grid-rows-2 gap-2 h-[55vh] min-h-[360px] max-h-[560px]">
        {/* Main photo */}
        <div className="col-span-4 md:col-span-2 row-span-2 relative overflow-hidden rounded-none md:rounded-l-2xl cursor-pointer group"
          onClick={() => onOpen(0)}>
          <img src={main} alt={unitName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/>
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"/>
        </div>
        {/* Grid thumbs */}
        {[0,1,2,3].map(i => (
          thumbs[i] ? (
            <div key={i} className={`hidden md:block relative overflow-hidden cursor-pointer group ${i===1?'rounded-tr-2xl':''} ${i===3?'rounded-br-2xl':''}`}
              onClick={() => onOpen(i+1)}>
              <img src={thumbs[i]} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/>
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors"/>
              {i===3 && imgs.length > 5 && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <div className="text-white text-center">
                    <Camera size={22} strokeWidth={1.75} className="mx-auto mb-1"/>
                    <p className="font-display font-bold text-sm">+{imgs.length - 5} fotos</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div key={i} className="hidden md:block bg-n-100"/>
          )
        ))}
      </div>
      {/* Ver todas button */}
      <button onClick={() => onOpen(0)}
        className="absolute bottom-4 right-4 flex items-center gap-1.5 bg-white text-n-800 text-xs font-body font-semibold px-3 py-2 rounded-lg shadow-md hover:shadow-lg transition-all border border-n-200">
        <Camera size={14} strokeWidth={1.75}/>
        {imgs.length > 1 ? `Ver todas ${imgs.length} fotos` : 'Ver foto'}
      </button>
    </div>
  );
}

/* ── SimilarServices ─────────────────────────────── */
function SimilarServices({ units, slug, lang, currency, opCurrency }) {
  const navigate = useNavigate();
  if (!units?.length) return null;
  return (
    <section className="py-10 border-t border-n-100">
      <h3 className="font-display font-bold text-xl text-n-900 mb-5">
        {lang === 'en' ? 'More services' : 'Outros serviços'}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {units.map(u => (
          <div key={u.id} onClick={() => navigate(`/book/${slug}/servico/${u.id}`)}
            className="bg-white border border-n-200 rounded-xl overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer">
            <div className="h-36 bg-cover bg-center"
              style={{ backgroundImage: u.images?.[0] ? `url(${u.images[0]})` : `url(${FALLBACK_IMGS[0]})` }}/>
            <div className="p-3">
              <p className="font-display font-bold text-n-900 text-sm mb-1 line-clamp-1">{u.name}</p>
              {u.base_price && (
                <p className="font-display font-bold text-ocean-700 text-sm">
                  {fmtPrice(u.base_price, u.price_unit, opCurrency, currency, lang)}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Skeleton ─────────────────────────────────────── */
function SkeletonPage() {
  return (
    <div className="min-h-screen bg-n-50 animate-pulse">
      <div className="h-14 bg-white border-b border-n-200"/>
      <div className="h-[55vh] bg-n-200"/>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="h-8 bg-n-200 rounded w-64"/>
            <div className="h-4 bg-n-100 rounded w-full"/>
            <div className="h-4 bg-n-100 rounded w-3/4"/>
          </div>
          <div className="h-80 bg-n-200 rounded-2xl"/>
        </div>
      </div>
    </div>
  );
}

/* ── NotFound ─────────────────────────────────────── */
function NotFoundPage({ slug, lang }) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-n-50 p-6 text-center">
      <Logo size="lg"/>
      <div className="mt-8 max-w-sm">
        <h2 className="font-display font-bold text-xl text-n-900 mb-3">
          {lang === 'en' ? 'Service not found' : 'Serviço não encontrado'}
        </h2>
        <p className="text-sm font-body text-n-500 leading-relaxed mb-6">
          {lang === 'en' ? 'This service does not exist or is no longer available.' : 'Este serviço não existe ou já não está disponível.'}
        </p>
        <button onClick={() => navigate(slug ? `/book/${slug}` : '/')}
          className="inline-flex items-center gap-2 bg-ocean-700 text-white font-body font-semibold px-6 py-3 rounded-xl hover:bg-ocean-500 transition-colors text-sm">
          <ChevronLeft size={16} strokeWidth={2}/>
          {lang === 'en' ? 'Back to operator' : 'Voltar ao operador'}
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════ */
export default function ServiceDetail() {
  const { slug, id } = useParams();
  const navigate     = useNavigate();

  const [op, setOp]           = useState(null);
  const [unit, setUnit]       = useState(null);
  const [related, setRelated] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [recentBookings, setRecentBookings] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [lang, setLang]       = useState(() => localStorage.getItem('sd-lang') || 'pt');
  const [currency, setCur]    = useState('EUR');
  const [bookOpen, setBookOpen] = useState(false);
  const [lbIdx, setLbIdx]     = useState(null);
  const [navScrolled, setNavScrolled] = useState(false);
  const [mobileMenu, setMobileMenu]   = useState(false);
  const [wishlisted, setWishlisted]   = useState(false);
  const [copied, setCopied]           = useState(false);

  /* ── Load data ── */
  useEffect(() => {
    Promise.all([
      fetch(`${API}/public/${slug}/units/${id}`).then(r => r.json()),
      fetch(`${API}/public/${slug}/units/${id}/reviews`).then(r => r.json()).catch(() => ({ data: [] })),
    ]).then(([unitData, revData]) => {
      if (unitData.data?.unit) {
        setOp(unitData.data.operator);
        setUnit(unitData.data.unit);
        setRelated(unitData.data.related || []);
        setRecentBookings(unitData.data.recent_bookings || 0);
        setReviews(revData.data || []);
        document.title = `${unitData.data.unit.name} — ${unitData.data.operator.name} · SalDesk`;
      } else {
        setNotFound(true);
      }
    }).catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug, id]);

  /* ── Sticky nav ── */
  useEffect(() => {
    const h = () => setNavScrolled(window.scrollY > 60);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  function toggleLang() {
    const nl = lang === 'pt' ? 'en' : 'pt';
    setLang(nl); localStorage.setItem('sd-lang', nl);
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2500);
    });
  }

  if (loading)  return <SkeletonPage/>;
  if (notFound) return <NotFoundPage slug={slug} lang={lang}/>;

  /* ── Derived values ── */
  const imgs = unit.images?.filter(Boolean).length ? unit.images.filter(Boolean) : FALLBACK_IMGS;
  const avgRating = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const ratingBreakdown = [5,4,3,2,1].map(r => ({
    r, count: reviews.filter(rv => Math.round(rv.rating) === r).length,
    pct: reviews.length ? reviews.filter(rv => Math.round(rv.rating) === r).length / reviews.length * 100 : 0,
  }));

  const unitType  = unit.unit_type || op.operator_type;
  const isActivity  = ['activity'].includes(unitType);
  const isHotel     = ['hotel','room'].includes(unitType);
  const isRentaCar  = ['rentacar','vehicle'].includes(unitType);
  const isRestaurant = ['restaurant','table'].includes(unitType);

  const typeBadge = {
    activity:   { pt:'Actividade',  en:'Activity',      icon:<Compass size={12} strokeWidth={1.75}/> },
    hotel:      { pt:'Alojamento',  en:'Accommodation', icon:<Building size={12} strokeWidth={1.75}/> },
    room:       { pt:'Alojamento',  en:'Accommodation', icon:<Building size={12} strokeWidth={1.75}/> },
    rentacar:   { pt:'Viatura',     en:'Vehicle',       icon:<Car size={12} strokeWidth={1.75}/> },
    vehicle:    { pt:'Viatura',     en:'Vehicle',       icon:<Car size={12} strokeWidth={1.75}/> },
    restaurant: { pt:'Restaurante', en:'Restaurant',    icon:<Utensils size={12} strokeWidth={1.75}/> },
    table:      { pt:'Mesa',        en:'Table',         icon:<Utensils size={12} strokeWidth={1.75}/> },
  }[unitType] || { pt:'Serviço', en:'Service', icon:<Compass size={12} strokeWidth={1.75}/> };

  const priceSuffix = {
    night:   lang==='en'?'/noite':'/noite',
    day:     lang==='en'?'/day':'/dia',
    hour:    lang==='en'?'/hour':'/hora',
    session: lang==='en'?'/session':'/sessão',
    person:  lang==='en'?'/person':'/pessoa',
  }[unit.price_unit] || '';

  const displayPrice = unit.base_price ? fmtPrice(unit.base_price, unit.price_unit, op.currency||'EUR', currency, lang) : null;
  const rawPrice     = fmtRaw(unit.base_price, op.currency||'EUR', currency);
  const currSymbol   = currency === 'CVE' ? 'CVE' : '€';

  const whatsappUrl = op.whatsapp
    ? `https://wa.me/${op.whatsapp.replace(/\D/g,'')}?text=${encodeURIComponent(lang==='en'?`Hello, I'm interested in "${unit.name}" on SalDesk.`:`Olá, tenho interesse no serviço "${unit.name}" no SalDesk.`)}`
    : null;

  const urgencyCount = recentBookings > 0 ? recentBookings : 3 + Math.floor(Math.random() * 12);
  const spotsLeft = unit.capacity ? Math.max(0, unit.capacity - (recentBookings % (unit.capacity||10))) : null;

  /* ── RENDER ── */
  return (
    <div className="min-h-screen bg-white">

      {/* ── Navbar ── */}
      <nav className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${navScrolled ? 'bg-white shadow-md' : 'bg-white/95 backdrop-blur-sm border-b border-n-100'}`}>
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-xs font-body text-n-400 min-w-0">
            <button onClick={() => navigate('/discover')} className="text-ocean-600 hover:text-ocean-700 font-semibold flex-shrink-0 hidden sm:block">
              SalDesk Connect
            </button>
            <ChevronRight size={12} strokeWidth={2} className="text-n-300 flex-shrink-0 hidden sm:block"/>
            <button onClick={() => navigate(`/book/${slug}`)} className="text-ocean-600 hover:text-ocean-700 font-semibold truncate max-w-[120px]">
              {op.name}
            </button>
            <ChevronRight size={12} strokeWidth={2} className="text-n-300 flex-shrink-0"/>
            <span className="text-n-500 truncate max-w-[120px]">{unit.name}</span>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={toggleLang}
              className="hidden sm:flex items-center gap-1 text-xs font-body font-bold border border-n-200 text-n-600 rounded-full px-3 py-1.5 hover:border-ocean-700 hover:text-ocean-700 transition-all">
              <Globe size={12} strokeWidth={1.75}/>
              {lang === 'pt' ? 'EN' : 'PT'}
            </button>
            <button onClick={() => setBookOpen(true)}
              className="flex items-center gap-1.5 bg-ocean-700 text-white text-sm font-body font-semibold px-4 py-2 rounded-full hover:bg-ocean-500 transition-colors">
              <Calendar size={14} strokeWidth={1.75}/>
              {lang === 'en' ? 'Book Now' : 'Reservar'}
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero Gallery ── */}
      <div className="pt-14">
        <HeroGallery images={imgs} unitName={unit.name} onOpen={i => setLbIdx(i)}/>
      </div>

      {/* ── Main layout ── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">

          {/* ══ LEFT COLUMN ══ */}
          <div className="lg:col-span-2 space-y-10">

            {/* ── Header ── */}
            <div>
              {/* Type badge + actions */}
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex flex-wrap gap-2">
                  <span className="flex items-center gap-1.5 bg-ocean-50 text-ocean-700 text-xs font-body font-bold px-3 py-1 rounded-full border border-ocean-100">
                    {typeBadge.icon}
                    {lang === 'en' ? typeBadge.en : typeBadge.pt}
                  </span>
                  {unit.capacity && (
                    <span className="flex items-center gap-1 bg-n-50 text-n-600 text-xs font-body font-semibold px-3 py-1 rounded-full border border-n-200">
                      <Users size={11} strokeWidth={1.75}/>
                      {lang==='en'?`Up to ${unit.capacity}`:` Até ${unit.capacity} pessoas`}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => setWishlisted(w => !w)}
                    className={`w-9 h-9 rounded-full border flex items-center justify-center transition-all ${wishlisted?'bg-red-50 border-red-200 text-red-500':'border-n-200 text-n-400 hover:border-n-300'}`}>
                    <Heart size={16} strokeWidth={1.75} className={wishlisted?'fill-red-500':''}/>
                  </button>
                  <button onClick={copyLink}
                    className="w-9 h-9 rounded-full border border-n-200 text-n-400 flex items-center justify-center hover:border-n-300 transition-all">
                    {copied ? <Check size={16} strokeWidth={2} className="text-green-600"/> : <Share2 size={16} strokeWidth={1.75}/>}
                  </button>
                </div>
              </div>

              {/* Name */}
              <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-n-900 tracking-tight mb-3 leading-tight">
                {unit.name}
              </h1>

              {/* Rating + location */}
              <div className="flex flex-wrap items-center gap-4 mb-4">
                {avgRating > 0 ? (
                  <div className="flex items-center gap-2">
                    <StarRating rating={avgRating} size={15}/>
                    <span className="font-display font-bold text-n-800 text-sm">{avgRating.toFixed(1)}</span>
                    <span className="text-n-400 text-sm font-body">({reviews.length} {lang==='en'?'reviews':'avaliações'})</span>
                  </div>
                ) : (
                  <span className="text-xs font-body font-semibold text-n-400 bg-n-50 px-3 py-1 rounded-full border border-n-200">{lang==='en'?'New':'Novo'}</span>
                )}
                {op.address && (
                  <div className="flex items-center gap-1.5 text-n-500 text-sm font-body">
                    <MapPin size={14} strokeWidth={1.75} className="text-ocean-500"/>
                    {op.address}
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-n-500 text-sm font-body">
                  <Globe size={14} strokeWidth={1.75} className="text-ocean-500"/>
                  PT · EN
                </div>
              </div>

              {/* Quick badges */}
              <div className="flex flex-wrap gap-2">
                {unit.price_unit && (
                  <span className="flex items-center gap-1.5 bg-n-50 border border-n-200 text-n-600 text-xs font-body font-semibold px-3 py-1.5 rounded-full">
                    <Clock size={12} strokeWidth={1.75}/>
                    {isHotel && (lang==='en'?'Per night':'Por noite')}
                    {isActivity && (lang==='en'?'Per person':'Por pessoa')}
                    {isRentaCar && (lang==='en'?'Per day':'Por dia')}
                    {isRestaurant && (lang==='en'?'Per person':'Por pessoa')}
                  </span>
                )}
                {unit.capacity && (
                  <span className="flex items-center gap-1.5 bg-n-50 border border-n-200 text-n-600 text-xs font-body font-semibold px-3 py-1.5 rounded-full">
                    <Users size={12} strokeWidth={1.75}/>
                    {lang==='en'?`Capacity: ${unit.capacity}`:`Capacidade: ${unit.capacity}`}
                  </span>
                )}
                {op.operator_type === 'activity' && (
                  <span className="flex items-center gap-1.5 bg-ocean-50 border border-ocean-100 text-ocean-700 text-xs font-body font-semibold px-3 py-1.5 rounded-full">
                    <Shield size={12} strokeWidth={1.75}/>
                    {lang==='en'?'Safe & Certified':'Certificado'}
                  </span>
                )}
              </div>
            </div>

            {/* ── Sobre este serviço ── */}
            {unit.description && (
              <div className="pb-10 border-b border-n-100">
                <p className="text-xs font-body font-bold text-ocean-700 uppercase tracking-widest mb-3">
                  {lang==='en'?'About this service':'Sobre este serviço'}
                </p>
                <p className="font-body text-n-600 leading-relaxed text-base">{unit.description}</p>

                {/* Highlights grid — type-specific */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
                  {isActivity && [
                    { icon:<Compass size={20} strokeWidth={1.75}/>, pt:'Guia especializado', en:'Specialist guide' },
                    { icon:<Users size={20} strokeWidth={1.75}/>, pt:'Grupos pequenos', en:'Small groups' },
                    { icon:<Shield size={20} strokeWidth={1.75}/>, pt:'Equipamento incluído', en:'Equipment included' },
                  ].map((h,i) => (
                    <div key={i} className="flex items-start gap-3 p-4 bg-ocean-50 rounded-xl border border-ocean-100">
                      <div className="w-9 h-9 bg-ocean-100 rounded-lg flex items-center justify-center text-ocean-700 flex-shrink-0">{h.icon}</div>
                      <p className="font-body font-semibold text-n-800 text-sm leading-snug mt-1">{lang==='en'?h.en:h.pt}</p>
                    </div>
                  ))}
                  {isHotel && [
                    { icon:<Shield size={20} strokeWidth={1.75}/>, pt:'Limpeza diária', en:'Daily cleaning' },
                    { icon:<Globe size={20} strokeWidth={1.75}/>, pt:'Wi-Fi incluído', en:'Wi-Fi included' },
                    { icon:<Check size={20} strokeWidth={1.75}/>, pt:'Check-in flexível', en:'Flexible check-in' },
                  ].map((h,i) => (
                    <div key={i} className="flex items-start gap-3 p-4 bg-ocean-50 rounded-xl border border-ocean-100">
                      <div className="w-9 h-9 bg-ocean-100 rounded-lg flex items-center justify-center text-ocean-700 flex-shrink-0">{h.icon}</div>
                      <p className="font-body font-semibold text-n-800 text-sm leading-snug mt-1">{lang==='en'?h.en:h.pt}</p>
                    </div>
                  ))}
                  {isRentaCar && [
                    { icon:<Shield size={20} strokeWidth={1.75}/>, pt:'Seguro incluído', en:'Insurance included' },
                    { icon:<MapPin size={20} strokeWidth={1.75}/>, pt:'Entrega em qualquer local', en:'Delivery anywhere' },
                    { icon:<Clock size={20} strokeWidth={1.75}/>, pt:'Disponível 24h', en:'Available 24h' },
                  ].map((h,i) => (
                    <div key={i} className="flex items-start gap-3 p-4 bg-ocean-50 rounded-xl border border-ocean-100">
                      <div className="w-9 h-9 bg-ocean-100 rounded-lg flex items-center justify-center text-ocean-700 flex-shrink-0">{h.icon}</div>
                      <p className="font-body font-semibold text-n-800 text-sm leading-snug mt-1">{lang==='en'?h.en:h.pt}</p>
                    </div>
                  ))}
                  {isRestaurant && [
                    { icon:<Utensils size={20} strokeWidth={1.75}/>, pt:'Cozinha local', en:'Local cuisine' },
                    { icon:<Users size={20} strokeWidth={1.75}/>, pt:'Grupos e eventos', en:'Groups & events' },
                    { icon:<Shield size={20} strokeWidth={1.75}/>, pt:'Reserva confirmada', en:'Confirmed booking' },
                  ].map((h,i) => (
                    <div key={i} className="flex items-start gap-3 p-4 bg-ocean-50 rounded-xl border border-ocean-100">
                      <div className="w-9 h-9 bg-ocean-100 rounded-lg flex items-center justify-center text-ocean-700 flex-shrink-0">{h.icon}</div>
                      <p className="font-body font-semibold text-n-800 text-sm leading-snug mt-1">{lang==='en'?h.en:h.pt}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── O que está incluído ── */}
            <div className="pb-10 border-b border-n-100">
              <p className="text-xs font-body font-bold text-ocean-700 uppercase tracking-widest mb-4">
                {lang==='en'?'What\'s included':'O que está incluído'}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(isActivity ? [
                  { pt:'Guia certificado', en:'Certified guide', ok:true },
                  { pt:'Equipamento de segurança', en:'Safety equipment', ok:true },
                  { pt:'Fotografias do tour', en:'Tour photographs', ok:true },
                  { pt:'Refeições', en:'Meals', ok:false },
                  { pt:'Transporte de/para hotel', en:'Hotel transfers', ok:false },
                ] : isHotel ? [
                  { pt:'Wi-Fi gratuito', en:'Free Wi-Fi', ok:true },
                  { pt:'Pequeno-almoço', en:'Breakfast', ok:false },
                  { pt:'Parque de estacionamento', en:'Parking', ok:true },
                  { pt:'Serviço de limpeza diária', en:'Daily housekeeping', ok:true },
                  { pt:'Transfer aeroporto', en:'Airport transfer', ok:false },
                ] : isRentaCar ? [
                  { pt:'Seguro básico', en:'Basic insurance', ok:true },
                  { pt:'Quilometragem ilimitada', en:'Unlimited mileage', ok:true },
                  { pt:'Segunda condutora', en:'Second driver', ok:false },
                  { pt:'GPS', en:'GPS', ok:false },
                  { pt:'Cadeira de criança', en:'Child seat', ok:false },
                ] : [
                  { pt:'Água e pão', en:'Water and bread', ok:true },
                  { pt:'Serviço de mesa', en:'Table service', ok:true },
                  { pt:'Bebidas alcoólicas', en:'Alcoholic drinks', ok:false },
                  { pt:'Sobremesas', en:'Desserts', ok:false },
                ]).map((item, i) => (
                  <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border ${item.ok?'bg-green-50 border-green-100':'bg-n-50 border-n-200'}`}>
                    {item.ok
                      ? <Check size={16} strokeWidth={2} className="text-green-600 flex-shrink-0"/>
                      : <X size={16} strokeWidth={2} className="text-n-400 flex-shrink-0"/>}
                    <span className={`text-sm font-body font-medium ${item.ok?'text-green-800':'text-n-500'}`}>
                      {lang==='en'?item.en:item.pt}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl p-3">
                <AlertCircle size={16} strokeWidth={1.75} className="text-amber-600 flex-shrink-0 mt-0.5"/>
                <p className="text-xs font-body text-amber-800">
                  {lang==='en'
                    ? 'Please bring comfortable clothing and sunscreen. Closed-toe shoes recommended.'
                    : 'Por favor traga roupa confortável e protector solar. Sapatos fechados recomendados.'}
                </p>
              </div>
            </div>

            {/* ── Avaliações ── */}
            {reviews.length > 0 && (
              <div className="pb-10 border-b border-n-100">
                <p className="text-xs font-body font-bold text-ocean-700 uppercase tracking-widest mb-4">
                  {lang==='en'?'Customer reviews':'Avaliações dos clientes'}
                </p>
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
                  {/* Rating summary */}
                  <div className="lg:col-span-2 bg-n-50 rounded-2xl p-5 border border-n-200 flex flex-col items-center justify-center">
                    <p className="font-display font-extrabold text-5xl text-n-900 mb-1">{avgRating.toFixed(1)}</p>
                    <StarRating rating={avgRating} size={18}/>
                    <p className="text-sm font-body text-n-400 mt-2">{reviews.length} {lang==='en'?'reviews':'avaliações'}</p>
                    <div className="w-full mt-4 space-y-2">
                      {ratingBreakdown.map(({ r, count, pct }) => (
                        <div key={r} className="flex items-center gap-2">
                          <span className="text-xs font-body font-semibold text-n-600 w-3">{r}</span>
                          <Star size={10} strokeWidth={1.75} className="text-sand-400 fill-sand-400 flex-shrink-0"/>
                          <div className="flex-1 bg-n-200 rounded-full h-1.5">
                            <div className="bg-sand-400 h-full rounded-full" style={{ width:`${pct}%` }}/>
                          </div>
                          <span className="text-xs text-n-400 font-body w-4 text-right">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Review cards */}
                  <div className="lg:col-span-3 space-y-4">
                    {reviews.slice(0, 3).map((r, i) => (
                      <div key={i} className="bg-white border border-n-200 rounded-xl p-4 shadow-sm">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-full bg-ocean-100 flex items-center justify-center font-display font-bold text-ocean-700 text-sm flex-shrink-0">
                              {(r.author_name||'C').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-body font-semibold text-n-900 text-sm">{r.author_name||'Cliente'}</p>
                              <p className="text-xs font-body text-n-400">{r.created_at?.split('T')[0]}</p>
                            </div>
                          </div>
                          <StarRating rating={r.rating} size={12}/>
                        </div>
                        {r.comment && <p className="text-sm font-body text-n-600 leading-relaxed">{r.comment}</p>}
                        {r.reply_text && (
                          <div className="mt-3 bg-ocean-50 border border-ocean-100 rounded-xl px-3 py-2.5">
                            <p className="text-xs font-body font-bold text-ocean-700 mb-1">{op.name}</p>
                            <p className="text-xs font-body text-n-600">{r.reply_text}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Política de cancelamento ── */}
            <div className="pb-10 border-b border-n-100">
              <p className="text-xs font-body font-bold text-ocean-700 uppercase tracking-widest mb-4">
                {lang==='en'?'Cancellation policy':'Política de cancelamento'}
              </p>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-100 rounded-xl">
                  <RotateCcw size={18} strokeWidth={1.75} className="text-green-600 flex-shrink-0 mt-0.5"/>
                  <div>
                    <p className="font-body font-semibold text-green-800 text-sm">
                      {lang==='en'?'Free cancellation up to 24h before':'Cancelamento gratuito até 24h antes'}
                    </p>
                    <p className="text-xs font-body text-green-700 mt-0.5">
                      {lang==='en'?'Full refund if cancelled more than 24 hours in advance.':'Reembolso total se cancelado com mais de 24h de antecedência.'}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-xl">
                  <AlertCircle size={18} strokeWidth={1.75} className="text-amber-600 flex-shrink-0 mt-0.5"/>
                  <div>
                    <p className="font-body font-semibold text-amber-800 text-sm">
                      {lang==='en'?'Less than 24h — 50% refund':'Menos de 24h — reembolso de 50%'}
                    </p>
                    <p className="text-xs font-body text-amber-700 mt-0.5">
                      {lang==='en'?'Cancellations within 24h are subject to a 50% fee.':'Cancelamentos em menos de 24h têm uma taxa de 50%.'}
                    </p>
                  </div>
                </div>
                {(isActivity||isRentaCar) && (
                  <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                    <Shield size={18} strokeWidth={1.75} className="text-blue-600 flex-shrink-0 mt-0.5"/>
                    <div>
                      <p className="font-body font-semibold text-blue-800 text-sm">
                        {lang==='en'?'Bad weather policy':'Política de mau tempo'}
                      </p>
                      <p className="text-xs font-body text-blue-700 mt-0.5">
                        {lang==='en'?'Full refund or rescheduling if cancelled due to adverse weather conditions.':'Reembolso total ou remarcação se cancelado por condições meteorológicas adversas.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Localização ── */}
            <div className="pb-10 border-b border-n-100">
              <p className="text-xs font-body font-bold text-ocean-700 uppercase tracking-widest mb-4">
                {lang==='en'?'Location':'Localização'}
              </p>
              <div className="relative h-44 rounded-2xl overflow-hidden bg-ocean-50 border border-ocean-100 cursor-pointer group"
                onClick={() => window.open(`https://maps.google.com?q=${encodeURIComponent((op.address||'Santa Maria Ilha do Sal')+' Cabo Verde')}`, '_blank')}>
                <img src="https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&q=75" alt="Map" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/>
                <div className="absolute inset-0 bg-ocean-900/35"/>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-white rounded-xl px-4 py-3 text-center shadow-xl">
                    <MapPin size={20} strokeWidth={1.75} className="text-ocean-700 mx-auto mb-1"/>
                    <p className="font-display font-bold text-n-900 text-sm">{op.address||'Ilha do Sal, Cabo Verde'}</p>
                    <p className="text-xs font-body text-ocean-600 mt-1 flex items-center gap-1 justify-center">
                      <ExternalLink size={10} strokeWidth={1.75}/>
                      {lang==='en'?'Open in Google Maps':'Abrir no Google Maps'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Partilhar ── */}
            <div className="pb-10 border-b border-n-100">
              <p className="text-xs font-body font-bold text-ocean-700 uppercase tracking-widest mb-4">
                {lang==='en'?'Share this service':'Partilhar este serviço'}
              </p>
              <div className="flex flex-wrap gap-3">
                {whatsappUrl && (
                  <a href={`https://wa.me/?text=${encodeURIComponent(`${unit.name} — ${op.name}: ${window.location.href}`)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-[#25D366] text-white text-sm font-body font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity">
                    <MessageCircle size={16} strokeWidth={1.75}/>
                    WhatsApp
                  </a>
                )}
                <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-[#1877F2] text-white text-sm font-body font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity">
                  <Share2 size={16} strokeWidth={1.75}/>
                  Facebook
                </a>
                <button onClick={copyLink}
                  className="flex items-center gap-2 border-2 border-n-200 text-n-700 text-sm font-body font-semibold px-5 py-2.5 rounded-xl hover:border-ocean-700 hover:text-ocean-700 transition-all">
                  {copied ? <Check size={16} strokeWidth={2} className="text-green-600"/> : <Copy size={16} strokeWidth={1.75}/>}
                  {copied ? (lang==='en'?'Copied!':'Copiado!') : (lang==='en'?'Copy link':'Copiar link')}
                </button>
              </div>
            </div>

            {/* ── Serviços similares ── */}
            <SimilarServices units={related} slug={slug} lang={lang} currency={currency} opCurrency={op.currency||'EUR'}/>
          </div>

          {/* ══ RIGHT COLUMN — Sticky booking card ══ */}
          <div className="lg:col-span-1">
            <div className="sticky top-20">
              <div className="bg-white border-2 border-n-200 rounded-2xl shadow-xl overflow-hidden">

                {/* Price header */}
                <div className="px-5 pt-5 pb-4 border-b border-n-100">
                  <div className="flex items-end justify-between mb-2">
                    <div>
                      {displayPrice ? (
                        <p className="font-display font-extrabold text-2xl text-ocean-700 leading-none">
                          {displayPrice}
                        </p>
                      ) : (
                        <p className="font-display font-bold text-lg text-n-500">{lang==='en'?'On request':'Consultar'}</p>
                      )}
                    </div>
                    {/* CVE/EUR toggle */}
                    <div className="flex items-center gap-1 bg-n-100 rounded-full p-0.5">
                      <button onClick={() => setCur('EUR')} className={`text-xs font-body font-bold px-3 py-1 rounded-full transition-all ${currency==='EUR'?'bg-ocean-700 text-white':'text-n-500'}`}>EUR</button>
                      <button onClick={() => setCur('CVE')} className={`text-xs font-body font-bold px-3 py-1 rounded-full transition-all ${currency==='CVE'?'bg-ocean-700 text-white':'text-n-500'}`}>CVE</button>
                    </div>
                  </div>
                  {avgRating > 0 && (
                    <div className="flex items-center gap-1.5">
                      <StarRating rating={avgRating} size={12}/>
                      <span className="text-xs font-body text-n-500">{avgRating.toFixed(1)} · {reviews.length} {lang==='en'?'reviews':'avaliações'}</span>
                    </div>
                  )}
                </div>

                {/* Quick info */}
                <div className="px-5 py-4 border-b border-n-100 space-y-2.5">
                  {unit.capacity && (
                    <div className="flex items-center justify-between text-sm font-body">
                      <span className="text-n-500 flex items-center gap-2"><Users size={14} strokeWidth={1.75} className="text-ocean-500"/>{lang==='en'?'Capacity':'Capacidade'}</span>
                      <span className="font-semibold text-n-800">{lang==='en'?`Up to ${unit.capacity} people`:`Até ${unit.capacity} pessoas`}</span>
                    </div>
                  )}
                  {isHotel && (
                    <div className="flex items-center justify-between text-sm font-body">
                      <span className="text-n-500 flex items-center gap-2"><Clock size={14} strokeWidth={1.75} className="text-ocean-500"/>Check-in</span>
                      <span className="font-semibold text-n-800">14:00</span>
                    </div>
                  )}
                  {(isActivity||isRentaCar) && (
                    <div className="flex items-center justify-between text-sm font-body">
                      <span className="text-n-500 flex items-center gap-2"><MapPin size={14} strokeWidth={1.75} className="text-ocean-500"/>{lang==='en'?'Pickup':'Levantamento'}</span>
                      <span className="font-semibold text-n-800">{lang==='en'?'On request':'A combinar'}</span>
                    </div>
                  )}
                  {op.phone && (
                    <div className="flex items-center justify-between text-sm font-body">
                      <span className="text-n-500 flex items-center gap-2"><Phone size={14} strokeWidth={1.75} className="text-ocean-500"/>{lang==='en'?'Contact':'Contacto'}</span>
                      <a href={`tel:${op.phone}`} className="font-semibold text-ocean-700 hover:underline">{op.phone}</a>
                    </div>
                  )}
                </div>

                {/* Urgency */}
                {(urgencyCount > 0 || (spotsLeft !== null && spotsLeft < 5)) && (
                  <div className="px-5 py-3 border-b border-n-100 bg-amber-50">
                    {spotsLeft !== null && spotsLeft > 0 && spotsLeft < 5 ? (
                      <p className="text-xs font-body font-semibold text-amber-700">
                        <span className="font-bold">{spotsLeft}</span> {lang==='en'?'spots left — book now!':'vagas restantes — reserve já!'}
                      </p>
                    ) : (
                      <p className="text-xs font-body font-semibold text-amber-700">
                        <span className="font-bold">{urgencyCount}</span> {lang==='en'?'bookings this month':'reservas este mês'}
                      </p>
                    )}
                  </div>
                )}

                {/* CTA buttons */}
                <div className="px-5 py-5 space-y-3">
                  <button onClick={() => setBookOpen(true)}
                    className="w-full bg-ocean-700 text-white font-body font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-ocean-500 transition-colors text-base shadow-sm hover:shadow-md">
                    <Calendar size={18} strokeWidth={1.75}/>
                    {lang==='en'?'Book Now':'Reservar Agora'}
                  </button>
                  <p className="text-center text-xs font-body text-n-400">
                    {lang==='en'?'No charge now — confirm details first':'Sem cobrança agora — confirme os detalhes'}
                  </p>
                  {whatsappUrl && (
                    <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
                      className="w-full border-2 border-n-200 text-n-700 font-body font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:border-ocean-700 hover:text-ocean-700 transition-all text-sm">
                      <MessageCircle size={16} strokeWidth={1.75}/>
                      {lang==='en'?'Contact operator':'Contactar operador'}
                    </a>
                  )}
                </div>

                {/* Trust badges */}
                <div className="px-5 pb-5 grid grid-cols-3 gap-2">
                  {[
                    { icon:<Shield size={14} strokeWidth={1.75}/>, pt:'Verificado', en:'Verified' },
                    { icon:<CreditCard size={14} strokeWidth={1.75}/>, pt:'Pagamento seguro', en:'Secure payment' },
                    { icon:<RotateCcw size={14} strokeWidth={1.75}/>, pt:'Cancelamento', en:'Free cancel' },
                  ].map((b,i) => (
                    <div key={i} className="flex flex-col items-center gap-1 text-center">
                      <div className="w-7 h-7 rounded-full bg-ocean-50 flex items-center justify-center text-ocean-700">{b.icon}</div>
                      <p className="text-xs font-body text-n-400 leading-tight">{lang==='en'?b.en:b.pt}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Operator info card */}
              <div className="mt-4 bg-n-50 border border-n-200 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  {op.logo_url ? (
                    <img src={op.logo_url} alt={op.name} className="w-10 h-10 rounded-full object-cover border border-n-200"/>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-ocean-100 flex items-center justify-center font-display font-bold text-ocean-700 text-sm flex-shrink-0">
                      {op.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <p className="font-display font-bold text-n-900 text-sm">{op.name}</p>
                    <p className="text-xs font-body text-n-400">{lang==='en'?'Responds quickly':'Resposta rápida'}</p>
                  </div>
                </div>
                <button onClick={() => navigate(`/book/${slug}`)}
                  className="w-full text-xs font-body font-semibold text-ocean-700 border border-ocean-200 py-2 rounded-lg hover:bg-ocean-50 transition-colors flex items-center justify-center gap-1.5">
                  <ExternalLink size={12} strokeWidth={1.75}/>
                  {lang==='en'?'View all services':'Ver todos os serviços'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer className="bg-ocean-900 text-white/70 mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {op.logo_url
                ? <img src={op.logo_url} alt={op.name} className="h-7 object-contain brightness-0 invert"/>
                : <Logo size="sm" white/>}
              <div className="text-sm font-body text-white/50">
                {op.name} · {lang==='en'?'Ilha do Sal, Cape Verde':'Ilha do Sal, Cabo Verde'}
              </div>
            </div>
            <p className="text-xs font-body text-white/35">
              {lang==='en'?'Powered by':'Plataforma'}{' '}
              <a href="https://saldesk.cv" className="text-white/55 hover:text-white font-semibold transition-colors">SalDesk</a>
              {' '}&middot;{' '}
              <a href="https://wandr.cv" className="text-white/55 hover:text-white font-semibold transition-colors">WANDR</a>
            </p>
          </div>
        </div>
      </footer>

      {/* ── Mobile bottom bar ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-n-200 px-4 py-3 flex gap-3 z-30 lg:hidden shadow-lg">
        {displayPrice && (
          <div className="flex flex-col justify-center mr-2">
            <p className="font-display font-bold text-ocean-700 text-base leading-tight">{displayPrice}</p>
          </div>
        )}
        <button onClick={() => setBookOpen(true)}
          className="flex-1 bg-ocean-700 text-white font-body font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-ocean-500 transition-colors text-sm">
          <Calendar size={16} strokeWidth={1.75}/>
          {lang==='en'?'Book Now':'Reservar Agora'}
        </button>
        {whatsappUrl && (
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
            className="bg-[#25D366] text-white font-body font-semibold py-3 px-4 rounded-xl flex items-center justify-center">
            <MessageCircle size={18} strokeWidth={1.75}/>
          </a>
        )}
      </div>

      {/* ── Booking Modal ── */}
      {bookOpen && (
        <BookingModal unit={unit} op={op} slug={slug} lang={lang} onClose={() => setBookOpen(false)}/>
      )}

      {/* ── Lightbox ── */}
      {lbIdx !== null && (
        <Lightbox images={imgs} idx={lbIdx} onClose={() => setLbIdx(null)} onMove={d => setLbIdx(i => (i+d+imgs.length)%imgs.length)}/>
      )}
    </div>
  );
}
