import { Check, X, Plus, Trash2 } from 'lucide-react';
import Input from '../../ui/Input';

/* Comodidades — chip picker reutilizado pelos 4 formularios. Lista fixa de
   sugestoes, sem texto livre, para manter os valores consistentes entre
   unidades (usado tambem como filtro no catalogo publico no futuro). */
export function AmenitiesPicker({ options, selected, onToggle }) {
  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {options.map(a => (
        <label
          key={a}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm border text-xs font-body font-medium cursor-pointer transition-colors select-none ${
            selected.includes(a)
              ? 'bg-ocean-700 border-ocean-700 text-white'
              : 'bg-n-50 border-n-300 text-n-600 hover:border-ocean-500'
          }`}
        >
          <input type="checkbox" className="sr-only" checked={selected.includes(a)} onChange={() => onToggle(a)} />
          {a}
        </label>
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
            className={`shrink-0 h-8 px-2 rounded-sm flex items-center gap-1 border text-xs font-body font-semibold transition-colors ${
              it.included ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-600'
            }`}
          >
            {it.included ? <Check size={13} strokeWidth={2.5} /> : <X size={13} strokeWidth={2.5} />}
            {it.included ? 'Incluído' : 'Não incluído'}
          </button>
          <input
            value={it.label}
            onChange={e => updateItem(i, { label: e.target.value })}
            placeholder={it.included ? 'Ex: Pequeno-almoço' : 'Ex: Entradas (€5/pessoa), almoço'}
            className="flex-1 h-8 px-2.5 text-sm font-body border border-n-200 rounded-sm focus:outline-none focus:border-ocean-700"
          />
          <button type="button" onClick={() => removeItem(i)} className="shrink-0 p-1.5 rounded-sm text-n-400 hover:text-error transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <button type="button" onClick={() => addItem(true)} className="flex items-center gap-1 text-xs font-body font-semibold text-ocean-700 hover:text-ocean-500 transition-colors">
          <Plus size={13} strokeWidth={2.5} /> Adicionar item incluído
        </button>
        <button type="button" onClick={() => addItem(false)} className="flex items-center gap-1 text-xs font-body font-semibold text-red-600 hover:text-red-500 transition-colors">
          <Plus size={13} strokeWidth={2.5} /> Adicionar item não incluído
        </button>
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
        <div key={i} className="border border-n-200 rounded-sm p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="shrink-0 w-6 h-6 rounded-full bg-ocean-700 text-white text-xs font-body font-bold flex items-center justify-center">{i + 1}</span>
            <input
              value={s.name}
              onChange={e => updateStop(i, { name: e.target.value })}
              placeholder="Ex: Templo do Amanhecer"
              className="flex-1 h-8 px-2.5 text-sm font-body border border-n-200 rounded-sm focus:outline-none focus:border-ocean-700"
            />
            <button type="button" onClick={() => removeStop(i)} className="shrink-0 p-1.5 rounded-sm text-n-400 hover:text-error transition-colors">
              <Trash2 size={14} />
            </button>
          </div>
          <textarea
            value={s.desc}
            onChange={e => updateStop(i, { desc: e.target.value })}
            placeholder="Descrição curta (opcional)"
            rows={2}
            className="w-full px-2.5 py-1.5 text-sm font-body border border-n-200 rounded-sm focus:outline-none focus:border-ocean-700 resize-none mb-2"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={s.lat}
              onChange={e => updateStop(i, { lat: e.target.value })}
              placeholder="Latitude (opcional)"
              className="h-8 px-2.5 text-xs font-body border border-n-200 rounded-sm focus:outline-none focus:border-ocean-700"
            />
            <input
              value={s.lng}
              onChange={e => updateStop(i, { lng: e.target.value })}
              placeholder="Longitude (opcional)"
              className="h-8 px-2.5 text-xs font-body border border-n-200 rounded-sm focus:outline-none focus:border-ocean-700"
            />
          </div>
        </div>
      ))}
      <button type="button" onClick={addStop} className="flex items-center gap-1 text-xs font-body font-semibold text-ocean-700 hover:text-ocean-500 transition-colors">
        <Plus size={13} strokeWidth={2.5} /> Adicionar paragem
      </button>
      <p className="text-xs text-n-500">Sem coordenadas, a paragem aparece na lista mas sem marcador no mapa. Google Maps: botão direito no local → copiar coordenadas.</p>
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
            className="h-8 px-2.5 text-sm font-body border border-n-200 rounded-sm focus:outline-none focus:border-ocean-700"
          />
          <input
            type="number"
            min="1"
            value={s.capacity}
            onChange={e => updateSlot(i, { capacity: e.target.value })}
            placeholder="Lugares"
            className="w-28 h-8 px-2.5 text-sm font-body border border-n-200 rounded-sm focus:outline-none focus:border-ocean-700"
          />
          <button type="button" onClick={() => removeSlot(i)} className="shrink-0 p-1.5 rounded-sm text-n-400 hover:text-error transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button type="button" onClick={addSlot} className="flex items-center gap-1 text-xs font-body font-semibold text-ocean-700 hover:text-ocean-500 transition-colors">
        <Plus size={13} strokeWidth={2.5} /> Adicionar horário
      </button>
      <p className="text-xs text-n-500">Sem horários aqui, a reserva continua a funcionar por dia inteiro (como hoje). Ao adicionar um horário, o cliente escolhe entre eles e cada um só aceita reservas até ao número de lugares indicado.</p>
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
        <div key={i} className="flex items-center gap-2">
          <input
            type="number"
            min="1"
            value={t.pax_min}
            onChange={e => updateTier(i, { pax_min: e.target.value })}
            placeholder="Mín PAX"
            className="w-24 h-8 px-2.5 text-sm font-body border border-n-200 rounded-sm focus:outline-none focus:border-ocean-700"
          />
          <span className="text-n-400 text-sm">–</span>
          <input
            type="number"
            min="1"
            value={t.pax_max}
            onChange={e => updateTier(i, { pax_max: e.target.value })}
            placeholder="Máx PAX"
            className="w-24 h-8 px-2.5 text-sm font-body border border-n-200 rounded-sm focus:outline-none focus:border-ocean-700"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            value={t.price}
            onChange={e => updateTier(i, { price: e.target.value })}
            placeholder="Preço (€)"
            className="flex-1 h-8 px-2.5 text-sm font-body border border-n-200 rounded-sm focus:outline-none focus:border-ocean-700"
          />
          <button type="button" onClick={() => removeTier(i)} className="shrink-0 p-1.5 rounded-sm text-n-400 hover:text-error transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button type="button" onClick={addTier} className="flex items-center gap-1 text-xs font-body font-semibold text-ocean-700 hover:text-ocean-500 transition-colors">
        <Plus size={13} strokeWidth={2.5} /> Adicionar escalão
      </button>
      <p className="text-xs text-n-500">Ex: 1–2 PAX a 80€, 3–4 PAX a 140€. Se configurado, substitui o "Preço privado" único de abaixo para o número de pessoas coberto por um escalão.</p>
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
    <p className="text-xs font-body font-bold uppercase tracking-wide text-ocean-700 border-b border-n-100 pb-1 mb-1">
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
      <p className="text-xs font-body text-n-400 mt-1.5">
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
      <p className="text-xs font-body text-n-400 mt-1.5">
        Usadas no catálogo público SalDesk Conect. No Google Maps: clique direito no local → copiar coordenadas.
      </p>
    </div>
  );
}
