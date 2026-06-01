import { useState } from 'react';
import { useT } from '../../i18n';
import Input, { Textarea, Select } from '../ui/Input';
import Button from '../ui/Button';

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
    status:        unit?.status        || 'active',
    images_raw:    unit?.images?.join(', ') || '',
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
    const images = form.images_raw.split(',').map(s => s.trim()).filter(Boolean);
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
        <Textarea
          label="URLs das fotos (separados por virgula)"
          value={form.images_raw}
          onChange={set('images_raw')}
          placeholder="https://exemplo.com/foto1.jpg, https://exemplo.com/foto2.jpg"
          rows={2}
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

  const tipos      = UNIT_TYPES_BY_OPERATOR[operatorType] || [];
  const priceUnits = PRICE_UNITS_BY_OPERATOR[operatorType] || [{ value: 'day', label: 'por dia' }];

  const [form, setForm] = useState({
    name:        unit?.name        || '',
    description: unit?.description || '',
    unit_type:   unit?.unit_type   || tipos[0] || '',
    base_price:  unit?.base_price  ?? '',
    price_unit:  unit?.price_unit  || priceUnits[0]?.value || 'night',
    capacity:    unit?.capacity    ?? 1,
    status:      unit?.status      || 'active',
    images_raw:  unit?.images?.join(', ') || '',
  });

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  function handleSubmit(e) {
    e.preventDefault();
    const images = form.images_raw.split(',').map(s => s.trim()).filter(Boolean);
    onSave({
      name:        form.name,
      description: form.description,
      unit_type:   form.unit_type,
      base_price:  Number(form.base_price),
      price_unit:  form.price_unit,
      capacity:    Number(form.capacity),
      status:      form.status,
      images,
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

      <Textarea
        label="Fotos (URLs separados por virgula)"
        value={form.images_raw}
        onChange={set('images_raw')}
        placeholder="https://exemplo.com/foto1.jpg, https://exemplo.com/foto2.jpg"
        rows={2}
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
