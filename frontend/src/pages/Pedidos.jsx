import { useState, useEffect, useMemo, useCallback } from 'react';
import { Eye, ChevronRight, Ban, RefreshCw } from 'lucide-react';
import { listOrders, changeOrderStatus } from '../services/ordersService';
import { listUnits } from '../services/unitsService';
import { parseTourMeta } from '../components/units/UnitForm';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';
import LoadingSpinner from '../components/shared/LoadingSpinner';

const STATUS_LABEL = {
  received:  'Recebido',
  preparing: 'Em preparação',
  ready:     'Pronto',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
};
const STATUS_FILTERS = ['', 'received', 'preparing', 'ready', 'delivered', 'cancelled'];
const STATUS_NEXT = { received: 'preparing', preparing: 'ready', ready: 'delivered' };
const STATUS_BTN  = { received: 'Preparar', preparing: 'Pronto', ready: 'Entregar' };
const CANCELABLE  = ['received', 'preparing', 'ready'];

const AUTO_REFRESH_MS = 15_000;

function tableLabel(order) {
  const unit = order.units;
  if (!unit) return '—';
  const meta = parseTourMeta(unit.description);
  return meta.number ? `Mesa ${meta.number}` : unit.name;
}

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}

function itemsSummary(order) {
  return (order.order_items || []).map(i => `${i.quantity}x ${i.unit_name}`).join(', ');
}

