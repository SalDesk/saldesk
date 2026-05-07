const LANG_LABEL = { pt: '🇵🇹 PT', en: '🇬🇧 EN' };

export default function CustomerCard({ customer, onClick }) {
  return (
    <div
      onClick={() => onClick(customer)}
      className="card cursor-pointer hover:border-primary-300 hover:shadow-md transition-all border-2 border-transparent"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-500 flex items-center justify-center font-bold text-lg">
            {customer.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-gray-900">{customer.name}</p>
            <p className="text-xs text-gray-400">{customer.email}</p>
          </div>
        </div>
        <span className="text-xs text-gray-400">{LANG_LABEL[customer.language] || customer.language}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <p className="text-xl font-bold text-gray-900">{customer.total_visits}</p>
          <p className="text-xs text-gray-400">visitas</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <p className="text-xl font-bold text-primary-500">{Number(customer.total_spent).toFixed(0)} €</p>
          <p className="text-xs text-gray-400">total gasto</p>
        </div>
      </div>

      {customer.phone && (
        <p className="text-xs text-gray-400 mt-2">📞 {customer.phone}</p>
      )}
      {customer.country_code && (
        <p className="text-xs text-gray-400">🌍 {customer.country_code}</p>
      )}
    </div>
  );
}
