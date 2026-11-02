import { useMemo } from 'react';
import {
  Car,
} from 'lucide-react';
import { useT } from '../../i18n';

/* Data local do dispositivo, nao UTC -- ver nota em BeachSeller.jsx */
const TODAY = new Date().toLocaleDateString('en-CA');

function mesAtual() {
  const n = new Date(), y = n.getFullYear(), m = String(n.getMonth() + 1).padStart(2, '0');
  return { inicio: `${y}-${m}-01`, fim: `${y}-${m}-${new Date(y, n.getMonth() + 1, 0).getDate()}` };
}

/* ─── Shared helpers ─────────────────────────────────────────── */

const CELL = {
  available:   { bg: 'bg-[#ECFDF5]', text: 'text-[#1A7A4A]',  dot: 'bg-[#1A7A4A]' },
  occupied:    { bg: 'bg-ocean-50',  text: 'text-ocean-700',   dot: 'bg-ocean-500' },
  checkin:     { bg: 'bg-[#FFFBEB]', text: 'text-[#92400E]',   dot: 'bg-[#F59E0B]' },
  checkout:    { bg: 'bg-[#FEF3C7]', text: 'text-[#78350F]',   dot: 'bg-[#D97706]' },
  cleaning:    { bg: 'bg-orange-50', text: 'text-orange-700',  dot: 'bg-orange-400' },
  maintenance: { bg: 'bg-[#FEF2F2]', text: 'text-error',       dot: 'bg-error' },
  breakdown:   { bg: 'bg-red-100',   text: 'text-red-700',     dot: 'bg-red-600' },
  inactive:    { bg: 'bg-n-50',      text: 'text-n-400',       dot: 'bg-n-300' },
};

function unitStatus(unit) {
  if (unit.status === 'breakdown')   return 'breakdown';
  if (unit.status === 'maintenance') return 'maintenance';
  if (unit.status === 'cleaning')    return 'cleaning';
  if (unit.status === 'inactive' || unit.is_active === false) return 'inactive';
  return null;
}

function parseVehicleMeta(unit) {
  try { return JSON.parse(unit?.description || '{}'); } catch { return {}; }
}

function StatusCell({ name, status }) {
  const t = useT();
  const s = CELL[status] || CELL.available;
  return (
    <div className={`rounded-sm border border-n-100 px-2 py-2 flex flex-col gap-0.5 ${s.bg}`}>
      <span className={`text-xs font-display font-semibold truncate leading-snug ${s.text}`}>{name}</span>
      <div className="flex items-center gap-1 mt-0.5">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
        <span className={`text-[10px] font-mono uppercase tracking-wide ${s.text}`}>{t(`dashboard.map.${status}`)}</span>
      </div>
    </div>
  );
}

