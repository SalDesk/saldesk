/* Linha de erro de um pedido que falhou (rede, 429, 500) com o botao "Tentar de novo". Na coluna
   de reserva uma falha nunca se mostra como "sem datas" ou "sem horarios": e dita como falha. */
import { AlertCircle, RotateCcw } from 'lucide-react';

export default function FalhaComRepetir({ texto, onTentar, lang }) {
  const en = lang === 'en';
  return (
    <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-body text-red-700">
      <span className="flex items-start gap-1.5 min-w-0">
        <AlertCircle size={14} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0"/>
        {texto}
      </span>
      <button type="button" onClick={onTentar}
        className="inline-flex items-center gap-1 font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-600 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1">
        <RotateCcw size={12} strokeWidth={2} aria-hidden="true"/>
        {en ? 'Try again' : 'Tentar de novo'}
      </button>
    </div>
  );
}
