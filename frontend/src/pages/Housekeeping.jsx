import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles, User, CheckSquare, Square, AlertTriangle,
  Clock, RefreshCw, X, ChevronDown, ChevronUp, BarChart2,
} from 'lucide-react';
import { listUnits, updateUnit } from '../services/unitsService';
import { listReservations } from '../services/reservationsService';
import api from '../services/api';
import PageHeader from '../components/layout/PageHeader';
import Badge from '../components/ui/Badge';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import Button from '../components/ui/Button';

const TODAY = new Date().toISOString().slice(0, 10);

const HK = {
  clean:      { label: 'Limpo',      badge: 'confirmed', dot: 'bg-[#1A7A4A]', bg: 'bg-[#ECFDF5]' },
  dirty:      { label: 'Sujo',       badge: 'cancelled', dot: 'bg-error',     bg: 'bg-[#FEF2F2]' },
  cleaning:   { label: 'Em limpeza', badge: 'info',      dot: 'bg-ocean-500', bg: 'bg-ocean-50'   },
  inspection: { label: 'Inspeccao',  badge: 'pending',   dot: 'bg-[#F59E0B]', bg: 'bg-[#FFFBEB]' },
  blocked:    { label: 'Bloqueado',  badge: 'default',   dot: 'bg-n-300',     bg: 'bg-n-50'       },
};

const CHECKLIST_DEFAULT = [
  'Trocar roupa de cama',
  'Limpar casa de banho',
  'Aspirar / varrer',
  'Limpar superficies',
  'Repor amenities',
  'Verificar TV / AC / WiFi',
  'Repor mini-bar',
  'Verificar varanda',
];

function parseRoomMeta(unit) {
  try { return JSON.parse(unit.description || '{}'); } catch { return {}; }
}

function computeInitialHK(unit, todayRes) {
  if (unit.status === 'maintenance' || unit.status === 'inactive') return 'blocked';
  if (unit.status === 'cleaning') return 'cleaning';
  const hasCheckout = todayRes.some(r => r.unit_id === unit.id && r.check_out === TODAY && r.status === 'checked_in');
  if (hasCheckout) return 'dirty';
  return 'clean';
}

function computePriority(unit, todayRes) {
  const hasCheckout = todayRes.some(r => r.unit_id === unit.id && r.check_out === TODAY && r.status === 'checked_in');
  const hasCheckin  = todayRes.some(r => r.unit_id === unit.id && r.check_in  === TODAY && ['confirmed', 'pending'].includes(r.status));
  const isOccupied  = todayRes.some(r => r.unit_id === unit.id && r.status === 'checked_in');
  if (hasCheckout && hasCheckin) return 'double';
  if (hasCheckout || hasCheckin) return 'urgent';
  if (isOccupied) return 'occupied';
  return 'vacant';
}

const PRIORITY_SORT = { double: 0, urgent: 1, occupied: 2, vacant: 3 };
const PRIORITY_LABEL = { double: 'Saida + Entrada', urgent: 'Urgente', occupied: 'Ocupado', vacant: 'Vago' };
const PRIORITY_CLS   = {
  double:   'text-error font-semibold',
  urgent:   'text-[#B45309] font-medium',
  occupied: 'text-n-500',
  vacant:   'text-n-400',
};

function groupByFloor(units) {
  const map = {};
  units.forEach(u => {
    const meta  = parseRoomMeta(u);
    const floor = meta.floor ? `Andar ${meta.floor}` : 'Sem andar';
    if (!map[floor]) map[floor] = [];
    map[floor].push(u);
  });
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
}

