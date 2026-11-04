import { useState, useEffect, useMemo } from 'react';
import { Plus, ClipboardList, X } from 'lucide-react';
import { listReservations, createReservation, updateReservation, deleteReservation } from '../services/reservationsService';
import api from '../services/api';
import { listUnits } from '../services/unitsService';
import { listStaff } from '../services/staffService';
import useAuthStore from '../store/authStore';
import { useT } from '../i18n';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import FilterChips from '../components/ui/FilterChips';
import Input, { Select } from '../components/ui/Input';
import ReservationCard from '../components/reservations/ReservationCard';
import ReservationForm from '../components/reservations/ReservationForm';
import ReservationDetailModal from '../components/reservations/ReservationDetailModal';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import ActivityTable from './reservations/ActivityTable';
import RentacarTable from './reservations/RentacarTable';
import RestaurantTable from './reservations/RestaurantTable';
import ManifestoModal from './reservations/ManifestoModal';
import RescheduleModal from './reservations/RescheduleModal';
import NoShowModal from './reservations/NoShowModal';
import LevantamentoModal from './reservations/LevantamentoModal';
import DevolucaoModal from './reservations/DevolucaoModal';
import RestaurantCreateModal from './reservations/RestaurantCreateModal';
import { SOURCE_LABEL } from './reservations/shared';

const STATUS_FILTERS = ['', 'pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled'];
const TURNO_FILTERS = [{ value: '', label: 'Todos turnos' }, { value: 'almoco', label: 'Almoco' }, { value: 'jantar', label: 'Jantar' }];

/* meta.turno so existe quando definido manualmente (RestaurantCreateModal,
   notes_guest). Reservas com hora real (start_time -- publicas ou criadas
   pelo staff a partir de agora) nunca o preenchem, por isso o filtro por
   turno tem de derivar o mesmo bucket a partir da hora quando meta.turno
   nao existir, senao ficam invisiveis ao filtrar por Almoco/Jantar. */
function deriveTurno(r, meta) {
  if (meta?.turno) return meta.turno;
  if (r?.start_time) return Number(r.start_time.slice(0, 2)) < 17 ? 'almoco' : 'jantar';
  return '';
}

