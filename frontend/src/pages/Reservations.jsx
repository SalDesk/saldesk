import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { listReservations, createReservation, updateReservation } from '../services/reservationsService';
import { listUnits } from '../services/unitsService';
import { useT } from '../i18n';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';
import ReservationCard from '../components/reservations/ReservationCard';
import ReservationForm from '../components/reservations/ReservationForm';
import LoadingSpinner from '../components/shared/LoadingSpinner';

const STATUS_FILTERS = ['', 'pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled'];

export default function Reservations() {
  const t = useT();
  const [reservations, setReservations] = useState([]);
  const [units, setUnits] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  async function carregar(status = statusFilter) {
    setLoading(true);
    try {
      const filtros = status ? { status } : {};
      const [res, uns] = await Promise.all([
        listReservations(filtros),
        listUnits(),
      ]);
      setReservations(res);
      setUnits(uns.filter((u) => u.status === 'active'));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  function handleFilterChange(s) {
    setStatusFilter(s);
    carregar(s);
  }

  async function handleSave(dados) {
    setFormError('');
    setFormLoading(true);
    try {
      if (modal === 'create') {
        const r = await createReservation(dados);
        setReservations([r, ...reservations]);
      } else {
        const r = await updateReservation(modal.id, dados);
        setReservations(reservations.map((x) => (x.id === r.id ? r : x)));
      }
      setModal(null);
    } catch (err) {
      setFormError(err.response?.data?.error || t('errors.generic'));
    } finally {
      setFormLoading(false);
    }
  }

  function handleUpdate(updated, deletedId) {
    if (updated === null) {
      setReservations(reservations.filter((r) => r.id !== deletedId));
    } else {
      setReservations(reservations.map((r) => (r.id === updated.id ? updated : r)));
    }
  }

  return (
    <div>
      <PageHeader
        title={t('reservations.title')}
        subtitle={`${reservations.length} resultado(s)`}
        actions={
          <Button icon={Plus} onClick={() => { setFormError(''); setModal('create'); }}>
            {t('reservations.new')}
          </Button>
        }
      />

      {/* Filtros de status */}
      <div className="flex gap-2 flex-wrap mb-6">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => handleFilterChange(s)}
            className={[
              'px-3 py-1.5 rounded-sm text-xs font-body font-semibold transition-colors',
              statusFilter === s
                ? 'bg-ocean-700 text-white'
                : 'bg-white border border-n-200 text-n-600 hover:border-ocean-300',
            ].join(' ')}
          >
            {s ? t(`reservations.status.${s}`) : 'Todas'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <LoadingSpinner size={32} />
        </div>
      ) : reservations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-n-400">
          <p className="font-body text-sm">{t('common.noResults')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reservations.map((r) => (
            <ReservationCard
              key={r.id}
              reservation={r}
              onUpdate={handleUpdate}
              onEdit={(res) => { setFormError(''); setModal(res); }}
            />
          ))}
        </div>
      )}

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal === 'create' ? t('reservations.new') : 'Editar Reserva'}
        size="md"
      >
        {modal && (
          <ReservationForm
            reservation={modal !== 'create' ? modal : null}
            units={units}
            onSave={handleSave}
            onCancel={() => setModal(null)}
            loading={formLoading}
            error={formError}
          />
        )}
      </Modal>
    </div>
  );
}
