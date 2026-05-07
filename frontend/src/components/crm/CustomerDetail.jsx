import { useState, useEffect } from 'react';
import { X, ArrowRight, Pencil, Check } from 'lucide-react';
import { getCustomer, updateCustomer } from '../../services/customersService';
import { useT } from '../../i18n';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Input, { Textarea } from '../ui/Input';
import LoadingSpinner from '../shared/LoadingSpinner';

function formatDate(d) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

export default function CustomerDetail({ customerId, onClose, onUpdate }) {
  const t = useT();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!customerId) return;
    setLoading(true);
    getCustomer(customerId)
      .then((data) => {
        setCustomer(data);
        setNotes(data.notes || '');
      })
      .finally(() => setLoading(false));
  }, [customerId]);

  async function saveNotes() {
    setSaving(true);
    try {
      const updated = await updateCustomer(customerId, { notes });
      setCustomer({ ...customer, notes: updated.notes });
      onUpdate?.(updated);
      setEditingNotes(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      {/* Overlay */}
      <div className="absolute inset-0 bg-ocean-900/30" onClick={onClose} />

      {/* Painel */}
      <div className="relative z-50 w-full max-w-md bg-white shadow-lg flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-n-200 shrink-0">
          <h2 className="font-display font-bold text-base text-n-900">
            {loading ? 'A carregar...' : customer?.name}
          </h2>
          <button onClick={onClose} className="p-1 text-n-400 hover:text-n-700 transition-colors">
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <LoadingSpinner size={28} />
          </div>
        ) : customer ? (
          <div className="flex-1 overflow-y-auto">
            {/* Metricas */}
            <div className="grid grid-cols-3 border-b border-n-200">
              {[
                { label: 'Visitas',      value: customer.total_visits },
                { label: 'Total gasto',  value: `€${Number(customer.total_spent).toFixed(0)}` },
                { label: 'Pais',         value: customer.country_code || '—' },
              ].map((m) => (
                <div key={m.label} className="px-4 py-4 text-center border-r last:border-r-0 border-n-200">
                  <p className="font-display font-bold text-xl text-ocean-700">{m.value}</p>
                  <p className="text-xs font-body text-n-500 mt-0.5">{m.label}</p>
                </div>
              ))}
            </div>

            <div className="px-5 py-4 space-y-5">
              {/* Dados de contacto */}
              <section>
                <h3 className="text-xs font-body font-bold uppercase tracking-wide text-n-500 mb-3">Contacto</h3>
                <div className="space-y-2">
                  <InfoRow label="Email"    value={customer.email} />
                  <InfoRow label="Telefone" value={customer.phone || '—'} />
                  <InfoRow label="Idioma"   value={customer.language?.toUpperCase()} />
                </div>
              </section>

              {/* Notas */}
              <section>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-body font-bold uppercase tracking-wide text-n-500">Notas</h3>
                  {!editingNotes && (
                    <button
                      onClick={() => setEditingNotes(true)}
                      className="text-xs text-ocean-700 hover:underline flex items-center gap-1"
                    >
                      <Pencil size={11} strokeWidth={1.75} /> Editar
                    </button>
                  )}
                </div>
                {editingNotes ? (
                  <div className="space-y-2">
                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setEditingNotes(false)} className="flex-1">Cancelar</Button>
                      <Button size="sm" loading={saving} onClick={saveNotes} className="flex-1">Guardar</Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm font-body text-n-600 whitespace-pre-line min-h-[2rem]">
                    {customer.notes || <span className="text-n-400 italic">Sem notas</span>}
                  </p>
                )}
              </section>

              {/* Historico de reservas */}
              <section>
                <h3 className="text-xs font-body font-bold uppercase tracking-wide text-n-500 mb-3">
                  Historico ({customer.reservations?.length || 0})
                </h3>
                {customer.reservations?.length === 0 ? (
                  <p className="text-sm font-body text-n-400 italic">Sem reservas</p>
                ) : (
                  <div className="space-y-2">
                    {customer.reservations?.map((r) => (
                      <div key={r.id} className="rounded-sm border border-n-200 px-3 py-2.5">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-xs font-body font-semibold text-n-700 truncate">
                            {r.units?.name || '—'}
                          </p>
                          <Badge variant={r.status}>{t(`reservations.status.${r.status}`)}</Badge>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-body text-n-500">
                          <span>{formatDate(r.check_in)}</span>
                          <ArrowRight size={10} strokeWidth={1.75} />
                          <span>{formatDate(r.check_out)}</span>
                          <span className="ml-auto font-semibold text-n-700">€{Number(r.total_price).toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="font-body text-n-500 w-20 shrink-0">{label}</span>
      <span className="font-body text-n-800">{value}</span>
    </div>
  );
}
