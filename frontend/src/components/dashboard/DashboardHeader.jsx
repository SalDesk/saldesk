import { useRef } from 'react';
import { Plus } from 'lucide-react';
import { useT } from '../../i18n';
import Button from '../ui/Button';

/* Cabecalho do Dashboard (partilhado por todos os tipos de operador): data em DM Mono, titulo,
   interruptor Hoje/Resumo em pilula e as accoes. Os callbacks onVerCalendario e onNovaReserva sao
   opcionais: sem eles o botao nao aparece (o cabecalho nao depende do router).
   Abaixo de 768 px "Nova reserva" e o MESMO botao, redondo e flutuante no canto, acima da BottomNav. */
export default function DashboardHeader({
  title, subtitle, actions, view, onViewChange, onVerCalendario, onNovaReserva,
}) {
  const t = useT();
  const refs = useRef([]);
  const tabs = [
    { id: 'hoje', label: t('dashboard.view.today') },
    { id: 'resumo', label: t('dashboard.view.summary') },
  ];
  const haActivo = tabs.some((x) => x.id === view);

  /* Setas, Home e End mudam de vista como nos separadores do resto do painel */
  function aoCarregarTecla(e, indice) {
    const ultimo = tabs.length - 1;
    let destino = null;
    if (e.key === 'ArrowRight') destino = indice === ultimo ? 0 : indice + 1;
    else if (e.key === 'ArrowLeft') destino = indice === 0 ? ultimo : indice - 1;
    else if (e.key === 'Home') destino = 0;
    else if (e.key === 'End') destino = ultimo;
    if (destino === null) return;
    e.preventDefault();
    onViewChange(tabs[destino].id);
    refs.current[destino]?.focus();
  }

  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="min-w-0 flex flex-col gap-1">
        {subtitle && <span className="font-mono text-[13px] text-n-600">{subtitle}</span>}
        <h1 className="font-display font-bold text-2xl md:text-[28px] text-ocean-900 leading-tight">{title}</h1>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {actions}
        <div
          role="tablist"
          aria-label={t('dashboard.mare.header.viewLabel')}
          className="inline-flex gap-1 p-1 bg-white border border-n-200 rounded-full"
        >
          {tabs.map((tab, i) => {
            const activo = tab.id === view;
            return (
              <button
                key={tab.id}
                ref={(el) => { refs.current[i] = el; }}
                type="button"
                role="tab"
                aria-selected={activo}
                tabIndex={activo || (!haActivo && i === 0) ? 0 : -1}
                onKeyDown={(e) => aoCarregarTecla(e, i)}
                onClick={() => onViewChange(tab.id)}
                className={`px-4 h-8 rounded-full text-[13px] font-body font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-300 ${
                  activo ? 'bg-ocean-900 text-white' : 'text-ocean-700 hover:bg-ocean-50'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {onVerCalendario && (
          <Button variant="secondary" onClick={onVerCalendario}>
            {t('dashboard.activity.viewCalendar')}
          </Button>
        )}
        {onNovaReserva && (
          <Button
            variant="accent"
            onClick={onNovaReserva}
            aria-label={t('dashboard.activity.newReservation')}
            className="max-md:fixed max-md:right-4 max-md:bottom-[calc(5rem+env(safe-area-inset-bottom))] max-md:z-30 max-md:w-14 max-md:h-14 max-md:p-0 max-md:rounded-full max-md:shadow-lg"
          >
            <Plus strokeWidth={2} aria-hidden="true" className="shrink-0 w-6 h-6 md:w-4 md:h-4" />
            <span className="max-md:hidden">{t('dashboard.activity.newReservation')}</span>
          </Button>
        )}
      </div>
    </header>
  );
}
