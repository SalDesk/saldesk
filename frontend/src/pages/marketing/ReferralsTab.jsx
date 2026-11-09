import { Gift, UserPlus, CheckCircle2 } from 'lucide-react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Table from '../../components/ui/Table';
import EmptyState from '../../components/ui/EmptyState';
import { CopyBtn, KpiCard } from './shared';

const REFERRAL_STATUS_LABEL = {
  novo: 'Novo', contactado: 'Contactado', demo_agendada: 'Demo agendada',
  proposta_enviada: 'Proposta enviada', convertido: 'Convertido', descartado: 'Descartado',
};
/* variante do Badge por estado da indicacao (desconhecido cai em novo) */
const REFERRAL_STATUS_VARIANT = {
  novo: 'info',
  contactado: 'direct',
  demo_agendada: 'direct',
  proposta_enviada: 'direct',
  convertido: 'confirmed',
  descartado: 'default',
};

const REFERRAL_COLUMNS = [
  { key: 'negocio', label: 'Negocio', render: l => <span className="font-body text-n-900">{l.nome_negocio || l.nome}</span> },
  {
    key: 'data', label: 'Data',
    render: l => (
      <span className="text-xs font-mono text-n-600 whitespace-nowrap">
        {l.created_at ? new Date(l.created_at).toLocaleDateString('pt-PT') : '—'}
      </span>
    ),
  },
  {
    key: 'estado', label: 'Estado',
    render: l => (
      <Badge variant={REFERRAL_STATUS_VARIANT[l.status] || REFERRAL_STATUS_VARIANT.novo}>
        {REFERRAL_STATUS_LABEL[l.status] || l.status}
      </Badge>
    ),
  },
];

/* ── ReferralsTab ── */
export default function ReferralsTab({ referrals, loading }) {
  const link = referrals?.referral_link || '';
  const list = referrals?.referred || [];

  return (
    <div className="space-y-5">
      <div className="bg-ocean-900 rounded-md p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
        <div className="w-11 h-11 rounded-sm bg-white/10 flex items-center justify-center shrink-0">
          <Gift size={22} strokeWidth={1.75} className="text-sand-300" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-semibold text-sm text-white">Indique outro operador</h3>
          <p className="text-xs font-body text-white/60 mt-0.5">
            Partilhe o seu link — quando um negócio indicado por si aderir à SalDesk, fale connosco para receber a sua recompensa.
          </p>
        </div>
      </div>

      <Card padding="p-5">
        <p className="text-xs font-body font-bold uppercase tracking-wide text-n-600 mb-2">O seu link de indicacao</p>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="bg-n-50 border border-n-200 rounded-sm px-3 py-2 flex-1 min-w-0">
            <p className="text-xs font-mono text-n-700 truncate">{link || '...'}</p>
          </div>
          <CopyBtn text={link} />
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <KpiCard icon={UserPlus} label="Indicacoes enviadas" value={referrals?.total ?? 0} loading={loading} />
        <KpiCard icon={CheckCircle2} label="Convertidas" value={referrals?.convertidos ?? 0} loading={loading} />
      </div>

      <div>
        <p className="text-xs font-mono uppercase tracking-wider text-n-500 mb-3">As suas indicacoes ({list.length})</p>
        {list.length === 0 ? (
          <Card padding="p-0">
            <EmptyState icon={UserPlus} title="Ainda nao indicou nenhum operador." />
          </Card>
        ) : (
          <Card padding="p-0">
            <Table columns={REFERRAL_COLUMNS} rows={list} />
          </Card>
        )}
      </div>
    </div>
  );
}
