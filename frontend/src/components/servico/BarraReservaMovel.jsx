/* Barra fixa em baixo, so abaixo de 1024 px: o preco "Desde" e o botao que leva ate a coluna
   de reserva (#reserva), que nos telemoveis fica logo a seguir aos factos. */
import { Calendar } from 'lucide-react';

function semMovimento() {
  try { return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

/* Leva ate a coluna de reserva e poe la o foco. Tambem usado pelo "Reservar" da barra de cima. */
export function irParaReserva(alvo = 'reserva') {
  const el = document.getElementById(alvo);
  if (!el) return;
  el.scrollIntoView?.({ behavior: semMovimento() ? 'auto' : 'smooth', block: 'start' });
  el.focus?.({ preventScroll: true });
}

export default function BarraReservaMovel({ precoTexto, lang, alvo = 'reserva' }) {
  const en = lang === 'en';
  return (
    <div data-testid="barra-reserva-movel"
      className="fixed bottom-0 inset-x-0 z-30 lg:hidden bg-white border-t border-n-200 shadow-lg px-4 py-3 flex items-center gap-3">
      {precoTexto && (
        <p className="min-w-0 font-body text-xs text-n-500 leading-tight">
          {en ? 'From' : 'Desde'}{' '}
          <span className="block font-display font-extrabold text-base text-brand-700 truncate">{precoTexto}</span>
        </p>
      )}
      <button type="button" onClick={() => irParaReserva(alvo)}
        className="flex-1 min-w-0 bg-sand-500 text-n-900 font-body font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 hover:bg-sand-400 transition-colors motion-reduce:transition-none text-sm shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2">
        <Calendar size={16} strokeWidth={1.75} aria-hidden="true"/>
        <span className="truncate">{en ? 'Check availability' : 'Ver disponibilidade'}</span>
      </button>
    </div>
  );
}
