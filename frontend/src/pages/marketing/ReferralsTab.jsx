import { Gift, UserPlus, CheckCircle2 } from 'lucide-react';
import MareStat from '../../components/shared/MareStat';
import Badge from '../../components/ui/Badge';
import Table from '../../components/ui/Table';
import EmptyState from '../../components/ui/EmptyState';
import { useT } from '../../i18n';
import { formatarData, useLingua } from '../../utils/formatoLingua';
import { CopyBtn, valorDoTile, CARTAO, CAIXA, TITULO, NUM } from './shared';

/* variante do Badge por estado da indicacao (desconhecido cai em novo); o rotulo vem de
   marketingPage.referrals.status.<estado> e um estado desconhecido mostra-se tal e qual */
const REFERRAL_STATUS_VARIANT = {
  novo: 'info',
  contactado: 'direct',
  demo_agendada: 'direct',
  proposta_enviada: 'direct',
  convertido: 'confirmed',
  descartado: 'default',
};

/* ── ReferralsTab ── */
export default function ReferralsTab({ referrals, loading }) {
  const t = useT();
  const lang = useLingua();
  const link = referrals?.referral_link || '';
  const list = referrals?.referred || [];

  const columns = [
    { key: 'negocio', label: t('marketingPage.referrals.cols.business'), render: l => <span className="font-body text-n-900">{l.nome_negocio || l.nome}</span> },
    {
      key: 'data', label: t('marketingPage.referrals.cols.date'),
      render: l => (
        <span className="text-xs font-mono tabular-nums text-n-600 whitespace-nowrap">
          {l.created_at ? formatarData(l.created_at, {}, lang) : '—'}
        </span>
      ),
    },
    {
      key: 'estado', label: t('marketingPage.referrals.cols.status'),
      render: l => (
        <Badge variant={REFERRAL_STATUS_VARIANT[l.status] || REFERRAL_STATUS_VARIANT.novo}>
          {REFERRAL_STATUS_VARIANT[l.status] ? t(`marketingPage.referrals.status.${l.status}`) : l.status}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <section className={`${CARTAO} flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-5`}>
        <div className="w-11 h-11 rounded-[14px] bg-sand-100 text-n-800 flex items-center justify-center shrink-0">
          <Gift size={22} strokeWidth={1.75} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={TITULO}>{t('marketingPage.referrals.inviteTitle')}</h3>
          <p className="text-sm font-body text-n-600 mt-0.5">
            {t('marketingPage.referrals.inviteText')}
          </p>
        </div>
      </section>

      <section className={CARTAO}>
        <p className="text-xs font-body font-bold uppercase tracking-wide text-n-600 mb-2">{t('marketingPage.referrals.yourLink')}</p>
        <div className="flex items-center gap-3 flex-wrap">
          <div className={`${CAIXA} flex-1`}>
            <p className={`${NUM} text-xs text-n-700 break-all`}>{link || '...'}</p>
          </div>
          <CopyBtn text={link} />
        </div>
      </section>

      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-4">
        <MareStat icon={UserPlus} label={t('marketingPage.referrals.sent')} value={valorDoTile(referrals?.total ?? 0, loading)} />
        <MareStat icon={CheckCircle2} label={t('marketingPage.referrals.converted')} value={valorDoTile(referrals?.convertidos ?? 0, loading)} />
      </div>

      <section className={CARTAO}>
        <h3 className={`${TITULO} mb-3`}>{t('marketingPage.referrals.yours', { n: list.length })}</h3>
        {list.length === 0 ? (
          <EmptyState icon={UserPlus} title={t('marketingPage.referrals.none')} />
        ) : (
          <div className="overflow-x-auto">
            <Table columns={columns} rows={list} />
          </div>
        )}
      </section>
    </div>
  );
}
