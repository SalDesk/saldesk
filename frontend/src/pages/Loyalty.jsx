import { useState, useEffect, useCallback } from 'react';
import PlanGuard from '../components/PlanGuard';
import {
  Award, Users, Gift, Edit2, Save, ToggleLeft, ToggleRight,
  Plus, Minus, ChevronDown, ChevronUp, Star, Clock, Copy, Check as CheckIcon, AlertCircle,
} from 'lucide-react';
import { listCustomers } from '../services/customersService';
import {
  getLoyaltyConfig, updateLoyaltyConfig,
  getCustomerLoyaltyHistory, adjustCustomerPoints, redeemCustomerPoints,
} from '../services/loyaltyService';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Tabs from '../components/ui/Tabs';
import Table from '../components/ui/Table';
import FilterChips from '../components/ui/FilterChips';
import EmptyState from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';
import Input, { Select } from '../components/ui/Input';
import LoadingSpinner from '../components/shared/LoadingSpinner';

const DEFAULT_CONFIG = {
  active: false,
  points_per_euro: 1,
  levels: [
    { name: 'Bronze', min: 0,   max: 100, discount_pct: 5,  reward: '5% desconto em todas as reservas'          },
    { name: 'Prata',  min: 101, max: 499, discount_pct: 10, reward: '10% desconto + upgrade gratuito disponivel' },
    { name: 'Ouro',   min: 500, max: null, discount_pct: 15, reward: '15% desconto + tour gratuito por ano'       },
  ],
};

/* estilo por nivel: variante do Badge, circulo do icone e cor do numero (nome desconhecido = Bronze) */
const LEVEL_STYLE = {
  Bronze: { variant: 'pending', icon: 'bg-[var(--warning-light)] text-[var(--warning)]', text: 'text-[var(--warning)]' },
  Prata:  { variant: 'default', icon: 'bg-n-100 text-n-600',                              text: 'text-n-600'          },
  Ouro:   { variant: 'direct',  icon: 'bg-sand-50 text-sand-600',                         text: 'text-sand-600'       },
};

/* ── Helpers ── */
function getLevel(points, levels) {
  const pts = Number(points || 0);
  return [...levels].sort((a, b) => b.min - a.min).find(l => pts >= l.min) || levels[0];
}

function LevelBadge({ name }) {
  const s = LEVEL_STYLE[name] || LEVEL_STYLE.Bronze;
  return <Badge variant={s.variant}>{name}</Badge>;
}

/* ── Historico de pontos ── */
const LEDGER_LABELS = {
  earn:          { label: 'Ganho',        color: 'text-[var(--success)]' },
  manual_adjust: { label: 'Ajuste manual', color: 'text-ocean-700' },
  redeem:        { label: 'Resgate',      color: 'text-sand-600' },
};

