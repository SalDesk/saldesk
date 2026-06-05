import { useState } from 'react';
import { useT } from '../../i18n';
import Input, { Textarea, Select } from '../ui/Input';
import Button from '../ui/Button';
import ImageUploader from '../shared/ImageUploader';

const UNIT_TYPES_BY_OPERATOR = {
  hotel:      ['Quarto Standard', 'Quarto Double', 'Suite', 'Apartamento', 'Villa', 'Bungalow'],
  activity:   ['Mergulho', 'Kitesurf', 'Snorkeling', 'Passeio de Barco', 'Quad / Buggy', 'Pesca', 'Surf', 'Windsurf', 'Tour', 'Sessao'],
  rentacar:   ['Economico', 'Compacto', 'SUV', 'Pickup', 'Moto', 'Van'],
  restaurant: ['Mesa Interior', 'Mesa Exterior', 'Mesa VIP', 'Terraco'],
};

const PRICE_UNITS_BY_OPERATOR = {
  hotel:      [{ value: 'night',   label: 'por noite'  }],
  activity:   [{ value: 'person',  label: 'por pessoa' }, { value: 'session', label: 'por sessao' }],
  rentacar:   [{ value: 'day',     label: 'por dia'    }],
  restaurant: [{ value: 'hour',    label: 'por hora'   }],
};

const LANGUAGES = ['PT', 'EN', 'DE', 'NL', 'FR', 'ES'];

export function parseTourMeta(description) {
  if (!description?.startsWith('{')) return {};
  try { return JSON.parse(description); } catch { return {}; }
}

function SectionLabel({ children }) {
  return (
    <p className="text-xs font-body font-bold uppercase tracking-wide text-ocean-700 border-b border-n-100 pb-1 mb-1">
      {children}
    </p>
  );
}

