import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import ChecklistTab from '../pages/staff/ChecklistTab';
import { DEFAULT_TASKS, CHECKLIST_KEY } from '../pages/staff/shared';

const HEX = /#[0-9A-Fa-f]{3,8}(?![0-9A-Za-z])/;
const NOMEADAS = /(?:^|[\s"'])(?:[a-z-]+:)?(?:text|bg|border|fill|ring)-(?:green|yellow|blue|red|amber)-\d/;

let spyErr; let spyWarn;
/* so a data e simulada: os temporizadores reais continuam a funcionar */
function relogio(hora, minuto = 0) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 5, 10, hora, minuto, 0));
}
const hoje = () => new Date().toISOString().split('T')[0];
const guardado = () => JSON.parse(localStorage.getItem(CHECKLIST_KEY));

beforeEach(() => {
  spyErr = vi.spyOn(console, 'error').mockImplementation(() => {});
  spyWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  localStorage.clear();
  relogio(7, 30);
});
afterEach(() => {
  /* ler as contagens ANTES de restaurar os espioes */
  const erros = spyErr.mock.calls.map(c => String(c[0]).slice(0, 200));
  const avisos = spyWarn.mock.calls.map(c => String(c[0]).slice(0, 200));
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  expect(erros).toEqual([]);
  expect(avisos).toEqual([]);
});

const caixas = () => screen.getAllByRole('checkbox');

/* ───────────────────────── caracterizacao ───────────────────────── */

describe('Checklist do dia', () => {
  it('mostra_as_tarefas_por_omissao_e_o_contador', () => {
    render(<ChecklistTab />);
    expect(screen.getByText('Checklist do dia')).toBeInTheDocument();
    expect(screen.getByText(`${hoje()} · 0/5 concluidas`)).toBeInTheDocument();
    DEFAULT_TASKS.forEach(t => expect(screen.getByText(t)).toBeInTheDocument());
    expect(screen.queryByText('Tudo concluido')).toBeNull();
  });

  it('marcar_grava_em_localStorage_com_a_hora_e_desmarcar_remove', () => {
    render(<ChecklistTab />);
    fireEvent.click(caixas()[0]);
    const dados = guardado();
    expect(dados.tasks).toEqual(DEFAULT_TASKS);
    expect(dados.completions[hoje()]['0']).toMatchObject({ by: 'manager' });
    expect(typeof dados.completions[hoje()]['0'].at).toBe('string');
    expect(screen.getByText(`${hoje()} · 1/5 concluidas`)).toBeInTheDocument();
    expect(screen.getByText(/Confirmado as \d{2}:\d{2}/)).toBeInTheDocument();
    expect(caixas()[0]).toBeChecked();
    fireEvent.click(caixas()[0]);
    expect(guardado().completions[hoje()]).toEqual({});
    expect(screen.queryByText(/Confirmado as/)).toBeNull();
  });

  it('a_barra_de_progresso_segue_a_percentagem', () => {
    const { container } = render(<ChecklistTab />);
    const barra = () => container.querySelector('div[style*="width"]');
    expect(barra().style.width).toBe('0%');
    fireEvent.click(caixas()[0]);
    expect(barra().style.width).toBe('20%');
  });

  it('tudo_concluido_mostra_o_selo', () => {
    render(<ChecklistTab />);
    caixas().forEach(c => fireEvent.click(c));
    expect(screen.getByText('Tudo concluido')).toBeInTheDocument();
  });

  it('alerta_so_depois_das_8h_com_tarefas_por_completar', () => {
    render(<ChecklistTab />);
    expect(screen.queryByText(/por completar/)).toBeNull(); /* 7h30 */
    cleanup();
    relogio(8, 0);
    render(<ChecklistTab />);
    expect(screen.getByText('5 tarefa(s) por completar — verifique antes do tour')).toBeInTheDocument();
    fireEvent.click(caixas()[0]);
    expect(screen.getByText('4 tarefa(s) por completar — verifique antes do tour')).toBeInTheDocument();
    caixas().slice(1).forEach(c => fireEvent.click(c));
    expect(screen.queryByText(/por completar/)).toBeNull();
  });

  it('configurar_abre_o_painel_e_adicionar_com_Enter_ou_botao_grava', () => {
    render(<ChecklistTab />);
    expect(screen.queryByText('Gerir tarefas')).toBeNull();
    fireEvent.click(screen.getByTitle('Configurar checklist'));
    expect(screen.getByText('Gerir tarefas')).toBeInTheDocument();
    const campo = screen.getByPlaceholderText('Nova tarefa + Enter');
    fireEvent.change(campo, { target: { value: '  Limpar o barco ' } });
    fireEvent.keyDown(campo, { key: 'Enter' });
    expect(guardado().tasks).toEqual([...DEFAULT_TASKS, 'Limpar o barco']);
    expect(campo).toHaveValue('');
    fireEvent.change(campo, { target: { value: 'Outra' } });
    fireEvent.click(screen.getByRole('button', { name: /Adicionar/ }));
    expect(guardado().tasks).toHaveLength(7);
    fireEvent.change(campo, { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: /Adicionar/ }));
    expect(guardado().tasks).toHaveLength(7); /* vazio nao faz nada */
    fireEvent.click(screen.getByTitle('Configurar checklist'));
    expect(screen.queryByText('Gerir tarefas')).toBeNull();
  });

  it('remover_tarefa_grava_a_lista', () => {
    render(<ChecklistTab />);
    fireEvent.click(screen.getByTitle('Configurar checklist'));
    const painel = screen.getByText('Gerir tarefas').closest('div.bg-n-50');
    const linha = within(painel).getByText(DEFAULT_TASKS[1]).parentElement;
    fireEvent.click(linha.querySelector('button'));
    expect(guardado().tasks).toEqual(DEFAULT_TASKS.filter((_, i) => i !== 1));
    expect(screen.getByText(`${hoje()} · 0/4 concluidas`)).toBeInTheDocument();
  });

  it('sem_tarefas_mostra_o_texto_e_o_selo_de_tudo_concluido_com_0_de_0', () => {
    localStorage.setItem(CHECKLIST_KEY, JSON.stringify({ tasks: [], completions: {} }));
    render(<ChecklistTab />);
    expect(screen.getByText('Sem tarefas configuradas. Use o icone de configuracoes para adicionar.')).toBeInTheDocument();
    expect(screen.getByText(`${hoje()} · 0/0 concluidas`)).toBeInTheDocument();
    expect(screen.getByText('Tudo concluido')).toBeInTheDocument(); /* 0 === 0 */
  });

  it('le_o_que_estava_guardado_e_ignora_json_invalido', () => {
    localStorage.setItem(CHECKLIST_KEY, JSON.stringify({ tasks: ['A', 'B'], completions: { [hoje()]: { 1: { at: new Date().toISOString(), by: 'manager' } } } }));
    render(<ChecklistTab />);
    expect(screen.getByText(`${hoje()} · 1/2 concluidas`)).toBeInTheDocument();
    expect(caixas()[1]).toBeChecked();
    cleanup();
    localStorage.setItem(CHECKLIST_KEY, '{nao e json');
    render(<ChecklistTab />);
    expect(screen.getByText(`${hoje()} · 0/5 concluidas`)).toBeInTheDocument();
  });
});

