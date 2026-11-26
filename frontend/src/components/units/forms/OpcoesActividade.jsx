import Input, { Select } from '../../ui/Input';
import { useT } from '../../../i18n';
import { novoIdOpcao } from '../../../utils/opcoesActividade';
import { SectionLabel, CAIXA_SECAO, AddRowButton, RemoveRowButton } from './editors';

/* Opcoes (variantes), suplemento de idioma do guia e ofertas automaticas da actividade.
   Estado do formulario em texto; os ajudantes abaixo convertem de e para o meta gravado. */

const TIPOS = ['per_person', 'per_group', 'per_vehicle'];
const TIPO_CHAVE = { per_person: 'typePerPerson', per_group: 'typePerGroup', per_vehicle: 'typePerVehicle' };

const txt = (v) => (v === undefined || v === null ? '' : String(v));

/* ---------- do meta para o estado do formulario ---------- */

export function opcoesParaForm(meta) {
  return (Array.isArray(meta?.options) ? meta.options : []).filter(Boolean).map((o) => ({
    id: o.id ? String(o.id) : novoIdOpcao(),
    name_pt: txt(o.name_pt),
    name_en: txt(o.name_en),
    type: TIPOS.includes(o.type) ? o.type : 'per_person',
    price: txt(o.price),
    price_child: txt(o.price_child),
    seats: txt(o.seats),
  }));
}

export function suplementosParaForm(meta) {
  const saida = {};
  const t = meta?.language_surcharges;
  if (t && typeof t === 'object') {
    for (const [k, v] of Object.entries(t)) saida[String(k).toUpperCase()] = txt(v);
  }
  return saida;
}

export function ofertasParaForm(meta) {
  return (Array.isArray(meta?.offers) ? meta.offers : []).filter(Boolean).map((o) => ({
    percent: txt(o.percent),
    from: txt(o.from),
    to: txt(o.to),
    label_pt: txt(o.label_pt),
    label_en: txt(o.label_en),
  }));
}

/* ---------- validacao (devolve a chave i18n do erro, ou null) ---------- */

export function errosOpcao(o) {
  const erros = {};
  if (!o.name_pt.trim()) erros.name_pt = 'errNameRequired';
  const preco = Number(o.price);
  if (o.price === '' || !Number.isFinite(preco) || preco <= 0) erros.price = 'errPrice';
  if (o.type === 'per_vehicle') {
    const lugares = Number(o.seats);
    if (o.seats === '' || !Number.isInteger(lugares) || lugares < 1) erros.seats = 'errSeats';
  }
  if (o.type === 'per_person' && o.price_child !== '') {
    const c = Number(o.price_child);
    if (!Number.isFinite(c) || c < 0) erros.price_child = 'errPriceChild';
  }
  return erros;
}

export function errosOferta(o) {
  const erros = {};
  const p = Number(o.percent);
  if (o.percent === '' || !Number.isInteger(p) || p < 1 || p > 90) erros.percent = 'errPercent';
  if (!o.from || !o.to) erros.dates = 'errDates';
  else if (o.from > o.to) erros.dates = 'errDateOrder';
  return erros;
}

export function erroSuplemento(valor) {
  if (valor === '' || valor === undefined) return null;
  const v = Number(valor);
  return !Number.isFinite(v) || v < 0 ? 'errSurcharge' : null;
}

/* true quando alguma linha tem erro (linguas = as seleccionadas) */
export function temErrosOpcoes(form) {
  return form.options.some((o) => Object.keys(errosOpcao(o)).length > 0)
    || form.offers.some((o) => Object.keys(errosOferta(o)).length > 0)
    || form.languages.some((l) => erroSuplemento(form.language_surcharges[l]));
}

/* ---------- do estado do formulario para o meta (so chaves com conteudo) ---------- */

export function opcoesParaMeta(options) {
  return options.map((o) => {
    const saida = {
      id: o.id,
      name_pt: o.name_pt.trim(),
      name_en: o.name_en.trim() || null,
      type: o.type,
      price: Number(o.price),
    };
    if (o.type === 'per_person' && o.price_child !== '') saida.price_child = Number(o.price_child);
    if (o.type === 'per_vehicle') saida.seats = Number(o.seats);
    return saida;
  });
}

