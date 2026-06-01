import { useState, useEffect, useMemo } from 'react';
import {
  Plus, ClipboardList, Pencil, Trash2, ChevronRight, Filter, X,
  CalendarDays, Mail, UserX, FileText,
} from 'lucide-react';
import { listReservations, createReservation, updateReservation, changeStatus, deleteReservation } from '../services/reservationsService';
import api from '../services/api';
import { listUnits } from '../services/unitsService';
import useAuthStore from '../store/authStore';
import { useT } from '../i18n';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';
import ReservationCard from '../components/reservations/ReservationCard';
import ReservationForm from '../components/reservations/ReservationForm';
import LoadingSpinner from '../components/shared/LoadingSpinner';

const STATUS_FILTERS = ['', 'pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled'];

const SOURCE_LABEL = {
  direct:       'Directo',
  public:       'Pag. Publica',
  booking_com:  'Booking.com',
  airbnb:       'Airbnb',
  viator:       'Viator',
  getyourguide: 'GetYourGuide',
  manual:       'Manual',
};

const SOURCE_CLASS = {
  direct:       'bg-ocean-50 text-ocean-700 border border-ocean-100',
  public:       'bg-ocean-50 text-ocean-700 border border-ocean-100',
  booking_com:  'bg-blue-50 text-blue-700 border border-blue-200',
  airbnb:       'bg-rose-50 text-rose-700 border border-rose-200',
  viator:       'bg-orange-50 text-orange-700 border border-orange-200',
  getyourguide: 'bg-[#ECFDF5] text-[#1A7A4A] border border-[#BBF7D0]',
  manual:       'bg-n-50 text-n-600 border border-n-200',
};

const STATUS_NEXT  = { pending: 'confirmed', confirmed: 'checked_in', checked_in: 'checked_out' };
const STATUS_NEXT_LABEL = { pending: 'Confirmar', confirmed: 'Check-in', checked_in: 'Check-out' };

