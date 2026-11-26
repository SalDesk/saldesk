import { Building2, Compass, Pencil, Trash2, Power, ImageOff, Clock, MapPin, Users, QrCode, Plus } from 'lucide-react';
import { useT } from '../../i18n';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import EmptyState from '../ui/EmptyState';
import { parseTourMeta } from './UnitForm';
import ConectRow from '../shared/ConectRow';
import { formatarNumero, useLingua } from '../../utils/formatoLingua';
import { rotuloDificuldade, rotuloTipoUnidade } from './rotulosUnidades';

/* Valor em euros: em pt como sempre (toFixed, ponto decimal); nas outras linguas com os separadores da lingua */
function dinheiro(valor, casas, lang) {
  const n = Number(valor);
  if (lang === 'pt') return n.toFixed(casas);
  return formatarNumero(n, { minimumFractionDigits: casas, maximumFractionDigits: casas }, lang);
}

const UNIDADES_PRECO = ['night', 'day', 'hour', 'session', 'person'];

function formatPrice(unit, t, lang) {
  const sufixo = UNIDADES_PRECO.includes(unit.price_unit) ? t(`units.list.priceUnit.${unit.price_unit}`) : '';
  return `€${dinheiro(unit.base_price, 2, lang)}${sufixo}`;
}

/* Variante do Badge do sistema para cada dificuldade */
const DIFFICULTY_VARIANT = {
  Facil:    'confirmed',
  Moderado: 'pending',
  Dificil:  'cancelled',
};

/* Botoes so com icone: nativos, com 44 px no telemovel; o realce ao passar o rato depende da accao */
const ICONE_BASE = 'inline-flex items-center justify-center min-h-11 min-w-11 md:min-h-9 md:min-w-9 rounded-full text-n-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sand-500';
const TOGGLE_HOVER_ACTIVE   = 'hover:text-error hover:bg-[var(--error-light)]';
const TOGGLE_HOVER_INACTIVE = 'hover:text-[var(--success)] hover:bg-[var(--success-light)]';
const EDIT_HOVER            = 'hover:text-ocean-700 hover:bg-ocean-50';
const DELETE_HOVER          = 'hover:text-error hover:bg-[var(--error-light)]';

function IconBtn({ icon: Icon, label, onClick, hover }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className={`${ICONE_BASE} ${hover}`}>
      <Icon size={16} strokeWidth={1.75} />
    </button>
  );
}

/* tipos de tour gravados em meta.tour_type; o texto vem de units.list.tourType */
const TOUR_TYPES = ['grupo', 'privado', 'ambos'];

/* Cartao de unidade Mare: em coluna, com a miniatura a toda a largura */
function UnitCard({ isActive, children }) {
  return (
    <div className={`flex flex-col flex-1 overflow-hidden rounded-[18px] border border-mare-card bg-white transition-opacity ${isActive ? '' : 'opacity-70'}`}>
      {children}
    </div>
  );
}

