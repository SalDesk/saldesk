import { useState } from 'react';
import { Pencil, Trash2, ChevronRight, Utensils, Eye } from 'lucide-react';
import { changeStatus } from '../../services/reservationsService';
import { useT } from '../../i18n';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Table from '../../components/ui/Table';
import useMediaQuery from '../../hooks/useMediaQuery';
import ColumnCards from './ColumnCards';
import { rotuloEstadoReserva } from '../../utils/estadoReserva';
import { formatDate, parseRestaurantMeta, rotuloTurno, rotuloOcasiao } from './shared';

export default function RestaurantTable({ reservations, units, onEdit, onDelete, onDetails, onUpdate, onView }) {
  const t = useT();
  const [actionLoading, setActionLoading] = useState(null);
  const movel = useMediaQuery('(max-width: 767px)');

  const STATUS_NEXT_R = { pending: 'confirmed', confirmed: 'checked_in', checked_in: 'checked_out' };
  const STATUS_BTN_R  = { pending: t('common.confirm'), confirmed: t('reservations.actions.seat'), checked_in: t('reservations.actions.freeTable') };

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

  // Colunas da tabela; so o numero de pessoas e ordenavel
  const columns = [
    {
      key: 'ref',
      label: t('reservations.columns.ref'),
      render: (r) => <span className="text-xs font-mono tabular-nums text-n-500">{r.id?.slice(0, 8)}</span>,
    },
    {
      key: 'mesa',
      label: t('reservations.columns.table'),
      render: (r) => {
        const unit    = units.find(u => u.id === r.unit_id);
        let umeta = {};
        try { umeta = JSON.parse(unit?.description || '{}'); } catch {}
        const tbl    = unit ? (umeta.number ? t('reservations.tableNumber', { n: umeta.number }) : unit.name) : '—';
        const rcMeta = parseRestaurantMeta(r);
        return (
          <>
            <p className="font-display font-semibold text-sm text-n-900">{tbl}</p>
            {rcMeta.lista_espera && (
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-body font-semibold text-n-800 bg-sand-100">{t('reservations.waitlist')}</span>
            )}
          </>
        );
      },
    },
    {
      key: 'turno',
      label: t('reservations.columns.shift'),
      render: (r) => {
        const rcMeta = parseRestaurantMeta(r);
        return (
          <span className="text-sm font-mono tabular-nums text-ocean-900">
            {r.start_time
              ? r.start_time.slice(0, 5)
              : (rcMeta.turno ? rotuloTurno(rcMeta.turno, t) : '—')}
          </span>
        );
      },
    },
    {
      key: 'pax',
      label: t('reservations.pax'),
      align: 'center',
      sortValue: (r) => Number(r.guests) || 0,
      render: (r) => <span className="text-sm font-mono tabular-nums font-medium text-n-900">{r.guests}</span>,
    },
    {
      key: 'cliente',
      label: t('reservations.customer'),
      render: (r) => (
        <>
          <p className="text-sm font-body text-n-900 truncate max-w-[120px]">{r.customer_name || '—'}</p>
          <p className="text-xs font-mono tabular-nums text-n-500">{formatDate(r.check_in)}</p>
        </>
      ),
    },
    {
      key: 'ocasiao',
      label: t('reservations.columns.occasion'),
      render: (r) => {
        const rcMeta = parseRestaurantMeta(r);
        return rcMeta.ocasiao ? (
          <span className="text-xs font-body text-n-600">{rotuloOcasiao(rcMeta.ocasiao, t)}</span>
        ) : <span className="text-n-300">—</span>;
      },
    },
    {
      key: 'estado',
      label: t('common.status'),
      render: (r) => <Badge variant={r.status}>{rotuloEstadoReserva(r, t)}</Badge>,
    },
    {
      key: 'acoes',
      label: '',
      render: (r) => {
        const isLoading = actionLoading === r.id;
        const canNext   = !!STATUS_NEXT_R[r.status];
        return (
          <div className="flex items-center gap-1 justify-end flex-wrap">
            {canNext && (
              <button onClick={() => handleNext(r)} disabled={isLoading}
                className="flex items-center gap-1 min-h-11 md:min-h-9 px-3 rounded-full bg-ocean-700 text-white text-xs font-body font-semibold hover:bg-ocean-500 transition-colors disabled:opacity-50 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-300 focus-visible:ring-offset-1">
                {STATUS_BTN_R[r.status]}
                <ChevronRight size={11} strokeWidth={2} />
              </button>
            )}
            <button onClick={() => onDetails(r)} title={t('reservations.actions.shiftRequests')}
              className="p-1.5 rounded text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors">
              <Utensils size={13} strokeWidth={1.75} />
            </button>
            <Button variant="ghost" size="sm" icon={Eye} onClick={() => onView(r)} aria-label={t('reservations.view')} />
            <Button variant="ghost" size="sm" icon={Pencil} onClick={() => onEdit(r)} aria-label={t('common.edit')} />
            <Button variant="ghost" size="sm" icon={Trash2} onClick={() => onDelete(r)} aria-label={t('common.delete')} className="hover:text-error" />
          </div>
        );
      },
    },
  ];

  /* Telemovel: cartoes (as mesmas colunas e accoes) em vez de uma tabela que nao cabe no ecra */
  if (movel) return <ColumnCards columns={columns} rows={reservations} />;

  return (
    <div className="bg-white rounded-[18px] border border-mare-card overflow-hidden">
      <Table columns={columns} rows={reservations} />
    </div>
  );
}
