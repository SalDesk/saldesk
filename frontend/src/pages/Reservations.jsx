import { useState, useEffect, useMemo } from 'react';
import {
  Plus, ClipboardList, Pencil, Trash2, ChevronRight, Filter, X,
  CalendarDays, Mail, UserX, FileText, Car, MoveRight, MoveLeft,
  Fuel, AlertTriangle, Utensils, CheckCircle, Users,
} from 'lucide-react';
import { listReservations, createReservation, updateReservation, changeStatus, deleteReservation } from '../services/reservationsService';
import api from '../services/api';
import { listUnits } from '../services/unitsService';
import { listStaff } from '../services/staffService';
import useAuthStore from '../store/authStore';
import { useT } from '../i18n';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';
import ReservationCard from '../components/reservations/ReservationCard';
import ReservationForm from '../components/reservations/ReservationForm';
import AssignCompositeModal from '../components/assignments/AssignCompositeModal';
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

function ActivityTable({ reservations, units, guides, onEdit, onUpdate, onReschedule, onNoShow, onVoucher, voucherLoading }) {
  const t = useT();
  const [actionLoading, setActionLoading] = useState(null);
  const [assignRes, setAssignRes] = useState(null);

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
      {/* Mobile card view */}
      <div className="md:hidden divide-y divide-n-100">
        {reservations.map((r) => {
          const canAdvance = !!STATUS_NEXT[r.status];
          const isLoading  = actionLoading === r.id;
          return (
            <div key={r.id} className="p-4 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-display font-semibold text-sm text-n-900 truncate">
                    {r.units?.name || units.find(u => u.id === r.unit_id)?.name || '—'}
                  </p>
                  <p className="text-[11px] font-mono text-n-400 mt-0.5">{r.id?.slice(0, 8)}</p>
                </div>
                <Badge variant={r.status}>{t(`reservations.status.${r.status}`)}</Badge>
              </div>
              <div className="flex items-center gap-3 text-xs font-body text-n-600 flex-wrap">
                <span>{formatDate(r.check_in)}</span>
                {r.customer_name && <span className="truncate max-w-[140px]">{r.customer_name}</span>}
                {r.customer_country && <span className="text-n-400">{r.customer_country}</span>}
                {r.guests && <span>{r.guests} pax</span>}
              </div>
              <div className="flex items-center justify-between gap-2">
                <SourceBadge source={r.source} />
                <span className="font-display font-bold text-sm text-ocean-700">
                  €{Number(r.total_price || r.total_amount || 0).toFixed(0)}
                </span>
              </div>
              <div className="flex items-center gap-1 flex-wrap pt-0.5">
                {canAdvance && (
                  <button
                    onClick={() => handleNextStatus(r)}
                    disabled={isLoading}
                    className="flex items-center gap-1 px-2 py-1 rounded-xs bg-ocean-700 text-white text-xs font-body font-medium hover:bg-ocean-500 transition-colors disabled:opacity-50"
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
                {!['cancelled','no_show'].includes(r.status) && (
                  <button onClick={() => setAssignRes(r)} title="Atribuir equipa"
                    className="p-1.5 rounded text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors">
                    <Users size={13} strokeWidth={1.75} />
                  </button>
                )}
                <Button variant="ghost" size="sm" icon={Pencil} onClick={() => onEdit(r)} aria-label="Editar" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop table view */}
      <div className="overflow-x-auto hidden md:block">
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
                      {!['cancelled','no_show'].includes(r.status) && (
                        <button onClick={() => setAssignRes(r)} title="Atribuir equipa"
                          className="p-1.5 rounded text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors">
                          <Users size={13} strokeWidth={1.75} />
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

      {assignRes && (
        <AssignCompositeModal
          reservation={assignRes}
          guides={guides}
          onClose={() => setAssignRes(null)}
          onDone={() => setAssignRes(null)}
        />
      )}
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

function parseRentacarMeta(r) {
  try { return JSON.parse(r?.notes_internal || '{}')?.rentacar || {}; } catch { return {}; }
}

const FUEL_LEVELS = [
  { value: 0, label: 'Vazio' },
  { value: 1, label: '1/4'   },
  { value: 2, label: '1/2'   },
  { value: 3, label: '3/4'   },
  { value: 4, label: 'Cheio' },
];

function FuelSelector({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1">
      {FUEL_LEVELS.map(f => (
        <button
          key={f.value}
          type="button"
          onClick={() => onChange(f.value)}
          className={`px-2.5 py-1.5 rounded-sm border text-xs font-mono font-medium transition-colors ${
            value === f.value
              ? 'bg-ocean-700 border-ocean-700 text-white'
              : 'bg-n-50 border-n-200 text-n-600 hover:border-ocean-400'
          }`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

function LevantamentoModal({ reservation, units, open, onClose, onDone }) {
  const unit = units.find(u => u.id === reservation?.unit_id);
  const prevMeta = parseRentacarMeta(reservation);

  const [form, setForm] = useState({
    fuel_out:    prevMeta.fuel_out    ?? 4,
    km_out:      prevMeta.km_out      != null ? String(prevMeta.km_out) : '',
    damages_out: prevMeta.damages_out || '',
    caucao:      prevMeta.caucao      != null ? String(prevMeta.caucao) : '',
    caucao_paid: prevMeta.caucao_paid ?? false,
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (reservation) {
      const m = parseRentacarMeta(reservation);
      setForm({
        fuel_out:    m.fuel_out    ?? 4,
        km_out:      m.km_out      != null ? String(m.km_out) : '',
        damages_out: m.damages_out || '',
        caucao:      m.caucao      != null ? String(m.caucao) : '',
        caucao_paid: m.caucao_paid ?? false,
      });
    }
  }, [reservation]);

  async function handleSave() {
    if (!reservation) return;
    setSaving(true);
    try {
      let prevInternal = {};
      try { prevInternal = JSON.parse(reservation.notes_internal || '{}'); } catch {}
      const rentacarData = { ...parseRentacarMeta(reservation), ...form, km_out: form.km_out ? Number(form.km_out) : null };
      await updateReservation(reservation.id, {
        notes_internal: JSON.stringify({ ...prevInternal, rentacar: rentacarData }),
      });
      await changeStatus(reservation.id, 'checked_in');
      onDone();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  let unitMeta = {};
  try { unitMeta = JSON.parse(unit?.description || '{}'); } catch {}

  return (
    <Modal open={open} onClose={onClose} title="Levantamento de viatura" size="sm" footer={null}>
      <div className="space-y-5">
        <div className="flex items-center gap-3 p-3 bg-n-50 rounded-md border border-n-200">
          <Car size={16} strokeWidth={1.75} className="text-ocean-700 shrink-0" />
          <div>
            <p className="font-display font-semibold text-sm text-n-900">
              {unitMeta.brand ? `${unitMeta.brand} ${unitMeta.model || ''}`.trim() : unit?.name || '—'}
            </p>
            {unitMeta.plate && <p className="text-xs font-mono text-n-400">{unitMeta.plate}</p>}
          </div>
          <div className="ml-auto text-right">
            <p className="font-display font-semibold text-sm text-n-900">{reservation?.customer_name || '—'}</p>
            <p className="text-xs font-body text-n-400">{reservation?.check_in} → {reservation?.check_out}</p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-mono text-n-500 uppercase tracking-wide mb-2">Nivel combustivel (saida)</label>
          <FuelSelector value={form.fuel_out} onChange={v => set('fuel_out', v)} />
        </div>

        <div>
          <label className="block text-xs font-mono text-n-500 uppercase tracking-wide mb-1.5">Km na saida</label>
          <input type="number" value={form.km_out} onChange={e => set('km_out', e.target.value)} placeholder="0"
            className="w-full h-9 rounded-md border border-n-200 bg-n-50 px-3 text-sm font-body text-n-900 focus:outline-none focus:ring-2 focus:ring-ocean-700" />
        </div>

        <div>
          <label className="block text-xs font-mono text-n-500 uppercase tracking-wide mb-1.5">Danos existentes (registo)</label>
          <textarea value={form.damages_out} onChange={e => set('damages_out', e.target.value)} rows={2}
            placeholder="Descrever danos pre-existentes..."
            className="w-full rounded-md border border-n-200 bg-n-50 px-3 py-2 text-sm font-body text-n-900 focus:outline-none focus:ring-2 focus:ring-ocean-700 resize-none" />
        </div>

        <div>
          <label className="block text-xs font-mono text-n-500 uppercase tracking-wide mb-1.5">Caucao (€)</label>
          <div className="flex gap-3">
            <input type="number" value={form.caucao} onChange={e => set('caucao', e.target.value)} placeholder="0.00" step="0.01"
              className="flex-1 h-9 rounded-md border border-n-200 bg-n-50 px-3 text-sm font-body text-n-900 focus:outline-none focus:ring-2 focus:ring-ocean-700" />
            <label className="flex items-center gap-2 text-sm font-body text-n-700 cursor-pointer">
              <input type="checkbox" checked={form.caucao_paid} onChange={e => set('caucao_paid', e.target.checked)} className="w-4 h-4 accent-ocean-700" />
              Paga
            </label>
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="flex-1 h-9 rounded-md border border-n-200 text-sm font-body text-n-700 hover:bg-n-50 transition-colors">Cancelar</button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="flex-1 h-9 rounded-md bg-ocean-700 text-white text-sm font-body font-medium hover:bg-ocean-500 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60">
            <MoveRight size={13} strokeWidth={1.75} />
            {saving ? 'A processar...' : 'Confirmar levantamento'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function DevolucaoModal({ reservation, units, open, onClose, onDone }) {
  const unit = units.find(u => u.id === reservation?.unit_id);
  const prevMeta = parseRentacarMeta(reservation);

  const [form, setForm] = useState({
    fuel_in:        prevMeta.fuel_in        ?? 4,
    km_in:          prevMeta.km_in          != null ? String(prevMeta.km_in) : '',
    damages_in:     prevMeta.damages_in     || '',
    caucao_retained:prevMeta.caucao_retained!= null ? String(prevMeta.caucao_retained) : '0',
    caucao_status:  prevMeta.caucao_status  || 'returned',
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (reservation) {
      const m = parseRentacarMeta(reservation);
      setForm({
        fuel_in:         m.fuel_in        ?? 4,
        km_in:           m.km_in          != null ? String(m.km_in) : '',
        damages_in:      m.damages_in     || '',
        caucao_retained: m.caucao_retained!= null ? String(m.caucao_retained) : '0',
        caucao_status:   m.caucao_status  || 'returned',
      });
    }
  }, [reservation]);

  async function handleSave() {
    if (!reservation) return;
    setSaving(true);
    try {
      let prevInternal = {};
      try { prevInternal = JSON.parse(reservation.notes_internal || '{}'); } catch {}
      const rentacarData = { ...parseRentacarMeta(reservation), ...form, km_in: form.km_in ? Number(form.km_in) : null, caucao_retained: Number(form.caucao_retained) || 0 };
      await updateReservation(reservation.id, {
        notes_internal: JSON.stringify({ ...prevInternal, rentacar: rentacarData }),
      });
      await changeStatus(reservation.id, 'checked_out');
      onDone();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  let unitMeta = {};
  try { unitMeta = JSON.parse(unit?.description || '{}'); } catch {}
  const prevKmOut = prevMeta.km_out;
  const kmTotal   = form.km_in && prevKmOut ? Number(form.km_in) - Number(prevKmOut) : null;

  return (
    <Modal open={open} onClose={onClose} title="Devolucao de viatura" size="sm" footer={null}>
      <div className="space-y-5">
        <div className="flex items-center gap-3 p-3 bg-n-50 rounded-md border border-n-200">
          <Car size={16} strokeWidth={1.75} className="text-n-500 shrink-0" />
          <div>
            <p className="font-display font-semibold text-sm text-n-900">
              {unitMeta.brand ? `${unitMeta.brand} ${unitMeta.model || ''}`.trim() : unit?.name || '—'}
            </p>
            {unitMeta.plate && <p className="text-xs font-mono text-n-400">{unitMeta.plate}</p>}
          </div>
          <div className="ml-auto text-right">
            <p className="font-display font-semibold text-sm text-n-900">{reservation?.customer_name || '—'}</p>
            {prevKmOut && <p className="text-xs font-body text-n-400">Saida: {Number(prevKmOut).toLocaleString()} km</p>}
          </div>
        </div>

        <div>
          <label className="block text-xs font-mono text-n-500 uppercase tracking-wide mb-2">Nivel combustivel (chegada)</label>
          <FuelSelector value={form.fuel_in} onChange={v => set('fuel_in', v)} />
        </div>

        <div>
          <label className="block text-xs font-mono text-n-500 uppercase tracking-wide mb-1.5">Km na chegada</label>
          <div className="flex items-center gap-3">
            <input type="number" value={form.km_in} onChange={e => set('km_in', e.target.value)} placeholder="0"
              className="flex-1 h-9 rounded-md border border-n-200 bg-n-50 px-3 text-sm font-body text-n-900 focus:outline-none focus:ring-2 focus:ring-ocean-700" />
            {kmTotal !== null && (
              <span className="text-sm font-mono text-n-600 whitespace-nowrap">{kmTotal.toLocaleString()} km percorridos</span>
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs font-mono text-n-500 uppercase tracking-wide mb-1.5">Danos na devolucao</label>
          <textarea value={form.damages_in} onChange={e => set('damages_in', e.target.value)} rows={2}
            placeholder="Descrever danos verificados na chegada..."
            className="w-full rounded-md border border-n-200 bg-n-50 px-3 py-2 text-sm font-body text-n-900 focus:outline-none focus:ring-2 focus:ring-ocean-700 resize-none" />
        </div>

        <div>
          <label className="block text-xs font-mono text-n-500 uppercase tracking-wide mb-2">Caucao</label>
          <div className="flex gap-2 mb-3">
            {[
              { value: 'returned', label: 'Devolvida' },
              { value: 'retained', label: 'Retida (parcial)' },
              { value: 'full',     label: 'Retida (total)' },
            ].map(o => (
              <button key={o.value} type="button" onClick={() => set('caucao_status', o.value)}
                className={`flex-1 px-2 py-1.5 rounded-sm border text-xs font-mono font-medium transition-colors ${
                  form.caucao_status === o.value ? 'bg-ocean-700 border-ocean-700 text-white' : 'bg-n-50 border-n-200 text-n-600 hover:border-ocean-400'
                }`}>
                {o.label}
              </button>
            ))}
          </div>
          {form.caucao_status !== 'returned' && (
            <div>
              <label className="block text-xs font-mono text-n-500 uppercase tracking-wide mb-1.5">Valor retido (€)</label>
              <input type="number" value={form.caucao_retained} onChange={e => set('caucao_retained', e.target.value)} placeholder="0.00" step="0.01"
                className="w-full h-9 rounded-md border border-n-200 bg-n-50 px-3 text-sm font-body text-n-900 focus:outline-none focus:ring-2 focus:ring-ocean-700" />
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="flex-1 h-9 rounded-md border border-n-200 text-sm font-body text-n-700 hover:bg-n-50 transition-colors">Cancelar</button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="flex-1 h-9 rounded-md bg-ocean-700 text-white text-sm font-body font-medium hover:bg-ocean-500 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60">
            <MoveLeft size={13} strokeWidth={1.75} />
            {saving ? 'A processar...' : 'Confirmar devolucao'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function RentacarTable({ reservations, units, onEdit, onLevantamento, onDevolucao, onUpdate }) {
  const t = useT();
  const [actionLoading, setActionLoading] = useState(null);

  async function handleCancel(r) {
    setActionLoading(r.id);
    try {
      const updated = await changeStatus(r.id, 'cancelled');
      onUpdate(updated);
    } catch (err) { console.error(err); }
    finally { setActionLoading(null); }
  }

  if (reservations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-n-400">
        <Car size={40} strokeWidth={1.25} className="mb-3" />
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
              <th className="text-left px-4 py-3 text-xs font-body font-bold uppercase tracking-wide text-n-500 whitespace-nowrap">Viatura</th>
              <th className="text-left px-4 py-3 text-xs font-body font-bold uppercase tracking-wide text-n-500 whitespace-nowrap">Levantamento</th>
              <th className="text-left px-4 py-3 text-xs font-body font-bold uppercase tracking-wide text-n-500 whitespace-nowrap">Devolucao</th>
              <th className="text-left px-4 py-3 text-xs font-body font-bold uppercase tracking-wide text-n-500 whitespace-nowrap">Cliente</th>
              <th className="text-left px-4 py-3 text-xs font-body font-bold uppercase tracking-wide text-n-500 whitespace-nowrap">Estado</th>
              <th className="text-right px-4 py-3 text-xs font-body font-bold uppercase tracking-wide text-n-500 whitespace-nowrap">Total</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-n-100">
            {reservations.map(r => {
              const unit = units.find(u => u.id === r.unit_id);
              let unitMeta = {};
              try { unitMeta = JSON.parse(unit?.description || '{}'); } catch {}
              const rcMeta = parseRentacarMeta(r);
              const isLoading = actionLoading === r.id;

              return (
                <tr key={r.id} className="hover:bg-n-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono text-n-400">{r.id?.slice(0, 8)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-display font-semibold text-sm text-n-900 truncate max-w-[120px]">
                      {unitMeta.brand ? `${unitMeta.brand} ${unitMeta.model || ''}`.trim() : unit?.name || '—'}
                    </p>
                    {unitMeta.plate && <p className="text-xs font-mono text-n-400">{unitMeta.plate}</p>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-sm font-body text-n-700">{formatDate(r.check_in)}</span>
                    {rcMeta.km_out && <p className="text-xs font-mono text-n-400">{Number(rcMeta.km_out).toLocaleString()} km</p>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-sm font-body text-n-700">{formatDate(r.check_out)}</span>
                    {rcMeta.km_in && <p className="text-xs font-mono text-n-400">{Number(rcMeta.km_in).toLocaleString()} km</p>}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-body text-n-900 truncate max-w-[120px]">{r.customer_name || '—'}</p>
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
                      {['pending', 'confirmed'].includes(r.status) && (
                        <button
                          onClick={() => onLevantamento(r)}
                          className="flex items-center gap-1 px-2 py-1 rounded-xs bg-[#1A7A4A] text-white text-xs font-body font-medium hover:bg-[#15623C] transition-colors whitespace-nowrap"
                        >
                          <MoveRight size={11} strokeWidth={2} />
                          Levantamento
                        </button>
                      )}
                      {r.status === 'checked_in' && (
                        <button
                          onClick={() => onDevolucao(r)}
                          className="flex items-center gap-1 px-2 py-1 rounded-xs bg-ocean-700 text-white text-xs font-body font-medium hover:bg-ocean-500 transition-colors whitespace-nowrap"
                        >
                          <MoveLeft size={11} strokeWidth={2} />
                          Devolucao
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

const TURNO_LABELS = { almoco: 'Almoco', jantar: 'Jantar' };
const OCASIAO_LABELS = {
  aniversario: 'Aniversario', lua_de_mel: 'Lua-de-mel', negocios: 'Negocios', outro: 'Outro',
};

function parseRestaurantMeta(r) {
  try { return JSON.parse(r?.notes_guest || '{}'); } catch { return {}; }
}

function RestaurantCreateModal({ reservation, units, open, onClose, onDone }) {
  const prevMeta = parseRestaurantMeta(reservation);
  const [form, setForm] = useState({
    turno:            prevMeta.turno             || 'jantar',
    ocasiao:          prevMeta.ocasiao            || '',
    pedidos_especiais:prevMeta.pedidos_especiais  || '',
    lista_espera:     prevMeta.lista_espera        ?? false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (reservation) {
      const m = parseRestaurantMeta(reservation);
      setForm({ turno: m.turno || 'jantar', ocasiao: m.ocasiao || '', pedidos_especiais: m.pedidos_especiais || '', lista_espera: m.lista_espera ?? false });
    }
  }, [reservation]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleSave() {
    if (!reservation) return;
    setSaving(true);
    try {
      let prev = {};
      try { prev = JSON.parse(reservation.notes_guest || '{}'); } catch {}
      await updateReservation(reservation.id, { notes_guest: JSON.stringify({ ...prev, ...form }) });
      onDone();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  const unit = units.find(u => u.id === reservation?.unit_id);

  return (
    <Modal open={open} onClose={onClose} title="Detalhes da reserva" size="sm" footer={null}>
      <div className="space-y-4">
        {reservation && (
          <div className="flex items-center gap-3 p-3 bg-n-50 rounded-md border border-n-200">
            <Utensils size={14} strokeWidth={1.75} className="text-ocean-700 shrink-0" />
            <div>
              <p className="font-display font-semibold text-sm text-n-900">{reservation.customer_name || '—'}</p>
              <p className="text-xs font-body text-n-400">{reservation.guests} pessoas · {unit?.name || 'Sem mesa'}</p>
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-mono text-n-500 uppercase tracking-wide mb-2">Turno</label>
          <div className="flex flex-wrap gap-2">
            {[{ v: 'almoco', l: 'Almoco · 12h-15h' }, { v: 'jantar', l: 'Jantar · 19h-23h' }].map(o => (
              <button key={o.v} type="button" onClick={() => set('turno', o.v)}
                className={`flex-1 py-2 rounded-md border text-sm font-body font-medium transition-colors ${
                  form.turno === o.v ? 'bg-ocean-700 border-ocean-700 text-white' : 'bg-n-50 border-n-200 text-n-700 hover:border-ocean-400'
                }`}>
                {o.l}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-mono text-n-500 uppercase tracking-wide mb-1.5">Ocasiao especial</label>
          <select value={form.ocasiao} onChange={e => set('ocasiao', e.target.value)}
            className="w-full h-9 rounded-md border border-n-200 bg-n-50 px-3 text-sm font-body text-n-900 focus:outline-none focus:ring-2 focus:ring-ocean-700">
            <option value="">Nenhuma</option>
            <option value="aniversario">Aniversario</option>
            <option value="lua_de_mel">Lua-de-mel</option>
            <option value="negocios">Negocios</option>
            <option value="outro">Outro</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-mono text-n-500 uppercase tracking-wide mb-1.5">Pedidos especiais</label>
          <textarea value={form.pedidos_especiais} onChange={e => set('pedidos_especiais', e.target.value)} rows={2}
            placeholder="Alergias, decoracao, menu vegetariano..."
            className="w-full rounded-md border border-n-200 bg-n-50 px-3 py-2 text-sm font-body text-n-900 focus:outline-none focus:ring-2 focus:ring-ocean-700 resize-none" />
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.lista_espera} onChange={e => set('lista_espera', e.target.checked)} className="w-4 h-4 accent-ocean-700" />
          <span className="text-sm font-body text-n-700">Lista de espera (sem mesa disponivel)</span>
        </label>

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="flex-1 h-9 rounded-md border border-n-200 text-sm font-body text-n-700 hover:bg-n-50 transition-colors">Cancelar</button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="flex-1 h-9 rounded-md bg-ocean-700 text-white text-sm font-body font-medium hover:bg-ocean-500 transition-colors disabled:opacity-60">
            {saving ? 'A guardar...' : 'Guardar detalhes'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function RestaurantTable({ reservations, units, onEdit, onDetails, onUpdate }) {
  const t = useT();
  const [actionLoading, setActionLoading] = useState(null);

  const STATUS_NEXT_R = { pending: 'confirmed', confirmed: 'checked_in', checked_in: 'checked_out' };
  const STATUS_BTN_R  = { pending: 'Confirmar', confirmed: 'Sentar', checked_in: 'Liberar mesa' };

  async function handleNext(r) {
    const next = STATUS_NEXT_R[r.status];
    if (!next) return;
    setActionLoading(r.id);
    try {
      const updated = await changeStatus(r.id, next);
      onUpdate(updated);
    } catch (err) { console.error(err); }
    finally { setActionLoading(null); }
  }

  if (reservations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-n-400">
        <Utensils size={40} strokeWidth={1.25} className="mb-3" />
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
              <th className="text-left px-4 py-3 text-xs font-body font-bold uppercase tracking-wide text-n-500 whitespace-nowrap">Mesa</th>
              <th className="text-left px-4 py-3 text-xs font-body font-bold uppercase tracking-wide text-n-500 whitespace-nowrap">Turno</th>
              <th className="text-center px-4 py-3 text-xs font-body font-bold uppercase tracking-wide text-n-500">Pax</th>
              <th className="text-left px-4 py-3 text-xs font-body font-bold uppercase tracking-wide text-n-500 whitespace-nowrap">Cliente</th>
              <th className="text-left px-4 py-3 text-xs font-body font-bold uppercase tracking-wide text-n-500 whitespace-nowrap">Ocasiao</th>
              <th className="text-left px-4 py-3 text-xs font-body font-bold uppercase tracking-wide text-n-500 whitespace-nowrap">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-n-100">
            {reservations.map(r => {
              const unit    = units.find(u => u.id === r.unit_id);
              let umeta = {};
              try { umeta = JSON.parse(unit?.description || '{}'); } catch {}
              const tbl    = unit ? (umeta.number ? `Mesa ${umeta.number}` : unit.name) : '—';
              const rcMeta = parseRestaurantMeta(r);
              const isLoading = actionLoading === r.id;
              const canNext   = !!STATUS_NEXT_R[r.status];

              return (
                <tr key={r.id} className="hover:bg-n-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono text-n-400">{r.id?.slice(0, 8)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-display font-semibold text-sm text-n-900">{tbl}</p>
                    {rcMeta.lista_espera && (
                      <span className="text-[9px] font-mono uppercase tracking-wide text-[#B45309] bg-[#FFF7ED] px-1.5 py-0.5 rounded">Lista espera</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono text-n-700">
                      {rcMeta.turno ? TURNO_LABELS[rcMeta.turno] || rcMeta.turno : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm font-body font-semibold text-n-900">{r.guests}</span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-body text-n-900 truncate max-w-[120px]">{r.customer_name || '—'}</p>
                    <p className="text-xs font-body text-n-400">{formatDate(r.check_in)}</p>
                  </td>
                  <td className="px-4 py-3">
                    {rcMeta.ocasiao ? (
                      <span className="text-xs font-body text-n-600">{OCASIAO_LABELS[rcMeta.ocasiao] || rcMeta.ocasiao}</span>
                    ) : <span className="text-n-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={r.status}>{t(`reservations.status.${r.status}`)}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end flex-wrap">
                      {canNext && (
                        <button onClick={() => handleNext(r)} disabled={isLoading}
                          className="flex items-center gap-1 px-2 py-1 rounded-xs bg-ocean-700 text-white text-xs font-body font-medium hover:bg-ocean-500 transition-colors disabled:opacity-50 whitespace-nowrap">
                          {STATUS_BTN_R[r.status]}
                          <ChevronRight size={11} strokeWidth={2} />
                        </button>
                      )}
                      <button onClick={() => onDetails(r)} title="Turno / pedidos especiais"
                        className="p-1.5 rounded text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors">
                        <Utensils size={13} strokeWidth={1.75} />
                      </button>
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
        if ((meta.turno || '') !== turnoFilter) return false;
      }
      return true;
    });
  }, [reservations, statusFilter, tourFilter, dateFilter, sourceFilter, isRestaurant, turnoFilter]);

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
          <div className="flex flex-wrap gap-1">
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
          {isRestaurant && (
            <>
              <div className="w-px bg-n-200 self-stretch mx-1" />
              {[{ v: '', l: 'Todos turnos' }, { v: 'almoco', l: 'Almoco' }, { v: 'jantar', l: 'Jantar' }].map(o => (
                <button key={o.v} onClick={() => setTurnoFilter(o.v)}
                  className={[
                    'px-3 py-1.5 rounded-sm text-xs font-body font-semibold transition-colors',
                    turnoFilter === o.v
                      ? 'bg-ocean-700 text-white'
                      : 'bg-white border border-n-200 text-n-600 hover:border-ocean-300',
                  ].join(' ')}>
                  {o.l}
                </button>
              ))}
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
          onUpdate={handleUpdate}
          onReschedule={setRescheduleRes}
          onNoShow={setNoShowRes}
          onVoucher={handleSendVoucher}
          voucherLoading={voucherLoading}
        />
      ) : isRentacar ? (
        <RentacarTable
          reservations={filtered}
          units={units}
          onEdit={r => { setFormError(''); setModal(r); }}
          onLevantamento={setLevantamentoRes}
          onDevolucao={setDevolucaoRes}
          onUpdate={u => handleUpdate(u)}
        />
      ) : isRestaurant ? (
        <RestaurantTable
          reservations={filtered}
          units={units}
          onEdit={r => { setFormError(''); setModal(r); }}
          onDetails={setDetailsRes}
          onUpdate={u => handleUpdate(u)}
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
    </div>
  );
}
