import { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { changePassword } from '../../services/authService';
import PasswordStrength, { getPasswordStrength } from '../../components/auth/PasswordStrength';
import Button from '../../components/ui/Button';
import { SaveBanner, CARTAO, TITULO } from './shared';
import { useT } from '../../i18n';
import { mensagemErro } from '../../utils/mensagemErro';

/* ─────────────────────────────────────────────────────────
   TAB 6 — SEGURANCA
───────────────────────────────────────────────────────── */
export default function SegurancaTab() {
  const t = useT();
  /* ── Password change ── */
  const [pwForm,   setPwForm]  = useState({ current: '', newPw: '', confirm: '' });
  const [pwSaving, setPwSave]  = useState(false);
  const [pwSaved,  setPwSaved] = useState(false);
  const [pwError,  setPwError] = useState('');
  const [showPw,   setShowPw]  = useState({ current: false, newPw: false, confirm: false });

  async function handlePwChange(e) {
    e.preventDefault(); setPwError('');
    if (getPasswordStrength(pwForm.newPw) < 2) {
      setPwError(t('settings.seguranca.errWeak'));
      return;
    }
    if (pwForm.newPw !== pwForm.confirm) { setPwError(t('settings.seguranca.errMismatch')); return; }
    setPwSave(true);
    try {
      await changePassword(pwForm.current, pwForm.newPw);
      setPwForm({ current: '', newPw: '', confirm: '' });
      setPwSaved(true); setTimeout(() => setPwSaved(false), 3000);
    } catch (err) {
      setPwError(mensagemErro(err, t, t('settings.seguranca.errChange')));
    } finally { setPwSave(false); }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      {/* ── Alterar password ── */}
      <form onSubmit={handlePwChange}>
        <section className={CARTAO}>
          <h2 className={`${TITULO} mb-4`}>{t('settings.seguranca.title')}</h2>
          <div className="space-y-3">
            {[
              { field: 'current', label: t('settings.seguranca.current'), show: t('settings.seguranca.showCurrent'), ac: 'current-password' },
              { field: 'newPw',   label: t('settings.seguranca.newPw'),   show: t('settings.seguranca.showNewPw'),   ac: 'new-password'     },
              { field: 'confirm', label: t('settings.seguranca.confirm'), show: t('settings.seguranca.showConfirm'), ac: 'new-password'     },
            ].map(({ field, label, show, ac }) => (
              <div key={field} className="flex flex-col gap-1">
                <label htmlFor={`senha-${field}`} className="text-[13px] font-body font-semibold text-n-700">{label}</label>
                <div className="relative">
                  <input
                    id={`senha-${field}`}
                    type={showPw[field] ? 'text' : 'password'}
                    value={pwForm[field]}
                    onChange={e => setPwForm(p => ({ ...p, [field]: e.target.value }))}
                    required autoComplete={ac} aria-label={label}
                    className="w-full h-11 md:h-9 px-3 pr-12 rounded-md border border-mare-field text-sm font-body bg-white text-n-900 placeholder:text-n-400 focus:outline-none focus:ring-2 focus:ring-sand-500 focus:border-ocean-700 transition-colors"
                  />
                  <button type="button" aria-label={show} aria-pressed={showPw[field]}
                    onClick={() => setShowPw(p => ({ ...p, [field]: !p[field] }))}
                    className="absolute right-0.5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center min-h-11 min-w-11 md:min-h-9 md:min-w-9 rounded-full text-n-600 hover:text-n-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sand-500">
                    {showPw[field] ? <EyeOff size={14} strokeWidth={1.75} /> : <Eye size={14} strokeWidth={1.75} />}
                  </button>
                </div>
                {field === 'newPw' && pwForm.newPw && <PasswordStrength password={pwForm.newPw} />}
                {field === 'confirm' && pwForm.confirm && pwForm.newPw !== pwForm.confirm && (
                  <p className="text-xs text-[var(--error)]">{t('settings.seguranca.errMismatch')}</p>
                )}
              </div>
            ))}
            {pwError && <p className="text-sm font-body px-3 py-2 rounded-md bg-[var(--error-light)] text-[var(--error)]">{pwError}</p>}
            <div className="flex items-center gap-3 pt-1">
              <Button type="submit" loading={pwSaving} icon={Lock}>{t('settings.seguranca.title')}</Button>
              <SaveBanner saved={pwSaved} />
            </div>
          </div>
        </section>
      </form>
    </div>
  );
}
