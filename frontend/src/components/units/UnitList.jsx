import { Building2, Pencil, Trash2 } from 'lucide-react';
import { useT } from '../../i18n';
import Badge from '../ui/Badge';
import Button from '../ui/Button';

function formatPrice(unit) {
  const labels = { night: '/noite', day: '/dia', hour: '/hora', session: '/sessao', person: '/pessoa' };
  return `€${Number(unit.base_price).toFixed(2)}${labels[unit.price_unit] || ''}`;
}

export default function UnitList({ units, onEdit, onDelete }) {
  const t = useT();

  if (!units.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-n-400">
        <Building2 size={40} strokeWidth={1.25} className="mb-3" />
        <p className="font-body text-sm">{t('common.noResults')}</p>
        <p className="font-body text-xs mt-1">Crie a sua primeira unidade</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {units.map((unit) => (
        <div
          key={unit.id}
          className="bg-white rounded-md border border-n-200 shadow-sm p-5 flex flex-col gap-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-display font-semibold text-sm text-n-900 truncate">{unit.name}</p>
              <p className="text-xs font-body text-n-500 mt-0.5">{unit.unit_type}</p>
            </div>
            <Badge variant={unit.status === 'active' ? 'confirmed' : 'cancelled'}>
              {unit.status === 'active' ? t('units.active') : t('units.inactive')}
            </Badge>
          </div>

          {unit.description && (
            <p className="text-xs font-body text-n-600 line-clamp-2 leading-relaxed">
              {unit.description}
            </p>
          )}

          <div className="flex items-center justify-between mt-auto pt-2 border-t border-n-100">
            <div>
              <p className="font-display font-bold text-base text-ocean-700">
                {formatPrice(unit)}
              </p>
              <p className="text-xs font-body text-n-400">Cap. {unit.capacity}</p>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" icon={Pencil} onClick={() => onEdit(unit)} aria-label="Editar" />
              <Button
                variant="ghost" size="sm" icon={Trash2} onClick={() => onDelete(unit)}
                className="hover:text-error hover:bg-[var(--error-light)]"
                aria-label="Eliminar"
              />
            </div>
          </div>

          {unit.pricing_rules?.filter((r) => r.active).length > 0 && (
            <div className="flex flex-wrap gap-1">
              {unit.pricing_rules.filter((r) => r.active).slice(0, 2).map((r) => (
                <span key={r.id} className="text-xs font-body px-2 py-0.5 bg-sand-50 text-sand-600 rounded-xs">
                  {r.name}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
