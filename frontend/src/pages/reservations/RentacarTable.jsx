import { useState } from 'react';
import { Pencil, Trash2, Car, MoveRight, MoveLeft, Eye } from 'lucide-react';
import { changeStatus } from '../../services/reservationsService';
import { useT } from '../../i18n';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Table from '../../components/ui/Table';
import { formatDate, parseRentacarMeta } from './shared';

export default function RentacarTable({ reservations, units, onEdit, onDelete, onLevantamento, onDevolucao, onUpdate, onView }) {
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

  // Colunas da tabela; as datas de levantamento e devolucao e o total sao ordenaveis
  const columns = [
    {
      key: 'ref',
      label: 'Ref',
      render: (r) => <span className="text-xs font-mono text-n-400">{r.id?.slice(0, 8)}</span>,
    },
    {
      key: 'viatura',
      label: 'Viatura',
      render: (r) => {
        const unit = units.find(u => u.id === r.unit_id);
        let unitMeta = {};
        try { unitMeta = JSON.parse(unit?.description || '{}'); } catch {}
        return (
          <>
            <p className="font-display font-semibold text-sm text-n-900 truncate max-w-[120px]">
              {unitMeta.brand ? `${unitMeta.brand} ${unitMeta.model || ''}`.trim() : unit?.name || '—'}
            </p>
            {unitMeta.plate && <p className="text-xs font-mono text-n-400">{unitMeta.plate}</p>}
          </>
        );
      },
    },
    {
      key: 'levantamento',
      label: 'Levantamento',
      sortValue: (r) => r.check_in || '',
      render: (r) => {
        const rcMeta = parseRentacarMeta(r);
        return (
          <div className="whitespace-nowrap">
            <span className="text-sm font-body text-n-700">{formatDate(r.check_in)}</span>
            {rcMeta.km_out && <p className="text-xs font-mono text-n-400">{Number(rcMeta.km_out).toLocaleString()} km</p>}
          </div>
        );
      },
    },
    {
      key: 'devolucao',
      label: 'Devolucao',
      sortValue: (r) => r.check_out || '',
      render: (r) => {
        const rcMeta = parseRentacarMeta(r);
        return (
          <div className="whitespace-nowrap">
            <span className="text-sm font-body text-n-700">{formatDate(r.check_out)}</span>
            {rcMeta.km_in && <p className="text-xs font-mono text-n-400">{Number(rcMeta.km_in).toLocaleString()} km</p>}
          </div>
        );
      },
    },
    {
      key: 'cliente',
      label: 'Cliente',
      render: (r) => <p className="text-sm font-body text-n-900 truncate max-w-[120px]">{r.customer_name || '—'}</p>,
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
      render: (r) => (
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
          <Button variant="ghost" size="sm" icon={Eye} onClick={() => onView(r)} aria-label={t('reservations.view')} />
          <Button variant="ghost" size="sm" icon={Pencil} onClick={() => onEdit(r)} aria-label="Editar" />
          <Button variant="ghost" size="sm" icon={Trash2} onClick={() => onDelete(r)} aria-label="Eliminar" className="hover:text-error" />
        </div>
      ),
    },
  ];

  return (
    <div className="bg-white rounded-md border border-n-200 shadow-sm overflow-hidden">
      <Table columns={columns} rows={reservations} />
    </div>
  );
}