function TourCard({ unit, onEdit, onDelete, onToggle, onSubmitConect }) {
  const t        = useT();
  const lang     = useLingua();
  const isActive = unit.status !== 'inactive';
  const meta     = parseTourMeta(unit.description);
  const thumb    = unit.images?.[0];

  return (
    <UnitCard isActive={isActive}>
      {thumb ? (
        <div className="h-36 overflow-hidden bg-mare-head shrink-0">
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
        <div className="h-36 bg-mare-head flex items-center justify-center shrink-0 border-b border-mare-card">
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
            {isActive ? t('unitForm.status.active') : t('unitForm.status.inactive')}
          </Badge>
        </div>

        {/* Tags row */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-body font-medium px-2.5 py-0.5 bg-ocean-50 text-ocean-700 rounded-full">
            {rotuloTipoUnidade(unit.unit_type, t, lang)}
          </span>
          {meta.tour_type && (
            <span className="text-xs font-body font-medium px-2.5 py-0.5 bg-mare-head text-n-600 border border-mare-card rounded-full">
              {TOUR_TYPES.includes(meta.tour_type) ? t(`units.list.tourType.${meta.tour_type}`) : meta.tour_type}
            </span>
          )}
          {meta.difficulty && (
            <Badge variant={DIFFICULTY_VARIANT[meta.difficulty] || 'default'}>
              {rotuloDificuldade(meta.difficulty, t)}
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
              <span>{t('units.list.maxPax', { n: unit.capacity })}</span>
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
              <span className="text-n-400">{t('units.list.minLabel')}</span>
              <span>{t('units.list.years', { n: meta.min_age })}</span>
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
              <span key={l} className="text-[10px] font-mono font-medium px-2 py-0.5 bg-mare-head text-n-600 border border-mare-card rounded-full uppercase tracking-wide">
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
          const tierMin = tiers.length ? Math.min(...tiers.map(tier => Number(tier.price) || 0)) : null;
          const startingFrom = tierMin ?? (meta.price_private ? Number(meta.price_private) : null);
          const hasBasePrice = Number(unit.base_price) > 0;
          return (
            <div className="flex items-end justify-between mt-auto pt-2 border-t border-mare-card">
              <div>
                {hasBasePrice ? (
                  <p className="font-mono font-semibold text-base text-ocean-900 tabular-nums">
                    €{dinheiro(unit.base_price, 0, lang)}<span className="text-xs font-body font-normal text-n-500">{t('units.list.perAdult')}</span>
                  </p>
                ) : startingFrom != null ? (
                  <p className="font-mono font-semibold text-base text-ocean-900 tabular-nums">
                    <span className="text-xs font-body font-normal text-n-500">{t('units.list.from')} </span>€{dinheiro(startingFrom, 0, lang)}
                  </p>
                ) : (
                  <p className="text-xs font-body text-n-400">{t('units.list.noPrice')}</p>
                )}
                {meta.price_child != null && meta.price_child !== '' && (
                  <p className="text-xs font-body text-n-500 tabular-nums">
                    {t('units.list.childAmount', { n: dinheiro(meta.price_child, 0, lang) })}
                    {hasBasePrice && meta.price_private && ` · ${t('units.list.privateAmount', { n: dinheiro(meta.price_private, 0, lang) })}`}
                  </p>
                )}
              </div>
              <div className="flex gap-1">
                <IconBtn icon={Power} onClick={() => onToggle?.(unit)} label={isActive ? t('units.list.deactivate') : t('units.list.activate')} hover={isActive ? TOGGLE_HOVER_ACTIVE : TOGGLE_HOVER_INACTIVE} />
                <IconBtn icon={Pencil} onClick={() => onEdit(unit)} label={t('units.list.edit')} hover={EDIT_HOVER} />
                <IconBtn icon={Trash2} onClick={() => onDelete(unit)} label={t('common.delete')} hover={DELETE_HOVER} />
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
  const lang = useLingua();
  const isTour = operatorType === 'activity';

  if (!units.length) {
    return (
      <div className="rounded-[18px] border border-mare-card bg-white">
        <EmptyState
          icon={isTour ? Compass : Building2}
          title={t('common.noResults')}
          description={isTour ? t('units.list.emptyTour') : t('units.list.emptyUnit')}
          action={onCreate && (
            <Button icon={Plus} onClick={onCreate}>
              {createLabel || (isTour ? t('units.page.activity.newBtn') : t('units.new'))}
            </Button>
          )}
        />
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
              <div className="h-36 overflow-hidden bg-mare-head shrink-0">
                <img
                  src={thumb}
                  alt={unit.name}
                  className="w-full h-full object-cover"
                  onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement.classList.add('flex','items-center','justify-center'); }}
                />
              </div>
            ) : (
              <div className="h-36 bg-mare-head flex items-center justify-center shrink-0 border-b border-mare-card">
                <ImageOff size={28} strokeWidth={1.25} className="text-n-300" />
              </div>
            )}

            <div className="p-5 flex flex-col gap-3 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-display font-semibold text-sm text-n-900 truncate">{unit.name}</p>
                  <p className="text-xs font-body text-n-500 mt-0.5">{rotuloTipoUnidade(unit.unit_type, t, lang)}</p>
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

              <div className="flex items-center justify-between mt-auto pt-2 border-t border-mare-card">
                <div>
                  <p className="font-mono font-semibold text-base text-ocean-900 tabular-nums">{formatPrice(unit, t, lang)}</p>
                  <p className="text-xs font-body text-n-400">{t('units.list.capacity', { n: unit.capacity })}</p>
                </div>
                <div className="flex gap-1">
                  {operatorType === 'restaurant' && onViewQr && (
                    <IconBtn icon={QrCode} onClick={() => onViewQr(unit)} label={t('units.list.viewQr')} hover={EDIT_HOVER} />
                  )}
                  <IconBtn icon={Power} onClick={() => onToggle?.(unit)} label={isActive ? t('units.list.deactivate') : t('units.list.activate')} hover={isActive ? TOGGLE_HOVER_ACTIVE : TOGGLE_HOVER_INACTIVE} />
                  <IconBtn icon={Pencil} onClick={() => onEdit(unit)} label={t('units.list.edit')} hover={EDIT_HOVER} />
                  <IconBtn icon={Trash2} onClick={() => onDelete(unit)} label={t('common.delete')} hover={DELETE_HOVER} />
                </div>
              </div>

              {unit.pricing_rules?.filter((r) => r.active).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {unit.pricing_rules.filter((r) => r.active).slice(0, 2).map((r) => (
                    <span key={r.id} className="text-xs font-body font-medium px-2.5 py-0.5 bg-sand-100 text-n-800 rounded-full">
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
