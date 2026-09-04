import { useEffect } from 'react';
import useToastStore from '../../store/toastStore';

/* "info" usava bg-primary-500 -- classe que nunca existiu neste projecto
   (nao ha nenhuma cor "primary" no tailwind.config.js), por isso ficava
   sem fundo nenhum, transparente, texto branco invisivel. So nunca foi
   notado porque nada usava "info" de forma visivel antes da notificacao
   de mensagens. bg-ocean-700 e a cor de marca ja usada em toda a app. */
const CONFIG = {
  success: { bg: 'bg-green-500', icon: '✓' },
  error:   { bg: 'bg-red-500',   icon: '✕' },
  info:    { bg: 'bg-ocean-700', icon: 'ℹ' }
};

function ToastItem({ toast, onRemove }) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  const { bg, icon } = CONFIG[toast.type] || CONFIG.info;

  function handleClick() {
    if (toast.onClick) { toast.onClick(); onRemove(toast.id); }
  }

  return (
    <div
      onClick={handleClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-white text-sm min-w-[280px] max-w-sm ${bg} animate-fade-in ${toast.onClick ? 'cursor-pointer' : ''}`}
    >
      <span className="text-base font-bold shrink-0">{icon}</span>
      <span className="flex-1 min-w-0">
        {toast.title && <span className="block font-semibold mb-0.5">{toast.title}</span>}
        <span className="block truncate">{toast.message}</span>
      </span>
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(toast.id); }}
        className="shrink-0 opacity-60 hover:opacity-100 text-lg leading-none ml-1"
        aria-label="Fechar"
      >
        ×
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-[calc(4.5rem_+_env(safe-area-inset-bottom))] md:bottom-4 right-4 z-[200] flex flex-col gap-2 items-end">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onRemove={removeToast} />
      ))}
    </div>
  );
}
