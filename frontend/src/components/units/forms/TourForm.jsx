import { useState } from 'react';
import Input, { Textarea, Select } from '../../ui/Input';
import Button from '../../ui/Button';
import ImageUploader from '../../shared/ImageUploader';
import {
  AmenitiesPicker, IncludedItemsEditor, StopsEditor, TimeSlotsEditor, PriceTiersEditor,
  SectionLabel, ChipToggle, OtaFields, buildOtaProductIds, LANGUAGES, UNIT_TYPES_BY_OPERATOR,
} from './editors';
import LocalizacaoPontoEncontro from './LocalizacaoPontoEncontro';
import {
  SeccoesOpcoes, opcoesParaForm, suplementosParaForm, ofertasParaForm,
  temErrosOpcoes, opcoesParaMeta, suplementosParaMeta, ofertasParaMeta,
} from './OpcoesActividade';
import { useT } from '../../../i18n';
import { DIFICULDADE_CHAVE, rotuloDificuldade, rotuloComodidadeActividade, rotuloTipoUnidade } from '../rotulosUnidades';
import { useLingua } from '../../../utils/formatoLingua';

/* Rotulos gravados em portugues; a pagina publica traduz-os em EN (utils/paginaActividade) */
export const ACTIVITY_AMENS   = ['Equipamento incluído', 'Instrutor certificado', 'Seguro', 'Fotografias/Vídeo', 'Transporte', 'Snacks e água', 'Vestiário', 'Toalhas'];

export function parseTourMeta(description) {
  if (!description?.startsWith('{')) return {};
  try { return JSON.parse(description); } catch { return {}; }
}