export function suplementosParaMeta(surcharges, languages) {
  const saida = {};
  for (const l of languages) {
    const v = Number(surcharges[l]);
    if (Number.isFinite(v) && v > 0) saida[l] = Math.round(v * 100) / 100;
  }
  return saida;
}

export function ofertasParaMeta(offers) {
  return offers.map((o) => ({
    percent: Number(o.percent),
    from: o.from,
    to: o.to,
    label_pt: o.label_pt.trim() || null,
    label_en: o.label_en.trim() || null,
  }));
}

export function novaOpcao() {
  return { id: novoIdOpcao(), name_pt: '', name_en: '', type: 'per_person', price: '', price_child: '', seats: '' };
}

export function novaOferta() {
  return { percent: '', from: '', to: '', label_pt: '', label_en: '' };
}

/* ---------- editores ---------- */

export function OpcoesEditor({ options, onChange, mostrarErros }) {
  const t = useT();
  const actualizar = (i, patch) => onChange(options.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  return (
    <div className="space-y-2">
      <p className="text-xs font-body text-n-500">{t('opcoesActividade.optionsHint')}</p>
      {options.length > 0 && (
        <p className="text-xs font-body text-n-600">
          <span>{t('opcoesActividade.optionsNote')}</span>{' '}
          <span>{t('opcoesActividade.optionsDesc')}</span>
        </p>
      )}
      {options.map((o, i) => {
        const n = i + 1;
        const e = mostrarErros ? errosOpcao(o) : {};
        const msg = (k) => (e[k] ? t(`opcoesActividade.${e[k]}`) : undefined);
        return (
          <div key={o.id} className="rounded-[14px] border border-mare-card bg-white p-3 space-y-2">
            <div className="flex flex-wrap items-start gap-2">
              <div className="flex-1 min-w-[140px]">
                <Input value={o.name_pt} onChange={(ev) => actualizar(i, { name_pt: ev.target.value })}
                  placeholder={t('unitForm.options.namePtPh')} aria-label={t('opcoesActividade.optionNamePt', { n })} error={msg('name_pt')} />
              </div>
              <div className="flex-1 min-w-[140px]">
                <Input value={o.name_en} onChange={(ev) => actualizar(i, { name_en: ev.target.value })}
                  placeholder={t('unitForm.options.nameEnPh')} aria-label={t('opcoesActividade.optionNameEn', { n })} />
              </div>
              <RemoveRowButton label={t('opcoesActividade.removeOption', { n })} onClick={() => onChange(options.filter((_, idx) => idx !== i))} />
            </div>
            <div className="flex flex-wrap items-start gap-2">
              <div className="w-40 shrink-0">
                <Select value={o.type} onChange={(ev) => actualizar(i, { type: ev.target.value })}
                  aria-label={t('opcoesActividade.optionType', { n })}>
                  {TIPOS.map((tp) => <option key={tp} value={tp}>{t(`opcoesActividade.${TIPO_CHAVE[tp]}`)}</option>)}
                </Select>
              </div>
              <div className="w-28 shrink-0">
                <Input type="number" min="0" step="0.01" value={o.price}
                  onChange={(ev) => actualizar(i, { price: ev.target.value })}
                  placeholder="0.00" aria-label={t('opcoesActividade.optionPrice', { n })} error={msg('price')} />
              </div>
              {o.type === 'per_person' && (
                <div className="w-32 shrink-0">
                  <Input type="number" min="0" step="0.01" value={o.price_child}
                    onChange={(ev) => actualizar(i, { price_child: ev.target.value })}
                    placeholder="0.00" aria-label={t('opcoesActividade.optionPriceChild', { n })} error={msg('price_child')} />
                </div>
              )}
              {o.type === 'per_vehicle' && (
                <div className="w-36 shrink-0">
                  <Input type="number" value={o.seats}
                    onChange={(ev) => actualizar(i, { seats: ev.target.value })}
                    placeholder="4" aria-label={t('opcoesActividade.optionSeats', { n })} error={msg('seats')} />
                </div>
              )}
            </div>
          </div>
        );
      })}
      <AddRowButton onClick={() => onChange([...options, novaOpcao()])}>{t('opcoesActividade.addOption')}</AddRowButton>
    </div>
  );
}

export function SuplementosEditor({ languages, surcharges, onChange, mostrarErros }) {
  const t = useT();
  if (languages.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs font-body text-n-500">{t('opcoesActividade.surchargeHint')}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {languages.map((l) => {
          const chave = erroSuplemento(surcharges[l]);
          return (
            <Input key={l} type="number" min="0" step="0.01" value={surcharges[l] ?? ''}
              onChange={(ev) => onChange({ ...surcharges, [l]: ev.target.value })}
              placeholder="0.00" aria-label={t('opcoesActividade.surchargeLabel', { code: l })}
              error={mostrarErros && chave ? t(`opcoesActividade.${chave}`) : undefined} />
          );
        })}
      </div>
    </div>
  );
}

