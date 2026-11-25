/* PageHeader: cabecalho de pagina. Dentro da app (data-ui="app") ganha o look Mare; fora, mantem as classes de sempre. */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import PageHeader from '../components/layout/PageHeader';

function dentroDaApp(ui) {
  return render(<div data-ui="app">{ui}</div>);
}

describe('PageHeader', () => {
  it('o titulo e um h1 em Sora', () => {
    dentroDaApp(<PageHeader title="Reservas" />);
    const h1 = screen.getByRole('heading', { level: 1, name: 'Reservas' });
    expect(h1.className).toContain('font-display');
  });

  it('mostra o eyebrow quando e dado e nada extra quando nao e', () => {
    const { container, unmount } = dentroDaApp(<PageHeader title="Reservas" eyebrow="Operacao" />);
    expect(screen.getByText('Operacao')).toBeInTheDocument();
    unmount();
    const sem = dentroDaApp(<PageHeader title="Reservas" />);
    expect(sem.container.querySelectorAll('[data-eyebrow]').length).toBe(0);
    expect(sem.container.querySelector('h1').previousElementSibling).toBeNull();
    expect(container).toBeTruthy();
  });

  it('dentro da app nao tem divisoria inferior', () => {
    dentroDaApp(<PageHeader title="Reservas" />);
    const raiz = screen.getByRole('heading', { level: 1 }).parentElement.parentElement;
    const classes = raiz.className.split(/\s+/);
    expect(classes).toContain('app:border-b-0');
    expect(classes).not.toContain('app:border-b');
  });

  it('fora da app mantem as classes de sempre, incluindo border-b', () => {
    render(<PageHeader title="Reservas" subtitle="Hoje" />);
    const raiz = screen.getByRole('heading', { level: 1 }).parentElement.parentElement;
    expect(raiz.className.split(/\s+/)).toContain('border-b');
    expect(screen.getByText('Hoje')).toBeInTheDocument();
  });

  it('mostra as accoes quando dadas', () => {
    dentroDaApp(<PageHeader title="Reservas" actions={<button>Nova</button>} />);
    expect(screen.getByRole('button', { name: 'Nova' })).toBeInTheDocument();
  });
});
