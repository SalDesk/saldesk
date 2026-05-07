import { useState, useEffect } from 'react';
import { checkAvailability } from '../../services/calendarService';
import useAuthStore from '../../store/authStore';

const hoje = new Date().toISOString().split('T')[0];

export default function ReservationForm({ reservation, units, onSave, onCancel, loading, erro }) {
  const operator = useAuthStore((s) => s.operator);
  const [form, setForm] = useState({
    unit_id: reservation?.unit_id || (units[0]?.id || ''),
    customer_name: reservation?.customer_name || '',
    customer_email: reservation?.customer_email || '',
    customer_phone: reservation?.customer_phone || '',
    customer_country: reservation?.customer_country || '',
    check_in: reservation?.check_in || '',
    check_out: reservation?.check_out || '',
    guests: reservation?.guests || 1,
    notes: reservation?.notes || ''
  });
  const [preco, setPreco] = useState(null);
  const [verificando, setVerificando] = useState(false);

  // Verificar disponibilidade e preço ao mudar datas/unidade
  useEffect(() => {
    if (!form.unit_id || !form.check_in || !form.check_out || form.check_out <= form.check_in) {
      setPreco(null);
      return;
    }
    setVerificando(true);
    checkAvailability(operator.slug, form.unit_id, form.check_in, form.check_out)
      .then(({ data }) => setPreco(data))
      .catch(() => setPreco(null))
      .finally(() => setVerificando(false));
  }, [form.unit_id, form.check_in, form.check_out]);

  function handleSubmit(e) {
    e.preventDefault();
    onSave({ ...form, guests: Number(form.guests) });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!reservation && (
        <div>
          <label className="label">Unidade *</label>
          <select
            className="input"
            value={form.unit_id}
            onChange={(e) => setForm({ ...form, unit_id: e.target.value })}
            required
          >
            {units.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Check-in *</label>
          <input type="date" className="input" value={form.check_in} min={hoje}
            onChange={(e) => setForm({ ...form, check_in: e.target.value })} required />
        </div>
        <div>
          <label className="label">Check-out *</label>
          <input type="date" className="input" value={form.check_out}
            min={form.check_in || hoje}
            onChange={(e) => setForm({ ...form, check_out: e.target.value })} required />
        </div>
      </div>

      {preco && (
        <div className={`rounded-lg p-3 text-sm ${preco.disponivel ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {preco.disponivel
            ? `✓ Disponível · ${preco.dias} noite(s) · Total: ${Number(preco.total_price).toFixed(2)} €`
            : '✗ Unidade indisponível nas datas seleccionadas'}
        </div>
      )}
      {verificando && <p className="text-xs text-gray-400">A verificar disponibilidade...</p>}

      <div>
        <label className="label">Nome do cliente *</label>
        <input type="text" className="input" value={form.customer_name}
          onChange={(e) => setForm({ ...form, customer_name: e.target.value })} required />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Email *</label>
          <input type="email" className="input" value={form.customer_email}
            onChange={(e) => setForm({ ...form, customer_email: e.target.value })} required />
        </div>
        <div>
          <label className="label">Telefone</label>
          <input type="tel" className="input" value={form.customer_phone}
            onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">País</label>
          <input type="text" className="input" value={form.customer_country} placeholder="PT, GB, DE..."
            onChange={(e) => setForm({ ...form, customer_country: e.target.value.toUpperCase() })} maxLength={2} />
        </div>
        <div>
          <label className="label">Hóspedes</label>
          <input type="number" className="input" value={form.guests} min={1}
            onChange={(e) => setForm({ ...form, guests: e.target.value })} />
        </div>
      </div>

      <div>
        <label className="label">Notas</label>
        <textarea className="input resize-none" rows={2} value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </div>

      {erro && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{erro}</p>}

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancelar</button>
        <button type="submit" className="btn-primary flex-1" disabled={loading || (preco && !preco.disponivel)}>
          {loading ? 'A guardar...' : reservation ? 'Guardar' : 'Criar reserva'}
        </button>
      </div>
    </form>
  );
}