function formatDate(d) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function SourceBadge({ source }) {
  return (
    <span className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded-xs uppercase tracking-wide whitespace-nowrap ${SOURCE_CLASS[source] || SOURCE_CLASS.manual}`}>
      {SOURCE_LABEL[source] || source}
    </span>
  );
}

function ActivityTable({ reservations, units, onEdit, onUpdate, onReschedule, onNoShow, onVoucher, voucherLoading }) {
  const t = useT();
  const [actionLoading, setActionLoading] = useState(null);

  async function handleNextStatus(r) {
    const next = STATUS_NEXT[r.status];
    if (!next) return;
    setActionLoading(r.id);
    try {
      const updated = await changeStatus(r.id, next);
      onUpdate(updated);
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  }

  if (reservations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-n-400">
        <ClipboardList size={40} strokeWidth={1.25} className="mb-3" />
        <p className="font-body text-sm">{t('common.noResults')}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-md border border-n-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-n-200 bg-n-50">
              <th className="text-left px-4 py-3 text-xs font-body font-bold uppercase tracking-wide text-n-500 whitespace-nowrap">Ref</th>
              <th className="text-left px-4 py-3 text-xs font-body font-bold uppercase tracking-wide text-n-500 whitespace-nowrap">Tour</th>
              <th className="text-left px-4 py-3 text-xs font-body font-bold uppercase tracking-wide text-n-500 whitespace-nowrap">Data</th>
              <th className="text-left px-4 py-3 text-xs font-body font-bold uppercase tracking-wide text-n-500 whitespace-nowrap">Cliente</th>
              <th className="text-center px-4 py-3 text-xs font-body font-bold uppercase tracking-wide text-n-500">Pax</th>
              <th className="text-left px-4 py-3 text-xs font-body font-bold uppercase tracking-wide text-n-500 whitespace-nowrap">Origem</th>
              <th className="text-left px-4 py-3 text-xs font-body font-bold uppercase tracking-wide text-n-500 whitespace-nowrap">Estado</th>
              <th className="text-right px-4 py-3 text-xs font-body font-bold uppercase tracking-wide text-n-500 whitespace-nowrap">Total</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-n-100">
            {reservations.map((r) => {
              const canAdvance = !!STATUS_NEXT[r.status];
              const isLoading  = actionLoading === r.id;
              return (
                <tr key={r.id} className="hover:bg-n-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono text-n-400">{r.id?.slice(0, 8)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-display font-semibold text-sm text-n-900 truncate max-w-[140px]">
                      {r.units?.name || units.find(u => u.id === r.unit_id)?.name || '—'}
                    </p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-sm font-body text-n-700">{formatDate(r.check_in)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-body text-n-900 truncate max-w-[140px]">{r.customer_name || '—'}</p>
                      {r.customer_country && (
                        <p className="text-xs font-body text-n-400">{r.customer_country}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm font-body font-semibold text-n-900">{r.guests}</span>
                  </td>
                  <td className="px-4 py-3">
                    <SourceBadge source={r.source} />
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={r.status}>{t(`reservations.status.${r.status}`)}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <span className="font-display font-bold text-sm text-ocean-700">
                      €{Number(r.total_price || r.total_amount || 0).toFixed(0)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end flex-wrap">
                      {canAdvance && (
                        <button
                          onClick={() => handleNextStatus(r)}
                          disabled={isLoading}
                          className="flex items-center gap-1 px-2 py-1 rounded-xs bg-ocean-700 text-white text-xs font-body font-medium hover:bg-ocean-500 transition-colors disabled:opacity-50 whitespace-nowrap"
                        >
                          {STATUS_NEXT_LABEL[r.status]}
                          <ChevronRight size={11} strokeWidth={2} />
                        </button>
                      )}
                      <button onClick={() => onReschedule(r)} title="Reagendar"
                        className="p-1.5 rounded text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors">
                        <CalendarDays size={13} strokeWidth={1.75} />
                      </button>
                      <button onClick={() => onVoucher(r)} title="Enviar voucher"
                        disabled={voucherLoading === r.id}
                        className="p-1.5 rounded text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors disabled:opacity-40">
                        <Mail size={13} strokeWidth={1.75} />
                      </button>
                      {!['cancelled','no_show','checked_out'].includes(r.status) && (
                        <button onClick={() => onNoShow(r)} title="No-show"
                          className="p-1.5 rounded text-n-400 hover:text-error hover:bg-red-50 transition-colors">
                          <UserX size={13} strokeWidth={1.75} />
                        </button>
                      )}
                      <Button variant="ghost" size="sm" icon={Pencil} onClick={() => onEdit(r)} aria-label="Editar" />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ManifestoModal({ open, onClose, reservations, units }) {
  const [tourId, setTourId] = useState('');
  const [date,   setDate]   = useState('');

  const participants = useMemo(() => {
    if (!tourId && !date) return [];
    return reservations.filter(r => {
      const matchTour = !tourId || r.unit_id === tourId;
      const matchDate = !date   || r.check_in === date;
      const active    = ['pending', 'confirmed', 'checked_in', 'checked_out'].includes(r.status);
      return matchTour && matchDate && active;
    }).sort((a, b) => (a.customer_name || '').localeCompare(b.customer_name || ''));
  }, [reservations, tourId, date]);

  const totalPax = participants.reduce((s, r) => s + (r.guests || 0), 0);
  const tourName = units.find(u => u.id === tourId)?.name || '';

  function handlePrintPdf() {
    window.print();
  }

  return (
    <Modal open={open} onClose={onClose} title="Manifesto de Participantes" size="xl">
      <div className="space-y-4">
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600 block mb-1">Tour</label>
            <select value={tourId} onChange={e => setTourId(e.target.value)}
              className="w-full h-9 px-3 rounded-sm border border-n-300 text-sm font-body bg-n-100 text-n-900 focus:outline-none focus:ring-2 focus:ring-ocean-300 focus:border-ocean-700 focus:bg-white">
              <option value="">Todos os tours</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600 block mb-1">Data</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full h-9 px-3 rounded-sm border border-n-300 text-sm font-body bg-n-100 text-n-900 focus:outline-none focus:ring-2 focus:ring-ocean-300 focus:border-ocean-700 focus:bg-white"
            />
          </div>
        </div>

        {(tourId || date) ? (
          <>
            <div className="bg-ocean-50 border border-ocean-100 rounded-sm px-4 py-3 flex items-center justify-between">
              <div>
                <p className="font-display font-semibold text-sm text-ocean-900">
                  {tourName || 'Todos os tours'}{date ? ` · ${formatDate(date)}` : ''}
                </p>
                <p className="text-xs font-body text-ocean-600 mt-0.5">{participants.length} reservas · {totalPax} participantes</p>
              </div>
              {participants.length > 0 && (
                <button onClick={handlePrintPdf}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-ocean-200 bg-white text-xs font-body text-ocean-700 hover:bg-ocean-100 transition-colors">
                  <FileText size={13} strokeWidth={1.75} />
                  Exportar PDF
                </button>
              )}
            </div>

            {participants.length === 0 ? (
              <p className="text-sm font-body text-n-500 text-center py-6">Nenhum participante encontrado.</p>
            ) : (
              <div className="border border-n-200 rounded-sm overflow-hidden overflow-x-auto">
                <table className="w-full text-sm" style={{ minWidth: 700 }}>
                  <thead>
                    <tr className="bg-n-50 border-b border-n-200">
                      <th className="text-left px-3 py-2.5 text-xs font-body font-bold uppercase tracking-wide text-n-500">#</th>
                      <th className="text-left px-3 py-2.5 text-xs font-body font-bold uppercase tracking-wide text-n-500">Nome</th>
                      <th className="text-left px-3 py-2.5 text-xs font-body font-bold uppercase tracking-wide text-n-500">Telefone</th>
                      <th className="text-left px-3 py-2.5 text-xs font-body font-bold uppercase tracking-wide text-n-500">Contacto emergencia</th>
                      <th className="text-left px-3 py-2.5 text-xs font-body font-bold uppercase tracking-wide text-n-500">Req. especiais</th>
                      <th className="text-center px-3 py-2.5 text-xs font-body font-bold uppercase tracking-wide text-n-500">Pax</th>
                      <th className="text-left px-3 py-2.5 text-xs font-body font-bold uppercase tracking-wide text-n-500">Estado</th>
                      <th className="text-right px-3 py-2.5 text-xs font-body font-bold uppercase tracking-wide text-n-500">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-n-100">
                    {participants.map((r, i) => {
                      let extra = {};
                      try { extra = JSON.parse(r.notes_guest || '{}'); } catch {}
                      return (
                        <tr key={r.id} className="hover:bg-n-50">
                          <td className="px-3 py-2.5 text-xs font-mono text-n-400">{i + 1}</td>
                          <td className="px-3 py-2.5">
                            <p className="font-body font-medium text-sm text-n-900">{r.customer_name || '—'}</p>
                            <p className="text-xs font-body text-n-400">{r.customer_country || ''}</p>
                          </td>
                          <td className="px-3 py-2.5 text-xs font-body text-n-600">{r.customer_phone || extra.phone || '—'}</td>
                          <td className="px-3 py-2.5 text-xs font-body text-n-600">{extra.emergency_contact || '—'}</td>
                          <td className="px-3 py-2.5 text-xs font-body text-n-600 max-w-[120px] truncate">{extra.special_requirements || r.notes_guest || '—'}</td>
                          <td className="px-3 py-2.5 text-center font-body font-semibold text-sm text-n-900">{r.guests}</td>
                          <td className="px-3 py-2.5">
                            <span className={`text-xs font-mono px-1.5 py-0.5 rounded-xs uppercase tracking-wide ${
                              ['confirmed','checked_in'].includes(r.status) ? 'bg-[#ECFDF5] text-[#1A7A4A]' : 'bg-n-100 text-n-500'
                            }`}>{r.status}</span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-display font-bold text-sm text-ocean-700">
                            €{Number(r.total_price || r.total_amount || 0).toFixed(0)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-n-50 border-t border-n-200">
                      <td colSpan={5} className="px-3 py-2.5 text-xs font-body font-bold text-n-700 uppercase tracking-wide">Total</td>
                      <td className="px-3 py-2.5 text-center font-display font-bold text-sm text-n-900">{totalPax}</td>
                      <td />
                      <td className="px-3 py-2.5 text-right font-display font-bold text-sm text-ocean-700">
                        €{participants.reduce((s, r) => s + Number(r.total_price || r.total_amount || 0), 0).toFixed(0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm font-body text-n-500 text-center py-6">Seleccione um tour e/ou uma data para ver o manifesto.</p>
        )}
      </div>
    </Modal>
  );
}

function RescheduleModal({ reservation, open, onClose, onDone }) {
  const [newDate,  setNewDate]  = useState(reservation?.check_in || '');
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');

  useEffect(() => { if (reservation) setNewDate(reservation.check_in || ''); }, [reservation]);

  async function handleSave() {
    if (!newDate || !reservation) return;
    setSaving(true); setError('');
    try {
      await updateReservation(reservation.id, { check_in: newDate });
      onDone(newDate);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao reagendar');
    } finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Reagendar reserva" size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button loading={saving} onClick={handleSave} icon={CalendarDays}>Reagendar</Button>
        </>
      }>
      <div className="space-y-3">
        <p className="text-sm font-body text-n-700">
          Reserva de <strong>{reservation?.customer_name}</strong>
        </p>
        <div>
          <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600 block mb-1">Nova data</label>
          <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="w-full h-9 px-3 rounded-sm border border-n-300 text-sm font-body bg-n-100 text-n-900 focus:outline-none focus:ring-2 focus:ring-ocean-300 focus:border-ocean-700 focus:bg-white"
          />
        </div>
        {error && <p className="text-xs font-body text-error">{error}</p>}
      </div>
    </Modal>
  );
}

function NoShowModal({ reservation, open, onClose, onDone }) {
  const [note,   setNote]   = useState('');
  const [saving, setSaving] = useState(false);

  async function handleConfirm() {
    setSaving(true);
    try {
      await changeStatus(reservation.id, 'no_show');
      if (note.trim()) {
        await updateReservation(reservation.id, { notes_internal: note });
      }
      onDone();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Registar No-Show" size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="danger" loading={saving} onClick={handleConfirm} icon={UserX}>Confirmar No-Show</Button>
        </>
      }>
      <div className="space-y-3">
        <p className="text-sm font-body text-n-700">
          Marcar <strong>{reservation?.customer_name}</strong> como no-show?
        </p>
        <div>
          <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600 block mb-1">Nota interna (opcional)</label>
          <textarea value={note} onChange={e => setNote(e.target.value)}
            rows={2} placeholder="Motivo ou observacao..."
            className="w-full px-3 py-2 rounded-sm border border-n-300 text-sm font-body bg-n-100 text-n-900 placeholder:text-n-400 focus:outline-none focus:ring-2 focus:ring-ocean-300 focus:border-ocean-700 focus:bg-white resize-none" />
        </div>
      </div>
    </Modal>
  );
}

export default function Reservations() {
  const t = useT();
  const { operator } = useAuthStore();
  const opType = operator?.operator_type || 'hotel';
  const isActivity = opType === 'activity';

  const [reservations,    setReservations]    = useState([]);
  const [units,           setUnits]           = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [modal,           setModal]           = useState(null);
  const [formLoading,     setFormLoading]     = useState(false);
  const [formError,       setFormError]       = useState('');
  const [manifesto,       setManifesto]       = useState(false);
  const [rescheduleRes,   setRescheduleRes]   = useState(null);
  const [noShowRes,       setNoShowRes]       = useState(null);
  const [voucherLoading,  setVoucherLoading]  = useState(null);

  const [statusFilter, setStatusFilter] = useState('');
  const [tourFilter,   setTourFilter]   = useState('');
  const [dateFilter,   setDateFilter]   = useState('');
  const [sourceFilter, setSourceFilter] = useState('');

  async function carregar() {
    setLoading(true);
    try {
      const [res, uns] = await Promise.all([listReservations({}), listUnits()]);
      setReservations(res);
      setUnits(uns.filter(u => u.status === 'active'));
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
      return true;
    });
  }, [reservations, statusFilter, tourFilter, dateFilter, sourceFilter]);

  const hasFilters = statusFilter || tourFilter || dateFilter || sourceFilter;

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
          <div className="flex gap-2">
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
          <div className="flex gap-1">
            {STATUS_FILTERS.map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
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

          {/* Tour */}
          <select
            value={tourFilter}
            onChange={e => setTourFilter(e.target.value)}
            className="h-8 px-3 rounded-sm border border-n-200 text-xs font-body bg-white text-n-700 focus:outline-none focus:ring-2 focus:ring-ocean-300 focus:border-ocean-700"
          >
            <option value="">Todos os tours</option>
            {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>

          {/* Data */}
          <input
            type="date"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="h-8 px-3 rounded-sm border border-n-200 text-xs font-body bg-white text-n-700 focus:outline-none focus:ring-2 focus:ring-ocean-300 focus:border-ocean-700"
          />

          {/* Origem */}
          <select
            value={sourceFilter}
            onChange={e => setSourceFilter(e.target.value)}
            className="h-8 px-3 rounded-sm border border-n-200 text-xs font-body bg-white text-n-700 focus:outline-none focus:ring-2 focus:ring-ocean-300 focus:border-ocean-700"
          >
            <option value="">Todas as origens</option>
            {Object.entries(SOURCE_LABEL).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>

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
        <div className="flex gap-2 flex-wrap mb-6">
          {STATUS_FILTERS.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
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
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <LoadingSpinner size={32} />
        </div>
      ) : isActivity ? (
        <ActivityTable
          reservations={filtered}
          units={units}
          onEdit={r => { setFormError(''); setModal(r); }}
          onUpdate={handleUpdate}
          onReschedule={setRescheduleRes}
          onNoShow={setNoShowRes}
          onVoucher={handleSendVoucher}
          voucherLoading={voucherLoading}
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
    </div>
  );
}
