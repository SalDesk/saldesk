import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

const hoje = new Date().toISOString().split('T')[0];

const TYPE_LABEL = {
  hotel: 'Hotel / Alojamento',
  activity: 'Actividade Turística',
  rentacar: 'Rent-a-Car',
  restaurant: 'Restaurante / Bar'
};

function fmt(date) {
  return new Date(date + 'T00:00:00').toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' });
}

// --- Passo 1: Seleccionar unidade e datas ---
function SelectorUnidade({ units, onNext }) {
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [disponibilidade, setDisponibilidade] = useState({});
  const [verificando, setVerificando] = useState(false);
  const { slug } = useParams();

  async function verificar() {
    if (!checkIn || !checkOut || checkOut <= checkIn) return;
    setVerificando(true);
    const results = {};
    await Promise.all(
      units.map(async (u) => {
        try {
          const params = new URLSearchParams({ unitId: u.id, checkIn, checkOut });
          const res = await fetch(`/public/${slug}/availability?${params}`);
          const json = await res.json();
          results[u.id] = json.data;
        } catch {
          results[u.id] = { disponivel: false };
        }
      })
    );
    setDisponibilidade(results);
    setVerificando(false);
  }

  useEffect(() => {
    if (checkIn && checkOut && checkOut > checkIn) verificar();
  }, [checkIn, checkOut]);

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">Fazer Reserva</h2>
      <p className="text-gray-500 text-sm mb-6">Seleccione as datas e a unidade desejada</p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="label">Check-in</label>
          <input type="date" className="input" value={checkIn} min={hoje}
            onChange={(e) => setCheckIn(e.target.value)} />
        </div>
        <div>
          <label className="label">Check-out</label>
          <input type="date" className="input" value={checkOut} min={checkIn || hoje}
            onChange={(e) => setCheckOut(e.target.value)} />
        </div>
      </div>

      {verificando && <p className="text-sm text-gray-400 mb-4">A verificar disponibilidade...</p>}

      <div className="space-y-3">
        {units.map((u) => {
          const info = disponibilidade[u.id];
          const temDatas = checkIn && checkOut && checkOut > checkIn;
          const disponivel = !temDatas || !info || info.disponivel;

          return (
            <div key={u.id} className={`border-2 rounded-xl p-4 transition-all ${
              !temDatas ? 'border-gray-200' :
              disponivel ? 'border-green-300 bg-green-50/50' : 'border-gray-200 bg-gray-50 opacity-60'
            }`}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{u.name}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{u.unit_type} · Cap. {u.capacity}</p>
                  {u.description && <p className="text-sm text-gray-500 mt-2">{u.description}</p>}
                </div>
                <div className="text-right shrink-0 ml-4">
                  <p className="text-lg font-bold text-primary-500">
                    {info?.total_price != null
                      ? `${Number(info.total_price).toFixed(2)} €`
                      : `${Number(u.base_price).toFixed(2)} €`}
                  </p>
                  <p className="text-xs text-gray-400">
                    {info?.dias ? `${info.dias} noite(s)` : 'por noite'}
                  </p>
                </div>
              </div>
              {temDatas && disponivel && (
                <button
                  onClick={() => onNext(u, checkIn, checkOut, info?.total_price)}
                  className="btn-primary w-full mt-3 py-2"
                >
                  Reservar esta unidade
                </button>
              )}
              {temDatas && !disponivel && (
                <p className="text-sm text-red-500 mt-2 font-medium">Indisponível nas datas seleccionadas</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Passo 2: Formulário do cliente ---
function FormularioCliente({ unit, checkIn, checkOut, totalPrice, slug, onBack, onConfirm }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', country: '', guests: 1, notes: '' });
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setErro('');
    setLoading(true);
    try {
      const res = await fetch(`/public/${slug}/reservations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unit_id: unit.id,
          customer_name: form.name,
          customer_email: form.email,
          customer_phone: form.phone || null,
          customer_country: form.country || null,
          check_in: checkIn,
          check_out: checkOut,
          guests: Number(form.guests),
          notes: form.notes || null
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      onConfirm(json.data);
    } catch (err) {
      setErro(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-primary-50 rounded-xl p-4 text-sm text-primary-700 mb-2">
        <p className="font-semibold">{unit.name}</p>
        <p>{fmt(checkIn)} → {fmt(checkOut)}</p>
        {totalPrice && <p className="font-bold mt-1">Total: {Number(totalPrice).toFixed(2)} €</p>}
      </div>

      <div>
        <label className="label">Nome completo *</label>
        <input type="text" className="input" value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })} required autoFocus />
      </div>
      <div>
        <label className="label">Email *</label>
        <input type="email" className="input" value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Telefone</label>
          <input type="tel" className="input" value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div>
          <label className="label">País</label>
          <input type="text" className="input" value={form.country} placeholder="PT, GB..."
            onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })} maxLength={2} />
        </div>
      </div>
      <div>
        <label className="label">Número de hóspedes</label>
        <input type="number" className="input" value={form.guests} min={1} max={unit.capacity}
          onChange={(e) => setForm({ ...form, guests: e.target.value })} />
      </div>
      <div>
        <label className="label">Notas / pedidos especiais</label>
        <textarea className="input resize-none" rows={2} value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </div>

      {erro && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{erro}</p>}

      <div className="flex gap-3">
        <button type="button" onClick={onBack} className="btn-secondary flex-1">Voltar</button>
        <button type="submit" className="btn-primary flex-1" disabled={loading}>
          {loading ? 'A submeter...' : 'Confirmar reserva'}
        </button>
      </div>
    </form>
  );
}

// --- Passo 3: Confirmação ---
function Confirmacao({ reserva }) {
  return (
    <div className="text-center py-4">
      <div className="text-6xl mb-4">✅</div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Reserva submetida!</h2>
      <p className="text-gray-500 mb-4">
        Obrigado, <strong>{reserva.customer_name}</strong>. A sua reserva foi recebida e aguarda confirmação.
      </p>
      <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 text-left">
        <p>📧 Confirmação enviada para: <strong>{reserva.customer_email}</strong></p>
        <p className="mt-1">🔑 Referência: <code className="bg-gray-200 px-1 rounded">{reserva.id.slice(0, 8).toUpperCase()}</code></p>
      </div>
    </div>
  );
}

// --- Página principal ---
export default function PublicBooking() {
  const { slug } = useParams();
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [passo, setPasso] = useState(1);
  const [seleccao, setSeleccao] = useState(null); // { unit, checkIn, checkOut, totalPrice }
  const [reservaConfirmada, setReservaConfirmada] = useState(null);

  useEffect(() => {
    fetch(`/public/${slug}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.data) setDados(json.data);
        else setErro('Página não encontrada');
      })
      .catch(() => setErro('Erro ao carregar a página'))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center text-gray-400">A carregar...</div>
  );

  if (erro) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-6xl mb-4">🔍</p>
        <h1 className="text-xl font-bold text-gray-900">{erro}</h1>
      </div>
    </div>
  );

  const { operator, units } = dados;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-primary-500 text-white py-6 px-4 text-center">
        <h1 className="text-2xl font-bold">{operator.name}</h1>
        <p className="text-primary-100 text-sm mt-1">{TYPE_LABEL[operator.operator_type]}</p>
        {operator.address && <p className="text-primary-200 text-xs mt-1">📍 {operator.address}</p>}
      </header>

      <main className="max-w-lg mx-auto p-4 py-8">
        <div className="card">
          {passo === 1 && (
            <SelectorUnidade
              units={units}
              onNext={(unit, checkIn, checkOut, totalPrice) => {
                setSeleccao({ unit, checkIn, checkOut, totalPrice });
                setPasso(2);
              }}
            />
          )}
          {passo === 2 && seleccao && (
            <FormularioCliente
              {...seleccao}
              slug={slug}
              onBack={() => setPasso(1)}
              onConfirm={(reserva) => { setReservaConfirmada(reserva); setPasso(3); }}
            />
          )}
          {passo === 3 && reservaConfirmada && (
            <Confirmacao reserva={reservaConfirmada} />
          )}
        </div>
      </main>

      <footer className="text-center py-6 text-xs text-gray-400">
        Powered by <strong>SalDesk</strong> · Gestão Turística · Ilha do Sal
      </footer>
    </div>
  );
}
