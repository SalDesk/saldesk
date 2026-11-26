// Estado vazio compacto: icone opcional, titulo, descricao e acao (uso exclusivo da app do operador)
export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center text-center px-4 py-8 app:bg-mare-head app:rounded-[14px] app:py-[18px]">
      {!Icon && (
        /* Onda decorativa: so dentro da app e so quando nao ha icone */
        <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true" className="hidden app:block app:mb-3">
          <circle cx="28" cy="28" r="27" className="fill-ocean-50" />
          <path d="M12 34c5-5 10-5 16 0s11 5 16 0" className="stroke-ocean-400" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M12 26c5-5 10-5 16 0s11 5 16 0" className="stroke-ocean-200" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </svg>
      )}
      {Icon && (
        <div className="flex items-center justify-center w-9 h-9 rounded-sm bg-ocean-50 text-ocean-700 mb-3">
          <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
        </div>
      )}
      <p className="font-display font-semibold text-sm text-n-900 app:text-base app:text-ocean-900">{title}</p>
      {description && <p className="font-body text-[13px] text-n-500 mt-0.5 app:text-sm app:text-n-600">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
