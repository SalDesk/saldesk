import { CalendarDays } from 'lucide-react';
import { useT } from '../../i18n';

/* Abreviaturas fixas por idioma (o Intl 'short' do pt-PT da nomes compridos demais para a celula) */
const DIA_SEMANA = {
  pt: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  de: ['Só', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
  nl: ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'],
};

/* Faixa compacta dos proximos 7 dias: contagem so quando ha reservas, hoje destacado */
export default function NextDaysStrip({ dias, contagens, hoje, lang, onAbrir }) {
  const t = useT();
  const nomes = DIA_SEMANA[lang] || DIA_SEMANA.pt;
  return (
    <section className="bg-white border border-n-200 rounded-md">
      <header className="flex items-center gap-2 px-4 py-3 border-b border-n-200">
        <CalendarDays size={14} strokeWidth={1.75} className="text-n-500" aria-hidden="true" />
        <h2 className="font-display font-semibold text-sm text-n-900">{t('dashboard.activity.next7Days')}</h2>
      </header>
      <div className="grid grid-cols-7 gap-1 p-2">
        {(Array.isArray(dias) ? dias : []).map((dia) => {
          const d = new Date(`${dia}T00:00:00Z`);
          const n = Number(contagens?.[dia]) || 0;
          const eHoje = dia === hoje;
          return (
            <button
              key={dia}
              type="button"
              onClick={onAbrir}
              aria-current={eHoje ? 'date' : undefined}
              className={`flex flex-col items-center py-1.5 rounded-md border text-[10px] font-body transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-300 ${
                eHoje
                  ? 'bg-ocean-700 border-ocean-700 text-ocean-100'
                  : n > 0
                    ? 'bg-ocean-50 border-ocean-100 text-ocean-700 hover:bg-ocean-100'
                    : 'bg-white border-n-200 text-n-500 hover:bg-n-50'
              }`}
            >
              <span>{nomes[d.getUTCDay()]}</span>
              <span className={`font-display font-semibold text-[13px] tabular-nums ${eHoje ? 'text-white' : 'text-n-900'}`}>{d.getUTCDate()}</span>
              {n > 0 && <span className="tabular-nums font-semibold">{`${n} ${t('dashboard.activity.resShort')}`}</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}
