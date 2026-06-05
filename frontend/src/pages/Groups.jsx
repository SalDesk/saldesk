import { useState, useEffect } from 'react';
import PlanGuard from '../components/PlanGuard';
import {
  Users2, Plus, Pencil, Trash2, ChevronDown, ChevronUp,
  Building2, Euro, CalendarDays, FileText, Check,
} from 'lucide-react';
import { listUnits } from '../services/unitsService';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import Input, { Textarea, Select } from '../components/ui/Input';

const STORAGE_KEY = 'saldesk_groups_v1';
function load() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } }
function persist(v) { localStorage.setItem(STORAGE_KEY, JSON.stringify(v)); }

const EVENT_TYPES = [
  { value: 'team_building', label: 'Team Building'      },
  { value: 'incentivo',     label: 'Viagem de Incentivo' },
  { value: 'turismo',       label: 'Turismo de Grupo'   },
  { value: 'casamento',     label: 'Casamento / Evento' },
  { value: 'outro',         label: 'Outro'              },
];

const STATUSES = [
  { value: 'pedido',           label: 'Pedido',           cls: 'bg-n-100 text-n-600 border-n-200'                },
  { value: 'em_analise',       label: 'Em analise',       cls: 'bg-yellow-50 text-yellow-700 border-yellow-200'  },
  { value: 'proposta_enviada', label: 'Proposta enviada', cls: 'bg-ocean-50 text-ocean-700 border-ocean-100'     },
  { value: 'confirmado',       label: 'Confirmado',       cls: 'bg-[#ECFDF5] text-[#1A7A4A] border-[#BBF7D0]'   },
  { value: 'concluido',        label: 'Concluido',        cls: 'bg-n-100 text-n-500 border-n-200'                },
  { value: 'cancelado',        label: 'Cancelado',        cls: 'bg-red-50 text-error border-red-100'             },
];

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00Z').toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ── GroupModal ── */
function GroupModal({ group, units, onSave, onClose }) {
  const isNew = !group || group._new;
  const base  = isNew ? null : group;

  const [form, setForm] = useState({
    company:       base?.company       || '',
    event_type:    base?.event_type    || 'team_building',
    tour_ids:      base?.tour_ids      || [],
    date:          base?.date          || '',
    guests:        base?.guests        || '',
    budget:        base?.budget        || '',
    notes:         base?.notes         || '',
    discount_pct:  base?.discount_pct  || '',
    signal_pct:    base?.signal_pct    || 30,
    days_before:   base?.days_before   || 7,
    proposal_expires: base?.proposal_expires || '',
    status:        base?.status        || 'pedido',
  });

  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));

  function toggleTour(id) {
    setForm(p => ({
      ...p,
      tour_ids: p.tour_ids.includes(id)
        ? p.tour_ids.filter(x => x !== id)
        : [...p.tour_ids, id],
    }));
  }

  const basePrice = form.tour_ids
    .map(id => Number(units.find(u => u.id === id)?.base_price || 0))
    .reduce((s, p) => s + p, 0);

  const groupPrice = basePrice > 0 && form.discount_pct
    ? basePrice * (1 - Number(form.discount_pct) / 100) * Number(form.guests || 1)
    : basePrice * Number(form.guests || 1);

  function handleSubmit(e) {
    e.preventDefault();
    onSave({
      ...base,
      ...form,
      guests:       Number(form.guests),
      budget:       form.budget ? Number(form.budget) : 0,
      discount_pct: form.discount_pct ? Number(form.discount_pct) : 0,
      signal_pct:   Number(form.signal_pct),
      days_before:  Number(form.days_before),
      payments:     base?.payments || [],
      id:      base?.id || Date.now().toString(),
      created_at: base?.created_at || new Date().toISOString(),
    });
  }

  return (
    <Modal open onClose={onClose} title={isNew ? 'Nova cotacao de grupo' : 'Editar cotacao'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Empresa / Grupo" value={form.company} onChange={set('company')} required placeholder="Ex: Empresa ABC" />
          <Select label="Tipo de evento" value={form.event_type} onChange={set('event_type')}>
            {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Data pretendida" type="date" value={form.date} onChange={set('date')} required />
          <Input label="Numero de pessoas" type="number" min="1" value={form.guests} onChange={set('guests')} required placeholder="Ex: 20" />
        </div>

        {/* Tours */}
        <div>
          <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600 block mb-2">
            Tours pretendidos ({form.tour_ids.length} seleccionado(s))
          </label>
          {units.length === 0 ? (
            <p className="text-xs font-body text-n-400">Sem tours disponiveis.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {units.map(u => (
                <button key={u.id} type="button" onClick={() => toggleTour(u.id)}
                  className={`text-xs px-3 py-1.5 rounded-sm border font-body transition-colors ${
                    form.tour_ids.includes(u.id)
                      ? 'bg-ocean-700 text-white border-ocean-700'
                      : 'bg-white text-n-600 border-n-200 hover:border-ocean-300'
                  }`}>
                  {u.name}{u.base_price > 0 ? ` — €${u.base_price}/pax` : ''}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Desconto de grupo (%)" type="number" min="0" max="50" step="1"
            value={form.discount_pct} onChange={set('discount_pct')} placeholder="Ex: 15" />
          <Input label="Orcamento estimado (€)" type="number" min="0"
            value={form.budget} onChange={set('budget')} placeholder="Orcamento do cliente" />
        </div>

        {groupPrice > 0 && (
          <div className="px-3 py-2 bg-ocean-50 border border-ocean-100 rounded-sm">
            <p className="text-xs font-body text-ocean-700">
              Preco estimado c/ desconto: <span className="font-bold">€{groupPrice.toFixed(0)}</span>
              {' '}({form.guests} pax × {form.discount_pct || 0}% desconto)
            </p>
          </div>
        )}

        {/* Payment conditions */}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Sinal (%)" type="number" min="0" max="100"
            value={form.signal_pct} onChange={set('signal_pct')} hint="Percentagem a pagar como sinal" />
          <Input label="Restante X dias antes" type="number" min="1"
            value={form.days_before} onChange={set('days_before')} hint="Dias antes do evento para pagamento" />
        </div>

        <Input label="Validade da proposta" type="date" value={form.proposal_expires} onChange={set('proposal_expires')} />

        <Textarea label="Notas especiais" value={form.notes} onChange={set('notes')} rows={3}
          placeholder="Necessidades especiais, alergias, preferencias do grupo..." />

        {!isNew && (
          <Select label="Estado" value={form.status} onChange={set('status')}>
            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
        )}

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button type="submit" className="flex-1">{isNew ? 'Criar cotacao' : 'Guardar'}</Button>
        </div>
      </form>
    </Modal>
  );
}

/* ── PaymentModal ── */
function PaymentModal({ group, onSave, onClose }) {
  const [amount, setAmount] = useState('');
  const [date,   setDate]   = useState(new Date().toISOString().slice(0, 10));
  const [note,   setNote]   = useState('Sinal');

  const totalPaid = (group.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);

  function handleSave() {
    if (!amount || Number(amount) <= 0) return;
    onSave(group.id, { amount: Number(amount), date, note });
    onClose();
  }

  return (
    <Modal open onClose={onClose} title={`Pagamento — ${group.company}`} size="sm">
      <div className="space-y-4">
        <div className="px-3 py-2 bg-n-50 border border-n-200 rounded-sm">
          <p className="text-xs font-body text-n-500">Total pago ate agora: <span className="font-bold text-n-700">€{totalPaid.toFixed(2)}</span></p>
        </div>
        <Input label="Montante recebido (€)" type="number" min="0.01" step="0.01"
          value={amount} onChange={e => setAmount(e.target.value)} required />
        <Input label="Data" type="date" value={date} onChange={e => setDate(e.target.value)} />
        <Input label="Descricao" value={note} onChange={e => setNote(e.target.value)} placeholder="Ex: Sinal, Pagamento final..." />
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button onClick={handleSave} className="flex-1">Registar</Button>
        </div>
      </div>
    </Modal>
  );
}

/* ── GroupCard ── */
function GroupCard({ group, units, onEdit, onDelete, onPayment, onStatusChange }) {
  const [open, setOpen] = useState(false);
  const sc = STATUSES.find(s => s.value === group.status) || STATUSES[0];
  const tours = (group.tour_ids || []).map(id => units.find(u => u.id === id)).filter(Boolean);
  const totalPaid = (group.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);

  const nextStatus = {
    pedido: 'em_analise',
    em_analise: 'proposta_enviada',
    proposta_enviada: 'confirmado',
    confirmado: 'concluido',
  }[group.status];

  return (
    <div className="bg-white border border-n-200 rounded-md overflow-hidden">
      <div className="px-4 py-3 flex items-start gap-3 cursor-pointer" onClick={() => setOpen(p => !p)}>
        <Building2 size={16} strokeWidth={1.75} className="text-n-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-display font-semibold text-sm text-n-900 truncate">{group.company}</p>
          <p className="text-xs font-body text-n-500 mt-0.5">
            {EVENT_TYPES.find(e => e.value === group.event_type)?.label || '—'}
            {' · '}{group.guests} pax
            {group.date ? ` · ${fmtDate(group.date)}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-mono px-2 py-0.5 rounded-xs border ${sc.cls}`}>{sc.label}</span>
          {open ? <ChevronUp size={14} strokeWidth={1.75} className="text-n-400" /> : <ChevronDown size={14} strokeWidth={1.75} className="text-n-400" />}
        </div>
      </div>

      {open && (
        <div className="border-t border-n-100 px-4 py-4 space-y-4 bg-n-50">
          {/* Tours */}
          {tours.length > 0 && (
            <div>
              <p className="text-xs font-mono uppercase tracking-wider text-n-500 mb-2">Tours pretendidos</p>
              <div className="flex flex-wrap gap-1.5">
                {tours.map(t => (
                  <span key={t.id} className="text-xs bg-white border border-n-200 px-2 py-1 rounded-sm font-body text-n-700">
                    {t.name}
                    {t.base_price > 0 && ` — €${t.base_price}/pax`}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Proposal conditions */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Desconto', value: group.discount_pct ? `${group.discount_pct}%` : '—' },
              { label: 'Sinal', value: `${group.signal_pct || 30}%` },
              { label: 'Pagamento final', value: `${group.days_before || 7}d antes` },
              { label: 'Proposta valida ate', value: fmtDate(group.proposal_expires) },
            ].map(m => (
              <div key={m.label}>
                <p className="text-[10px] font-mono text-n-400 uppercase tracking-wide">{m.label}</p>
                <p className="text-xs font-body text-n-700 font-semibold">{m.value}</p>
              </div>
            ))}
          </div>

          {/* Notes */}
          {group.notes && (
            <div>
              <p className="text-[10px] font-mono text-n-400 uppercase tracking-wide mb-1">Notas</p>
              <p className="text-xs font-body text-n-600">{group.notes}</p>
            </div>
          )}

          {/* Payments */}
          {(group.payments || []).length > 0 && (
            <div>
              <p className="text-[10px] font-mono text-n-400 uppercase tracking-wide mb-2">Pagamentos recebidos</p>
              <div className="space-y-1">
                {group.payments.map((p, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="font-body text-n-500">{fmtDate(p.date)} · {p.note}</span>
                    <span className="font-mono font-semibold text-[#1A7A4A]">€{Number(p.amount).toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-xs pt-1 border-t border-n-200 mt-1">
                  <span className="font-body font-semibold text-n-700">Total pago</span>
                  <span className="font-mono font-semibold text-n-800">€{totalPaid.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-1">
            {nextStatus && (
              <Button size="sm" variant="secondary" icon={Check}
                onClick={() => onStatusChange(group.id, nextStatus)}>
                Avancar para: {STATUSES.find(s => s.value === nextStatus)?.label}
              </Button>
            )}
            <Button size="sm" variant="secondary" icon={Euro}
              onClick={() => onPayment(group)}>
              Registar pagamento
            </Button>
            <Button size="sm" variant="secondary" icon={FileText}
              onClick={() => window.print()}>
              Imprimir proposta
            </Button>
            <button onClick={() => onEdit(group)}
              className="p-1.5 rounded text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors">
              <Pencil size={13} strokeWidth={1.75} />
            </button>
            <button onClick={() => onDelete(group.id)}
              className="p-1.5 rounded text-n-400 hover:text-error hover:bg-red-50 transition-colors">
              <Trash2 size={13} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────── Main ─────────────────────── */
export default function Groups() {
  const [groups,      setGroups]      = useState(load);
  const [units,       setUnits]       = useState([]);
  const [modal,       setModal]       = useState(null);
  const [payModal,    setPayModal]    = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [search,      setSearch]      = useState('');

  useEffect(() => { listUnits().then(d => setUnits(d || [])).catch(() => {}); }, []);

  function handleSave(g) {
    setGroups(prev => {
      const next = prev.find(x => x.id === g.id)
        ? prev.map(x => x.id === g.id ? g : x)
        : [...prev, g];
      persist(next); return next;
    });
    setModal(null);
  }

  function handleDelete(id) {
    if (!window.confirm('Eliminar esta cotacao?')) return;
    setGroups(prev => { const next = prev.filter(g => g.id !== id); persist(next); return next; });
  }

  function handlePayment(groupId, payment) {
    setGroups(prev => {
      const next = prev.map(g => {
        if (g.id !== groupId) return g;
        return { ...g, payments: [...(g.payments || []), payment] };
      });
      persist(next); return next;
    });
  }

  function handleStatusChange(id, newStatus) {
    setGroups(prev => {
      const next = prev.map(g => g.id === id ? { ...g, status: newStatus } : g);
      persist(next); return next;
    });
  }

  const filtered = groups.filter(g => {
    if (filterStatus && g.status !== filterStatus) return false;
    if (search && !g.company.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  const kpis = {
    total:      groups.length,
    confirmados: groups.filter(g => g.status === 'confirmado').length,
    pax:        groups.filter(g => ['confirmado', 'concluido'].includes(g.status)).reduce((s, g) => s + (g.guests || 0), 0),
  };

  return (
    <div>
      <PageHeader
        title="Grupos e Eventos Corporativos"
        subtitle="Cotacoes e propostas para grupos e empresas"
        actions={<Button icon={Plus} onClick={() => setModal({ _new: true })}>Nova cotacao</Button>}
      />

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Total cotacoes',   value: kpis.total,       color: 'text-n-900'     },
          { label: 'Confirmados',      value: kpis.confirmados, color: 'text-[#1A7A4A]' },
          { label: 'Pax confirmados',  value: kpis.pax,         color: 'text-ocean-700' },
        ].map(m => (
          <div key={m.label} className="bg-white border border-n-200 rounded-md px-4 py-3 flex items-center gap-3">
            <Users2 size={16} strokeWidth={1.75} className="text-n-300 shrink-0" />
            <div>
              <p className={`font-display font-bold text-xl ${m.color}`}>{m.value}</p>
              <p className="text-xs font-body text-n-500">{m.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Pesquisar empresa ou grupo..."
          className="h-9 px-3 text-sm font-body border border-n-200 rounded-sm bg-white placeholder:text-n-400 focus:outline-none focus:border-ocean-700 flex-1 min-w-[200px]"
        />
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setFilterStatus('')}
            className={`px-3 py-1.5 rounded-sm text-xs font-body font-semibold transition-colors ${!filterStatus ? 'bg-ocean-700 text-white' : 'bg-white border border-n-200 text-n-600 hover:border-ocean-300'}`}>
            Todos
          </button>
          {STATUSES.map(s => (
            <button key={s.value} onClick={() => setFilterStatus(s.value)}
              className={`px-3 py-1.5 rounded-sm text-xs font-body font-semibold border transition-colors ${filterStatus === s.value ? s.cls + ' border-current' : 'bg-white border-n-200 text-n-600 hover:border-ocean-300'}`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {sorted.length === 0 ? (
        <Card>
          <div className="text-center py-14">
            <Users2 size={36} strokeWidth={1.25} className="mx-auto mb-3 text-n-300" />
            <p className="font-display font-semibold text-n-700 mb-1">Sem cotacoes</p>
            <p className="text-sm font-body text-n-400 mb-4">
              {groups.length === 0
                ? 'Regista a primeira cotacao para grupo ou evento corporativo.'
                : 'Nenhuma cotacao corresponde aos filtros.'}
            </p>
            {groups.length === 0 && <Button icon={Plus} onClick={() => setModal({ _new: true })}>Nova cotacao</Button>}
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {sorted.map(g => (
            <GroupCard
              key={g.id}
              group={g}
              units={units}
              onEdit={setModal}
              onDelete={handleDelete}
              onPayment={setPayModal}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}

      {modal && <GroupModal group={modal} units={units} onSave={handleSave} onClose={() => setModal(null)} />}
      {payModal && (
        <PaymentModal
          group={payModal}
          onSave={(id, payment) => { handlePayment(id, payment); setPayModal(null); }}
          onClose={() => setPayModal(null)}
        />
      )}
    </div>
  );
}
