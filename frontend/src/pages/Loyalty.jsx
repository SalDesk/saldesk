import { useState, useEffect, useCallback } from 'react';
import PlanGuard from '../components/PlanGuard';
import {
  Award, Users, Gift, Edit2, Save, ToggleLeft, ToggleRight,
  Plus, Minus, ChevronDown, ChevronUp, Star,
} from 'lucide-react';
import { listCustomers, updateCustomer } from '../services/customersService';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import Input, { Select } from '../components/ui/Input';
import LoadingSpinner from '../components/shared/LoadingSpinner';

/* ── localStorage ── */
const CONFIG_KEY = 'saldesk_loyalty_config_v1';

const DEFAULT_CONFIG = {
  active: false,
  points_per_euro: 1,
  levels: [
    { name: 'Bronze', min: 0,   max: 100, discount_pct: 5,  reward: '5% desconto em todas as reservas'          },
    { name: 'Prata',  min: 101, max: 499, discount_pct: 10, reward: '10% desconto + upgrade gratuito disponivel' },
    { name: 'Ouro',   min: 500, max: null, discount_pct: 15, reward: '15% desconto + tour gratuito por ano'       },
  ],
};

const LEVEL_COLORS = {
  Bronze: { bg: '#FDF3E7', text: '#92400E', border: '#FCD5A1' },
  Prata:  { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' },
  Ouro:   { bg: '#FFF7E6', text: '#92400E', border: '#FCD34D' },
};

function loadConfig() {
  try { return { ...DEFAULT_CONFIG, ...JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}') }; }
  catch { return DEFAULT_CONFIG; }
}
function saveConfig(c) { localStorage.setItem(CONFIG_KEY, JSON.stringify(c)); }

/* ── Helpers ── */
function getLevel(points, levels) {
  const pts = Number(points || 0);
  return [...levels].sort((a, b) => b.min - a.min).find(l => pts >= l.min) || levels[0];
}

function LevelBadge({ name }) {
  const c = LEVEL_COLORS[name] || LEVEL_COLORS.Bronze;
  return (
    <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-xs border"
      style={{ color: c.text, backgroundColor: c.bg, borderColor: c.border }}>
      {name}
    </span>
  );
}

/* ── Points Modal ── */
function PointsModal({ customer, config, onClose, onSave }) {
  const current = Number(customer?.loyalty_points || 0);
  const [mode,   setMode]   = useState('add');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  async function handleSave() {
    const delta = Number(amount);
    if (!delta || delta <= 0) { setError('Introduza um valor valido.'); return; }
    setSaving(true);
    setError('');
    const newPts = Math.max(0, mode === 'add' ? current + delta : current - delta);
    try {
      await onSave(customer.id, newPts);
      onClose();
    } catch { setError('Erro ao actualizar pontos.'); }
    finally { setSaving(false); }
  }

  const preview = Number(amount) > 0
    ? Math.max(0, mode === 'add' ? current + Number(amount) : current - Number(amount))
    : current;

  const currentLevel = getLevel(current, config.levels);
  const previewLevel = getLevel(preview, config.levels);

  return (
    <Modal open onClose={onClose} title={`Pontos — ${customer?.first_name} ${customer?.last_name}`} size="sm">
      <div className="space-y-4">
        <div className="flex items-center justify-between p-3 bg-n-50 rounded-sm border border-n-200">
          <div>
            <p className="text-xs font-body text-n-500">Pontos actuais</p>
            <p className="font-display font-bold text-2xl text-n-900">{current.toLocaleString('pt-PT')}</p>
          </div>
          <LevelBadge name={currentLevel.name} />
        </div>

        <div className="flex gap-1 bg-n-100 rounded-sm p-0.5">
          {[{ v: 'add', l: 'Adicionar' }, { v: 'remove', l: 'Remover' }].map(o => (
            <button key={o.v} onClick={() => setMode(o.v)}
              className={`flex-1 py-1.5 text-xs font-body font-semibold rounded-xs transition-colors ${mode === o.v ? 'bg-white text-ocean-700 shadow-sm' : 'text-n-500 hover:text-n-700'}`}>
              {o.l}
            </button>
          ))}
        </div>

        <Input
          label="Quantidade de pontos"
          type="number" min="1" step="1"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="Ex: 50"
        />

        <Input
          label="Motivo (opcional)"
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

        {error && <p className="text-xs text-error">{error}</p>}

        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button icon={Save} loading={saving} onClick={handleSave} className="flex-1">Guardar</Button>
        </div>
      </div>
    </Modal>
  );
}

/* ── LevelCard ── */
function LevelCard({ level, index, onUpdate, totalCustomers }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ ...level });
  const c = LEVEL_COLORS[level.name] || LEVEL_COLORS.Bronze;

  function handleSave() {
    onUpdate(index, draft);
    setOpen(false);
  }

  return (
    <div className="bg-white rounded-md border border-n-200 overflow-hidden">
      <div className="flex items-center gap-4 px-4 py-3 cursor-pointer select-none" onClick={() => setOpen(p => !p)}>
        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: c.bg, border: `1px solid ${c.border}` }}>
          <Award size={16} strokeWidth={1.75} style={{ color: c.text }} />
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
            label="Desconto (%)"
            type="number" min="0" max="100" step="1"
            value={draft.discount_pct}
            onChange={e => setDraft(p => ({ ...p, discount_pct: Number(e.target.value) }))}
          />
          <Input
            label="Descricao da recompensa"
            value={draft.reward}
            onChange={e => setDraft(p => ({ ...p, reward: e.target.value }))}
          />
          {index < 2 && (
            <Input
              label={`Pontos maximo (nivel ${level.name})`}
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
    </div>
  );
}

