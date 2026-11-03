import Tabs from '../ui/Tabs';
import { useT } from '../../i18n';

/* Cabecalho do Dashboard: titulo, subtitulo, acoes e interruptor Hoje/Resumo */
export default function DashboardHeader({ title, subtitle, actions, view, onViewChange }) {
  const t = useT();
  const tabs = [
    { id: 'hoje', label: t('dashboard.view.today') },
    { id: 'resumo', label: t('dashboard.view.summary') },
  ];

  return (
    <header className="mb-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h1 className="font-display font-bold text-xl text-n-900 leading-tight">{title}</h1>
          {subtitle && <p className="text-[13px] font-body text-n-500 mt-0.5">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <Tabs tabs={tabs} value={view} onChange={onViewChange} />
    </header>
  );
}
