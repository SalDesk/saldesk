import useUiStore from '../../store/uiStore';
import { SUPPORTED_LANGS } from '../../i18n';

/* authMode=true mostra apenas PT/EN (paginas de auth/publicas) */
export default function LanguageToggle({ variant = 'default', authMode = false }) {
  const { lang, setLang } = useUiStore();
  const isWhite = variant === 'white';
  const langs   = authMode ? ['pt', 'en'] : SUPPORTED_LANGS;
  const base = 'text-xs font-body font-semibold uppercase tracking-wide px-2 py-1 rounded-xs transition-colors';
  const active   = isWhite ? 'bg-white text-ocean-700'       : 'bg-ocean-700 text-white';
  const inactive = isWhite ? 'text-white/70 hover:text-white' : 'text-n-500 hover:text-n-700';

  return (
    <div className={`flex items-center gap-0.5 ${isWhite ? 'bg-white/10 rounded-sm p-0.5' : 'bg-n-100 rounded-sm p-0.5'}`}>
      {langs.map((l) => (
        <button key={l} onClick={() => setLang(l)} className={`${base} ${lang === l ? active : inactive}`}>
          {l}
        </button>
      ))}
    </div>
  );
}
