import { useState, useEffect } from 'react';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import { COST_FIELDS } from './shared';

/* ─────────────────── RECEITAS TAB COMPONENTS ─────────────────── */

function CostEditModal({ open, onClose, unitId, unitName, costs, onSave }) {
  const [fields, setFields] = useState({ guide: 0, transport: 0, tickets: 0, meals: 0, other: 0 });
  useEffect(() => { if (open) setFields(costs || { guide: 0, transport: 0, tickets: 0, meals: 0, other: 0 }); }, [open, costs]);
  const total = COST_FIELDS.reduce((s, f) => s + Number(fields[f.key] || 0), 0);
  return (
    <Modal open={open} onClose={onClose} title={`Custos — ${unitName}`} size="sm">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {COST_FIELDS.map(f => (
            <Input key={f.key} label={f.label} aria-label={f.label} type="number" min="0" step="0.01" value={fields[f.key]}
              onChange={e => setFields(p => ({ ...p, [f.key]: e.target.value }))}
              className="font-mono" />
          ))}
        </div>
        <div className="pt-2 border-t border-n-100 flex items-center justify-between">
          <span className="text-xs font-body text-n-500">Total custo operacional</span>
          <span className="font-display font-bold text-n-800">€{total.toFixed(2)}</span>
        </div>
        <div className="flex gap-3 pt-1">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button onClick={() => { onSave(unitId, fields); onClose(); }} className="flex-1">Guardar</Button>
        </div>
      </div>
    </Modal>
  );
}

export default CostEditModal;
