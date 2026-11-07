import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import KanbanBoard from '../pages/staff/KanbanBoard';
import { PRIO_COLORS, KANBAN_COLS } from '../pages/staff/shared';
import useToastStore from '../store/toastStore';
import { listAssignments, startAssignment, completeAssignment, cancelAssignment, createAssignment } from '../services/assignmentService';
import { listReservations } from '../services/reservationsService';
import { COLABORADORES, ATRIBUICOES, RESERVAS, dia, meta } from './helpers/staffFixtures';

vi.mock('../services/assignmentService', () => ({
  listAssignments: vi.fn(), startAssignment: vi.fn(), completeAssignment: vi.fn(), cancelAssignment: vi.fn(), createAssignment: vi.fn(),
}));
vi.mock('../services/reservationsService', () => ({ listReservations: vi.fn() }));

const HEX = /#[0-9A-Fa-f]{3,8}(?![0-9A-Za-z])/;
const NOMEADAS = /(?:^|[\s"'])(?:[a-z-]+:)?(?:text|bg|border|fill|ring)-(?:green|yellow|blue|red|amber)-\d/;

let spyErr; let spyWarn; let errosEsperados;
beforeEach(() => {
  errosEsperados = false;
  spyErr = vi.spyOn(console, 'error').mockImplementation(() => {});
  spyWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  useToastStore.setState({ toasts: [] });
  listAssignments.mockReset().mockResolvedValue(ATRIBUICOES);
  listReservations.mockReset().mockResolvedValue(RESERVAS);
  [startAssignment, completeAssignment, cancelAssignment].forEach(f => f.mockReset().mockResolvedValue({}));
  createAssignment.mockReset();
});
afterEach(() => {
  /* ler as contagens ANTES de restaurar os espioes */
  const erros = spyErr.mock.calls.map(c => String(c[0]).slice(0, 200));
  const avisos = spyWarn.mock.calls.map(c => String(c[0]).slice(0, 200));
  cleanup();
  vi.restoreAllMocks();
  if (!errosEsperados) expect(erros).toEqual([]);
  expect(avisos).toEqual([]);
});

async function montar(props = {}) {
  const r = render(<KanbanBoard staffList={COLABORADORES} {...props} />);
  await screen.findByText('Nova tarefa');
  return r;
}
const coluna = (rotulo) => screen.getByText(rotulo, { selector: 'span' }).parentElement.parentElement;
const cartaoDe = (titulo) => screen.getByText(titulo).closest('div.cursor-pointer');
const toasts = () => useToastStore.getState().toasts.map(t => `${t.type}:${t.message}`);
const botaoNova = () => screen.getAllByText('Nova tarefa').find(e => e.closest('button')).closest('button');

/* ───────────────────────── caracterizacao ───────────────────────── */

describe('Tarefas: quadro', () => {
  it('agrupa_as_tarefas_por_coluna_e_confirmed_conta_em_progresso', async () => {
    await montar();
    expect(coluna('Pendente')).toHaveTextContent('2');
    ['Briefing', 'Tarefa atrasada'].forEach(t => expect(within(coluna('Pendente')).getByText(t)).toBeInTheDocument());
    ['Levar equipamento', 'Texto simples sem JSON'].forEach(t => expect(within(coluna('Em Progresso')).getByText(t)).toBeInTheDocument());
    expect(within(coluna('Concluida')).getByText('Tarefa feita')).toBeInTheDocument();
    expect(within(coluna('Bloqueada')).getByText('Tarefa bloqueada')).toBeInTheDocument();
    expect(screen.getByText('6 tarefa(s)')).toBeInTheDocument();
  });

  it('titulo_vem_do_json_ou_do_texto_ou_da_atribuicao_com_o_fim_do_id', async () => {
    listAssignments.mockResolvedValue([...ATRIBUICOES, { id: 'zzzzzz123456', status: 'pending', staff_id: null, notes_manager: null }]);
    await montar();
    expect(screen.getByText('Briefing')).toBeInTheDocument();
    expect(screen.getByText('Texto simples sem JSON')).toBeInTheDocument();
    expect(screen.getByText('Atribuicao #123456')).toBeInTheDocument();
  });

  it('prioridade_por_omissao_media_e_as_quatro_etiquetas', async () => {
    await montar();
    expect(within(cartaoDe('Briefing')).getByText('Alta')).toBeInTheDocument();
    expect(within(cartaoDe('Levar equipamento')).getByText('Baixa')).toBeInTheDocument();
    expect(within(cartaoDe('Tarefa feita')).getByText('Urgente')).toBeInTheDocument();
    expect(within(cartaoDe('Tarefa bloqueada')).getByText('Media')).toBeInTheDocument();
    expect(within(cartaoDe('Texto simples sem JSON')).getByText('Media')).toBeInTheDocument(); /* omissao */
  });

  it('tarefa_atrasada_so_com_prazo_passado_e_nao_concluida_nem_bloqueada', async () => {
    await montar();
    expect(screen.getByText('Existem tarefas com prazo ultrapassado')).toBeInTheDocument();
    expect(screen.getAllByText('Atrasada')).toHaveLength(1);
    expect(within(cartaoDe('Tarefa atrasada')).getByText('Atrasada')).toBeInTheDocument();
    expect(within(cartaoDe('Tarefa feita')).queryByText('Atrasada')).toBeNull();
    expect(within(cartaoDe('Tarefa bloqueada')).queryByText('Atrasada')).toBeNull();
    cleanup();
    listAssignments.mockResolvedValue(ATRIBUICOES.filter(a => a.id !== 'a6'));
    await montar();
    expect(screen.queryByText('Existem tarefas com prazo ultrapassado')).toBeNull();
  });

  it('cartao_mostra_sub_tarefas_responsavel_e_prazo', async () => {
    await montar();
    const c = cartaoDe('Briefing');
    expect(c).toHaveTextContent('2 sub-tarefas');
    expect(c).toHaveTextContent('Rui'); /* primeiro nome */
    expect(c).toHaveTextContent(new Date(dia(5)).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', timeZone: 'UTC' }));
    expect(within(cartaoDe('Texto simples sem JSON')).queryByText(/sub-tarefas/)).toBeNull();
  });

  it('mover_chama_o_servico_certo_e_muda_a_coluna', async () => {
    await montar();
    fireEvent.click(within(cartaoDe('Briefing')).getByText('Mover para Em Progresso'));
    await waitFor(() => expect(startAssignment).toHaveBeenCalledWith('a1'));
    await waitFor(() => expect(within(coluna('Em Progresso')).getByText('Briefing')).toBeInTheDocument());
    fireEvent.click(within(cartaoDe('Levar equipamento')).getByText('Mover para Concluida'));
    await waitFor(() => expect(completeAssignment).toHaveBeenCalledWith('a2'));
    await waitFor(() => expect(within(coluna('Concluida')).getByText('Levar equipamento')).toBeInTheDocument());
    /* confirmed -> em progresso */
    fireEvent.click(within(cartaoDe('Texto simples sem JSON')).getByText('Mover para Em Progresso'));
    await waitFor(() => expect(startAssignment).toHaveBeenCalledWith('a3'));
    /* concluida e bloqueada nao tem botao */
    expect(within(cartaoDe('Tarefa feita')).queryByText(/Mover para/)).toBeNull();
    expect(within(cartaoDe('Tarefa bloqueada')).queryByText(/Mover para/)).toBeNull();
  });

  it('falha_ao_mover_mostra_o_toast_e_nao_muda', async () => {
    errosEsperados = true;
    startAssignment.mockRejectedValueOnce({ response: { data: { error: 'Sem permissao' } } });
    await montar();
    fireEvent.click(within(cartaoDe('Briefing')).getByText('Mover para Em Progresso'));
    await waitFor(() => expect(toasts()).toContain('error:Sem permissao'));
    expect(within(coluna('Pendente')).getByText('Briefing')).toBeInTheDocument();
    startAssignment.mockRejectedValueOnce(new Error('x'));
    fireEvent.click(within(cartaoDe('Briefing')).getByText('Mover para Em Progresso'));
    await waitFor(() => expect(toasts()).toContain('error:Erro ao actualizar tarefa'));
  });

  it('filtro_por_colaborador_e_contador', async () => {
    await montar();
    const filtro = screen.getAllByRole('combobox')[0];
    expect(Array.from(filtro.options).map(o => o.textContent)).toEqual(['Todos os colaboradores', 'Rui Lopes', 'Ana Tavares', 'Vera Mendes']);
    fireEvent.change(filtro, { target: { value: 's1' } });
    expect(screen.getByText('4 tarefa(s)')).toBeInTheDocument();
    expect(screen.queryByText('Levar equipamento')).toBeNull();
  });

  it('sem_tarefas_mostra_Sem_tarefas_em_cada_coluna_e_em_carga_o_spinner', async () => {
    listAssignments.mockResolvedValue([]);
    await montar();
    expect(screen.getAllByText('Sem tarefas')).toHaveLength(4);
    cleanup();
    listAssignments.mockReturnValue(new Promise(() => {}));
    listReservations.mockReturnValue(new Promise(() => {}));
    render(<KanbanBoard staffList={COLABORADORES} />);
    expect(screen.queryByText('Nova tarefa')).toBeNull();
  });
});

describe('Tarefas: detalhe', () => {
  it('abrir_a_tarefa_mostra_o_detalhe', async () => {
    listAssignments.mockResolvedValue([{ id: 'a1', status: 'pending', staff_id: 's1', notes_manager: meta({ title: 'Briefing', desc: 'Falar com todos', priority: 'high', due: '2026-12-24', checklist: ['Material', 'Agua'] }) }]);
    await montar();
    fireEvent.click(cartaoDe('Briefing'));
    const dlg = screen.getByRole('dialog');
    expect(dlg).toHaveTextContent('Detalhe da tarefa');
    expect(dlg).toHaveTextContent('Falar com todos');
    expect(dlg).toHaveTextContent('Alta');
    expect(dlg).toHaveTextContent(new Date('2026-12-24').toLocaleDateString('pt-PT', { timeZone: 'UTC' }));
    expect(dlg).toHaveTextContent('Rui Lopes');
    ['Checklist', 'Material', 'Agua'].forEach(t => expect(within(dlg).getByText(t)).toBeInTheDocument());
  });

  it('as_accoes_dependem_do_estado', async () => {
    await montar();
    const accoes = (titulo) => {
      fireEvent.click(cartaoDe(titulo));
      const dlg = screen.getByRole('dialog');
      const nomes = ['Iniciar', 'Concluir', 'Bloquear'].filter(n => within(dlg).queryByRole('button', { name: n }));
      fireEvent.click(within(dlg).getByRole('button', { name: 'Fechar' }));
      return nomes;
    };
    expect(accoes('Briefing')).toEqual(['Iniciar', 'Concluir', 'Bloquear']);
    expect(accoes('Levar equipamento')).toEqual(['Concluir', 'Bloquear']);
    expect(accoes('Texto simples sem JSON')).toEqual(['Concluir', 'Bloquear']); /* confirmed */
    expect(accoes('Tarefa feita')).toEqual(['Bloquear']);
    expect(accoes('Tarefa bloqueada')).toEqual([]);
  });

  it('iniciar_concluir_e_bloquear_chamam_os_servicos_e_fecham', async () => {
    await montar();
    fireEvent.click(cartaoDe('Briefing'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Iniciar' }));
    await waitFor(() => expect(startAssignment).toHaveBeenCalledWith('a1'));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(cartaoDe('Tarefa atrasada'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Concluir' }));
    await waitFor(() => expect(completeAssignment).toHaveBeenCalledWith('a6'));
    fireEvent.click(cartaoDe('Levar equipamento'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Bloquear' }));
    await waitFor(() => expect(cancelAssignment).toHaveBeenCalledWith('a2'));
  });
});

describe('Tarefas: criar', () => {
  const abrirModal = async () => {
    fireEvent.click(botaoNova());
    return screen.findByRole('dialog');
  };

  it('criar_exige_reserva_senao_mostra_o_toast', async () => {
    await montar();
    const dlg = await abrirModal();
    fireEvent.change(within(dlg).getByPlaceholderText('Titulo da tarefa'), { target: { value: 'Sem reserva' } });
    fireEvent.submit(dlg.querySelector('form'));
    expect(toasts()).toContain('error:Escolha a reserva a que esta tarefa pertence');
    expect(createAssignment).not.toHaveBeenCalled();
  });

  it('criar_envia_notes_manager_em_json_acrescenta_fecha_e_limpa_o_formulario', async () => {
    createAssignment.mockResolvedValue({ id: 'novo', status: 'pending', staff_id: 's1', notes_manager: meta({ title: 'Nova coisa' }) });
    await montar();
    const dlg = await abrirModal();
    const [reserva, prioridade, colaborador] = within(dlg).getAllByRole('combobox');
    expect(Array.from(reserva.options).map(o => o.textContent)).toEqual([
      'Escolha a reserva...', 'Maria Cliente — Buggy Tour (2026-12-01)', 'Sem Unidade — Servico (2026-12-03)',
    ]);
    expect(Array.from(colaborador.options).map(o => o.textContent)).toEqual(['Sem atribuicao', 'Rui Lopes', 'Vera Mendes']); /* so activos */
    expect(Array.from(prioridade.options).map(o => o.textContent)).toEqual(['Baixa', 'Media', 'Alta', 'Urgente']);
    fireEvent.change(within(dlg).getByPlaceholderText('Titulo da tarefa'), { target: { value: 'Nova coisa' } });
    fireEvent.change(reserva, { target: { value: 'r1' } });
    fireEvent.change(within(dlg).getByPlaceholderText('Descricao opcional'), { target: { value: 'Detalhes' } });
    fireEvent.change(prioridade, { target: { value: 'high' } });
    fireEvent.change(dlg.querySelector('input[type="date"]'), { target: { value: '2026-12-31' } });
    fireEvent.change(colaborador, { target: { value: 's1' } });
    fireEvent.change(dlg.querySelectorAll('textarea')[1], { target: { value: 'A\nB\n\nC' } });
    fireEvent.click(within(dlg).getByRole('button', { name: 'Criar tarefa' }));
    await waitFor(() => expect(createAssignment).toHaveBeenCalledTimes(1));
    const payload = createAssignment.mock.calls[0][0];
    expect(payload).toMatchObject({ reservation_id: 'r1', staff_id: 's1' });
    expect(JSON.parse(payload.notes_manager)).toEqual({ title: 'Nova coisa', desc: 'Detalhes', priority: 'high', due: '2026-12-31', checklist: ['A', 'B', 'C'] });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(within(coluna('Pendente')).getByText('Nova coisa')).toBeInTheDocument();
    const outra = await abrirModal();
    expect(within(outra).getByPlaceholderText('Titulo da tarefa')).toHaveValue('');
  });

  it('sem_colaborador_vai_staff_id_nulo', async () => {
    createAssignment.mockResolvedValue({ id: 'novo', status: 'pending', notes_manager: 'x' });
    await montar();
    const dlg = await abrirModal();
    fireEvent.change(within(dlg).getByPlaceholderText('Titulo da tarefa'), { target: { value: 'T' } });
    fireEvent.change(within(dlg).getAllByRole('combobox')[0], { target: { value: 'r3' } });
    fireEvent.click(within(dlg).getByRole('button', { name: 'Criar tarefa' }));
    await waitFor(() => expect(createAssignment).toHaveBeenCalledWith(expect.objectContaining({ reservation_id: 'r3', staff_id: null })));
  });

  it('falha_ao_criar_mostra_o_toast', async () => {
    errosEsperados = true;
    createAssignment.mockRejectedValue({ response: { data: { error: 'Reserva invalida' } } });
    await montar();
    const dlg = await abrirModal();
    fireEvent.change(within(dlg).getByPlaceholderText('Titulo da tarefa'), { target: { value: 'T' } });
    fireEvent.change(within(dlg).getAllByRole('combobox')[0], { target: { value: 'r1' } });
    fireEvent.click(within(dlg).getByRole('button', { name: 'Criar tarefa' }));
    await waitFor(() => expect(toasts()).toContain('error:Reserva invalida'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('listReservations_a_falhar_deixa_so_o_marcador', async () => {
    listReservations.mockRejectedValue(new Error('x'));
    await montar();
    const dlg = await abrirModal();
    expect(Array.from(within(dlg).getAllByRole('combobox')[0].options).map(o => o.textContent)).toEqual(['Escolha a reserva...']);
  });
});

/* ───────────────────────── design system ───────────────────────── */

describe('Tarefas com o design system', () => {
  it('o_filtro_e_os_campos_do_modal_tem_nome_acessivel', async () => {
    await montar();
    expect(screen.getByLabelText('Filtrar por colaborador')).toBeInTheDocument();
    fireEvent.click(botaoNova());
    const dlg = within(await screen.findByRole('dialog'));
    ['Titulo', 'Reserva', 'Descricao', 'Prioridade', 'Data limite', 'Colaborador', 'Checklist (uma por linha)']
      .forEach(r => expect(dlg.getByLabelText(r)).toBeInTheDocument());
  });

  it('as_cores_das_colunas_e_das_prioridades_sao_tokens', () => {
    expect(KANBAN_COLS.find(c => c.key === 'pending').color).toContain('var(--warning');
    expect(KANBAN_COLS.find(c => c.key === 'completed').color).toContain('var(--success');
    expect(KANBAN_COLS.find(c => c.key === 'cancelled').color).toContain('var(--error');
    expect(PRIO_COLORS.medium).toContain('var(--warning');
    expect(PRIO_COLORS.high).toContain('var(--error');
    expect(PRIO_COLORS.urgent).toContain('var(--error');
    [...Object.values(PRIO_COLORS), ...KANBAN_COLS.map(c => c.color)].forEach(c => {
      expect(c).not.toMatch(HEX);
      expect(c).not.toMatch(NOMEADAS);
    });
  });

  it('o_quadro_com_atraso_e_o_modal_de_criar_sem_hexadecimais_cores_nomeadas_ou_error', async () => {
    const { container } = await montar();
    fireEvent.click(botaoNova());
    await screen.findByRole('dialog');
    const html = container.innerHTML;
    expect(html).not.toMatch(HEX);
    expect(html).not.toMatch(NOMEADAS);
    expect(html.replace(/text-error ml-0[.]5/g, '')).not.toMatch(/(?:text|bg|border)-error/);
  });
});
