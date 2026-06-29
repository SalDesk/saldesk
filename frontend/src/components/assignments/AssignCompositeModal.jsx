import { useState, useEffect } from 'react';
import { listFleet } from '../../services/fleetService';
import { createCompositeAssignment } from '../../services/assignmentService';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Select } from '../ui/Input';

/**
 * Atribuicao composta Guia + Condutor + Viatura para reservas de Activity/Tour.
 * Aceita uma `reservation` ja escolhida (entrada a partir da propria reserva), ou uma
 * lista `reservations` para o operador escolher de dentro do modal (entrada a partir
 * da pagina de Guias, por colaborador).
 */
export default function AssignCompositeModal({ reservation, reservations, guide, guides, onClose, onDone }) {
  const [selected,   setSelected]   = useState(reservation?.id || '');
  const [guideId,    setGuideId]    = useState(guide?.id || '');
  const [driverId,   setDriverId]   = useState(guide?.id || '');
  const [samePerson, setSamePerson] = useState(true);
  const [vehicles,   setVehicles]   = useState([]);
  const [vehicleId,  setVehicleId]  = useState('');
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState('');

  useEffect(() => {
    listFleet({ type: 'vehicle', status: 'available' }).then(setVehicles).catch(() => setVehicles([]));
  }, []);

  useEffect(() => {
    if (samePerson) setDriverId(guideId);
  }, [samePerson, guideId]);

  const upcoming = (reservations || []).filter(r =>
    ['pending', 'confirmed'].includes(r.status) &&
    r.check_in >= new Date().toISOString().split('T')[0]
  ).sort((a, b) => a.check_in.localeCompare(b.check_in));

  const canSubmit = selected && guideId && driverId && vehicleId;

  async function handleAssign() {
    if (!canSubmit) return;
    setSaving(true); setError('');
    try {
      await createCompositeAssignment({
        reservation_id: selected,
        vehicle_id: vehicleId,
        guide_id: guideId,
        driver_id: driverId,
      });
      onDone();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao atribuir');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Atribuir equipa" size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleAssign} loading={saving} disabled={!canSubmit}>Atribuir</Button>
        </>
      }>
      <div className="space-y-4">
        {!reservation && (
          <div>
            <p className="text-xs font-body font-bold uppercase tracking-wide text-n-500 mb-2">Reserva</p>
            {upcoming.length === 0 ? (
              <p className="text-sm font-body text-n-500 text-center py-4">Sem reservas proximas pendentes.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {upcoming.map(r => (
                  <label key={r.id}
                    className={`flex items-start gap-3 p-3 rounded-sm border cursor-pointer transition-colors ${
                      selected === r.id ? 'bg-ocean-50 border-ocean-300' : 'bg-n-50 border-n-200 hover:border-n-300'
                    }`}>
                    <input type="radio" name="res" value={r.id} checked={selected === r.id}
                      onChange={() => setSelected(r.id)} className="mt-0.5 accent-ocean-700" />
                    <div>
                      <p className="text-sm font-display font-semibold text-n-900">
                        {r.units?.name || r.unit_id?.slice(0, 8)}
                      </p>
                      <p className="text-xs font-body text-n-500 mt-0.5">
                        {r.check_in} · {r.guests} pax · {r.customer_name || '—'}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {reservation && (
          <div className="bg-ocean-50 border border-ocean-100 rounded-sm px-3 py-2.5">
            <p className="text-sm font-display font-semibold text-ocean-900">
              {reservation.units?.name || '—'}
            </p>
            <p className="text-xs font-body text-ocean-600 mt-0.5">
              {reservation.check_in} · {reservation.guests} pax · {reservation.customer_name || '—'}
            </p>
          </div>
        )}

        <Select label="Guia" value={guideId} onChange={e => setGuideId(e.target.value)} required>
          <option value="">Seleccionar guia...</option>
          {(guides || []).map(g => <option key={g.id} value={g.id}>{g.name} ({g.role})</option>)}
        </Select>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={samePerson} onChange={e => setSamePerson(e.target.checked)} className="accent-ocean-700" />
          <span className="text-sm font-body text-n-700">É a mesma pessoa que conduz?</span>
        </label>

        <Select label="Condutor" value={driverId} onChange={e => setDriverId(e.target.value)} disabled={samePerson} required>
          <option value="">Seleccionar condutor...</option>
          {(guides || []).map(g => <option key={g.id} value={g.id}>{g.name} ({g.role})</option>)}
        </Select>

        <Select label="Viatura" value={vehicleId} onChange={e => setVehicleId(e.target.value)} required>
          <option value="">Seleccionar viatura...</option>
          {vehicles.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
        </Select>

        {error && <p className="text-xs font-body text-error">{error}</p>}
      </div>
    </Modal>
  );
}
