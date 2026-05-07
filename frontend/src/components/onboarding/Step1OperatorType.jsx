const tipos = [
  { value: 'hotel', label: 'Hotel / Alojamento', icon: '🏨', desc: 'Quartos, apartamentos, villas' },
  { value: 'activity', label: 'Actividade Turística', icon: '🤿', desc: 'Mergulho, passeios, excursões' },
  { value: 'rentacar', label: 'Rent-a-Car', icon: '🚗', desc: 'Aluguer de veículos' },
  { value: 'restaurant', label: 'Restaurante / Bar', icon: '🍽️', desc: 'Restauração e bebidas' }
];

export default function Step1OperatorType({ onNext }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Qual é o seu tipo de negócio?</h2>
      <p className="text-sm text-gray-500 mb-6">Escolha a categoria que melhor descreve a sua actividade.</p>
      <div className="grid grid-cols-2 gap-3">
        {tipos.map(({ value, label, icon, desc }) => (
          <button
            key={value}
            onClick={() => onNext(value)}
            className="p-4 border-2 border-gray-200 rounded-xl text-left hover:border-primary-500 hover:bg-primary-50 transition-all group"
          >
            <div className="text-3xl mb-2">{icon}</div>
            <div className="font-semibold text-sm text-gray-900 group-hover:text-primary-500">{label}</div>
            <div className="text-xs text-gray-500 mt-1">{desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
