import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { StaffAvatar } from '../pages/staff/shared';

/* O avatar tambem aparece no portal da equipa e no do vendedor de praia (StaffChat), fora de [data-ui="app"]:
   ali os tokens SEM prefixo app: tem de ser exactamente os de antes do estilo Mare (lista congelada do commit e5f2202). */
const semApp = (cls) => cls.split(/\s+/).filter((t) => t && !t.startsWith('app:')).sort();
const lista = (s) => s.split(/\s+/).filter(Boolean).sort();

const RAIZ = 'relative shrink-0';
const FOTO = 'w-full h-full rounded-full object-cover';
const INICIAIS = 'w-full h-full rounded-full bg-ocean-700 flex items-center justify-center text-white font-display font-bold';
const BOLA = 'absolute bottom-0 right-0 rounded-full border-2 border-white';

afterEach(cleanup);

describe('StaffAvatar fora da app mantem as classes de antes', () => {
  it('iniciais, activo, tamanho grande', () => {
    const { container } = render(<StaffAvatar member={{ name: 'Rui Lopes', status: 'active' }} size={44} />);
    const raiz = container.firstChild;
    expect(semApp(raiz.className)).toEqual(lista(RAIZ));
    expect(semApp(raiz.children[0].className)).toEqual(lista(INICIAIS));
    expect(semApp(raiz.children[1].className)).toEqual(lista(`${BOLA} w-3 h-3 bg-[var(--success)]`));
  });

  it('iniciais, inactivo, tamanho pequeno', () => {
    const { container } = render(<StaffAvatar member={{ name: 'Ana Tavares', status: 'inactive' }} size={32} />);
    expect(semApp(container.firstChild.children[1].className)).toEqual(lista(`${BOLA} w-2.5 h-2.5 bg-n-300`));
  });

  it('com foto e sem bola de estado', () => {
    const { container } = render(<StaffAvatar member={{ name: 'Rui Lopes', status: 'active', photo_url: 'http://x.test/f.png' }} showStatus={false} />);
    expect(semApp(screen.getByAltText('Rui Lopes').className)).toEqual(lista(FOTO));
    expect(container.firstChild.children).toHaveLength(1);
  });

  it('dentro da app as iniciais ganham o tom Mare atras de app:', () => {
    const { container } = render(<StaffAvatar member={{ name: 'Rui Lopes', status: 'active' }} />);
    const iniciais = container.firstChild.children[0].className;
    expect(iniciais).toContain('app:bg-ocean-100');
    expect(iniciais).toContain('app:text-ocean-800');
  });
});
