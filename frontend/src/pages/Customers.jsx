import { usePageTitle } from '../hooks/usePageTitle';
import { useState, useEffect, useCallback } from 'react';
import CustomerCard from '../components/crm/CustomerCard';
import CustomerDetail from '../components/crm/CustomerDetail';
import { listCustomers } from '../services/customersService';
import useAuthStore from '../store/authStore';

export default function Customers() {
  usePageTitle('Clientes');
  const token = useAuthStore((s) => s.token);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [detalheId, setDetalheId] = useState(null);

  const carregar = useCallback(async (q = search) => {
    setLoading(true);
    try {
      const filtros = {};
      if (q) filtros.search = q;
      const { data } = await listCustomers(token, filtros);
      setCustomers(data);
    } finally {
      setLoading(false);
    }
  }, [token, search]);

  useEffect(() => { carregar(''); }, []);

  function handleSearch(e) {
    e.preventDefault();
    carregar(search);
  }

  function handleUpdate(updated) {
    setCustomers(customers.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
  }

  const totalGasto = customers.reduce((sum, c) => sum + Number(c.total_spent), 0);
  const totalVisitas = customers.reduce((sum, c) => sum + c.total_visits, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-500 text-sm mt-1">{customers.length} cliente(s) registado(s)</p>
        </div>
      </div>

      {/* Stats rápidas */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total de clientes', value: customers.length, icon: '👥' },
          { label: 'Total de visitas', value: totalVisitas, icon: '🏨' },
          { label: 'Receita total (CRM)', value: `${totalGasto.toFixed(2)} €`, icon: '💰' }
        ].map(({ label, value, icon }) => (
          <div key={label} className="card flex items-center gap-3 py-4">
            <span className="text-2xl">{icon}</span>
            <div>
              <p className="text-xs text-gray-400">{label}</p>
              <p className="text-xl font-bold text-gray-900">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Pesquisa */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <input
          type="text"
          className="input flex-1"
          placeholder="Pesquisar por nome ou email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="submit" className="btn-primary px-5">Pesquisar</button>
        {search && (
          <button type="button" onClick={() => { setSearch(''); carregar(''); }} className="btn-secondary px-3">
            Limpar
          </button>
        )}
      </form>

      {loading ? (
        <div className="text-center py-16 text-gray-400">A carregar...</div>
      ) : customers.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-4">👥</div>
          <p className="font-medium">
            {search ? 'Nenhum cliente encontrado' : 'Sem clientes ainda'}
          </p>
          <p className="text-sm mt-1">Os clientes são criados automaticamente a cada nova reserva</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {customers.map((c) => (
            <CustomerCard key={c.id} customer={c} onClick={(c) => setDetalheId(c.id)} />
          ))}
        </div>
      )}

      {detalheId && (
        <CustomerDetail
          customerId={detalheId}
          onClose={() => setDetalheId(null)}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  );
}
