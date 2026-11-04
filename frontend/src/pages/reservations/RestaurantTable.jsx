import { useState } from 'react';
import { Pencil, Trash2, ChevronRight, Utensils, Eye } from 'lucide-react';
import { changeStatus } from '../../services/reservationsService';
import { useT } from '../../i18n';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Table from '../../components/ui/Table';
import { formatDate, parseRestaurantMeta } from './shared';

const TURNO_LABELS = { almoco: 'Almoco', jantar: 'Jantar' };
const OCASIAO_LABELS = {
  aniversario: 'Aniversario', lua_de_mel: 'Lua-de-mel', negocios: 'Negocios', outro: 'Outro',
};

export default function RestaurantTable({ reservations, units, onEdit, onDelete, onDetails, onUpdate, onView }) {
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

  // Colunas da tabela; so o numero de pessoas e ordenavel
  const columns = [
    {
      key: 'ref',
      label: 'Ref',
      render: (r) => <span className="text-xs font-mono text-n-400">{r.id?.slice(0, 8)}</span>,
    },
    {
      key: 'mesa',
      label: 'Mesa',
      render: (r) => {
        const unit    = units.find(u => u.id === r.unit_id);
        let umeta = {};
        try { umeta = JSON.parse(unit?.description || '{}'); } catch {}
        const tbl    = unit ? (umeta.number ? `Mesa ${umeta.number}` : unit.name) : '—';
        const rcMeta = parseRestaurantMeta(r);
        return (
          <>
            <p className="font-display font-semibold text-sm text-n-900">{tbl}</p>
            {rcMeta.lista_espera && (
              <span className="text-[9px] font-mono uppercase tracking-wide text-[#B45309] bg-[#FFF7ED] px-1.5 py-0.5 rounded">Lista espera</span>
            )}
          </>
        );
      },
    },
    {
      key: 'turno',
      label: 'Turno',
      render: (r) => {
        const rcMeta = parseRestaurantMeta(r);
        return (
          <span className="text-xs font-mono text-n-700">
            {r.start_time
              ? r.start_time.slice(0, 5)
              : (rcMeta.turno ? TURNO_LABELS[rcMeta.turno] || rcMeta.turno : '—')}
          </span>
        );
      },
    },
    {
      key: 'pax',
      label: 'Pax',
      align: 'center',
      sortValue: (r) => Number(r.guests) || 0,
      render: (r) => <span className="text-sm font-body font-semibold text-n-900">{r.guests}</span>,
    },
    {
      key: 'cliente',
      label: 'Cliente',
      render: (r) => (
        <>
          <p className="text-sm font-body text-n-900 truncate max-w-[120px]">{r.customer_name || '—'}</p>
          <p className="text-xs font-body text-n-400">{formatDate(r.check_in)}</p>
        </>
      ),
    },
    {
      key: 'ocasiao',
      label: 'Ocasiao',
      render: (r) => {
        const rcMeta = parseRestaurantMeta(r);
        return rcMeta.ocasiao ? (
          <span className="text-xs font-body text-n-600">{OCASIAO_LABELS[rcMeta.ocasiao] || rcMeta.ocasiao}</span>
        ) : <span className="text-n-300">—</span>;
      },
    },
    {
      key: 'estado',
      label: 'Estado',
      render: (r) => <Badge variant={r.status}>{t(`reservations.status.${r.status}`)}</Badge>,
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
                className="flex items-center gap-1 px-2 py-1 rounded-xs bg-ocean-700 text-white text-xs font-body font-medium hover:bg-ocean-500 transition-colors disabled:opacity-50 whitespace-nowrap">
                {STATUS_BTN_R[r.status]}
                <ChevronRight size={11} strokeWidth={2} />
              </button>
            )}
            <button onClick={() => onDetails(r)} title="Turno / pedidos especiais"
              className="p-1.5 rounded text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors">
              <Utensils size={13} strokeWidth={1.75} />
            </button>
            <Button variant="ghost" size="sm" icon={Eye} onClick={() => onView(r)} aria-label={t('reservations.view')} />
            <Button variant="ghost" size="sm" icon={Pencil} onClick={() => onEdit(r)} aria-label="Editar" />
            <Button variant="ghost" size="sm" icon={Trash2} onClick={() => onDelete(r)} aria-label="Eliminar" className="hover:text-error" />
          </div>
        );
      },
    },
  ];

  return (
    <div className="bg-white rounded-md border border-n-200 shadow-sm overflow-hidden">
      <Table columns={columns} rows={reservations} />
    </div>
  );
}
