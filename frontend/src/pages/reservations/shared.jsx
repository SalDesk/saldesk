/* Helpers partilhados pelas tabelas e modais de Reservas */

export const SOURCE_LABEL = {
  direct:       'Directo',
  public:       'Pag. Publica',
  booking_com:  'Booking.com',
  airbnb:       'Airbnb',
  viator:       'Viator',
  getyourguide: 'GetYourGuide',
  manual:       'Manual',
};

export const SOURCE_CLASS = {
  direct:       'bg-ocean-50 text-ocean-700 border border-ocean-100',
  public:       'bg-ocean-50 text-ocean-700 border border-ocean-100',
  booking_com:  'bg-blue-50 text-blue-700 border border-blue-200',
  airbnb:       'bg-rose-50 text-rose-700 border border-rose-200',
  viator:       'bg-orange-50 text-orange-700 border border-orange-200',
  getyourguide: 'bg-[#ECFDF5] text-[#1A7A4A] border border-[#BBF7D0]',
  manual:       'bg-n-50 text-n-600 border border-n-200',
};

export const STATUS_NEXT  = { pending: 'confirmed', confirmed: 'checked_in', checked_in: 'checked_out' };
export const STATUS_NEXT_LABEL = { pending: 'Confirmar', confirmed: 'Check-in', checked_in: 'Check-out' };

export function formatDate(d) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

export function SourceBadge({ source }) {
  return (
    <span className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded-xs uppercase tracking-wide whitespace-nowrap ${SOURCE_CLASS[source] || SOURCE_CLASS.manual}`}>
      {SOURCE_LABEL[source] || source}
    </span>
  );
}

export function parseRentacarMeta(r) {
  try { return JSON.parse(r?.notes_internal || '{}')?.rentacar || {}; } catch { return {}; }
}

export const FUEL_LEVELS = [
  { value: 0, label: 'Vazio' },
  { value: 1, label: '1/4'   },
  { value: 2, label: '1/2'   },
  { value: 3, label: '3/4'   },
  { value: 4, label: 'Cheio' },
];

export function FuelSelector({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1">
      {FUEL_LEVELS.map(f => (
        <button
          key={f.value}
          type="button"
          onClick={() => onChange(f.value)}
          className={`px-2.5 py-1.5 rounded-sm border text-xs font-mono font-medium transition-colors ${
            value === f.value
              ? 'bg-ocean-700 border-ocean-700 text-white'
              : 'bg-n-50 border-n-200 text-n-600 hover:border-ocean-400'
          }`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

export function parseRestaurantMeta(r) {
  try { return JSON.parse(r?.notes_guest || '{}'); } catch { return {}; }
}
