import { useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { useT } from '../../i18n';

/* Cor do quadrado por gravidade */
const DOT = {
  critical: 'bg-red-600',
  warning: 'bg-sand-500',
  info: 'bg-ocean-500',
};

/* Rotulo da accao de cada linha, pelo prefixo do id do item (ver buildAttentionItems) */
function chaveDaAccao(id) {
  const prefixo = String(id || '');
  if (prefixo.startsWith('unconfirmed') || prefixo.startsWith('pending')) return 'dashboard.attention.confirm';
  if (prefixo.startsWith('unpaid')) return 'dashboard.attention.collect';
  if (prefixo.startsWith('weather')) return 'dashboard.attention.view';
  return 'dashboard.attention.open';
}

/* Painel "Requer atencao": lista ordenada de itens, cada um com destino proprio */
export default function AttentionPanel({ items }) {
  const t = useT();
  const navigate = useNavigate();
  const list = Array.isArray(items) ? items : [];

  return (
    <section className="bg-white border border-n-200 rounded-2xl p-4 lg:px-[22px] lg:pt-[22px] lg:pb-2.5 flex flex-col">
      <header className="flex items-center justify-between gap-2 mb-1">
        <h2 className="font-display font-semibold text-base lg:text-lg text-ocean-900">{t('dashboard.attention.title')}</h2>
        {list.length > 0 && (
          <span className="inline-flex items-center justify-center min-w-[24px] px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-xs font-mono font-medium tabular-nums">
            {list.length}
          </span>
        )}
      </header>

      {list.length === 0 ? (
        <p className="flex items-center gap-2 py-3 text-[13px] font-body text-n-600">
          <CheckCircle2 size={16} strokeWidth={1.75} className="text-success shrink-0" aria-hidden="true" />
          {t('dashboard.attention.allClear')}
        </p>
      ) : (
        <ul className="divide-y divide-n-100">
          {list.map((item) => {
            const accao = t(chaveDaAccao(item.id));
            return (
              <li key={item.id} className="grid grid-cols-[10px_minmax(0,1fr)_auto] items-start gap-3 py-3">
                <span
                  data-severity={item.severity}
                  aria-hidden="true"
                  className={`w-2.5 h-2.5 rounded-[3px] mt-[5px] ${DOT[item.severity] || DOT.info}`}
                />
                <div className="flex flex-col gap-0.5 min-w-0">
                  <p data-role="title" className="text-sm font-body font-semibold text-n-900 leading-snug">
                    {item.title}
                  </p>
                  {item.detail && (
                    <p className="text-[13px] font-body text-n-600 leading-snug">{item.detail}</p>
                  )}
                </div>
                <button
                  type="button"
                  aria-label={`${accao}: ${item.title}`}
                  onClick={() => navigate(item.to)}
                  className="text-[13px] font-body font-semibold text-ocean-700 hover:text-ocean-900 hover:underline whitespace-nowrap min-h-[28px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sand-500 rounded-sm"
                >
                  {accao}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
