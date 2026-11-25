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
  const todos = Array.isArray(servicos) ? servicos : [];
  /* A receita so conta reservas concluidas: sem nenhuma, ordena-se por reservas */
  const porReceita = todos.some((x) => Number(x.receita) > 0);
  const valorDe = (x) => Number(porReceita ? x.receita : x.num_reservas) || 0;
  const linhas = todos
    .filter((x) => valorDe(x) > 0)
    .sort((x, y) => valorDe(y) - valorDe(x))
    .slice(0, MAXIMO);
  const maior = linhas.length > 0 ? valorDe(linhas[0]) : 0;
  const reservasTexto = (n) => (n === 1 ? t('dashboard.resumo.top.bookingsOne') : t('dashboard.resumo.top.bookings', { n }));

  let corpo;
  if (estado === 'loading') {
    corpo = <div className="h-[168px] rounded-lg bg-n-100 animate-pulse" data-testid="resumo-top-carga" />;
  } else if (estado === 'erro') {
    corpo = <EmptyState title={t('dashboard.resumo.top.error')} />;
  } else if (linhas.length === 0) {
    corpo = <EmptyState title={t('dashboard.resumo.top.empty')} />;
  } else {
    corpo = [
      !porReceita && <p key="nota" className="text-xs font-body text-n-500">{t('dashboard.resumo.top.byBookings')}</p>,
      ...linhas.map((s, i) => {
      const reservas = Number(s.num_reservas) || 0;
      return (
        <div key={s.id ?? `${s.name}-${i}`} className="flex flex-col gap-1.5" data-testid="resumo-top-linha">
          <div className="flex justify-between gap-2 text-sm font-body text-n-900">
            <span className="font-semibold truncate">{s.name}</span>
            <span className="font-mono shrink-0">{porReceita ? eurosInteiros(s.receita) : reservasTexto(reservas)}</span>
          </div>
          <div className="h-2.5 rounded-full bg-ocean-50 overflow-hidden">
            <div
              data-testid="resumo-top-barra"
              className={`h-full rounded-full ${i === 0 ? 'bg-sand-500' : 'bg-ocean-500'}`}
              style={{ width: `${Math.max(2, maior > 0 ? Math.round((valorDe(s) / maior) * 100) : 0)}%` }}
            />
          </div>
          {porReceita && <span className="text-xs font-body text-n-500">{reservasTexto(reservas)}</span>}
        </div>
      );
      }),
    ];
  }

  return (
    <section aria-labelledby="resumo-top-titulo" className="bg-white border border-n-200 rounded-2xl p-5 lg:p-[22px] flex flex-col gap-3.5 min-w-0">
      <h2 id="resumo-top-titulo" className="font-display font-semibold text-lg text-ocean-900">{t('dashboard.resumo.top.title')}</h2>
      {corpo}
    </section>
  );
}
