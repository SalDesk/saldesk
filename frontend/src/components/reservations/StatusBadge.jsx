const CONFIG = {
  pending:     { label: 'Pendente',    cls: 'bg-yellow-100 text-yellow-700' },
  confirmed:   { label: 'Confirmada',  cls: 'bg-blue-100 text-blue-700' },
  checked_in:  { label: 'Check-in',   cls: 'bg-green-100 text-green-700' },
  checked_out: { label: 'Check-out',  cls: 'bg-gray-100 text-gray-600' },
  cancelled:   { label: 'Cancelada',  cls: 'bg-red-100 text-red-600' }
};

export default function StatusBadge({ status }) {
  const { label, cls } = CONFIG[status] || { label: status, cls: 'bg-gray-100 text-gray-600' };
  return (
    <span className={`text-xs px-2 py-1 rounded-full font-medium ${cls}`}>{label}</span>
  );
}
