import { usePageTitle } from '../hooks/usePageTitle';
import { useState, useEffect } from 'react';
import ReservationCard from '../components/reservations/ReservationCard';
import ReservationForm from '../components/reservations/ReservationForm';
import { listReservations, createReservation, updateReservation } from '../services/reservationsService';
import { listUnits } from '../services/unitsService';
import useAuthStore from '../store/authStore';

const FILTROS_STATUS = [
  { value: '', label: 'Todas' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'confirmed', label: 'Confirmadas' },
  { value: 'checked_in', label: 'Check-in' },
  { value: 'checked_out', label: 'Check-out' },
  { value: 'cancelled', label: 'Canceladas' }
];

export default function Reservations() {
  usePageTitle('Reservas');
  const token = useAuthStore((s) => s.token);
  const [reservations, setReservations] = useState([]);
  const [units, setUnits] = useState([]);
  const [filtroStatus, setFiltroStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'create' | { reservation }
  const [formLoading, setFormLoading] = useState(false);
  const [formErro, setFormErro] = useState('');

  async function carregar(status = filtroStatus) {
    setLoading(true);
    try {
      const filtros = {};
      if (status) filtros.status = status;
      const [resRes, unitsRes] = await Promise.all([
        listReservations(token, filtros),
        listUnits(token)
      ]);
      setReservations(resRes.data);
      setUnits(unitsRes.data.filter((u) => u.status === 'active'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  async function handleFiltro(status) {
    setFiltroStatus(status);
    carregar(status);
  }

  async function handleSave(dados) {
    setFormErro('');
    setFormLoading(true);
    try {
      if (modal === 'create') {
        const { data } = await createReservation(token, dados);
        setReservations([data, ...reservations]);
      } else {
        const { data } = await updateReservation(token, modal.reservation.id, dados);
        setReservations(reservations.map((r) => (r.id === data.id ? data : r)));
      }
      setModal(null);
    } catch (err) {
      setFormErro(err.message);
    } finally {
      setFormLoading(false);
    }
  }

  function handleUpdate(updated) {
    if (!updated) {
      setReservations(reservations.filter((r) => r.id !== updated?.id));
      carregar(filtroStatus);
      return;
    }
    setReservations(reservations.map((r) => (r.id === updated.id ? updated : r)));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reservas</h1>
          <p className="text-gray-500 text-sm mt-1">{reservations.length} resultado(s)</p>
        </div>
        <button onClick={() => { setFormErro(''); setModal('create'); }} className="btn-primary">
          + Nova Reserva
        </button>
      </div>

      {/* Filtros de status */}
      <div className="flex gap-2 flex-wrap mb-6">
        {FILTROS_STATUS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => handleFiltro(value)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filtroStatus === value
                ? 'bg-primary-500 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-primary-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">A carregar...</div>
      ) : reservations.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-4">📅</div>
          <p className="font-medium">Sem reservas</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reservations.map((r) => (
            <ReservationCard
              key={r.id}
              reservation={r}
              onUpdate={handleUpdate}
              onEdit={(res) => { setFormErro(''); setModal({ reservation: res }); }}
            />
          ))}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 my-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {modal === 'create' ? 'Nova Reserva' : `Editar Reserva`}
            </h2>
            <ReservationForm
              reservation={modal !== 'create' ? modal.reservation : null}
              units={units}
              onSave={handleSave}
              onCancel={() => setModal(null)}
              loading={formLoading}
              erro={formErro}
            />
          </div>
        </div>
      )}
    </div>
  );
}