/* ── Main ── */
export default function Loyalty() {
  const [activeTab,  setActiveTab]  = useState('config');
  const [config,     setConfig]     = useState(loadConfig);
  const [customers,  setCustomers]  = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [search,     setSearch]     = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [editingCustomer, setEditingCustomer] = useState(null);

  useEffect(() => {
    if (activeTab === 'clientes') {
      setLoading(true);
      listCustomers({}).then(d => setCustomers(d || [])).catch(() => {}).finally(() => setLoading(false));
    }
  }, [activeTab]);

  function persistConfig(next) {
    setConfig(next);
    saveConfig(next);
  }

  function toggleActive() {
    persistConfig({ ...config, active: !config.active });
  }

  function updateLevel(index, updated) {
    const levels = config.levels.map((l, i) => i === index ? { ...l, ...updated } : l);
    persistConfig({ ...config, levels });
  }

  const handleUpdatePoints = useCallback(async (customerId, newPoints) => {
    await updateCustomer(customerId, { loyalty_points: newPoints });
    setCustomers(prev => prev.map(c => c.id === customerId ? { ...c, loyalty_points: newPoints } : c));
  }, []);

  const filtered = customers.filter(c => {
    if (search) {
      const q = search.toLowerCase();
      if (!`${c.first_name} ${c.last_name}`.toLowerCase().includes(q) && !(c.email || '').toLowerCase().includes(q)) return false;
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

  return (
    <div>
      <PageHeader
        title="Programa de Fidelidade"
        subtitle="Configure niveis, pontos e recompensas"
      />

      {/* Active toggle */}
      <div className={`flex items-center gap-4 px-4 py-3 rounded-md border mb-6 ${config.active ? 'bg-[#ECFDF5] border-green-200' : 'bg-n-50 border-n-200'}`}>
        <button onClick={toggleActive} className="shrink-0">
          {config.active
            ? <ToggleRight size={28} strokeWidth={1.5} className="text-[#1A7A4A]" />
            : <ToggleLeft  size={28} strokeWidth={1.5} className="text-n-400" />}
        </button>
        <div>
          <p className={`text-sm font-body font-semibold ${config.active ? 'text-[#1A7A4A]' : 'text-n-600'}`}>
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
      <div className="flex gap-1 border-b border-n-200 mb-6">
        {[{ key: 'config', label: 'Configuracao', Icon: Award }, { key: 'clientes', label: 'Clientes', Icon: Users }].map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-body font-semibold border-b-2 -mb-px transition-colors ${
              activeTab === key ? 'border-ocean-700 text-ocean-700' : 'border-transparent text-n-500 hover:text-n-700'
            }`}>
            <Icon size={15} strokeWidth={1.75} />{label}
          </button>
        ))}
      </div>

      {activeTab === 'config' && (
        <div className="space-y-5">
          {/* Points per euro */}
          <Card padding="px-5 py-5">
            <h3 className="font-display font-semibold text-sm text-n-700 mb-4">Regra de acumulacao</h3>
            <div className="flex items-end gap-4 max-w-xs">
              <Input
                label="Pontos por Euro gasto"
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
              { label: 'Total clientes',   value: stats.total,  color: 'text-n-900'         },
              { label: 'Bronze',           value: stats.bronze, color: 'text-[#92400E]'     },
              { label: 'Prata',            value: stats.prata,  color: 'text-[#475569]'     },
              { label: 'Ouro',             value: stats.ouro,   color: 'text-[#D4A82A]'     },
            ].map(m => (
              <div key={m.label} className="bg-white rounded-md border border-n-200 px-4 py-3 flex items-center gap-3">
                <Award size={18} strokeWidth={1.75} className="text-n-300 shrink-0" />
                <div>
                  <p className={`font-display font-bold text-xl ${m.color}`}>{m.value}</p>
                  <p className="text-xs font-body text-n-500">{m.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Search + filter */}
          <div className="flex flex-wrap gap-3">
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Pesquisar cliente..."
              className="h-9 px-3 text-sm font-body border border-n-200 rounded-sm bg-white placeholder:text-n-400 focus:outline-none focus:border-ocean-700 flex-1 min-w-[180px]"
            />
            <div className="flex gap-1">
              {['', 'Bronze', 'Prata', 'Ouro'].map(l => (
                <button key={l} onClick={() => setFilterLevel(l)}
                  className={`px-3 py-1.5 rounded-sm text-xs font-body font-semibold transition-colors ${filterLevel === l ? 'bg-ocean-700 text-white' : 'bg-white border border-n-200 text-n-600 hover:border-ocean-300'}`}>
                  {l || 'Todos'}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex justify-center py-16"><LoadingSpinner size={32} /></div>
          ) : (
            <Card padding="p-0">
              {sorted.length === 0 ? (
                <div className="text-center py-12">
                  <Users size={32} strokeWidth={1.25} className="mx-auto mb-3 text-n-300" />
                  <p className="text-sm font-body text-n-400">Sem clientes encontrados.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-n-200">
                        {['Cliente', 'Email', 'Visitas', 'Pontos', 'Nivel', 'Recompensa', ''].map(h => (
                          <th key={h} className="text-left py-2.5 px-4 text-xs font-mono uppercase tracking-wider text-n-500 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-n-100">
                      {sorted.map((c, i) => {
                        const level = getLevel(c.loyalty_points, config.levels);
                        const pts   = Number(c.loyalty_points || 0);
                        const isTop = i === 0 && pts > 0;
                        return (
                          <tr key={c.id} className={`hover:bg-n-50 transition-colors ${isTop ? 'bg-[#FFF7E6]' : ''}`}>
                            <td className="py-3 px-4 font-body font-semibold text-n-900 whitespace-nowrap">
                              {c.first_name} {c.last_name}
                              {isTop && <Star size={11} strokeWidth={2} className="inline ml-1 text-sand-500 fill-sand-400" />}
                            </td>
                            <td className="py-3 px-4 text-n-500 text-xs">{c.email || '—'}</td>
                            <td className="py-3 px-4 font-mono text-n-600 text-center">{c.total_visits ?? 0}</td>
                            <td className="py-3 px-4 font-display font-bold text-ocean-700 whitespace-nowrap">
                              {pts.toLocaleString('pt-PT')} pts
                            </td>
                            <td className="py-3 px-4"><LevelBadge name={level.name} /></td>
                            <td className="py-3 px-4 text-xs font-body text-n-500 max-w-[160px] truncate">{level.reward}</td>
                            <td className="py-3 px-4">
                              <button onClick={() => setEditingCustomer(c)}
                                className="p-1.5 rounded text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors">
                                <Edit2 size={13} strokeWidth={1.75} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
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
          onSave={handleUpdatePoints}
        />
      )}
    </div>
  );
}
