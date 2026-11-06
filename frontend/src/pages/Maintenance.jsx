import { useState, useEffect, useMemo } from 'react';
import {
  Wrench, AlertTriangle, CheckCircle, Plus, X, Car,
  Calendar, DollarSign, FileText, ArrowRight,
} from 'lucide-react';
import { listUnits, updateUnit } from '../services/unitsService';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import FilterChips from '../components/ui/FilterChips';
import Table from '../components/ui/Table';
import EmptyState from '../components/ui/EmptyState';
import Input, { Textarea, Select } from '../components/ui/Input';
import LoadingSpinner from '../components/shared/LoadingSpinner';

/* Data local do dispositivo, nao UTC -- ver nota em BeachSeller.jsx */
const TODAY = new Date().toLocaleDateString('en-CA');

function parseVehicleMeta(unit) {
  try { return JSON.parse(unit?.description || '{}'); } catch { return {}; }
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
}

function alertSeverity(days) {
  if (days === null) return null;
  if (days <= 0) return 'expired';
  if (days <= 14) return 'critical';
  if (days <= 30) return 'warning';
  return null;
}

const SEV_STYLE = {
  expired:  { bg: 'bg-[var(--error-light)]',   text: 'text-[var(--error)]',   label: 'Expirado'  },
  critical: { bg: 'bg-[var(--error-light)]',   text: 'text-[var(--error)]',   label: 'Urgente'   },
  warning:  { bg: 'bg-[var(--warning-light)]', text: 'text-[var(--warning)]', label: 'Atencao'   },
};

function computeAlerts(units) {
  const alerts = [];
  units.forEach(u => {
    const meta  = parseVehicleMeta(u);
    const label = meta.plate ? `${u.name} (${meta.plate})` : u.name;
    const check = (dateStr, name) => {
      const days = daysUntil(dateStr);
      const sev  = alertSeverity(days);
      if (sev) alerts.push({ unit: u, meta, label, name, days, sev, dateStr });
    };
    check(meta.seguro_expiry,   'Seguro');
    check(meta.iuc_expiry,      'IUC');
    check(meta.inspecao_expiry, 'Inspecao');
    if (meta.next_revision_km && meta.current_km) {
      const kmLeft = Number(meta.next_revision_km) - Number(meta.current_km);
      const sev = kmLeft <= 0 ? 'expired' : kmLeft <= 500 ? 'critical' : null;
      if (sev) alerts.push({ unit: u, meta, label, name: 'Revisao', days: null, kmLeft, sev });
    }
  });
  return alerts.sort((a, b) => {
    const order = { expired: 0, critical: 1, warning: 2 };
    return order[a.sev] - order[b.sev];
  });
}

/* Celula de documento: data a verde, ou a cor da gravidade com os dias que faltam */
function DocCell({ dateStr }) {
  const days = daysUntil(dateStr);
  const sev  = alertSeverity(days);
  if (!dateStr) return <span className="text-n-300">—</span>;
  const cls = sev ? SEV_STYLE[sev].text : 'text-[var(--success)]';
  return <span className={`font-mono text-xs ${cls}`}>{dateStr}{sev && ` (${days}d)`}</span>;
}

const MAINT_TYPES = ['Revisao', 'Seguro', 'IUC', 'Inspecao', 'Reparacao', 'Pneus', 'Oleo', 'Outro'];

