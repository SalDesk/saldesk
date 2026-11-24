import { useT } from '../../i18n';

/* O estado gravado manda; o rotulo vem de reservations.status.<estado> e um estado desconhecido mostra-se tal e qual */
const CONFIG = {
  pending:     { cls: 'bg-yellow-100 text-yellow-700' },
  confirmed:   { cls: 'bg-blue-100 text-blue-700' },
  checked_in:  { cls: 'bg-green-100 text-green-700' },
  checked_out: { cls: 'bg-gray-100 text-gray-600' },
  cancelled:   { cls: 'bg-red-100 text-red-600' }
};

export default function StatusBadge({ status }) {
  const t = useT();
  const conhecido = Object.prototype.hasOwnProperty.call(CONFIG, status);
  const { cls } = conhecido ? CONFIG[status] : { cls: 'bg-gray-100 text-gray-600' };
  const label = conhecido ? t(`reservations.status.${status}`) : status;
  return (
    <span className={`text-xs px-2 py-1 rounded-full font-medium ${cls}`}>{label}</span>
  );
}
