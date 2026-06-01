import { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle, Plus, Pencil, Trash2, Clock,
  CloudRain, MessageSquare, Zap, MoreHorizontal,
  FileWarning, Filter, Download,
} from 'lucide-react';
import { listStaff } from '../services/staffService';
import { listUnits } from '../services/unitsService';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import Input, { Textarea, Select } from '../components/ui/Input';

/* ── localStorage ── */
const STORAGE_KEY = 'saldesk_occurrences_v1';
function load() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } }
function persist(v) { localStorage.setItem(STORAGE_KEY, JSON.stringify(v)); }

/* ── Constants ── */
const TYPES = [
  { value: 'acidente',   label: 'Acidente',   Icon: AlertTriangle, color: '#B91C1C' },
  { value: 'atraso',     label: 'Atraso',     Icon: Clock,         color: '#D97706' },
  { value: 'reclamacao', label: 'Reclamacao', Icon: MessageSquare, color: '#7C3AED' },
  { value: 'incidente',  label: 'Incidente',  Icon: Zap,           color: '#0D5470' },
  { value: 'mau_tempo',  label: 'Mau tempo',  Icon: CloudRain,     color: '#1480A8' },
  { value: 'outro',      label: 'Outro',      Icon: MoreHorizontal, color: '#6B7280' },
];

const SEVERITIES = [
  { value: 'baixa',   label: 'Baixa',   cls: 'text-[#1A7A4A] bg-[#ECFDF5] border-[#BBF7D0]'   },
  { value: 'media',   label: 'Media',   cls: 'text-yellow-700 bg-yellow-50 border-yellow-200'  },
  { value: 'alta',    label: 'Alta',    cls: 'text-orange-700 bg-orange-50 border-orange-200'  },
  { value: 'critica', label: 'Critica', cls: 'text-error bg-red-50 border-red-200'             },
];

const MONTHS_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });
}

function TypeBadge({ typeKey }) {
  const t = TYPES.find(x => x.value === typeKey);
  if (!t) return <span className="text-xs font-mono text-n-500">{typeKey}</span>;
  return (
    <span className="flex items-center gap-1 text-xs font-body font-semibold" style={{ color: t.color }}>
      <t.Icon size={11} strokeWidth={1.75} />
      {t.label}
    </span>
  );
}

