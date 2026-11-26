import React from 'react';

/* Botoes so com icone: nativos, com 44 px no telemovel; o realce ao passar o rato depende da accao */
const ICONE_BASE = 'inline-flex items-center justify-center min-h-11 min-w-11 md:min-h-9 md:min-w-9 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sand-500';
export const TOGGLE_HOVER_ACTIVE   = 'hover:text-error hover:bg-[var(--error-light)]';
export const TOGGLE_HOVER_INACTIVE = 'hover:text-[var(--success)] hover:bg-[var(--success-light)]';
export const EDIT_HOVER            = 'hover:text-ocean-700 hover:bg-ocean-50';
export const DELETE_HOVER          = 'hover:text-error hover:bg-[var(--error-light)]';

/* title (dica ao passar o rato) e className (sinal por estado, ex.: verde quando activo) sao opcionais */
export function IconBtn({ icon: Icon, label, onClick, hover = '', disabled = false, title, className = '' }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={title} disabled={disabled} className={`${ICONE_BASE} ${hover} ${className || 'text-n-500'} disabled:opacity-50 disabled:cursor-not-allowed`}>
      <Icon size={16} strokeWidth={1.75} />
    </button>
  );
}
