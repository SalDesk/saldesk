import { useState, useEffect } from 'react';
import { Utensils } from 'lucide-react';
import { updateReservation } from '../../services/reservationsService';
import Button from '../../components/ui/Button';
import FilterChips from '../../components/ui/FilterChips';
import { Select, Textarea } from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import { useT } from '../../i18n';
import { parseRestaurantMeta, rotuloOcasiao, OCASIOES, GROUP_LABEL_CLASS } from './shared';

export default function RestaurantCreateModal({ reservation, units, open, onClose, onDone }) {
  const t = useT();
  const prevMeta = parseRestaurantMeta(reservation);
  const [form, setForm] = useState({
    turno:            prevMeta.turno             || 'jantar',
    ocasiao:          prevMeta.ocasiao            || '',
    pedidos_especiais:prevMeta.pedidos_especiais  || '',
    lista_espera:     prevMeta.lista_espera        ?? false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (reservation) {
      const m = parseRestaurantMeta(reservation);
      setForm({ turno: m.turno || 'jantar', ocasiao: m.ocasiao || '', pedidos_especiais: m.pedidos_especiais || '', lista_espera: m.lista_espera ?? false });
    }
  }, [reservation]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleSave() {
    if (!reservation) return;
    setSaving(true);
    try {
      let prev = {};
      try { prev = JSON.parse(reservation.notes_guest || '{}'); } catch {}
      await updateReservation(reservation.id, { notes_guest: JSON.stringify({ ...prev, ...form }) });
      onDone();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  const unit = units.find(u => u.id === reservation?.unit_id);

  return (
    <Modal open={open} onClose={onClose} title={t('reservations.details')} size="sm" footer={null}>
      <div className="space-y-4">
        {reservation && (
          <div className="flex items-center gap-3 p-3 bg-n-50 rounded-md border border-n-200">
            <Utensils size={14} strokeWidth={1.75} className="text-ocean-700 shrink-0" />
            <div>
              <p className="font-display font-semibold text-sm text-n-900">{reservation.customer_name || '—'}</p>
              <p className="text-xs font-body text-n-400">{t('reservations.restaurantDetails.summary', { n: reservation.guests, unit: unit?.name || t('reservations.noTable') })}</p>
            </div>
          </div>
        )}

        <div>
          <p className={`${GROUP_LABEL_CLASS} mb-2`}>{t('reservations.columns.shift')}</p>
          <FilterChips
            options={[{ value: 'almoco', label: t('reservations.shift.lunchHours') }, { value: 'jantar', label: t('reservations.shift.dinnerHours') }]}
            value={form.turno}
            onChange={v => set('turno', v)}
          />
        </div>

        <Select label={t('reservations.restaurantDetails.occasionLabel')} value={form.ocasiao} onChange={e => set('ocasiao', e.target.value)}>
          <option value="">{t('reservations.none')}</option>
          {OCASIOES.map((o) => <option key={o} value={o}>{rotuloOcasiao(o, t)}</option>)}
        </Select>

        <Textarea label={t('reservations.restaurantDetails.requests')} value={form.pedidos_especiais} onChange={e => set('pedidos_especiais', e.target.value)} rows={2}
          placeholder={t('reservations.restaurantDetails.requestsPlaceholder')} />

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.lista_espera} onChange={e => set('lista_espera', e.target.checked)} className="w-4 h-4 accent-ocean-700" />
          <span className="text-sm font-body text-n-700">{t('reservations.restaurantDetails.waitlistCheck')}</span>
        </label>

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">{t('common.cancel')}</Button>
          <Button type="button" loading={saving} onClick={handleSave} className="flex-1">
            {saving ? t('reservations.saving') : t('reservations.restaurantDetails.save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