/* ───────────────────────── design system ───────────────────────── */

describe('Checklist com o design system', () => {
  it('os_botoes_e_o_campo_tem_nome_acessivel', () => {
    render(<ChecklistTab />);
    fireEvent.click(screen.getByRole('button', { name: 'Configurar checklist' }));
    expect(screen.getByLabelText('Nova tarefa')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Remover tarefa - ${DEFAULT_TASKS[0]}` })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Remover tarefa - / })).toHaveLength(5);
  });

  it('o_selo_e_o_alerta_usam_tokens', () => {
    relogio(8, 0);
    render(<ChecklistTab />);
    const alerta = screen.getByText(/por completar/).closest('div');
    expect(alerta.className).toContain('var(--warning-light)');
    caixas().forEach(c => fireEvent.click(c));
    expect(screen.getByText('Tudo concluido').closest('span').className).toContain('var(--success-light)');
  });

  it('sem_hexadecimais_cores_nomeadas_ou_text_error_com_tudo_aberto', () => {
    relogio(9, 0);
    const { container } = render(<ChecklistTab />);
    fireEvent.click(screen.getByTitle('Configurar checklist'));
    fireEvent.click(caixas()[0]);
    let html = container.innerHTML;
    caixas().forEach(c => { if (!c.checked) fireEvent.click(c); });
    html += container.innerHTML;
    expect(html).not.toMatch(HEX);
    expect(html).not.toMatch(NOMEADAS);
    expect(html).not.toMatch(/(?:text|bg|border)-error/);
  });
});
