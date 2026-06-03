import { useState, useEffect, useRef } from 'react';
import { Shield, RefreshCw, X } from 'lucide-react';
import { sendTwoFactor, verifyTwoFactor } from '../services/authService';
import Button from './ui/Button';

const RESEND_COOLDOWN = 60;
const CODE_LENGTH     = 6;

export default function TwoFactorModal({ email, onVerified, onCancel }) {
  const [digits,    setDigits]    = useState(Array(CODE_LENGTH).fill(''));
  const [loading,   setLoading]   = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error,     setError]     = useState('');
  const [countdown, setCountdown] = useState(0);
  const inputRefs = useRef([]);

  /* Send code on mount */
  useEffect(() => {
    handleSend();
  }, []);

  /* Countdown timer */
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  async function handleSend() {
    setLoading(true);
    setError('');
    try {
      await sendTwoFactor(email);
      setCountdown(RESEND_COOLDOWN);
    } catch {
      setError('Nao foi possivel enviar o codigo. Tenta novamente.');
    } finally {
      setLoading(false);
    }
  }

  function handleChange(idx, value) {
    if (!/^[0-9]?$/.test(value)) return;
    const next = [...digits];
    next[idx] = value;
    setDigits(next);
    if (value && idx < CODE_LENGTH - 1) {
      inputRefs.current[idx + 1]?.focus();
    }
    /* Auto-submit when last digit filled */
    if (idx === CODE_LENGTH - 1 && value) {
      const code = [...next].join('');
      if (code.length === CODE_LENGTH) verify(code);
    }
  }

  function handleKeyDown(idx, e) {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
    if (e.key === 'ArrowLeft'  && idx > 0)              inputRefs.current[idx - 1]?.focus();
    if (e.key === 'ArrowRight' && idx < CODE_LENGTH - 1) inputRefs.current[idx + 1]?.focus();
  }

  function handlePaste(e) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
    if (!text) return;
    const next = Array(CODE_LENGTH).fill('');
    text.split('').forEach((c, i) => { next[i] = c; });
    setDigits(next);
    inputRefs.current[Math.min(text.length, CODE_LENGTH - 1)]?.focus();
    if (text.length === CODE_LENGTH) verify(text);
  }

  async function verify(code) {
    setVerifying(true);
    setError('');
    try {
      const result = await verifyTwoFactor(email, code);
      onVerified(result);
    } catch {
      setError('Codigo incorrecto ou expirado. Verifica e tenta novamente.');
      setDigits(Array(CODE_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setVerifying(false);
    }
  }

  const code = digits.join('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ocean-900/60 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-ocean-50 rounded-sm flex items-center justify-center shrink-0">
              <Shield size={20} strokeWidth={1.75} className="text-ocean-700" />
            </div>
            <div>
              <p className="font-display font-bold text-sm text-n-900">Verificacao em dois passos</p>
              <p className="text-xs font-body text-n-500 mt-0.5">Codigo enviado para <span className="font-semibold">{email}</span></p>
            </div>
          </div>
          <button onClick={onCancel} className="p-1 text-n-400 hover:text-n-600 transition-colors">
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        <p className="text-xs font-body text-n-500 mb-5 text-center">
          Introduz o codigo de 6 digitos enviado por email. Expira em 10 minutos.
        </p>

        {/* 6-digit input */}
        <div className="flex gap-2 justify-center mb-4" onPaste={handlePaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={el => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              disabled={verifying}
              className={`w-11 h-14 text-center font-display font-bold text-xl rounded-lg border-2 transition-all focus:outline-none ${
                d
                  ? 'border-ocean-700 bg-ocean-50 text-ocean-900'
                  : 'border-n-200 bg-n-50 text-n-900 focus:border-ocean-400'
              } ${verifying ? 'opacity-50' : ''}`}
            />
          ))}
        </div>

        {error && (
          <div className="mb-4 px-3 py-2 rounded-sm bg-red-50 border border-red-100 text-error text-xs font-body text-center">
            {error}
          </div>
        )}

        {/* Verify button (shows when code incomplete) */}
        {code.length < CODE_LENGTH && (
          <Button
            onClick={() => code.length === CODE_LENGTH && verify(code)}
            loading={verifying}
            disabled={code.length < CODE_LENGTH}
            className="w-full mb-3">
            Verificar codigo
          </Button>
        )}

        {/* Resend */}
        <div className="text-center">
          {countdown > 0 ? (
            <p className="text-xs font-body text-n-400">
              Reenviar em <span className="font-mono font-semibold">{countdown}s</span>
            </p>
          ) : (
            <button
              onClick={handleSend}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs font-body text-ocean-700 hover:underline mx-auto disabled:opacity-50">
              <RefreshCw size={12} strokeWidth={1.75} />
              {loading ? 'A enviar...' : 'Reenviar codigo'}
            </button>
          )}
        </div>

        <button onClick={onCancel}
          className="mt-4 w-full text-xs font-body text-n-400 hover:text-n-600 transition-colors">
          Cancelar e voltar ao login
        </button>
      </div>
    </div>
  );
}
