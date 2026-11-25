import { useT } from '../../i18n';
import { formatarNumero, localeDe, useLingua } from '../../utils/formatoLingua';
import { LIMITE_LINHAS, listaPossivelmenteCortada, topPaises } from '../../pages/dashboard/resumoLogic';
import EmptyState from '../ui/EmptyState';

/* "Quem sao os clientes": nota media (de todas as avaliacoes, nao so do periodo) e os paises das
   reservas do periodo. avaliacao: { estado, dados: { total, average } };
   reservas: { estado, dados } (as do periodo); estado: 'loading' | 'ok' | 'erro'. */

/* Nome do pais na lingua do painel; um codigo que o Intl nao entende fica como esta */
export function nomeDoPais(codigo, lang) {
  if (!/^[A-Z]{2}$/.test(codigo)) return codigo;
  try {
    return new Intl.DisplayNames([localeDe(lang)], { type: 'region' }).of(codigo) || codigo;
  } catch {
    return codigo;
  }
}

export default function QuemSaoClientes({ avaliacao, reservas }) {
  const t = useT();
  const lang = useLingua();

  const total = Number(avaliacao?.dados?.total);
  const media = Number(avaliacao?.dados?.average);
  const mostraNota = avaliacao?.estado === 'ok' && total > 0 && Number.isFinite(media);

  const paises = reservas?.estado === 'ok' ? topPaises(reservas.dados) : [];
  const cortada = reservas?.estado === 'ok' && listaPossivelmenteCortada(reservas.dados);

  let blocoPaises;
  if (reservas?.estado === 'loading') {
    blocoPaises = <div className="h-[120px] rounded-lg bg-n-100 animate-pulse" data-testid="resumo-paises-carga" />;
  } else if (reservas?.estado === 'erro') {
    blocoPaises = <EmptyState title={t('dashboard.resumo.customers.countriesError')} />;
  } else if (paises.length === 0) {
    blocoPaises = <EmptyState title={t('dashboard.resumo.customers.countriesEmpty')} />;
  } else {
    blocoPaises = (
      <div className="flex flex-col gap-2.5">
        {paises.map((p) => (
          <div key={p.codigo} className="grid grid-cols-[110px_minmax(0,1fr)_40px] gap-2.5 items-center text-[13px] font-body text-n-900" data-testid="resumo-pais">
            <span className="truncate">{nomeDoPais(p.codigo, lang)}</span>
            <div className="h-2 rounded-full bg-ocean-50 overflow-hidden">
              <div className="h-full rounded-full bg-turquoise-600" style={{ width: `${p.pct}%` }} />
            </div>
            <span className="font-mono text-right">{formatarNumero(p.pct)}%</span>
          </div>
        ))}
        {cortada && <p className="text-xs font-body text-n-500">{t('dashboard.resumo.customers.truncated', { n: formatarNumero(LIMITE_LINHAS) })}</p>}
      </div>
    );
  }

  return (
    <section aria-labelledby="resumo-clientes-titulo" className="bg-white border border-n-200 rounded-2xl p-5 lg:p-[22px] flex flex-col gap-3.5 min-w-0">
      <h2 id="resumo-clientes-titulo" className="font-display font-semibold text-lg text-ocean-900">{t('dashboard.resumo.customers.title')}</h2>
      {mostraNota && (
        <div className="bg-n-50 rounded-xl p-3.5 flex flex-col gap-0.5" data-testid="resumo-nota">
          <span className="font-display font-bold text-[22px] text-ocean-900">
            {formatarNumero(media, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
          </span>
          <span className="text-xs font-body text-n-600">
            {t('dashboard.resumo.customers.rating')} ({total === 1 ? t('dashboard.resumo.customers.reviewsOne') : t('dashboard.resumo.customers.reviews', { n: formatarNumero(total) })})
          </span>
        </div>
      )}
      <h3 className="text-xs font-body font-semibold text-n-600">{t('dashboard.resumo.customers.countries')}</h3>
      {blocoPaises}
    </section>
  );
}