function MapLegend({ keys }) {
  const t = useT();
  return (
    <div className="flex flex-wrap gap-4 mt-4 pt-3 border-t border-n-100">
      {keys.map(k => (
        <div key={k} className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full shrink-0 ${CELL[k].dot}`} />
          <span className="text-xs font-body text-n-500">{t(`dashboard.map.${k}`)}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Type-specific map components ──────────────────────────── */

function HotelMap({ units, todayRes, onSelect }) {
  const t = useT();
  const statusMap = useMemo(() => {
    const m = {};
    todayRes.forEach(r => {
      if (r.status === 'checked_in')                                               { m[r.unit_id] = 'occupied'; return; }
      if (r.check_out === TODAY && !m[r.unit_id])                                  { m[r.unit_id] = 'checkout'; return; }
      if (r.check_in === TODAY && r.status === 'confirmed' && !m[r.unit_id])         m[r.unit_id] = 'checkin';
    });
    return m;
  }, [todayRes]);

  if (!units.length)
    return <p className="text-sm font-body text-n-400 py-4">{t('dashboard.hotel.noRoomsRegistered')}</p>;

  return (
    <>
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        {units.map(u => {
          const st = unitStatus(u) || statusMap[u.id] || 'available';
          if (onSelect) {
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => onSelect(u)}
                className="text-left w-full hover:ring-2 hover:ring-ocean-300 rounded-sm transition-all"
              >
                <StatusCell name={u.name} status={st} />
              </button>
            );
          }
          return <StatusCell key={u.id} name={u.name} status={st} />;
        })}
      </div>
      <MapLegend keys={['available', 'checkin', 'occupied', 'checkout', 'cleaning', 'maintenance', 'inactive']} />
    </>
  );
}

function FleetGrid({ units, todayRes }) {
  const t = useT();
  const occupiedIds = useMemo(() => {
    const s = new Set();
    todayRes.filter(r => ['confirmed', 'checked_in'].includes(r.status)).forEach(r => s.add(r.unit_id));
    return s;
  }, [todayRes]);

  if (!units.length)
    return <p className="text-sm font-body text-n-400 py-4">{t('dashboard.rentacar.noVehiclesRegistered')}</p>;
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {units.map(u => {
          const st = unitStatus(u) || (occupiedIds.has(u.id) ? 'occupied' : 'available');
          const s = CELL[st];
          return (
            <div key={u.id} className={`rounded-sm border border-n-100 p-3 ${s.bg}`}>
              <div className="flex items-start justify-between mb-2">
                <Car size={16} strokeWidth={1.75} className={s.text} />
                <span className={`w-2 h-2 rounded-full ${s.dot}`} />
              </div>
              <p className={`text-sm font-display font-semibold truncate ${s.text}`}>{u.name}</p>
              <p className="text-[10px] font-body text-n-500 truncate mt-0.5">{u.unit_type}</p>
              <p className={`text-[10px] font-mono uppercase tracking-wide mt-1 ${s.text}`}>{t(`dashboard.map.${st}`)}</p>
            </div>
          );
        })}
      </div>
      <MapLegend keys={['available', 'occupied', 'inactive']} />
    </>
  );
}

function TableCell({ unit, status }) {
  const t    = useT();
  const s    = CELL[status] || CELL.available;
  const meta = parseVehicleMeta(unit);
  const num  = meta.number ? `M${meta.number}` : unit.name;
  const cap  = meta.capacity_max || unit.capacity || '';
  return (
    <div className={`rounded-sm border border-n-100 px-2 py-2.5 flex flex-col gap-0.5 ${s.bg}`}>
      <span className={`text-sm font-display font-bold leading-snug ${s.text}`}>{num}</span>
      {cap ? <span className="text-[10px] font-body text-n-400">{cap} {t('dashboard.common.pax')}</span> : null}
      <div className="flex items-center gap-1 mt-0.5">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
        <span className={`text-[10px] font-mono uppercase tracking-wide ${s.text}`}>{t(`dashboard.map.${status}`)}</span>
      </div>
    </div>
  );
}

const ZONE_KEYS  = { interior: 'interior', esplanada: 'esplanada', terraco: 'terraco', vip: 'vip', privado: 'privado' };
const ZONE_ORDER = ['interior', 'esplanada', 'terraco', 'vip', 'privado'];

function TableMap({ units, todayRes, onSelect }) {
  const t = useT();
  const statusMap = useMemo(() => {
    const m = {};
    todayRes.forEach(r => {
      if (r.status === 'checked_in' && !m[r.unit_id])               { m[r.unit_id] = 'occupied'; return; }
      if (['pending', 'confirmed'].includes(r.status) && !m[r.unit_id]) m[r.unit_id] = 'checkin';
    });
    return m;
  }, [todayRes]);

  const zones = useMemo(() => {
    const map = {};
    units.forEach(u => {
      const zone = parseVehicleMeta(u).zone || 'interior';
      if (!map[zone]) map[zone] = [];
      map[zone].push(u);
    });
    return map;
  }, [units]);

  if (!units.length)
    return <p className="text-sm font-body text-n-400 py-4">{t('dashboard.restaurant.noTablesRegistered')}</p>;

  const zoneKeys = ZONE_ORDER.filter(z => zones[z]).concat(Object.keys(zones).filter(z => !ZONE_ORDER.includes(z)));

  return (
    <>
      {zoneKeys.map(zone => (
        <div key={zone} className="mb-5 last:mb-0">
          <p className="text-[10px] font-mono font-semibold text-n-500 uppercase tracking-widest mb-2">
            {ZONE_KEYS[zone] ? t(`dashboard.zones.${zone}`) : zone}
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            {zones[zone].map(u => {
              const st = unitStatus(u) || statusMap[u.id] || 'available';
              if (onSelect) {
                return (
                  <button key={u.id} type="button" onClick={() => onSelect(u)}
                    className="text-left w-full hover:ring-2 hover:ring-ocean-300 rounded-sm transition-all">
                    <TableCell unit={u} status={st} />
                  </button>
                );
              }
              return <TableCell key={u.id} unit={u} status={st} />;
            })}
          </div>
        </div>
      ))}
      <MapLegend keys={['available', 'checkin', 'occupied', 'inactive']} />
    </>
  );
}

export { TODAY, mesAtual, CELL, unitStatus, parseVehicleMeta, StatusCell, MapLegend, HotelMap, FleetGrid, TableMap, ZONE_KEYS };
