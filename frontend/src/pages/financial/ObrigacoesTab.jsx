import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Plus,
  Trash2,
} from 'lucide-react';
import { getObligations, setObligations } from '../../services/expensesService';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input, { Textarea, Select } from '../../components/ui/Input';
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
      <div className={`flex items-center gap-3 px-3 py-2.5 rounded-sm border ${isCritical ? 'bg-[var(--warning-light)] border-[var(--warning)]' : 'bg-n-50 border-n-100'}`}>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-body font-semibold text-n-800">{ins.name}</p>
          <p className="text-[10px] font-mono text-n-400">{renewal ? `Renovacao: ${fmtDate(ins.renewal_date)}${isCritical ? ` (${daysToRenew}d)` : ''}` : 'Sem data'}</p>
        </div>
        <span className="text-xs font-body text-n-600 shrink-0">{ins.amount_annual ? `€${ins.amount_annual}/ano` : '—'}</span>
        {isCritical && <AlertTriangle size={14} strokeWidth={1.75} className="text-[var(--warning)] shrink-0" />}
        <button aria-label={`Remover seguro - ${ins.name}`} onClick={() => { const list = (obl.insurances || []).filter((_, i) => i !== idx); saveObl({ ...obl, insurances: list }); }} className="p-1 text-n-400 hover:text-[var(--error)] transition-colors"><Trash2 size={12} strokeWidth={1.75} /></button>
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
          {daysToInps <= 5 && daysToInps > 0 && <span className="flex items-center gap-1 text-xs font-mono text-[var(--error)] bg-[var(--error-light)] px-2 py-0.5 rounded-xs"><AlertTriangle size={10} strokeWidth={2} />Prazo em {daysToInps}d</span>}
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
          <div className="w-56">
            <Select aria-label="Estado do INPS" value={obl.inps_status_current || 'pending'} onChange={e => saveObl({ ...obl, inps_status_current: e.target.value })}>
              <option value="pending">Pendente este mes</option>
              <option value="paid">Pago este mes</option>
            </Select>
          </div>
        </div>
      </Card>

      {/* IUR */}
      <Card padding="px-5 py-4">
        <h3 className="font-display font-semibold text-sm text-n-700 mb-3">IUR — Imposto Unico sobre Rendimentos</h3>
        <p className="text-xs font-body text-n-500 mb-3">Retenção na fonte mensal sobre salarios. Declaracao anual em Abril.</p>
        <Textarea
          aria-label="Notas sobre IUR"
          value={obl.iur_notes || ''}
          onChange={e => saveObl({ ...obl, iur_notes: e.target.value })}
          placeholder="Notas sobre IUR, valores estimados, contabilista responsavel..."
          rows={3}
        />
      </Card>

      {/* Seguros */}
      <Card padding="px-5 py-4">
        <h3 className="font-display font-semibold text-sm text-n-700 mb-3">Seguros</h3>
        <div className="space-y-2 mb-3">
          {(obl.insurances || []).map((ins, i) => <Insurance key={i} ins={ins} idx={i} />)}
          {(obl.insurances || []).length === 0 && <p className="text-xs font-body text-n-400">Sem seguros registados.</p>}
        </div>
        <div className="grid grid-cols-3 gap-2 items-end">
          <Input aria-label="Nome do seguro" value={newIns.name} onChange={e => setNewIns(p => ({ ...p, name: e.target.value }))} placeholder="Nome do seguro" />
          <Input aria-label="Data de renovacao do seguro" type="date" value={newIns.renewal_date} onChange={e => setNewIns(p => ({ ...p, renewal_date: e.target.value }))} />
          <div className="flex gap-1 items-end">
            <div className="flex-1">
              <Input aria-label="Valor anual do seguro" type="number" value={newIns.amount_annual} onChange={e => setNewIns(p => ({ ...p, amount_annual: e.target.value }))} placeholder="€/ano" className="font-mono" />
            </div>
            <Button aria-label="Adicionar seguro" icon={Plus} onClick={() => { if (!newIns.name) return; saveObl({ ...obl, insurances: [...(obl.insurances || []), { ...newIns, amount_annual: Number(newIns.amount_annual) }] }); setNewIns({ name: '', renewal_date: '', amount_annual: '' }); }} />
          </div>
        </div>
      </Card>

      {/* SalDesk */}
      <Card padding="px-5 py-4">
        <h3 className="font-display font-semibold text-sm text-n-700 mb-3">Subscricao SalDesk</h3>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Plano actual" aria-label="Plano actual" value={obl.saldesk_plan || 'starter'} onChange={e => saveObl({ ...obl, saldesk_plan: e.target.value })}>
            <option value="starter">Starter — €29/mes</option>
            <option value="pro">Pro — €69/mes</option>
            <option value="business">Business — €79/mes</option>
          </Select>
          <Input label="Data de renovacao" aria-label="Data de renovacao" type="date" value={obl.saldesk_renewal || ''} onChange={e => saveObl({ ...obl, saldesk_renewal: e.target.value })} />
        </div>
      </Card>
    </div>
  );
}

export default ObrigacoesTab;