export default function TourForm({ unit, onSave, onCancel, loading, error }) {
  const t = useT();
  const lang = useLingua();
  const meta = parseTourMeta(unit?.description);
  const [tentouGuardar, setTentouGuardar] = useState(false);

  const [form, setForm] = useState({
    name:          unit?.name          || '',
    name_en:       meta.name_en        || '',
    short_pt:      meta.short_pt       || '',
    short_en:      meta.short_en       || '',
    desc_pt:       meta.desc_pt        || '',
    desc_en:       meta.desc_en        || '',
    highlights_pt: meta.highlights_pt  || '',
    highlights_en: meta.highlights_en  || '',
    what_to_bring_pt: meta.what_to_bring_pt || '',
    what_to_bring_en: meta.what_to_bring_en || '',
    unit_type:     unit?.unit_type     || 'Tour',
    tour_type:     meta.tour_type      || 'grupo',
    duration:      meta.duration       != null ? String(meta.duration) : '',
    languages:     meta.languages      || ['PT', 'EN'],
    difficulty:    meta.difficulty     || 'Moderado',
    min_age:       meta.min_age        != null ? String(meta.min_age) : '',
    capacity:      unit?.capacity      != null ? String(unit.capacity) : '',
    meeting_point: meta.meeting_point  || '',
    pickup_included: meta.pickup_included === true,
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
    options:             opcoesParaForm(meta),
    language_surcharges: suplementosParaForm(meta),
    offers:              ofertasParaForm(meta),
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
    /* Opcoes, suplementos e ofertas invalidos bloqueiam a gravacao; os erros aparecem nas linhas */
    if (temErrosOpcoes(form)) { setTentouGuardar(true); return; }
    const images = form.images || [];
    const tourMeta = {
      name_en:       form.name_en       || null,
      short_pt:      form.short_pt.trim() || null,
      short_en:      form.short_en.trim() || null,
      desc_pt:       form.desc_pt       || null,
      desc_en:       form.desc_en       || null,
      highlights_pt: form.highlights_pt.trim() || null,
      highlights_en: form.highlights_en.trim() || null,
      what_to_bring_pt: form.what_to_bring_pt.trim() || null,
      what_to_bring_en: form.what_to_bring_en.trim() || null,
      tour_type:     form.tour_type,
      duration:      form.duration      ? Number(form.duration)      : null,
      languages:     form.languages,
      difficulty:    form.difficulty,
      min_age:       form.min_age       ? Number(form.min_age)       : null,
      meeting_point: form.meeting_point || null,
      pickup_included: form.pickup_included === true,
      start_time:    form.start_time    || null,
      /* 0 e um preco valido (criancas gratis); so o campo vazio fica sem preco de crianca */
      price_child:   form.price_child !== '' ? Number(form.price_child) : null,
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
    /* So grava as chaves novas quando ha conteudo: actividades sem opcoes ficam como estavam */
    const opcoes = opcoesParaMeta(form.options);
    if (opcoes.length > 0) tourMeta.options = opcoes;
    const suplementos = suplementosParaMeta(form.language_surcharges, form.languages);
    if (Object.keys(suplementos).length > 0) tourMeta.language_surcharges = suplementos;
    const ofertas = ofertasParaMeta(form.offers);
    if (ofertas.length > 0) tourMeta.offers = ofertas;
    /* Com opcoes, o preco "desde" de todo o lado passa a ser o da opcao mais barata */
    const precoBase = opcoes.length > 0
      ? Math.min(...opcoes.map(o => o.price))
      : (form.base_price ? Number(form.base_price) : 0);
    onSave({
      name:        form.name,
      description: JSON.stringify(tourMeta),
      unit_type:   form.unit_type,
      base_price:  precoBase,
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
        <SectionLabel>{t('unitForm.section.identification')}</SectionLabel>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t('unitForm.tour.namePt')}
              value={form.name}
              onChange={set('name')}
              required
              autoFocus
              placeholder={t('unitForm.tour.namePtPh')}
            />
            <Input
              label={t('unitForm.tour.nameEn')}
              value={form.name_en}
              onChange={set('name_en')}
              placeholder={t('unitForm.tour.nameEnPh')}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label={t('unitForm.tour.category')} value={form.unit_type} onChange={set('unit_type')} required>
              {UNIT_TYPES_BY_OPERATOR.activity.map(tp => (
                <option key={tp} value={tp}>{rotuloTipoUnidade(tp, t, lang)}</option>
              ))}
              <option value="Outro">{t('unitForm.tour.other')}</option>
            </Select>
            <Select label={t('unitForm.tour.mode')} value={form.tour_type} onChange={set('tour_type')}>
              <option value="grupo">{t('unitForm.tour.modeGroup')}</option>
              <option value="privado">{t('unitForm.tour.modePrivate')}</option>
              <option value="ambos">{t('unitForm.tour.modeBoth')}</option>
            </Select>
          </div>
        </div>
      </div>

      <div>
        <SectionLabel>{t('unitForm.section.description')}</SectionLabel>
        <div className="space-y-3">
          <Textarea
            label={t('unitForm.tour.shortPt')}
            value={form.short_pt}
            onChange={set('short_pt')}
            placeholder={t('unitForm.tour.shortPtPh')}
            rows={2}
            maxLength={160}
            hint={t('unitForm.tour.charsPt', { n: form.short_pt.length })}
          />
          <Textarea
            label={t('unitForm.tour.shortEn')}
            value={form.short_en}
            onChange={set('short_en')}
            placeholder={t('unitForm.tour.shortEnPh')}
            rows={2}
            maxLength={160}
            hint={t('unitForm.tour.charsEn', { n: form.short_en.length })}
          />
          <Textarea
            label={t('unitForm.tour.longPt')}
            value={form.desc_pt}
            onChange={set('desc_pt')}
            placeholder={t('unitForm.tour.longPtPh')}
            rows={6}
          />
          <Textarea
            label={t('unitForm.tour.longEn')}
            value={form.desc_en}
            onChange={set('desc_en')}
            placeholder={t('unitForm.tour.longEnPh')}
            rows={6}
          />
        </div>
      </div>

      <div>
        <SectionLabel>{t('unitForm.section.highlights')}</SectionLabel>
        <div className="space-y-3">
          <Textarea
            label={t('unitForm.tour.highlightsPt')}
            value={form.highlights_pt}
            onChange={set('highlights_pt')}
            placeholder={t('unitForm.tour.highlightsPtPh')}
            rows={4}
          />
          <Textarea
            label={t('unitForm.tour.highlightsEn')}
            value={form.highlights_en}
            onChange={set('highlights_en')}
            placeholder={t('unitForm.tour.highlightsEnPh')}
            rows={4}
          />
          <Textarea
            label={t('unitForm.tour.bringPt')}
            value={form.what_to_bring_pt}
            onChange={set('what_to_bring_pt')}
            placeholder={t('unitForm.tour.bringPtPh')}
            rows={3}
          />
          <Textarea
            label={t('unitForm.tour.bringEn')}
            value={form.what_to_bring_en}
            onChange={set('what_to_bring_en')}
            placeholder={t('unitForm.tour.bringEnPh')}
            rows={3}
          />
        </div>
      </div>

      <div>
        <SectionLabel>{t('unitForm.section.operational')}</SectionLabel>
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Input
              label={t('unitForm.tour.duration')}
              type="number"
              value={form.duration}
              onChange={set('duration')}
              min="0.5"
              step="0.5"
              placeholder={t('unitForm.tour.durationPh')}
            />
            <Select label={t('unitForm.tour.difficulty')} value={form.difficulty} onChange={set('difficulty')}>
              {Object.keys(DIFICULDADE_CHAVE).map(v => (
                <option key={v} value={v}>{rotuloDificuldade(v, t)}</option>
              ))}
            </Select>
            <Input
              label={t('unitForm.tour.minAge')}
              type="number"
              value={form.min_age}
              onChange={set('min_age')}
              min="0"
              placeholder={t('unitForm.tour.minAgePh')}
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Input
              label={t('unitForm.tour.capacity')}
              type="number"
              value={form.capacity}
              onChange={set('capacity')}
              min="1"
              required
              placeholder={t('unitForm.tour.capacityPh')}
            />
            <Input
              label={t('unitForm.tour.startTime')}
              type="time"
              value={form.start_time}
              onChange={set('start_time')}
            />
            <Input
              label={t('unitForm.tour.meetingPoint')}
              value={form.meeting_point}
              onChange={set('meeting_point')}
              placeholder={t('unitForm.tour.meetingPointPh')}
            />
          </div>
          {/* Mostrado nos cartoes do catalogo como "Recolha no hotel" */}
          <label className="mt-3 flex items-center gap-2 text-sm font-body text-n-700 cursor-pointer">
            <input type="checkbox" checked={form.pickup_included}
              onChange={e => setForm(f => ({ ...f, pickup_included: e.target.checked }))}
              className="w-4 h-4 accent-[var(--ocean-700)]" />
            {t('unitForm.tour.pickup')}
          </label>
          {/* Mapa do ponto de encontro: mostrado na pagina do servico e no mapa do catalogo */}
          <LocalizacaoPontoEncontro lat={form.lat} lng={form.lng}
            onChange={({ lat, lng }) => setForm(f => ({ ...f, lat, lng }))} />
        </div>
      </div>

      <div>
        <SectionLabel>{t('unitForm.section.languages')}</SectionLabel>
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
        <SectionLabel>{t('unitForm.section.prices')}</SectionLabel>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Input
            label={t('unitForm.tour.priceAdult')}
            type="number"
            value={form.base_price}
            onChange={set('base_price')}
            min="0"
            step="0.01"
            placeholder="0.00"
          />
          <Input
            label={t('unitForm.tour.priceChild')}
            type="number"
            value={form.price_child}
            onChange={set('price_child')}
            min="0"
            step="0.01"
            placeholder="0.00"
          />
          <Input
            label={t('unitForm.tour.pricePrivate')}
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
        <SectionLabel>{t('unitForm.section.tiers')}</SectionLabel>
        <PriceTiersEditor tiers={form.price_tiers} onChange={price_tiers => setForm(f => ({ ...f, price_tiers }))} />
      </div>

      {/* Opcoes (variantes), suplemento de idioma do guia e ofertas automaticas */}
      <SeccoesOpcoes form={form} setForm={setForm} mostrarErros={tentouGuardar} />

      <div>
        <SectionLabel>{t('unitForm.section.amenities')}</SectionLabel>
        <AmenitiesPicker options={ACTIVITY_AMENS} selected={form.amenities} onToggle={toggleAmen}
          rotulo={(a) => rotuloComodidadeActividade(a, t)} />
      </div>

      <div>
        <SectionLabel>{t('unitForm.section.included')}</SectionLabel>
        <IncludedItemsEditor items={form.included_items} onChange={items => setForm(f => ({ ...f, included_items: items }))} />
      </div>

      <div>
        <SectionLabel>{t('unitForm.section.timeSlots')}</SectionLabel>
        <TimeSlotsEditor slots={form.time_slots} onChange={time_slots => setForm(f => ({ ...f, time_slots }))} />
      </div>

      <div>
        <SectionLabel>{t('unitForm.section.itinerary')}</SectionLabel>
        <StopsEditor stops={form.stops} onChange={stops => setForm(f => ({ ...f, stops }))} />
      </div>

      <div>
        <SectionLabel>{t('unitForm.section.importantInfo')}</SectionLabel>
        <Textarea value={form.important_info} onChange={set('important_info')} placeholder={t('unitForm.tour.importantInfoPh')} rows={2} />
      </div>

      <div>
        <SectionLabel>{t('unitForm.section.photos')}</SectionLabel>
        <ImageUploader
          value={form.images}
          onChange={(urls) => setForm(f => ({ ...f, images: urls }))}
          maxImages={10}
          hint={t('unitForm.tour.photosHint')}
        />
      </div>

      <OtaFields form={form} set={set} />

      {unit && (
        <div>
          <SectionLabel>{t('unitForm.section.status')}</SectionLabel>
          <Select value={form.status} onChange={set('status')}>
            <option value="active">{t('unitForm.tour.active')}</option>
            <option value="inactive">{t('unitForm.tour.inactive')}</option>
          </Select>
        </div>
      )}

      {tentouGuardar && temErrosOpcoes(form) && (
        <p className="text-sm font-body px-3 py-2 rounded-sm bg-[var(--error-light)] text-[var(--error)]">
          {t('opcoesActividade.fixErrors')}
        </p>
      )}

      {error && (
        <p className="text-sm font-body px-3 py-2 rounded-sm bg-[var(--error-light)] text-[var(--error)]">
          {error}
        </p>
      )}

      <div className="flex gap-3 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
          {t('common.cancel')}
        </Button>
        <Button type="submit" loading={loading} className="flex-1">
          {unit ? t('unitForm.tour.saveChanges') : t('unitForm.tour.create')}
        </Button>
      </div>
    </form>
  );
}