function OrderDetailModal({ order, onClose }) {
  return (
    <Modal open={!!order} onClose={onClose} title={order ? `Pedido — ${tableLabel(order)}` : ''} size="sm" footer={null}>
      {order && (
        <div className="space-y-3">
          <div className="space-y-2">
            {(order.order_items || []).map(item => (
              <div key={item.id} className="flex items-start justify-between gap-3 pb-2 border-b border-n-100 last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-body font-semibold text-n-900">{item.quantity}x {item.unit_name}</p>
                  {item.notes && <p className="text-xs font-body text-n-500 mt-0.5">{item.notes}</p>}
                </div>
                <span className="text-sm font-display font-bold text-ocean-700 shrink-0">
                  €{(Number(item.unit_price) * item.quantity).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
          {order.notes && (
            <div className="bg-n-50 rounded-md px-3 py-2">
              <p className="text-xs font-body font-bold text-n-500 uppercase tracking-wide mb-1">Notas do pedido</p>
              <p className="text-sm font-body text-n-700">{order.notes}</p>
            </div>
          )}
          <div className="flex items-center justify-between pt-2 border-t border-n-200">
            <span className="text-sm font-body font-semibold text-n-700">Total</span>
            <span className="font-display font-bold text-lg text-ocean-700">€{Number(order.total_price).toFixed(2)}</span>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function Pedidos() {
  const [orders,       setOrders]       = useState([]);
  const [units,        setUnits]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [unitFilter,   setUnitFilter]   = useState('');
  const [detailOrder,  setDetailOrder]  = useState(null);
  const [actionLoading,setActionLoading]= useState(null);

  const carregar = useCallback(async () => {
    try {
      const filtros = {};
      if (statusFilter) filtros.status = statusFilter;
      if (unitFilter)   filtros.unit_id = unitFilter;
      const data = await listOrders(filtros);
      setOrders(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, unitFilter]);

  useEffect(() => {
    listUnits().then(uns => {
      setUnits((uns || []).filter(u => u.unit_type !== 'menu_item' && u.unit_type !== 'tasting_menu'));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    carregar();
    const id = setInterval(carregar, AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [carregar]);

  async function handleAdvance(order) {
    const next = STATUS_NEXT[order.status];
    if (!next) return;
    setActionLoading(order.id);
    try {
      const updated = await changeOrderStatus(order.id, next);
      setOrders(prev => prev.map(o => (o.id === updated.id ? updated : o)));
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCancel(order) {
    setActionLoading(order.id);
    try {
      const updated = await changeOrderStatus(order.id, 'cancelled');
      setOrders(prev => prev.map(o => (o.id === updated.id ? updated : o)));
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  }

  const filtered = useMemo(() => orders, [orders]);

  return (
    <div>
      <PageHeader
        title="Pedidos"
        subtitle={`${filtered.length} pedido(s)`}
        actions={
          <Button variant="secondary" icon={RefreshCw} onClick={carregar}>
            Actualizar
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2 mb-6 items-center">
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
              {s ? STATUS_LABEL[s] : 'Todos'}
            </button>
          ))}
        </div>
        <select
          value={unitFilter}
          onChange={e => setUnitFilter(e.target.value)}
          className="h-8 px-3 rounded-sm border border-n-200 text-xs font-body bg-white text-n-700 focus:outline-none focus:ring-2 focus:ring-ocean-300 focus:border-ocean-700"
        >
          <option value="">Todas as mesas</option>
          {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><LoadingSpinner size={32} /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-n-400">
          <p className="font-body text-sm">Sem pedidos.</p>
        </div>
      ) : (
        <div className="bg-white rounded-md border border-n-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-n-200 bg-n-50">
                  <th className="text-left px-4 py-3 text-xs font-body font-bold uppercase tracking-wide text-n-500 whitespace-nowrap">Ref</th>
                  <th className="text-left px-4 py-3 text-xs font-body font-bold uppercase tracking-wide text-n-500 whitespace-nowrap">Mesa</th>
                  <th className="text-left px-4 py-3 text-xs font-body font-bold uppercase tracking-wide text-n-500">Itens</th>
                  <th className="text-right px-4 py-3 text-xs font-body font-bold uppercase tracking-wide text-n-500 whitespace-nowrap">Total</th>
                  <th className="text-left px-4 py-3 text-xs font-body font-bold uppercase tracking-wide text-n-500 whitespace-nowrap">Estado</th>
                  <th className="text-left px-4 py-3 text-xs font-body font-bold uppercase tracking-wide text-n-500 whitespace-nowrap">Hora</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-n-100">
                {filtered.map(order => {
                  const isLoading = actionLoading === order.id;
                  const canNext   = !!STATUS_NEXT[order.status];
                  const canCancel = CANCELABLE.includes(order.status);
                  return (
                    <tr key={order.id} className="hover:bg-n-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono text-n-400">{order.id?.slice(0, 8)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-display font-semibold text-sm text-n-900">{tableLabel(order)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-body text-n-600 truncate max-w-[280px]">{itemsSummary(order)}</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-display font-bold text-sm text-ocean-700">€{Number(order.total_price).toFixed(2)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={order.status}>{STATUS_LABEL[order.status]}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono text-n-500">{fmtTime(order.created_at)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end flex-wrap">
                          {canNext && (
                            <button
                              onClick={() => handleAdvance(order)}
                              disabled={isLoading}
                              className="flex items-center gap-1 px-2 py-1 rounded-xs bg-ocean-700 text-white text-xs font-body font-medium hover:bg-ocean-500 transition-colors disabled:opacity-50 whitespace-nowrap"
                            >
                              {STATUS_BTN[order.status]}
                              <ChevronRight size={11} strokeWidth={2} />
                            </button>
                          )}
                          {canCancel && (
                            <button
                              onClick={() => handleCancel(order)}
                              disabled={isLoading}
                              className="p-1.5 rounded text-n-400 hover:text-error hover:bg-[var(--error-light)] transition-colors disabled:opacity-50"
                              aria-label="Cancelar"
                            >
                              <Ban size={13} strokeWidth={1.75} />
                            </button>
                          )}
                          <Button variant="ghost" size="sm" icon={Eye} onClick={() => setDetailOrder(order)} aria-label="Ver detalhes" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <OrderDetailModal order={detailOrder} onClose={() => setDetailOrder(null)} />
    </div>
  );
}
