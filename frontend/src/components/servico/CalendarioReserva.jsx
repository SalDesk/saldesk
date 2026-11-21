/* Calendario do mes na coluna de reserva da actividade. Os dias livres vem do servidor
   (availability-month, ja em hora de Cabo Verde); os outros ficam riscados e com
   aria-disabled. Setas do teclado movem o foco entre os dias (foco itinerante: so um dia
   tem tabIndex 0). Datas sempre como texto 'YYYY-MM-DD', nunca a hora local do browser. */
import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/* Mes corrente em Cabo Verde ('YYYY-MM'), seja qual for o fuso do browser */
export function mesDeCaboVerde(agora = new Date()) {
  const partes = new Intl.DateTimeFormat('en-GB', { timeZone: 'Atlantic/Cape_Verde', year: 'numeric', month: '2-digit' })
    .formatToParts(agora);
  const ano = partes.find((p) => p.type === 'year')?.value;
  const mes = partes.find((p) => p.type === 'month')?.value;
  return `${ano}-${mes}`;
}

/* 'YYYY-MM' mais n meses */
export function somarMes(mes, n) {
  const [a, m] = mes.split('-').map(Number);
  const t = a * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}

const SEMANA = {
  pt: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'],
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
};
const TECLAS = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };

function nomeDoMes(mes, en) {
  const [a, m] = mes.split('-').map(Number);
  const s = new Date(Date.UTC(a, m - 1, 1)).toLocaleDateString(en ? 'en-GB' : 'pt-PT', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function nomeDoDia(dia, en) {
  const [a, m, d] = dia.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d)).toLocaleDateString(en ? 'en-GB' : 'pt-PT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
}

export default function CalendarioReserva({ mes, dias, seleccionado, onEscolher, onMudarMes, podeRecuar, lang }) {
  const en = lang === 'en';
  const carregando = dias === null;
  const livres = dias || {};
  const vazio = !carregando && Object.keys(livres).length === 0;

  const [a, m] = mes.split('-').map(Number);
  const totalDias = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const desvio = (new Date(Date.UTC(a, m - 1, 1)).getUTCDay() + 6) % 7; /* segunda-feira primeiro */
  const lista = Array.from({ length: totalDias }, (_, i) => `${mes}-${String(i + 1).padStart(2, '0')}`);

  const [foco, setFoco] = useState(null);
  const refs = useRef({});
  const focavel = (foco && foco.startsWith(mes) && foco)
    || (seleccionado && seleccionado.startsWith(mes) && seleccionado)
    || lista.find((d) => livres[d])
    || lista[0];

  function tecla(e, dia) {
    const passo = TECLAS[e.key];
    if (passo === undefined) return;
    e.preventDefault();
    const i = Math.min(lista.length - 1, Math.max(0, lista.indexOf(dia) + passo));
    const alvo = lista[i];
    setFoco(alvo);
    refs.current[alvo]?.focus();
  }

  const titulo = nomeDoMes(mes, en);
  const botaoMes = 'w-9 h-9 rounded-lg flex items-center justify-center text-n-600 hover:bg-n-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500';

  return (
    <div data-testid="calendario">
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={() => onMudarMes(-1)} disabled={!podeRecuar}
          aria-label={en ? 'Previous month' : 'Mês anterior'} className={botaoMes}>
          <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true"/>
        </button>
        <p aria-live="polite" className="font-display font-bold text-sm text-n-900">{titulo}</p>
        <button type="button" onClick={() => onMudarMes(1)}
          aria-label={en ? 'Next month' : 'Mês seguinte'} className={botaoMes}>
          <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true"/>
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center" aria-hidden="true">
        {SEMANA[en ? 'en' : 'pt'].map((d) => (
          <span key={d} className="text-[10px] font-display font-bold uppercase tracking-wider text-n-400 py-1">{d}</span>
        ))}
      </div>
      <div role="group" aria-label={titulo} aria-busy={carregando ? 'true' : undefined}
        className="grid grid-cols-7 gap-1">
        {desvio > 0 && <span aria-hidden="true" style={{ gridColumn: `span ${desvio} / span ${desvio}` }}/>}
        {lista.map((dia) => {
          const livre = !carregando && !!livres[dia];
          const sel = dia === seleccionado;
          const estado = sel
            ? 'bg-brand-700 text-white font-bold'
            : livre
              ? 'text-n-900 font-semibold hover:bg-brand-50'
              : carregando ? 'text-n-300' : 'text-n-300 line-through cursor-not-allowed';
          return (
            <button key={dia} type="button" data-dia={dia}
              ref={(el) => { refs.current[dia] = el; }}
              tabIndex={dia === focavel ? 0 : -1}
              aria-disabled={livre ? undefined : 'true'}
              aria-pressed={sel}
              aria-label={`${nomeDoDia(dia, en)}${livre ? '' : (en ? ', unavailable' : ', indisponível')}`}
              onClick={() => { if (livre) onEscolher(dia); }}
              onKeyDown={(e) => tecla(e, dia)}
              onFocus={() => setFoco(dia)}
              className={`aspect-square min-w-0 rounded-lg text-sm font-body transition-colors motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${estado}`}>
              {Number(dia.slice(8))}
            </button>
          );
        })}
      </div>
      <p aria-live="polite" className="text-xs font-body text-n-500 mt-2 min-h-[1rem]">
        {carregando
          ? (en ? 'Loading dates…' : 'A carregar datas…')
          : vazio ? (en ? 'No dates available this month' : 'Sem datas disponíveis neste mês') : ''}
      </p>
    </div>
  );
}
