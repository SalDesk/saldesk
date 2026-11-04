/* Helpers partilhados pelas tabelas e modais de Reservas */
import FilterChips from '../../components/ui/FilterChips';

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

/* Titulo de um grupo de controlos (chips) sem campo proprio: igual a etiqueta dos campos */
export const GROUP_LABEL_CLASS =
  'text-xs font-body font-bold uppercase tracking-wide text-n-600 dark:text-n-400 app:normal-case app:tracking-normal app:text-[13px] app:text-n-700';

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
  return <FilterChips options={FUEL_LEVELS} value={value} onChange={onChange} />;
}

export function parseRestaurantMeta(r) {
  try { return JSON.parse(r?.notes_guest || '{}'); } catch { return {}; }
}
