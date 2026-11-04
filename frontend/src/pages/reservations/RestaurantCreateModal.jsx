import { useState, useEffect } from 'react';
import { Utensils } from 'lucide-react';
import { updateReservation } from '../../services/reservationsService';
import Button from '../../components/ui/Button';
import FilterChips from '../../components/ui/FilterChips';
import { Select, Textarea } from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import { parseRestaurantMeta, GROUP_LABEL_CLASS } from './shared';

export default function RestaurantCreateModal({ reservation, units, open, onClose, onDone }) {
  const prevMeta = parseRestaurantMeta(reservation);
  const [form, setForm] = useState({
    turno:            prevMeta.turno             || 'jantar',
    ocasiao:          prevMeta.ocasiao            || '',
    pedidos_especiais:prevMeta.pedidos_especiais  || '',
    lista_espera:     prevMeta.lista_espera        ?? false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (reservation) {
      const m = parseRestaurantMeta(reservation);
      setForm({ turno: m.turno || 'jantar', ocasiao: m.ocasiao || '', pedidos_especiais: m.pedidos_especiais || '', lista_espera: m.lista_espera ?? false });
    }
  }, [reservation]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleSave() {
    if (!reservation) return;
    setSaving(true);
    try {
      let prev = {};
      try { prev = JSON.parse(reservation.notes_guest || '{}'); } catch {}
      await updateReservation(reservation.id, { notes_guest: JSON.stringify({ ...prev, ...form }) });
      onDone();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  const unit = units.find(u => u.id === reservation?.unit_id);

  return (
    <Modal open={open} onClose={onClose} title="Detalhes da reserva" size="sm" footer={null}>
      <div className="space-y-4">
        {reservation && (
          <div className="flex items-center gap-3 p-3 bg-n-50 rounded-md border border-n-200">
            <Utensils size={14} strokeWidth={1.75} className="text-ocean-700 shrink-0" />
            <div>
              <p className="font-display font-semibold text-sm text-n-900">{reservation.customer_name || '—'}</p>
              <p className="text-xs font-body text-n-400">{reservation.guests} pessoas · {unit?.name || 'Sem mesa'}</p>
            </div>
          </div>
        )}

        <div>
          <p className={`${GROUP_LABEL_CLASS} mb-2`}>Turno</p>
          <FilterChips
            options={[{ value: 'almoco', label: 'Almoco · 12h-15h' }, { value: 'jantar', label: 'Jantar · 19h-23h' }]}
            value={form.turno}
            onChange={v => set('turno', v)}
          />
        </div>

        <Select label="Ocasiao especial" value={form.ocasiao} onChange={e => set('ocasiao', e.target.value)}>
          <option value="">Nenhuma</option>
          <option value="aniversario">Aniversario</option>
          <option value="lua_de_mel">Lua-de-mel</option>
          <option value="negocios">Negocios</option>
          <option value="outro">Outro</option>
        </Select>

        <Textarea label="Pedidos especiais" value={form.pedidos_especiais} onChange={e => set('pedidos_especiais', e.target.value)} rows={2}
          placeholder="Alergias, decoracao, menu vegetariano..." />

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.lista_espera} onChange={e => set('lista_espera', e.target.checked)} className="w-4 h-4 accent-ocean-700" />
          <span className="text-sm font-body text-n-700">Lista de espera (sem mesa disponivel)</span>
        </label>

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button type="button" loading={saving} onClick={handleSave} className="flex-1">
            {saving ? 'A guardar...' : 'Guardar detalhes'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
