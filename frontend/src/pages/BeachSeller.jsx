import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Euro, Clock, Check, Calendar, Sun,
  TrendingUp, LogOut, BarChart2, MapPin, User,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { listReservations } from '../services/reservationsService';
import {
  listSellerCommissions, markCommissionPaid, getSellerCommissionPct,
} from '../services/sellerService';
import useAuthStore from '../store/authStore';
import Logo from '../components/shared/Logo';

/* ── helpers ── */
const TODAY = new Date().toISOString().slice(0, 10);
const MONTHS_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const TOUR_ICON_BG = ['bg-turquoise-100 text-turquoise-700', 'bg-sand-100 text-sand-600', 'bg-ocean-100 text-ocean-700'];

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00Z').toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
}

function fmtMoney(v) {
  return `€${Number(v || 0).toFixed(0)}`;
}

const STATUS_CFG = {
  pending:     { label: 'Pendente',   cls: 'bg-sand-100 text-sand-600'         },
  confirmed:   { label: 'Confirmado', cls: 'bg-ocean-50 text-ocean-700'        },
  checked_in:  { label: 'Activo',     cls: 'bg-turquoise-100 text-turquoise-700' },
  checked_out: { label: 'Concluido',  cls: 'bg-n-100 text-n-500'               },
  cancelled:   { label: 'Cancelado',  cls: 'bg-red-50 text-error'              },
};

