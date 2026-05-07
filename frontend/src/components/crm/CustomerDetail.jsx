import { useState, useEffect } from 'react';
import { getCustomer, updateCustomer } from '../../services/customersService';
import StatusBadge from '../reservations/StatusBadge';
import useAuthStore from '../../store/authStore';

function fmt(date) {
  return new Date(date + 'T00:00:00').toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function CustomerDetail({ customerId, onClose, onUpdate }) {
  const token = useAuthStore((s) => s.token);
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editandoNota, setEditandoNota] = useState(false);
  const [nota, setNota] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCustomer(token, customerId)
      .then(({ data }) => { setDados(data); setNota(data.notes || ''); })
      .finally(() => setLoading(false));
  }, [customerId]);

  async function handleSaveNota() {
    setSaving(true);
    try {
      const { data } = await updateCustomer(token, customerId, { notes: nota });
      setDados({ ...dados, notes: data.notes });
      onUpdate(data);
      setEditandoNota(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary-100 text-primary-500 flex items-center justify-center font-bold text-xl">
              {dados?.name?.charAt(0).toUpperCase() || '?'}
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{dados?.name}</h2>
              <p className="text-sm text-gray-400">{dados?.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 p-8">A carregar...</div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Visitas', value: dados.total_visits },
                { label: 'Total gasto', value: `${Number(dados.total_spent).toFixed(2)} €` },
                { label: 'Idioma', value: dados.language === 'en' ? '🇬🇧 English' : '🇵🇹 Português' }
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="font-bold text-gray-900">{value}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* Info */}
            <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
              {dados.phone && <p>📞 {dados.phone}</p>}
              {dados.country_code && <p>🌍 {dados.country_code}</p>}
              <p>📅 Cliente desde {fmt(dados.created_at.split('T')[0])}</p>
            </div>

            {/* Notas */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-700 text-sm">Notas internas</h3>
                {!editandoNota && (
                  <button onClick={() => setEditandoNota(true)} className="text-xs text-primary-500 hover:underline">
                    {dados.notes ? 'Editar' : 'Adicionar nota'}
                  </button>
                )}
              </div>
              {editandoNota ? (
                <div className="space-y-2">
                  <textarea
                    className="input resize-none w-full"
                    rows={3}
                    value={nota}
                    onChange={(e) => setNota(e.target.value)}
                    autoFocus
                    placeholder="Notas sobre este cliente..."
                  />
                  <div className="flex gap-2">
                    <button onClick={() => setEditandoNota(false)} className="btn-secondary text-sm py-1 px-3">Cancelar</button>
                    <button onClick={handleSaveNota} disabled={saving} className="btn-primary text-sm py-1 px-3">
                      {saving ? 'A guardar...' : 'Guardar'}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3 min-h-[60px]">
                  {dados.notes || <span className="text-gray-300 italic">Sem notas</span>}
                </p>
              )}
            </div>

            {/* Histórico de reservas */}
            <div>
              <h3 className="font-semibold text-gray-700 text-sm mb-3">
                Histórico de reservas ({dados.reservations?.length || 0})
              </h3>
              {dados.reservations?.length === 0 ? (
                <p className="text-sm text-gray-400">Sem reservas</p>
              ) : (
                <div className="space-y-2">
                  {dados.reservations?.map((r) => (
                    <div key={r.id} className="flex items-center justify-between text-sm border border-gray-100 rounded-lg p-3">
                      <div>
                        <p className="font-medium text-gray-800">{r.units?.name}</p>
                        <p className="text-xs text-gray-400">{fmt(r.check_in)} → {fmt(r.check_out)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary-500">{Number(r.total_price).toFixed(2)} €</p>
                        <StatusBadge status={r.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
