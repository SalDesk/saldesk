import { useT } from '../../i18n';
import LoadingSpinner from '../shared/LoadingSpinner';

export default function Table({ columns, rows, loading, emptyMessage }) {
  const t = useT();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-n-200">
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-4 py-3 text-left text-xs font-body font-bold uppercase tracking-wide text-n-500"
                style={{ width: col.width }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-n-400 text-sm">
                {emptyMessage || t('common.noResults')}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={row.id ?? i}
                className="border-b border-n-100 hover:bg-n-50 transition-colors"
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-n-700">
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