function HistoryList({ customerId, refreshKey }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getCustomerLoyaltyHistory(customerId)
      .then(h => setHistory(h || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [customerId, refreshKey]);

  if (loading) return <div className="flex justify-center py-4"><LoadingSpinner size={20} /></div>;
  if (history.length === 0) {
    return <p className="text-xs font-body text-n-400 text-center py-3">Sem movimentos ainda.</p>;
  }

  return (
    <div className="space-y-1.5 max-h-40 overflow-y-auto">
      {history.map(h => (
        <div key={h.id} className="flex items-center justify-between text-xs font-body py-1 border-b border-n-100 last:border-0">
          <div className="min-w-0">
            <span className={`font-semibold ${LEDGER_LABELS[h.type]?.color || 'text-n-600'}`}>
              {LEDGER_LABELS[h.type]?.label || h.type}
            </span>
            {h.reason && <span className="text-n-400 truncate"> · {h.reason}</span>}
            <p className="text-n-400">{new Date(h.created_at).toLocaleDateString('pt-PT')}</p>
          </div>
          <span className={`font-mono font-semibold shrink-0 ${h.points > 0 ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
            {h.points > 0 ? '+' : ''}{h.points}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Points Modal ── */
function PointsModal({ customer, config, onClose, onAdjust, onRedeem }) {
  const current = Number(customer?.loyalty_points || 0);
  const [mode,   setMode]   = useState('add');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');
  const [historyKey, setHistoryKey] = useState(0);
  const [redeeming, setRedeeming] = useState(false);
  const [redeemedVoucher, setRedeemedVoucher] = useState(null);
  const [copied, setCopied] = useState(false);

  async function handleSave() {
    const delta = Number(amount);
    if (!delta || delta <= 0) { setError('Introduza um valor valido.'); return; }
    setSaving(true);
    setError('');
    try {
      await onAdjust(customer.id, mode === 'add' ? delta : -delta, reason);
      setAmount('');
      setReason('');
      setHistoryKey(k => k + 1);
    } catch { setError('Erro ao actualizar pontos.'); }
    finally { setSaving(false); }
  }

  async function handleRedeem() {
    setRedeeming(true);
    setError('');
    try {
      const result = await onRedeem(customer.id);
      setRedeemedVoucher(result.voucher);
      setHistoryKey(k => k + 1);
    } catch (err) {
      setError(err?.response?.data?.error || 'Erro ao resgatar pontos.');
    } finally { setRedeeming(false); }
  }

  function copyCode() {
    navigator.clipboard.writeText(redeemedVoucher.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const preview = Number(amount) > 0
    ? Math.max(0, mode === 'add' ? current + Number(amount) : current - Number(amount))
    : current;

  const currentLevel = getLevel(current, config.levels);
  const previewLevel = getLevel(preview, config.levels);

  return (
    <Modal open onClose={onClose} title={`Pontos — ${customer?.name || ''}`} size="sm">
      <div className="space-y-4">
        <div className="flex items-center justify-between p-3 bg-n-50 rounded-sm border border-n-200">
          <div>
            <p className="text-xs font-body text-n-500">Pontos actuais</p>
            <p className="font-display font-bold text-2xl text-n-900">{current.toLocaleString('pt-PT')}</p>
          </div>
          <LevelBadge name={currentLevel.name} />
        </div>

        {/* Resgate */}
        {redeemedVoucher ? (
          <div className="p-3 bg-[var(--success-light)] border border-n-200 rounded-sm space-y-2">
            <p className="text-xs font-body font-semibold text-[var(--success)]">Voucher gerado — {redeemedVoucher.value}% de desconto</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-sm font-bold text-n-900 bg-white border border-n-200 rounded-xs px-2 py-1.5">
                {redeemedVoucher.code}
              </code>
              <button type="button" onClick={copyCode} className="p-1.5 rounded text-n-500 hover:text-ocean-700 hover:bg-white transition-colors" title="Copiar codigo" aria-label="Copiar codigo">
                {copied ? <CheckIcon size={14} strokeWidth={2} className="text-[var(--success)]" /> : <Copy size={14} strokeWidth={1.75} />}
              </button>
            </div>
            <p className="text-xs font-body text-n-500">Uso unico, valido ate {new Date(redeemedVoucher.expires_at).toLocaleDateString('pt-PT', { timeZone: 'UTC' })}.</p>
          </div>
        ) : (
          <div className="p-3 bg-sand-50 border border-sand-100 rounded-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-body font-semibold text-n-700 flex items-center gap-1.5">
                  <Gift size={13} strokeWidth={1.75} /> Resgatar nivel {currentLevel.name}
                </p>
                <p className="text-xs font-body text-n-500 truncate">Troca todo o saldo por um voucher de {currentLevel.discount_pct}% (uso unico).</p>
              </div>
              <Button size="sm" variant="secondary" loading={redeeming} disabled={current <= 0} onClick={handleRedeem} className="shrink-0">
                Resgatar
              </Button>
            </div>
          </div>
        )}

        <div className="flex gap-1 bg-n-100 rounded-sm p-0.5">
          {[{ v: 'add', l: 'Adicionar' }, { v: 'remove', l: 'Remover' }].map(o => (
            <button key={o.v} type="button" aria-pressed={mode === o.v} onClick={() => setMode(o.v)}
              className={`flex-1 py-1.5 text-xs font-body font-semibold rounded-xs transition-colors ${mode === o.v ? 'bg-white text-ocean-700 shadow-sm' : 'text-n-500 hover:text-n-700'}`}>
              {o.l}
            </button>
          ))}
        </div>

        <Input
          label="Quantidade de pontos" aria-label="Quantidade de pontos"
          type="number" min="1" step="1"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="Ex: 50"
        />

        <Input
          label="Motivo" aria-label="Motivo"
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Ex: reserva especial, ajuste manual..."
        />

        {Number(amount) > 0 && (
          <div className="p-3 bg-ocean-50 border border-ocean-100 rounded-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-body text-n-600">Resultado</span>
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-ocean-700">{preview.toLocaleString('pt-PT')} pts</span>
                {previewLevel.name !== currentLevel.name && (
                  <LevelBadge name={previewLevel.name} />
                )}
              </div>
            </div>
          </div>
        )}

        {error && (
          <p className="text-xs text-[var(--error)] flex items-center gap-1"><AlertCircle size={12} strokeWidth={2} /> {error}</p>
        )}

        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">Fechar</Button>
          <Button icon={Save} loading={saving} onClick={handleSave} className="flex-1">Guardar ajuste</Button>
        </div>

        <div className="pt-2 border-t border-n-100">
          <p className="text-xs font-body font-bold uppercase tracking-wide text-n-500 mb-2 flex items-center gap-1.5">
            <Clock size={12} strokeWidth={1.75} /> Historico
          </p>
          <HistoryList customerId={customer.id} refreshKey={historyKey} />
        </div>
      </div>
    </Modal>
  );
}

/* ── LevelCard ── */
function LevelCard({ level, index, onUpdate, totalCustomers }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ ...level });
  const s = LEVEL_STYLE[level.name] || LEVEL_STYLE.Bronze;

  function handleSave() {
    onUpdate(index, draft);
    setOpen(false);
  }

  return (
    <Card padding="p-0" className="overflow-hidden">
      <div
        role="button" tabIndex={0} aria-expanded={open}
        className="flex items-center gap-4 px-4 py-3 cursor-pointer select-none"
        onClick={() => setOpen(p => !p)}
        onKeyDown={e => {
          if (e.target !== e.currentTarget) return;
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(p => !p); }
        }}
      >
        <div className={`w-8 h-8 rounded-full border border-n-200 flex items-center justify-center shrink-0 ${s.icon}`}>
          <Award size={16} strokeWidth={1.75} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-display font-semibold text-sm text-n-900">{level.name}</span>
            <LevelBadge name={level.name} />
          </div>
          <p className="text-xs font-body text-n-500 mt-0.5">
            {level.min}–{level.max != null ? level.max : '∞'} pts · {level.discount_pct}% desconto
          </p>
        </div>
        {open ? <ChevronUp size={16} strokeWidth={1.75} className="text-n-400 shrink-0" /> : <ChevronDown size={16} strokeWidth={1.75} className="text-n-400 shrink-0" />}
      </div>

      {open && (
        <div className="border-t border-n-100 px-4 py-4 space-y-3 bg-n-50">
          <Input
            label="Desconto (%)" aria-label="Desconto (%)"
            type="number" min="0" max="100" step="1"
            value={draft.discount_pct}
            onChange={e => setDraft(p => ({ ...p, discount_pct: Number(e.target.value) }))}
          />
          <Input
            label="Descricao da recompensa" aria-label="Descricao da recompensa"
            value={draft.reward}
            onChange={e => setDraft(p => ({ ...p, reward: e.target.value }))}
          />
          {index < 2 && (
            <Input
              label={`Pontos maximo (nivel ${level.name})`} aria-label={`Pontos maximo (nivel ${level.name})`}
              type="number" min="1"
              value={draft.max ?? ''}
              onChange={e => setDraft(p => ({ ...p, max: e.target.value ? Number(e.target.value) : null }))}
            />
          )}
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" size="sm" onClick={() => { setDraft({ ...level }); setOpen(false); }} className="flex-1">
              Cancelar
            </Button>
            <Button size="sm" icon={Save} onClick={handleSave} className="flex-1">
              Guardar
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ── Main ── */
export default function Loyalty() {
  const [activeTab,  setActiveTab]  = useState('config');
  const [config,     setConfig]     = useState(DEFAULT_CONFIG);
  const [configLoading, setConfigLoading] = useState(true);
  const [customers,  setCustomers]  = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [search,     setSearch]     = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [editingCustomer, setEditingCustomer] = useState(null);

  useEffect(() => {
    getLoyaltyConfig()
      .then(d => setConfig({ ...DEFAULT_CONFIG, ...d }))
      .catch(() => {})
      .finally(() => setConfigLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab === 'clientes') {
      setLoading(true);
      listCustomers({}).then(d => setCustomers(d || [])).catch(() => {}).finally(() => setLoading(false));
    }
  }, [activeTab]);

  async function persistConfig(next) {
    setConfig(next);
    try {
      await updateLoyaltyConfig({ active: next.active, points_per_euro: next.points_per_euro, levels: next.levels });
    } catch { /* mantem UI optimista; proximo load reconcilia */ }
  }

  function toggleActive() {
    persistConfig({ ...config, active: !config.active });
  }

  function updateLevel(index, updated) {
    const levels = config.levels.map((l, i) => i === index ? { ...l, ...updated } : l);
    persistConfig({ ...config, levels });
  }

  const handleAdjustPoints = useCallback(async (customerId, delta, reason) => {
    const result = await adjustCustomerPoints(customerId, delta, reason);
    setCustomers(prev => prev.map(c => c.id === customerId ? { ...c, loyalty_points: result.loyalty_points } : c));
    setEditingCustomer(prev => prev && prev.id === customerId ? { ...prev, loyalty_points: result.loyalty_points } : prev);
    return result;
  }, []);

  const handleRedeemPoints = useCallback(async (customerId) => {
    const result = await redeemCustomerPoints(customerId);
    setCustomers(prev => prev.map(c => c.id === customerId ? { ...c, loyalty_points: result.loyalty_points } : c));
    setEditingCustomer(prev => prev && prev.id === customerId ? { ...prev, loyalty_points: result.loyalty_points } : prev);
    return result;
  }, []);

  const filtered = customers.filter(c => {
    if (search) {
      const q = search.toLowerCase();
      if (!(c.name || '').toLowerCase().includes(q) && !(c.email || '').toLowerCase().includes(q)) return false;
    }
    if (filterLevel) {
      const lvl = getLevel(c.loyalty_points, config.levels);
      if (lvl.name !== filterLevel) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => Number(b.loyalty_points || 0) - Number(a.loyalty_points || 0));

  const stats = {
    total:  customers.length,
    bronze: customers.filter(c => getLevel(c.loyalty_points, config.levels).name === 'Bronze').length,
    prata:  customers.filter(c => getLevel(c.loyalty_points, config.levels).name === 'Prata').length,
    ouro:   customers.filter(c => getLevel(c.loyalty_points, config.levels).name === 'Ouro').length,
  };

  /* colunas da tabela de clientes; o destaque (estrela) e do primeiro com pontos */
  const columns = [
    {
      key: 'name', label: 'Cliente',
      render: c => (
        <span className="font-body font-semibold text-n-900 whitespace-nowrap">
          {c.name}
          {c === sorted[0] && Number(c.loyalty_points || 0) > 0 && (
            <Star size={11} strokeWidth={2} className="inline ml-1 text-sand-500 fill-sand-400" />
          )}
        </span>
      ),
    },
    { key: 'email', label: 'Email', render: c => <span className="text-xs text-n-500">{c.email || '—'}</span> },
    { key: 'visits', label: 'Visitas', align: 'center', render: c => <span className="font-mono text-n-600">{c.total_visits ?? 0}</span> },
    {
      key: 'points', label: 'Pontos',
      render: c => (
        <span className="font-display font-bold text-ocean-700 whitespace-nowrap">
          {Number(c.loyalty_points || 0).toLocaleString('pt-PT')} pts
        </span>
      ),
    },
    { key: 'level', label: 'Nivel', render: c => <LevelBadge name={getLevel(c.loyalty_points, config.levels).name} /> },
    {
      key: 'reward', label: 'Recompensa',
      render: c => <span className="text-xs font-body text-n-500 max-w-[160px] truncate block">{getLevel(c.loyalty_points, config.levels).reward}</span>,
    },
    {
      key: 'acoes', label: '',
      render: c => (
        <button type="button" onClick={() => setEditingCustomer(c)} aria-label={`Ajustar pontos ${c.name}`}
          className="p-1.5 rounded text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors">
          <Edit2 size={13} strokeWidth={1.75} />
        </button>
      ),
    },
  ];

  if (configLoading) {
    return (
      <div>
        <PageHeader title="Programa de Fidelidade" subtitle="Configure niveis, pontos e recompensas" />
        <div className="flex justify-center py-16"><LoadingSpinner size={32} /></div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Programa de Fidelidade"
        subtitle="Configure niveis, pontos e recompensas"
      />

      {/* Active toggle */}
      <div className={`flex items-center gap-4 px-4 py-3 rounded-md border border-n-200 mb-6 ${config.active ? 'bg-[var(--success-light)]' : 'bg-n-50'}`}>
        <button type="button" onClick={toggleActive} aria-pressed={config.active} aria-label="Programa de fidelidade" className="shrink-0">
          {config.active
            ? <ToggleRight size={28} strokeWidth={1.5} className="text-[var(--success)]" />
            : <ToggleLeft  size={28} strokeWidth={1.5} className="text-n-400" />}
        </button>
        <div>
          <p className={`text-sm font-body font-semibold ${config.active ? 'text-[var(--success)]' : 'text-n-600'}`}>
            Programa {config.active ? 'activo' : 'inactivo'}
          </p>
          <p className="text-xs font-body text-n-400">
            {config.active
              ? 'Os clientes acumulam pontos automaticamente apos cada reserva.'
              : 'Active o programa para comecar a atribuir pontos aos clientes.'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <Tabs
          tabs={[{ id: 'config', label: 'Configuracao' }, { id: 'clientes', label: 'Clientes' }]}
          value={activeTab}
          onChange={setActiveTab}
        />
      </div>

      {activeTab === 'config' && (
        <div className="space-y-5">
          {/* Points per euro */}
          <Card padding="px-5 py-5">
            <h3 className="font-display font-semibold text-sm text-n-700 mb-4">Regra de acumulacao</h3>
            <div className="flex items-end gap-4 max-w-xs">
              <Input
                label="Pontos por Euro gasto" aria-label="Pontos por Euro gasto"
                type="number" min="0.1" step="0.1"
                value={config.points_per_euro}
                onChange={e => persistConfig({ ...config, points_per_euro: Number(e.target.value) })}
              />
              <p className="text-xs font-body text-n-500 pb-2 whitespace-nowrap">pt / EUR</p>
            </div>
            <p className="text-xs font-body text-n-400 mt-2">
              Ex: reserva de €100 = {Math.round(100 * config.points_per_euro)} pontos.
            </p>
          </Card>

          {/* Levels */}
          <Card padding="px-5 py-5">
            <h3 className="font-display font-semibold text-sm text-n-700 mb-4">Niveis e recompensas</h3>
            <div className="space-y-3">
              {config.levels.map((l, i) => (
                <LevelCard key={l.name} level={l} index={i} onUpdate={updateLevel} totalCustomers={customers.length} />
              ))}
            </div>
            <p className="text-xs font-body text-n-400 mt-3">
              Os limites minimos dos niveis Prata e Ouro sao calculados automaticamente a partir do maximo do nivel anterior.
            </p>
          </Card>
        </div>
      )}

      {activeTab === 'clientes' && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Total clientes',   value: stats.total,  color: 'text-n-900'               },
              { label: 'Bronze',           value: stats.bronze, color: LEVEL_STYLE.Bronze.text    },
              { label: 'Prata',            value: stats.prata,  color: LEVEL_STYLE.Prata.text     },
              { label: 'Ouro',             value: stats.ouro,   color: LEVEL_STYLE.Ouro.text      },
            ].map(m => (
              <Card key={m.label} padding="px-4 py-3">
                <div className="flex items-center gap-3">
                  <Award size={18} strokeWidth={1.75} className="text-n-300 shrink-0" />
                  <div>
                    <p className={`font-display font-bold text-xl ${m.color}`}>{m.value}</p>
                    <p className="text-xs font-body text-n-500">{m.label}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Search + filter */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[180px]">
              <Input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Pesquisar cliente..." aria-label="Pesquisar cliente"
              />
            </div>
            <FilterChips
              options={[{ value: '', label: 'Todos' }, { value: 'Bronze', label: 'Bronze' }, { value: 'Prata', label: 'Prata' }, { value: 'Ouro', label: 'Ouro' }]}
              value={filterLevel}
              onChange={setFilterLevel}
            />
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex justify-center py-16"><LoadingSpinner size={32} /></div>
          ) : (
            <Card padding="p-0">
              {sorted.length === 0 ? (
                <EmptyState icon={Users} title="Sem clientes encontrados." />
              ) : (
                <Table columns={columns} rows={sorted} />
              )}
            </Card>
          )}
        </div>
      )}

      {editingCustomer && (
        <PointsModal
          customer={editingCustomer}
          config={config}
          onClose={() => setEditingCustomer(null)}
          onAdjust={handleAdjustPoints}
          onRedeem={handleRedeemPoints}
        />
      )}
    </div>
  );
}
