import { useState, useEffect } from 'react';
import { Car, MoveRight } from 'lucide-react';
import { updateReservation, changeStatus } from '../../services/reservationsService';
import Modal from '../../components/ui/Modal';
import { parseRentacarMeta, FuelSelector } from './shared';

export default function LevantamentoModal({ reservation, units, open, onClose, onDone }) {
  const unit = units.find(u => u.id === reservation?.unit_id);
  const prevMeta = parseRentacarMeta(reservation);

  const [form, setForm] = useState({
    fuel_out:    prevMeta.fuel_out    ?? 4,
    km_out:      prevMeta.km_out      != null ? String(prevMeta.km_out) : '',
    damages_out: prevMeta.damages_out || '',
    caucao:      prevMeta.caucao      != null ? String(prevMeta.caucao) : '',
    caucao_paid: prevMeta.caucao_paid ?? false,
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (reservation) {
      const m = parseRentacarMeta(reservation);
      setForm({
        fuel_out:    m.fuel_out    ?? 4,
        km_out:      m.km_out      != null ? String(m.km_out) : '',
        damages_out: m.damages_out || '',
        caucao:      m.caucao      != null ? String(m.caucao) : '',
        caucao_paid: m.caucao_paid ?? false,
      });
    }
  }, [reservation]);

  async function handleSave() {
    if (!reservation) return;
    setSaving(true);
    try {
      let prevInternal = {};
      try { prevInternal = JSON.parse(reservation.notes_internal || '{}'); } catch {}
      const rentacarData = { ...parseRentacarMeta(reservation), ...form, km_out: form.km_out ? Number(form.km_out) : null };
      await updateReservation(reservation.id, {
        notes_internal: JSON.stringify({ ...prevInternal, rentacar: rentacarData }),
      });
      await changeStatus(reservation.id, 'checked_in');
      onDone();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  let unitMeta = {};
  try { unitMeta = JSON.parse(unit?.description || '{}'); } catch {}

  return (
    <Modal open={open} onClose={onClose} title="Levantamento de viatura" size="sm" footer={null}>
      <div className="space-y-5">
        <div className="flex items-center gap-3 p-3 bg-n-50 rounded-md border border-n-200">
          <Car size={16} strokeWidth={1.75} className="text-ocean-700 shrink-0" />
          <div>
            <p className="font-display font-semibold text-sm text-n-900">
              {unitMeta.brand ? `${unitMeta.brand} ${unitMeta.model || ''}`.trim() : unit?.name || '—'}
            </p>
            {unitMeta.plate && <p className="text-xs font-mono text-n-400">{unitMeta.plate}</p>}
          </div>
          <div className="ml-auto text-right">
            <p className="font-display font-semibold text-sm text-n-900">{reservation?.customer_name || '—'}</p>
            <p className="text-xs font-body text-n-400">{reservation?.check_in} → {reservation?.check_out}</p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-mono text-n-500 uppercase tracking-wide mb-2">Nivel combustivel (saida)</label>
          <FuelSelector value={form.fuel_out} onChange={v => set('fuel_out', v)} />
        </div>

        <div>
          <label className="block text-xs font-mono text-n-500 uppercase tracking-wide mb-1.5">Km na saida</label>
          <input type="number" value={form.km_out} onChange={e => set('km_out', e.target.value)} placeholder="0"
            className="w-full h-9 rounded-md border border-n-200 bg-n-50 px-3 text-sm font-body text-n-900 focus:outline-none focus:ring-2 focus:ring-ocean-700" />
        </div>

        <div>
          <label className="block text-xs font-mono text-n-500 uppercase tracking-wide mb-1.5">Danos existentes (registo)</label>
          <textarea value={form.damages_out} onChange={e => set('damages_out', e.target.value)} rows={2}
            placeholder="Descrever danos pre-existentes..."
            className="w-full rounded-md border border-n-200 bg-n-50 px-3 py-2 text-sm font-body text-n-900 focus:outline-none focus:ring-2 focus:ring-ocean-700 resize-none" />
        </div>

        <div>
          <label className="block text-xs font-mono text-n-500 uppercase tracking-wide mb-1.5">Caucao (€)</label>
          <div className="flex gap-3">
            <input type="number" value={form.caucao} onChange={e => set('caucao', e.target.value)} placeholder="0.00" step="0.01"
              className="flex-1 h-9 rounded-md border border-n-200 bg-n-50 px-3 text-sm font-body text-n-900 focus:outline-none focus:ring-2 focus:ring-ocean-700" />
            <label className="flex items-center gap-2 text-sm font-body text-n-700 cursor-pointer">
              <input type="checkbox" checked={form.caucao_paid} onChange={e => set('caucao_paid', e.target.checked)} className="w-4 h-4 accent-ocean-700" />
              Paga
            </label>
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="flex-1 h-9 rounded-md border border-n-200 text-sm font-body text-n-700 hover:bg-n-50 transition-colors">Cancelar</button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="flex-1 h-9 rounded-md bg-ocean-700 text-white text-sm font-body font-medium hover:bg-ocean-500 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60">
            <MoveRight size={13} strokeWidth={1.75} />
            {saving ? 'A processar...' : 'Confirmar levantamento'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
