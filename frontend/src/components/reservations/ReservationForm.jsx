import { useState, useEffect } from 'react';
import { useT } from '../../i18n';
import Input, { Textarea, Select } from '../ui/Input';
import Button from '../ui/Button';

const SOURCES = ['direct', 'booking_com', 'airbnb', 'viator', 'getyourguide', 'manual'];

export default function ReservationForm({ reservation, units, onSave, onCancel, loading, error }) {
  const t = useT();
  const [form, setForm] = useState({
    unit_id:          reservation?.unit_id || '',
    customer_name:    reservation?.customer_name || '',
    customer_email:   reservation?.customer_email || '',
    customer_phone:   reservation?.customer_phone || '',
    customer_country: reservation?.customer_country || '',
    check_in:         reservation?.check_in || '',
    check_out:        reservation?.check_out || '',
    guests:           reservation?.guests || 1,
    source:           reservation?.source || 'manual',
    notes:            reservation?.notes || '',
  });
  const [pricePreview, setPricePreview] = useState(null);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  useEffect(() => {
    if (form.unit_id && form.check_in && form.check_out && form.check_out > form.check_in) {
      const unit = units.find((u) => u.id === form.unit_id);
      if (unit) {
        const dias = Math.ceil(
          (new Date(form.check_out) - new Date(form.check_in)) / (1000 * 60 * 60 * 24)
        );
        setPricePreview({ total: Number(unit.base_price) * dias, dias });
      }
    } else {
      setPricePreview(null);
    }
  }, [form.unit_id, form.check_in, form.check_out, units]);

  function handleSubmit(e) {
    e.preventDefault();
    onSave({ ...form, guests: Number(form.guests) });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Select label={t('reservations.unit')} value={form.unit_id} onChange={set('unit_id')} required>
        <option value="">Seleccionar unidade...</option>
        {units.map((u) => (
          <option key={u.id} value={u.id}>{u.name}</option>
        ))}
      </Select>

      <div className="grid grid-cols-2 gap-3">
        <Input label={t('reservations.checkIn')} type="date" value={form.check_in} onChange={set('check_in')} required />
        <Input label={t('reservations.checkOut')} type="date" value={form.check_out} onChange={set('check_out')} min={form.check_in || undefined} required />
      </div>

      {pricePreview && (
        <div className="bg-ocean-50 border border-ocean-100 rounded-sm px-3 py-2 flex items-center justify-between">
          <span className="text-xs font-body text-ocean-700">{pricePreview.dias} noite(s)</span>
          <span className="font-display font-bold text-ocean-700">€{pricePreview.total.toFixed(2)}</span>
        </div>
      )}

      <Input label={t('reservations.customer')} value={form.customer_name} onChange={set('customer_name')} required placeholder="Nome do cliente" />

      <div className="grid grid-cols-2 gap-3">
        <Input label={t('auth.email')} type="email" value={form.customer_email} onChange={set('customer_email')} required placeholder="email@exemplo.com" />
        <Input label={t('customers.phone')} type="tel" value={form.customer_phone} onChange={set('customer_phone')} placeholder="+238 900 0000" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input label={t('customers.nationality')} value={form.customer_country} onChange={set('customer_country')} placeholder="PT, DE, GB..." hint="Codigo ISO 2" />
        <Input label={t('reservations.guests')} type="number" value={form.guests} onChange={set('guests')} min="1" />
      </div>

      <Select label="Fonte" value={form.source} onChange={set('source')}>
        {SOURCES.map((s) => (
          <option key={s} value={s}>{t(`reservations.source.${s}`)}</option>
        ))}
      </Select>

      <Textarea label={t('reservations.internalNotes')} value={form.notes} onChange={set('notes')} rows={2} placeholder="Notas internas..." />

      {error && (
        <p className="text-sm font-body px-3 py-2 rounded-sm bg-[var(--error-light)] text-[var(--error)]">{error}</p>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">{t('common.cancel')}</Button>
        <Button type="submit" loading={loading} className="flex-1">
          {reservation ? t('common.save') : t('reservations.new')}
        </Button>
      </div>
    </form>
  );
}
