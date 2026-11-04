import { useState } from 'react';
import { Pencil, Trash2, Car, MoveRight, MoveLeft, Eye } from 'lucide-react';
import { changeStatus } from '../../services/reservationsService';
import { useT } from '../../i18n';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
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
                      <Button variant="ghost" size="sm" icon={Eye} onClick={() => onView(r)} aria-label={t('reservations.view')} />
                      <Button variant="ghost" size="sm" icon={Pencil} onClick={() => onEdit(r)} aria-label="Editar" />
                      <Button variant="ghost" size="sm" icon={Trash2} onClick={() => onDelete(r)} aria-label="Eliminar" className="hover:text-error" />
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