function TourForm({ unit, onSave, onCancel, loading, error }) {
  const meta = parseTourMeta(unit?.description);

  const [form, setForm] = useState({
    name:          unit?.name          || '',
    name_en:       meta.name_en        || '',
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
    status:   unit?.status  || 'active',
    images:   unit?.images  || [],
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

  function handleSubmit(e) {
    e.preventDefault();
    const images = form.images || [];
    const tourMeta = {
      name_en:       form.name_en       || null,
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
    };
    onSave({
      name:        form.name,
      description: JSON.stringify(tourMeta),
      unit_type:   form.unit_type,
      base_price:  Number(form.base_price),
      price_unit:  'person',
      capacity:    Number(form.capacity),
      status:      form.status,
      images,
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
            label="Descricao PT"
            value={form.desc_pt}
            onChange={set('desc_pt')}
            placeholder="Descricao em portugues..."
            rows={2}
          />
          <Textarea
            label="Descricao EN"
            value={form.desc_en}
            onChange={set('desc_en')}
            placeholder="Description in English..."
            rows={2}
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
            <label
              key={lang}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm border text-xs font-body font-medium cursor-pointer transition-colors select-none ${
                form.languages.includes(lang)
                  ? 'bg-ocean-700 border-ocean-700 text-white'
                  : 'bg-n-50 border-n-300 text-n-600 hover:border-ocean-500'
              }`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={form.languages.includes(lang)}
                onChange={() => toggleLang(lang)}
              />
              {lang}
            </label>
          ))}
        </div>
      </div>

      <div>
        <SectionLabel>Precos (€ por pessoa)</SectionLabel>
        <div className="grid grid-cols-3 gap-3">
          <Input
            label="Preco adulto"
            type="number"
            value={form.base_price}
            onChange={set('base_price')}
            min="0"
            step="0.01"
            required
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
        <SectionLabel>Fotos</SectionLabel>
        <ImageUploader
          value={form.images}
          onChange={(urls) => setForm(f => ({ ...f, images: urls }))}
          maxImages={10}
          hint="Primeira foto = capa principal · max 10 fotos · 5MB cada"
        />
      </div>

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

const ROOM_TYPES  = ['Single', 'Double', 'Twin', 'Suite', 'Apartamento', 'Villa', 'Bungalow'];
const ROOM_VIEWS  = ['Mar', 'Jardim', 'Piscina', 'Cidade', 'Sem vista'];
const ROOM_AMENS  = ['AC', 'TV', 'WiFi', 'Cofre', 'Minibar', 'Jacuzzi', 'Varanda', 'Banheira', 'Cozinha'];

function parseRoomMeta(description) {
  if (!description?.startsWith('{')) return {};
  try { return JSON.parse(description); } catch { return {}; }
}

function HotelRoomForm({ unit, onSave, onCancel, loading, error }) {
  const meta = parseRoomMeta(unit?.description);

  const [form, setForm] = useState({
    number:        meta.number         || '',
    name:          unit?.name          || '',
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
    description:   meta.description    || '',
    status:        unit?.status        || 'active',
    images:        unit?.images        || [],
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
      floor:         form.floor         || null,
      view:          form.view,
      capacity_kids: Number(form.capacity_kids || 0),
      amenities:     form.amenities,
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
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      <div>
        <SectionLabel>Identificacao</SectionLabel>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <Input label="Numero" value={form.number} onChange={set('number')} placeholder="101" />
          <div className="col-span-2">
            <Input label="Nome" value={form.name} onChange={set('name')} required autoFocus placeholder="Ocean View Suite" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Select label="Tipo" value={form.unit_type} onChange={set('unit_type')} required>
            {ROOM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
          <Input label="Andar" value={form.floor} onChange={set('floor')} placeholder="1" />
          <Select label="Vista" value={form.view} onChange={set('view')}>
            {ROOM_VIEWS.map(v => <option key={v} value={v}>{v}</option>)}
          </Select>
        </div>
      </div>

      <div>
        <SectionLabel>Capacidade</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Adultos" type="number" value={form.capacity}      onChange={set('capacity')}      min="1" required />
          <Input label="Criancas" type="number" value={form.capacity_kids} onChange={set('capacity_kids')} min="0" />
        </div>
      </div>

      <div>
        <SectionLabel>Comodidades</SectionLabel>
        <div className="flex flex-wrap gap-2 mt-1">
          {ROOM_AMENS.map(a => (
            <label
              key={a}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm border text-xs font-body font-medium cursor-pointer transition-colors select-none ${
                form.amenities.includes(a)
                  ? 'bg-ocean-700 border-ocean-700 text-white'
                  : 'bg-n-50 border-n-300 text-n-600 hover:border-ocean-500'
              }`}
            >
              <input type="checkbox" className="sr-only" checked={form.amenities.includes(a)} onChange={() => toggleAmen(a)} />
              {a}
            </label>
          ))}
        </div>
      </div>

      <div>
        <SectionLabel>Precos por epoca (€ / noite)</SectionLabel>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Input label="Preco base"   type="number" value={form.base_price} onChange={set('base_price')} min="0" step="0.01" required placeholder="0.00" />
          <Input label="Epoca baixa"  type="number" value={form.price_low}  onChange={set('price_low')}  min="0" step="0.01" placeholder="0.00" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Input label="Epoca media"  type="number" value={form.price_mid}  onChange={set('price_mid')}  min="0" step="0.01" placeholder="0.00" />
          <Input label="Epoca alta"   type="number" value={form.price_high} onChange={set('price_high')} min="0" step="0.01" placeholder="0.00" />
          <Input label="Pico"         type="number" value={form.price_peak} onChange={set('price_peak')} min="0" step="0.01" placeholder="0.00" />
        </div>
      </div>

      <div>
        <SectionLabel>Descricao</SectionLabel>
        <Textarea value={form.description} onChange={set('description')} placeholder="Descricao do quarto..." rows={2} />
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

      {unit && (
        <div>
          <SectionLabel>Estado</SectionLabel>
          <Select value={form.status} onChange={set('status')}>
            <option value="active">Activo</option>
            <option value="cleaning">Em limpeza</option>
            <option value="maintenance">Em manutencao</option>
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
          {unit ? 'Guardar alteracoes' : 'Criar quarto'}
        </Button>
      </div>
    </form>
  );
}

const CAR_AMENS = ['AC', 'GPS', 'Bluetooth', 'USB', 'Cadeira bebe', '4x4', 'Teto solar', 'Camera re'];

function parseVehicleMeta(description) {
  if (!description?.startsWith('{')) return {};
  try { return JSON.parse(description); } catch { return {}; }
}

function RentacarVehicleForm({ unit, onSave, onCancel, loading, error }) {
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
    base_price:      unit?.base_price   != null ? String(unit.base_price) : '',
    discount_week:   meta.discount_week != null ? String(meta.discount_week) : '',
    discount_month:  meta.discount_month!= null ? String(meta.discount_month) : '',
    km_included:     meta.km_included   != null ? String(meta.km_included) : '',
    km_extra_cost:   meta.km_extra_cost != null ? String(meta.km_extra_cost) : '',
    min_age:         meta.min_age       != null ? String(meta.min_age) : '21',
    license_years:   meta.license_years != null ? String(meta.license_years) : '1',
    seguro_expiry:   meta.seguro_expiry   || '',
    iuc_expiry:      meta.iuc_expiry      || '',
    inspecao_expiry: meta.inspecao_expiry || '',
    current_km:      meta.current_km    != null ? String(meta.current_km) : '',
    next_revision_km:meta.next_revision_km!= null ? String(meta.next_revision_km) : '',
    status:          unit?.status       || 'active',
    images:          unit?.images       || [],
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
      discount_week:   form.discount_week   ? Number(form.discount_week)   : null,
      discount_month:  form.discount_month  ? Number(form.discount_month)  : null,
      km_included:     form.km_included     ? Number(form.km_included)     : null,
      km_extra_cost:   form.km_extra_cost   ? Number(form.km_extra_cost)   : null,
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
      </div>

      <div>
        <SectionLabel>Comodidades</SectionLabel>
        <div className="flex flex-wrap gap-2 mt-1">
          {CAR_AMENS.map(a => (
            <label key={a} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm border text-xs font-body font-medium cursor-pointer transition-colors select-none ${
              form.amenities.includes(a) ? 'bg-ocean-700 border-ocean-700 text-white' : 'bg-n-50 border-n-300 text-n-600 hover:border-ocean-500'
            }`}>
              <input type="checkbox" className="sr-only" checked={form.amenities.includes(a)} onChange={() => toggleAmen(a)} />
              {a}
            </label>
          ))}
        </div>
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
        <SectionLabel>Fotos</SectionLabel>
        <ImageUploader value={form.images} onChange={(urls) => setForm(f => ({ ...f, images: urls }))} maxImages={8} hint="Primeira foto = capa · max 8 fotos · 5MB cada" />
      </div>

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

const TABLE_ZONES = ['interior', 'esplanada', 'terraco', 'vip', 'privado'];
const ZONE_LABEL_MAP = { interior: 'Interior', esplanada: 'Esplanada', terraco: 'Terraco', vip: 'VIP', privado: 'Privado' };

function parseTableMeta(description) {
  if (!description?.startsWith('{')) return {};
  try { return JSON.parse(description); } catch { return {}; }
}

function RestaurantTableForm({ unit, onSave, onCancel, loading, error }) {
  const meta = parseTableMeta(unit?.description);

  const [form, setForm] = useState({
    number:       meta.number       || '',
    name:         unit?.name        || '',
    zone:         meta.zone         || 'interior',
    capacity_min: meta.capacity_min != null ? String(meta.capacity_min) : '1',
    capacity_max: meta.capacity_max != null ? String(meta.capacity_max) : String(unit?.capacity ?? '4'),
    combinable:   meta.combinable   ?? false,
    status:       unit?.status      || 'active',
  });

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  function handleSubmit(e) {
    e.preventDefault();
    const tableMeta = {
      number:       form.number       || null,
      zone:         form.zone,
      capacity_min: Number(form.capacity_min) || 1,
      capacity_max: Number(form.capacity_max) || 4,
      combinable:   form.combinable,
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
          <span className="text-sm font-body text-n-700">Mesa combinavel com outras</span>
        </label>
      </div>

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

export default function UnitForm({ unit, operatorType, onSave, onCancel, loading, error }) {
  const t = useT();

  if (operatorType === 'activity') {
    return (
      <TourForm
        unit={unit}
        onSave={onSave}
        onCancel={onCancel}
        loading={loading}
        error={error}
      />
    );
  }

  if (operatorType === 'hotel') {
    return (
      <HotelRoomForm
        unit={unit}
        onSave={onSave}
        onCancel={onCancel}
        loading={loading}
        error={error}
      />
    );
  }

  if (operatorType === 'restaurant') {
    return (
      <RestaurantTableForm
        unit={unit}
        onSave={onSave}
        onCancel={onCancel}
        loading={loading}
        error={error}
      />
    );
  }

  if (operatorType === 'rentacar') {
    return (
      <RentacarVehicleForm
        unit={unit}
        onSave={onSave}
        onCancel={onCancel}
        loading={loading}
        error={error}
      />
    );
  }

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
