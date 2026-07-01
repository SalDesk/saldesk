import { useState, useEffect } from 'react';
import { Car } from 'lucide-react';
import { getFleetAvailability } from '../../services/fleetService';

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
      <div className={`flex items-center gap-2 text-xs font-body text-n-400 py-2 ${className || ''}`}>
        <span className="w-4 h-4 border-2 border-n-200 border-t-turquoise-500 rounded-full animate-spin shrink-0" />
        A verificar disponibilidade de buggys...
      </div>
    );
  }

  if (fleet.length === 0) return null;

  return (
    <div className={`space-y-2 ${className || ''}`}>
      <p className="text-xs font-mono uppercase tracking-wider text-n-500">Escolha o buggy</p>
      {fleet.map(v => (
        <button
          key={v.id}
          type="button"
          onClick={() => v.available && onChange(v.id)}
          disabled={!v.available}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border-2 transition-all ${
            value === v.id
              ? 'border-ocean-700 bg-ocean-50'
              : v.available
                ? 'border-n-200 bg-white hover:border-ocean-300'
                : 'border-n-100 bg-n-50 opacity-50 cursor-not-allowed'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${v.available ? 'bg-turquoise-50' : 'bg-n-100'}`}>
              <Car size={18} strokeWidth={1.75} className={v.available ? 'text-turquoise-600' : 'text-n-400'} />
            </div>
            <div className="text-left">
              <p className="font-body font-semibold text-n-900">{v.name}</p>
              <p className="text-xs font-body text-n-400">{v.capacity} lugares</p>
            </div>
          </div>
          <span className={`text-xs font-mono px-2 py-1 rounded-lg ${v.available ? 'bg-turquoise-50 text-turquoise-700' : 'bg-n-100 text-n-400'}`}>
            {v.available ? 'Livre' : 'Ocupado'}
          </span>
        </button>
      ))}
    </div>
  );
}
