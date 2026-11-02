import { useMemo, useState } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { useT } from '../../i18n';
import LoadingSpinner from '../shared/LoadingSpinner';

const ALIGN_CLASS = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

// Compara dois valores de ordenacao (numeros ou texto), devolvendo -1, 0 ou 1
function compareValues(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true, sensitivity: 'base' });
}

export default function Table({ columns, rows, loading, emptyMessage }) {
  const t = useT();
  // Ordenacao local: coluna ativa e direcao ('asc' | 'desc'); sem coluna = ordem original
  const [sort, setSort] = useState({ key: null, dir: null });

  // Copia antes de ordenar para nunca alterar o array recebido; Array.sort e estavel
  const sortedRows = useMemo(() => {
    const col = columns.find((c) => c.key === sort.key);
    if (!col || !col.sortValue || !sort.dir) return rows;
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => factor * compareValues(col.sortValue(a), col.sortValue(b)));
  }, [rows, columns, sort]);

  // Alterna ascendente -> descendente -> ordem original
  function toggleSort(key) {
    setSort((prev) => {
      if (prev.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc') return { key, dir: 'desc' };
      return { key: null, dir: null };
    });
  }

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
            {columns.map((col) => {
              const sortable = typeof col.sortValue === 'function';
              const active = sort.key === col.key && sort.dir;
              const ariaSort = !sortable
                ? undefined
                : active === 'asc' ? 'ascending' : active === 'desc' ? 'descending' : 'none';
              const SortIcon = active === 'asc' ? ChevronUp : active === 'desc' ? ChevronDown : ChevronsUpDown;
              const alignClass = ALIGN_CLASS[col.align] || 'text-left';
              return (
                <th
                  key={col.key}
                  aria-sort={ariaSort}
                  className={`sticky top-0 z-10 app:bg-white px-4 py-3 ${alignClass} text-xs font-body font-bold uppercase tracking-wide text-n-500 app:normal-case app:tracking-normal app:text-xs app:py-2`}
                  style={{ width: col.width }}
                >
                  {sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className="inline-flex items-center gap-1 uppercase tracking-wide font-bold hover:text-n-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-300 rounded-xs app:normal-case app:tracking-normal"
                    >
                      {col.label}
                      <SortIcon size={12} strokeWidth={1.75} className={active ? 'text-ocean-700' : 'text-n-300'} aria-hidden="true" />
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-n-400 text-sm">
                {emptyMessage || t('common.noResults')}
              </td>
            </tr>
          ) : (
            sortedRows.map((row, i) => (
              <tr
                key={row.id ?? i}
                className="border-b border-n-100 hover:bg-n-50 transition-colors"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3 ${ALIGN_CLASS[col.align] || ''} text-n-700 app:py-2`}
                  >
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
