import { useState } from 'react';
import Input, { Textarea, Select } from '../../ui/Input';
import Button from '../../ui/Button';
import ImageUploader from '../../shared/ImageUploader';
import { useT } from '../../../i18n';
import { rotuloComodidade, rotuloTipoUnidade, rotuloVistaQuarto } from '../rotulosUnidades';
import { useLingua } from '../../../utils/formatoLingua';
import {
  AmenitiesPicker, IncludedItemsEditor,
  SectionLabel, CAIXA_SECAO, OtaFields, ConectFields, buildOtaProductIds,
} from './editors';

const ROOM_TYPES  = ['Single', 'Double', 'Twin', 'Suite', 'Apartamento', 'Villa', 'Bungalow'];
const ROOM_VIEWS  = ['Mar', 'Jardim', 'Piscina', 'Cidade', 'Sem vista'];
const ROOM_AMENS  = ['AC', 'TV', 'WiFi', 'Cofre', 'Minibar', 'Jacuzzi', 'Varanda', 'Banheira', 'Cozinha'];

function parseRoomMeta(description) {
  if (!description?.startsWith('{')) return {};
  try { return JSON.parse(description); } catch { return {}; }
}

/* unit.name grava sempre "{numero} — {nome}" (composto no submit abaixo) --
   registos anteriores a este fix nao tinham meta.name para recuperar o nome
   puro, por isso o campo "Nome" carregava o nome ja composto e cada
   gravacao voltava a compor por cima, acumulando "101 — 101 — ...". Isto
   remove esse prefixo uma vez, para registos antigos; depois do primeiro
   guardar com este fix, meta.name passa a ser sempre a fonte usada. */
function stripComposedPrefix(name, prefix) {
  if (!name || !prefix) return name || '';
  const full = `${prefix} — `;
  return name.startsWith(full) ? name.slice(full.length) : name;
}