export default function Reservations() {
  const t = useT();
  const { operator } = useAuthStore();
  const opType = operator?.operator_type || 'hotel';
  const isActivity   = opType === 'activity';
  const isRentacar   = opType === 'rentacar';
  const isRestaurant = opType === 'restaurant';

  const [reservations,    setReservations]    = useState([]);
  const [units,           setUnits]           = useState([]);
  const [guides,          setGuides]          = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [modal,           setModal]           = useState(null);
  const [formLoading,     setFormLoading]     = useState(false);
  const [formError,       setFormError]       = useState('');
  const [manifesto,       setManifesto]       = useState(false);
  const [rescheduleRes,   setRescheduleRes]   = useState(null);
  const [noShowRes,       setNoShowRes]       = useState(null);
  const [voucherLoading,  setVoucherLoading]  = useState(null);
  const [levantamentoRes, setLevantamentoRes] = useState(null);
  const [devolucaoRes,    setDevolucaoRes]    = useState(null);
  const [detailsRes,      setDetailsRes]      = useState(null);
  const [viewResId,       setViewResId]       = useState(null);
  const [turnoFilter,     setTurnoFilter]     = useState('');

  const [statusFilter, setStatusFilter] = useState('');
  const [tourFilter,   setTourFilter]   = useState('');
  const [dateFilter,   setDateFilter]   = useState('');
  const [sourceFilter, setSourceFilter] = useState('');

  async function carregar() {
    setLoading(true);
    try {
      const [res, uns, staff] = await Promise.all([
        listReservations({}),
        listUnits(),
        isActivity ? listStaff() : Promise.resolve([]),
      ]);
      setReservations(res);
      const tables = opType === 'restaurant'
        ? uns.filter(u => u.unit_type !== 'menu_item' && u.unit_type !== 'tasting_menu')
        : uns;
      setUnits(tables.filter(u => u.status === 'active'));
      setGuides((staff || []).filter(s => ['Guia', 'Instrutor', 'Condutor', 'Motorista'].includes(s.role)));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  const filtered = useMemo(() => {
    return reservations.filter(r => {
      if (statusFilter && r.status   !== statusFilter) return false;
      if (tourFilter   && r.unit_id  !== tourFilter)   return false;
      if (dateFilter   && r.check_in !== dateFilter)   return false;
      if (sourceFilter && r.source   !== sourceFilter) return false;
      if (isRestaurant && turnoFilter) {
        let meta = {};
        try { meta = JSON.parse(r.notes_guest || '{}'); } catch {}
        if (deriveTurno(r, meta) !== turnoFilter) return false;
      }
      return true;
    });
  }, [reservations, statusFilter, tourFilter, dateFilter, sourceFilter, isRestaurant, turnoFilter]);

  const hasFilters = statusFilter || tourFilter || dateFilter || sourceFilter;

  /* Chips de estado: '' = Todas, os restantes vem das traducoes */
  const statusOptions = STATUS_FILTERS.map(s => ({ value: s, label: s ? t(`reservations.status.${s}`) : 'Todas' }));

  function clearFilters() {
    setStatusFilter('');
    setTourFilter('');
    setDateFilter('');
    setSourceFilter('');
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
        setReservations(reservations.map(x => (x.id === r.id ? r : x)));
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
      setReservations(reservations.filter(r => r.id !== deletedId));
    } else {
      setReservations(reservations.map(r => (r.id === updated.id ? updated : r)));
    }
  }

  /* Pedido real de um operador (Logan Tours): nao havia nenhuma forma de
     eliminar uma reserva de teste -- o endpoint DELETE ja existia no
     backend, so faltava o botao. Eliminar e irreversivel, por isso pede
     sempre confirmacao (mesmo padrao ja usado noutras paginas, ex:
     Partners.jsx). */
  async function handleDelete(r) {
    if (!window.confirm('Eliminar esta reserva? Esta acção não pode ser desfeita.')) return;
    await deleteReservation(r.id);
    handleUpdate(null, r.id);
  }

  async function handleSendVoucher(r) {
    setVoucherLoading(r.id);
    try {
      await api.post(`/reservations/${r.id}/voucher`);
    } catch (err) { console.error(err); }
    finally { setVoucherLoading(null); }
  }

  return (
    <div>
      <PageHeader
        title={t('reservations.title')}
        subtitle={`${filtered.length} resultado(s)`}
        actions={
          <div className="flex flex-wrap gap-2">
            {isActivity && (
              <Button variant="secondary" icon={ClipboardList} onClick={() => setManifesto(true)}>
                Manifesto
              </Button>
            )}
            <Button icon={Plus} onClick={() => { setFormError(''); setModal('create'); }}>
              {t('reservations.new')}
            </Button>
          </div>
        }
      />

      {/* Filtros */}
      {isActivity ? (
        <div className="flex flex-wrap gap-2 mb-6 items-center">
          {/* Status */}
          <FilterChips options={statusOptions} value={statusFilter} onChange={setStatusFilter} />

          {/* Tour */}
          <Select
            value={tourFilter}
            onChange={e => setTourFilter(e.target.value)}
            className="w-44"
          >
            <option value="">Todos os tours</option>
            {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>

          {/* Data */}
          <Input
            type="date"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="w-40"
          />

          {/* Origem */}
          <Select
            value={sourceFilter}
            onChange={e => setSourceFilter(e.target.value)}
            className="w-44"
          >
            <option value="">Todas as origens</option>
            {Object.entries(SOURCE_LABEL).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </Select>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-3 py-1.5 rounded-sm text-xs font-body text-n-500 hover:text-n-900 border border-n-200 hover:border-n-400 bg-white transition-colors"
            >
              <X size={11} strokeWidth={2} />
              Limpar
            </button>
          )}
        </div>
      ) : (
        <div className="flex gap-2 flex-wrap items-center mb-6">
          <FilterChips options={statusOptions} value={statusFilter} onChange={setStatusFilter} />
          {isRestaurant && (
            <>
              <div className="w-px bg-n-200 self-stretch mx-1" />
              <FilterChips options={TURNO_FILTERS} value={turnoFilter} onChange={setTurnoFilter} />
            </>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <LoadingSpinner size={32} />
        </div>
      ) : isActivity ? (
        <ActivityTable
          reservations={filtered}
          units={units}
          guides={guides}
          onEdit={r => { setFormError(''); setModal(r); }}
          onDelete={handleDelete}
          onUpdate={handleUpdate}
          onReschedule={setRescheduleRes}
          onNoShow={setNoShowRes}
          onVoucher={handleSendVoucher}
          voucherLoading={voucherLoading}
          onView={r => setViewResId(r.id)}
        />
      ) : isRentacar ? (
        <RentacarTable
          reservations={filtered}
          units={units}
          onEdit={r => { setFormError(''); setModal(r); }}
          onDelete={handleDelete}
          onLevantamento={setLevantamentoRes}
          onDevolucao={setDevolucaoRes}
          onUpdate={u => handleUpdate(u)}
          onView={r => setViewResId(r.id)}
        />
      ) : isRestaurant ? (
        <RestaurantTable
          reservations={filtered}
          units={units}
          onEdit={r => { setFormError(''); setModal(r); }}
          onDelete={handleDelete}
          onDetails={setDetailsRes}
          onUpdate={u => handleUpdate(u)}
          onView={r => setViewResId(r.id)}
        />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-n-400">
          <p className="font-body text-sm">{t('common.noResults')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(r => (
            <ReservationCard
              key={r.id}
              reservation={r}
              onUpdate={handleUpdate}
              onEdit={res => { setFormError(''); setModal(res); }}
              onView={res => setViewResId(res.id)}
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
            operatorType={opType}
            onSave={handleSave}
            onCancel={() => setModal(null)}
            loading={formLoading}
            error={formError}
          />
        )}
      </Modal>

      <ManifestoModal
        open={manifesto}
        onClose={() => setManifesto(false)}
        reservations={reservations}
        units={units}
      />

      <RescheduleModal
        reservation={rescheduleRes}
        open={!!rescheduleRes}
        onClose={() => setRescheduleRes(null)}
        onDone={newDate => {
          setReservations(prev => prev.map(r =>
            r.id === rescheduleRes?.id ? { ...r, check_in: newDate } : r
          ));
          setRescheduleRes(null);
        }}
      />

      <NoShowModal
        reservation={noShowRes}
        open={!!noShowRes}
        onClose={() => setNoShowRes(null)}
        onDone={() => {
          setReservations(prev => prev.map(r =>
            r.id === noShowRes?.id ? { ...r, status: 'no_show' } : r
          ));
          setNoShowRes(null);
        }}
      />

      <LevantamentoModal
        reservation={levantamentoRes}
        units={units}
        open={!!levantamentoRes}
        onClose={() => setLevantamentoRes(null)}
        onDone={() => {
          setReservations(prev => prev.map(r =>
            r.id === levantamentoRes?.id ? { ...r, status: 'checked_in' } : r
          ));
          setLevantamentoRes(null);
        }}
      />

      <DevolucaoModal
        reservation={devolucaoRes}
        units={units}
        open={!!devolucaoRes}
        onClose={() => setDevolucaoRes(null)}
        onDone={() => {
          setReservations(prev => prev.map(r =>
            r.id === devolucaoRes?.id ? { ...r, status: 'checked_out' } : r
          ));
          setDevolucaoRes(null);
        }}
      />

      <RestaurantCreateModal
        reservation={detailsRes}
        units={units}
        open={!!detailsRes}
        onClose={() => setDetailsRes(null)}
        onDone={() => setDetailsRes(null)}
      />

      <ReservationDetailModal
        reservationId={viewResId}
        open={!!viewResId}
        onClose={() => setViewResId(null)}
      />
    </div>
  );
}
