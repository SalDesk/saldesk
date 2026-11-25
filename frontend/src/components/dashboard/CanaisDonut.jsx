import { useT } from '../../i18n';
import { formatarNumero, useLingua } from '../../utils/formatoLingua';
import { rotuloOrigem } from '../../pages/reservations/shared';
import { fatiasCanais, quotaDirectas } from '../../pages/dashboard/resumoLogic';
import EmptyState from '../ui/EmptyState';

/* "De onde vem as reservas": donut por canal (tamanho = numero de reservas), legenda e a quota de
   directas ao centro. canais: [{ source, num_reservas, receita }] de /financial/canais;
   estado: 'loading' | 'ok' | 'erro'. */

const RAIO = 62;
const CIRCUNFERENCIA = 2 * Math.PI * RAIO;

/* Classes literais (o Tailwind so gera o que le por extenso) */
const CORES = [
  { stroke: 'stroke-ocean-900', bg: 'bg-ocean-900' },
  { stroke: 'stroke-ocean-500', bg: 'bg-ocean-500' },
  { stroke: 'stroke-ocean-300', bg: 'bg-ocean-300' },
  { stroke: 'stroke-sand-500', bg: 'bg-sand-500' },
  { stroke: 'stroke-turquoise-600', bg: 'bg-turquoise-600' },
];

export default function CanaisDonut({ canais, estado }) {
  const t = useT();
  useLingua();
  const fatias = fatiasCanais(canais);
  const directas = quotaDirectas(canais);
  const nome = (f) => (f.outros ? t('dashboard.resumo.channels.others') : rotuloOrigem(f.source, t));

  const totalReservas = fatias.reduce((s, x) => s + x.num, 0);
  let acumulado = 0;
  const arcos = fatias.map((f, i) => {
    const comprimento = (f.num / totalReservas) * CIRCUNFERENCIA;
    const arco = { ...f, cor: CORES[i % CORES.length], comprimento, deslocamento: -acumulado };
    acumulado += comprimento;
    return arco;
  });

  const descricao = t('dashboard.resumo.channels.aria', {
    lista: fatias.map((f) => t('dashboard.resumo.channels.ariaItem', { name: nome(f), pct: formatarNumero(f.pct) })).join(', '),
  }) + (directas === null ? '' : ` ${t('dashboard.resumo.channels.ariaDirect', { pct: formatarNumero(directas) })}.`);

  let corpo;
  if (estado === 'loading') {
    corpo = <div className="h-[168px] rounded-lg bg-n-100 animate-pulse" data-testid="resumo-canais-carga" />;
  } else if (estado === 'erro') {
    corpo = <EmptyState title={t('dashboard.resumo.channels.error')} />;
  } else if (fatias.length === 0) {
    corpo = <EmptyState title={t('dashboard.resumo.channels.empty')} />;
  } else {
    corpo = (
      <>
        <div className="flex flex-wrap items-center gap-5">
          <div className="relative w-[168px] h-[168px] shrink-0">
            <svg width="168" height="168" viewBox="0 0 168 168" role="img" aria-label={descricao} data-testid="resumo-canais-donut">
              <circle cx="84" cy="84" r={RAIO} fill="none" strokeWidth="22" className="stroke-n-100" />
              {arcos.map((a) => (
                <circle
                  key={a.source ?? 'outros'}
                  cx="84"
                  cy="84"
                  r={RAIO}
                  fill="none"
                  strokeWidth="22"
                  className={a.cor.stroke}
                  strokeDasharray={`${a.comprimento} ${CIRCUNFERENCIA - a.comprimento}`}
                  strokeDashoffset={a.deslocamento}
                  transform="rotate(-90 84 84)"
                />
              ))}
            </svg>
            {directas !== null && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="font-display font-bold text-2xl text-ocean-900" data-testid="resumo-canais-directas">{formatarNumero(directas)}%</span>
                <span className="text-xs font-body text-n-600">{t('dashboard.resumo.channels.centerLabel')}</span>
              </div>
            )}
          </div>
          <ul className="flex-1 basis-[140px] min-w-0 flex flex-col gap-2.5">
            {arcos.map((a) => (
              <li key={a.source ?? 'outros'} className="grid grid-cols-[12px_minmax(0,1fr)_auto] gap-2.5 items-center text-sm font-body text-n-900">
                <span className={`w-3 h-3 rounded-[3px] ${a.cor.bg}`} aria-hidden="true" />
                <span className="truncate">{nome(a)}</span>
                <span className="font-mono text-n-700">{formatarNumero(a.pct)}%</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-[13px] font-body text-n-600 leading-snug">{t('dashboard.resumo.channels.note')}</p>
      </>
    );
  }

  return (
    <section aria-labelledby="resumo-canais-titulo" className="bg-white border border-n-200 rounded-2xl p-5 lg:p-[22px] flex flex-col gap-4 min-w-0">
      <h2 id="resumo-canais-titulo" className="font-display font-semibold text-lg text-ocean-900">{t('dashboard.resumo.channels.title')}</h2>
      {corpo}
    </section>
  );
}