export default function HotelRoomForm({ unit, onSave, onCancel, loading, error }) {
  const t = useT();
  const lang = useLingua();
  const meta = parseRoomMeta(unit?.description);

  const [form, setForm] = useState({
    number:        meta.number         || '',
    name:          meta.name ?? stripComposedPrefix(unit?.name, meta.number),
    unit_type:     unit?.unit_type     || 'Double',
    floor:         meta.floor          || '',
    view:          meta.view           || 'Mar',
    capacity:      unit?.capacity      != null ? String(unit.capacity) : '2',
    capacity_kids: meta.capacity_kids  != null ? String(meta.capacity_kids) : '0',
    base_price:    unit?.base_price    != null ? String(unit.base_price) : '',
    price_low:     meta.price_low      != null ? String(meta.price_low) : '',
    price_mid:     meta.price_mid      != null ? String(meta.price_mid) : '',
    price_high:    meta.price_high     != null ? String(meta.price_high) : '',
    price_peak:    meta.price_peak     != null ? String(meta.price_peak) : '',
    amenities:     meta.amenities      || [],
    included_items: meta.included_items || [],
    important_info: meta.important_info || '',
    description:   meta.description    || '',
    status:        unit?.status        || 'active',
    images:        unit?.images        || [],
    ota_viator_id: unit?.ota_product_ids?.viator       || '',
    ota_gyg_id:    unit?.ota_product_ids?.getyourguide || '',
    lat: unit?.lat ?? '',
    lng: unit?.lng ?? '',
  });

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  function toggleAmen(a) {
    setForm(f => ({
      ...f,
      amenities: f.amenities.includes(a)
        ? f.amenities.filter(x => x !== a)
        : [...f.amenities, a],
    }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const roomMeta = {
      number:        form.number        || null,
      name:          form.name          || null,
      floor:         form.floor         || null,
      view:          form.view,
      capacity_kids: Number(form.capacity_kids || 0),
      amenities:      form.amenities,
      included_items: form.included_items.filter(it => it.label.trim()),
      important_info: form.important_info || null,
      description:   form.description   || null,
      price_low:     form.price_low     ? Number(form.price_low)  : null,
      price_mid:     form.price_mid     ? Number(form.price_mid)  : null,
      price_high:    form.price_high    ? Number(form.price_high) : null,
      price_peak:    form.price_peak    ? Number(form.price_peak) : null,
    };
    const displayName = form.number ? `${form.number} — ${form.name}` : form.name;
    onSave({
      name:        displayName,
      description: JSON.stringify(roomMeta),
      unit_type:   form.unit_type,
      base_price:  Number(form.base_price),
      price_unit:  'night',
      capacity:    Number(form.capacity),
      status:      form.status,
      images:      form.images,
      ota_product_ids: buildOtaProductIds(form),
      lat: form.lat !== '' ? Number(form.lat) : null,
      lng: form.lng !== '' ? Number(form.lng) : null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      <div className={CAIXA_SECAO}>
        <SectionLabel>{t('unitForm.section.identification')}</SectionLabel>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
          <Input label={t('unitForm.hotel.number')} value={form.number} onChange={set('number')} placeholder="101" />
          <div className="col-span-2">
            <Input label={t('unitForm.hotel.name')} value={form.name} onChange={set('name')} required autoFocus placeholder="Ocean View Suite" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Select label={t('unitForm.hotel.type')} value={form.unit_type} onChange={set('unit_type')} required>
            {ROOM_TYPES.map(tp => <option key={tp} value={tp}>{rotuloTipoUnidade(tp, t, lang)}</option>)}
          </Select>
          <Input label={t('unitForm.hotel.floor')} value={form.floor} onChange={set('floor')} placeholder="1" />
          <Select label={t('unitForm.hotel.view')} value={form.view} onChange={set('view')}>
            {ROOM_VIEWS.map(v => <option key={v} value={v}>{rotuloVistaQuarto(v, t)}</option>)}
          </Select>
        </div>
      </div>

      <div className={CAIXA_SECAO}>
        <SectionLabel>{t('unitForm.section.capacity')}</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          <Input label={t('unitForm.hotel.adults')} type="number" value={form.capacity}      onChange={set('capacity')}      min="1" required />
          <Input label={t('unitForm.hotel.children')} type="number" value={form.capacity_kids} onChange={set('capacity_kids')} min="0" />
        </div>
      </div>

      <div className={CAIXA_SECAO}>
        <SectionLabel>{t('unitForm.section.amenities')}</SectionLabel>
        <AmenitiesPicker options={ROOM_AMENS} selected={form.amenities} onToggle={toggleAmen} rotulo={(a) => rotuloComodidade(a, t)} />
      </div>

      <div className={CAIXA_SECAO}>
        <SectionLabel>{t('unitForm.hotel.seasonPrices')}</SectionLabel>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Input label={t('unitForm.hotel.basePrice')} type="number" value={form.base_price} onChange={set('base_price')} min="0" step="0.01" required placeholder="0.00" />
          <Input label={t('unitForm.hotel.low')} type="number" value={form.price_low}  onChange={set('price_low')}  min="0" step="0.01" placeholder="0.00" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Input label={t('unitForm.hotel.mid')} type="number" value={form.price_mid}  onChange={set('price_mid')}  min="0" step="0.01" placeholder="0.00" />
          <Input label={t('unitForm.hotel.high')} type="number" value={form.price_high} onChange={set('price_high')} min="0" step="0.01" placeholder="0.00" />
          <Input label={t('unitForm.hotel.peak')} type="number" value={form.price_peak} onChange={set('price_peak')} min="0" step="0.01" placeholder="0.00" />
        </div>
      </div>

      <div className={CAIXA_SECAO}>
        <SectionLabel>{t('unitForm.section.description')}</SectionLabel>
        <Textarea value={form.description} onChange={set('description')} placeholder={t('unitForm.hotel.descPh')} rows={2} />
      </div>

      <div className={CAIXA_SECAO}>
        <SectionLabel>{t('unitForm.section.included')}</SectionLabel>
        <IncludedItemsEditor items={form.included_items} onChange={items => setForm(f => ({ ...f, included_items: items }))} />
      </div>

      <div className={CAIXA_SECAO}>
        <SectionLabel>{t('unitForm.section.importantInfo')}</SectionLabel>
        <Textarea value={form.important_info} onChange={set('important_info')} placeholder={t('unitForm.hotel.importantPh')} rows={2} />
      </div>

      <div className={CAIXA_SECAO}>
        <SectionLabel>{t('unitForm.section.photos')}</SectionLabel>
        <ImageUploader
          value={form.images}
          onChange={(urls) => setForm(f => ({ ...f, images: urls }))}
          maxImages={10}
          hint={t('unitForm.tour.photosHint')}
        />
      </div>

      <OtaFields form={form} set={set} />
      <ConectFields form={form} set={set} />

      {unit && (
        <div className={CAIXA_SECAO}>
          <SectionLabel>{t('unitForm.section.status')}</SectionLabel>
          <Select value={form.status} onChange={set('status')}>
            <option value="active">{t('unitForm.status.active')}</option>
            <option value="cleaning">{t('unitForm.status.cleaning')}</option>
            <option value="maintenance">{t('unitForm.status.maintenance')}</option>
            <option value="inactive">{t('unitForm.status.inactive')}</option>
          </Select>
        </div>
      )}

      {error && (
        <p className="text-sm font-body px-3 py-2 rounded-[14px] bg-[var(--error-light)] text-[var(--error)]">{error}</p>
      )}

      <div className="flex gap-3 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">{t('common.cancel')}</Button>
        <Button type="submit" loading={loading} className="flex-1">
          {unit ? t('unitForm.tour.saveChanges') : t('unitForm.hotel.create')}
        </Button>
      </div>
    </form>
  );
}
