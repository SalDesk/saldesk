import { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle, Plus, Pencil, Trash2, Clock,
  CloudRain, MessageSquare, Zap, MoreHorizontal,
  FileWarning,
} from 'lucide-react';
import { listStaff } from '../services/staffService';
import { listUnits } from '../services/unitsService';
import { listOccurrences, createOccurrence, updateOccurrence, deleteOccurrence } from '../services/occurrencesService';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import MareStat from '../components/shared/MareStat';
import { IconBtn, EDIT_HOVER, DELETE_HOVER } from '../components/shared/IconBtn';
import Modal from '../components/ui/Modal';
import Input, { Textarea, Select } from '../components/ui/Input';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import Table from '../components/ui/Table';
import FilterChips from '../components/ui/FilterChips';
import EmptyState from '../components/ui/EmptyState';
import { useT } from '../i18n';
import { formatarData, useLingua } from '../utils/formatoLingua';
import { rotuloMes } from './staff/shared';

/* ── Constants ── */
/* value e o tipo / a severidade gravados na ocorrencia; o rotulo vem de occurrences.types e
   occurrences.severities (o pt e o texto de sempre) */
const TYPES = [
  { value: 'acidente',   Icon: AlertTriangle,  cls: 'text-[var(--error)]'   },
  { value: 'atraso',     Icon: Clock,          cls: 'text-[var(--warning)]' },
  { value: 'reclamacao', Icon: MessageSquare,  cls: 'text-[var(--info)]'    },
  { value: 'incidente',  Icon: Zap,            cls: 'text-ocean-700'        },
  { value: 'mau_tempo',  Icon: CloudRain,      cls: 'text-ocean-500'        },
  { value: 'outro',      Icon: MoreHorizontal, cls: 'text-n-500'            },
];

/* variant e a variante do ui/Badge: baixa neutra, media areia, alta aviso, critica vermelha */
const SEVERITIES = [
  { value: 'baixa',   variant: 'default'   },
  { value: 'media',   variant: 'pending'   },
  { value: 'alta',    variant: 'warning'   },
  { value: 'critica', variant: 'cancelled' },
];

/* Cartao de pagina e caixa interna do estilo Mare */
const CARTAO = 'bg-white rounded-[18px] border border-mare-card min-w-0';
const CAIXA  = 'bg-mare-head rounded-[14px] border border-mare-card p-4 space-y-4';

const rotuloTipo = (value, t) => t(`occurrences.types.${value}`);
const rotuloSev  = (value, t) => t(`occurrences.severities.${value}`);

function fmtDate(d, lang) {
  if (!d) return '—';
  return formatarData(new Date(d), { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }, lang);
}

function TypeBadge({ typeKey }) {
  const t = useT();
  const tipo = TYPES.find(x => x.value === typeKey);
  if (!tipo) return <span className="text-xs font-mono text-n-500">{typeKey}</span>;
  return (
    <Badge variant="default">
      <tipo.Icon size={12} strokeWidth={1.75} className={`${tipo.cls} shrink-0 mr-1.5`} aria-hidden="true" />
      {rotuloTipo(tipo.value, t)}
    </Badge>
  );
}

function SeverityBadge({ sev }) {
  const t = useT();
  const s = SEVERITIES.find(x => x.value === sev);
  if (!s) return null;
  return <Badge variant={s.variant}>{rotuloSev(s.value, t)}</Badge>;
}

