// Estado vazio compacto: icone opcional, titulo, descricao e acao (uso exclusivo da app do operador)
export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center text-center px-4 py-8">
      {Icon && (
        <div className="flex items-center justify-center w-9 h-9 rounded-sm bg-ocean-50 text-ocean-700 mb-3">
          <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
        </div>
      )}
      <p className="font-display font-semibold text-sm text-n-900">{title}</p>
      {description && <p className="font-body text-[13px] text-n-500 mt-0.5">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
