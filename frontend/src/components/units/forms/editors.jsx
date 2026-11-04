import { Check, X, Plus, Trash2 } from 'lucide-react';
import Input, { Textarea } from '../../ui/Input';
import Button from '../../ui/Button';

/* Campo nativo das linhas de horario: o teste de caracterizacao liga a hora ao
   campo de lugares como irmaos directos (previousElementSibling), por isso estes
   dois campos ficam como <input> e nao como Input (que os embrulharia num bloco).
   Mesmas classes que o Input do design system. */
const NATIVE_FIELD_CLASS = [
  'h-9 px-3 rounded-sm border text-sm font-body bg-n-100 text-n-900 dark:bg-n-800 dark:text-n-100',
  'placeholder:text-n-400 transition-colors border-n-300 dark:border-n-600',
  'focus:outline-none focus:ring-2 focus:ring-ocean-300 focus:border-ocean-700 focus:bg-white dark:focus:bg-n-800',
  'app:bg-white app:text-[13px]',
].join(' ');

/* Botao de remover uma linha dos editores (so icone, por isso leva aria-label) */
function RemoveRowButton({ label, onClick }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      icon={Trash2}
      onClick={onClick}
      aria-label={label}
      className="shrink-0 !text-n-400 hover:!text-error hover:!bg-[var(--error-light)]"
    />
  );
}

/* Botao de adicionar uma linha aos editores */
function AddRowButton({ onClick, children }) {
  return (
    <Button type="button" variant="secondary" size="sm" icon={Plus} onClick={onClick}>
      {children}
    </Button>
  );
}

/* Chip de selecao multipla (comodidades, idiomas). O FilterChips e de selecao
   unica, por isso aqui mantem-se uma caixa de verificacao escondida dentro de
   uma etiqueta, com o mesmo aspeto dos chips de filtro. */
export function ChipToggle({ label, checked, onChange }) {
  return (
    <label
      className={`inline-flex items-center h-7 px-3 rounded-full border text-xs font-body font-medium cursor-pointer select-none transition-colors focus-within:ring-2 focus-within:ring-ocean-300 ${
        checked
          ? 'bg-ocean-700 border-ocean-700 text-white'
          : 'bg-white border-n-300 text-n-700 hover:bg-n-50'
      }`}
    >
      <input type="checkbox" className="sr-only" checked={checked} onChange={onChange} />
      {label}
    </label>
  );
}

/* Comodidades — chip picker reutilizado pelos 4 formularios. Lista fixa de
   sugestoes, sem texto livre, para manter os valores consistentes entre
   unidades (usado tambem como filtro no catalogo publico no futuro). */
export function AmenitiesPicker({ options, selected, onToggle }) {
  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {options.map(a => (
        <ChipToggle key={a} label={a} checked={selected.includes(a)} onChange={() => onToggle(a)} />
      ))}
    </div>
  );
}

/* O que esta incluido — lista livre de itens que o operador marca como
   incluidos ou nao incluidos no preco. Mostrado tal e qual na pagina
   publica; secção fica escondida la se ficar vazia (nunca inventa). */
export function IncludedItemsEditor({ items, onChange }) {
  function addItem(included) { onChange([...items, { label: '', included }]); }
  function updateItem(i, patch) { onChange(items.map((it, idx) => idx === i ? { ...it, ...patch } : it)); }
  function removeItem(i) { onChange(items.filter((_, idx) => idx !== i)); }
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => updateItem(i, { included: !it.included })}
            title="Clique para alternar entre incluído e não incluído"
            className={`shrink-0 h-9 px-2.5 rounded-sm flex items-center gap-1 border text-xs font-body font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-300 ${
              it.included ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-600'
            }`}
          >
            {it.included ? <Check size={13} strokeWidth={2.5} /> : <X size={13} strokeWidth={2.5} />}
            {it.included ? 'Incluído' : 'Não incluído'}
          </button>
          <div className="flex-1 min-w-0">
            <Input
              value={it.label}
              onChange={e => updateItem(i, { label: e.target.value })}
              placeholder={it.included ? 'Ex: Pequeno-almoço' : 'Ex: Entradas (€5/pessoa), almoço'}
              aria-label={`Item ${i + 1}`}
            />
          </div>
          <RemoveRowButton label={`Remover item ${i + 1}`} onClick={() => removeItem(i)} />
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <AddRowButton onClick={() => addItem(true)}>Adicionar item incluído</AddRowButton>
        <AddRowButton onClick={() => addItem(false)}>Adicionar item não incluído</AddRowButton>
      </div>
    </div>
  );
}

/* Itinerario -- lista ordenada de paragens de um tour, cada uma com nome
   e coordenadas opcionais (so ganha pin no mapa publico se preenchidas --
   nunca inventamos uma coordenada em falta). Mesmo padrao de lista
   repetivel do IncludedItemsEditor acima. */
