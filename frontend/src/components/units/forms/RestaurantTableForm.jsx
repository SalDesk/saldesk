import { useState } from 'react';
import Input, { Textarea, Select } from '../../ui/Input';
import Button from '../../ui/Button';
import {
  AmenitiesPicker, IncludedItemsEditor,
  SectionLabel, OtaFields, ConectFields, buildOtaProductIds,
} from './editors';

const RESTAURANT_AMENS = ['WiFi', 'Ar condicionado', 'Vista mar', 'Terraço', 'Acesso cadeira de rodas', 'Estacionamento', 'Música ao vivo', 'Ambiente para crianças'];

const TABLE_ZONES = ['interior', 'esplanada', 'terraco', 'vip', 'privado'];
const ZONE_LABEL_MAP = { interior: 'Interior', esplanada: 'Esplanada', terraco: 'Terraco', vip: 'VIP', privado: 'Privado' };

function parseTableMeta(description) {
  if (!description?.startsWith('{')) return {};
  try { return JSON.parse(description); } catch { return {}; }
}

/* Mesmo problema de composicao do HotelRoomForm: unit.name grava sempre
   "Mesa {numero} — {nome}", por isso o nome puro so pode vir de meta.name;
   para mesas antigas sem meta.name, tenta recuperar removendo o prefixo
   "Mesa {numero} — " uma vez. */
function stripMesaPrefix(name, number) {
  if (!name || !number) return name || '';
  const full = `Mesa ${number} — `;
  return name.startsWith(full) ? name.slice(full.length) : name;
}

export default function RestaurantTableForm({ unit, onSave, onCancel, loading, error }) {
  const meta = parseTableMeta(unit?.description);

  const [form, setForm] = useState({
    number:       meta.number       || '',
    name:         meta.name ?? stripMesaPrefix(unit?.name, meta.number),
    zone:         meta.zone         || 'interior',
    capacity_min: meta.capacity_min != null ? String(meta.capacity_min) : '1',
    capacity_max: meta.capacity_max != null ? String(meta.capacity_max) : String(unit?.capacity ?? '4'),
    combinable:   meta.combinable   ?? false,
    amenities:      meta.amenities      || [],
    included_items: meta.included_items || [],
    important_info: meta.important_info || '',
    status:       unit?.status      || 'active',
    ota_viator_id: unit?.ota_product_ids?.viator       || '',
    ota_gyg_id:    unit?.ota_product_ids?.getyourguide || '',
    lat: unit?.lat ?? '',
    lng: unit?.lng ?? '',
  });

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  function toggleAmen(a) {
    setForm(f => ({
      ...f,
      amenities: f.amenities.includes(a) ? f.amenities.filter(x => x !== a) : [...f.amenities, a],
    }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const tableMeta = {
      number:       form.number       || null,
      name:         form.name         || null,
      zone:         form.zone,
      capacity_min: Number(form.capacity_min) || 1,
      capacity_max: Number(form.capacity_max) || 4,
      combinable:   form.combinable,
      amenities:      form.amenities,
      included_items: form.included_items.filter(it => it.label.trim()),
      important_info: form.important_info || null,
    };
    const displayName = form.number
      ? `Mesa ${form.number}${form.name ? ` — ${form.name}` : ''}`
      : form.name || `Mesa`;
    onSave({
      name:        displayName,
      description: JSON.stringify(tableMeta),
      unit_type:   ZONE_LABEL_MAP[form.zone] || form.zone,
      base_price:  0,
      price_unit:  'hour',
      capacity:    Number(form.capacity_max) || 4,
      status:      form.status,
      images:      unit?.images || [],
      ota_product_ids: buildOtaProductIds(form),
      lat: form.lat !== '' ? Number(form.lat) : null,
      lng: form.lng !== '' ? Number(form.lng) : null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      <div>
        <SectionLabel>Identificacao</SectionLabel>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <Input label="Numero" value={form.number} onChange={set('number')} placeholder="1" autoFocus />
          <div className="col-span-2">
            <Input label="Nome / descricao (opcional)" value={form.name} onChange={set('name')} placeholder="Ex: Terraco Vista Mar" />
          </div>
        </div>
        <Select label="Zona" value={form.zone} onChange={set('zone')} required>
          {TABLE_ZONES.map(z => (
            <option key={z} value={z}>{ZONE_LABEL_MAP[z]}</option>
          ))}
        </Select>
      </div>

      <div>
        <SectionLabel>Capacidade</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Minimo (pessoas)" type="number" value={form.capacity_min} onChange={set('capacity_min')} min="1" required />
          <Input label="Maximo (pessoas)" type="number" value={form.capacity_max} onChange={set('capacity_max')} min="1" required />
        </div>
      </div>

      <div>
        <SectionLabel>Opcoes</SectionLabel>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.combinable}
            onChange={e => setForm(f => ({ ...f, combinable: e.target.checked }))}
            className="w-4 h-4 accent-ocean-700"
          />
          <span className="text-sm font-body text-n-700 app:text-[13px]">Mesa combinavel com outras</span>
        </label>
      </div>

      <div>
        <SectionLabel>Comodidades</SectionLabel>
        <AmenitiesPicker options={RESTAURANT_AMENS} selected={form.amenities} onToggle={toggleAmen} />
      </div>

      <div>
        <SectionLabel>O que está incluído</SectionLabel>
        <IncludedItemsEditor items={form.included_items} onChange={items => setForm(f => ({ ...f, included_items: items }))} />
      </div>

      <div>
        <SectionLabel>Informação importante (opcional)</SectionLabel>
        <Textarea value={form.important_info} onChange={set('important_info')} placeholder="Ex: Reserva mantida por 15 minutos após a hora marcada." rows={2} />
      </div>

      <OtaFields form={form} set={set} />
      <ConectFields form={form} set={set} />

      {unit && (
        <div>
          <SectionLabel>Estado</SectionLabel>
          <Select value={form.status} onChange={set('status')}>
            <option value="active">Activa</option>
            <option value="inactive">Bloqueada</option>
          </Select>
        </div>
      )}

      {error && (
        <p className="text-sm font-body px-3 py-2 rounded-sm bg-[var(--error-light)] text-[var(--error)]">{error}</p>
      )}

      <div className="flex gap-3 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">Cancelar</Button>
        <Button type="submit" loading={loading} className="flex-1">
          {unit ? 'Guardar alteracoes' : 'Criar mesa'}
        </Button>
      </div>
    </form>
  );
}
