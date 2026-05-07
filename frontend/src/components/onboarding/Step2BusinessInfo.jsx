import { useState } from 'react';

const labels = {
  hotel: 'Hotel / Alojamento',
  activity: 'Actividade Turística',
  rentacar: 'Rent-a-Car',
  restaurant: 'Restaurante / Bar'
};

function gerarSlug(nome) {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export default function Step2BusinessInfo({ operatorType, onNext, onBack, loading, erro }) {
  const [form, setForm] = useState({ name: '', slug: '', phone: '', address: '' });

  function handleNameChange(e) {
    const name = e.target.value;
    setForm({ ...form, name, slug: gerarSlug(name) });
  }

  function handleSubmit(e) {
    e.preventDefault();
    onNext(form);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Informações do negócio</h2>
        <p className="text-sm text-gray-500 mb-4">
          A configurar como: <span className="font-medium text-primary-500">{labels[operatorType]}</span>
        </p>
      </div>

      <div>
        <label className="label">Nome do negócio *</label>
        <input
          type="text"
          className="input"
          value={form.name}
          onChange={handleNameChange}
          placeholder="Ex: Sal Divers, Hotel Morabeza..."
          required
          autoFocus
        />
      </div>

      <div>
        <label className="label">URL pública (slug) *</label>
        <div className="flex items-center border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-transparent">
          <span className="pl-3 text-gray-400 text-sm">saldesk.cv/</span>
          <input
            type="text"
            className="flex-1 py-2 pr-3 text-sm focus:outline-none bg-transparent"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            required
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">Usado na página pública de reservas</p>
      </div>

      <div>
        <label className="label">Telefone</label>
        <input
          type="tel"
          className="input"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          placeholder="+238 9XX XXX XXX"
        />
      </div>

      <div>
        <label className="label">Morada</label>
        <input
          type="text"
          className="input"
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          placeholder="Ex: Santa Maria, Sal, Cabo Verde"
        />
      </div>

      {erro && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{erro}</p>}

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onBack} className="btn-secondary flex-1">
          Voltar
        </button>
        <button type="submit" className="btn-primary flex-1" disabled={loading}>
          {loading ? 'A guardar...' : 'Continuar'}
        </button>
      </div>
    </form>
  );
}
