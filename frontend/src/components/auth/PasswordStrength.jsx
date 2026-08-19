import { Check, X } from 'lucide-react';

const RULES = [
  { id: 'length',  label: 'Minimo 8 caracteres',       test: p => p.length >= 8 },
  { id: 'upper',   label: '1 letra maiuscula (A-Z)',    test: p => /[A-Z]/.test(p) },
  { id: 'number',  label: '1 numero (0-9)',             test: p => /[0-9]/.test(p) },
  { id: 'special', label: '1 caracter especial (!@#…)', test: p => /[^A-Za-z0-9]/.test(p) },
];

export function getPasswordStrength(password) {
  if (!password) return -1;
  const ok = RULES.filter(r => r.test(password)).length;
  if (ok <= 1) return 0; // fraca
  if (ok <= 3) return 1; // média
  return 2;              // forte
}

const STRENGTH_CFG = [
  { label: 'Fraca',  textCls: 'text-error dark:text-red-400',        barCls: 'bg-error',        width: '33%'  },
  { label: 'Media',  textCls: 'text-yellow-600 dark:text-yellow-400', barCls: 'bg-yellow-500',   width: '66%'  },
  { label: 'Forte',  textCls: 'text-[#1A7A4A] dark:text-green-400',  barCls: 'bg-[#1A7A4A]',    width: '100%' },
];

export default function PasswordStrength({ password, showRules = true }) {
  if (!password) return null;

  const strength = getPasswordStrength(password);
  const cfg      = strength >= 0 ? STRENGTH_CFG[strength] : null;

  return (
    <div className="mt-1.5 space-y-2">
      {/* Bar */}
      {cfg && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-n-100 dark:bg-n-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${cfg.barCls}`}
              style={{ width: cfg.width }}
            />
          </div>
          <span className={`text-[11px] font-mono font-semibold ${cfg.textCls}`}>
            {cfg.label}
          </span>
        </div>
      )}

      {/* Rules */}
      {showRules && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          {RULES.map(r => {
            const ok = r.test(password);
            return (
              <div key={r.id} className="flex items-center gap-1.5">
                {ok
                  ? <Check size={11} strokeWidth={2.5} className="text-[#1A7A4A] dark:text-green-400 shrink-0" />
                  : <X    size={11} strokeWidth={2.5} className="text-n-300 dark:text-n-600 shrink-0" />}
                <span className={`text-[11px] font-body ${ok ? 'text-[#1A7A4A] dark:text-green-400' : 'text-n-400'}`}>
                  {r.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
