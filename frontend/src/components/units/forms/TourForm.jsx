import { useState } from 'react';
import Input, { Textarea, Select } from '../../ui/Input';
import Button from '../../ui/Button';
import ImageUploader from '../../shared/ImageUploader';
import {
  AmenitiesPicker, IncludedItemsEditor, StopsEditor, TimeSlotsEditor, PriceTiersEditor,
  SectionLabel, ChipToggle, OtaFields, ConectFields, buildOtaProductIds, LANGUAGES, UNIT_TYPES_BY_OPERATOR,
} from './editors';

const ACTIVITY_AMENS   = ['Equipamento incluído', 'Instrutor certificado', 'Seguro', 'Fotografias/Vídeo', 'Transporte', 'Snacks e água', 'Vestiário', 'Toalhas'];

export function parseTourMeta(description) {
  if (!description?.startsWith('{')) return {};
  try { return JSON.parse(description); } catch { return {}; }
}

export default function TourForm({ unit, onSave, onCancel, loading, error }) {
  const meta = parseTourMeta(unit?.description);

  const [form, setForm] = useState({
    name:          unit?.name          || '',
    name_en:       meta.name_en        || '',
    short_pt:      meta.short_pt       || '',
    short_en:      meta.short_en       || '',
    desc_pt:       meta.desc_pt        || '',
    desc_en:       meta.desc_en        || '',
    unit_type:     unit?.unit_type     || 'Tour',
    tour_type:     meta.tour_type      || 'grupo',
    duration:      meta.duration       != null ? String(meta.duration) : '',
    languages:     meta.languages      || ['PT', 'EN'],
    difficulty:    meta.difficulty     || 'Moderado',
    min_age:       meta.min_age        != null ? String(meta.min_age) : '',
    capacity:      unit?.capacity      != null ? String(unit.capacity) : '',
    meeting_point: meta.meeting_point  || '',
    start_time:    meta.start_time     || '',
    base_price:    unit?.base_price    != null ? String(unit.base_price) : '',
    price_child:   meta.price_child    != null ? String(meta.price_child) : '',
    price_private: meta.price_private  != null ? String(meta.price_private) : '',
    price_tiers:    (meta.price_tiers || []).map(t => ({ pax_min: String(t.pax_min ?? ''), pax_max: String(t.pax_max ?? ''), price: String(t.price ?? '') })),
    amenities:      meta.amenities      || [],
    included_items: meta.included_items || [],
    important_info: meta.important_info || '',
    stops:          meta.stops          || [],
    time_slots:     meta.time_slots     || [],
    status:   unit?.status  || 'active',
    images:   unit?.images  || [],
    ota_viator_id: unit?.ota_product_ids?.viator       || '',
    ota_gyg_id:    unit?.ota_product_ids?.getyourguide || '',
    lat: unit?.lat ?? '',
    lng: unit?.lng ?? '',
  });

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  function toggleLang(lang) {
    setForm(f => ({
      ...f,
      languages: f.languages.includes(lang)
        ? f.languages.filter(l => l !== lang)
        : [...f.languages, lang],
    }));
  }

  function toggleAmen(a) {
    setForm(f => ({
      ...f,
      amenities: f.amenities.includes(a) ? f.amenities.filter(x => x !== a) : [...f.amenities, a],
    }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const images = form.images || [];
    const tourMeta = {
      name_en:       form.name_en       || null,
      short_pt:      form.short_pt.trim() || null,
      short_en:      form.short_en.trim() || null,
      desc_pt:       form.desc_pt       || null,
      desc_en:       form.desc_en       || null,
      tour_type:     form.tour_type,
      duration:      form.duration      ? Number(form.duration)      : null,
      languages:     form.languages,
      difficulty:    form.difficulty,
      min_age:       form.min_age       ? Number(form.min_age)       : null,
      meeting_point: form.meeting_point || null,
      start_time:    form.start_time    || null,
      price_child:   form.price_child   ? Number(form.price_child)   : null,
      price_private: form.price_private ? Number(form.price_private) : null,
      price_tiers: form.price_tiers
        .filter(t => t.pax_min !== '' && t.pax_max !== '' && t.price !== '')
        .map(t => ({ pax_min: Number(t.pax_min), pax_max: Number(t.pax_max), price: Number(t.price) })),
      amenities:      form.amenities,
      included_items: form.included_items.filter(it => it.label.trim()),
      important_info: form.important_info || null,
      stops: form.stops
        .filter(s => s.name.trim())
        .map(s => ({
          name: s.name,
          desc: s.desc || null,
          lat: s.lat !== '' ? Number(s.lat) : null,
          lng: s.lng !== '' ? Number(s.lng) : null,
        })),
      time_slots: form.time_slots
        .filter(s => s.time && s.capacity)
        .map(s => ({ time: s.time, capacity: Number(s.capacity) })),
    };
    onSave({
      name:        form.name,
      description: JSON.stringify(tourMeta),
      unit_type:   form.unit_type,
      base_price:  form.base_price ? Number(form.base_price) : 0,
      price_unit:  'person',
      capacity:    Number(form.capacity),
      status:      form.status,
      images,
      ota_product_ids: buildOtaProductIds(form),
      lat: form.lat !== '' ? Number(form.lat) : null,
      lng: form.lng !== '' ? Number(form.lng) : null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      <div>
        <SectionLabel>Identificacao</SectionLabel>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Nome PT"
              value={form.name}
              onChange={set('name')}
              required
              autoFocus
              placeholder="Ex: Mergulho ao Amanhecer"
            />
            <Input
              label="Nome EN"
              value={form.name_en}
              onChange={set('name_en')}
              placeholder="Ex: Sunrise Dive"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Categoria" value={form.unit_type} onChange={set('unit_type')} required>
              {UNIT_TYPES_BY_OPERATOR.activity.map(tp => (
                <option key={tp} value={tp}>{tp}</option>
              ))}
              <option value="Outro">Outro</option>
            </Select>
            <Select label="Modalidade" value={form.tour_type} onChange={set('tour_type')}>
              <option value="grupo">Grupo</option>
              <option value="privado">Privado</option>
              <option value="ambos">Grupo e Privado</option>
            </Select>
          </div>
        </div>
      </div>

      <div>
        <SectionLabel>Descricao</SectionLabel>
        <div className="space-y-3">
          <Textarea
            label="Descricao curta PT"
            value={form.short_pt}
            onChange={set('short_pt')}
            placeholder="Resumo numa frase, mostrado logo abaixo do titulo..."
            rows={2}
            maxLength={160}
            hint={`${form.short_pt.length}/160 caracteres`}
          />
          <Textarea
            label="Descricao curta EN"
            value={form.short_en}
            onChange={set('short_en')}
            placeholder="One-sentence summary, shown right below the title..."
            rows={2}
            maxLength={160}
            hint={`${form.short_en.length}/160 characters`}
          />
          <Textarea
            label="Descricao longa PT"
            value={form.desc_pt}
            onChange={set('desc_pt')}
            placeholder="Descricao completa em portugues. Pode usar varios paragrafos (Enter)..."
            rows={6}
          />
          <Textarea
            label="Descricao longa EN"
            value={form.desc_en}
            onChange={set('desc_en')}
            placeholder="Full description in English. You can use several paragraphs (Enter)..."
            rows={6}
          />
        </div>
      </div>

      <div>
        <SectionLabel>Detalhes Operacionais</SectionLabel>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Duracao (horas)"
              type="number"
              value={form.duration}
              onChange={set('duration')}
              min="0.5"
              step="0.5"
              placeholder="Ex: 2.5"
            />
            <Select label="Dificuldade" value={form.difficulty} onChange={set('difficulty')}>
              <option value="Facil">Facil</option>
              <option value="Moderado">Moderado</option>
              <option value="Dificil">Dificil</option>
            </Select>
            <Input
              label="Idade minima"
              type="number"
              value={form.min_age}
              onChange={set('min_age')}
              min="0"
              placeholder="Ex: 8"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Capacidade maxima"
              type="number"
              value={form.capacity}
              onChange={set('capacity')}
              min="1"
              required
              placeholder="Ex: 12"
            />
            <Input
              label="Hora de inicio"
              type="time"
              value={form.start_time}
              onChange={set('start_time')}
            />
            <Input
              label="Ponto de encontro"
              value={form.meeting_point}
              onChange={set('meeting_point')}
              placeholder="Ex: Marina Santa Maria"
            />
          </div>
        </div>
      </div>

      <div>
        <SectionLabel>Idiomas</SectionLabel>
        <div className="flex flex-wrap gap-2 mt-1">
          {LANGUAGES.map(lang => (
            <ChipToggle
              key={lang}
              label={lang}
              checked={form.languages.includes(lang)}
              onChange={() => toggleLang(lang)}
            />
          ))}
        </div>
      </div>

      <div>
        <SectionLabel>Precos (€ por pessoa)</SectionLabel>
        <div className="grid grid-cols-3 gap-3">
          <Input
            label="Preco adulto (opcional se usar Preço privado/Escalões)"
            type="number"
            value={form.base_price}
            onChange={set('base_price')}
            min="0"
            step="0.01"
            placeholder="0.00"
          />
          <Input
            label="Preco crianca"
            type="number"
            value={form.price_child}
            onChange={set('price_child')}
            min="0"
            step="0.01"
            placeholder="0.00"
          />
          <Input
            label="Preco privado"
            type="number"
            value={form.price_private}
            onChange={set('price_private')}
            min="0"
            step="0.01"
            placeholder="0.00"
          />
        </div>
      </div>

      <div>
        <SectionLabel>Escalões de preço privado por nº de pessoas (opcional)</SectionLabel>
        <PriceTiersEditor tiers={form.price_tiers} onChange={price_tiers => setForm(f => ({ ...f, price_tiers }))} />
      </div>

      <div>
        <SectionLabel>Comodidades</SectionLabel>
        <AmenitiesPicker options={ACTIVITY_AMENS} selected={form.amenities} onToggle={toggleAmen} />
      </div>

      <div>
        <SectionLabel>O que está incluído</SectionLabel>
        <IncludedItemsEditor items={form.included_items} onChange={items => setForm(f => ({ ...f, included_items: items }))} />
      </div>

      <div>
        <SectionLabel>Horários com lugares limitados (opcional)</SectionLabel>
        <TimeSlotsEditor slots={form.time_slots} onChange={time_slots => setForm(f => ({ ...f, time_slots }))} />
      </div>

      <div>
        <SectionLabel>Itinerário (opcional)</SectionLabel>
        <StopsEditor stops={form.stops} onChange={stops => setForm(f => ({ ...f, stops }))} />
      </div>

      <div>
        <SectionLabel>Informação importante (opcional)</SectionLabel>
        <Textarea value={form.important_info} onChange={set('important_info')} placeholder="Ex: Traga roupa confortável e protector solar." rows={2} />
      </div>

      <div>
        <SectionLabel>Fotos</SectionLabel>
        <ImageUploader
          value={form.images}
          onChange={(urls) => setForm(f => ({ ...f, images: urls }))}
          maxImages={10}
          hint="Primeira foto = capa principal · max 10 fotos · 5MB cada"
        />
      </div>

      <OtaFields form={form} set={set} />
      <ConectFields form={form} set={set} />

      {unit && (
        <div>
          <SectionLabel>Estado</SectionLabel>
          <Select value={form.status} onChange={set('status')}>
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
          </Select>
        </div>
      )}

      {error && (
        <p className="text-sm font-body px-3 py-2 rounded-sm bg-[var(--error-light)] text-[var(--error)]">
          {error}
        </p>
      )}

      <div className="flex gap-3 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
          Cancelar
        </Button>
        <Button type="submit" loading={loading} className="flex-1">
          {unit ? 'Guardar alteracoes' : 'Criar tour'}
        </Button>
      </div>
    </form>
  );
}