export function StopsEditor({ stops, onChange }) {
  function addStop() { onChange([...stops, { name: '', desc: '', lat: '', lng: '' }]); }
  function updateStop(i, patch) { onChange(stops.map((s, idx) => idx === i ? { ...s, ...patch } : s)); }
  function removeStop(i) { onChange(stops.filter((_, idx) => idx !== i)); }
  return (
    <div className="space-y-3">
      {stops.map((s, i) => (
        <div key={i} className="border border-n-200 rounded-sm p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="shrink-0 w-6 h-6 rounded-full bg-ocean-700 text-white text-xs font-body font-bold flex items-center justify-center">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <Input
                value={s.name}
                onChange={e => updateStop(i, { name: e.target.value })}
                placeholder="Ex: Templo do Amanhecer"
                aria-label={`Nome da paragem ${i + 1}`}
              />
            </div>
            <RemoveRowButton label={`Remover paragem ${i + 1}`} onClick={() => removeStop(i)} />
          </div>
          <Textarea
            value={s.desc}
            onChange={e => updateStop(i, { desc: e.target.value })}
            placeholder="Descrição curta (opcional)"
            rows={2}
            aria-label={`Descrição da paragem ${i + 1}`}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={s.lat}
              onChange={e => updateStop(i, { lat: e.target.value })}
              placeholder="Latitude (opcional)"
              aria-label={`Latitude da paragem ${i + 1}`}
            />
            <Input
              value={s.lng}
              onChange={e => updateStop(i, { lng: e.target.value })}
              placeholder="Longitude (opcional)"
              aria-label={`Longitude da paragem ${i + 1}`}
            />
          </div>
        </div>
      ))}
      <AddRowButton onClick={addStop}>Adicionar paragem</AddRowButton>
      <p className="text-xs font-body text-n-500">Sem coordenadas, a paragem aparece na lista mas sem marcador no mapa. Google Maps: botão direito no local → copiar coordenadas.</p>
    </div>
  );
}

/* Horarios com capacidade propria -- opcional. Sem nenhum slot definido, o
   tour continua a funcionar exactamente como sempre (reserva por dia,
   bloqueio binario) -- so ao definir slots aqui e que a disponibilidade
   passa a ser calculada por horario (varias reservas partilham o mesmo
   slot ate ao limite de capacidade indicado). Mesmo padrao de lista
   repetivel do StopsEditor acima. */
export function TimeSlotsEditor({ slots, onChange }) {
  function addSlot() { onChange([...slots, { time: '', capacity: '' }]); }
  function updateSlot(i, patch) { onChange(slots.map((s, idx) => idx === i ? { ...s, ...patch } : s)); }
  function removeSlot(i) { onChange(slots.filter((_, idx) => idx !== i)); }
  return (
    <div className="space-y-2">
      {slots.map((s, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="time"
            value={s.time}
            onChange={e => updateSlot(i, { time: e.target.value })}
            aria-label={`Hora do horário ${i + 1}`}
            className={`w-32 ${NATIVE_FIELD_CLASS}`}
          />
          <input
            type="number"
            min="1"
            value={s.capacity}
            onChange={e => updateSlot(i, { capacity: e.target.value })}
            placeholder="Lugares"
            aria-label={`Lugares do horário ${i + 1}`}
            className={`w-28 ${NATIVE_FIELD_CLASS}`}
          />
          <RemoveRowButton label={`Remover horário ${i + 1}`} onClick={() => removeSlot(i)} />
        </div>
      ))}
      <AddRowButton onClick={addSlot}>Adicionar horário</AddRowButton>
      <p className="text-xs font-body text-n-500">Sem horários aqui, a reserva continua a funcionar por dia inteiro (como hoje). Ao adicionar um horário, o cliente escolhe entre eles e cada um só aceita reservas até ao número de lugares indicado.</p>
    </div>
  );
}

/* Escaloes de preco para reserva privada/grupo, por numero de pessoas (ex:
   1-2 PAX, 3-4 PAX) -- pedido real de um operador (Logan Tours) cujos
   precos privados nao sao um valor unico nem linear por pessoa, mas em
   patamares. Se configurado, tem prioridade sobre "Preço privado" (que
   continua a funcionar como reserva/fallback quando nenhum escalao cobre o
   numero de pessoas da reserva). Mesmo padrao de lista repetivel do
   TimeSlotsEditor acima. */
