import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import Button from './Button';

const sizes = {
  sm:  'max-w-sm',
  md:  'max-w-lg',
  lg:  'max-w-2xl',
  xl:  'max-w-4xl',
};

export default function Modal({
  open,
  onClose,
  title,
  size = 'md',
  children,
  footer,
}) {
  const overlayRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ocean-900/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        className={[
          'w-full bg-white rounded-lg shadow-lg flex flex-col max-h-[90vh]',
          sizes[size],
        ].join(' ')}
        role="dialog"
        aria-modal="true"
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-n-200 shrink-0">
            <h2 className="font-display font-semibold text-base text-n-900">{title}</h2>
            <button
              onClick={onClose}
              className="text-n-400 hover:text-n-700 transition-colors p-1 rounded-sm"
              aria-label="Fechar"
            >
              <X size={18} strokeWidth={1.75} />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>
        {footer && (
          <div className="px-6 py-4 border-t border-n-200 flex justify-end gap-3 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
