import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import Table from '../components/ui/Table';

/* A tabela partilhada: o modo "compact" reduz o espaco lateral das celulas para
   tabelas largas caberem no ecra sem scroll horizontal. */
const COLUNAS = [
  { key: 'a', label: 'A', render: (r) => r.a },
  { key: 'b', label: 'B', render: (r) => r.b },
];
const LINHAS = [{ id: '1', a: 'um', b: 'dois' }];

describe('Table: espaco das celulas', () => {
  afterEach(cleanup);

  it('por omissao usa o espaco lateral normal (px-4) no cabecalho e nas celulas', () => {
    render(<Table columns={COLUNAS} rows={LINHAS} />);
    expect(screen.getByRole('columnheader', { name: 'A' }).className).toContain('px-4');
    expect(screen.getByRole('cell', { name: 'um' }).className).toContain('px-4');
  });

  it('com compact usa um espaco lateral menor (px-2.5) e deixa de usar px-4', () => {
    render(<Table columns={COLUNAS} rows={LINHAS} compact />);
    for (const el of [screen.getByRole('columnheader', { name: 'A' }), screen.getByRole('cell', { name: 'um' })]) {
      expect(el.className).toContain('px-2.5');
      expect(el.className).not.toContain('px-4');
    }
  });
});