/* ── OccurrenceModal ── */
function OccurrenceModal({ occurrence, units, staff, onSave, onClose }) {
  const t = useT();
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

  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    const unitName  = units.find(u => u.id === form.unit_id)?.name || '';
    const staffName = staff.find(s => s.id === form.staff_id)?.name || '';
    setSaving(true);
    setError('');
    try {
      await onSave(base?.id, { ...form, unit_name: unitName, staff_name: staffName });
    } catch {
      setError(t('occurrences.form.error'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={isNew ? t('occurrences.new') : t('occurrences.editTitle')} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Caixa 1: quando, o que e onde */}
        <div className={CAIXA}>
        <Input label={t('occurrences.form.date')} type="date" value={form.date} onChange={set('date')} required />

        <div className="grid grid-cols-2 gap-3">
          <Select label={t('occurrences.form.type')} value={form.type} onChange={set('type')} required>
            {TYPES.map(tipo => <option key={tipo.value} value={tipo.value}>{rotuloTipo(tipo.value, t)}</option>)}
          </Select>
          <Select label={t('occurrences.form.severity')} value={form.severity} onChange={set('severity')} required>
            {SEVERITIES.map(s => <option key={s.value} value={s.value}>{rotuloSev(s.value, t)}</option>)}
          </Select>
        </div>

        <Select label={t('occurrences.form.unit')} value={form.unit_id} onChange={set('unit_id')}>
          <option value="">{t('occurrences.form.noUnit')}</option>
          {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </Select>

        <Select label={t('occurrences.form.staff')} value={form.staff_id} onChange={set('staff_id')}>
          <option value="">{t('occurrences.form.noStaff')}</option>
          {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        </div>

        {/* Caixa 2: o que aconteceu */}
        <div className={CAIXA}>
        <Textarea label={t('occurrences.form.description')} value={form.description} onChange={set('description')} rows={3} required placeholder={t('occurrences.form.descriptionPlaceholder')} />

        <Textarea label={t('occurrences.form.actions')} value={form.actions_taken} onChange={set('actions_taken')} rows={3} placeholder={t('occurrences.form.actionsPlaceholder')} />

        <Input
          label={t('occurrences.form.photos')}
          value={form.photo_urls}
          onChange={set('photo_urls')}
          placeholder={t('occurrences.form.photosPlaceholder')}
          hint={t('occurrences.form.photosHint')}
        />
        </div>

        {error && <p className="text-xs text-error">{error}</p>}

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">{t('common.cancel')}</Button>
          <Button type="submit" loading={saving} className="flex-1">{isNew ? t('occurrences.form.submit') : t('common.save')}</Button>
        </div>
      </form>
    </Modal>
  );
}

/* ── MonthlyReport ── */
function MonthlyReport({ occurrences }) {
  const t = useT();
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
    <div className={`${CARTAO} p-[22px]`}>
      <h3 className="font-display text-lg font-semibold text-ocean-900 mb-4">
        {t('occurrences.report.title', { month: rotuloMes(now.getMonth(), t), year: now.getFullYear() })}
      </h3>
      {monthly.length === 0 ? (
        <p className="text-xs font-body text-n-500">{t('occurrences.report.empty')}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-mono uppercase tracking-wider text-n-500 mb-3">{t('occurrences.report.byType')}</p>
            <div className="space-y-2">
              {byType.map(tipo => (
                <div key={tipo.value} className="flex items-center gap-3">
                  <tipo.Icon size={13} strokeWidth={1.75} className={`${tipo.cls} shrink-0`} />
                  <span className="text-xs font-body text-n-600 flex-1">{rotuloTipo(tipo.value, t)}</span>
                  <span className="font-mono tabular-nums font-semibold text-xs text-n-800">{tipo.count}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-mono uppercase tracking-wider text-n-500 mb-3">{t('occurrences.report.bySeverity')}</p>
            <div className="space-y-2">
              {bySev.map(s => (
                <div key={s.value} className="flex items-center gap-3">
                  <span className="shrink-0"><Badge variant={s.variant}>{rotuloSev(s.value, t)}</Badge></span>
                  <div className="flex-1 h-1.5 bg-n-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-ocean-400"
                      style={{ width: `${(s.count / monthly.length) * 100}%` }} />
                  </div>
                  <span className="font-mono tabular-nums font-semibold text-xs text-n-800 w-5 text-right">{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="mt-4 pt-3 border-t border-n-100 flex items-center justify-between">
        <p className="text-xs font-body text-n-500">{t('occurrences.report.total')} <span className="font-mono tabular-nums font-semibold">{monthly.length}</span> {t('occurrences.report.unit')}</p>
      </div>
    </div>
  );
}

/* ─────────────────────── Main ─────────────────────── */
export default function Occurrences() {
  const t = useT();
  const lang = useLingua();
  const [occurrences, setOccurrences] = useState([]);
  const [loading,     setLoading]     = useState(true);
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
  useEffect(() => {
    listOccurrences().then(d => setOccurrences(d || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  /* Critical alert */
  const criticals = occurrences.filter(o => o.severity === 'critica' &&
    !o.resolved_at &&
    (Date.now() - new Date(o.created_at || o.date).getTime()) < 7 * 24 * 60 * 60 * 1000,
  );

  async function handleSave(id, dados) {
    const saved = id ? await updateOccurrence(id, dados) : await createOccurrence(dados);
    setOccurrences(prev => prev.find(o => o.id === saved.id) ? prev.map(o => o.id === saved.id ? saved : o) : [saved, ...prev]);
    setModal(null);
  }

  async function handleDelete(id) {
    if (!window.confirm(t('occurrences.confirmDelete'))) return;
    await deleteOccurrence(id);
    setOccurrences(prev => prev.filter(o => o.id !== id));
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

  // Colunas da tabela; a severidade critica ja se distingue pelo selo
  const columns = [
    {
      key: 'data',
      label: t('occurrences.columns.date'),
      render: (o) => <span className="text-xs font-mono tabular-nums text-n-500 whitespace-nowrap">{fmtDate(o.date || o.created_at, lang)}</span>,
    },
    { key: 'tipo', label: t('occurrences.columns.type'), render: (o) => <TypeBadge typeKey={o.type} /> },
    { key: 'severidade', label: t('occurrences.columns.severity'), render: (o) => <SeverityBadge sev={o.severity} /> },
    {
      key: 'tour',
      label: t('occurrences.columns.tour'),
      render: (o) => <span className="block text-xs font-body text-n-600 max-w-[120px] truncate">{o.unit_name || '—'}</span>,
    },
    {
      key: 'colaborador',
      label: t('occurrences.columns.staff'),
      render: (o) => <span className="text-xs font-body text-n-600 whitespace-nowrap">{o.staff_name || '—'}</span>,
    },
    {
      key: 'descricao',
      label: t('occurrences.columns.description'),
      render: (o) => <p className="text-xs font-body text-n-700 line-clamp-2 max-w-[200px]">{o.description}</p>,
    },
    {
      key: 'accoes',
      label: t('occurrences.columns.actions'),
      render: (o) => o.actions_taken
        ? <p className="text-xs font-body text-n-500 line-clamp-2 max-w-[160px]">{o.actions_taken}</p>
        : <span className="text-xs font-body text-n-500">{t('occurrences.columns.notRecorded')}</span>,
    },
    {
      key: 'acoes',
      label: '',
      render: (o) => (
        <div className="flex gap-0.5">
          <IconBtn icon={Pencil} label={t('common.edit')} onClick={() => setModal(o)} hover={EDIT_HOVER} />
          <IconBtn icon={Trash2} label={t('common.delete')} onClick={() => handleDelete(o.id)} hover={DELETE_HOVER} />
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div>
        <PageHeader title={t('occurrences.title')} subtitle={t('occurrences.subtitle')} eyebrow={t('nav.sections.clientes')} />
        <div className="flex justify-center py-16"><LoadingSpinner size={32} /></div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t('occurrences.title')}
        subtitle={t('occurrences.subtitle')}
        eyebrow={t('nav.sections.clientes')}
        actions={
          <Button icon={Plus} onClick={() => setModal({ _new: true })}>{t('occurrences.new')}</Button>
        }
      />

      {/* Critical alert */}
      {criticals.length > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 bg-[var(--error-light)] border border-mare-card rounded-[14px] mb-5">
          <AlertTriangle size={16} strokeWidth={1.75} className="text-error shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-body font-semibold text-error">
              {t('occurrences.criticalAlert', { n: criticals.length })}
            </p>
            <p className="text-xs font-body text-[var(--error)] mt-0.5 break-words">
              {/* sem descricao mostra o tipo: em pt o valor gravado, como sempre; nas outras linguas o rotulo */}
              {criticals.map(o => o.description?.slice(0, 60) || (lang === 'pt' || !TYPES.some(x => x.value === o.type) ? o.type : rotuloTipo(o.type, t))).join(' · ')}
            </p>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <MareStat label={t('occurrences.kpi.total')} value={kpis.total} icon={FileWarning} />
        <MareStat label={t('occurrences.kpi.month')} value={kpis.month} icon={Clock} />
        <MareStat label={t('occurrences.kpi.high')} value={kpis.alta} icon={AlertTriangle} tone="aviso" />
        <MareStat label={t('occurrences.kpi.critical')} value={kpis.critica} icon={Zap} tone="aviso" />
      </div>

      {/* Monthly report */}
      <div className="mb-5">
        <MonthlyReport occurrences={occurrences} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <div className="flex-1 min-w-[200px]">
          <Input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('occurrences.searchPlaceholder')}
          />
        </div>
        <FilterChips
          options={[{ value: '', label: t('occurrences.all') }, ...TYPES.map(tipo => ({ value: tipo.value, label: rotuloTipo(tipo.value, t) }))]}
          value={filterType}
          onChange={setFilterType}
        />
        <FilterChips
          options={SEVERITIES.map(s => ({ value: s.value, label: rotuloSev(s.value, t) }))}
          value={filterSev}
          onChange={v => setFilterSev(filterSev === v ? '' : v)}
        />
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className={CARTAO}>
          <EmptyState
            icon={FileWarning}
            title={t('occurrences.empty.title')}
            description={occurrences.length === 0
              ? t('occurrences.empty.first')
              : t('occurrences.empty.filtered')}
            action={occurrences.length === 0 && (
              <Button icon={Plus} onClick={() => setModal({ _new: true })}>{t('occurrences.new')}</Button>
            )}
          />
        </div>
      ) : (
        <div className={`${CARTAO} overflow-hidden`}>
          <Table columns={columns} rows={filtered} compact />
        </div>
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
