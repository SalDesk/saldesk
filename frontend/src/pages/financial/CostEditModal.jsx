import { useState, useEffect } from 'react';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { COST_FIELDS } from './shared';

function CostEditModal({ open, onClose, unitId, unitName, costs, onSave }) {
  const [fields, setFields] = useState({ guide: 0, transport: 0, tickets: 0, meals: 0, other: 0 });
  useEffect(() => { if (open) setFields(costs || { guide: 0, transport: 0, tickets: 0, meals: 0, other: 0 }); }, [open, costs]);
  const total = COST_FIELDS.reduce((s, f) => s + Number(fields[f.key] || 0), 0);
  return (
    <Modal open={open} onClose={onClose} title={`Custos — ${unitName}`} size="sm">
      <div className="space-y-3">
        {COST_FIELDS.map(f => (
          <div key={f.key} className="flex items-center gap-3">
            <label className="text-xs font-body text-n-600 w-36 shrink-0">{f.label}</label>
            <div className="flex items-center gap-1 flex-1">
              <span className="text-xs font-mono text-n-400">€</span>
              <input type="number" min="0" step="0.01" value={fields[f.key]}
                onChange={e => setFields(p => ({ ...p, [f.key]: e.target.value }))}
                className="flex-1 h-8 px-2 text-sm font-mono border border-n-200 rounded focus:outline-none focus:border-ocean-700" />
            </div>
          </div>
        ))}
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
