import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, Calendar, FileText, Award, Users, AlertTriangle } from 'lucide-react';
import { getHrOverview, updateLeaveStatus } from '../services/staffService';
import { useToast } from '../store/toastStore';
import PageHeader from '../components/layout/PageHeader';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import ExpiryBadge from '../components/shared/ExpiryBadge';

const LEAVE_TYPE_LABEL = {
  vacation: 'Ferias', sick: 'Doenca', maternity: 'Licenca maternidade',
  paternity: 'Licenca paternidade', unpaid: 'Sem vencimento', other: 'Outro',
};

function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000) + 1;
}

function StatCard({ Icon, value, label, tone }) {
  return (
    <div className="bg-white border border-n-200 rounded-md p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-md flex items-center justify-center shrink-0 ${tone === 'warn' ? 'bg-amber-50 text-amber-600' : 'bg-ocean-50 text-ocean-700'}`}>
        <Icon size={18} strokeWidth={1.75} />
      </div>
      <div>
        <p className="font-display font-bold text-xl text-n-900">{value}</p>
        <p className="text-xs font-body text-n-500">{label}</p>
      </div>
    </div>
  );
}

export default function RH() {
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getHrOverview());
    } catch {
      toast.error('Erro ao carregar RH');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function changeStatus(staffId, leaveId, status) {
    try {
      await updateLeaveStatus(staffId, leaveId, status);
      toast.success(status === 'approved' ? 'Pedido aprovado' : 'Pedido rejeitado');
      load();
    } catch {
      toast.error('Erro ao actualizar pedido');
    }
  }

  if (loading) return <div className="py-16 flex justify-center"><LoadingSpinner /></div>;

  const pending = data?.pending_leave || [];
  const expiring = data?.expiring || [];
  const staff = data?.staff || [];

  return (
    <div>
      <PageHeader title="RH" subtitle="Ferias, documentos e certificacoes de toda a equipa" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard Icon={Calendar} value={pending.length} label="Pedidos de ferias pendentes" tone={pending.length ? 'warn' : 'ok'} />
        <StatCard Icon={AlertTriangle} value={expiring.length} label="Documentos/certificacoes a expirar" tone={expiring.length ? 'warn' : 'ok'} />
        <StatCard Icon={Users} value={staff.length} label="Colaboradores activos" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section>
          <h3 className="font-display font-semibold text-sm text-n-900 mb-3">Pedidos de ferias pendentes</h3>
          {!pending.length && <p className="text-sm font-body text-n-500">Sem pedidos pendentes.</p>}
          <div className="space-y-2">
            {pending.map(l => (
              <div key={l.id} className="flex items-center justify-between gap-3 bg-white border border-n-200 rounded-md px-4 py-3">
                <div className="min-w-0">
                  <p className="font-body font-semibold text-sm text-n-900 truncate">{l.staff_name}</p>
                  <p className="text-xs font-body text-n-500">
                    {LEAVE_TYPE_LABEL[l.type] || l.type} · {l.start_date} → {l.end_date}
                    <span className="text-n-400"> ({daysBetween(l.start_date, l.end_date)} dias)</span>
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => changeStatus(l.staff_id, l.id, 'approved')} className="text-ocean-700 hover:text-ocean-500" aria-label="Aprovar"><Check size={16} strokeWidth={2} /></button>
                  <button onClick={() => changeStatus(l.staff_id, l.id, 'rejected')} className="text-error hover:opacity-70" aria-label="Rejeitar"><X size={16} strokeWidth={2} /></button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="font-display font-semibold text-sm text-n-900 mb-3">A expirar em breve</h3>
          {!expiring.length && <p className="text-sm font-body text-n-500">Nada a expirar nos proximos 30 dias.</p>}
          <div className="space-y-2">
            {expiring.map(item => (
              <div key={`${item.kind}-${item.id}`} className="flex items-center justify-between gap-3 bg-white border border-n-200 rounded-md px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  {item.kind === 'document' ? <FileText size={16} strokeWidth={1.75} className="text-ocean-700 shrink-0" /> : <Award size={16} strokeWidth={1.75} className="text-sand-600 shrink-0" />}
                  <div className="min-w-0">
                    <p className="font-body font-semibold text-sm text-n-900 truncate">{item.name}</p>
                    <p className="text-xs font-body text-n-500 truncate">{item.staff_name}</p>
                  </div>
                </div>
                <ExpiryBadge date={item.expiry_date} />
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-6">
        <h3 className="font-display font-semibold text-sm text-n-900 mb-3">Colaboradores</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {staff.map(s => (
            <button key={s.id} onClick={() => navigate(`/colaboradores/${s.id}`)}
              className="flex items-center gap-3 bg-white border border-n-200 rounded-md px-4 py-3 text-left hover:border-ocean-300 transition-colors">
              <div className="w-8 h-8 rounded-full bg-ocean-50 text-ocean-700 flex items-center justify-center font-display font-bold text-xs shrink-0">
                {s.name?.charAt(0)?.toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-body font-semibold text-sm text-n-900 truncate">{s.name}</p>
                <p className="text-xs font-body text-n-500 truncate">{s.role}</p>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
