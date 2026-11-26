import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Users } from 'lucide-react';
import MareStat from '../components/shared/MareStat';

describe('MareStat', () => {
  it('mostra etiqueta, valor e pista com as classes do quadro de numeros', () => {
    const { container } = render(<MareStat label="Em casa" value="14" hint="de 20 unidades" />);
    const cartao = container.firstChild;
    expect(cartao.tagName).toBe('ARTICLE');
    expect(cartao).toHaveClass('bg-white', 'border', 'border-mare-card', 'rounded-[18px]');
    expect(screen.getByText('Em casa')).toHaveClass('text-[13px]', 'font-semibold', 'text-n-600');
    const valor = screen.getByText('14');
    expect(valor).toHaveClass('font-display', 'font-bold', 'text-ocean-900', 'tabular-nums');
    expect(valor.className).toMatch(/text-\[(28|30)px\]|md:text-\[30px\]/);
    expect(screen.getByText('de 20 unidades')).toHaveClass('text-xs', 'text-n-500');
  });

  it('nao acrescenta papel nenhum e a pista e opcional', () => {
    const { container } = render(<MareStat label="Livres" value="6" />);
    expect(container.firstChild.hasAttribute('role')).toBe(false);
    expect(container.querySelector('p.text-n-500')).toBeNull();
  });

  it('o tom tinge so a caixa do icone e nunca o valor', () => {
    const tons = {};
    ['default', 'aviso', 'bom'].forEach((tone) => {
      const { container, unmount } = render(<MareStat label="X" value="9" tone={tone} icon={Users} />);
      tons[tone] = {
        caixa: container.querySelector('[data-mare-stat-tint]').className,
        valor: screen.getByText('9').className,
        cartao: container.firstChild.className,
      };
      unmount();
    });
    expect(new Set(Object.values(tons).map((x) => x.caixa)).size).toBe(3);
    expect(new Set(Object.values(tons).map((x) => x.valor)).size).toBe(1);
    expect(new Set(Object.values(tons).map((x) => x.cartao)).size).toBe(1);
  });

  it('o icone e decorativo e sem icone nem tom nao ha caixa', () => {
    const { container, rerender } = render(<MareStat label="X" value="1" icon={Users} />);
    expect(container.querySelector('[data-mare-stat-tint]')).toHaveAttribute('aria-hidden', 'true');
    rerender(<MareStat label="X" value="1" />);
    expect(container.querySelector('[data-mare-stat-tint]')).toBeNull();
  });
});

describe('MareStat: ponto sem icone', () => {
  it('o ponto usa uma cor saturada, diferente da tinta clara da caixa do icone', () => {
    const ponto = {}; const caixa = {};
    ['aviso', 'bom'].forEach((tone) => {
      const a = render(<MareStat label="X" value="1" tone={tone} />);
      ponto[tone] = a.container.querySelector('[data-mare-stat-tint]').className;
      a.unmount();
      const b = render(<MareStat label="X" value="1" tone={tone} icon={Users} />);
      caixa[tone] = b.container.querySelector('[data-mare-stat-tint]').className;
      b.unmount();
    });
    expect(ponto.aviso).toMatch(/bg-sand-500/);
    expect(ponto.bom).toMatch(/bg-turquoise-600/);
    expect(ponto.aviso).not.toMatch(/bg-sand-100|bg-turquoise-100/);
    expect(caixa.aviso).toMatch(/bg-sand-100/);
    expect(caixa.aviso).toMatch(/text-n-800/);
    expect(caixa.bom).toMatch(/bg-turquoise-100/);
  });
});