export default function Housekeeping() {
  const navigate = useNavigate();

  const [units,      setUnits]      = useState([]);
  const [todayRes,   setTodayRes]   = useState([]);
  const [staffList,  setStaffList]  = useState([]);
  const [loading,    setLoading]    = useState(true);

  /* local per-room state — hkState, assigned staff, checklist completion */
  const [hkStates,    setHkStates]    = useState({});
  const [assignments, setAssignments] = useState({});
  const [checklists,  setChecklists]  = useState({});

  /* checklist modal */
  const [checklistRoom, setChecklistRoom] = useState(null);

  /* collapsed floors */
  const [collapsed, setCollapsed] = useState({});

  /* filter */
  const [filterState, setFilterState] = useState('all');

  useEffect(() => {
    Promise.all([
      listUnits(),
      listReservations({ from: TODAY, to: TODAY }),
      api.get('/staff').then(r => r.data?.data || []).catch(() => []),
    ])
      .then(([u, tRes, staff]) => {
        const activeUnits = (u || []).filter(un => un.status !== 'inactive');
        setUnits(activeUnits);
        setTodayRes(tRes || []);
        setStaffList(staff);

        const initStates = {};
        activeUnits.forEach(un => {
          initStates[un.id] = computeInitialHK(un, tRes || []);
        });
        setHkStates(initStates);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function changeState(unitId, newState) {
    setHkStates(s => ({ ...s, [unitId]: newState }));
  }

  function assignStaff(unitId, staffId) {
    setAssignments(a => ({ ...a, [unitId]: staffId || null }));
  }

  function toggleChecklist(unitId, item) {
    setChecklists(c => {
      const curr = c[unitId] || [];
      const next = curr.includes(item) ? curr.filter(x => x !== item) : [...curr, item];
      return { ...c, [unitId]: next };
    });
  }

  function markComplete(unit) {
    changeState(unit.id, 'clean');
    setChecklistRoom(null);
  }

  const enriched = useMemo(() =>
    units.map(u => ({
      unit:     u,
      hkState:  hkStates[u.id]    || 'clean',
      priority: computePriority(u, todayRes),
      staff:    assignments[u.id] || null,
      meta:     parseRoomMeta(u),
    })).sort((a, b) => PRIORITY_SORT[a.priority] - PRIORITY_SORT[b.priority]),
    [units, hkStates, todayRes, assignments]
  );

  const filtered = useMemo(() =>
    filterState === 'all' ? enriched : enriched.filter(r => r.hkState === filterState),
    [enriched, filterState]
  );

  const summary = useMemo(() => {
    const counts = { clean: 0, dirty: 0, cleaning: 0, inspection: 0, blocked: 0 };
    enriched.forEach(r => { counts[r.hkState] = (counts[r.hkState] || 0) + 1; });
    return counts;
  }, [enriched]);

  const floors = useMemo(() => groupByFloor(filtered.map(r => r.unit)), [filtered]);

  /* map from unit id → enriched entry */
  const byId = useMemo(() => Object.fromEntries(enriched.map(r => [r.unit.id, r])), [enriched]);

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size={32} /></div>;

  return (
    <div>
      <PageHeader
        title="Housekeeping"
        subtitle={`${TODAY.split('-').reverse().join('/')} · ${units.length} quartos`}
        actions={
          <Button
            variant="secondary"
            icon={RefreshCw}
            onClick={() => { setLoading(true); window.location.reload(); }}
          >
            Actualizar
          </Button>
        }
      />

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { key: 'all',        label: `Todos (${enriched.length})`, dot: 'bg-n-400'        },
          { key: 'dirty',      label: `Sujos (${summary.dirty})`,   dot: 'bg-error'        },
          { key: 'cleaning',   label: `Limpeza (${summary.cleaning})`, dot: 'bg-ocean-500' },
          { key: 'inspection', label: `Inspeccao (${summary.inspection})`, dot: 'bg-[#F59E0B]' },
          { key: 'clean',      label: `Limpos (${summary.clean})`,  dot: 'bg-[#1A7A4A]'   },
        ].map(({ key, label, dot }) => (
          <button
            key={key}
            onClick={() => setFilterState(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-body font-medium transition-colors ${
              filterState === key
                ? 'bg-ocean-700 border-ocean-700 text-white'
                : 'bg-white border-n-200 text-n-600 hover:border-ocean-400'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${filterState === key ? 'bg-white' : dot}`} />
            {label}
          </button>
        ))}
      </div>

      {/* Urgent alerts */}
      {enriched.filter(r => r.priority === 'double').length > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-md mb-4">
          <AlertTriangle size={15} strokeWidth={1.75} className="text-error shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-body font-semibold text-error">Quartos com saida e entrada no mesmo dia:</p>
            <p className="text-xs font-body text-red-600">
              {enriched.filter(r => r.priority === 'double').map(r => r.unit.name).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Floors */}
      <div className="space-y-4">
        {floors.map(([floor, floorUnits]) => {
          const isCollapsed = !!collapsed[floor];
          return (
            <div key={floor} className="bg-white rounded-md border border-n-200 shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => setCollapsed(c => ({ ...c, [floor]: !c[floor] }))}
                className="w-full flex items-center gap-3 px-5 py-3 border-b border-n-100 hover:bg-n-50 transition-colors"
              >
                <Sparkles size={13} strokeWidth={1.75} className="text-ocean-700 shrink-0" />
                <span className="font-display font-semibold text-sm text-n-700 flex-1 text-left">{floor}</span>
                <span className="text-xs font-body text-n-400">{floorUnits.length} quartos</span>
                {isCollapsed
                  ? <ChevronDown size={14} strokeWidth={1.75} className="text-n-400 shrink-0" />
                  : <ChevronUp   size={14} strokeWidth={1.75} className="text-n-400 shrink-0" />
                }
              </button>

              {!isCollapsed && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-n-100">
                  {floorUnits.map(u => {
                    const entry = byId[u.id];
                    if (!entry) return null;
                    const { hkState, priority, staff, meta } = entry;
                    const st = HK[hkState] || HK.clean;
                    const assignedStaff = staffList.find(s => s.id === staff);
                    const done  = checklists[u.id] || [];
                    const total = CHECKLIST_DEFAULT.length;
                    const pct   = total ? Math.round((done.length / total) * 100) : 0;

                    return (
                      <div key={u.id} className={`p-4 ${st.bg}`}>
                        <div className="flex items-start gap-2 mb-2">
                          <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${st.dot}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-display font-semibold text-n-900 truncate">{u.name}</p>
                            <p className="text-[11px] font-body text-n-400">
                              {u.unit_type || '—'}
                              {meta.view ? ` · ${meta.view}` : ''}
                              {` · ${u.capacity || 1} pers.`}
                            </p>
                          </div>
                          <Badge variant={st.badge}>{st.label}</Badge>
                        </div>

                        <p className={`text-[11px] font-body mb-2 ${PRIORITY_CLS[priority]}`}>
                          {PRIORITY_LABEL[priority]}
                        </p>

                        {/* State selector */}
                        <select
                          value={hkState}
                          onChange={e => changeState(u.id, e.target.value)}
                          className="w-full text-xs font-body border border-n-200 rounded-sm px-2 py-1.5 bg-white text-n-700 mb-2 focus:outline-none focus:border-ocean-500"
                        >
                          {Object.entries(HK).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                          ))}
                        </select>

                        {/* Staff assignment */}
                        {staffList.length > 0 && (
                          <select
                            value={staff || ''}
                            onChange={e => assignStaff(u.id, e.target.value || null)}
                            className="w-full text-xs font-body border border-n-200 rounded-sm px-2 py-1.5 bg-white text-n-500 mb-2 focus:outline-none focus:border-ocean-500"
                          >
                            <option value="">Atribuir colaborador...</option>
                            {staffList.map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        )}

                        {/* Checklist progress */}
                        <button
                          type="button"
                          onClick={() => setChecklistRoom(u)}
                          className="w-full flex items-center gap-2 text-left"
                        >
                          <div className="flex-1 bg-n-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-full bg-ocean-500 rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-mono text-n-500 shrink-0">{done.length}/{total}</span>
                          <CheckSquare size={12} strokeWidth={1.75} className="text-n-400 shrink-0" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {floors.length === 0 && (
          <div className="flex flex-col items-center py-16 text-n-300">
            <Sparkles size={32} strokeWidth={1.25} className="mb-3" />
            <p className="text-sm font-body">Nenhum quarto encontrado</p>
          </div>
        )}
      </div>

      {/* Checklist modal */}
      {checklistRoom && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setChecklistRoom(null); }}
        >
          <div className="bg-white rounded-xl border border-n-200 shadow-2xl w-full max-w-sm">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-n-100">
              <Sparkles size={16} strokeWidth={1.75} className="text-ocean-700 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-display font-semibold text-sm text-n-900">{checklistRoom.name}</p>
                <p className="text-xs font-body text-n-400">{checklistRoom.unit_type || '—'}</p>
              </div>
              <button onClick={() => setChecklistRoom(null)} className="p-1 text-n-400 hover:text-n-700 rounded">
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-2">
              {CHECKLIST_DEFAULT.map(item => {
                const done = (checklists[checklistRoom.id] || []).includes(item);
                return (
                  <label key={item} className="flex items-center gap-3 cursor-pointer group">
                    <button
                      type="button"
                      onClick={() => toggleChecklist(checklistRoom.id, item)}
                      className="shrink-0 text-n-300 group-hover:text-ocean-700 transition-colors"
                    >
                      {done
                        ? <CheckSquare size={18} strokeWidth={1.75} className="text-[#1A7A4A]" />
                        : <Square      size={18} strokeWidth={1.75} />
                      }
                    </button>
                    <span className={`text-sm font-body ${done ? 'line-through text-n-300' : 'text-n-700'}`}>
                      {item}
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="px-5 py-4 border-t border-n-100 flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setChecklistRoom(null)}>
                Fechar
              </Button>
              <Button className="flex-1" onClick={() => markComplete(checklistRoom)}>
                Marcar como Limpo
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
