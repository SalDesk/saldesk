import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import RowMenu from '../components/ui/RowMenu';

/* Menu "..." das acoes secundarias de uma linha de tabela. Abre num portal para
   nao ser cortado pelo overflow da tabela. */
describe('RowMenu', () => {
  let errSpy;
  let warnSpy;
  let a;
  let b;

  beforeEach(() => {
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    a = vi.fn();
    b = vi.fn();
  });

  afterEach(() => {
    cleanup();
    expect(errSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
    warnSpy.mockRestore();
  });

  function renderMenu(items) {
    return render(
      <div>
        <div data-testid="tabela" style={{ overflow: 'auto' }}>
          <RowMenu
            label="Mais accoes"
            items={items || [
              { key: 'a', label: 'Reagendar', onClick: a },
              { key: 'b', label: 'Eliminar', onClick: b, danger: true },
            ]}
          />
        </div>
        <button>Fora</button>
      </div>,
    );
  }

  function gatilho() {
    return screen.getByRole('button', { name: 'Mais accoes' });
  }

  it('comeca fechado: so o gatilho esta no documento', () => {
    renderMenu();
    expect(gatilho()).toHaveAttribute('aria-haspopup', 'menu');
    expect(gatilho()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('abre ao clicar e mostra um menuitem por accao', () => {
    renderMenu();
    fireEvent.click(gatilho());
    expect(gatilho()).toHaveAttribute('aria-expanded', 'true');
    const itens = within(screen.getByRole('menu')).getAllByRole('menuitem').map(i => i.textContent);
    expect(itens).toEqual(['Reagendar', 'Eliminar']);
  });

  it('o menu abre fora do contentor com overflow (portal) para nao ser cortado', () => {
    renderMenu();
    fireEvent.click(gatilho());
    expect(screen.getByTestId('tabela')).not.toContainElement(screen.getByRole('menu'));
  });

  it('escolher uma accao chama o handler e fecha o menu', () => {
    renderMenu();
    fireEvent.click(gatilho());
    fireEvent.click(screen.getByRole('menuitem', { name: 'Eliminar' }));
    expect(b).toHaveBeenCalledTimes(1);
    expect(a).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('clicar no gatilho outra vez fecha o menu', () => {
    renderMenu();
    fireEvent.click(gatilho());
    fireEvent.click(gatilho());
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('Escape fecha o menu e devolve o foco ao gatilho', () => {
    renderMenu();
    fireEvent.click(gatilho());
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(gatilho()).toHaveFocus();
  });

  it('clicar fora fecha o menu', () => {
    renderMenu();
    fireEvent.click(gatilho());
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Fora' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('ao abrir, o foco vai para a primeira accao e as setas percorrem-nas', () => {
    renderMenu();
    fireEvent.click(gatilho());
    const [primeira, segunda] = screen.getAllByRole('menuitem');
    expect(primeira).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
    expect(segunda).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
    expect(primeira).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowUp' });
    expect(segunda).toHaveFocus();
  });

  it('o foco so chega a primeira accao depois de o painel estar visivel e posicionado', () => {
    /* Num browser real, focus() falha em elementos com visibility:hidden; o jsdom nao
       avisa, por isso mede-se o estado do painel no instante em que o foco entra. */
    const estados = [];
    const aoFocar = () => {
      const menu = document.querySelector('[role="menu"]');
      estados.push({ visibility: getComputedStyle(menu).visibility, top: menu.style.top });
    };
    document.addEventListener('focusin', aoFocar);
    renderMenu();
    fireEvent.click(gatilho());
    document.removeEventListener('focusin', aoFocar);
    expect(estados.length).toBeGreaterThan(0);
    for (const e of estados) {
      expect(e.visibility).not.toBe('hidden');
      expect(e.top).not.toBe('0px');
    }
  });

  it('accoes marcadas como desactivadas nao chamam o handler', () => {
    renderMenu([{ key: 'a', label: 'Enviar voucher', onClick: a, disabled: true }]);
    fireEvent.click(gatilho());
    const item = screen.getByRole('menuitem', { name: 'Enviar voucher' });
    expect(item).toBeDisabled();
    fireEvent.click(item);
    expect(a).not.toHaveBeenCalled();
  });

  it('sem accoes nao desenha o gatilho', () => {
    renderMenu([]);
    expect(screen.queryByRole('button', { name: 'Mais accoes' })).not.toBeInTheDocument();
  });

  it('aberto de dentro da app, o painel leva data-ui="app"; fora dela nao', () => {
    const { unmount } = render(
      <div data-ui="app">
        <RowMenu label="Mais accoes" items={[{ key: 'a', label: 'Reagendar', onClick: a }]} />
      </div>,
    );
    fireEvent.click(gatilho());
    expect(screen.getByRole('menu')).toHaveAttribute('data-ui', 'app');
    expect(screen.getByRole('menu').className).toContain('app:rounded-[14px]');
    expect(gatilho().className).toContain('app:w-11');
    expect(screen.getByRole('menuitem').className).toContain('app:min-h-11');
    unmount();
    cleanup();
    renderMenu();
    fireEvent.click(gatilho());
    expect(screen.getByRole('menu')).not.toHaveAttribute('data-ui');
  });

  it('fora da app as classes do gatilho, painel e itens sao as de antes', () => {
    const semApp = (cls) => cls.split(/\s+/).filter((t) => t && !t.startsWith('app:')).sort();
    const lista = (s) => s.split(/\s+/).filter(Boolean).sort();
    renderMenu();
    expect(semApp(gatilho().className)).toEqual(lista('p-1 rounded text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-300'));
    fireEvent.click(gatilho());
    expect(semApp(screen.getByRole('menu').className)).toEqual(lista('z-50 bg-white rounded-md border border-n-200 shadow-lg py-1'));
    const base = 'w-full flex items-center gap-2 px-3 py-2 text-left text-sm font-body transition-colors focus-visible:outline-none focus-visible:bg-n-100 disabled:opacity-40 disabled:cursor-not-allowed';
    expect(semApp(screen.getByRole('menuitem', { name: 'Reagendar' }).className)).toEqual(lista(`${base} text-n-700 hover:bg-n-50`));
    expect(semApp(screen.getByRole('menuitem', { name: 'Eliminar' }).className)).toEqual(lista(`${base} text-error hover:bg-red-50`));
  });
});