function SeverityBadge({ sev }) {
  const s = SEVERITIES.find(x => x.value === sev);
  if (!s) return null;
  return (
    <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded-xs border ${s.cls}`}>
      {s.label}
    </span>
  );
}

/* ── OccurrenceModal ── */
function OccurrenceModal({ occurrence, units, staff, onSave, onClose }) {
  const isNew = !occurrence || occurrence._new;
  const base  = isNew ? null : occurrence;

  const [form, setForm] = useState({
    unit_id:       base?.unit_id       || '',
    type:          base?.type          || 'incidente',
    severity:      base?.severity      || 'media',
    description:   base?.description   || '',
    staff_id:      base?.staff_id      || '',
    photo_urls:    base?.photo_urls    || '',
    actions_taken: base?.actions_taken || '',
    date:          base?.date          || new Date().toISOString().slice(0, 10),
  });

  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));

  function handleSubmit(e) {
    e.preventDefault();
    const unitName  = units.find(u => u.id === form.unit_id)?.name || '';
    const staffName = staff.find(s => s.id === form.staff_id)?.name || '';
    onSave({
      ...base,
      ...form,
      unit_name:  unitName,
      staff_name: staffName,
      id: base?.id || Date.now().toString(),
      created_at: base?.created_at || new Date().toISOString(),
    });
  }

  return (
    <Modal open onClose={onClose} title={isNew ? 'Registar ocorrencia' : 'Editar ocorrencia'} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Data da ocorrencia" type="date" value={form.date} onChange={set('date')} required />

        <div className="grid grid-cols-2 gap-3">
          <Select label="Tipo" value={form.type} onChange={set('type')} required>
            {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
          <Select label="Severidade" value={form.severity} onChange={set('severity')} required>
            {SEVERITIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
        </div>

        <Select label="Tour / Servico" value={form.unit_id} onChange={set('unit_id')}>
          <option value="">Nao associado a tour especifico</option>
          {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </Select>

        <Select label="Colaborador / Guia responsavel" value={form.staff_id} onChange={set('staff_id')}>
          <option value="">Nao especificado</option>
          {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>

        <Textarea label="Descricao da ocorrencia" value={form.description} onChange={set('description')} rows={3} required placeholder="Descreva o que aconteceu..." />

        <Textarea label="Accoes tomadas" value={form.actions_taken} onChange={set('actions_taken')} rows={3} placeholder="Descreva as accoes tomadas para resolver ou minimizar o impacto..." />

        <Input
          label="URLs de fotos (separadas por virgula)"
          value={form.photo_urls}
          onChange={set('photo_urls')}
          placeholder="https://exemplo.com/foto1.jpg, https://exemplo.com/foto2.jpg"
          hint="Opcional. Separe multiplas URLs por virgula."
        />

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button type="submit" className="flex-1">{isNew ? 'Registar' : 'Guardar'}</Button>
        </div>
      </form>
    </Modal>
  );
}

/* ── MonthlyReport ── */
function MonthlyReport({ occurrences }) {
  const now = new Date();
  const monthly = occurrences.filter(o => {
    const d = new Date(o.created_at || o.date);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });

  const byType = TYPES.map(t => ({
    ...t,
    count: monthly.filter(o => o.type === t.value).length,
  })).filter(t => t.count > 0);

  const bySev = SEVERITIES.map(s => ({
    ...s,
    count: monthly.filter(o => o.severity === s.value).length,
  })).filter(s => s.count > 0);

  return (
    <Card padding="px-5 py-5">
      <h3 className="font-display font-semibold text-sm text-n-700 mb-4">
        Relatorio mensal — {MONTHS_PT[now.getMonth()]} {now.getFullYear()}
      </h3>
      {monthly.length === 0 ? (
        <p className="text-xs font-body text-n-400">Sem ocorrencias registadas este mes.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-mono uppercase tracking-wider text-n-500 mb-3">Por tipo</p>
            <div className="space-y-2">
              {byType.map(t => (
                <div key={t.value} className="flex items-center gap-3">
                  <t.Icon size={13} strokeWidth={1.75} style={{ color: t.color }} className="shrink-0" />
                  <span className="text-xs font-body text-n-600 flex-1">{t.label}</span>
                  <span className="font-mono font-semibold text-xs text-n-800">{t.count}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-mono uppercase tracking-wider text-n-500 mb-3">Por severidade</p>
            <div className="space-y-2">
              {bySev.map(s => (
                <div key={s.value} className="flex items-center gap-3">
                  <span className={`text-xs font-mono px-1.5 py-0.5 rounded-xs border shrink-0 ${s.cls}`}>{s.label}</span>
                  <div className="flex-1 h-1.5 bg-n-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-ocean-400"
                      style={{ width: `${(s.count / monthly.length) * 100}%` }} />
                  </div>
                  <span className="font-mono font-semibold text-xs text-n-800 w-5 text-right">{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="mt-4 pt-3 border-t border-n-100 flex items-center justify-between">
        <p className="text-xs font-body text-n-500">Total: <span className="font-semibold">{monthly.length}</span> ocorrencia(s)</p>
      </div>
    </Card>
  );
}

/* ─────────────────────── Main ─────────────────────── */
export default function Occurrences() {
  const [occurrences, setOccurrences] = useState(load);
  const [units,       setUnits]       = useState([]);
  const [staff,       setStaff]       = useState([]);
  const [modal,       setModal]       = useState(null);
  const [filterType,  setFilterType]  = useState('');
  const [filterSev,   setFilterSev]   = useState('');
  const [search,      setSearch]      = useState('');

  useEffect(() => {
    listUnits().then(d => setUnits(d || [])).catch(() => {});
    listStaff().then(d => setStaff(d || [])).catch(() => {});
  }, []);

  /* Critical alert */
  const criticals = occurrences.filter(o => o.severity === 'critica' &&
    !o.resolved_at &&
    (Date.now() - new Date(o.created_at || o.date).getTime()) < 7 * 24 * 60 * 60 * 1000,
  );

  function handleSave(o) {
    setOccurrences(prev => {
      const next = prev.find(x => x.id === o.id)
        ? prev.map(x => x.id === o.id ? o : x)
        : [...prev, o];
      persist(next);
      return next;
    });
    setModal(null);
  }

  function handleDelete(id) {
    if (!window.confirm('Eliminar esta ocorrencia?')) return;
    setOccurrences(prev => { const next = prev.filter(o => o.id !== id); persist(next); return next; });
  }

  const filtered = useMemo(() => {
    return occurrences
      .filter(o => {
        if (filterType && o.type !== filterType) return false;
        if (filterSev  && o.severity !== filterSev) return false;
        if (search) {
          const q = search.toLowerCase();
          if (!(o.description || '').toLowerCase().includes(q) &&
              !(o.unit_name   || '').toLowerCase().includes(q) &&
              !(o.staff_name  || '').toLowerCase().includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date));
  }, [occurrences, filterType, filterSev, search]);

  /* KPI counts */
  const kpis = {
    total:   occurrences.length,
    alta:    occurrences.filter(o => ['alta', 'critica'].includes(o.severity)).length,
    critica: occurrences.filter(o => o.severity === 'critica').length,
    month:   occurrences.filter(o => {
      const d = new Date(o.created_at || o.date), n = new Date();
      return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth();
    }).length,
  };

  return (
    <div>
      <PageHeader
        title="Ocorrencias"
        subtitle="Registo e gestao de incidentes operacionais"
        actions={
          <Button icon={Plus} onClick={() => setModal({ _new: true })}>Registar ocorrencia</Button>
        }
      />

      {/* Critical alert */}
      {criticals.length > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-md mb-5">
          <AlertTriangle size={16} strokeWidth={1.75} className="text-error shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-body font-semibold text-error">
              {criticals.length} ocorrencia(s) critica(s) nao resolvida(s)
            </p>
            <p className="text-xs font-body text-red-600 mt-0.5">
              {criticals.map(o => o.description?.slice(0, 60) || o.type).join(' · ')}
            </p>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total registadas',  value: kpis.total,  color: 'text-n-900'   },
          { label: 'Este mes',          value: kpis.month,  color: 'text-ocean-700' },
          { label: 'Alta / Critica',    value: kpis.alta,   color: 'text-orange-700' },
          { label: 'Criticas',          value: kpis.critica, color: 'text-error' },
        ].map(m => (
          <div key={m.label} className="bg-white rounded-md border border-n-200 px-4 py-3 flex items-center gap-3">
            <FileWarning size={18} strokeWidth={1.75} className="text-n-300 shrink-0" />
            <div>
              <p className={`font-display font-bold text-xl ${m.color}`}>{m.value}</p>
              <p className="text-xs font-body text-n-500">{m.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Monthly report */}
      <div className="mb-5">
        <MonthlyReport occurrences={occurrences} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Pesquisar descricao, tour, colaborador..."
          className="h-9 px-3 text-sm font-body border border-n-200 rounded-sm bg-white placeholder:text-n-400 focus:outline-none focus:border-ocean-700 flex-1 min-w-[200px]"
        />
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setFilterType('')}
            className={`px-3 py-1.5 rounded-sm text-xs font-body font-semibold transition-colors ${!filterType ? 'bg-ocean-700 text-white' : 'bg-white border border-n-200 text-n-600 hover:border-ocean-300'}`}>
            Todos
          </button>
          {TYPES.map(t => (
            <button key={t.value} onClick={() => setFilterType(t.value)}
              className={`px-3 py-1.5 rounded-sm text-xs font-body font-semibold transition-colors ${filterType === t.value ? 'bg-ocean-700 text-white' : 'bg-white border border-n-200 text-n-600 hover:border-ocean-300'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {SEVERITIES.map(s => (
            <button key={s.value} onClick={() => setFilterSev(filterSev === s.value ? '' : s.value)}
              className={`px-3 py-1.5 rounded-sm text-xs font-body font-semibold border transition-colors ${filterSev === s.value ? s.cls + ' border-current' : 'bg-white border-n-200 text-n-600 hover:border-ocean-300'}`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <FileWarning size={36} strokeWidth={1.25} className="mx-auto mb-3 text-n-300" />
            <p className="font-display font-semibold text-n-700 mb-1">Sem ocorrencias</p>
            <p className="text-sm font-body text-n-400 mb-4">
              {occurrences.length === 0
                ? 'Registe a primeira ocorrencia quando necessario.'
                : 'Nenhuma ocorrencia corresponde aos filtros aplicados.'}
            </p>
            {occurrences.length === 0 && (
              <Button icon={Plus} onClick={() => setModal({ _new: true })}>Registar ocorrencia</Button>
            )}
          </div>
        </Card>
      ) : (
        <Card padding="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-n-200">
                  {['Data', 'Tipo', 'Severidade', 'Tour', 'Colaborador', 'Descricao', 'Accoes tomadas', ''].map(h => (
                    <th key={h} className="text-left py-2.5 px-4 text-xs font-mono uppercase tracking-wider text-n-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-n-100">
                {filtered.map(o => (
                  <tr key={o.id} className={`hover:bg-n-50 transition-colors ${o.severity === 'critica' ? 'bg-red-50/40' : ''}`}>
                    <td className="py-3 px-4 text-xs font-mono text-n-500 whitespace-nowrap">
                      {fmtDate(o.date || o.created_at)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap"><TypeBadge typeKey={o.type} /></td>
                    <td className="py-3 px-4"><SeverityBadge sev={o.severity} /></td>
                    <td className="py-3 px-4 text-xs font-body text-n-600 max-w-[120px] truncate">{o.unit_name || '—'}</td>
                    <td className="py-3 px-4 text-xs font-body text-n-600 whitespace-nowrap">{o.staff_name || '—'}</td>
                    <td className="py-3 px-4 max-w-[200px]">
                      <p className="text-xs font-body text-n-700 line-clamp-2">{o.description}</p>
                    </td>
                    <td className="py-3 px-4 max-w-[160px]">
                      {o.actions_taken
                        ? <p className="text-xs font-body text-n-500 line-clamp-2">{o.actions_taken}</p>
                        : <span className="text-xs font-body text-n-300">Nao registadas</span>}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-0.5">
                        <button onClick={() => setModal(o)}
                          className="p-1.5 rounded text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors">
                          <Pencil size={13} strokeWidth={1.75} />
                        </button>
                        <button onClick={() => handleDelete(o.id)}
                          className="p-1.5 rounded text-n-400 hover:text-error hover:bg-red-50 transition-colors">
                          <Trash2 size={13} strokeWidth={1.75} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {modal && (
        <OccurrenceModal
          occurrence={modal}
          units={units}
          staff={staff}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
