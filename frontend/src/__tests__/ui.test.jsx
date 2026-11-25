import { useState } from 'react';
import Toggle from '../components/ui/Toggle';
import Input, { Textarea, Select } from '../components/ui/Input';
import { vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Table from '../components/ui/Table';
import Tabs from '../components/ui/Tabs';
import FilterChips from '../components/ui/FilterChips';
import EmptyState from '../components/ui/EmptyState';
import { act } from '@testing-library/react';
import { Inbox } from 'lucide-react';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { ToastContainer } from '../components/ui/Toast';
import useToastStore from '../store/toastStore';
import { Skeleton } from '../components/ui/Skeleton';

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

/* Mare: classes app: dentro de [data-ui="app"]; fora dela as classes de sempre continuam na string */
function naApp(el) {
  return <div data-ui="app">{el}</div>;
}

describe('Button (Mare)', () => {
  it('md e sm tem altura e pilula da app e mantem as classes antigas', () => {
    render(naApp(<><Button>Medio</Button><Button size="sm">Pequeno</Button></>));
    const md = screen.getByRole('button', { name: 'Medio' }).className;
    const sm = screen.getByRole('button', { name: 'Pequeno' }).className;
    expect(md).toContain('app:h-11');
    expect(md).toContain('app:rounded-full');
    expect(md).toContain('h-9');
    expect(md).toContain('rounded-sm');
    expect(sm).toContain('app:h-9');
    expect(sm).toContain('h-8');
    expect(md).toContain('app:focus-visible:ring-sand-500');
  });

  it('fora da app as classes de sempre estao la e nao ha rounded-[6px]', () => {
    render(<Button>Medio</Button>);
    const cls = screen.getByRole('button', { name: 'Medio' }).className;
    expect(cls).toContain('h-9');
    expect(cls).toContain('rounded-sm');
    expect(cls).not.toContain('rounded-[6px]');
  });

  it('confirm e ocean-900 com texto branco', () => {
    render(naApp(<Button variant="confirm">Confirmar</Button>));
    const cls = screen.getByRole('button', { name: 'Confirmar' }).className;
    expect(cls).toContain('bg-ocean-900');
    expect(cls).toContain('hover:bg-ocean-800');
    expect(cls).toContain('text-white');
  });

  it('danger continua vermelho solido', () => {
    render(naApp(<Button variant="danger">Apagar</Button>));
    const cls = screen.getByRole('button', { name: 'Apagar' }).className;
    expect(cls).toContain('bg-error');
    expect(cls).toContain('text-white');
  });

  it('secondary e branco com contorno ocean-200 e ghost e transparente', () => {
    render(naApp(<><Button variant="secondary">Sec</Button><Button variant="ghost">Fantasma</Button></>));
    const sec = screen.getByRole('button', { name: 'Sec' }).className;
    expect(sec).toContain('app:border-ocean-200');
    expect(sec).toContain('app:text-ocean-700');
    expect(sec).toContain('app:hover:border-ocean-500');
    const gh = screen.getByRole('button', { name: 'Fantasma' }).className;
    expect(gh).toContain('bg-transparent');
    expect(gh).toContain('app:hover:bg-ocean-50');
    expect(gh).toContain('app:rounded-full');
  });
});

describe('Tabs (Mare)', () => {
  it('faixa branca arredondada com borda de cartao e abas em pilula na app', () => {
    const onChange = vi.fn();
    render(naApp(<Tabs tabs={[{ id: 'a', label: 'A' }, { id: 'b', label: 'B', count: 3 }]} value="a" onChange={onChange} />));
    const lista = screen.getByRole('tablist');
    expect(lista.className).toContain('app:border-mare-card');
    expect(lista.className).toContain('app:rounded-full');
    expect(lista.className).toContain('app:bg-white');
    expect(lista.className).toContain('overflow-x-auto');
    const a = screen.getByRole('tab', { name: 'A' });
    const b = screen.getByRole('tab', { name: /B/ });
    expect(a).toHaveAttribute('aria-selected', 'true');
    expect(a.className).toContain('app:bg-ocean-900');
    expect(a.className).toContain('app:min-h-10');
    expect(b).toHaveAttribute('aria-selected', 'false');
    fireEvent.click(b);
    expect(onChange).toHaveBeenCalledWith('b');
  });
});

describe('FilterChips (Mare)', () => {
  it('mantem o estado premido e onChange; o activo e ocean-900 na app', () => {
    const onChange = vi.fn();
    render(naApp(<FilterChips options={[{ value: 'x', label: 'X' }, { value: 'y', label: 'Y' }]} value="x" onChange={onChange} />));
    const x = screen.getByRole('button', { name: 'X' });
    const y = screen.getByRole('button', { name: 'Y' });
    expect(x).toHaveAttribute('aria-pressed', 'true');
    expect(y).toHaveAttribute('aria-pressed', 'false');
    expect(x.className).toContain('app:bg-ocean-900');
    expect(x.className).toContain('app:h-9');
    expect(y.className).toContain('app:border-mare-field');
    fireEvent.click(y);
    expect(onChange).toHaveBeenCalledWith('y');
  });
});

/* Fora da app: os tokens SEM prefixo app: tem de ser exactamente os de antes do estilo Mare (listas congeladas) */
const semApp = (cls) => cls.split(/\s+/).filter((t) => t && !t.startsWith('app:')).sort();
const lista = (s) => s.split(/\s+/).filter(Boolean).sort();

const BTN_BASE = 'inline-flex items-center justify-center font-body font-medium rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-300 disabled:opacity-50 disabled:cursor-not-allowed';
const BTN_VAR = {
  primary: 'bg-ocean-700 hover:bg-ocean-500 text-white border border-transparent',
  secondary: 'bg-white hover:bg-n-50 text-n-700 border border-n-300 dark:bg-n-800 dark:hover:bg-n-700 dark:text-n-200 dark:border-n-600',
  ghost: 'bg-transparent hover:bg-ocean-50 text-ocean-700 border border-transparent dark:text-ocean-300 dark:hover:bg-n-800',
  danger: 'bg-error hover:bg-red-700 text-white border border-transparent',
  accent: 'bg-sand-500 hover:bg-sand-400 text-ocean-900 border border-transparent font-bold',
  confirm: 'bg-ocean-900 hover:bg-ocean-800 text-white border border-transparent',
};
const BTN_SIZE = { sm: 'h-8 px-3 text-xs gap-1.5', md: 'h-9 px-4 text-sm gap-2', lg: 'h-11 px-6 text-sm gap-2' };

const CAMPO_COMUM = 'w-full px-3 rounded-sm border text-sm font-body bg-n-100 text-n-900 dark:bg-n-800 dark:text-n-100 focus:outline-none focus:ring-2 focus:ring-ocean-300 focus:border-ocean-700 focus:bg-white dark:focus:bg-n-800';
const CAMPO_BORDA = 'border-n-300 dark:border-n-600';
const CAMPO_ERRO = 'border-error';

describe('Fora da app as classes sao as de antes (tokens sem app:)', () => {
  it('Button: todas as variantes e tamanhos', () => {
    for (const v of Object.keys(BTN_VAR)) {
      for (const s of Object.keys(BTN_SIZE)) {
        const { unmount } = render(<Button variant={v} size={s}>x</Button>);
        expect(semApp(screen.getByRole('button').className)).toEqual(lista(`${BTN_BASE} ${BTN_VAR[v]} ${BTN_SIZE[s]}`));
        unmount();
      }
    }
  });

  it('Input, Select e Textarea (normal e com erro) e etiqueta e erro', () => {
    const { unmount } = render(<><Input label="a" /><Textarea label="b" /><Select label="c"><option>1</option></Select></>);
    expect(semApp(screen.getByLabelText('a').className)).toEqual(lista(`${CAMPO_COMUM} h-9 placeholder:text-n-400 transition-colors ${CAMPO_BORDA}`));
    expect(semApp(screen.getByLabelText('b').className)).toEqual(lista(`${CAMPO_COMUM} py-2 resize-none placeholder:text-n-400 transition-colors ${CAMPO_BORDA}`));
    expect(semApp(screen.getByLabelText('c').className)).toEqual(lista(`${CAMPO_COMUM} h-9 ${CAMPO_BORDA}`));
    expect(semApp(screen.getByText('a').className)).toEqual(lista('text-xs font-body font-bold uppercase tracking-wide text-n-600 dark:text-n-400'));
    unmount();
    render(<><Input label="a" error="e1" /><Textarea label="b" error="e2" /><Select label="c" error="e3"><option>1</option></Select></>);
    expect(semApp(screen.getByLabelText('a').className)).toEqual(lista(`${CAMPO_COMUM} h-9 placeholder:text-n-400 transition-colors ${CAMPO_ERRO}`));
    expect(semApp(screen.getByLabelText('b').className)).toEqual(lista(`${CAMPO_COMUM} py-2 resize-none placeholder:text-n-400 transition-colors ${CAMPO_ERRO}`));
    expect(semApp(screen.getByLabelText('c').className)).toEqual(lista(`${CAMPO_COMUM} h-9 ${CAMPO_ERRO}`));
    expect(semApp(screen.getByText('e1').className)).toEqual(lista('text-xs text-error'));
  });

  it('Toggle ligado e desligado', () => {
    render(<><Toggle label="on" checked onChange={() => {}} /><Toggle label="off" checked={false} onChange={() => {}} /></>);
    const base = 'shrink-0 w-10 h-5 rounded-full transition-colors relative mt-0.5';
    expect(semApp(screen.getByRole('switch', { name: 'on' }).className)).toEqual(lista(`${base} bg-ocean-700`));
    expect(semApp(screen.getByRole('switch', { name: 'off' }).className)).toEqual(lista(`${base} bg-n-300`));
  });

  it('Tabs: faixa, aba activa, aba inactiva e contadores', () => {
    render(<Tabs tabs={[{ id: 'a', label: 'A', count: 1 }, { id: 'b', label: 'B', count: 2 }]} value="a" onChange={() => {}} />);
    expect(semApp(screen.getByRole('tablist').className)).toEqual(lista('flex items-center gap-1 border-b border-n-200 overflow-x-auto overflow-y-hidden'));
    const aba = 'inline-flex items-center gap-1.5 px-3 py-2 -mb-px text-[13px] font-body font-medium whitespace-nowrap border-b-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-300 rounded-t-sm';
    expect(semApp(screen.getByRole('tab', { name: /A/ }).className)).toEqual(lista(`${aba} border-ocean-700 text-ocean-700`));
    expect(semApp(screen.getByRole('tab', { name: /B/ }).className)).toEqual(lista(`${aba} border-transparent text-n-500 hover:text-n-800`));
    const cont = 'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-[11px] font-semibold';
    expect(semApp(screen.getByText('1').className)).toEqual(lista(`${cont} bg-ocean-50 text-ocean-700`));
    expect(semApp(screen.getByText('2').className)).toEqual(lista(`${cont} bg-n-100 text-n-600`));
  });

  it('FilterChips: chip activo e inactivo', () => {
    render(<FilterChips options={[{ value: 'x', label: 'X' }, { value: 'y', label: 'Y' }]} value="x" onChange={() => {}} />);
    const chip = 'inline-flex items-center h-7 px-3 rounded-full border text-xs font-body font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-300';
    expect(semApp(screen.getByRole('button', { name: 'X' }).className)).toEqual(lista(`${chip} bg-ocean-700 border-ocean-700 text-white`));
    expect(semApp(screen.getByRole('button', { name: 'Y' }).className)).toEqual(lista(`${chip} bg-white border-n-300 text-n-700 hover:bg-n-50`));
  });
});

/* ---- Tarefa 3: cartoes, tabelas, etiquetas, janelas e avisos (Mare) ---- */
describe('Card, Table, Badge, Modal, ConfirmDialog, Toast, EmptyState, Skeleton (Mare, dentro da app)', () => {
  it('Card: raio 18, contorno do token e padding por omissao de 22 px; o padding passado ganha', () => {
    const { container, unmount } = render(naApp(<Card header="Titulo">corpo</Card>));
    const raiz = container.querySelector('[data-ui="app"]').firstChild;
    expect(raiz.className).toContain('app:rounded-[18px]');
    expect(raiz.className).toContain('app:border-mare-card');
    expect(raiz.className).not.toContain('app:rounded-sm');
    const cab = screen.getByText('Titulo');
    expect(cab.className).toContain('app:font-display');
    expect(cab.className).toContain('app:text-lg');
    expect(cab.className).toContain('app:font-semibold');
    expect(cab.className).not.toContain('app:bg-');
    expect(screen.getByText('corpo').className).toContain('app:p-[22px]');
    unmount();
    render(naApp(<Card padding="p-0">corpo</Card>));
    expect(screen.getByText('corpo').className).not.toContain('app:p-[22px]');
  });

  it('Table: cabecalho no token, maiusculas, linhas de 48 px e tom ao passar o rato', () => {
    render(naApp(<Table columns={[{ key: 'a', label: 'A', sortValue: (r) => r.a }]} rows={[{ id: 1, a: 'x' }]} />));
    const th = screen.getByRole('columnheader').className;
    expect(th).toContain('app:bg-mare-head');
    expect(th).toContain('app:text-n-600');
    expect(th).toContain('app:font-semibold');
    expect(th).toContain('app:uppercase');
    expect(th).not.toContain('app:normal-case');
    expect(th).not.toContain('app:bg-white');
    expect(screen.getByRole('button', { name: /A/ }).className).toContain('app:min-h-11');
    const tr = screen.getByRole('cell', { name: 'x' }).closest('tr').className;
    expect(tr).toContain('app:h-12');
    expect(tr).toContain('app:border-n-100');
    expect(tr).toContain('app:hover:bg-mare-head');
  });

  it('Badge: as 14 variantes tem o tom certo e um ponto decorativo', () => {
    const tons = {
      pending: 'sand', warning: 'sand', preparing: 'sand',
      confirmed: 'ocean', info: 'ocean', direct: 'ocean', received: 'ocean',
      checked_in: 'turquoise', ready: 'turquoise', delivered: 'turquoise',
      checked_out: 'neutral', no_show: 'neutral', default: 'neutral',
      cancelled: 'red',
    };
    const classes = {
      sand: ['app:bg-sand-100', 'app:text-n-800'],
      ocean: ['app:bg-ocean-100', 'app:text-ocean-800'],
      turquoise: ['app:bg-turquoise-100', 'app:text-turquoise-700'],
      neutral: ['app:bg-n-100', 'app:text-n-700'],
      red: ['app:bg-[var(--error-light)]', 'app:text-[var(--error)]'],
    };
    expect(Object.keys(tons)).toHaveLength(14);
    for (const [variante, tom] of Object.entries(tons)) {
      const { container, unmount } = render(naApp(<Badge variant={variante}>Texto</Badge>));
      const el = container.querySelector('[data-ui="app"]').firstChild;
      for (const c of classes[tom]) expect(el.className).toContain(c);
      const ponto = el.querySelector('span[aria-hidden="true"]');
      expect(ponto).not.toBeNull();
      expect(ponto.className).toContain('app:inline-block');
      expect(el.textContent).toBe('Texto');
      unmount();
    }
  });

  it('Modal: o botao de fechar mantem o nome e tem 44 px na app', () => {
    render(naApp(<Modal open onClose={() => {}} title="Titulo">corpo</Modal>));
    const fechar = screen.getByRole('button', { name: /fechar|close/i });
    expect(fechar.className).toContain('app:w-11');
    expect(fechar.className).toContain('app:h-11');
    const dialogo = screen.getByRole('dialog');
    expect(dialogo.className).toContain('app:rounded-[18px]');
    expect(dialogo.className).not.toContain('app:rounded-sm');
  });

  it('ConfirmDialog: mantem Cancelar e Confirmar e o botao de perigo; raio 18 na app', () => {
    const aoConfirmar = vi.fn();
    const aoCancelar = vi.fn();
    const { rerender } = render(naApp(<ConfirmDialog mensagem="Certeza?" onConfirmar={aoConfirmar} onCancelar={aoCancelar} />));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(aoCancelar).toHaveBeenCalledTimes(1);
    expect(aoConfirmar).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Confirmar' }).className).toContain('btn-danger');
    expect(screen.getByText('Certeza?').parentElement.className).toContain('app:rounded-[18px]');
    rerender(naApp(<ConfirmDialog mensagem="Certeza?" danger={false} onConfirmar={aoConfirmar} onCancelar={aoCancelar} />));
    expect(screen.getByRole('button', { name: 'Confirmar' }).className).toContain('btn-primary');
  });

  it('Toast: pastilha ocean-900 na app e role status mantido', () => {
    act(() => { useToastStore.setState({ toasts: [{ id: 1, type: 'success', message: 'Guardado' }] }); });
    render(naApp(<ToastContainer />));
    const aviso = screen.getByRole('status');
    expect(aviso.className).toContain('app:bg-ocean-900');
    expect(aviso.className).toContain('app:rounded-[14px]');
    expect(aviso).toHaveTextContent('Guardado');
    act(() => { useToastStore.setState({ toasts: [] }); });
  });

  it('EmptyState: sem icone mostra a onda decorativa; titulo e acao mantidos', () => {
    const { container } = render(naApp(<EmptyState title="Nada" action={<button>Criar</button>} />));
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg.getAttribute('class')).toContain('app:block');
    expect(screen.getByText('Nada').className).toContain('app:text-base');
    expect(screen.getByRole('button', { name: 'Criar' })).toBeInTheDocument();
    expect(container.querySelector('[data-ui="app"]').firstChild.className).toContain('app:bg-mare-head');
  });

  it('EmptyState: com icone nao desenha a onda', () => {
    const { container } = render(naApp(<EmptyState icon={Inbox} title="Nada" />));
    expect(container.querySelectorAll('svg')).toHaveLength(1);
    expect(container.querySelector('svg').getAttribute('class') || '').not.toContain('app:block');
  });

  it('Skeleton: raio da app, salvo se ja traz raio proprio', () => {
    const { container } = render(naApp(<><Skeleton className="h-4" /><Skeleton className="h-4 rounded-full" /></>));
    const [a, b] = container.querySelector('[data-ui="app"]').children;
    expect(a.className).toContain('app:rounded-[14px]');
    expect(b.className).not.toContain('app:rounded-[14px]');
  });
});