export function OfertasEditor({ offers, onChange, mostrarErros }) {
  const t = useT();
  const actualizar = (i, patch) => onChange(offers.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  return (
    <div className="space-y-2">
      <p className="text-xs font-body text-n-500">{t('opcoesActividade.offersHint')}</p>
      {offers.map((o, i) => {
        const n = i + 1;
        const e = mostrarErros ? errosOferta(o) : {};
        const msg = (k) => (e[k] ? t(`opcoesActividade.${e[k]}`) : undefined);
        return (
          <div key={i} className="rounded-[14px] border border-mare-card bg-white p-3 space-y-2">
            <div className="flex flex-wrap items-start gap-2">
              <div className="w-28 shrink-0">
                <Input type="number" value={o.percent}
                  onChange={(ev) => actualizar(i, { percent: ev.target.value })}
                  placeholder="%" aria-label={t('opcoesActividade.offerPercent', { n })} error={msg('percent')} />
              </div>
              <div className="w-40 shrink-0">
                <Input type="date" value={o.from} onChange={(ev) => actualizar(i, { from: ev.target.value })}
                  aria-label={t('opcoesActividade.offerFrom', { n })} error={msg('dates')} />
              </div>
              <div className="w-40 shrink-0">
                <Input type="date" value={o.to} onChange={(ev) => actualizar(i, { to: ev.target.value })}
                  aria-label={t('opcoesActividade.offerTo', { n })} />
              </div>
              <RemoveRowButton label={t('opcoesActividade.removeOffer', { n })} onClick={() => onChange(offers.filter((_, idx) => idx !== i))} />
            </div>
            <div className="flex flex-wrap items-start gap-2">
              <div className="flex-1 min-w-[140px]">
                <Input value={o.label_pt} onChange={(ev) => actualizar(i, { label_pt: ev.target.value })}
                  placeholder={t('unitForm.options.offerPtPh')} aria-label={t('opcoesActividade.offerLabelPt', { n })} />
              </div>
              <div className="flex-1 min-w-[140px]">
                <Input value={o.label_en} onChange={(ev) => actualizar(i, { label_en: ev.target.value })}
                  placeholder={t('unitForm.options.offerEnPh')} aria-label={t('opcoesActividade.offerLabelEn', { n })} />
              </div>
            </div>
          </div>
        );
      })}
      <AddRowButton onClick={() => onChange([...offers, novaOferta()])}>{t('opcoesActividade.addOffer')}</AddRowButton>
    </div>
  );
}

/* As tres seccoes, com os titulos, prontas a pousar no formulario */
export function SeccoesOpcoes({ form, setForm, mostrarErros }) {
  const t = useT();
  return (
    <>
      <div className={CAIXA_SECAO}>
        <SectionLabel>{t('opcoesActividade.optionsTitle')}</SectionLabel>
        <OpcoesEditor options={form.options} mostrarErros={mostrarErros}
          onChange={(options) => setForm((f) => ({ ...f, options }))} />
      </div>
      <div className={CAIXA_SECAO}>
        <SectionLabel>{t('opcoesActividade.surchargeTitle')}</SectionLabel>
        <SuplementosEditor languages={form.languages} surcharges={form.language_surcharges} mostrarErros={mostrarErros}
          onChange={(language_surcharges) => setForm((f) => ({ ...f, language_surcharges }))} />
      </div>
      <div className={CAIXA_SECAO}>
        <SectionLabel>{t('opcoesActividade.offersTitle')}</SectionLabel>
        <OfertasEditor offers={form.offers} mostrarErros={mostrarErros}
          onChange={(offers) => setForm((f) => ({ ...f, offers }))} />
      </div>
    </>
  );
}
