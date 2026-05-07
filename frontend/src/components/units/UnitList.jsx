import UnitCard from './UnitCard';

export default function UnitList({ units, onEdit, onDelete }) {
  if (units.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <div className="text-5xl mb-4">🏠</div>
        <p className="font-medium">Ainda não tem unidades</p>
        <p className="text-sm mt-1">Clique em "Nova Unidade" para começar</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {units.map((unit) => (
        <UnitCard key={unit.id} unit={unit} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
}
