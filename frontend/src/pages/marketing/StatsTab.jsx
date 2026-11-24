import { Eye, MousePointerClick, TrendingUp, BarChart2, ExternalLink } from 'lucide-react';
import Card from '../../components/ui/Card';
import { useT } from '../../i18n';
import { nomeMes } from '../../components/calendar/rotulosCalendario';
import { CopyBtn, KpiCard, postDateKey } from './shared';

/* Origens com nome de marca (iguais em todas as linguas); as outras vem de marketingPage.stats.sources e
   uma origem desconhecida mostra-se tal e qual */
const SRC_MARCA = { booking_com: 'Booking', airbnb: 'Airbnb', viator: 'Viator', getyourguide: 'GYG' };
const SRC_TRADUZIDAS = { direct: 'direct', public: 'direct', manual: 'manual', social: 'social' };

function rotuloOrigemMarketing(src, t) {
  if (SRC_MARCA[src]) return SRC_MARCA[src];
  if (SRC_TRADUZIDAS[src]) return t(`marketingPage.stats.sources.${SRC_TRADUZIDAS[src]}`);
  return src;
}

/* ── StatsTab ── */
export default function StatsTab({ stats, statsLoading, posts, bookingLink }) {
  const t = useT();
  const now = new Date();
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const postsThisMonth = posts.filter(p => postDateKey(p).startsWith(monthStr));
  const agendados  = postsThisMonth.filter(p => p.status === 'agendado').length;
  const publicados = postsThisMonth.filter(p => p.status === 'publicado').length;
  const cancelados = postsThisMonth.filter(p => p.status === 'cancelado').length;

  const sources = stats?.sources
    ? Object.entries(stats.sources).sort((a, b) => b[1] - a[1])
    : null;
  const maxSource = sources ? Math.max(...sources.map(([, v]) => v), 1) : 1;

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Eye}             label={t('marketingPage.stats.visits')}  value={stats?.profile_views ?? 0} sub={t('marketingPage.stats.last30')}  loading={statsLoading} />
        <KpiCard icon={MousePointerClick} label={t('marketingPage.stats.clicks')}  value={stats?.clicks ?? 0}        sub={t('marketingPage.stats.last30')}  loading={statsLoading} />
        <KpiCard icon={TrendingUp}      label={t('marketingPage.stats.bookings')}  value={stats?.bookings_direct ?? 0} sub={t('marketingPage.stats.last30')} loading={statsLoading} />
        <KpiCard icon={BarChart2}       label={t('marketingPage.stats.conversion')}  value={stats ? `${stats.conversion_rate ?? 0}%` : null} sub={t('marketingPage.stats.clicksToBookings')} loading={statsLoading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Posts this month */}
        <Card padding="p-5">
          <h3 className="font-display font-semibold text-sm text-n-700 mb-4">{t('marketingPage.stats.postsTitle', { month: nomeMes(now.getMonth(), t) })}</h3>
          <div className="flex gap-6">
            <div>
              <p className="font-display font-bold text-3xl text-n-900">{postsThisMonth.length}</p>
              <p className="text-xs font-body text-n-500 mt-0.5">{t('marketingPage.stats.total')}</p>
            </div>
            <div>
              <p className="font-display font-bold text-3xl text-[var(--success)]">{publicados}</p>
              <p className="text-xs font-body text-n-500 mt-0.5">{t('marketingPage.stats.published')}</p>
            </div>
            <div>
              <p className="font-display font-bold text-3xl text-ocean-500">{agendados}</p>
              <p className="text-xs font-body text-n-500 mt-0.5">{t('marketingPage.stats.scheduled')}</p>
            </div>
            {cancelados > 0 && (
              <div>
                <p className="font-display font-bold text-3xl text-[var(--error)]">{cancelados}</p>
                <p className="text-xs font-body text-n-500 mt-0.5">{t('marketingPage.stats.cancelled')}</p>
              </div>
            )}
          </div>
        </Card>

        {/* Origin */}
        <Card padding="p-5">
          <h3 className="font-display font-semibold text-sm text-n-700 mb-4">{t('marketingPage.stats.origin')}</h3>
          {sources ? (
            <div className="space-y-2.5">
              {sources.map(([src, count]) => (
                <div key={src} className="flex items-center gap-3">
                  <span className="text-xs font-mono text-n-500 w-20 shrink-0">{rotuloOrigemMarketing(src, t)}</span>
                  <div className="flex-1 h-2 bg-n-100 rounded-full overflow-hidden">
                    <div className="h-full bg-ocean-500 rounded-full transition-all" style={{ width: `${(count / maxSource) * 100}%` }} />
                  </div>
                  <span className="text-xs font-mono font-semibold text-n-700 w-8 text-right shrink-0">{count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs font-body text-n-400">
              {t('marketingPage.stats.noSourcesA')} <span className="font-mono">/marketing/stats</span> {t('marketingPage.stats.noSourcesB')} <span className="font-mono">sources</span>.
            </p>
          )}
        </Card>
      </div>

      {/* Booking link */}
      {bookingLink && (
        <Card padding="p-5">
          <h3 className="font-display font-semibold text-sm text-n-700 mb-3">{t('marketingPage.stats.bookingLink')}</h3>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="bg-n-50 border border-n-200 rounded-sm px-3 py-2 flex-1 min-w-0">
              <p className="text-xs font-mono text-n-700 truncate">{bookingLink}</p>
            </div>
            <CopyBtn text={bookingLink} />
            <a href={bookingLink} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-sm bg-n-100 text-n-700 font-body hover:bg-n-200 transition-colors">
              <ExternalLink size={14} strokeWidth={1.75} />{t('marketingPage.stats.open')}
            </a>
          </div>
        </Card>
      )}
    </div>
  );
}