export function PriceTiersEditor({ tiers, onChange }) {
  function addTier() { onChange([...tiers, { pax_min: '', pax_max: '', price: '' }]); }
  function updateTier(i, patch) { onChange(tiers.map((t, idx) => idx === i ? { ...t, ...patch } : t)); }
  function removeTier(i) { onChange(tiers.filter((_, idx) => idx !== i)); }
  return (
    <div className="space-y-2">
      {tiers.map((t, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <div className="w-24 shrink-0">
            <Input
              type="number"
              min="1"
              value={t.pax_min}
              onChange={e => updateTier(i, { pax_min: e.target.value })}
              placeholder="Mín PAX"
              aria-label={`Mínimo de pessoas do escalão ${i + 1}`}
            />
          </div>
          <span className="text-n-400 text-sm">–</span>
          <div className="w-24 shrink-0">
            <Input
              type="number"
              min="1"
              value={t.pax_max}
              onChange={e => updateTier(i, { pax_max: e.target.value })}
              placeholder="Máx PAX"
              aria-label={`Máximo de pessoas do escalão ${i + 1}`}
            />
          </div>
          <div className="flex-1 min-w-[110px]">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={t.price}
              onChange={e => updateTier(i, { price: e.target.value })}
              placeholder="Preço (€)"
              aria-label={`Preço do escalão ${i + 1}`}
            />
          </div>
          <RemoveRowButton label={`Remover escalão ${i + 1}`} onClick={() => removeTier(i)} />
        </div>
      ))}
      <AddRowButton onClick={addTier}>Adicionar escalão</AddRowButton>
      <p className="text-xs font-body text-n-500">Ex: 1–2 PAX a 80€, 3–4 PAX a 140€. Se configurado, substitui o "Preço privado" único de abaixo para o número de pessoas coberto por um escalão.</p>
    </div>
  );
}

export const UNIT_TYPES_BY_OPERATOR = {
  hotel:      ['Quarto Standard', 'Quarto Double', 'Suite', 'Apartamento', 'Villa', 'Bungalow'],
  activity:   ['Mergulho', 'Kitesurf', 'Snorkeling', 'Passeio de Barco', 'Quad / Buggy', 'Pesca', 'Surf', 'Windsurf', 'Tour', 'Sessao'],
  rentacar:   ['Economico', 'Compacto', 'SUV', 'Pickup', 'Moto', 'Van', 'Executivo'],
  restaurant: ['Mesa Interior', 'Mesa Exterior', 'Mesa VIP', 'Terraco'],
};

export const LANGUAGES = ['PT', 'EN', 'DE', 'NL', 'FR', 'ES'];

export function SectionLabel({ children }) {
  return (
    <p className="text-xs font-body font-bold uppercase tracking-wide text-ocean-700 border-b border-n-200 pb-1 mb-2 app:normal-case app:tracking-normal app:text-sm app:text-n-900">
      {children}
    </p>
  );
}

export function OtaFields({ form, set }) {
  return (
    <div>
      <SectionLabel>Integração OTA (opcional)</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="ID produto Viator"
          value={form.ota_viator_id}
          onChange={set('ota_viator_id')}
          placeholder="Ex: 12345P1"
        />
        <Input
          label="ID produto GetYourGuide"
          value={form.ota_gyg_id}
          onChange={set('ota_gyg_id')}
          placeholder="Ex: 67890"
        />
      </div>
      <p className="text-xs font-body text-n-500 mt-1.5">
        Liga esta unidade ao produto correspondente na Viator/GetYourGuide para que as reservas recebidas por webhook sejam atribuídas a esta unidade.
      </p>
    </div>
  );
}

export function buildOtaProductIds(form) {
  return {
    viator: form.ota_viator_id || null,
    getyourguide: form.ota_gyg_id || null,
  };
}

/* SalDesk Conect: coordenadas reais da unidade, usadas como assinatura
   visual no catalogo publico (eyebrow "16.6013°N · 22.9184°W"). Opcional
   -- sem coordenadas, o catalogo simplesmente nao mostra o eyebrow, nunca
   inventa uma localizacao. A categoria (category_id) nao tem campo aqui:
   e derivada automaticamente no backend a partir do Select "Categoria"
   que ja existe em cada formulario. */
export function ConectFields({ form, set }) {
  return (
    <div>
      <SectionLabel>Coordenadas (opcional — Conect)</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Latitude"
          type="number"
          step="0.000001"
          value={form.lat}
          onChange={set('lat')}
          placeholder="Ex: 16.6013"
        />
        <Input
          label="Longitude"
          type="number"
          step="0.000001"
          value={form.lng}
          onChange={set('lng')}
          placeholder="Ex: -22.9184"
        />
      </div>
      <p className="text-xs font-body text-n-500 mt-1.5">
        Usadas no catálogo público SalDesk Conect. No Google Maps: clique direito no local → copiar coordenadas.
      </p>
    </div>
  );
}
