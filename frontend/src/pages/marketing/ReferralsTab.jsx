import { Gift, UserPlus, CheckCircle2 } from 'lucide-react';
import { CopyBtn, KpiCard } from './shared';

const REFERRAL_STATUS_LABEL = {
  novo: 'Novo', contactado: 'Contactado', demo_agendada: 'Demo agendada',
  proposta_enviada: 'Proposta enviada', convertido: 'Convertido', descartado: 'Descartado',
};
const REFERRAL_STATUS_CLS = {
  novo: 'bg-ocean-50 text-ocean-700 border-ocean-100',
  contactado: 'bg-sand-50 text-sand-600 border-sand-100',
  demo_agendada: 'bg-sand-50 text-sand-600 border-sand-100',
  proposta_enviada: 'bg-sand-50 text-sand-600 border-sand-100',
  convertido: 'bg-[#ECFDF5] text-[#1A7A4A] border-[#BBF7D0]',
  descartado: 'bg-n-100 text-n-500 border-n-200',
};

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

      <div className="bg-white rounded-md border border-n-200 p-5">
        <p className="text-xs font-body font-bold uppercase tracking-wide text-n-600 mb-2">O seu link de indicacao</p>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="bg-n-50 border border-n-200 rounded-sm px-3 py-2 flex-1 min-w-0">
            <p className="text-xs font-mono text-n-700 truncate">{link || '...'}</p>
          </div>
          <CopyBtn text={link} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <KpiCard icon={UserPlus} label="Indicacoes enviadas" value={referrals?.total ?? 0} loading={loading} />
        <KpiCard icon={CheckCircle2} label="Convertidas" value={referrals?.convertidos ?? 0} loading={loading} />
      </div>

      <div>
        <p className="text-xs font-mono uppercase tracking-wider text-n-500 mb-3">As suas indicacoes ({list.length})</p>
        {list.length === 0 ? (
          <div className="bg-white rounded-md border border-n-200 flex flex-col items-center py-10 text-n-400">
            <UserPlus size={28} strokeWidth={1.25} className="mb-2" />
            <p className="text-xs font-body text-center">Ainda nao indicou nenhum operador.</p>
          </div>
        ) : (
          <div className="bg-white rounded-md border border-n-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-n-200 bg-n-50">
                  {['Negocio', 'Data', 'Estado'].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-mono uppercase tracking-wider text-n-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-n-100">
                {list.map(l => (
                  <tr key={l.id} className="hover:bg-n-50">
                    <td className="px-4 py-2.5 text-sm font-body text-n-900">{l.nome_negocio || l.nome}</td>
                    <td className="px-4 py-2.5 text-xs font-mono text-n-600 whitespace-nowrap">
                      {l.created_at ? new Date(l.created_at).toLocaleDateString('pt-PT') : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs font-mono px-2 py-0.5 rounded-xs border uppercase tracking-wide ${REFERRAL_STATUS_CLS[l.status] || REFERRAL_STATUS_CLS.novo}`}>
                        {REFERRAL_STATUS_LABEL[l.status] || l.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
