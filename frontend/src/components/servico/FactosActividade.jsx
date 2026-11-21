/* Factos rapidos da actividade (duracao, formato, linguas, recolha, saidas, grupo), vindos de
   factosActividade() em utils/paginaActividade.js. So aparecem os que o operador preencheu. */
import { Clock, Users, Languages, MapPin, CalendarClock, UserRound } from 'lucide-react';

const FACTOS = {
  duracao: { icone: Clock, pt: 'Duração', en: 'Duration' },
  formato: { icone: Users, pt: 'Formato', en: 'Format' },
  linguas: { icone: Languages, pt: 'Línguas', en: 'Languages' },
  recolha: { icone: MapPin, pt: 'Recolha', en: 'Pickup' },
  saidas: { icone: CalendarClock, pt: 'Saídas', en: 'Departures' },
  grupo: { icone: UserRound, pt: 'Tamanho do grupo', en: 'Group size' },
};

export default function FactosActividade({ factos, lang }) {
  const lista = (Array.isArray(factos) ? factos : []).filter((f) => f && FACTOS[f.chave] && f.valor);
  if (!lista.length) return null;
  const en = lang === 'en';
  return (
    <dl className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-3 gap-3">
      {lista.map((f) => {
        const { icone: Icone, pt, en: rotuloEn } = FACTOS[f.chave];
        return (
          <div key={f.chave} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 bg-white border border-n-200 rounded-2xl p-4 shadow-sm">
            <span aria-hidden="true" className="row-span-2 w-10 h-10 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center">
              <Icone size={20} strokeWidth={1.75}/>
            </span>
            <dt className="text-[11px] font-display font-bold uppercase tracking-wider text-n-500">{en ? rotuloEn : pt}</dt>
            <dd className="font-body font-semibold text-sm text-n-900 leading-snug break-words">{f.valor}</dd>
          </div>
        );
      })}
    </dl>
  );
}
