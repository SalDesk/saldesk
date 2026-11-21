/* Horarios do dia escolhido (slot-availability). Por pessoa, um horario serve quando tem
   lugares para o grupo todo; privado, quando ninguem o reservou ainda. Horarios ja
   comecados (started) vem do servidor com remaining 0 e ficam esgotados. Uma falha do pedido mostra-se como falha, com "Tentar de novo". */
import FalhaComRepetir from './FalhaComRepetir';

export function horarioDisponivel(h, pax, modo) {
  if (!h || h.started) return false;
  if (modo === 'private') return !!h.privateAvailable;
  return Number(h.remaining) >= Math.max(1, pax);
}

function nota(h, disponivel, modo, en) {
  const restam = Number(h.remaining) || 0;
  if (h.started || restam === 0) return en ? 'Sold out' : 'Esgotado';
  if (modo === 'private') return disponivel ? '' : (en ? 'Unavailable' : 'Indisponível');
  if (restam <= 5) return en ? `Only ${restam} left` : `Restam ${restam}`;
  return '';
}

export default function HorariosReserva({ horarios: lista, carregando, seleccionado, onEscolher, pax, modo, lang, falhou, onTentarDeNovo }) {
  const en = lang === 'en';
  return (
    <div aria-live="polite" data-testid="horarios">
      {carregando ? (
        <p className="text-xs font-body text-n-500">{en ? 'Loading times…' : 'A carregar horários…'}</p>
      ) : falhou ? (
        <FalhaComRepetir lang={lang} texto={en ? 'Could not load times' : 'Não foi possível carregar os horários'} onTentar={onTentarDeNovo}/>
      ) : lista.length > 0 && (
        <div role="group" aria-label={en ? 'Time' : 'Horário'} className="grid grid-cols-2 min-[420px]:grid-cols-3 lg:grid-cols-2 gap-2">
          {lista.map((h) => {
            const disponivel = horarioDisponivel(h, pax, modo);
            const sel = disponivel && h.time === seleccionado;
            const texto = nota(h, disponivel, modo, en);
            const estado = sel
              ? 'bg-brand-700 border-brand-700 text-white'
              : disponivel
                ? 'bg-white border-n-200 text-n-900 hover:border-brand-500'
                : 'bg-n-50 border-n-100 text-n-400 cursor-not-allowed';
            return (
              <button key={h.time} type="button" data-horario={h.time}
                disabled={!disponivel} aria-pressed={sel}
                onClick={() => onEscolher(h.time)}
                className={`min-w-0 border rounded-xl px-3 py-2 text-left transition-colors motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 ${estado}`}>
                <span className={`block font-display font-bold text-sm ${disponivel ? '' : 'line-through'}`}>{h.time}</span>
                {texto && (
                  <span className={`block text-[11px] font-body font-semibold ${sel ? 'text-white/85' : disponivel ? 'text-amber-700' : 'text-n-400'}`}>{texto}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
