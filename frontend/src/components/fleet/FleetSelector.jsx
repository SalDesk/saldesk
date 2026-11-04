import { useState, useEffect } from 'react';
import { Car } from 'lucide-react';
import { getFleetAvailability } from '../../services/fleetService';
import Badge from '../ui/Badge';
import LoadingSpinner from '../shared/LoadingSpinner';

export default function FleetSelector({ unitId, date, value, onChange, onLoad, className }) {
  const [fleet,   setFleet]   = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!unitId || !date) {
      setFleet([]);
      onLoad?.([]);
      return;
    }
    setLoading(true);
    getFleetAvailability(unitId, date)
      .then(data => {
        const d = data || [];
        setFleet(d);
        onLoad?.(d);
      })
      .catch(() => {
        setFleet([]);
        onLoad?.([]);
      })
      .finally(() => setLoading(false));
  }, [unitId, date]);

  if (loading) {
    return (
      <div className={`flex items-center gap-2 text-xs font-body text-n-500 py-2 ${className || ''}`}>
        <LoadingSpinner size={16} className="shrink-0" />
        A verificar disponibilidade de buggys...
      </div>
    );
  }

  if (fleet.length === 0) return null;

  return (
    <div className={`space-y-2 ${className || ''}`}>
      <p className="text-[13px] font-body font-medium text-n-700">Escolha o buggy</p>
      {fleet.map(v => (
        <button
          key={v.id}
          type="button"
          onClick={() => v.available && onChange(v.id)}
          disabled={!v.available}
          aria-pressed={value === v.id}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-300 ${
            value === v.id
              ? 'border-ocean-700 bg-ocean-50 ring-1 ring-ocean-700'
              : v.available
                ? 'border-n-200 bg-white hover:border-ocean-300'
                : 'border-n-100 bg-n-50 opacity-50 cursor-not-allowed'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-sm flex items-center justify-center ${v.available ? 'bg-ocean-50' : 'bg-n-100'}`}>
              <Car size={18} strokeWidth={1.75} className={v.available ? 'text-ocean-700' : 'text-n-400'} />
            </div>
            <div className="text-left">
              <p className="font-body font-semibold text-sm text-n-900">{v.name}</p>
              <p className="text-xs font-body text-n-500 tabular-nums">{v.capacity} lugares</p>
            </div>
          </div>
          <Badge variant={v.available ? 'confirmed' : 'default'}>
            {v.available ? 'Livre' : 'Ocupado'}
          </Badge>
        </button>
      ))}
    </div>
  );
}
