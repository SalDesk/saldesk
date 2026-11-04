import { Building2, Compass, Pencil, Trash2, Power, ImageOff, Clock, MapPin, Users, QrCode, Plus } from 'lucide-react';
import { useT } from '../../i18n';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Card from '../ui/Card';
import EmptyState from '../ui/EmptyState';
import { parseTourMeta } from './UnitForm';
import ConectRow from '../shared/ConectRow';

function formatPrice(unit) {
  const labels = { night: '/noite', day: '/dia', hour: '/hora', session: '/sessao', person: '/pessoa' };
  return `€${Number(unit.base_price).toFixed(2)}${labels[unit.price_unit] || ''}`;
}

/* Variante do Badge do sistema para cada dificuldade */
const DIFFICULTY_VARIANT = {
  Facil:    'confirmed',
  Moderado: 'pending',
  Dificil:  'cancelled',
};

/* Botoes so com icone: o realce ao passar o rato depende do estado */
const TOGGLE_HOVER_ACTIVE   = 'hover:text-error hover:bg-[var(--error-light)]';
const TOGGLE_HOVER_INACTIVE = 'hover:text-[var(--success)] hover:bg-[var(--success-light)]';
const DELETE_HOVER          = 'hover:text-error hover:bg-[var(--error-light)]';

const TOUR_TYPE_LABEL = { grupo: 'Grupo', privado: 'Privado', ambos: 'Grupo / Privado' };

/* Cartao de unidade: o cartao do sistema, em coluna, com a miniatura a toda a largura */
function UnitCard({ isActive, children }) {
  return (
    <Card
      padding="p-0 flex flex-col flex-1"
      className={`flex flex-col overflow-hidden transition-opacity ${isActive ? '' : 'opacity-70'}`}
    >
      {children}
    </Card>
  );
}

function TourCard({ unit, onEdit, onDelete, onToggle, onSubmitConect }) {
  const isActive = unit.status !== 'inactive';
  const meta     = parseTourMeta(unit.description);
  const thumb    = unit.images?.[0];

  return (
    <UnitCard isActive={isActive}>
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
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-body px-2 py-0.5 bg-ocean-50 text-ocean-700 border border-ocean-100 rounded-xs">
            {unit.unit_type}
          </span>
          {meta.tour_type && (
            <span className="text-xs font-body px-2 py-0.5 bg-n-50 text-n-600 border border-n-200 rounded-xs">
              {TOUR_TYPE_LABEL[meta.tour_type] || meta.tour_type}
            </span>
          )}
          {meta.difficulty && (
            <Badge variant={DIFFICULTY_VARIANT[meta.difficulty] || 'default'}>
              {meta.difficulty}
            </Badge>
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
        {(() => {
          /* Preco por pessoa deixou de ser obrigatorio (pedido real de um
             operador -- Logan Tours -- cujo preco real e so por escalao/
             privado, nunca por pessoa). Sem base_price preenchido, mostra
             "A partir de" com o valor mais baixo entre os escaloes/preco
             privado configurados, em vez de "€0/adulto" enganoso. */
          const tiers = Array.isArray(meta.price_tiers) ? meta.price_tiers : [];
          const tierMin = tiers.length ? Math.min(...tiers.map(t => Number(t.price) || 0)) : null;
          const startingFrom = tierMin ?? (meta.price_private ? Number(meta.price_private) : null);
          const hasBasePrice = Number(unit.base_price) > 0;
          return (
            <div className="flex items-end justify-between mt-auto pt-2 border-t border-n-100">
              <div>
                {hasBasePrice ? (
                  <p className="font-display font-bold text-base text-ocean-700 tabular-nums">
                    €{Number(unit.base_price).toFixed(0)}<span className="text-xs font-body font-normal text-n-500">/adulto</span>
                  </p>
                ) : startingFrom != null ? (
                  <p className="font-display font-bold text-base text-ocean-700 tabular-nums">
                    <span className="text-xs font-body font-normal text-n-500">A partir de </span>€{startingFrom.toFixed(0)}
                  </p>
                ) : (
                  <p className="text-xs font-body text-n-400">Sem preço definido</p>
                )}
                {meta.price_child && (
                  <p className="text-xs font-body text-n-500 tabular-nums">
                    €{Number(meta.price_child).toFixed(0)} crianca
                    {hasBasePrice && meta.price_private && ` · €${Number(meta.price_private).toFixed(0)} privado`}
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
                  className={isActive ? TOGGLE_HOVER_ACTIVE : TOGGLE_HOVER_INACTIVE}
                />
                <Button variant="ghost" size="sm" icon={Pencil} onClick={() => onEdit(unit)} aria-label="Editar" />
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Trash2}
                  onClick={() => onDelete(unit)}
                  className={DELETE_HOVER}
                  aria-label="Eliminar"
                />
              </div>
            </div>
          );
        })()}
        <ConectRow unit={unit} onSubmitConect={onSubmitConect} />
      </div>
    </UnitCard>
  );
}

/* onCreate e createLabel sao opcionais: com onCreate o vazio traz o botao de criar */
export default function UnitList({ units, onEdit, onDelete, onToggle, onSubmitConect, onViewQr, operatorType, onCreate, createLabel }) {
  const t = useT();
  const isTour = operatorType === 'activity';

  if (!units.length) {
    return (
      <Card padding="p-0">
        <EmptyState
          icon={isTour ? Compass : Building2}
          title={t('common.noResults')}
          description={isTour ? 'Crie o seu primeiro tour' : 'Crie a sua primeira unidade'}
          action={onCreate && (
            <Button icon={Plus} onClick={onCreate}>
              {createLabel || (isTour ? 'Novo Tour' : 'Nova Unidade')}
            </Button>
          )}
        />
      </Card>
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
            onSubmitConect={onSubmitConect}
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
          <UnitCard key={unit.id} isActive={isActive}>
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

              {unit.description && !unit.description.startsWith('{') && (
                <p className="text-xs font-body text-n-600 line-clamp-2 leading-relaxed">
                  {unit.description}
                </p>
              )}

              <div className="flex items-center justify-between mt-auto pt-2 border-t border-n-100">
                <div>
                  <p className="font-display font-bold text-base text-ocean-700 tabular-nums">{formatPrice(unit)}</p>
                  <p className="text-xs font-body text-n-400">Cap. {unit.capacity}</p>
                </div>
                <div className="flex gap-1">
                  {operatorType === 'restaurant' && onViewQr && (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={QrCode}
                      onClick={() => onViewQr(unit)}
                      aria-label="Ver QR"
                    />
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Power}
                    onClick={() => onToggle?.(unit)}
                    aria-label={isActive ? 'Desactivar' : 'Activar'}
                    className={isActive ? TOGGLE_HOVER_ACTIVE : TOGGLE_HOVER_INACTIVE}
                  />
                  <Button variant="ghost" size="sm" icon={Pencil} onClick={() => onEdit(unit)} aria-label="Editar" />
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Trash2}
                    onClick={() => onDelete(unit)}
                    className={DELETE_HOVER}
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
              <ConectRow unit={unit} onSubmitConect={onSubmitConect} />
            </div>
          </UnitCard>
        );
      })}
    </div>
  );
}
