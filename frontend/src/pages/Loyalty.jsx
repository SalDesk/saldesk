import { useState, useEffect, useCallback } from 'react';
import {
  Award, Users, Gift, Edit2, Save, ToggleLeft, ToggleRight,
  ChevronDown, ChevronUp, Star, Clock, Copy, Check as CheckIcon, AlertCircle,
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
import Input from '../components/ui/Input';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import { useT } from '../i18n';
import { mensagemErro } from '../utils/mensagemErro';
import { formatarData, formatarNumero, useLingua } from '../utils/formatoLingua';

const DEFAULT_CONFIG = {
  active: false,
  points_per_euro: 1,
  /* Niveis por omissao do frontend, com acentos; os de loyaltyController.js (backend) nao tem.
     O nome do nivel e o valor gravado; a descricao da recompensa e texto do operador, gravado tal como esta. */
  levels: [
    { name: 'Bronze', min: 0,   max: 100, discount_pct: 5,  reward: '5% desconto em todas as reservas'          },
    { name: 'Prata',  min: 101, max: 499, discount_pct: 10, reward: '10% desconto + upgrade gratuito disponível' },
    { name: 'Ouro',   min: 500, max: null, discount_pct: 15, reward: '15% desconto + tour gratuito por ano'       },
  ],
};

/* estilo por nivel: variante do Badge, circulo do icone e cor do numero (nome desconhecido = Bronze) */
const LEVEL_STYLE = {
  Bronze: { variant: 'pending', icon: 'bg-[var(--warning-light)] text-[var(--warning)]', text: 'text-[var(--warning)]' },
  Prata:  { variant: 'default', icon: 'bg-n-100 text-n-600',                              text: 'text-n-600'          },
  Ouro:   { variant: 'direct',  icon: 'bg-sand-50 text-sand-600',                         text: 'text-sand-600'       },
};

/* Rotulo do nivel pelo nome gravado (Bronze, Prata, Ouro); um nome que nao conhece mostra-se tal e qual */
function rotuloNivel(name, t) {
  return Object.prototype.hasOwnProperty.call(LEVEL_STYLE, name) ? t(`loyaltyPage.levels.${name}`) : name;
}

/* ── Helpers ── */
function getLevel(points, levels) {
  const pts = Number(points || 0);
  return [...levels].sort((a, b) => b.min - a.min).find(l => pts >= l.min) || levels[0];
}

function LevelBadge({ name }) {
  const t = useT();
  const s = LEVEL_STYLE[name] || LEVEL_STYLE.Bronze;
  return <Badge variant={s.variant}>{rotuloNivel(name, t)}</Badge>;
}

/* ── Historico de pontos ── */
const LEDGER_COLOR = {
  earn:          'text-[var(--success)]',
  manual_adjust: 'text-ocean-700',
  redeem:        'text-sand-600',
};

function HistoryList({ customerId, refreshKey }) {
  const t = useT();
  const lang = useLingua();
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
    return <p className="text-xs font-body text-n-400 text-center py-3">{t('loyaltyPage.noMovements')}</p>;
  }

  return (
    <div className="space-y-1.5 max-h-40 overflow-y-auto">
      {history.map(h => (
        <div key={h.id} className="flex items-center justify-between text-xs font-body py-1 border-b border-n-100 last:border-0">
          <div className="min-w-0">
            <span className={`font-semibold ${LEDGER_COLOR[h.type] || 'text-n-600'}`}>
              {LEDGER_COLOR[h.type] ? t(`loyaltyPage.ledger.${h.type}`) : h.type}
            </span>
            {h.reason && <span className="text-n-400 truncate"> · {h.reason}</span>}
            <p className="text-n-400">{formatarData(new Date(h.created_at), {}, lang)}</p>
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
  const t = useT();
  const lang = useLingua();
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
    if (!delta || delta <= 0) { setError(t('loyaltyPage.points.errAmount')); return; }
    setSaving(true);
    setError('');
    try {
      await onAdjust(customer.id, mode === 'add' ? delta : -delta, reason);
      setAmount('');
      setReason('');
      setHistoryKey(k => k + 1);
    } catch { setError(t('loyaltyPage.points.errAdjust')); }
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
      setError(mensagemErro(err, t, t('loyaltyPage.points.errRedeem')));
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
    <Modal open onClose={onClose} title={t('loyaltyPage.points.title', { name: customer?.name || '' })} size="sm">
      <div className="space-y-4">
        <div className="flex items-center justify-between p-3 bg-n-50 rounded-sm border border-n-200">
          <div>
            <p className="text-xs font-body text-n-500">{t('loyaltyPage.points.current')}</p>
            <p className="font-display font-bold text-2xl text-n-900">{formatarNumero(current, {}, lang)}</p>
          </div>
          <LevelBadge name={currentLevel.name} />
        </div>

        {/* Resgate */}
        {redeemedVoucher ? (
          <div className="p-3 bg-[var(--success-light)] border border-n-200 rounded-sm space-y-2">
            <p className="text-xs font-body font-semibold text-[var(--success)]">{t('loyaltyPage.points.voucherCreated', { pct: redeemedVoucher.value })}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-sm font-bold text-n-900 bg-white border border-n-200 rounded-xs px-2 py-1.5">
                {redeemedVoucher.code}
              </code>
              <button type="button" onClick={copyCode} className="p-1.5 rounded text-n-500 hover:text-ocean-700 hover:bg-white transition-colors" title={t('loyaltyPage.points.copyCode')} aria-label={t('loyaltyPage.points.copyCode')}>
                {copied ? <CheckIcon size={14} strokeWidth={2} className="text-[var(--success)]" /> : <Copy size={14} strokeWidth={1.75} />}
              </button>
            </div>
            <p className="text-xs font-body text-n-500">{t('loyaltyPage.points.singleUse', { date: formatarData(new Date(redeemedVoucher.expires_at), { timeZone: 'UTC' }, lang) })}</p>
          </div>
        ) : (
          <div className="p-3 bg-sand-50 border border-sand-100 rounded-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-body font-semibold text-n-700 flex items-center gap-1.5">
                  <Gift size={13} strokeWidth={1.75} /> {t('loyaltyPage.points.redeemTier', { level: rotuloNivel(currentLevel.name, t) })}
                </p>
                <p className="text-xs font-body text-n-500 truncate">{t('loyaltyPage.points.redeemHelp', { pct: currentLevel.discount_pct })}</p>
              </div>
              <Button size="sm" variant="secondary" loading={redeeming} disabled={current <= 0} onClick={handleRedeem} className="shrink-0">
                {t('loyaltyPage.points.redeem')}
              </Button>
            </div>
          </div>
        )}

        <div className="flex gap-1 bg-n-100 rounded-sm p-0.5">
          {[{ v: 'add', l: t('loyaltyPage.points.add') }, { v: 'remove', l: t('loyaltyPage.points.remove') }].map(o => (
            <button key={o.v} type="button" aria-pressed={mode === o.v} onClick={() => setMode(o.v)}
              className={`flex-1 py-1.5 text-xs font-body font-semibold rounded-xs transition-colors ${mode === o.v ? 'bg-white text-ocean-700 shadow-sm' : 'text-n-500 hover:text-n-700'}`}>
              {o.l}
            </button>
          ))}
        </div>

        <Input
          label={t('loyaltyPage.points.amount')} aria-label={t('loyaltyPage.points.amount')}
          type="number" min="1" step="1"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder={t('loyaltyPage.points.amountPlaceholder')}
        />

        <Input
          label={t('loyaltyPage.points.reason')} aria-label={t('loyaltyPage.points.reason')}
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder={t('loyaltyPage.points.reasonPlaceholder')}
        />

        {Number(amount) > 0 && (
          <div className="p-3 bg-ocean-50 border border-ocean-100 rounded-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-body text-n-600">{t('loyaltyPage.points.result')}</span>
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-ocean-700">{formatarNumero(preview, {}, lang)} {t('loyaltyPage.points.pts')}</span>
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
          <Button variant="secondary" onClick={onClose} className="flex-1">{t('loyaltyPage.points.close')}</Button>
          <Button icon={Save} loading={saving} onClick={handleSave} className="flex-1">{t('loyaltyPage.points.saveAdjust')}</Button>
        </div>

        <div className="pt-2 border-t border-n-100">
          <p className="text-xs font-body font-bold uppercase tracking-wide text-n-500 mb-2 flex items-center gap-1.5">
            <Clock size={12} strokeWidth={1.75} /> {t('loyaltyPage.points.history')}
          </p>
          <HistoryList customerId={customer.id} refreshKey={historyKey} />
        </div>
      </div>
    </Modal>
  );
}

/* ── LevelCard ── */
function LevelCard({ level, index, onUpdate, totalCustomers }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ ...level });
  const s = LEVEL_STYLE[level.name] || LEVEL_STYLE.Bronze;
  const nome = rotuloNivel(level.name, t);

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
            <span className="font-display font-semibold text-sm text-n-900">{nome}</span>
            <LevelBadge name={level.name} />
          </div>
          <p className="text-xs font-body text-n-500 mt-0.5">
            {t('loyaltyPage.level.range', { min: level.min, max: level.max != null ? level.max : '∞', pct: level.discount_pct })}
          </p>
        </div>
        {open ? <ChevronUp size={16} strokeWidth={1.75} className="text-n-400 shrink-0" /> : <ChevronDown size={16} strokeWidth={1.75} className="text-n-400 shrink-0" />}
      </div>

      {open && (
        <div className="border-t border-n-100 px-4 py-4 space-y-3 bg-n-50">
          <Input
            label={t('loyaltyPage.level.discountPct')} aria-label={t('loyaltyPage.level.discountPct')}
            type="number" min="0" max="100" step="1"
            value={draft.discount_pct}
            onChange={e => setDraft(p => ({ ...p, discount_pct: Number(e.target.value) }))}
          />
          <Input
            label={t('loyaltyPage.level.rewardDesc')} aria-label={t('loyaltyPage.level.rewardDesc')}
            value={draft.reward}
            onChange={e => setDraft(p => ({ ...p, reward: e.target.value }))}
          />
          {index < 2 && (
            <Input
              label={t('loyaltyPage.level.maxPoints', { level: nome })} aria-label={t('loyaltyPage.level.maxPoints', { level: nome })}
              type="number" min="1"
              value={draft.max ?? ''}
              onChange={e => setDraft(p => ({ ...p, max: e.target.value ? Number(e.target.value) : null }))}
            />
          )}
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" size="sm" onClick={() => { setDraft({ ...level }); setOpen(false); }} className="flex-1">
              {t('loyaltyPage.level.cancel')}
            </Button>
            <Button size="sm" icon={Save} onClick={handleSave} className="flex-1">
              {t('loyaltyPage.level.save')}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ── Main ── */
export default function Loyalty() {
  const t = useT();
  const lang = useLingua();
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
      key: 'name', label: t('loyaltyPage.columns.customer'),
      render: c => (
        <span className="font-body font-semibold text-n-900 whitespace-nowrap">
          {c.name}
          {c === sorted[0] && Number(c.loyalty_points || 0) > 0 && (
            <Star size={11} strokeWidth={2} className="inline ml-1 text-sand-500 fill-sand-400" />
          )}
        </span>
      ),
    },
    { key: 'email', label: t('loyaltyPage.columns.email'), render: c => <span className="text-xs text-n-500">{c.email || '—'}</span> },
    { key: 'visits', label: t('loyaltyPage.columns.visits'), align: 'center', render: c => <span className="font-mono text-n-600">{c.total_visits ?? 0}</span> },
    {
      key: 'points', label: t('loyaltyPage.columns.points'),
      render: c => (
        <span className="font-display font-bold text-ocean-700 whitespace-nowrap">
          {formatarNumero(Number(c.loyalty_points || 0), {}, lang)} {t('loyaltyPage.points.pts')}
        </span>
      ),
    },
    { key: 'level', label: t('loyaltyPage.columns.tier'), render: c => <LevelBadge name={getLevel(c.loyalty_points, config.levels).name} /> },
    {
      key: 'reward', label: t('loyaltyPage.columns.reward'),
      render: c => <span className="text-xs font-body text-n-500 max-w-[160px] truncate block">{getLevel(c.loyalty_points, config.levels).reward}</span>,
    },
    {
      key: 'acoes', label: '',
      render: c => (
        <button type="button" onClick={() => setEditingCustomer(c)} aria-label={t('loyaltyPage.adjustAria', { name: c.name })}
          className="p-1.5 rounded text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors">
          <Edit2 size={13} strokeWidth={1.75} />
        </button>
      ),
    },
  ];

  if (configLoading) {
    return (
      <div>
        <PageHeader title={t('loyaltyPage.title')} subtitle={t('loyaltyPage.subtitle')} />
        <div className="flex justify-center py-16"><LoadingSpinner size={32} /></div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t('loyaltyPage.title')}
        subtitle={t('loyaltyPage.subtitle')}
      />

      {/* Active toggle */}
      <div className={`flex items-center gap-4 px-4 py-3 rounded-md border border-n-200 mb-6 ${config.active ? 'bg-[var(--success-light)]' : 'bg-n-50'}`}>
        <button type="button" onClick={toggleActive} aria-pressed={config.active} aria-label={t('loyaltyPage.programAria')} className="shrink-0">
          {config.active
            ? <ToggleRight size={28} strokeWidth={1.5} className="text-[var(--success)]" />
            : <ToggleLeft  size={28} strokeWidth={1.5} className="text-n-400" />}
        </button>
        <div>
          <p className={`text-sm font-body font-semibold ${config.active ? 'text-[var(--success)]' : 'text-n-600'}`}>
            {config.active ? t('loyaltyPage.programActive') : t('loyaltyPage.programInactive')}
          </p>
          <p className="text-xs font-body text-n-400">
            {config.active ? t('loyaltyPage.activeHelp') : t('loyaltyPage.inactiveHelp')}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <Tabs
          tabs={[{ id: 'config', label: t('loyaltyPage.tabs.config') }, { id: 'clientes', label: t('loyaltyPage.tabs.customers') }]}
          value={activeTab}
          onChange={setActiveTab}
        />
      </div>

      {activeTab === 'config' && (
        <div className="space-y-5">
          {/* Points per euro */}
          <Card padding="px-5 py-5">
            <h3 className="font-display font-semibold text-sm text-n-700 mb-4">{t('loyaltyPage.earning.title')}</h3>
            <div className="flex items-end gap-4 max-w-xs">
              <Input
                label={t('loyaltyPage.earning.pointsPerEuro')} aria-label={t('loyaltyPage.earning.pointsPerEuro')}
                type="number" min="0.1" step="0.1"
                value={config.points_per_euro}
                onChange={e => persistConfig({ ...config, points_per_euro: Number(e.target.value) })}
              />
              <p className="text-xs font-body text-n-500 pb-2 whitespace-nowrap">{t('loyaltyPage.earning.unit')}</p>
            </div>
            <p className="text-xs font-body text-n-400 mt-2">
              {t('loyaltyPage.earning.example', { n: Math.round(100 * config.points_per_euro) })}
            </p>
          </Card>

          {/* Levels */}
          <Card padding="px-5 py-5">
            <h3 className="font-display font-semibold text-sm text-n-700 mb-4">{t('loyaltyPage.tiers.title')}</h3>
            <div className="space-y-3">
              {config.levels.map((l, i) => (
                <LevelCard key={l.name} level={l} index={i} onUpdate={updateLevel} totalCustomers={customers.length} />
              ))}
            </div>
            <p className="text-xs font-body text-n-400 mt-3">
              {t('loyaltyPage.tiers.note')}
            </p>
          </Card>
        </div>
      )}

      {activeTab === 'clientes' && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: t('loyaltyPage.stats.total'),           value: stats.total,  color: 'text-n-900'               },
              { label: rotuloNivel('Bronze', t),               value: stats.bronze, color: LEVEL_STYLE.Bronze.text    },
              { label: rotuloNivel('Prata', t),                value: stats.prata,  color: LEVEL_STYLE.Prata.text     },
              { label: rotuloNivel('Ouro', t),                 value: stats.ouro,   color: LEVEL_STYLE.Ouro.text      },
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
                placeholder={t('loyaltyPage.searchPlaceholder')} aria-label={t('loyaltyPage.searchAria')}
              />
            </div>
            <FilterChips
              options={[
                { value: '', label: t('loyaltyPage.all') },
                { value: 'Bronze', label: rotuloNivel('Bronze', t) },
                { value: 'Prata', label: rotuloNivel('Prata', t) },
                { value: 'Ouro', label: rotuloNivel('Ouro', t) },
              ]}
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
                <EmptyState icon={Users} title={t('loyaltyPage.emptyCustomers')} />
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
