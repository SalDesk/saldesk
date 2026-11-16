import { useNavigate } from 'react-router-dom';
import { useT } from '../../i18n';

/* Atalhos do Dashboard: todos levam a ecras que ja existem */
const ATALHOS = [
  { chave: 'checkin', rota: '/reservas' },
  { chave: 'blockDay', rota: '/calendario' },
  { chave: 'message', rota: '/mensagens' },
  { chave: 'payment', rota: '/financeiro' },
];

export default function Shortcuts() {
  const t = useT();
  const navigate = useNavigate();
  return (
    <section className="bg-white border border-n-200 rounded-md">
      <header className="px-4 py-3 border-b border-n-200">
        <h2 className="font-display font-semibold text-sm text-n-900">{t('dashboard.shortcuts.title')}</h2>
      </header>
      <div className="grid grid-cols-2 gap-2 p-3">
        {ATALHOS.map(({ chave, rota }) => (
          <button
            key={chave}
            type="button"
            onClick={() => navigate(rota)}
            className="px-2 py-2.5 rounded-md border border-dashed border-n-300 text-xs font-body font-semibold text-ocean-700 hover:bg-ocean-50 hover:border-ocean-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-300"
          >
            {t(`dashboard.shortcuts.${chave}`)}
          </button>
        ))}
      </div>
    </section>
  );
}
