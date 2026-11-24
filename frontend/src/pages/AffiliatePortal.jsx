import { useState, useLayoutEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Copy, Check, Share2, Euro,
  BarChart2, Clock, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { affiliatePortalLogin } from '../services/affiliatesService';
import { getT, useT } from '../i18n';
import useUiStore from '../store/uiStore';
import initialLang from '../utils/initialLang';
import { formatarData, useLingua } from '../utils/formatoLingua';
import { eurosDuasCasas } from '../utils/formatoEuros';
import { eurosInteiros } from './reservations/shared';
import LanguageToggle from '../components/shared/LanguageToggle';

/* O portal e publico: o afiliado nao e um operador com sessao. Idioma ao abrir:
   - se o browser ja guardou um idioma do painel (o Zustand grava 'saldesk-ui' quando alguem usa o seletor
     de idioma), esse prevalece: foi uma escolha explicita;
   - senao, o idioma inicial das paginas publicas (initialLang): a escolha guardada no site publico ou, sem
     ela, o idioma do browser (pt para browsers em portugues, ingles para o resto).
   O seletor de idioma do cabecalho depois muda o idioma do painel como em qualquer outro ecra. */
function idiomaGuardadoNoPainel() {
  try {
    const lang = JSON.parse(localStorage.getItem('saldesk-ui') || 'null')?.state?.lang;
    return typeof lang === 'string' && lang ? lang : null;
  } catch { return null; }
}

function CopyBtn({ text }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }
  return (
    <button onClick={copy}
      className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-sm font-body font-medium transition-colors ${copied ? 'text-[#1A7A4A] bg-[#ECFDF5]' : 'text-ocean-700 bg-ocean-50 hover:bg-ocean-100'}`}>
      {copied ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={1.75} />}
      {copied ? t('affiliatePortal.copied') : t('affiliatePortal.copyLink')}
    </button>
  );
}

export default function AffiliatePortal() {
  const t = useT();
  const lang = useLingua();
  const { codigo } = useParams();
  const [step,      setStep]      = useState('login');
  const [email,     setEmail]     = useState('');
  const [affiliate, setAffiliate] = useState(null);
  const [error,     setError]     = useState(false);
  const [loading,   setLoading]   = useState(false);

  /* antes de o ecra ser pintado: sem escolha guardada, o idioma vem do browser */
  useLayoutEffect(() => {
    if (idiomaGuardadoNoPainel()) return;
    useUiStore.getState().setLang(initialLang());
  }, []);

  async function handleLogin(e) {
    e.preventDefault();
    setError(false);
    setLoading(true);
    try {
      const data = await affiliatePortalLogin(codigo, email);
      setAffiliate(data);
      setStep('dashboard');
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  const totalCommission   = Number(affiliate?.commission_paid || 0);
  const pendingCommission = Number(affiliate?.commission_pending || 0);

  const affiliateLink = affiliate
    ? `https://saldesk.cv/book/${affiliate.slug}?ref=${affiliate.code}`
    : '';

  return (
    <div className="min-h-screen bg-n-50 flex flex-col">
      {/* Header */}
      <header className="bg-ocean-900 px-6 py-4 flex items-start justify-between gap-3">
        <div>
          <p className="font-display font-bold text-white text-lg tracking-tight">SalDesk</p>
          <p className="text-ocean-400 text-xs font-mono mt-0.5">{t('affiliatePortal.header')}</p>
        </div>
        <LanguageToggle variant="white" />
      </header>

      <main className="flex-1 px-4 py-8 max-w-lg mx-auto w-full">
        {step === 'login' ? (
          <div className="bg-white rounded-md border border-n-200 shadow-sm p-6">
            <h1 className="font-display font-bold text-xl text-n-900 mb-1">{t('affiliatePortal.loginTitle')}</h1>
            <p className="text-xs font-body text-n-500 mb-6">
              {t('affiliatePortal.codeLabel')} <span className="font-mono font-semibold text-n-700">{codigo?.toUpperCase()}</span>
            </p>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600 block mb-1">
                  {t('affiliatePortal.emailLabel')}
                </label>
                <input
                  type="email" required
                  value={email} onChange={e => setEmail(e.target.value)}
                  placeholder={t('affiliatePortal.emailPlaceholder')}
                  className="w-full h-9 px-3 rounded-sm border border-n-300 text-sm font-body bg-n-100 focus:outline-none focus:border-ocean-700 focus:bg-white"
                />
              </div>
              {error && (
                <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-100 rounded-sm">
                  <AlertCircle size={13} strokeWidth={1.75} className="text-error shrink-0" />
                  <p className="text-xs font-body text-error">{t('affiliatePortal.loginError')}</p>
                </div>
              )}
              <button type="submit" disabled={loading}
                className="w-full h-9 bg-ocean-700 text-white rounded-sm text-sm font-body font-semibold hover:bg-ocean-800 transition-colors disabled:opacity-60">
                {loading ? t('affiliatePortal.signingIn') : t('affiliatePortal.signIn')}
              </button>
            </form>

            <div className="mt-6 pt-4 border-t border-n-100">
              <p className="text-xs font-body text-n-400 text-center">
                {t('affiliatePortal.notAffiliate')}
              </p>
            </div>
          </div>
        ) : affiliate ? (
          <div className="space-y-4">
            {/* Welcome */}
            <div className="bg-ocean-900 rounded-md px-5 py-4 text-white">
              <p className="text-xs font-mono text-ocean-400 uppercase tracking-wide mb-1">{t('affiliatePortal.welcome')}</p>
              <p className="font-display font-bold text-xl">{affiliate.name}</p>
              <p className="text-ocean-300 text-xs mt-0.5">{t('affiliatePortal.commissionPerBooking', { pct: affiliate.commission_pct || 0 })}</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: t('affiliatePortal.stats.bookings'), value: affiliate.bookings_count || 0,          icon: BarChart2, color: 'text-n-900'      },
                { label: t('affiliatePortal.stats.paid'),     value: eurosInteiros(totalCommission, lang),   icon: CheckCircle2, color: 'text-[#1A7A4A]' },
                { label: t('affiliatePortal.stats.pending'),  value: eurosInteiros(pendingCommission, lang), icon: Clock,      color: 'text-yellow-700' },
                { label: t('affiliatePortal.stats.total'),    value: eurosInteiros(totalCommission + pendingCommission, lang), icon: Euro, color: 'text-ocean-700' },
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
              <p className="text-xs font-mono uppercase tracking-wider text-n-500 mb-2">{t('affiliatePortal.linkTitle')}</p>
              <div className="bg-n-50 border border-n-200 rounded-sm px-3 py-2 mb-3">
                <p className="text-xs font-mono text-n-700 break-all">{affiliateLink || '—'}</p>
              </div>
              <div className="flex gap-2">
                {affiliateLink && <CopyBtn text={affiliateLink} />}
                {affiliateLink && (
                  <button
                    onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(getT('pt')('affiliatePortal.shareText', { link: affiliateLink }))}`, '_blank', 'noopener')}
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
                <p className="text-xs font-mono uppercase tracking-wider text-n-500 mb-3">{t('affiliatePortal.paymentHistory')}</p>
                <div className="space-y-2">
                  {affiliate.payments.map((p, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-n-100 last:border-0">
                      <div>
                        <p className="text-xs font-mono text-n-500">{p.payment_date ? formatarData(new Date(p.payment_date + 'T00:00:00Z'), { timeZone: 'UTC' }, lang) : '—'}</p>
                        {p.note && <p className="text-xs font-body text-n-400">{p.note}</p>}
                      </div>
                      <p className="font-display font-bold text-sm text-[#1A7A4A]">{eurosDuasCasas(p.amount, lang)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button onClick={() => { setStep('login'); setAffiliate(null); setEmail(''); }}
              className="w-full text-xs font-body text-n-400 hover:text-n-600 transition-colors py-2">
              {t('affiliatePortal.logout')}
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
