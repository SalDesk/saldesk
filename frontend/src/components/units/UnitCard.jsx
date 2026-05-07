const STATUS_LABEL = { active: 'Activa', inactive: 'Inactiva' };
const STATUS_COLOR = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-500'
};

export default function UnitCard({ unit, onEdit, onDelete }) {
  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">{unit.name}</h3>
          <p className="text-xs text-gray-400 mt-0.5">{unit.unit_type}</p>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLOR[unit.status]}`}>
          {STATUS_LABEL[unit.status]}
        </span>
      </div>

      {unit.description && (
        <p className="text-sm text-gray-500 line-clamp-2">{unit.description}</p>
      )}

      <div className="flex items-center justify-between text-sm pt-1 border-t border-gray-100">
        <span className="font-bold text-primary-500 text-base">
          {Number(unit.base_price).toFixed(2)} €
          <span className="text-xs text-gray-400 font-normal"> / noite</span>
        </span>
        <span className="text-gray-400">Cap. {unit.capacity}</span>
      </div>

      {unit.pricing_rules?.length > 0 && (
        <p className="text-xs text-accent font-medium">
          {unit.pricing_rules.filter((r) => r.active).length} regra(s) de preço activa(s)
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <button onClick={() => onEdit(unit)} className="btn-secondary text-sm flex-1 py-1.5">
          Editar
        </button>
        <button onClick={() => onDelete(unit)} className="btn-danger text-sm px-3 py-1.5">
          Eliminar
        </button>
      </div>
    </div>
  );
}
