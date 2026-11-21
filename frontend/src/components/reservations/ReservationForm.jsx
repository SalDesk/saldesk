import { useState, useEffect } from 'react';
import { useT } from '../../i18n';
import Input, { Textarea, Select } from '../ui/Input';
import Button from '../ui/Button';
import FleetSelector from '../fleet/FleetSelector';
import { parseTourMeta } from '../units/UnitForm';
import useUiStore from '../../store/uiStore';
import {
  opcoesValidas, nomeOpcao, unidadeOpcao, limitarVeiculos, precoEstimado, opcaoMaisBarata,
} from '../../utils/opcoesActividade';

const SOURCES = ['direct', 'booking_com', 'airbnb', 'viator', 'getyourguide', 'manual'];

/* `initial`: valores de partida de uma reserva NOVA (ex: unidade e data clicadas no Calendario).
   `reservation`: reserva existente a editar (activa o modo de edicao). */
export default function ReservationForm({ reservation, initial, units, operatorType, onSave, onCancel, loading, error }) {
  const t = useT();
  const lang = useUiStore((s) => s.lang);
  const langOpcao = lang === 'pt' ? 'pt' : 'en';
  const origem = reservation || initial || null;
  const [fleetId, setFleetId] = useState(reservation?.fleet_id || null);
  const [form, setForm] = useState({
    unit_id:          origem?.unit_id || '',
    customer_name:    origem?.customer_name || '',
    customer_email:   origem?.customer_email || '',
    customer_phone:   origem?.customer_phone || '',
    customer_country: origem?.customer_country || '',
    check_in:         origem?.check_in || '',
    check_out:        origem?.check_out || '',
    guests:           origem?.guests || 1,
    tour_time:        origem?.tour_time || '09:00',
    start_time:       origem?.start_time?.slice(0, 5) || '19:00',
    source:           origem?.source || 'manual',
    notes:            origem?.notes || '',
    whatsapp_opt_in:  origem?.whatsapp_opt_in === true,
    option_id:        '',
    vehicles:         '',
  });
  const [pricePreview, setPricePreview] = useState(null);
  // Veiculos: a escrever mostra-se o que foi escrito; fora do campo, o valor limitado que se reserva
  const [aEditarVeiculos, setAEditarVeiculos] = useState(false);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  /* Horarios com capacidade propria (TourForm's TimeSlotsEditor) -- so
     activo quando a unidade tem meta.time_slots configurado. Sem isso, o
     campo "Hora" continua livre e so cai em notes, tal como sempre foi. */
  const selectedUnit = units.find((u) => u.id === form.unit_id);
  const selectedUnitMeta = operatorType === 'activity' ? parseTourMeta(selectedUnit?.description) : {};
  const unitSlots = Array.isArray(selectedUnitMeta.time_slots) ? selectedUnitMeta.time_slots : [];

  /* Opcoes (variantes) da actividade -- so numa reserva nova (editar nao volta a calcular o
     preco). Sem escolha fica a mais barata, como faz o servidor; todos contam como adultos. */
  const unitOptions = !reservation ? opcoesValidas(selectedUnitMeta) : [];
  const opcaoActual = unitOptions.length > 0
    ? (unitOptions.find((o) => o.id === form.option_id) || opcaoMaisBarata(selectedUnitMeta))
    : null;
  const pessoas = Number(form.guests) || 0;
  const porVeiculo = opcaoActual?.type === 'per_vehicle';
  const veiculosMin = porVeiculo ? limitarVeiculos(opcaoActual.seats, pessoas) : null;
  const veiculos = porVeiculo ? limitarVeiculos(opcaoActual.seats, pessoas, form.vehicles) : null;
  const opcaoTotal = opcaoActual ? precoEstimado(opcaoActual, { adults: pessoas, children: 0, vehicles: veiculos }) : null;
  const temOpcoesNaEdicao = !!reservation && opcoesValidas(selectedUnitMeta).length > 0;

  useEffect(() => {
    const unit = units.find((u) => u.id === form.unit_id);
    if (!unit) { setPricePreview(null); return; }

    if (operatorType === 'restaurant') {
      // Mesas nao tem preco por reserva (base_price e sempre 0) -- sem pre-visualizacao.
      setPricePreview(null);
    } else if (operatorType === 'activity') {
      const total = opcaoTotal !== null ? opcaoTotal : Number(unit.base_price) * Number(form.guests);
      /* unidades sem preco (ex: as do calendario) nao dao previsao, em vez de "€NaN" */
      if (form.check_in && form.guests && Number.isFinite(total) && !temOpcoesNaEdicao) {
        setPricePreview({ total, tipo: 'activity' });
      } else {
        setPricePreview(null);
      }
    } else {
      if (form.check_in && form.check_out && form.check_out > form.check_in) {
        const dias = Math.ceil(
          (new Date(form.check_out) - new Date(form.check_in)) / (1000 * 60 * 60 * 24)
        );
        const total = Number(unit.base_price) * dias;
        setPricePreview(Number.isFinite(total) ? { total, dias, tipo: 'hotel' } : null);
      } else {
        setPricePreview(null);
      }
    }
  }, [form.unit_id, form.check_in, form.check_out, form.guests, units, operatorType, opcaoTotal, temOpcoesNaEdicao]);

  function handleSubmit(e) {
    e.preventDefault();
    // option_id e vehicles do estado so seguem (corrigidos) quando a actividade tem opcoes
    const resto = { ...form };
    delete resto.option_id;
    delete resto.vehicles;
    const escolhaOpcao = opcaoActual
      ? { option_id: opcaoActual.id, ...(porVeiculo ? { vehicles: veiculos } : {}) }
      : {};
    onSave({
      ...resto,
      ...escolhaOpcao,
      guests:   Number(form.guests),
      fleet_id: fleetId || null,
      start_time: operatorType === 'restaurant' ? form.start_time : (unitSlots.length > 0 ? form.tour_time : null),
      notes: operatorType === 'activity' && form.tour_time
        ? `Hora: ${form.tour_time}${form.notes ? ' | ' + form.notes : ''}`
        : form.notes,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Select label={operatorType === 'activity' ? 'Tour / Actividade' : t('reservations.unit')} value={form.unit_id} onChange={(e) => setForm((f) => ({ ...f, unit_id: e.target.value, option_id: '', vehicles: '' }))} required>
        <option value="">Seleccionar unidade...</option>
        {units.map((u) => (
          <option key={u.id} value={u.id}>{u.name}</option>
        ))}
      </Select>

      {operatorType === 'activity' ? (
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Data do tour"
            type="date"
            value={form.check_in}
            onChange={e => setForm(f => ({ ...f, check_in: e.target.value, check_out: e.target.value }))}
            required
          />
          {unitSlots.length > 0 ? (
            <Select label="Horário" value={form.tour_time} onChange={set('tour_time')} required>
              <option value="">Seleccionar horário...</option>
              {unitSlots.map((s) => (
                <option key={s.time} value={s.time}>{s.time} ({s.capacity} lugares)</option>
              ))}
            </Select>
          ) : (
            <Input label="Hora" type="time" value={form.tour_time} onChange={set('tour_time')} />
          )}
        </div>
      ) : operatorType === 'restaurant' ? (
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Data da reserva"
            type="date"
            value={form.check_in}
            onChange={e => setForm(f => ({ ...f, check_in: e.target.value, check_out: e.target.value }))}
            required
          />
          <Input label="Hora" type="time" value={form.start_time} onChange={set('start_time')} required />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Input label={t('reservations.checkIn')} type="date" value={form.check_in} onChange={set('check_in')} required />
          <Input label={t('reservations.checkOut')} type="date" value={form.check_out} onChange={set('check_out')} min={form.check_in || undefined} required />
        </div>
      )}

      {unitOptions.length > 0 && (
        <div className={porVeiculo ? 'grid grid-cols-2 gap-3' : ''}>
          <Select label={t('opcoesActividade.option')} value={opcaoActual.id} onChange={(e) => setForm((f) => ({ ...f, option_id: e.target.value, vehicles: '' }))}>
            {unitOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {`${nomeOpcao(o, langOpcao)} · €${o.price} ${unidadeOpcao(o, langOpcao)}`}
              </option>
            ))}
          </Select>
          {porVeiculo && (
            <Input
              label={t('opcoesActividade.vehicles')}
              type="number"
              min={veiculosMin}
              max={Math.max(veiculosMin, pessoas)}
              value={aEditarVeiculos ? form.vehicles : veiculos}
              onChange={set('vehicles')}
              onFocus={() => { setAEditarVeiculos(true); setForm((f) => ({ ...f, vehicles: String(veiculos) })); }}
              onBlur={() => { setAEditarVeiculos(false); setForm((f) => ({ ...f, vehicles: String(veiculos) })); }}
              hint={t('opcoesActividade.vehiclesHint', { min: veiculosMin, max: Math.max(veiculosMin, pessoas) })}
            />
          )}
        </div>
      )}

      <FleetSelector
        unitId={form.unit_id}
        date={form.check_in}
        value={fleetId}
        onChange={setFleetId}
        onLoad={() => setFleetId(reservation?.fleet_id || null)}
      />

      {pricePreview && (
        <div className="bg-ocean-50 border border-ocean-100 rounded-sm px-3 py-2 flex items-center justify-between">
          <span className="text-xs font-body text-ocean-700">
            {pricePreview.tipo === 'activity'
              ? `${form.guests} pessoa(s)${porVeiculo ? ` · ${t('opcoesActividade.vehiclesCount', { n: veiculos })}` : ''}`
              : `${pricePreview.dias} noite(s)`}
          </span>
          <span className="font-display font-bold text-ocean-700">€{pricePreview.total.toFixed(2)}</span>
        </div>
      )}

      <Input label={t('reservations.customer')} value={form.customer_name} onChange={set('customer_name')} required placeholder="Nome do cliente" />

      <div className="grid grid-cols-2 gap-3">
        <Input label={t('auth.email')} type="email" value={form.customer_email} onChange={set('customer_email')} required placeholder="email@exemplo.com" />
        <Input label={t('customers.phone')} type="tel" value={form.customer_phone} onChange={set('customer_phone')} placeholder="+238 900 0000" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input label={t('customers.nationality')} value={form.customer_country} onChange={set('customer_country')} placeholder="PT, DE, GB..." hint="Código ISO 2" />
        <Input label={t('reservations.guests')} type="number" value={form.guests} onChange={(e) => setForm((f) => ({ ...f, guests: e.target.value, vehicles: '' }))} min="1" />
      </div>

      {/* Consentimento: so marcar se o cliente aceitou. Sem isto, as mensagens por WhatsApp abrem no telemovel (wa.me),
            nunca saem sozinhas pela Cloud API. */}
      {!reservation && (
        <label className="flex items-start gap-2 text-sm font-body text-n-700 cursor-pointer">
          <input
            type="checkbox" className="mt-0.5 h-4 w-4 rounded border-n-300 text-ocean-700 focus:ring-ocean-300"
            checked={form.whatsapp_opt_in}
            onChange={(e) => setForm((f) => ({ ...f, whatsapp_opt_in: e.target.checked }))}
          />
          <span>O cliente aceitou receber mensagens sobre esta reserva por WhatsApp</span>
        </label>
      )}

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
