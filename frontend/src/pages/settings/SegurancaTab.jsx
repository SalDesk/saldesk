import { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { changePassword } from '../../services/authService';
import PasswordStrength, { getPasswordStrength } from '../../components/auth/PasswordStrength';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { SaveBanner } from './shared';

/* ─────────────────────────────────────────────────────────
   TAB 6 — SEGURANCA
───────────────────────────────────────────────────────── */
export default function SegurancaTab() {
  /* ── Password change ── */
  const [pwForm,   setPwForm]  = useState({ current: '', newPw: '', confirm: '' });
  const [pwSaving, setPwSave]  = useState(false);
  const [pwSaved,  setPwSaved] = useState(false);
  const [pwError,  setPwError] = useState('');
  const [showPw,   setShowPw]  = useState({ current: false, newPw: false, confirm: false });

  async function handlePwChange(e) {
    e.preventDefault(); setPwError('');
    if (getPasswordStrength(pwForm.newPw) < 2) {
      setPwError('A password deve ser forte: 8+ caracteres, maiuscula, numero e especial.');
      return;
    }
    if (pwForm.newPw !== pwForm.confirm) { setPwError('As passwords nao coincidem.'); return; }
    setPwSave(true);
    try {
      await changePassword(pwForm.current, pwForm.newPw);
      setPwForm({ current: '', newPw: '', confirm: '' });
      setPwSaved(true); setTimeout(() => setPwSaved(false), 3000);
    } catch (err) {
      setPwError(err.response?.data?.error || 'Erro ao alterar password.');
    } finally { setPwSave(false); }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      {/* ── Alterar password ── */}
      <form onSubmit={handlePwChange}>
        <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Alterar password</h3>}>
          <div className="space-y-3">
            {[
              { field: 'current', label: 'Password actual',          ac: 'current-password' },
              { field: 'newPw',   label: 'Nova password',            ac: 'new-password'     },
              { field: 'confirm', label: 'Confirmar nova password',  ac: 'new-password'     },
            ].map(({ field, label, ac }) => (
              <div key={field} className="flex flex-col gap-1">
                <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600">{label}</label>
                <div className="relative">
                  <input
                    type={showPw[field] ? 'text' : 'password'}
                    value={pwForm[field]}
                    onChange={e => setPwForm(p => ({ ...p, [field]: e.target.value }))}
                    required autoComplete={ac} aria-label={label}
                    className="w-full h-9 px-3 pr-10 rounded-sm border border-n-300 text-sm font-body bg-n-100 text-n-900 placeholder:text-n-400 focus:outline-none focus:ring-2 focus:ring-ocean-300 focus:border-ocean-700 focus:bg-white transition-colors"
                  />
                  <button type="button" aria-label={`Mostrar ${label.toLowerCase()}`} aria-pressed={showPw[field]}
                    onClick={() => setShowPw(p => ({ ...p, [field]: !p[field] }))}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-n-400 hover:text-n-600 transition-colors">
                    {showPw[field] ? <EyeOff size={14} strokeWidth={1.75} /> : <Eye size={14} strokeWidth={1.75} />}
                  </button>
                </div>
                {field === 'newPw' && pwForm.newPw && <PasswordStrength password={pwForm.newPw} />}
                {field === 'confirm' && pwForm.confirm && pwForm.newPw !== pwForm.confirm && (
                  <p className="text-xs text-[var(--error)]">As passwords nao coincidem.</p>
                )}
              </div>
            ))}
            {pwError && <p className="text-sm font-body px-3 py-2 rounded bg-[var(--error-light)] text-[var(--error)]">{pwError}</p>}
            <div className="flex items-center gap-3 pt-1">
              <Button type="submit" loading={pwSaving} icon={Lock}>Alterar password</Button>
              <SaveBanner saved={pwSaved} />
            </div>
          </div>
        </Card>
      </form>
    </div>
  );
}
