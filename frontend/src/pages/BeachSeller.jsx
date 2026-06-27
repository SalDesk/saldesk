import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Euro, Clock, Check, Calendar,
  TrendingUp, LogOut, BarChart2, ChevronRight,
} from 'lucide-react';
import { listReservations } from '../services/reservationsService';
import {
  listSellerCommissions, markCommissionPaid, getSellerCommissionPct,
} from '../services/sellerService';
import useAuthStore from '../store/authStore';

/* ── helpers ── */
const TODAY = new Date().toISOString().slice(0, 10);
const MONTHS_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00Z').toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
}

function fmtMoney(v) {
  return `€${Number(v || 0).toFixed(0)}`;
}

function thisMonth() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
}

const STATUS_CFG = {
  pending:     { label: 'Pendente',   cls: 'bg-n-100 text-n-600'              },
  confirmed:   { label: 'Confirmado', cls: 'bg-ocean-50 text-ocean-700'       },
  checked_in:  { label: 'Activo',     cls: 'bg-[#ECFDF5] text-[#1A7A4A]'     },
  checked_out: { label: 'Concluido',  cls: 'bg-n-100 text-n-500'              },
  cancelled:   { label: 'Cancelado',  cls: 'bg-red-50 text-error'             },
};

/* ─────────────────────── Main ─────────────────────── */
export default function BeachSeller() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const sellerId   = user?.user_metadata?.staff_id || user?.id || 'unknown';
  const sellerName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Vendedor';
  const commPct    = getSellerCommissionPct(sellerId, 10);
  const month      = thisMonth();

  const [activeTab,    setActiveTab]    = useState('hoje');
  const [reservations, setReservations] = useState([]);
  const [commissions,  setCommissions]  = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [payingId,     setPayingId]     = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      listReservations({ from: TODAY, to: TODAY }).catch(() => []),
      listSellerCommissions(sellerId),
    ]).then(([res, comms]) => {
      // Filter reservations by this seller
      const myRes = (res || []).filter(r => {
        const notes = r.notes || '';
        return notes.includes(sellerId) || notes.includes(sellerName);
      });
      setReservations(myRes);
      setCommissions(comms || []);
    }).finally(() => setLoading(false));
  }, [sellerId]);

  /* Commission stats */
  const monthComms = useMemo(() =>
    commissions.filter(c => c.created_at?.startsWith(month)),
    [commissions, month],
  );

  const totalMonth   = monthComms.reduce((s, c) => s + c.amount, 0);
  const totalPaid    = monthComms.filter(c => c.status === 'paid').reduce((s, c) => s + c.amount, 0);
  const totalPending = monthComms.filter(c => c.status === 'pending').reduce((s, c) => s + c.amount, 0);

  async function handleMarkPaid(commId) {
    setPayingId(commId);
    await markCommissionPaid(commId, 'Pago pelo gestor');
    setCommissions(prev =>
      prev.map(c => c.id === commId ? { ...c, status: 'paid', paid_at: new Date().toISOString() } : c),
    );
    setPayingId(null);
  }

  function handleLogout() { logout(); navigate('/login'); }

  return (
    <div className="min-h-screen bg-n-50 flex flex-col max-w-md mx-auto">
      {/* Header */}
      <header className="bg-ocean-900 px-4 pt-5 pb-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-ocean-400 text-[10px] font-mono uppercase tracking-wider">SalDesk · Vendedor</p>
            <p className="font-display font-bold text-xl text-white mt-0.5">{sellerName}</p>
          </div>
          <button onClick={handleLogout}
            className="p-2 rounded-full hover:bg-ocean-800 transition-colors">
            <LogOut size={18} strokeWidth={1.75} className="text-ocean-400" />
          </button>
        </div>
        {/* Monthly summary */}
        <div className="flex gap-3">
          <div className="flex-1 bg-ocean-800 rounded-xl px-3 py-2.5">
            <p className="text-ocean-400 text-[10px] font-mono uppercase">Este mes</p>
            <p className="font-display font-bold text-lg text-white">{fmtMoney(totalMonth)}</p>
          </div>
          <div className="flex-1 bg-ocean-800 rounded-xl px-3 py-2.5">
            <p className="text-ocean-400 text-[10px] font-mono uppercase">Pendente</p>
            <p className="font-display font-bold text-lg text-sand-300">{fmtMoney(totalPending)}</p>
          </div>
          <div className="flex-1 bg-ocean-800 rounded-xl px-3 py-2.5">
            <p className="text-ocean-400 text-[10px] font-mono uppercase">Pago</p>
            <p className="font-display font-bold text-lg text-[#4ADE80]">{fmtMoney(totalPaid)}</p>
          </div>
        </div>
      </header>

      {/* CTA */}
      <div className="px-4 pt-5 pb-2">
        <button
          onClick={() => navigate('/vendedor/nova-reserva')}
          className="w-full h-16 bg-ocean-700 text-white rounded-2xl font-display font-bold text-xl flex items-center justify-center gap-3 active:scale-[0.99] transition-all hover:bg-ocean-800 shadow-lg shadow-ocean-200">
          <Plus size={26} strokeWidth={2.5} />
          Nova Reserva
        </button>
      </div>

      {/* Tabs */}
      <div className="flex mx-4 mt-4 gap-1 bg-n-100 rounded-xl p-1">
        {[
          { key: 'hoje',      label: 'Hoje'            },
          { key: 'comissoes', label: 'Minhas Comissoes' },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-body font-semibold transition-colors ${
              activeTab === t.key ? 'bg-white text-ocean-700 shadow-sm' : 'text-n-500'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <main className="flex-1 px-4 py-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-3 border-ocean-200 border-t-ocean-700 rounded-full animate-spin" />
          </div>
        ) : activeTab === 'hoje' ? (
          reservations.length === 0 ? (
            <div className="text-center py-16 text-n-400">
              <Calendar size={40} strokeWidth={1} className="mx-auto mb-3 text-n-300" />
              <p className="font-body font-semibold text-n-600">Sem reservas hoje</p>
              <p className="text-sm font-body text-n-400 mt-1">
                Usa o botao "Nova Reserva" para registar vendas.
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs font-mono uppercase tracking-wider text-n-500 mb-2">
                {reservations.length} reserva(s) hoje
              </p>
              {reservations.map(r => {
                const sc  = STATUS_CFG[r.status] || STATUS_CFG.pending;
                const val = Number(r.total_price || 0);
                const com = val * (commPct / 100);
                return (
                  <div key={r.id} className="bg-white rounded-2xl border border-n-200 px-4 py-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-display font-semibold text-n-900 truncate">
                          {r.units?.name || r.unit_name || '—'}
                        </p>
                        <p className="text-sm font-body text-n-500 mt-0.5">
                          {r.customers?.first_name || r.customer_name || '—'} · {r.guests || 1} pax
                        </p>
                      </div>
                      <span className={`text-xs font-mono px-2 py-1 rounded-lg shrink-0 ${sc.cls}`}>
                        {sc.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-n-100">
                      <div className="flex items-center gap-1 text-n-500">
                        <Clock size={13} strokeWidth={1.75} />
                        <span className="text-sm font-body">{r.check_in}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-display font-bold text-ocean-700">{fmtMoney(val)}</p>
                        <p className="text-xs font-body text-[#1A7A4A]">Comissao: {fmtMoney(com)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )
        ) : (
          /* Tab comissoes */
          <div className="space-y-4">
            {/* Stats cards */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Total',    value: fmtMoney(totalMonth),   color: 'text-n-900',     bg: 'bg-white'       },
                { label: 'Pago',     value: fmtMoney(totalPaid),    color: 'text-[#1A7A4A]', bg: 'bg-[#ECFDF5]'  },
                { label: 'Pendente', value: fmtMoney(totalPending), color: 'text-yellow-700', bg: 'bg-yellow-50'  },
              ].map(m => (
                <div key={m.label} className={`${m.bg} rounded-xl border border-n-200 px-3 py-3 text-center`}>
                  <p className={`font-display font-bold text-lg ${m.color}`}>{m.value}</p>
                  <p className="text-[10px] font-mono text-n-400 mt-0.5">{m.label}</p>
                </div>
              ))}
            </div>

            {/* Commission list */}
            {monthComms.length === 0 ? (
              <div className="text-center py-12 text-n-400">
                <BarChart2 size={36} strokeWidth={1} className="mx-auto mb-3 text-n-300" />
                <p className="font-body">Sem comissoes este mes.</p>
                <p className="text-sm text-n-400 mt-1">As comissoes aparecem aqui apos cada venda.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-mono uppercase tracking-wider text-n-500">
                  Historico — {MONTHS_PT[new Date().getMonth()]}
                </p>
                {[...monthComms].sort((a, b) => b.created_at.localeCompare(a.created_at)).map(c => (
                  <div key={c.id} className="bg-white rounded-xl border border-n-200 px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-body font-semibold text-n-800 truncate">{c.tour_name}</p>
                        <p className="text-xs font-mono text-n-400 mt-0.5">
                          {fmtDate(c.created_at?.slice(0, 10))}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-display font-bold text-lg text-[#1A7A4A]">{fmtMoney(c.amount)}</p>
                        <p className="text-[10px] font-body text-n-400">{c.percentage}% de {fmtMoney(c.total_amount)}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-n-100">
                      <span className={`text-xs font-mono px-2 py-0.5 rounded-lg ${c.status === 'paid' ? 'bg-[#ECFDF5] text-[#1A7A4A]' : 'bg-yellow-50 text-yellow-700'}`}>
                        {c.status === 'paid' ? 'Pago' : 'Pendente'}
                      </span>
                      {c.status === 'pending' && (
                        <button
                          onClick={() => handleMarkPaid(c.id)}
                          disabled={payingId === c.id}
                          className="text-xs font-body text-ocean-700 hover:underline disabled:opacity-50">
                          Registar pagamento
                        </button>
                      )}
                      {c.status === 'paid' && c.paid_at && (
                        <span className="text-xs font-mono text-n-400">{fmtDate(c.paid_at.slice(0, 10))}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
