import { useState } from 'react';
import { ClipboardList, Pencil, Trash2, ChevronRight, CalendarDays, Mail, UserX, Users, Eye } from 'lucide-react';
import { changeStatus } from '../../services/reservationsService';
import { useT } from '../../i18n';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Table from '../../components/ui/Table';
import AssignCompositeModal from '../../components/assignments/AssignCompositeModal';
import { STATUS_NEXT, STATUS_NEXT_LABEL, formatDate, SourceBadge } from './shared';

export default function ActivityTable({ reservations, units, guides, onEdit, onDelete, onUpdate, onReschedule, onNoShow, onVoucher, voucherLoading, onView }) {
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

  // Colunas da tabela do ecra largo; Data, Pax e Total sao ordenaveis
  const columns = [
    {
      key: 'ref',
      label: 'Ref',
      render: (r) => <span className="text-xs font-mono text-n-400">{r.id?.slice(0, 8)}</span>,
    },
    {
      key: 'tour',
      label: 'Tour',
      render: (r) => (
        <p className="font-display font-semibold text-sm text-n-900 truncate max-w-[140px]">
          {r.units?.name || units.find(u => u.id === r.unit_id)?.name || '—'}
        </p>
      ),
    },
    {
      key: 'data',
      label: 'Data',
      sortValue: (r) => r.check_in || '',
      render: (r) => <span className="text-sm font-body text-n-700 whitespace-nowrap">{formatDate(r.check_in)}</span>,
    },
    {
      key: 'cliente',
      label: 'Cliente',
      render: (r) => (
        <div className="min-w-0">
          <p className="text-sm font-body text-n-900 truncate max-w-[140px]">{r.customer_name || '—'}</p>
          {r.customer_country && (
            <p className="text-xs font-body text-n-400">{r.customer_country}</p>
          )}
        </div>
      ),
    },
    {
      key: 'pax',
      label: 'Pax',
      align: 'center',
      sortValue: (r) => Number(r.guests) || 0,
      render: (r) => <span className="text-sm font-body font-semibold text-n-900">{r.guests}</span>,
    },
    {
      key: 'origem',
      label: 'Origem',
      render: (r) => <SourceBadge source={r.source} />,
    },
    {
      key: 'estado',
      label: 'Estado',
      render: (r) => <Badge variant={r.status}>{t(`reservations.status.${r.status}`)}</Badge>,
    },
    {
      key: 'total',
      label: 'Total',
      align: 'right',
      sortValue: (r) => Number(r.total_price || r.total_amount || 0),
      render: (r) => (
        <span className="font-display font-bold text-sm text-ocean-700 whitespace-nowrap">
          €{Number(r.total_price || r.total_amount || 0).toFixed(0)}
        </span>
      ),
    },
    {
      key: 'acoes',
      label: '',
      render: (r) => {
        const canAdvance = !!STATUS_NEXT[r.status];
        const isLoading  = actionLoading === r.id;
        return (
          <div className="flex flex-wrap items-center gap-0.5 justify-end max-w-[170px] ml-auto">
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
              className="p-1 rounded text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors">
              <CalendarDays size={13} strokeWidth={1.75} />
            </button>
            <button onClick={() => onVoucher(r)} title="Enviar voucher"
              disabled={voucherLoading === r.id}
              className="p-1 rounded text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors disabled:opacity-40">
              <Mail size={13} strokeWidth={1.75} />
            </button>
            {!['cancelled','no_show','checked_out'].includes(r.status) && (
              <button onClick={() => onNoShow(r)} title="No-show"
                className="p-1 rounded text-n-400 hover:text-error hover:bg-red-50 transition-colors">
                <UserX size={13} strokeWidth={1.75} />
              </button>
            )}
            {!['cancelled','no_show'].includes(r.status) && (
              <button onClick={() => setAssignRes(r)} title="Atribuir equipa"
                className="p-1 rounded text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors">
                <Users size={13} strokeWidth={1.75} />
              </button>
            )}
            <Button variant="ghost" size="sm" icon={Eye} onClick={() => onView(r)} aria-label={t('reservations.view')} className="!px-1" />
            <Button variant="ghost" size="sm" icon={Pencil} onClick={() => onEdit(r)} aria-label="Editar" className="!px-1" />
            <Button variant="ghost" size="sm" icon={Trash2} onClick={() => onDelete(r)} aria-label="Eliminar" className="!px-1 hover:text-error" />
          </div>
        );
      },
    },
  ];

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
                <Button variant="ghost" size="sm" icon={Eye} onClick={() => onView(r)} aria-label={t('reservations.view')} />
                <Button variant="ghost" size="sm" icon={Pencil} onClick={() => onEdit(r)} aria-label="Editar" />
                <Button variant="ghost" size="sm" icon={Trash2} onClick={() => onDelete(r)} aria-label="Eliminar" className="hover:text-error" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop table view */}
      <div className="hidden md:block">
        <Table columns={columns} rows={reservations} />
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