/* ─────────────────────── Main ─────────────────────── */
export default function BeachSeller() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const sellerId   = user?.user_metadata?.staff_id || user?.id || 'unknown';
  const sellerName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Vendedor';
  const commPct    = getSellerCommissionPct(sellerId, 10);

  const [activeTab,    setActiveTab]    = useState('hoje');
  const [reservations, setReservations] = useState([]);
  const [commissions,  setCommissions]  = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [payingId,     setPayingId]     = useState(null);
  const [viewMonth,    setViewMonth]    = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [reservMode,     setReservMode]     = useState('hoje'); // 'hoje' | 'mes'
  const [reservViewMonth, setReservViewMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  useEffect(() => {
    setLoading(true);
    Promise.all([
      // O backend ignora from/to e devolve sempre todo o historico — filtro feito no frontend
      listReservations().catch(() => []),
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

  /* Commission stats — mes actual fixo, usado no card do cabecalho */
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const totalCurrentMonth = useMemo(() =>
    commissions.filter(c => c.created_at?.startsWith(currentMonthKey)).reduce((s, c) => s + c.amount, 0),
    [commissions, currentMonthKey],
  );

  /* Commission stats — mes navegavel, usado na aba "Minhas Comissoes" */
  const monthKey = `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, '0')}`;
  const isCurrentMonth = viewMonth.year === now.getFullYear() && viewMonth.month === now.getMonth();

  const monthComms = useMemo(() =>
    commissions.filter(c => c.created_at?.startsWith(monthKey)),
    [commissions, monthKey],
  );

  const totalMonth   = monthComms.reduce((s, c) => s + c.amount, 0);
  const totalPaid    = monthComms.filter(c => c.status === 'paid').reduce((s, c) => s + c.amount, 0);
  const totalPending = monthComms.filter(c => c.status === 'pending').reduce((s, c) => s + c.amount, 0);

  /* Reservas de hoje — fixo, usado no card do cabecalho independentemente do modo da aba */
  const todayReservations = useMemo(() =>
    reservations.filter(r => r.check_in === TODAY),
    [reservations],
  );
  const totalToday = todayReservations.reduce((s, r) => s + Number(r.total_price || 0), 0);

  /* Reservas filtradas conforme o modo seleccionado na aba "Hoje" (hoje vs mes navegavel) */
  const reservMonthKey = `${reservViewMonth.year}-${String(reservViewMonth.month + 1).padStart(2, '0')}`;
  const isReservCurrentMonth = reservViewMonth.year === now.getFullYear() && reservViewMonth.month === now.getMonth();
  const reservationsFiltered = useMemo(() => {
    if (reservMode === 'hoje') return reservations.filter(r => r.check_in === TODAY);
    return reservations.filter(r => r.check_in?.startsWith(reservMonthKey));
  }, [reservations, reservMode, reservMonthKey]);

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
      <header className="bg-gradient-to-br from-ocean-900 to-ocean-700 px-5 pt-6 pb-6 rounded-b-3xl shadow-lg">
        <div className="flex items-center justify-between mb-5">
          <Logo white size="sm" />
          <div className="flex items-center gap-1">
            <button onClick={() => navigate('/vendedor/perfil')}
              className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all">
              <User size={18} strokeWidth={1.75} className="text-ocean-200" />
            </button>
            <button onClick={handleLogout}
              className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all">
              <LogOut size={18} strokeWidth={1.75} className="text-ocean-200" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-1">
          <Sun size={20} strokeWidth={1.75} className="text-sand-400" />
          <p className="font-display font-bold text-2xl text-white">Olá, {sellerName}</p>
        </div>
        <p className="text-ocean-300 text-sm font-body">Pronto para a próxima venda?</p>

        {/* Stats cards */}
        <div className="grid grid-cols-2 gap-3 mt-5">
          <div className="bg-sand-500 rounded-3xl p-4">
            <TrendingUp size={20} strokeWidth={1.75} className="text-ocean-900 mb-2" />
            <p className="font-display font-bold text-3xl text-ocean-900 leading-none">{fmtMoney(totalToday)}</p>
            <p className="text-ocean-900/70 text-xs font-body font-semibold mt-1.5">
              Hoje · {todayReservations.length} reserva(s)
            </p>
          </div>
          <div className="bg-gradient-to-br from-turquoise-600 to-turquoise-400 rounded-3xl p-4">
            <Euro size={20} strokeWidth={1.75} className="text-white mb-2" />
            <p className="font-display font-bold text-3xl text-white leading-none">{fmtMoney(totalCurrentMonth)}</p>
            <p className="text-white/80 text-xs font-body font-semibold mt-1.5">Comissão este mês</p>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex mx-4 mt-5 gap-1 bg-n-100 rounded-2xl p-1">
        {[
          { key: 'hoje',      label: 'Hoje'            },
          { key: 'comissoes', label: 'Minhas Comissoes' },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex-1 py-3 rounded-xl text-sm font-body font-semibold transition-colors ${
              activeTab === t.key ? 'bg-white text-ocean-700 shadow-sm' : 'text-n-500'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <main className="flex-1 px-4 py-4 space-y-3 pb-28">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-3 border-ocean-200 border-t-ocean-700 rounded-full animate-spin" />
          </div>
        ) : activeTab === 'hoje' ? (
          <>
            {/* Selector de modo */}
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={() => setReservMode('hoje')}
                className={`px-3 py-1.5 rounded-lg text-xs font-body font-semibold transition-colors ${
                  reservMode === 'hoje' ? 'bg-ocean-700 text-white' : 'bg-n-100 text-n-500'
                }`}
              >
                Hoje
              </button>
              <button
                onClick={() => setReservMode('mes')}
                className={`px-3 py-1.5 rounded-lg text-xs font-body font-semibold transition-colors ${
                  reservMode === 'mes' ? 'bg-ocean-700 text-white' : 'bg-n-100 text-n-500'
                }`}
              >
                Por mês
              </button>
            </div>

            {/* Navegacao de mes */}
            {reservMode === 'mes' && (
              <div className="flex items-center justify-between px-1 mb-3">
                <button
                  type="button"
                  onClick={() => setReservViewMonth(v => {
                    const m = v.month === 0 ? 11 : v.month - 1;
                    const y = v.month === 0 ? v.year - 1 : v.year;
                    return { year: y, month: m };
                  })}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-n-500 hover:bg-n-100 active:scale-95 transition-all"
                  aria-label="Mes anterior"
                >
                  <ChevronLeft size={18} strokeWidth={2} />
                </button>
                <p className="font-display font-bold text-base text-n-900">
                  {MONTHS_PT[reservViewMonth.month]} {reservViewMonth.year}
                </p>
                <button
                  type="button"
                  disabled={isReservCurrentMonth}
                  onClick={() => setReservViewMonth(v => {
                    const m = v.month === 11 ? 0 : v.month + 1;
                    const y = v.month === 11 ? v.year + 1 : v.year;
                    return { year: y, month: m };
                  })}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                    isReservCurrentMonth ? 'text-n-300 opacity-30 cursor-not-allowed' : 'text-n-500 hover:bg-n-100 active:scale-95'
                  }`}
                  aria-label="Mes seguinte"
                >
                  <ChevronRight size={18} strokeWidth={2} />
                </button>
              </div>
            )}

            {reservationsFiltered.length === 0 ? (
              <div className="text-center py-16 text-n-400">
                <Calendar size={40} strokeWidth={1} className="mx-auto mb-3 text-n-300" />
                <p className="font-body font-semibold text-n-600">
                  Sem reservas {reservMode === 'hoje' ? 'hoje' : `em ${MONTHS_PT[reservViewMonth.month]}`}
                </p>
                <p className="text-sm font-body text-n-400 mt-1">
                  Usa o botao "Nova Reserva" para registar vendas.
                </p>
              </div>
            ) : (
              <>
                <p className="text-xs font-mono uppercase tracking-wider text-n-500 mb-2">
                  {reservationsFiltered.length} reserva(s) {reservMode === 'hoje' ? 'hoje' : `em ${MONTHS_PT[reservViewMonth.month]}`}
                </p>
                {reservationsFiltered.map((r, i) => {
                const sc  = STATUS_CFG[r.status] || STATUS_CFG.pending;
                const val = Number(r.total_price || 0);
                const com = val * (commPct / 100);
                const iconBg = TOUR_ICON_BG[i % TOUR_ICON_BG.length];
                return (
                  <div key={r.id} className="bg-white rounded-3xl border border-n-200 shadow-sm px-4 py-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${iconBg}`}>
                        <MapPin size={18} strokeWidth={1.75} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-display font-bold text-base text-n-900 truncate">
                          {r.customers?.first_name || r.customer_name || '—'}
                        </p>
                        <p className="text-sm font-body text-n-500 mt-0.5 truncate">
                          {r.units?.name || r.unit_name || '—'} · {r.guests || 1} pax
                        </p>
                      </div>
                      <span className={`text-xs font-mono px-2 py-1 rounded-lg shrink-0 ${sc.cls}`}>
                        {sc.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-n-100">
                      <div className="flex items-center gap-1 text-n-500">
                        <Clock size={13} strokeWidth={1.75} />
                        <span className="text-sm font-body">{r.check_in}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-display font-bold text-lg text-ocean-700">{fmtMoney(val)}</p>
                        <p className="text-xs font-body text-turquoise-700">Comissao: {fmtMoney(com)}</p>
                      </div>
                    </div>
                  </div>
                );
                })}
              </>
            )}
          </>
        ) : (
          /* Tab comissoes */
          <div className="space-y-4">
            {/* Navegacao de mes */}
            <div className="flex items-center justify-between px-1">
              <button
                type="button"
                onClick={() => setViewMonth(v => {
                  const m = v.month === 0 ? 11 : v.month - 1;
                  const y = v.month === 0 ? v.year - 1 : v.year;
                  return { year: y, month: m };
                })}
                className="w-9 h-9 rounded-full flex items-center justify-center text-n-500 hover:bg-n-100 active:scale-95 transition-all"
                aria-label="Mes anterior"
              >
                <ChevronLeft size={18} strokeWidth={2} />
              </button>
              <p className="font-display font-bold text-base text-n-900">
                {MONTHS_PT[viewMonth.month]} {viewMonth.year}
              </p>
              <button
                type="button"
                disabled={isCurrentMonth}
                onClick={() => setViewMonth(v => {
                  const m = v.month === 11 ? 0 : v.month + 1;
                  const y = v.month === 11 ? v.year + 1 : v.year;
                  return { year: y, month: m };
                })}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                  isCurrentMonth ? 'text-n-300 opacity-30 cursor-not-allowed' : 'text-n-500 hover:bg-n-100 active:scale-95'
                }`}
                aria-label="Mes seguinte"
              >
                <ChevronRight size={18} strokeWidth={2} />
              </button>
            </div>

            {/* Stats cards */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Total',    value: fmtMoney(totalMonth),   color: 'text-n-900',         bg: 'bg-white'         },
                { label: 'Pago',     value: fmtMoney(totalPaid),    color: 'text-turquoise-700',  bg: 'bg-turquoise-50' },
                { label: 'Pendente', value: fmtMoney(totalPending), color: 'text-yellow-700',     bg: 'bg-yellow-50'     },
              ].map(m => (
                <div key={m.label} className={`${m.bg} rounded-2xl border border-n-200 px-3 py-3 text-center`}>
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
                  Historico — {MONTHS_PT[viewMonth.month]}
                </p>
                {[...monthComms].sort((a, b) => b.created_at.localeCompare(a.created_at)).map(c => (
                  <div key={c.id} className="bg-white rounded-2xl border border-n-200 px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-body font-semibold text-n-800 truncate">{c.tour_name}</p>
                        <p className="text-xs font-mono text-n-400 mt-0.5">
                          {fmtDate(c.created_at?.slice(0, 10))}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-display font-bold text-lg text-turquoise-700">{fmtMoney(c.amount)}</p>
                        <p className="text-[10px] font-body text-n-400">{c.percentage}% de {fmtMoney(c.total_amount)}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-n-100">
                      <span className={`text-xs font-mono px-2 py-0.5 rounded-lg flex items-center gap-1 ${c.status === 'paid' ? 'bg-turquoise-50 text-turquoise-700' : 'bg-yellow-50 text-yellow-700'}`}>
                        {c.status === 'paid' && <Check size={11} strokeWidth={2} />}
                        {c.status === 'paid' ? 'Pago' : 'Pendente'}
                      </span>
                      {c.status === 'pending' && (
                        <button
                          onClick={() => handleMarkPaid(c.id)}
                          disabled={payingId === c.id}
                          className="text-xs font-body font-semibold text-turquoise-700 hover:underline disabled:opacity-50">
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

      {/* Floating CTA */}
      <div className="fixed bottom-0 inset-x-0 z-20 px-4 pb-5 pt-6 bg-gradient-to-t from-n-50 via-n-50/90 to-transparent">
        <div className="max-w-md mx-auto">
          <button
            onClick={() => navigate('/vendedor/nova-reserva')}
            className="w-full h-16 bg-sand-500 text-ocean-900 rounded-full font-display font-bold text-lg flex items-center justify-center gap-2 shadow-2xl shadow-sand-500/30 active:scale-95 transition-all hover:bg-sand-600">
            <Plus size={24} strokeWidth={2.5} />
            Nova Reserva
          </button>
        </div>
      </div>
    </div>
  );
}
