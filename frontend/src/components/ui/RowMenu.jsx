import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';

/* Menu "..." para as acoes secundarias de uma linha de tabela.
   O painel abre num portal com posicao fixa: as tabelas tem overflow-x-auto,
   que cortaria um menu posicionado dentro da propria linha. */

const MENU_WIDTH = 192;
const GAP = 4;

export default function RowMenu({ label, items }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const close = useCallback((refocus = false) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }, []);

  /* Posiciona o painel por baixo do gatilho, alinhado a direita; sobe se faltar espaco */
  useLayoutEffect(() => {
    if (!open) { setPos(null); return; }
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const menuHeight = menuRef.current?.offsetHeight || 0;
    const left = Math.max(8, Math.min(r.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8));
    const cabeAbaixo = r.bottom + GAP + menuHeight <= window.innerHeight - 8;
    const top = cabeAbaixo ? r.bottom + GAP : Math.max(8, r.top - GAP - menuHeight);
    setPos({ top, left });
  }, [open, items.length]);

  /* Ao abrir, o foco vai para a primeira acao disponivel. Tem de esperar pela
     posicao: focus() falha em elementos com visibility:hidden. */
  useEffect(() => {
    if (!open || !pos) return;
    menuRef.current?.querySelector('[role="menuitem"]:not(:disabled)')?.focus();
  }, [open, pos]);

  /* Fecha ao clicar fora, ao deslocar a pagina ou ao redimensionar */
  useEffect(() => {
    if (!open) return undefined;
    function onMouseDown(e) {
      if (menuRef.current?.contains(e.target) || triggerRef.current?.contains(e.target)) return;
      close();
    }
    function onViewportChange() { close(); }
    document.addEventListener('mousedown', onMouseDown);
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
    };
  }, [open, close]);

  if (!items || items.length === 0) return null;

  function onMenuKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close(true);
      return;
    }
    if (e.key === 'Tab') {
      close();
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const itens = [...menuRef.current.querySelectorAll('[role="menuitem"]:not(:disabled)')];
    if (itens.length === 0) return;
    const atual = itens.indexOf(document.activeElement);
    const passo = e.key === 'ArrowDown' ? 1 : -1;
    const proximo = atual === -1 ? 0 : (atual + passo + itens.length) % itens.length;
    itens[proximo].focus();
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="p-1 rounded text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-300"
      >
        <MoreHorizontal size={15} strokeWidth={1.75} aria-hidden="true" />
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
          style={{ position: 'fixed', top: pos?.top ?? 0, left: pos?.left ?? 0, width: MENU_WIDTH, visibility: pos ? 'visible' : 'hidden' }}
          className="z-50 bg-white rounded-md border border-n-200 shadow-lg py-1"
        >
          {items.map(({ key, label: text, icon: Icon, onClick, danger, disabled }) => (
            <button
              key={key}
              type="button"
              role="menuitem"
              disabled={disabled}
              onClick={() => { close(); onClick(); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm font-body transition-colors focus-visible:outline-none focus-visible:bg-n-100 disabled:opacity-40 disabled:cursor-not-allowed ${
                danger ? 'text-error hover:bg-red-50' : 'text-n-700 hover:bg-n-50'
              }`}
            >
              {Icon && <Icon size={14} strokeWidth={1.75} aria-hidden="true" />}
              {text}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
