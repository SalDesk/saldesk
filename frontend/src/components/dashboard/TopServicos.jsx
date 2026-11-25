import { useT } from '../../i18n';
import { useLingua } from '../../utils/formatoLingua';
import { eurosInteiros } from '../../pages/reservations/shared';
import EmptyState from '../ui/EmptyState';

/* "Servicos que mais rendem": ate 5, por receita, com barra relativa ao primeiro (a barra do primeiro
   em areia). servicos: [{ name, receita, num_reservas }] de /financial/unidades;
   estado: 'loading' | 'ok' | 'erro'. */

const MAXIMO = 5;

export default function TopServicos({ servicos, estado }) {
  const t = useT();
  useLingua();
  const linhas = (Array.isArray(servicos) ? servicos : [])
    .filter((s) => Number(s.receita) > 0)
    .sort((a, b) => Number(b.receita) - Number(a.receita))
    .slice(0, MAXIMO);
  const maior = linhas.length > 0 ? Number(linhas[0].receita) : 0;

  let corpo;
  if (estado === 'loading') {
    corpo = <div className="h-[168px] rounded-lg bg-n-100 animate-pulse" data-testid="resumo-top-carga" />;
  } else if (estado === 'erro') {
    corpo = <EmptyState title={t('dashboard.resumo.top.error')} />;
  } else if (linhas.length === 0) {
    corpo = <EmptyState title={t('dashboard.resumo.top.empty')} />;
  } else {
    corpo = linhas.map((s, i) => {
      const reservas = Number(s.num_reservas) || 0;
      return (
        <div key={s.id ?? `${s.name}-${i}`} className="flex flex-col gap-1.5" data-testid="resumo-top-linha">
          <div className="flex justify-between gap-2 text-sm font-body text-n-900">
            <span className="font-semibold truncate">{s.name}</span>
            <span className="font-mono shrink-0">{eurosInteiros(s.receita)}</span>
          </div>
          <div className="h-2.5 rounded-full bg-ocean-50 overflow-hidden">
            <div
              data-testid="resumo-top-barra"
              className={`h-full rounded-full ${i === 0 ? 'bg-sand-500' : 'bg-ocean-500'}`}
              style={{ width: `${Math.max(2, Math.round((Number(s.receita) / maior) * 100))}%` }}
            />
          </div>
          <span className="text-xs font-body text-n-500">
            {reservas === 1 ? t('dashboard.resumo.top.bookingsOne') : t('dashboard.resumo.top.bookings', { n: reservas })}
          </span>
        </div>
      );
    });
  }

  return (
    <section aria-labelledby="resumo-top-titulo" className="bg-white border border-n-200 rounded-2xl p-5 lg:p-[22px] flex flex-col gap-3.5 min-w-0">
      <h2 id="resumo-top-titulo" className="font-display font-semibold text-lg text-ocean-900">{t('dashboard.resumo.top.title')}</h2>
      {corpo}
    </section>
  );
}
