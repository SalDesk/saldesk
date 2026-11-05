import { useState } from 'react';
import { useT } from '../../../i18n';
import Input, { Textarea, Select } from '../../ui/Input';
import Button from '../../ui/Button';
import ImageUploader from '../../shared/ImageUploader';
import { OtaFields, ConectFields, buildOtaProductIds, UNIT_TYPES_BY_OPERATOR } from './editors';

const PRICE_UNITS_BY_OPERATOR = {
  hotel:      [{ value: 'night',   label: 'por noite'  }],
  activity:   [{ value: 'person',  label: 'por pessoa' }, { value: 'session', label: 'por sessao' }],
  rentacar:   [{ value: 'day',     label: 'por dia'    }],
  restaurant: [{ value: 'hour',    label: 'por hora'   }],
};

export default function GenericUnitForm({ unit, operatorType, onSave, onCancel, loading, error }) {
  const t = useT();

  const tipos      = UNIT_TYPES_BY_OPERATOR[operatorType] || [];
  const priceUnits = PRICE_UNITS_BY_OPERATOR[operatorType] || [{ value: 'day', label: 'por dia' }];

  const [form, setForm] = useState({
    name:        unit?.name        || '',
    description: unit?.description || '',
    unit_type:   unit?.unit_type   || tipos[0] || '',
    base_price:  unit?.base_price  ?? '',
    price_unit:  unit?.price_unit  || priceUnits[0]?.value || 'night',
    capacity:    unit?.capacity    ?? 1,
    status:  unit?.status  || 'active',
    images:  unit?.images  || [],
    ota_viator_id: unit?.ota_product_ids?.viator       || '',
    ota_gyg_id:    unit?.ota_product_ids?.getyourguide || '',
    lat: unit?.lat ?? '',
    lng: unit?.lng ?? '',
  });

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  function handleSubmit(e) {
    e.preventDefault();
    onSave({
      name:        form.name,
      description: form.description,
      unit_type:   form.unit_type,
      base_price:  Number(form.base_price),
      price_unit:  form.price_unit,
      capacity:    Number(form.capacity),
      status:      form.status,
      images:      form.images,
      ota_product_ids: buildOtaProductIds(form),
      lat: form.lat !== '' ? Number(form.lat) : null,
      lng: form.lng !== '' ? Number(form.lng) : null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label={t('units.name')}
        value={form.name}
        onChange={set('name')}
        required
        autoFocus
        placeholder="Ex: Quarto Ocean View"
      />

      <div className="grid grid-cols-2 gap-3">
        <Select label={t('units.type')} value={form.unit_type} onChange={set('unit_type')} required>
          {tipos.map((tp) => <option key={tp} value={tp}>{tp}</option>)}
          <option value="Outro">Outro</option>
        </Select>
        <Select label={t('units.priceUnit')} value={form.price_unit} onChange={set('price_unit')}>
          {priceUnits.map((pu) => (
            <option key={pu.value} value={pu.value}>{pu.label}</option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label={`${t('units.basePrice')} (€)`}
          type="number"
          value={form.base_price}
          onChange={set('base_price')}
          min="0"
          step="0.01"
          required
          placeholder="0.00"
        />
        <Input
          label={t('units.capacity')}
          type="number"
          value={form.capacity}
          onChange={set('capacity')}
          min="1"
          required
        />
      </div>

      <Textarea
        label={t('units.description')}
        value={form.description}
        onChange={set('description')}
        placeholder="Descreva a unidade..."
        rows={3}
      />

      <ImageUploader
        value={form.images}
        onChange={(urls) => setForm(f => ({ ...f, images: urls }))}
        maxImages={10}
        hint="Primeira foto = capa principal · max 10 fotos · 5MB cada"
      />

      <OtaFields form={form} set={set} />
      <ConectFields form={form} set={set} />

      {unit && (
        <Select label={t('common.status')} value={form.status} onChange={set('status')}>
          <option value="active">{t('units.active')}</option>
          <option value="inactive">{t('units.inactive')}</option>
        </Select>
      )}

      {error && (
        <p className="text-sm font-body px-3 py-2 rounded-sm bg-[var(--error-light)] text-[var(--error)]">
          {error}
        </p>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
          {t('common.cancel')}
        </Button>
        <Button type="submit" loading={loading} className="flex-1">
          {unit ? t('common.save') : t('units.new')}
        </Button>
      </div>
    </form>
  );
}
