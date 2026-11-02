import { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Table from '../components/ui/Table';
import Tabs from '../components/ui/Tabs';
import FilterChips from '../components/ui/FilterChips';
import EmptyState from '../components/ui/EmptyState';

describe('Button', () => {
  it('primary mantem o aspeto antigo e ganha o novo', () => {
    render(<Button>Gravar</Button>);
    const cls = screen.getByRole('button', { name: 'Gravar' }).className;
    expect(cls).toContain('bg-ocean-700');
    expect(cls).toContain('app:bg-sand-500');
  });

  it('danger nao e redefinido', () => {
    render(<Button variant="danger">Apagar</Button>);
    const cls = screen.getByRole('button', { name: 'Apagar' }).className;
    expect(cls).not.toContain('app:bg-sand-500');
  });
});

describe('Badge', () => {
  it('mantem uppercase e acrescenta app:normal-case', () => {
    render(<Badge>Novo</Badge>);
    const cls = screen.getByText('Novo').className;
    expect(cls).toContain('uppercase');
    expect(cls).toContain('app:normal-case');
  });
});

describe('Table', () => {
  const cols = [{ key: 'n', label: 'N', sortValue: (r) => r.n, align: 'right' }];
  const rows = [{ id: 'a', n: 2 }, { id: 'b', n: 10 }, { id: 'c', n: 1 }];

  function ordem() {
    return screen
      .getAllByRole('row')
      .slice(1)
      .map((r) => within(r).getByRole('cell').textContent);
  }

  it('ordena ascendente, descendente e volta a ordem original', () => {
    render(<Table columns={cols} rows={rows} />);
    const th = screen.getByRole('columnheader');
    expect(ordem()).toEqual(['2', '10', '1']);
    expect(th).toHaveAttribute('aria-sort', 'none');

    fireEvent.click(within(th).getByRole('button'));
    expect(ordem()).toEqual(['1', '2', '10']);
    expect(th).toHaveAttribute('aria-sort', 'ascending');

    fireEvent.click(within(th).getByRole('button'));
    expect(ordem()).toEqual(['10', '2', '1']);
    expect(th).toHaveAttribute('aria-sort', 'descending');

    fireEvent.click(within(th).getByRole('button'));
    expect(ordem()).toEqual(['2', '10', '1']);
    expect(th).toHaveAttribute('aria-sort', 'none');
  });

  it('nao altera o array rows recebido', () => {
    const copia = [...rows];
    render(<Table columns={cols} rows={copia} />);
    fireEvent.click(screen.getByRole('button', { name: /N/ }));
    expect(copia).toEqual(rows);
  });

  it('mantem a ordem original nos empates', () => {
    const empates = [{ id: 'x', n: 1 }, { id: 'y', n: 1 }, { id: 'z', n: 0 }];
    const c = [
      { key: 'n', label: 'N', sortValue: (r) => r.n },
      { key: 'id', label: 'Id' },
    ];
    render(<Table columns={c} rows={empates} />);
    fireEvent.click(screen.getByRole('button', { name: /N/ }));
    const ids = screen.getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[1].textContent);
    expect(ids).toEqual(['z', 'x', 'y']);
  });

  it('colunas sem sortValue nao tem botao de ordenacao', () => {
    render(<Table columns={[{ key: 'id', label: 'Id' }]} rows={rows} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('alinha as celulas da coluna a direita', () => {
    render(<Table columns={cols} rows={rows} />);
    const celulas = screen.getAllByRole('cell');
    celulas.forEach((c) => expect(c.className).toContain('text-right'));
    expect(screen.getByRole('columnheader').className).toContain('text-right');
  });

  it('cabecalho fixo so na app do operador', () => {
    render(<Table columns={cols} rows={rows} />);
    const cls = screen.getByRole('columnheader').className;
    expect(cls).toContain('app:sticky');
    expect(cls).toContain('app:top-0');
    expect(cls).not.toMatch(/(^|\s)sticky(\s|$)/);
    expect(cls).not.toMatch(/(^|\s)top-0(\s|$)/);
    expect(cls).not.toMatch(/(^|\s)z-10(\s|$)/);
  });

  it('maxHeight limita o wrapper e ativa o scroll vertical', () => {
    const { container } = render(<Table columns={cols} rows={rows} maxHeight="max-h-40" />);
    expect(container.firstChild.className).toContain('max-h-40');
    expect(container.firstChild.className).toContain('overflow-y-auto');
  });

  it('sem maxHeight o wrapper nao tem overflow-y-auto', () => {
    const { container } = render(<Table columns={cols} rows={rows} />);
    expect(container.firstChild.className).not.toContain('overflow-y-auto');
    expect(container.firstChild.className).toBe('overflow-x-auto');
  });

  it('vazia mostra emptyMessage', () => {
    render(<Table columns={cols} rows={[]} emptyMessage="Sem dados" />);
    expect(screen.getByText('Sem dados')).toBeInTheDocument();
  });
});

describe('Tabs', () => {
  const tabs = [
    { id: 'a', label: 'Todas', count: 7 },
    { id: 'b', label: 'Hoje' },
  ];

  it('clicar chama onChange com o id e a ativa tem aria-selected', () => {
    const onChange = vi.fn();
    render(<Tabs tabs={tabs} value="a" onChange={onChange} />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Todas/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Hoje' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByText('7')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Hoje' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });
});

describe('FilterChips', () => {
  const options = [
    { value: 'all', label: 'Todos' },
    { value: 'open', label: 'Abertos' },
  ];

  it('clicar chama onChange e o selecionado tem aria-pressed', () => {
    const onChange = vi.fn();
    function Wrapper() {
      const [v, setV] = useState('all');
      return <FilterChips options={options} value={v} onChange={(x) => { onChange(x); setV(x); }} />;
    }
    render(<Wrapper />);
    expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Abertos' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Abertos' }));
    expect(onChange).toHaveBeenCalledWith('open');
    expect(screen.getByRole('button', { name: 'Abertos' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('EmptyState', () => {
  it('mostra titulo, descricao e action', () => {
    render(
      <EmptyState
        title="Sem reservas"
        description="Crie a primeira reserva"
        action={<button>Nova reserva</button>}
      />
    );
    expect(screen.getByText('Sem reservas')).toBeInTheDocument();
    expect(screen.getByText('Crie a primeira reserva')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nova reserva' })).toBeInTheDocument();
  });
});
