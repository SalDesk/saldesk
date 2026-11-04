import { useState, useEffect } from 'react';
import { Car, MoveLeft } from 'lucide-react';
import { updateReservation, changeStatus } from '../../services/reservationsService';
import Modal from '../../components/ui/Modal';
import { parseRentacarMeta, FuelSelector } from './shared';

export default function DevolucaoModal({ reservation, units, open, onClose, onDone }) {
  const unit = units.find(u => u.id === reservation?.unit_id);
  const prevMeta = parseRentacarMeta(reservation);

  const [form, setForm] = useState({
    fuel_in:        prevMeta.fuel_in        ?? 4,
    km_in:          prevMeta.km_in          != null ? String(prevMeta.km_in) : '',
    damages_in:     prevMeta.damages_in     || '',
    caucao_retained:prevMeta.caucao_retained!= null ? String(prevMeta.caucao_retained) : '0',
    caucao_status:  prevMeta.caucao_status  || 'returned',
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (reservation) {
      const m = parseRentacarMeta(reservation);
      setForm({
        fuel_in:         m.fuel_in        ?? 4,
        km_in:           m.km_in          != null ? String(m.km_in) : '',
        damages_in:      m.damages_in     || '',
        caucao_retained: m.caucao_retained!= null ? String(m.caucao_retained) : '0',
        caucao_status:   m.caucao_status  || 'returned',
      });
    }
  }, [reservation]);

  async function handleSave() {
    if (!reservation) return;
    setSaving(true);
    try {
      let prevInternal = {};
      try { prevInternal = JSON.parse(reservation.notes_internal || '{}'); } catch {}
      const rentacarData = { ...parseRentacarMeta(reservation), ...form, km_in: form.km_in ? Number(form.km_in) : null, caucao_retained: Number(form.caucao_retained) || 0 };
      await updateReservation(reservation.id, {
        notes_internal: JSON.stringify({ ...prevInternal, rentacar: rentacarData }),
      });
      await changeStatus(reservation.id, 'checked_out');
      onDone();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  let unitMeta = {};
  try { unitMeta = JSON.parse(unit?.description || '{}'); } catch {}
  const prevKmOut = prevMeta.km_out;
  const kmTotal   = form.km_in && prevKmOut ? Number(form.km_in) - Number(prevKmOut) : null;

  return (
    <Modal open={open} onClose={onClose} title="Devolucao de viatura" size="sm" footer={null}>
      <div className="space-y-5">
        <div className="flex items-center gap-3 p-3 bg-n-50 rounded-md border border-n-200">
          <Car size={16} strokeWidth={1.75} className="text-n-500 shrink-0" />
          <div>
            <p className="font-display font-semibold text-sm text-n-900">
              {unitMeta.brand ? `${unitMeta.brand} ${unitMeta.model || ''}`.trim() : unit?.name || '—'}
            </p>
            {unitMeta.plate && <p className="text-xs font-mono text-n-400">{unitMeta.plate}</p>}
          </div>
          <div className="ml-auto text-right">
            <p className="font-display font-semibold text-sm text-n-900">{reservation?.customer_name || '—'}</p>
            {prevKmOut && <p className="text-xs font-body text-n-400">Saida: {Number(prevKmOut).toLocaleString()} km</p>}
          </div>
        </div>

        <div>
          <label className="block text-xs font-mono text-n-500 uppercase tracking-wide mb-2">Nivel combustivel (chegada)</label>
          <FuelSelector value={form.fuel_in} onChange={v => set('fuel_in', v)} />
        </div>

        <div>
          <label className="block text-xs font-mono text-n-500 uppercase tracking-wide mb-1.5">Km na chegada</label>
          <div className="flex items-center gap-3">
            <input type="number" value={form.km_in} onChange={e => set('km_in', e.target.value)} placeholder="0"
              className="flex-1 h-9 rounded-md border border-n-200 bg-n-50 px-3 text-sm font-body text-n-900 focus:outline-none focus:ring-2 focus:ring-ocean-700" />
            {kmTotal !== null && (
              <span className="text-sm font-mono text-n-600 whitespace-nowrap">{kmTotal.toLocaleString()} km percorridos</span>
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs font-mono text-n-500 uppercase tracking-wide mb-1.5">Danos na devolucao</label>
          <textarea value={form.damages_in} onChange={e => set('damages_in', e.target.value)} rows={2}
            placeholder="Descrever danos verificados na chegada..."
            className="w-full rounded-md border border-n-200 bg-n-50 px-3 py-2 text-sm font-body text-n-900 focus:outline-none focus:ring-2 focus:ring-ocean-700 resize-none" />
        </div>

        <div>
          <label className="block text-xs font-mono text-n-500 uppercase tracking-wide mb-2">Caucao</label>
          <div className="flex gap-2 mb-3">
            {[
              { value: 'returned', label: 'Devolvida' },
              { value: 'retained', label: 'Retida (parcial)' },
              { value: 'full',     label: 'Retida (total)' },
            ].map(o => (
              <button key={o.value} type="button" onClick={() => set('caucao_status', o.value)}
                className={`flex-1 px-2 py-1.5 rounded-sm border text-xs font-mono font-medium transition-colors ${
                  form.caucao_status === o.value ? 'bg-ocean-700 border-ocean-700 text-white' : 'bg-n-50 border-n-200 text-n-600 hover:border-ocean-400'
                }`}>
                {o.label}
              </button>
            ))}
          </div>
          {form.caucao_status !== 'returned' && (
            <div>
              <label className="block text-xs font-mono text-n-500 uppercase tracking-wide mb-1.5">Valor retido (€)</label>
              <input type="number" value={form.caucao_retained} onChange={e => set('caucao_retained', e.target.value)} placeholder="0.00" step="0.01"
                className="w-full h-9 rounded-md border border-n-200 bg-n-50 px-3 text-sm font-body text-n-900 focus:outline-none focus:ring-2 focus:ring-ocean-700" />
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="flex-1 h-9 rounded-md border border-n-200 text-sm font-body text-n-700 hover:bg-n-50 transition-colors">Cancelar</button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="flex-1 h-9 rounded-md bg-ocean-700 text-white text-sm font-body font-medium hover:bg-ocean-500 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60">
            <MoveLeft size={13} strokeWidth={1.75} />
            {saving ? 'A processar...' : 'Confirmar devolucao'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
