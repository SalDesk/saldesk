import React from 'react';

/* Botoes so com icone: nativos, com 44 px no telemovel; o realce ao passar o rato depende da accao */
const ICONE_BASE = 'inline-flex items-center justify-center min-h-11 min-w-11 md:min-h-9 md:min-w-9 rounded-full text-n-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sand-500';
export const TOGGLE_HOVER_ACTIVE   = 'hover:text-error hover:bg-[var(--error-light)]';
export const TOGGLE_HOVER_INACTIVE = 'hover:text-[var(--success)] hover:bg-[var(--success-light)]';
export const EDIT_HOVER            = 'hover:text-ocean-700 hover:bg-ocean-50';
export const DELETE_HOVER          = 'hover:text-error hover:bg-[var(--error-light)]';

export function IconBtn({ icon: Icon, label, onClick, hover }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className={`${ICONE_BASE} ${hover}`}>
      <Icon size={16} strokeWidth={1.75} />
    </button>
  );
}
