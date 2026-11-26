import { useState, useEffect, useMemo, useCallback } from 'react';
import { Eye, ChevronRight, Ban, RefreshCw } from 'lucide-react';
import { listOrders, changeOrderStatus } from '../services/ordersService';
import { listUnits } from '../services/unitsService';
import { parseTourMeta } from '../components/units/UnitForm';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';
import FilterChips from '../components/ui/FilterChips';
import Table from '../components/ui/Table';
import EmptyState from '../components/ui/EmptyState';
import { Select } from '../components/ui/Input';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import { useT } from '../i18n';
import { useLingua, localeDe } from '../utils/formatoLingua';
import { eurosDuasCasas } from '../utils/formatoEuros';
import { IconBtn, EDIT_HOVER, DELETE_HOVER } from '../components/shared/IconBtn';

/* Estados gravados do pedido; o rotulo vem de orders.status */
const STATUS_FILTERS = ['', 'received', 'preparing', 'ready', 'delivered', 'cancelled'];
const STATUS_NEXT = { received: 'preparing', preparing: 'ready', ready: 'delivered' };
const CANCELABLE  = ['received', 'preparing', 'ready'];

const AUTO_REFRESH_MS = 15_000;

function tableLabel(order, t) {
  const unit = order.units;
  if (!unit) return '—';
  const meta = parseTourMeta(unit.description);
  return meta.number ? t('orders.table', { n: meta.number }) : unit.name;
}

/* Rotulo de um estado gravado; um estado que nao conhecemos mostra-se tal e qual */
function rotuloEstado(estado, t) {
  return estado && STATUS_FILTERS.includes(estado) ? t(`orders.status.${estado}`) : estado;
}

function fmtTime(iso, lang) {
  return new Date(iso).toLocaleTimeString(localeDe(lang), { hour: '2-digit', minute: '2-digit' });
}

function itemsSummary(order) {
  return (order.order_items || []).map(i => `${i.quantity}x ${i.unit_name}`).join(', ');
}

function OrderDetailModal({ order, onClose }) {
  const t = useT();
  const lang = useLingua();
  return (
    <Modal open={!!order} onClose={onClose} title={order ? t('orders.orderTitle', { table: tableLabel(order, t) }) : ''} size="sm" footer={null}>
      {order && (
        <div className="space-y-3">
          <div className="space-y-2">
            {(order.order_items || []).map(item => (
              <div key={item.id} className="flex items-start justify-between gap-3 pb-2 border-b border-n-100 last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-body font-semibold text-n-900">{item.quantity}x {item.unit_name}</p>
                  {item.notes && <p className="text-xs font-body text-n-500 mt-0.5">{item.notes}</p>}
                </div>
                <span className="text-sm font-mono tabular-nums font-bold text-ocean-700 shrink-0">
                  {eurosDuasCasas(Number(item.unit_price) * item.quantity, lang)}
                </span>
              </div>
            ))}
          </div>
          {order.notes && (
            <div className="bg-mare-head border border-mare-card rounded-[14px] px-3 py-2">
              <p className="text-xs font-body font-bold text-n-500 uppercase tracking-wide mb-1">{t('orders.orderNotes')}</p>
              <p className="text-sm font-body text-n-700">{order.notes}</p>
            </div>
          )}
          <div className="flex items-center justify-between pt-2 border-t border-n-200">
            <span className="text-sm font-body font-semibold text-n-700">{t('orders.total')}</span>
            <span className="font-mono tabular-nums font-bold text-lg text-ocean-700">{eurosDuasCasas(order.total_price, lang)}</span>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function Pedidos() {
  const t = useT();
  const lang = useLingua();
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

  // Colunas da tabela; as acoes por linha mantem avancar, cancelar e ver detalhes
  const columns = [
    {
      key: 'ref',
      label: t('orders.columns.ref'),
      render: (order) => <span className="text-xs font-mono tabular-nums text-n-400">{order.id?.slice(0, 8)}</span>,
    },
    {
      key: 'mesa',
      label: t('orders.columns.table'),
      render: (order) => <p className="font-mono tabular-nums font-semibold text-sm text-n-900 whitespace-nowrap">{tableLabel(order, t)}</p>,
    },
    {
      key: 'itens',
      label: t('orders.columns.items'),
      render: (order) => <p className="text-xs font-body text-n-600 truncate max-w-[280px]">{itemsSummary(order)}</p>,
    },
    {
      key: 'total',
      label: t('orders.columns.total'),
      align: 'right',
      render: (order) => (
        <span className="font-mono tabular-nums font-bold text-sm text-ocean-700">{eurosDuasCasas(order.total_price, lang)}</span>
      ),
    },
    {
      key: 'estado',
      label: t('orders.columns.status'),
      render: (order) => <Badge variant={order.status}>{rotuloEstado(order.status, t)}</Badge>,
    },
    {
      key: 'hora',
      label: t('orders.columns.time'),
      render: (order) => <span className="text-xs font-mono tabular-nums text-n-500">{fmtTime(order.created_at, lang)}</span>,
    },
    {
      key: 'acoes',
      label: '',
      render: (order) => {
        const isLoading = actionLoading === order.id;
        const canNext   = !!STATUS_NEXT[order.status];
        const canCancel = CANCELABLE.includes(order.status);
        return (
          <div className="flex items-center gap-1 justify-end">
            {canNext && (
              <button
                onClick={() => handleAdvance(order)}
                disabled={isLoading}
                className="flex items-center justify-center gap-1 px-3 min-h-11 md:min-h-9 rounded-full bg-ocean-700 text-white text-xs font-body font-medium hover:bg-ocean-500 transition-colors disabled:opacity-50 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sand-500"
              >
                {t(`orders.advance.${order.status}`)}
                <ChevronRight size={11} strokeWidth={2} />
              </button>
            )}
            {canCancel && (
              <IconBtn icon={Ban} label={t('orders.cancel')} hover={DELETE_HOVER} disabled={isLoading} onClick={() => handleCancel(order)} />
            )}
            <IconBtn icon={Eye} label={t('orders.viewDetails')} hover={EDIT_HOVER} onClick={() => setDetailOrder(order)} />
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow={t('nav.sections.operacao')}
        title={t('orders.title')}
        subtitle={t('orders.subtitle', { n: filtered.length })}
        actions={
          <Button variant="secondary" icon={RefreshCw} onClick={carregar}>
            {t('orders.refresh')}
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2 mb-6 items-center">
        <FilterChips
          options={STATUS_FILTERS.map(s => ({ value: s, label: s ? rotuloEstado(s, t) : t('orders.all') }))}
          value={statusFilter}
          onChange={setStatusFilter}
        />
        <div className="w-44">
          <Select value={unitFilter} onChange={e => setUnitFilter(e.target.value)}>
            <option value="">{t('orders.allTables')}</option>
            {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><LoadingSpinner size={32} /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[18px] border border-mare-card bg-white">
          <EmptyState title={t('orders.empty')} />
        </div>
      ) : (
        <div className="rounded-[18px] border border-mare-card bg-white overflow-hidden">
          <Table columns={columns} rows={filtered} compact />
        </div>
      )}

      <OrderDetailModal order={detailOrder} onClose={() => setDetailOrder(null)} />
    </div>
  );
}
