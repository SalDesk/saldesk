import { useEffect } from 'react';
import useToastStore from '../../store/toastStore';

const CONFIG = {
  success: { bg: 'bg-green-500', icon: '✓' },
  error:   { bg: 'bg-red-500',   icon: '✕' },
  info:    { bg: 'bg-primary-500', icon: 'ℹ' }
};

function ToastItem({ toast, onRemove }) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  const { bg, icon } = CONFIG[toast.type] || CONFIG.info;

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-white text-sm min-w-[280px] max-w-sm ${bg} animate-fade-in`}>
      <span className="text-base font-bold shrink-0">{icon}</span>
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={() => onRemove(toast.id)}
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
    <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 items-end">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onRemove={removeToast} />
      ))}
    </div>
  );
}