describe('Fora da app: Card, Table, Badge, Modal, ConfirmDialog, Toast, EmptyState, Skeleton ficam como antes', () => {
  it('Card', () => {
    render(<Card header="Cab" padding="p-6">corpo</Card>);
    const raiz = screen.getByText('corpo').parentElement;
    expect(semApp(raiz.className)).toEqual(lista('bg-white dark:bg-n-800 rounded-md border border-n-200 dark:border-n-700 shadow-sm'));
    expect(semApp(screen.getByText('Cab').className)).toEqual(lista('px-6 py-4 border-b border-n-200 dark:border-n-700'));
    expect(semApp(screen.getByText('corpo').className)).toEqual(lista('p-6'));
  });

  it('Table', () => {
    const { container } = render(<Table columns={[{ key: 'a', label: 'A', sortValue: (r) => r.a }]} rows={[{ id: 1, a: 'x' }]} />);
    expect(semApp(container.querySelector('thead tr').className)).toEqual(lista('border-b border-n-200'));
    expect(semApp(screen.getByRole('columnheader').className)).toEqual(lista('px-4 py-3 text-left text-xs font-body font-bold uppercase tracking-wide text-n-500'));
    expect(semApp(screen.getByRole('button', { name: /A/ }).className)).toEqual(lista('inline-flex items-center gap-1 uppercase tracking-wide font-bold hover:text-n-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-300 rounded-xs'));
    expect(semApp(screen.getByRole('cell', { name: 'x' }).closest('tr').className)).toEqual(lista('border-b border-n-100 hover:bg-n-50 transition-colors'));
    expect(semApp(screen.getByRole('cell', { name: 'x' }).className)).toEqual(lista('px-4 py-3 text-n-700'));
  });

  it('Badge: as 14 variantes, com o ponto escondido', () => {
    const base = 'inline-flex items-center px-2 py-0.5 rounded-xs text-xs font-body font-semibold uppercase tracking-wide';
    const v = {
      confirmed: 'bg-[var(--success-light)] text-[var(--success)]',
      pending: 'bg-[var(--warning-light)] text-[var(--warning)]',
      warning: 'bg-[var(--warning-light)] text-[var(--warning)]',
      cancelled: 'bg-[var(--error-light)] text-[var(--error)]',
      info: 'bg-[var(--info-light)] text-[var(--info)]',
      checked_in: 'bg-ocean-50 text-ocean-700 dark:bg-ocean-900 dark:text-ocean-200',
      checked_out: 'bg-n-100 text-n-600 dark:bg-n-700 dark:text-n-300',
      no_show: 'bg-n-100 text-n-500 dark:bg-n-700 dark:text-n-400',
      direct: 'bg-sand-50 text-sand-600 dark:bg-n-700 dark:text-sand-400',
      default: 'bg-n-100 text-n-600 dark:bg-n-700 dark:text-n-300',
      received: 'bg-[var(--info-light)] text-[var(--info)]',
      preparing: 'bg-[var(--warning-light)] text-[var(--warning)]',
      ready: 'bg-[var(--success-light)] text-[var(--success)]',
      delivered: 'bg-n-100 text-n-600 dark:bg-n-700 dark:text-n-300',
    };
    for (const [nome, cls] of Object.entries(v)) {
      const { unmount } = render(<Badge variant={nome}>Texto</Badge>);
      const el = screen.getByText('Texto');
      expect(semApp(el.className)).toEqual(lista(`${base} ${cls}`));
      expect(semApp(el.querySelector('span[aria-hidden="true"]').className)).toEqual(['hidden']);
      unmount();
    }
  });

  it('Modal', () => {
    render(<Modal open onClose={() => {}} title="Titulo">corpo</Modal>);
    expect(semApp(screen.getByRole('dialog').className)).toEqual(lista('w-full bg-white rounded-lg shadow-lg flex flex-col max-h-[90vh] max-w-lg'));
    expect(semApp(screen.getByRole('dialog').firstChild.className)).toEqual(lista('flex items-center justify-between px-6 py-4 border-b border-n-200 shrink-0'));
    expect(semApp(screen.getByText('Titulo').className)).toEqual(lista('font-display font-semibold text-base text-n-900'));
    expect(semApp(screen.getByRole('button', { name: /fechar|close/i }).className)).toEqual(lista('text-n-400 hover:text-n-700 transition-colors p-1 rounded-sm'));
  });

  it('ConfirmDialog', () => {
    render(<ConfirmDialog mensagem="Certeza?" onConfirmar={() => {}} onCancelar={() => {}} />);
    expect(semApp(screen.getByText('Certeza?').parentElement.className)).toEqual(lista('bg-white rounded-xl shadow-xl p-6 max-w-sm w-full'));
  });

  it('Toast', () => {
    act(() => { useToastStore.setState({ toasts: [{ id: 1, type: 'success', message: 'Guardado' }] }); });
    render(<ToastContainer />);
    const aviso = screen.getByRole('status');
    expect(semApp(aviso.className)).toEqual(lista('flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-white text-sm min-w-[280px] max-w-sm bg-green-500 animate-fade-in'));
    expect(semApp(aviso.firstChild.className)).toEqual(lista('text-base font-bold shrink-0'));
    act(() => { useToastStore.setState({ toasts: [] }); });
  });

  it('EmptyState: com a onda escondida', () => {
    const { container } = render(<EmptyState title="Nada" description="Desc" />);
    expect(semApp(container.firstChild.className)).toEqual(lista('flex flex-col items-center text-center px-4 py-8'));
    expect(semApp(screen.getByText('Nada').className)).toEqual(lista('font-display font-semibold text-sm text-n-900'));
    expect(semApp(screen.getByText('Desc').className)).toEqual(lista('font-body text-[13px] text-n-500 mt-0.5'));
    expect(semApp(container.querySelector('svg').getAttribute('class'))).toEqual(['hidden']);
  });

  it('Skeleton', () => {
    const { container } = render(<Skeleton className="h-4" />);
    expect(semApp(container.firstChild.className)).toEqual(lista('animate-pulse bg-gray-200 rounded h-4'));
  });
});
