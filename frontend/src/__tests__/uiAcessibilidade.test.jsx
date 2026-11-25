/* Componentes base (components/ui): Toggle com nome, Tabs com teclado, Input/Textarea/Select com
   etiqueta associada e "required" a sério, Badge com variante warning. */
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import Toggle from '../components/ui/Toggle';
import Tabs from '../components/ui/Tabs';
import Badge from '../components/ui/Badge';
import Input, { Textarea, Select } from '../components/ui/Input';

describe('Toggle', () => {
  it('e um interruptor com nome (a etiqueta) e estado', () => {
    const { rerender } = render(<Toggle checked={false} onChange={() => {}} label="Despesa recorrente" />);
    const sw = screen.getByRole('switch', { name: 'Despesa recorrente' });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    rerender(<Toggle checked onChange={() => {}} label="Despesa recorrente" />);
    expect(screen.getByRole('switch', { name: 'Despesa recorrente' })).toHaveAttribute('aria-checked', 'true');
  });

  it('a dica descreve o interruptor', () => {
    render(<Toggle checked={false} onChange={() => {}} label="Nova reserva" hint="Alertar de imediato" />);
    expect(screen.getByRole('switch', { name: 'Nova reserva' })).toHaveAccessibleDescription('Alertar de imediato');
  });

  it('aceita description como sinonimo de hint (o AdminSystem passava description e a descricao nunca aparecia)', () => {
    render(<Toggle checked={false} onChange={() => {}} label="Modo manutencao" description="Mostra pagina de manutencao" />);
    expect(screen.getByText('Mostra pagina de manutencao')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Modo manutencao' })).toHaveAccessibleDescription('Mostra pagina de manutencao');
  });

  it('sem etiqueta usa o aria-label recebido', () => {
    render(<Toggle checked onChange={() => {}} aria-label="Mostrar a seccao Galeria" />);
    expect(screen.getByRole('switch', { name: 'Mostrar a seccao Galeria' })).toBeInTheDocument();
  });

  it('clicar chama onChange com o valor contrario', () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} label="X" />);
    fireEvent.click(screen.getByRole('switch', { name: 'X' }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('dois interruptores na mesma pagina nao se confundem', () => {
    render(<><Toggle checked onChange={() => {}} label="A" hint="dica A" /><Toggle checked={false} onChange={() => {}} label="B" hint="dica B" /></>);
    expect(screen.getByRole('switch', { name: 'A' })).toHaveAccessibleDescription('dica A');
    expect(screen.getByRole('switch', { name: 'B' })).toHaveAccessibleDescription('dica B');
  });
});

describe('Tabs com teclado', () => {
  const tabs = [{ id: 'a', label: 'Todas' }, { id: 'b', label: 'Hoje' }, { id: 'c', label: 'Mes' }];

  function Controlado({ inicial = 'a' }) {
    const [v, setV] = useState(inicial);
    return <Tabs tabs={tabs} value={v} onChange={setV} />;
  }
  const abas = () => screen.getAllByRole('tab');
  const selecionada = () => abas().map(t => t.getAttribute('aria-selected') === 'true');
  const tecla = (i, key) => fireEvent.keyDown(abas()[i], { key });

  it('so a separador activo entra na ordem do Tab', () => {
    render(<Controlado inicial="b" />);
    expect(abas().map(t => t.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);
  });

  it('sem nenhum activo, o primeiro entra na ordem do Tab', () => {
    render(<Tabs tabs={tabs} value="nada" onChange={() => {}} />);
    expect(abas().map(t => t.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
  });

  it('seta direita activa e foca o seguinte, com volta ao principio', () => {
    render(<Controlado />);
    tecla(0, 'ArrowRight');
    expect(selecionada()).toEqual([false, true, false]);
    expect(document.activeElement).toBe(abas()[1]);
    tecla(1, 'ArrowRight');
    tecla(2, 'ArrowRight');
    expect(selecionada()).toEqual([true, false, false]);
    expect(document.activeElement).toBe(abas()[0]);
  });

  it('seta esquerda activa e foca o anterior, com volta ao fim', () => {
    render(<Controlado />);
    tecla(0, 'ArrowLeft');
    expect(selecionada()).toEqual([false, false, true]);
    expect(document.activeElement).toBe(abas()[2]);
  });

  it('Home e End vao ao primeiro e ao ultimo', () => {
    render(<Controlado inicial="b" />);
    tecla(1, 'End');
    expect(selecionada()).toEqual([false, false, true]);
    tecla(2, 'Home');
    expect(selecionada()).toEqual([true, false, false]);
  });

  it('outras teclas nao mudam nada', () => {
    const onChange = vi.fn();
    render(<Tabs tabs={tabs} value="a" onChange={onChange} />);
    tecla(0, 'a');
    tecla(0, 'Enter');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('o clique continua a funcionar', () => {
    const onChange = vi.fn();
    render(<Tabs tabs={tabs} value="a" onChange={onChange} />);
    fireEvent.click(abas()[2]);
    expect(onChange).toHaveBeenCalledWith('c');
  });
});

describe('Input, Textarea e Select: etiqueta associada', () => {
  it('Input: a etiqueta aponta para o campo', () => {
    render(<Input label="Nome" />);
    const campo = screen.getByLabelText('Nome');
    expect(campo.tagName).toBe('INPUT');
  });

  it('Textarea e Select tambem', () => {
    render(<><Textarea label="Notas" /><Select label="Pais"><option value="">-</option></Select></>);
    expect(screen.getByLabelText('Notas').tagName).toBe('TEXTAREA');
    expect(screen.getByLabelText('Pais').tagName).toBe('SELECT');
  });

  it('campos diferentes tem ids diferentes', () => {
    render(<><Input label="A" /><Input label="B" /></>);
    expect(screen.getByLabelText('A').id).not.toBe(screen.getByLabelText('B').id);
    expect(screen.getByLabelText('A').id).toBeTruthy();
  });

  it('um id recebido e respeitado', () => {
    render(<Input label="Email" id="meu-email" />);
    expect(screen.getByLabelText('Email')).toHaveAttribute('id', 'meu-email');
  });

  it('com a etiqueta marcada como obrigatoria o nome acessivel inclui o asterisco, mas o campo e encontrado pelo nome', () => {
    render(<Input label="Email" required />);
    expect(screen.getByLabelText(/Email/)).toBeRequired();
  });
});

describe('Input, Textarea e Select: required a sério', () => {
  it('required chega ao elemento nativo', () => {
    render(<><Input label="A" required /><Textarea label="B" required /><Select label="C" required><option value="">-</option></Select></>);
    ['A', 'B', 'C'].forEach(n => expect(screen.getByLabelText(new RegExp(n))).toBeRequired());
  });

  it('sem required o campo nao e obrigatorio', () => {
    render(<Input label="A" />);
    expect(screen.getByLabelText('A')).not.toBeRequired();
  });

  it('o formulario nao submete com um campo obrigatorio vazio e submete quando preenchido', () => {
    const onSubmit = vi.fn(e => e.preventDefault());
    render(<form onSubmit={onSubmit}><Input label="Nome" required /><button type="submit">Guardar</button></form>);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/Nome/), { target: { value: 'Ana' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});

describe('Input, Textarea e Select: erro e dica', () => {
  it('o erro e anunciado: aria-invalid e descricao acessivel', () => {
    render(<Input label="Email" error="Email invalido" />);
    const campo = screen.getByLabelText('Email');
    expect(campo).toHaveAttribute('aria-invalid', 'true');
    expect(campo).toHaveAccessibleDescription('Email invalido');
  });

  it('a dica descreve o campo quando nao ha erro', () => {
    render(<Input label="Pais" hint="Codigo ISO 2" />);
    const campo = screen.getByLabelText('Pais');
    expect(campo).toHaveAccessibleDescription('Codigo ISO 2');
    expect(campo).not.toHaveAttribute('aria-invalid');
  });

  it('Textarea e Select tambem anunciam o erro', () => {
    render(<><Textarea label="Notas" error="Demasiado longo" /><Select label="Tipo" error="Escolha um tipo"><option value="">-</option></Select></>);
    expect(screen.getByLabelText('Notas')).toHaveAccessibleDescription('Demasiado longo');
    expect(screen.getByLabelText('Tipo')).toHaveAccessibleDescription('Escolha um tipo');
  });

  it('um aria-describedby recebido nao se perde', () => {
    render(<><p id="extra">Mais ajuda</p><Input label="X" hint="dica" aria-describedby="extra" /></>);
    const d = screen.getByLabelText('X').getAttribute('aria-describedby');
    expect(d).toContain('extra');
    expect(screen.getByLabelText('X')).toHaveAccessibleDescription('Mais ajuda dica');
  });
});

describe('Badge: variante warning', () => {
  it('usa os tokens de aviso e nao os do cinzento por omissao', () => {
    render(<><Badge variant="warning">Atencao</Badge><Badge>Normal</Badge></>);
    const aviso = screen.getByText('Atencao').className;
    expect(aviso).toContain('var(--warning-light)');
    expect(aviso).toContain('var(--warning)');
    expect(screen.getByText('Normal').className).not.toContain('var(--warning)');
  });
});

describe('Mare: campos e interruptor', () => {
  it('Input na app: altura 44, raio 12, borda do campo, etiqueta e erro ligados', () => {
    render(<div data-ui="app"><Input label="Nome" error="Obrigatorio" /></div>);
    const campo = screen.getByLabelText('Nome');
    expect(campo.className).toContain('app:h-11');
    expect(campo.className).toContain('app:rounded-xl');
    expect(campo.className).toContain('app:focus:ring-sand-500');
    expect(campo.className).toContain('border-error');
    expect(campo).toHaveAttribute('aria-invalid', 'true');
    expect(campo).toHaveAccessibleDescription('Obrigatorio');
  });

  it('Input sem erro usa a borda do campo; Select e Textarea tambem', () => {
    render(<div data-ui="app"><Input label="A" /><Select label="B"><option>1</option></Select><Textarea label="C" /></div>);
    for (const nome of ['A', 'B', 'C']) {
      expect(screen.getByLabelText(nome).className).toContain('app:border-mare-field');
    }
    expect(screen.getByLabelText('B').className).toContain('app:h-11');
    expect(screen.getByLabelText('C').className).toContain('app:rounded-xl');
  });

  it('Toggle mantem role e estado e fica turquesa quando ligado', () => {
    render(<div data-ui="app"><Toggle label="Ligado" checked onChange={() => {}} /><Toggle label="Desligado" checked={false} onChange={() => {}} /></div>);
    const on = screen.getByRole('switch', { name: 'Ligado' });
    const off = screen.getByRole('switch', { name: 'Desligado' });
    expect(on).toHaveAttribute('aria-checked', 'true');
    expect(on.className).toContain('app:bg-turquoise-600');
    expect(on.className).toContain('app:before:-inset-y-3');
    expect(off).toHaveAttribute('aria-checked', 'false');
    expect(off.className).not.toContain('app:bg-turquoise-600');
  });
});
