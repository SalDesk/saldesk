import { useState, useEffect } from 'react';
import { Car, MoveLeft } from 'lucide-react';
import { updateReservation, changeStatus } from '../../services/reservationsService';
import Button from '../../components/ui/Button';
import FilterChips from '../../components/ui/FilterChips';
import Input, { Textarea } from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import { parseRentacarMeta, FuelSelector, GROUP_LABEL_CLASS } from './shared';

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
          <p className={`${GROUP_LABEL_CLASS} mb-2`}>Nivel combustivel (chegada)</p>
          <FuelSelector value={form.fuel_in} onChange={v => set('fuel_in', v)} />
        </div>

        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Input label="Km na chegada" type="number" value={form.km_in} onChange={e => set('km_in', e.target.value)} placeholder="0" />
          </div>
          {kmTotal !== null && (
            <span className="flex items-center h-9 text-sm font-mono text-n-600 whitespace-nowrap">{kmTotal.toLocaleString()} km percorridos</span>
          )}
        </div>

        <Textarea label="Danos na devolucao" value={form.damages_in} onChange={e => set('damages_in', e.target.value)} rows={2}
          placeholder="Descrever danos verificados na chegada..." />

        <div>
          <p className={`${GROUP_LABEL_CLASS} mb-2`}>Caucao</p>
          <div className="mb-3">
            <FilterChips
              options={[
                { value: 'returned', label: 'Devolvida' },
                { value: 'retained', label: 'Retida (parcial)' },
                { value: 'full',     label: 'Retida (total)' },
              ]}
              value={form.caucao_status}
              onChange={v => set('caucao_status', v)}
            />
          </div>
          {form.caucao_status !== 'returned' && (
            <Input label="Valor retido (€)" type="number" value={form.caucao_retained} onChange={e => set('caucao_retained', e.target.value)} placeholder="0.00" step="0.01" />
          )}
        </div>

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button type="button" loading={saving} onClick={handleSave} icon={MoveLeft} className="flex-1">
            {saving ? 'A processar...' : 'Confirmar devolucao'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
