import { useState } from 'react';

const UNIT_TYPES = {
  hotel:    ['Quarto Standard', 'Quarto Double', 'Suite', 'Apartamento', 'Villa'],
  activity: ['Mergulho', 'Passeio de Barco', 'Kitesurf', 'Excursão', 'Snorkeling'],
  rentacar: ['Económico', 'Compacto', 'SUV', 'Pickup', 'Moto'],
  restaurant: ['Mesa Interior', 'Mesa Exterior', 'Mesa VIP', 'Terraço']
};

export default function UnitForm({ unit, operatorType, onSave, onCancel, loading, erro }) {
  const tipos = UNIT_TYPES[operatorType] || [];
  const [form, setForm] = useState({
    name: unit?.name || '',
    description: unit?.description || '',
    unit_type: unit?.unit_type || (tipos[0] || ''),
    base_price: unit?.base_price || '',
    capacity: unit?.capacity || 1,
    status: unit?.status || 'active'
  });

  function handleSubmit(e) {
    e.preventDefault();
    onSave({ ...form, base_price: Number(form.base_price), capacity: Number(form.capacity) });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Nome da unidade *</label>
        <input
          type="text"
          className="input"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
          autoFocus
        />
      </div>

      <div>
        <label className="label">Tipo *</label>
        <select
          className="input"
          value={form.unit_type}
          onChange={(e) => setForm({ ...form, unit_type: e.target.value })}
          required
        >
          {tipos.map((t) => <option key={t} value={t}>{t}</option>)}
          <option value="Outro">Outro</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Preço base (€) *</label>
          <input
            type="number"
            className="input"
            value={form.base_price}
            onChange={(e) => setForm({ ...form, base_price: e.target.value })}
            min="0"
            step="0.01"
            required
          />
        </div>
        <div>
          <label className="label">Capacidade *</label>
          <input
            type="number"
            className="input"
            value={form.capacity}
            onChange={(e) => setForm({ ...form, capacity: e.target.value })}
            min="1"
            required
          />
        </div>
      </div>

      <div>
        <label className="label">Descrição</label>
        <textarea
          className="input resize-none"
          rows={3}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Descreva a unidade..."
        />
      </div>

      {unit && (
        <div>
          <label className="label">Estado</label>
          <select
            className="input"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          >
            <option value="active">Activa</option>
            <option value="inactive">Inactiva</option>
          </select>
        </div>
      )}

      {erro && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{erro}</p>}

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">
          Cancelar
        </button>
        <button type="submit" className="btn-primary flex-1" disabled={loading}>
          {loading ? 'A guardar...' : unit ? 'Guardar alterações' : 'Criar unidade'}
        </button>
      </div>
    </form>
  );
}
