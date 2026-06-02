import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Link2, Copy, Check, Share2, Euro,
  BarChart2, Clock, CheckCircle2, AlertCircle,
} from 'lucide-react';

const AFFILIATES_KEY = 'saldesk_affiliates_v1';

function loadAffiliates() {
  try { return JSON.parse(localStorage.getItem(AFFILIATES_KEY) || '[]'); }
  catch { return []; }
}

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }
  return (
    <button onClick={copy}
      className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-sm font-body font-medium transition-colors ${copied ? 'text-[#1A7A4A] bg-[#ECFDF5]' : 'text-ocean-700 bg-ocean-50 hover:bg-ocean-100'}`}>
      {copied ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={1.75} />}
      {copied ? 'Copiado' : 'Copiar link'}
    </button>
  );
}

export default function AffiliatePortal() {
  const { codigo } = useParams();
  const [step,      setStep]      = useState('login');
  const [email,     setEmail]     = useState('');
  const [affiliate, setAffiliate] = useState(null);
  const [error,     setError]     = useState('');

  function handleLogin(e) {
    e.preventDefault();
    setError('');
    const all = loadAffiliates();
    const found = all.find(a =>
      a.code?.toUpperCase() === codigo?.toUpperCase() &&
      a.email?.toLowerCase() === email.trim().toLowerCase() &&
      a.active !== false,
    );
    if (found) {
      setAffiliate(found);
      setStep('dashboard');
    } else {
      setError('Email ou codigo invalido. Verifique os dados e tente novamente.');
    }
  }

  const totalCommission = (affiliate?.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);
  const pendingCommission = Math.max(
    0,
    (affiliate?.bookings_count || 0) *
    (affiliate?.avg_booking_value || 0) *
    (affiliate?.commission_pct || 0) / 100 -
    totalCommission,
  );

  const affiliateLink = affiliate
    ? `https://saldesk.cv/book/${affiliate.slug || '...'}?ref=${affiliate.code}`
    : '';

  return (
    <div className="min-h-screen bg-n-50 flex flex-col">
      {/* Header */}
      <header className="bg-ocean-900 px-6 py-4">
        <p className="font-display font-bold text-white text-lg tracking-tight">SalDesk</p>
        <p className="text-ocean-400 text-xs font-mono mt-0.5">Portal do Afiliado</p>
      </header>

      <main className="flex-1 px-4 py-8 max-w-lg mx-auto w-full">
        {step === 'login' ? (
          <div className="bg-white rounded-md border border-n-200 shadow-sm p-6">
            <h1 className="font-display font-bold text-xl text-n-900 mb-1">Entrar no portal</h1>
            <p className="text-xs font-body text-n-500 mb-6">
              Codigo de afiliado: <span className="font-mono font-semibold text-n-700">{codigo?.toUpperCase()}</span>
            </p>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600 block mb-1">
                  Email registado
                </label>
                <input
                  type="email" required
                  value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="o-seu@email.com"
                  className="w-full h-9 px-3 rounded-sm border border-n-300 text-sm font-body bg-n-100 focus:outline-none focus:border-ocean-700 focus:bg-white"
                />
              </div>
              {error && (
                <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-100 rounded-sm">
                  <AlertCircle size={13} strokeWidth={1.75} className="text-error shrink-0" />
                  <p className="text-xs font-body text-error">{error}</p>
                </div>
              )}
              <button type="submit"
                className="w-full h-9 bg-ocean-700 text-white rounded-sm text-sm font-body font-semibold hover:bg-ocean-800 transition-colors">
                Entrar
              </button>
            </form>

            <div className="mt-6 pt-4 border-t border-n-100">
              <p className="text-xs font-body text-n-400 text-center">
                Ainda nao es afiliado? Contacta o operador para obter as tuas credenciais.
              </p>
            </div>
          </div>
        ) : affiliate ? (
          <div className="space-y-4">
            {/* Welcome */}
            <div className="bg-ocean-900 rounded-md px-5 py-4 text-white">
              <p className="text-xs font-mono text-ocean-400 uppercase tracking-wide mb-1">Bem-vindo</p>
              <p className="font-display font-bold text-xl">{affiliate.name}</p>
              <p className="text-ocean-300 text-xs mt-0.5">{affiliate.commission_pct || 0}% de comissao por reserva</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Reservas geradas', value: affiliate.bookings_count || 0,          icon: BarChart2, color: 'text-n-900'      },
                { label: 'Comissao paga',    value: `€${totalCommission.toFixed(0)}`,        icon: CheckCircle2, color: 'text-[#1A7A4A]' },
                { label: 'Comissao pendente', value: `€${pendingCommission.toFixed(0)}`,    icon: Clock,      color: 'text-yellow-700' },
                { label: 'Total estimado',   value: `€${(totalCommission + pendingCommission).toFixed(0)}`, icon: Euro, color: 'text-ocean-700' },
              ].map(m => (
                <div key={m.label} className="bg-white border border-n-200 rounded-md px-4 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <m.icon size={14} strokeWidth={1.75} className="text-n-400 shrink-0" />
                  </div>
                  <p className={`font-display font-bold text-xl ${m.color}`}>{m.value}</p>
                  <p className="text-xs font-body text-n-500 mt-0.5">{m.label}</p>
                </div>
              ))}
            </div>

            {/* Affiliate link */}
            <div className="bg-white border border-n-200 rounded-md p-4">
              <p className="text-xs font-mono uppercase tracking-wider text-n-500 mb-2">O teu link de afiliado</p>
              <div className="bg-n-50 border border-n-200 rounded-sm px-3 py-2 mb-3">
                <p className="text-xs font-mono text-n-700 break-all">{affiliateLink || '—'}</p>
              </div>
              <div className="flex gap-2">
                {affiliateLink && <CopyBtn text={affiliateLink} />}
                {affiliateLink && (
                  <button
                    onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Reserve o seu tour com desconto: ${affiliateLink}`)}`, '_blank', 'noopener')}
                    className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-sm bg-[#25D366] text-white font-body font-medium hover:bg-[#1ebe5a] transition-colors">
                    <Share2 size={14} strokeWidth={1.75} />
                    WhatsApp
                  </button>
                )}
              </div>
            </div>

            {/* Payment history */}
            {(affiliate.payments || []).length > 0 && (
              <div className="bg-white border border-n-200 rounded-md p-4">
                <p className="text-xs font-mono uppercase tracking-wider text-n-500 mb-3">Historico de pagamentos</p>
                <div className="space-y-2">
                  {[...affiliate.payments].sort((a, b) => b.date?.localeCompare(a.date || '') || 0).map((p, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-n-100 last:border-0">
                      <div>
                        <p className="text-xs font-mono text-n-500">{p.date ? new Date(p.date + 'T00:00:00Z').toLocaleDateString('pt-PT') : '—'}</p>
                        {p.note && <p className="text-xs font-body text-n-400">{p.note}</p>}
                      </div>
                      <p className="font-display font-bold text-sm text-[#1A7A4A]">€{Number(p.amount).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button onClick={() => { setStep('login'); setAffiliate(null); setEmail(''); }}
              className="w-full text-xs font-body text-n-400 hover:text-n-600 transition-colors py-2">
              Sair
            </button>
          </div>
        ) : null}
      </main>

      <footer className="text-center py-4 text-[10px] font-mono text-n-400">
        Powered by SalDesk · saldesk.cv
      </footer>
    </div>
  );
}
