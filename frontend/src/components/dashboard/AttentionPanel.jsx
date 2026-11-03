import { useNavigate } from 'react-router-dom';
import { ChevronRight, CheckCircle2 } from 'lucide-react';
import { useT } from '../../i18n';

/* Cor do ponto por gravidade */
const DOT = {
  critical: 'bg-red-600',
  warning: 'bg-amber-500',
  info: 'bg-ocean-500',
};

/* Painel "Requer atencao": lista ordenada de itens, cada um com destino proprio */
export default function AttentionPanel({ items }) {
  const t = useT();
  const navigate = useNavigate();
  const list = Array.isArray(items) ? items : [];

  return (
    <section className="bg-white border border-n-200 rounded-sm">
      <header className="flex items-center gap-2 px-4 py-3 border-b border-n-200">
        <h2 className="font-display font-semibold text-sm text-n-900">{t('dashboard.attention.title')}</h2>
        {list.length > 0 && (
          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-amber-100 text-amber-800 text-xs font-body font-semibold tabular-nums">
            {list.length}
          </span>
        )}
      </header>

      {list.length === 0 ? (
        <p className="flex items-center gap-2 px-4 py-4 text-[13px] font-body text-n-600">
          <CheckCircle2 size={16} strokeWidth={1.75} className="text-success shrink-0" aria-hidden="true" />
          {t('dashboard.attention.allClear')}
        </p>
      ) : (
        <ul className="divide-y divide-n-100">
          {list.map((item) => (
            <li key={item.id} className="flex items-center gap-3 px-4 py-2.5">
              <span
                data-severity={item.severity}
                aria-hidden="true"
                className={`w-2 h-2 rounded-full shrink-0 ${DOT[item.severity] || DOT.info}`}
              />
              <div className="flex-1 min-w-0">
                <p data-role="title" className="text-[13px] font-body font-medium text-n-900 leading-snug">
                  {item.title}
                </p>
                {item.detail && (
                  <p className="text-xs font-body text-n-500 leading-snug truncate">{item.detail}</p>
                )}
              </div>
              <button
                type="button"
                aria-label={`${t('dashboard.attention.open')}: ${item.title}`}
                onClick={() => navigate(item.to)}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-sm border border-n-200 bg-white text-xs font-body font-medium text-ocean-700 hover:bg-ocean-50 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-300"
              >
                {t('dashboard.attention.open')}
                <ChevronRight size={13} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