function MaintenanceModal({ units, record, onSave, onClose }) {
  const [form, setForm] = useState({
    unit_id:      record?.unit_id      || '',
    tipo:         record?.tipo         || MAINT_TYPES[0],
    date:         record?.date         || TODAY,
    km:           record?.km           || '',
    cost:         record?.cost         || '',
    next_date:    record?.next_date    || '',
    next_km:      record?.next_km      || '',
    replacement:  record?.replacement  || '',
    notes:        record?.notes        || '',
  });
  const [saving, setSaving] = useState(false);

  function set(k, v) { setForm(prev => ({ ...prev, [k]: v })); }

  async function handleSave() {
    if (!form.unit_id || !form.tipo || !form.date) return;
    setSaving(true);
    try {
      const unit = units.find(u => u.id === form.unit_id);
      if (!unit) return;
      const meta = parseVehicleMeta(unit);
      const history = meta.maintenance_history || [];
      const entry = { ...form, id: Date.now(), created_at: new Date().toISOString() };
      history.unshift(entry);

      // Update document expiry fields if applicable
      if (form.tipo === 'Seguro'    && form.next_date) meta.seguro_expiry   = form.next_date;
      if (form.tipo === 'IUC'       && form.next_date) meta.iuc_expiry      = form.next_date;
      if (form.tipo === 'Inspecao'  && form.next_date) meta.inspecao_expiry = form.next_date;
      if (form.tipo === 'Revisao'   && form.next_km)   meta.next_revision_km = form.next_km;
      if (form.km) meta.current_km = form.km;

      const newMeta = { ...meta, maintenance_history: history };
      await updateUnit(unit.id, { description: JSON.stringify(newMeta) });
      onSave();
    } finally {
      setSaving(false);
    }
  }

  const selectedUnit = units.find(u => u.id === form.unit_id);
  const unitMeta     = selectedUnit ? parseVehicleMeta(selectedUnit) : {};

  return (
    <div className="space-y-5">
      <Select label="Viatura" value={form.unit_id} onChange={e => set('unit_id', e.target.value)}>
        <option value="">Seleccionar viatura...</option>
        {units.map(u => {
          const m = parseVehicleMeta(u);
          return (
            <option key={u.id} value={u.id}>
              {m.brand ? `${m.brand} ${m.model || ''}`.trim() : u.name}{m.plate ? ` — ${m.plate}` : ''}
            </option>
          );
        })}
      </Select>

      <div className="grid grid-cols-2 gap-4">
        <Select label="Tipo" value={form.tipo} onChange={e => set('tipo', e.target.value)}>
          {MAINT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </Select>
        <Input label="Data realizacao" type="date" value={form.date} onChange={e => set('date', e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Km actuais"
          type="number"
          value={form.km}
          onChange={e => set('km', e.target.value)}
          placeholder={unitMeta.current_km || '0'}
        />
        <Input
          label="Custo (EUR)"
          type="number"
          step="0.01"
          value={form.cost}
          onChange={e => set('cost', e.target.value)}
          placeholder="0.00"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input label="Proxima data" type="date" value={form.next_date} onChange={e => set('next_date', e.target.value)} />
        <Input
          label="Proxima revisao (km)"
          type="number"
          value={form.next_km}
          onChange={e => set('next_km', e.target.value)}
          placeholder="—"
        />
      </div>

      <Input
        label="Viatura substituta (matricula)"
        type="text"
        value={form.replacement}
        onChange={e => set('replacement', e.target.value)}
        placeholder="Opcional"
      />

      <Textarea label="Notas" value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} />

      <div className="flex gap-3 pt-2">
        <Button variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
        <Button onClick={handleSave} loading={saving} disabled={!form.unit_id} className="flex-1">
          Registar
        </Button>
      </div>
    </div>
  );
}

export default function Maintenance() {
  const [units,   setUnits]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(false);
  const [filter,  setFilter]  = useState('all'); // all | expired | warning

  useEffect(() => {
    listUnits()
      .then(u => setUnits(u || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function reload() {
    const u = await listUnits().catch(() => []);
    setUnits(u || []);
    setModal(false);
  }

  const alerts = useMemo(() => computeAlerts(units), [units]);

  const history = useMemo(() => {
    const all = [];
    units.forEach(u => {
      const meta = parseVehicleMeta(u);
      (meta.maintenance_history || []).forEach(h => {
        all.push({ ...h, unit: u, meta });
      });
    });
    return all.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [units]);

  const totalCost = useMemo(() =>
    history.reduce((s, h) => s + (Number(h.cost) || 0), 0),
    [history]
  );

  const filteredAlerts = useMemo(() => {
    if (filter === 'all') return alerts;
    return alerts.filter(a => filter === 'expired'
      ? ['expired', 'critical'].includes(a.sev)
      : a.sev === 'warning'
    );
  }, [alerts, filter]);

  // Colunas da tabela de documentacao da frota
  const docColumns = [
    {
      key: 'viatura',
      label: 'Viatura',
      render: (u) => {
        const meta = parseVehicleMeta(u);
        return (
          <div>
            <p className="font-display font-semibold text-n-900">
              {meta.brand ? `${meta.brand} ${meta.model || ''}`.trim() : u.name}
            </p>
            {meta.plate && <p className="text-xs font-mono text-n-400">{meta.plate}</p>}
          </div>
        );
      },
    },
    { key: 'seguro',   label: 'Seguro',   render: (u) => <DocCell dateStr={parseVehicleMeta(u).seguro_expiry} /> },
    { key: 'iuc',      label: 'IUC',      render: (u) => <DocCell dateStr={parseVehicleMeta(u).iuc_expiry} /> },
    { key: 'inspecao', label: 'Inspecao', render: (u) => <DocCell dateStr={parseVehicleMeta(u).inspecao_expiry} /> },
    {
      key: 'km',
      label: 'Km actual',
      render: (u) => {
        const meta = parseVehicleMeta(u);
        return <span className="font-mono text-xs text-n-700">{meta.current_km ? `${Number(meta.current_km).toLocaleString()} km` : '—'}</span>;
      },
    },
    {
      key: 'revisao',
      label: 'Prox. revisao',
      render: (u) => {
        const meta = parseVehicleMeta(u);
        const kmLeft = meta.next_revision_km && meta.current_km
          ? Number(meta.next_revision_km) - Number(meta.current_km)
          : null;
        if (kmLeft === null) return <span className="text-n-300 text-xs font-mono">—</span>;
        return (
          <span className={`font-mono text-xs ${kmLeft <= 0 ? 'text-[var(--error)]' : kmLeft <= 500 ? 'text-[var(--warning)]' : 'text-n-700'}`}>
            {kmLeft <= 0 ? `Atrasada ${Math.abs(kmLeft)}km` : `${kmLeft}km`}
          </span>
        );
      },
    },
  ];

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size={32} /></div>;

  return (
    <div>
      <PageHeader
        title="Manutencao"
        subtitle={`${units.length} viatura(s) · ${alerts.length} alerta(s)`}
        actions={<Button icon={Plus} onClick={() => setModal(true)}>Registar intervencao</Button>}
      />

      {/* Alert filters */}
      {alerts.length > 0 && (
        <div className="mb-5">
          <FilterChips
            options={[
              { value: 'all',     label: `Todos (${alerts.length})` },
              { value: 'expired', label: `Urgentes (${alerts.filter(a => ['expired','critical'].includes(a.sev)).length})` },
              { value: 'warning', label: `Atencao (${alerts.filter(a => a.sev === 'warning').length})` },
            ]}
            value={filter}
            onChange={setFilter}
          />
        </div>
      )}

      {/* Alerts */}
      {filteredAlerts.length > 0 ? (
        <div className="space-y-2 mb-8">
          {filteredAlerts.map((a, i) => {
            const s = SEV_STYLE[a.sev];
            return (
              <div key={i} className={`flex items-start gap-3 px-4 py-3 rounded-md border border-n-200 ${s.bg}`}>
                <AlertTriangle size={15} strokeWidth={1.75} className={`${s.text} shrink-0 mt-0.5`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-body font-medium ${s.text}`}>{a.label}</p>
                  <p className={`text-xs font-body ${s.text} opacity-80`}>
                    {a.name}
                    {a.days !== null && a.days !== undefined
                      ? a.days <= 0
                        ? ` — expirado ha ${Math.abs(a.days)} dias`
                        : ` — expira em ${a.days} dias (${a.dateStr})`
                      : a.kmLeft !== undefined
                        ? a.kmLeft <= 0
                          ? ` — atrasada ${Math.abs(a.kmLeft)}km`
                          : ` — em ${a.kmLeft}km`
                        : ''
                    }
                  </p>
                </div>
                <span className={`text-[10px] font-mono font-bold uppercase tracking-wide px-2 py-0.5 rounded bg-white ${s.text} shrink-0`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex items-center gap-3 px-4 py-3 rounded-md bg-[var(--success-light)] border border-n-200 mb-8">
          <CheckCircle size={15} strokeWidth={1.75} className="text-[var(--success)] shrink-0" />
          <p className="text-sm font-body text-[var(--success)]">Sem alertas de documentacao. Toda a frota em dia.</p>
        </div>
      )}

      {/* Fleet document status table */}
      <div className="bg-white rounded-md border border-n-200 shadow-sm mb-8 overflow-hidden">
        <div className="px-5 py-4 border-b border-n-100 flex items-center gap-2">
          <Car size={14} strokeWidth={1.75} className="text-n-500" />
          <h2 className="font-display font-semibold text-sm text-n-700">Estado documentacao — frota</h2>
        </div>
        <Table columns={docColumns} rows={units} />
      </div>

      {/* Maintenance history */}
      <div className="bg-white rounded-md border border-n-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-n-100 flex items-center gap-2">
          <Wrench size={14} strokeWidth={1.75} className="text-n-500" />
          <h2 className="font-display font-semibold text-sm text-n-700">Historico de intervencoes</h2>
          {totalCost > 0 && (
            <span className="ml-auto text-xs font-mono text-n-500">
              Total: <strong className="text-n-900">€{totalCost.toFixed(2)}</strong>
            </span>
          )}
        </div>
        {history.length === 0 ? (
          <EmptyState icon={Wrench} title="Nenhuma intervencao registada." />
        ) : (
          <div className="divide-y divide-n-100">
            {history.map((h, i) => {
              const metaU = parseVehicleMeta(h.unit);
              const vLabel = metaU.brand ? `${metaU.brand} ${metaU.model || ''}`.trim() : h.unit.name;
              return (
                <div key={i} className="px-5 py-3 flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-n-100 flex items-center justify-center shrink-0 mt-0.5">
                    <Wrench size={13} strokeWidth={1.75} className="text-n-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="font-display font-semibold text-sm text-n-900">{h.tipo}</span>
                      <span className="text-xs font-body text-n-500">{vLabel}</span>
                      {metaU.plate && <span className="text-xs font-mono text-n-400">{metaU.plate}</span>}
                    </div>
                    <div className="flex gap-3 mt-0.5 flex-wrap">
                      <span className="text-xs font-mono text-n-500">{h.date}</span>
                      {h.km    && <span className="text-xs font-mono text-n-400">{Number(h.km).toLocaleString()} km</span>}
                      {h.cost  && <span className="text-xs font-mono text-[var(--success)]">€{Number(h.cost).toFixed(2)}</span>}
                      {h.next_date && <span className="text-xs font-mono text-ocean-700">Prox: {h.next_date}</span>}
                    </div>
                    {h.notes && <p className="text-xs font-body text-n-500 mt-0.5">{h.notes}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Registar intervencao"
        size="md"
        footer={null}
      >
        <MaintenanceModal units={units} onSave={reload} onClose={() => setModal(false)} />
      </Modal>
    </div>
  );
}
