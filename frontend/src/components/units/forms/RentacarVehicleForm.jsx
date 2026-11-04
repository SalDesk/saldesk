import { useState } from 'react';
import Input, { Textarea, Select } from '../../ui/Input';
import Button from '../../ui/Button';
import ImageUploader from '../../shared/ImageUploader';
import {
  AmenitiesPicker, IncludedItemsEditor,
  SectionLabel, OtaFields, ConectFields, buildOtaProductIds, UNIT_TYPES_BY_OPERATOR,
} from './editors';

const CAR_AMENS = ['AC', 'GPS', 'Bluetooth', 'USB', 'Cadeira bebe', '4x4', 'Teto solar', 'Camera re'];

function parseVehicleMeta(description) {
  if (!description?.startsWith('{')) return {};
  try { return JSON.parse(description); } catch { return {}; }
}

export default function RentacarVehicleForm({ unit, onSave, onCancel, loading, error }) {
  const meta = parseVehicleMeta(unit?.description);

  const [form, setForm] = useState({
    name:            unit?.name         || '',
    brand:           meta.brand         || '',
    model:           meta.model         || '',
    year:            meta.year          || '',
    plate:           meta.plate         || '',
    color:           meta.color         || '',
    unit_type:       unit?.unit_type    || 'Compacto',
    seats:           meta.seats         != null ? String(meta.seats) : '5',
    luggage:         meta.luggage       || '',
    transmission:    meta.transmission  || 'manual',
    fuel:            meta.fuel          || 'gasolina',
    amenities:       meta.amenities     || [],
    included_items:  meta.included_items || [],
    important_info:  meta.important_info || '',
    base_price:      unit?.base_price   != null ? String(unit.base_price) : '',
    discount_week:   meta.discount_week != null ? String(meta.discount_week) : '',
    discount_month:  meta.discount_month!= null ? String(meta.discount_month) : '',
    km_included:     meta.km_included   != null ? String(meta.km_included) : '',
    km_extra_cost:   meta.km_extra_cost != null ? String(meta.km_extra_cost) : '',
    chauffeur_daily_rate: meta.chauffeur_daily_rate != null ? String(meta.chauffeur_daily_rate) : '',
    min_age:         meta.min_age       != null ? String(meta.min_age) : '21',
    license_years:   meta.license_years != null ? String(meta.license_years) : '1',
    seguro_expiry:   meta.seguro_expiry   || '',
    iuc_expiry:      meta.iuc_expiry      || '',
    inspecao_expiry: meta.inspecao_expiry || '',
    current_km:      meta.current_km    != null ? String(meta.current_km) : '',
    next_revision_km:meta.next_revision_km!= null ? String(meta.next_revision_km) : '',
    status:          unit?.status       || 'active',
    images:          unit?.images       || [],
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
    const carMeta = {
      brand:           form.brand           || null,
      model:           form.model           || null,
      year:            form.year            ? Number(form.year) : null,
      plate:           form.plate           || null,
      color:           form.color           || null,
      seats:           form.seats           ? Number(form.seats) : null,
      luggage:         form.luggage         || null,
      transmission:    form.transmission,
      fuel:            form.fuel,
      amenities:       form.amenities,
      included_items:  form.included_items.filter(it => it.label.trim()),
      important_info:  form.important_info || null,
      discount_week:   form.discount_week   ? Number(form.discount_week)   : null,
      discount_month:  form.discount_month  ? Number(form.discount_month)  : null,
      km_included:     form.km_included     ? Number(form.km_included)     : null,
      km_extra_cost:   form.km_extra_cost   ? Number(form.km_extra_cost)   : null,
      chauffeur_daily_rate: form.unit_type === 'Executivo' && form.chauffeur_daily_rate ? Number(form.chauffeur_daily_rate) : null,
      min_age:         form.min_age         ? Number(form.min_age)         : null,
      license_years:   form.license_years   ? Number(form.license_years)   : null,
      seguro_expiry:   form.seguro_expiry   || null,
      iuc_expiry:      form.iuc_expiry      || null,
      inspecao_expiry: form.inspecao_expiry || null,
      current_km:      form.current_km      ? Number(form.current_km)      : null,
      next_revision_km:form.next_revision_km? Number(form.next_revision_km): null,
      maintenance_history: meta.maintenance_history || [],
    };
    const displayName = [form.brand, form.model].filter(Boolean).join(' ') || form.name || form.plate || 'Viatura';
    onSave({
      name:        displayName,
      description: JSON.stringify(carMeta),
      unit_type:   form.unit_type,
      base_price:  Number(form.base_price),
      price_unit:  'day',
      capacity:    Number(form.seats) || 5,
      status:      form.status,
      images:      form.images,
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
          <Input label="Marca" value={form.brand} onChange={set('brand')} placeholder="Toyota" autoFocus />
          <Input label="Modelo" value={form.model} onChange={set('model')} placeholder="Hilux" />
          <Input label="Ano" type="number" value={form.year} onChange={set('year')} placeholder="2022" min="1990" max="2030" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Input label="Matricula" value={form.plate} onChange={set('plate')} placeholder="AA-00-AA" />
          <Input label="Cor" value={form.color} onChange={set('color')} placeholder="Branco" />
          <Select label="Categoria" value={form.unit_type} onChange={set('unit_type')} required>
            {UNIT_TYPES_BY_OPERATOR.rentacar.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
        </div>
      </div>

      <div>
        <SectionLabel>Especificacoes</SectionLabel>
        <div className="grid grid-cols-4 gap-3">
          <Input label="Lugares" type="number" value={form.seats} onChange={set('seats')} min="1" max="20" />
          <Input label="Bagagens" type="number" value={form.luggage} onChange={set('luggage')} min="0" placeholder="2" />
          <Select label="Transmissao" value={form.transmission} onChange={set('transmission')}>
            <option value="manual">Manual</option>
            <option value="automatico">Automatico</option>
          </Select>
          <Select label="Combustivel" value={form.fuel} onChange={set('fuel')}>
            <option value="gasolina">Gasolina</option>
            <option value="diesel">Diesel</option>
            <option value="electrico">Electrico</option>
            <option value="hibrido">Hibrido</option>
          </Select>
        </div>
        {form.unit_type === 'Executivo' && (
          <div className="mt-3">
            <Input
              label="Tarifa de motorista (por dia)"
              type="number"
              value={form.chauffeur_daily_rate}
              onChange={set('chauffeur_daily_rate')}
              min="0"
              step="0.01"
              placeholder="30"
            />
            <p className="text-xs text-n-500 mt-1">Cobrada por dia quando o cliente escolhe "motorista incluido" na reserva.</p>
          </div>
        )}
      </div>

      <div>
        <SectionLabel>Comodidades</SectionLabel>
        <AmenitiesPicker options={CAR_AMENS} selected={form.amenities} onToggle={toggleAmen} />
      </div>

      <div>
        <SectionLabel>Precos (€)</SectionLabel>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Input label="Preco base / dia" type="number" value={form.base_price} onChange={set('base_price')} min="0" step="0.01" required placeholder="0.00" />
          <Input label="Km incluidos / dia" type="number" value={form.km_included} onChange={set('km_included')} min="0" placeholder="200" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Input label="Custo km extra (€)" type="number" value={form.km_extra_cost} onChange={set('km_extra_cost')} min="0" step="0.01" placeholder="0.30" />
          <Input label="Desc. semana (%)" type="number" value={form.discount_week} onChange={set('discount_week')} min="0" max="100" placeholder="10" />
          <Input label="Desc. mes (%)" type="number" value={form.discount_month} onChange={set('discount_month')} min="0" max="100" placeholder="20" />
        </div>
      </div>

      <div>
        <SectionLabel>Requisitos condutor</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Idade minima" type="number" value={form.min_age} onChange={set('min_age')} min="18" max="99" placeholder="21" />
          <Input label="Carta ha (anos)" type="number" value={form.license_years} onChange={set('license_years')} min="0" placeholder="1" />
        </div>
      </div>

      <div>
        <SectionLabel>Documentos — validades</SectionLabel>
        <div className="grid grid-cols-3 gap-3">
          <Input label="Seguro ate" type="date" value={form.seguro_expiry} onChange={set('seguro_expiry')} />
          <Input label="IUC ate" type="date" value={form.iuc_expiry} onChange={set('iuc_expiry')} />
          <Input label="Inspecao ate" type="date" value={form.inspecao_expiry} onChange={set('inspecao_expiry')} />
        </div>
      </div>

      <div>
        <SectionLabel>Quilometragem</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Km actuais" type="number" value={form.current_km} onChange={set('current_km')} min="0" placeholder="0" />
          <Input label="Proxima revisao (km)" type="number" value={form.next_revision_km} onChange={set('next_revision_km')} min="0" placeholder="10000" />
        </div>
      </div>

      <div>
        <SectionLabel>O que está incluído</SectionLabel>
        <IncludedItemsEditor items={form.included_items} onChange={items => setForm(f => ({ ...f, included_items: items }))} />
      </div>

      <div>
        <SectionLabel>Informação importante (opcional)</SectionLabel>
        <Textarea value={form.important_info} onChange={set('important_info')} placeholder="Ex: Caução exigida no levantamento, cartão de crédito obrigatório." rows={2} />
      </div>

      <div>
        <SectionLabel>Fotos</SectionLabel>
        <ImageUploader value={form.images} onChange={(urls) => setForm(f => ({ ...f, images: urls }))} maxImages={8} hint="Primeira foto = capa · max 8 fotos · 5MB cada" />
      </div>

      <OtaFields form={form} set={set} />
      <ConectFields form={form} set={set} />

      {unit && (
        <div>
          <SectionLabel>Estado</SectionLabel>
          <Select value={form.status} onChange={set('status')}>
            <option value="active">Activo</option>
            <option value="maintenance">Em manutencao</option>
            <option value="breakdown">Avaria</option>
            <option value="inactive">Inactivo</option>
          </Select>
        </div>
      )}

      {error && (
        <p className="text-sm font-body px-3 py-2 rounded-sm bg-[var(--error-light)] text-[var(--error)]">{error}</p>
      )}

      <div className="flex gap-3 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">Cancelar</Button>
        <Button type="submit" loading={loading} className="flex-1">
          {unit ? 'Guardar alteracoes' : 'Registar viatura'}
        </Button>
      </div>
    </form>
  );
}
