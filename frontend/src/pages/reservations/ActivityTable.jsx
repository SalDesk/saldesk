import { useState } from 'react';
import { ClipboardList, Pencil, Trash2, ChevronRight, CalendarDays, Mail, UserX, Users, Eye } from 'lucide-react';
import { changeStatus } from '../../services/reservationsService';
import { useT } from '../../i18n';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Table from '../../components/ui/Table';
import RowMenu from '../../components/ui/RowMenu';
import AssignCompositeModal from '../../components/assignments/AssignCompositeModal';
import { rotuloEstadoReserva } from '../../utils/estadoReserva';
import { STATUS_NEXT, rotuloProximoEstado, formatDate, eurosInteiros, SourceBadge } from './shared';

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
      label: t('reservations.columns.ref'),
      render: (r) => <span className="text-xs font-mono tabular-nums text-n-500">{r.id?.slice(0, 8)}</span>,
    },
    {
      key: 'tour',
      label: t('reservations.columns.tour'),
      render: (r) => (
        <p className="font-display font-semibold text-sm text-n-900 truncate max-w-[104px]"
          title={r.units?.name || units.find(u => u.id === r.unit_id)?.name || undefined}>
          {r.units?.name || units.find(u => u.id === r.unit_id)?.name || '—'}
        </p>
      ),
    },
    {
      key: 'data',
      label: t('common.date'),
      sortValue: (r) => r.check_in || '',
      render: (r) => <span className="text-sm font-mono tabular-nums text-ocean-900 whitespace-nowrap">{formatDate(r.check_in)}</span>,
    },
    {
      key: 'cliente',
      label: t('reservations.customer'),
      render: (r) => (
        <div className="min-w-0">
          <p className="text-sm font-body text-n-900 truncate max-w-[104px]" title={r.customer_name || undefined}>{r.customer_name || '—'}</p>
          {r.customer_country && (
            <p className="text-xs font-body text-n-400">{r.customer_country}</p>
          )}
        </div>
      ),
    },
    {
      key: 'pax',
      label: t('reservations.pax'),
      align: 'center',
      sortValue: (r) => Number(r.guests) || 0,
      render: (r) => <span className="text-sm font-mono tabular-nums font-medium text-n-900">{r.guests}</span>,
    },
    {
      key: 'origem',
      label: t('reservations.columns.source'),
      render: (r) => <SourceBadge source={r.source} />,
    },
    {
      key: 'estado',
      label: t('common.status'),
      render: (r) => <Badge variant={r.status}>{rotuloEstadoReserva(r, t)}</Badge>,
    },
    {
      key: 'total',
      label: t('reservations.total'),
      align: 'right',
      sortValue: (r) => Number(r.total_price || r.total_amount || 0),
      render: (r) => (
        <span className="font-mono tabular-nums font-medium text-sm text-ocean-900 whitespace-nowrap">
          {eurosInteiros(r.total_price || r.total_amount)}
        </span>
      ),
    },
    {
      key: 'acoes',
      label: '',
      render: (r) => {
        const canAdvance = !!STATUS_NEXT[r.status];
        const isLoading  = actionLoading === r.id;
        // Acoes frequentes a vista; as secundarias ficam no menu "..." para a linha caber no ecra
        const menuItems = [
          { key: 'reagendar', label: t('reservations.actions.reschedule'), icon: CalendarDays, onClick: () => onReschedule(r) },
          { key: 'voucher', label: t('reservations.actions.sendVoucher'), icon: Mail, onClick: () => onVoucher(r), disabled: voucherLoading === r.id },
          ...(!['cancelled', 'no_show', 'checked_out'].includes(r.status)
            ? [{ key: 'no-show', label: t('reservations.actions.noShow'), icon: UserX, onClick: () => onNoShow(r) }]
            : []),
          ...(!['cancelled', 'no_show'].includes(r.status)
            ? [{ key: 'equipa', label: t('reservations.actions.assignTeam'), icon: Users, onClick: () => setAssignRes(r) }]
            : []),
          { key: 'eliminar', label: t('common.delete'), icon: Trash2, onClick: () => onDelete(r), danger: true },
        ];
        return (
          <div className="flex items-center gap-0.5 justify-end">
            {canAdvance && (
              <button
                onClick={() => handleNextStatus(r)}
                disabled={isLoading}
                className="flex items-center gap-1 min-h-9 px-3 rounded-full bg-ocean-700 text-white text-xs font-body font-semibold hover:bg-ocean-500 transition-colors disabled:opacity-50 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-300 focus-visible:ring-offset-1"
              >
                {rotuloProximoEstado(r.status, t)}
                <ChevronRight size={11} strokeWidth={2} />
              </button>
            )}
            <Button variant="ghost" size="sm" icon={Eye} onClick={() => onView(r)} aria-label={t('reservations.view')} className="!px-1" />
            <Button variant="ghost" size="sm" icon={Pencil} onClick={() => onEdit(r)} aria-label={t('common.edit')} className="!px-1" />
            <RowMenu label={t('reservations.moreActions')} items={menuItems} />
          </div>
        );
      },
    },
  ];

  return (
    <div className="bg-white rounded-[18px] border border-mare-card overflow-hidden">
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
                  <p className="text-[11px] font-mono tabular-nums text-n-500 mt-0.5">{r.id?.slice(0, 8)}</p>
                </div>
                <Badge variant={r.status}>{rotuloEstadoReserva(r, t)}</Badge>
              </div>
              <div className="flex items-center gap-3 text-xs font-body text-n-600 flex-wrap">
                <span className="font-mono tabular-nums">{formatDate(r.check_in)}</span>
                {r.customer_name && <span className="truncate max-w-[104px]">{r.customer_name}</span>}
                {r.customer_country && <span className="text-n-400">{r.customer_country}</span>}
                {r.guests && <span>{t('reservations.paxCount', { n: r.guests })}</span>}
              </div>
              <div className="flex items-center justify-between gap-2">
                <SourceBadge source={r.source} />
                <span className="font-mono tabular-nums font-medium text-sm text-ocean-900">
                  {eurosInteiros(r.total_price || r.total_amount)}
                </span>
              </div>
              <div className="flex items-center gap-1 flex-wrap pt-0.5">
                {canAdvance && (
                  <button
                    onClick={() => handleNextStatus(r)}
                    disabled={isLoading}
                    className="flex items-center gap-1 min-h-9 px-3 rounded-full bg-ocean-700 text-white text-xs font-body font-semibold hover:bg-ocean-500 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-300 focus-visible:ring-offset-1"
                  >
                    {rotuloProximoEstado(r.status, t)}
                    <ChevronRight size={11} strokeWidth={2} />
                  </button>
                )}
                <button onClick={() => onReschedule(r)} title={t('reservations.actions.reschedule')}
                  className="p-1.5 rounded text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors">
                  <CalendarDays size={13} strokeWidth={1.75} />
                </button>
                <button onClick={() => onVoucher(r)} title={t('reservations.actions.sendVoucher')}
                  disabled={voucherLoading === r.id}
                  className="p-1.5 rounded text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors disabled:opacity-40">
                  <Mail size={13} strokeWidth={1.75} />
                </button>
                {!['cancelled','no_show','checked_out'].includes(r.status) && (
                  <button onClick={() => onNoShow(r)} title={t('reservations.actions.noShow')}
                    className="p-1.5 rounded text-n-400 hover:text-error hover:bg-red-50 transition-colors">
                    <UserX size={13} strokeWidth={1.75} />
                  </button>
                )}
                {!['cancelled','no_show'].includes(r.status) && (
                  <button onClick={() => setAssignRes(r)} title={t('reservations.actions.assignTeam')}
                    className="p-1.5 rounded text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors">
                    <Users size={13} strokeWidth={1.75} />
                  </button>
                )}
                <Button variant="ghost" size="sm" icon={Eye} onClick={() => onView(r)} aria-label={t('reservations.view')} />
                <Button variant="ghost" size="sm" icon={Pencil} onClick={() => onEdit(r)} aria-label={t('common.edit')} />
                <Button variant="ghost" size="sm" icon={Trash2} onClick={() => onDelete(r)} aria-label={t('common.delete')} className="hover:text-error" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop table view */}
      <div className="hidden md:block">
        <Table columns={columns} rows={reservations} compact />
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
