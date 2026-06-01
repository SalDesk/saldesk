import { Building2, Compass, Pencil, Trash2, Power, ImageOff, Clock, MapPin, Users } from 'lucide-react';
import { useT } from '../../i18n';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import { parseTourMeta } from './UnitForm';

function formatPrice(unit) {
  const labels = { night: '/noite', day: '/dia', hour: '/hora', session: '/sessao', person: '/pessoa' };
  return `€${Number(unit.base_price).toFixed(2)}${labels[unit.price_unit] || ''}`;
}

const DIFFICULTY_COLOR = {
  Facil:    'bg-[#ECFDF5] text-[#1A7A4A] border-[#BBF7D0]',
  Moderado: 'bg-[#FFF7E6] text-[#B45309] border-[#FDE68A]',
  Dificil:  'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]',
};

const TOUR_TYPE_LABEL = { grupo: 'Grupo', privado: 'Privado', ambos: 'Grupo / Privado' };

function TourCard({ unit, onEdit, onDelete, onToggle }) {
  const isActive = unit.status !== 'inactive';
  const meta     = parseTourMeta(unit.description);
  const thumb    = unit.images?.[0];

  return (
    <div
      className={`bg-white rounded-md border shadow-sm flex flex-col overflow-hidden transition-opacity ${
        isActive ? 'border-n-200' : 'border-n-150 opacity-70'
      }`}
    >
      {thumb ? (
        <div className="h-36 overflow-hidden bg-n-100 shrink-0">
          <img
            src={thumb}
            alt={unit.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.parentElement.classList.add('flex', 'items-center', 'justify-center');
            }}
          />
        </div>
      ) : (
        <div className="h-36 bg-ocean-50 flex items-center justify-center shrink-0 border-b border-n-100">
          <Compass size={32} strokeWidth={1.25} className="text-ocean-300" />
        </div>
      )}

      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Name + status */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-display font-semibold text-sm text-n-900 truncate">{unit.name}</p>
            {meta.name_en && (
              <p className="text-xs font-body text-n-400 truncate italic">{meta.name_en}</p>
            )}
          </div>
          <Badge variant={isActive ? 'confirmed' : 'cancelled'}>
            {isActive ? 'Activo' : 'Inactivo'}
          </Badge>
        </div>

        {/* Tags row */}
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs font-body px-2 py-0.5 bg-ocean-50 text-ocean-700 border border-ocean-100 rounded-xs">
            {unit.unit_type}
          </span>
          {meta.tour_type && (
            <span className="text-xs font-body px-2 py-0.5 bg-n-50 text-n-600 border border-n-200 rounded-xs">
              {TOUR_TYPE_LABEL[meta.tour_type] || meta.tour_type}
            </span>
          )}
          {meta.difficulty && (
            <span className={`text-xs font-body px-2 py-0.5 border rounded-xs ${DIFFICULTY_COLOR[meta.difficulty] || 'bg-n-50 text-n-600 border-n-200'}`}>
              {meta.difficulty}
            </span>
          )}
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs font-body text-n-600">
          {meta.duration && (
            <div className="flex items-center gap-1.5">
              <Clock size={12} strokeWidth={1.75} className="text-n-400 shrink-0" />
              <span>{meta.duration}h</span>
            </div>
          )}
          {unit.capacity && (
            <div className="flex items-center gap-1.5">
              <Users size={12} strokeWidth={1.75} className="text-n-400 shrink-0" />
              <span>Max {unit.capacity} pax</span>
            </div>
          )}
          {meta.start_time && (
            <div className="flex items-center gap-1.5">
              <Clock size={12} strokeWidth={1.75} className="text-ocean-500 shrink-0" />
              <span>{meta.start_time}</span>
            </div>
          )}
          {meta.min_age && (
            <div className="flex items-center gap-1.5">
              <span className="text-n-400">Min</span>
              <span>{meta.min_age} anos</span>
            </div>
          )}
        </div>

        {meta.meeting_point && (
          <div className="flex items-start gap-1.5 text-xs font-body text-n-500">
            <MapPin size={12} strokeWidth={1.75} className="text-n-400 shrink-0 mt-0.5" />
            <span className="truncate">{meta.meeting_point}</span>
          </div>
        )}

        {/* Languages */}
        {meta.languages?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {meta.languages.map(l => (
              <span key={l} className="text-[10px] font-mono font-medium px-1.5 py-0.5 bg-n-100 text-n-600 rounded-xs uppercase tracking-wide">
                {l}
              </span>
            ))}
          </div>
        )}

        {/* Prices + actions */}
        <div className="flex items-end justify-between mt-auto pt-2 border-t border-n-100">
          <div>
            <p className="font-display font-bold text-base text-ocean-700">
              €{Number(unit.base_price).toFixed(0)}<span className="text-xs font-body font-normal text-n-500">/adulto</span>
            </p>
            {meta.price_child && (
              <p className="text-xs font-body text-n-500">
                €{Number(meta.price_child).toFixed(0)} crianca
                {meta.price_private && ` · €${Number(meta.price_private).toFixed(0)} privado`}
              </p>
            )}
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              icon={Power}
              onClick={() => onToggle?.(unit)}
              aria-label={isActive ? 'Desactivar' : 'Activar'}
              className={isActive ? 'hover:text-error hover:bg-[var(--error-light)]' : 'hover:text-[var(--success)] hover:bg-[#ECFDF5]'}
            />
            <Button variant="ghost" size="sm" icon={Pencil} onClick={() => onEdit(unit)} aria-label="Editar" />
            <Button
              variant="ghost"
              size="sm"
              icon={Trash2}
              onClick={() => onDelete(unit)}
              className="hover:text-error hover:bg-[var(--error-light)]"
              aria-label="Eliminar"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function UnitList({ units, onEdit, onDelete, onToggle, operatorType }) {
  const t = useT();
  const isTour = operatorType === 'activity';

  if (!units.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-n-400">
        {isTour
          ? <Compass size={40} strokeWidth={1.25} className="mb-3" />
          : <Building2 size={40} strokeWidth={1.25} className="mb-3" />
        }
        <p className="font-body text-sm">{t('common.noResults')}</p>
        <p className="font-body text-xs mt-1">
          {isTour ? 'Crie o seu primeiro tour' : 'Crie a sua primeira unidade'}
        </p>
      </div>
    );
  }

  if (isTour) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {units.map(unit => (
          <TourCard
            key={unit.id}
            unit={unit}
            onEdit={onEdit}
            onDelete={onDelete}
            onToggle={onToggle}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {units.map((unit) => {
        const isActive = unit.status !== 'inactive';
        const thumb    = unit.images?.[0];

        return (
          <div
            key={unit.id}
            className={`bg-white rounded-md border shadow-sm flex flex-col overflow-hidden transition-opacity ${
              isActive ? 'border-n-200' : 'border-n-150 opacity-70'
            }`}
          >
            {thumb ? (
              <div className="h-36 overflow-hidden bg-n-100 shrink-0">
                <img
                  src={thumb}
                  alt={unit.name}
                  className="w-full h-full object-cover"
                  onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement.classList.add('flex','items-center','justify-center'); }}
                />
              </div>
            ) : (
              <div className="h-36 bg-n-50 flex items-center justify-center shrink-0 border-b border-n-100">
                <ImageOff size={28} strokeWidth={1.25} className="text-n-300" />
              </div>
            )}

            <div className="p-5 flex flex-col gap-3 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-display font-semibold text-sm text-n-900 truncate">{unit.name}</p>
                  <p className="text-xs font-body text-n-500 mt-0.5">{unit.unit_type}</p>
                </div>
                <Badge variant={isActive ? 'confirmed' : 'cancelled'}>
                  {isActive ? t('units.active') : t('units.inactive')}
                </Badge>
              </div>

              {unit.description && (
                <p className="text-xs font-body text-n-600 line-clamp-2 leading-relaxed">
                  {unit.description}
                </p>
              )}

              <div className="flex items-center justify-between mt-auto pt-2 border-t border-n-100">
                <div>
                  <p className="font-display font-bold text-base text-ocean-700">{formatPrice(unit)}</p>
                  <p className="text-xs font-body text-n-400">Cap. {unit.capacity}</p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Power}
                    onClick={() => onToggle?.(unit)}
                    aria-label={isActive ? 'Desactivar' : 'Activar'}
                    className={isActive ? 'hover:text-error hover:bg-[var(--error-light)]' : 'hover:text-[var(--success)] hover:bg-[#ECFDF5]'}
                  />
                  <Button variant="ghost" size="sm" icon={Pencil} onClick={() => onEdit(unit)} aria-label="Editar" />
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Trash2}
                    onClick={() => onDelete(unit)}
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
          </div>
        );
      })}
    </div>
  );
}
