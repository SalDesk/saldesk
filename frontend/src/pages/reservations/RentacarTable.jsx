import { useState } from 'react';
import { Pencil, Trash2, Car, MoveRight, MoveLeft, Eye } from 'lucide-react';
import { changeStatus } from '../../services/reservationsService';
import { useT } from '../../i18n';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Table from '../../components/ui/Table';
import useMediaQuery from '../../hooks/useMediaQuery';
import ColumnCards from './ColumnCards';
import { rotuloEstadoReserva } from '../../utils/estadoReserva';
import { formatarNumero } from '../../utils/formatoLingua';
import { formatDate, eurosInteiros, parseRentacarMeta } from './shared';

export default function RentacarTable({ reservations, units, onEdit, onDelete, onLevantamento, onDevolucao, onUpdate, onView }) {
  const t = useT();
  const [actionLoading, setActionLoading] = useState(null);
  const movel = useMediaQuery('(max-width: 767px)');

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

  // Colunas da tabela; as datas de levantamento e devolucao e o total sao ordenaveis
  const columns = [
    {
      key: 'ref',
      label: t('reservations.columns.ref'),
      render: (r) => <span className="text-xs font-mono tabular-nums text-n-500">{r.id?.slice(0, 8)}</span>,
    },
    {
      key: 'viatura',
      label: t('reservations.vehicle'),
      render: (r) => {
        const unit = units.find(u => u.id === r.unit_id);
        let unitMeta = {};
        try { unitMeta = JSON.parse(unit?.description || '{}'); } catch {}
        return (
          <>
            <p className="font-display font-semibold text-sm text-n-900 truncate max-w-[120px]">
              {unitMeta.brand ? `${unitMeta.brand} ${unitMeta.model || ''}`.trim() : unit?.name || '—'}
            </p>
            {unitMeta.plate && <p className="text-xs font-mono tabular-nums text-n-500">{unitMeta.plate}</p>}
          </>
        );
      },
    },
    {
      key: 'levantamento',
      label: t('reservations.columns.pickup'),
      sortValue: (r) => r.check_in || '',
      render: (r) => {
        const rcMeta = parseRentacarMeta(r);
        return (
          <div className="whitespace-nowrap">
            <span className="text-sm font-mono tabular-nums text-ocean-900">{formatDate(r.check_in)}</span>
            {rcMeta.km_out && <p className="text-xs font-mono tabular-nums text-n-500">{formatarNumero(rcMeta.km_out)} km</p>}
          </div>
        );
      },
    },
    {
      key: 'devolucao',
      label: t('reservations.columns.dropoff'),
      sortValue: (r) => r.check_out || '',
      render: (r) => {
        const rcMeta = parseRentacarMeta(r);
        return (
          <div className="whitespace-nowrap">
            <span className="text-sm font-mono tabular-nums text-ocean-900">{formatDate(r.check_out)}</span>
            {rcMeta.km_in && <p className="text-xs font-mono tabular-nums text-n-500">{formatarNumero(rcMeta.km_in)} km</p>}
          </div>
        );
      },
    },
    {
      key: 'cliente',
      label: t('reservations.customer'),
      render: (r) => <p className="text-sm font-body text-n-900 truncate max-w-[120px]">{r.customer_name || '—'}</p>,
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
      render: (r) => (
        <div className="flex items-center gap-1 justify-end flex-wrap">
          {['pending', 'confirmed'].includes(r.status) && (
            <button
              onClick={() => onLevantamento(r)}
              className="flex items-center gap-1 min-h-11 md:min-h-9 px-3 rounded-full bg-[var(--success)] text-white text-xs font-body font-semibold hover:brightness-90 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-300 focus-visible:ring-offset-1"
            >
              <MoveRight size={11} strokeWidth={2} />
              {t('reservations.actions.pickup')}
            </button>
          )}
          {r.status === 'checked_in' && (
            <button
              onClick={() => onDevolucao(r)}
              className="flex items-center gap-1 min-h-11 md:min-h-9 px-3 rounded-full bg-ocean-700 text-white text-xs font-body font-semibold hover:bg-ocean-500 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-300 focus-visible:ring-offset-1"
            >
              <MoveLeft size={11} strokeWidth={2} />
              {t('reservations.actions.dropoff')}
            </button>
          )}
          <Button variant="ghost" size="sm" icon={Eye} onClick={() => onView(r)} aria-label={t('reservations.view')} />
          <Button variant="ghost" size="sm" icon={Pencil} onClick={() => onEdit(r)} aria-label={t('common.edit')} />
          <Button variant="ghost" size="sm" icon={Trash2} onClick={() => onDelete(r)} aria-label={t('common.delete')} className="hover:text-error" />
        </div>
      ),
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
