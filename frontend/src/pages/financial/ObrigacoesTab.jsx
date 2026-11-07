import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Plus,
  Trash2,
} from 'lucide-react';
import { getObligations, setObligations } from '../../services/expensesService';
import Card from '../../components/ui/Card';
import Input, { Select } from '../../components/ui/Input';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import { fmtDate } from './shared';

/* ─────────────────── OBRIGACOES ─────────────────── */

function ObrigacoesTab({ currency }) {
  const [obl, setObl] = useState({});
  const [loading, setLoading] = useState(true);
  const now  = new Date();
  const day  = now.getDate();
  const inpsDue = new Date(now.getFullYear(), now.getMonth(), 15);
  const daysToInps = Math.ceil((inpsDue - now) / (1000 * 60 * 60 * 24));

  useEffect(() => { getObligations().then(setObl).finally(() => setLoading(false)); }, []);

  function saveObl(next) { setObl(next); setObligations(next).catch(() => {}); }

  function Insurance({ ins, idx }) {
    const renewal = ins.renewal_date ? new Date(ins.renewal_date + 'T00:00:00Z') : null;
    const daysToRenew = renewal ? Math.ceil((renewal - now) / (1000 * 60 * 60 * 24)) : null;
    const isCritical = daysToRenew != null && daysToRenew <= 30;
    return (
      <div className={`flex items-center gap-3 px-3 py-2.5 rounded-sm border ${isCritical ? 'bg-yellow-50 border-yellow-200' : 'bg-n-50 border-n-100'}`}>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-body font-semibold text-n-800">{ins.name}</p>
          <p className="text-[10px] font-mono text-n-400">{renewal ? `Renovacao: ${fmtDate(ins.renewal_date)}${isCritical ? ` (${daysToRenew}d)` : ''}` : 'Sem data'}</p>
        </div>
        <span className="text-xs font-body text-n-600 shrink-0">{ins.amount_annual ? `€${ins.amount_annual}/ano` : '—'}</span>
        {isCritical && <AlertTriangle size={14} strokeWidth={1.75} className="text-yellow-600 shrink-0" />}
        <button onClick={() => { const list = (obl.insurances || []).filter((_, i) => i !== idx); saveObl({ ...obl, insurances: list }); }} className="p-1 text-n-400 hover:text-error transition-colors"><Trash2 size={12} strokeWidth={1.75} /></button>
      </div>
    );
  }

  const [newIns, setNewIns] = useState({ name: '', renewal_date: '', amount_annual: '' });

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner size={32} /></div>;

  return (
    <div className="space-y-5 max-w-2xl">
      {/* INPS */}
      <Card padding="px-5 py-4">
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-display font-semibold text-sm text-n-700">INPS — Contribuicoes mensais</h3>
          {daysToInps <= 5 && daysToInps > 0 && <span className="flex items-center gap-1 text-xs font-mono text-error bg-red-50 px-2 py-0.5 rounded-xs"><AlertTriangle size={10} strokeWidth={2} />Prazo em {daysToInps}d</span>}
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="font-body text-n-600">Data de entrega</span>
            <span className="font-mono text-n-800">Dia 15 de cada mes</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="font-body text-n-600">Contribuicao patronal</span>
            <span className="font-mono text-n-800">15% dos salarios brutos</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="font-body text-n-600">Contribuicao do trabalhador</span>
            <span className="font-mono text-n-800">8% dos salarios brutos</span>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-n-100">
          <select
            value={obl.inps_status_current || 'pending'}
            onChange={e => saveObl({ ...obl, inps_status_current: e.target.value })}
            className="h-8 px-2 text-xs font-body border border-n-200 rounded bg-white focus:outline-none">
            <option value="pending">Pendente este mes</option>
            <option value="paid">Pago este mes</option>
          </select>
        </div>
      </Card>

      {/* IUR */}
      <Card padding="px-5 py-4">
        <h3 className="font-display font-semibold text-sm text-n-700 mb-3">IUR — Imposto Unico sobre Rendimentos</h3>
        <p className="text-xs font-body text-n-500 mb-3">Retenção na fonte mensal sobre salarios. Declaracao anual em Abril.</p>
        <textarea
          value={obl.iur_notes || ''}
          onChange={e => saveObl({ ...obl, iur_notes: e.target.value })}
          placeholder="Notas sobre IUR, valores estimados, contabilista responsavel..."
          rows={3}
          className="w-full px-3 py-2 text-sm font-body border border-n-200 rounded-sm bg-n-50 focus:outline-none focus:border-ocean-700 resize-none"
        />
      </Card>

      {/* Seguros */}
      <Card padding="px-5 py-4">
        <h3 className="font-display font-semibold text-sm text-n-700 mb-3">Seguros</h3>
        <div className="space-y-2 mb-3">
          {(obl.insurances || []).map((ins, i) => <Insurance key={i} ins={ins} idx={i} />)}
          {(obl.insurances || []).length === 0 && <p className="text-xs font-body text-n-400">Sem seguros registados.</p>}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <input value={newIns.name} onChange={e => setNewIns(p => ({ ...p, name: e.target.value }))} placeholder="Nome do seguro" className="h-8 px-2 text-xs font-body border border-n-200 rounded bg-n-50 focus:outline-none focus:border-ocean-700" />
          <input type="date" value={newIns.renewal_date} onChange={e => setNewIns(p => ({ ...p, renewal_date: e.target.value }))} className="h-8 px-2 text-xs font-body border border-n-200 rounded bg-n-50 focus:outline-none focus:border-ocean-700" />
          <div className="flex gap-1">
            <input type="number" value={newIns.amount_annual} onChange={e => setNewIns(p => ({ ...p, amount_annual: e.target.value }))} placeholder="€/ano" className="flex-1 h-8 px-2 text-xs font-mono border border-n-200 rounded bg-n-50 focus:outline-none focus:border-ocean-700" />
            <button onClick={() => { if (!newIns.name) return; saveObl({ ...obl, insurances: [...(obl.insurances || []), { ...newIns, amount_annual: Number(newIns.amount_annual) }] }); setNewIns({ name: '', renewal_date: '', amount_annual: '' }); }} className="h-8 w-8 flex items-center justify-center bg-ocean-700 text-white rounded hover:bg-ocean-800 transition-colors"><Plus size={14} strokeWidth={2} /></button>
          </div>
        </div>
      </Card>

      {/* SalDesk */}
      <Card padding="px-5 py-4">
        <h3 className="font-display font-semibold text-sm text-n-700 mb-3">Subscricao SalDesk</h3>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Plano actual" value={obl.saldesk_plan || 'starter'} onChange={e => saveObl({ ...obl, saldesk_plan: e.target.value })}>
            <option value="starter">Starter — €29/mes</option>
            <option value="pro">Pro — €69/mes</option>
            <option value="business">Business — €79/mes</option>
          </Select>
          <Input label="Data de renovacao" type="date" value={obl.saldesk_renewal || ''} onChange={e => saveObl({ ...obl, saldesk_renewal: e.target.value })} />
        </div>
      </Card>
    </div>
  );
}

export default ObrigacoesTab;
