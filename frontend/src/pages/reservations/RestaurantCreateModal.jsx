import { useState, useEffect } from 'react';
import { Utensils } from 'lucide-react';
import { updateReservation } from '../../services/reservationsService';
import Modal from '../../components/ui/Modal';
import { parseRestaurantMeta } from './shared';

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
          <label className="block text-xs font-mono text-n-500 uppercase tracking-wide mb-2">Turno</label>
          <div className="flex flex-wrap gap-2">
            {[{ v: 'almoco', l: 'Almoco · 12h-15h' }, { v: 'jantar', l: 'Jantar · 19h-23h' }].map(o => (
              <button key={o.v} type="button" onClick={() => set('turno', o.v)}
                className={`flex-1 py-2 rounded-md border text-sm font-body font-medium transition-colors ${
                  form.turno === o.v ? 'bg-ocean-700 border-ocean-700 text-white' : 'bg-n-50 border-n-200 text-n-700 hover:border-ocean-400'
                }`}>
                {o.l}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-mono text-n-500 uppercase tracking-wide mb-1.5">Ocasiao especial</label>
          <select value={form.ocasiao} onChange={e => set('ocasiao', e.target.value)}
            className="w-full h-9 rounded-md border border-n-200 bg-n-50 px-3 text-sm font-body text-n-900 focus:outline-none focus:ring-2 focus:ring-ocean-700">
            <option value="">Nenhuma</option>
            <option value="aniversario">Aniversario</option>
            <option value="lua_de_mel">Lua-de-mel</option>
            <option value="negocios">Negocios</option>
            <option value="outro">Outro</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-mono text-n-500 uppercase tracking-wide mb-1.5">Pedidos especiais</label>
          <textarea value={form.pedidos_especiais} onChange={e => set('pedidos_especiais', e.target.value)} rows={2}
            placeholder="Alergias, decoracao, menu vegetariano..."
            className="w-full rounded-md border border-n-200 bg-n-50 px-3 py-2 text-sm font-body text-n-900 focus:outline-none focus:ring-2 focus:ring-ocean-700 resize-none" />
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.lista_espera} onChange={e => set('lista_espera', e.target.checked)} className="w-4 h-4 accent-ocean-700" />
          <span className="text-sm font-body text-n-700">Lista de espera (sem mesa disponivel)</span>
        </label>

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="flex-1 h-9 rounded-md border border-n-200 text-sm font-body text-n-700 hover:bg-n-50 transition-colors">Cancelar</button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="flex-1 h-9 rounded-md bg-ocean-700 text-white text-sm font-body font-medium hover:bg-ocean-500 transition-colors disabled:opacity-60">
            {saving ? 'A guardar...' : 'Guardar detalhes'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
