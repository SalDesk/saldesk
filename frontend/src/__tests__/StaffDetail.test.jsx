import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import StaffDetail from '../pages/StaffDetail';
import useToastStore from '../store/toastStore';
import {
  getStaff, listLeave, createLeave, updateLeaveStatus, getLeaveBalance, setLeaveBalance,
  listDocuments, createDocument, deleteDocument, listCertifications, createCertification, deleteCertification,
} from '../services/staffService';
import { getSalaryConfig, getSalaryPayments } from '../services/expensesService';
import { uploadDocument, validateDocumentFile } from '../services/uploadService';
import { FUTURE, dia } from './helpers/staffFixtures';

vi.mock('../services/staffService', () => ({
  getStaff: vi.fn(), listLeave: vi.fn(), createLeave: vi.fn(), updateLeaveStatus: vi.fn(), getLeaveBalance: vi.fn(), setLeaveBalance: vi.fn(),
  listDocuments: vi.fn(), createDocument: vi.fn(), deleteDocument: vi.fn(),
  listCertifications: vi.fn(), createCertification: vi.fn(), deleteCertification: vi.fn(),
}));
vi.mock('../services/expensesService', () => ({ getSalaryConfig: vi.fn(), getSalaryPayments: vi.fn() }));
vi.mock('../services/uploadService', () => ({ uploadDocument: vi.fn(), validateDocumentFile: vi.fn() }));

const HEX = /#[0-9A-Fa-f]{3,8}(?![0-9A-Za-z])/;
const NOMEADAS = /(?:^|[\s"'])(?:[a-z-]+:)?(?:text|bg|border|fill|ring)-(?:green|yellow|blue|red|amber)-\d/;
const ANO = new Date().getFullYear();

const PEDIDOS = [
  { id: 'l1', type: 'vacation', start_date: '2026-12-01', end_date: '2026-12-05', status: 'pending', notes: 'Natal' },
  { id: 'l2', type: 'sick', start_date: '2026-11-02', end_date: '2026-11-02', status: 'approved', notes: null },
  { id: 'l3', type: 'xyz', start_date: '2026-10-01', end_date: '2026-10-03', status: 'rejected', notes: null },
];
const SALDO = { entitled_days: 22, used_days: 5, remaining_days: 17, suggested_days: null };

let spyErr; let spyWarn;
beforeEach(() => {
  spyErr = vi.spyOn(console, 'error').mockImplementation(() => {});
  spyWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  useToastStore.setState({ toasts: [] });
  getStaff.mockReset().mockResolvedValue({ id: 's1', name: 'Rui Lopes', role: 'Guia' });
  listLeave.mockReset().mockResolvedValue(PEDIDOS);
  getLeaveBalance.mockReset().mockResolvedValue(SALDO);
  createLeave.mockReset().mockResolvedValue({});
  updateLeaveStatus.mockReset().mockResolvedValue({});
  setLeaveBalance.mockReset().mockResolvedValue({});
  listDocuments.mockReset().mockResolvedValue([]);
  listCertifications.mockReset().mockResolvedValue([]);
  getSalaryConfig.mockReset().mockResolvedValue({ s1: { base: 1000, food: 50, transport: 30, inps_pct: 15 } });
  getSalaryPayments.mockReset().mockResolvedValue([
    { id: 'p1', staffId: 's1', year: ANO, month: 3, amount: 1230 },
    { id: 'p2', staffId: 's1', year: ANO - 1, month: 12, amount: 1000 },
    { id: 'p3', staffId: 's2', year: ANO, month: 1, amount: 999 },
  ]);
});
afterEach(() => {
  /* ler as contagens ANTES de restaurar os espioes */
  const erros = spyErr.mock.calls.map(c => String(c[0]).slice(0, 200));
  const avisos = spyWarn.mock.calls.map(c => String(c[0]).slice(0, 200));
  cleanup();
  vi.restoreAllMocks();
  expect(erros).toEqual([]);
  expect(avisos).toEqual([]);
});

async function montar() {
  const r = render(
    <MemoryRouter future={FUTURE} initialEntries={['/colaboradores/s1']}>
      <Routes>
        <Route path="/colaboradores/:staffId" element={<StaffDetail />} />
        <Route path="/colaboradores" element={<p>LISTA DE COLABORADORES</p>} />
        <Route path="/financeiro" element={<p>PAGINA FINANCEIRO</p>} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { name: 'Rui Lopes' });
  return r;
}
const toasts = () => useToastStore.getState().toasts.map(t => `${t.type}:${t.message}`);
/* separadores: antes botoes, depois role=tab; o texto e o mesmo */
function abrir(rotulo) {
  const el = screen.getAllByText(rotulo).find(e => e.closest('button, [role="tab"]'));
  fireEvent.click(el.closest('button, [role="tab"]'));
}
const eur2 = (n) => `€${Number(n).toFixed(2)}`;
const linha = (texto) => screen.getByText(texto, { exact: false }).closest('div.justify-between');

/* ───────────────────────── caracterizacao: estrutura e Ferias ───────────────────────── */

describe('Detalhe do colaborador: estrutura', () => {
  it('mostra_o_nome_e_o_cargo_ou_Colaborador_enquanto_nao_carrega_ou_se_falhar', async () => {
    await montar();
    expect(screen.getByText('Guia')).toBeInTheDocument();
    cleanup();
    getStaff.mockRejectedValue(new Error('x'));
    render(<MemoryRouter future={FUTURE} initialEntries={['/colaboradores/s1']}><Routes><Route path="/colaboradores/:staffId" element={<StaffDetail />} /></Routes></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Colaborador' })).toBeInTheDocument();
    expect(getStaff).toHaveBeenCalledWith('s1');
  });

  it('voltar_navega_para_colaboradores', async () => {
    await montar();
    fireEvent.click(screen.getByRole('button', { name: /Colaboradores/ }));
    expect(await screen.findByText('LISTA DE COLABORADORES')).toBeInTheDocument();
  });

  it('os_quatro_separadores_abrem_sem_rebentar', async () => {
    await montar();
    abrir('Salario');
    expect(await screen.findByText('Historico de pagamentos')).toBeInTheDocument();
    abrir('Documentos');
    expect(await screen.findByText('Contratos e documentos')).toBeInTheDocument();
    abrir('Certificacoes');
    expect(await screen.findByText('Formacao e certificacoes')).toBeInTheDocument();
    abrir('Ferias');
    expect(await screen.findByText('Pedidos')).toBeInTheDocument();
  });
});

describe('Detalhe do colaborador: Ferias', () => {
  it('mostra_direito_usados_restantes_e_os_pedidos', async () => {
    await montar();
    expect(await screen.findByText(`Direito (${ANO})`)).toBeInTheDocument();
    expect(getLeaveBalance).toHaveBeenCalledWith('s1', ANO);
    expect(listLeave).toHaveBeenCalledWith('s1');
    expect(screen.getByText('22 dias')).toBeInTheDocument();
    expect(screen.getByText('5 dias')).toBeInTheDocument();
    expect(screen.getByText('17 dias')).toBeInTheDocument();
    expect(linha('2026-12-01 → 2026-12-05')).toHaveTextContent('Ferias · 2026-12-01 → 2026-12-05 (5 dias)');
    expect(linha('2026-12-01 → 2026-12-05')).toHaveTextContent('Natal');
    expect(linha('2026-12-01 → 2026-12-05')).toHaveTextContent('Pendente');
    expect(linha('2026-11-02 → 2026-11-02')).toHaveTextContent('Doenca');
    expect(linha('2026-11-02 → 2026-11-02')).toHaveTextContent('(1 dias)');
    expect(linha('2026-11-02 → 2026-11-02')).toHaveTextContent('Aprovado');
    expect(linha('2026-10-01 → 2026-10-03')).toHaveTextContent('xyz'); /* tipo desconhecido tal e qual */
    expect(linha('2026-10-01 → 2026-10-03')).toHaveTextContent('Rejeitado');
    expect(screen.getAllByRole('button', { name: 'Aprovar' })).toHaveLength(1); /* so pendentes */
    expect(screen.getAllByRole('button', { name: 'Rejeitar' })).toHaveLength(1);
  });

  it('sem_direito_mostra_a_sugestao_ou_a_instrucao', async () => {
    getLeaveBalance.mockResolvedValue({ entitled_days: null, suggested_days: 18, used_days: 0 });
    await montar();
    expect(await screen.findByText(/Sugestao com base na data de admissao.*18 dias/)).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    cleanup();
    getLeaveBalance.mockResolvedValue({ entitled_days: null, suggested_days: null });
    await montar();
    expect(await screen.findByText(/O numero de dias de ferias ainda nao esta configurado/)).toBeInTheDocument();
  });

  it('configurar_direito_chama_setLeaveBalance_com_o_ano_e_numero_e_recarrega', async () => {
    await montar();
    await screen.findByText(`Direito (${ANO})`);
    fireEvent.click(screen.getByRole('button', { name: 'Configurar direito' }));
    const dlg = screen.getByRole('dialog');
    expect(dlg).toHaveTextContent(`Direito a ferias — ${ANO}`);
    expect(dlg).toHaveTextContent('Define aqui o numero de dias segundo o contrato/lei aplicavel.');
    const campo = within(dlg).getByRole('spinbutton');
    expect(campo).toHaveValue(22);
    fireEvent.change(campo, { target: { value: '25' } });
    fireEvent.click(within(dlg).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(setLeaveBalance).toHaveBeenCalledWith('s1', { year: ANO, entitled_days: 25 }));
    await waitFor(() => expect(toasts()).toContain('success:Saldo de ferias actualizado'));
    await waitFor(() => expect(getLeaveBalance).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('falha_ao_guardar_o_saldo_mostra_o_toast', async () => {
    setLeaveBalance.mockRejectedValue(new Error('x'));
    await montar();
    await screen.findByText(`Direito (${ANO})`);
    fireEvent.click(screen.getByRole('button', { name: 'Configurar direito' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(toasts()).toContain('error:Erro ao guardar saldo'));
  });

  it('novo_pedido_exige_datas_chama_createLeave_e_avisa', async () => {
    await montar();
    await screen.findByText(`Direito (${ANO})`);
    fireEvent.click(screen.getByRole('button', { name: /Novo pedido/ }));
    const dlg = screen.getByRole('dialog');
    expect(dlg).toHaveTextContent('Novo pedido de ferias');
    const [inicio, fim] = dlg.querySelectorAll('input[type="date"]');
    fireEvent.submit(dlg.querySelector('form'));
    expect(createLeave).not.toHaveBeenCalled(); /* sem datas */
    fireEvent.change(inicio, { target: { value: '2027-01-10' } });
    expect(fim).toHaveAttribute('min', '2027-01-10');
    fireEvent.change(fim, { target: { value: '2027-01-12' } });
    fireEvent.change(within(dlg).getByRole('combobox'), { target: { value: 'sick' } });
    fireEvent.change(dlg.querySelector('textarea'), { target: { value: 'Gripe' } });
    fireEvent.click(within(dlg).getByRole('button', { name: 'Criar pedido' }));
    await waitFor(() => expect(createLeave).toHaveBeenCalledWith('s1', { type: 'sick', start_date: '2027-01-10', end_date: '2027-01-12', notes: 'Gripe' }));
    await waitFor(() => expect(toasts()).toContain('success:Pedido de ferias criado'));
    await waitFor(() => expect(listLeave).toHaveBeenCalledTimes(2));
  });

  it('falha_ao_criar_mostra_o_erro_do_servidor_ou_o_generico', async () => {
    createLeave.mockRejectedValueOnce({ response: { data: { error: 'Datas sobrepostas' } } });
    await montar();
    await screen.findByText(`Direito (${ANO})`);
    fireEvent.click(screen.getByRole('button', { name: /Novo pedido/ }));
    const dlg = screen.getByRole('dialog');
    const [inicio, fim] = dlg.querySelectorAll('input[type="date"]');
    fireEvent.change(inicio, { target: { value: '2027-01-10' } });
    fireEvent.change(fim, { target: { value: '2027-01-12' } });
    fireEvent.click(within(dlg).getByRole('button', { name: 'Criar pedido' }));
    await waitFor(() => expect(toasts()).toContain('error:Datas sobrepostas'));
    createLeave.mockRejectedValueOnce(new Error('x'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Criar pedido' }));
    await waitFor(() => expect(toasts()).toContain('error:Erro ao criar pedido'));
  });

  it('aprovar_e_rejeitar_chamam_updateLeaveStatus_e_avisam_e_falha_mostra_o_toast', async () => {
    await montar();
    await screen.findByText(`Direito (${ANO})`);
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar' }));
    await waitFor(() => expect(updateLeaveStatus).toHaveBeenCalledWith('s1', 'l1', 'approved'));
    await waitFor(() => expect(toasts()).toContain('success:Pedido aprovado'));
    await waitFor(() => expect(listLeave).toHaveBeenCalledTimes(2));
    fireEvent.click(await screen.findByRole('button', { name: 'Rejeitar' }));
    await waitFor(() => expect(updateLeaveStatus).toHaveBeenCalledWith('s1', 'l1', 'rejected'));
    await waitFor(() => expect(toasts()).toContain('success:Pedido rejeitado'));
    updateLeaveStatus.mockRejectedValueOnce(new Error('x'));
    fireEvent.click(await screen.findByRole('button', { name: 'Aprovar' }));
    await waitFor(() => expect(toasts()).toContain('error:Erro ao actualizar pedido'));
  });

  it('falha_ao_carregar_ferias_mostra_o_toast', async () => {
    listLeave.mockRejectedValue(new Error('x'));
    await montar();
    await waitFor(() => expect(toasts()).toContain('error:Erro ao carregar ferias'));
  });

  it('sem_pedidos_mostra_o_vazio', async () => {
    listLeave.mockResolvedValue([]);
    await montar();
    expect(await screen.findByText('Sem pedidos registados.')).toBeInTheDocument();
  });
});

/* ───────────────────────── caracterizacao: Salario ───────────────────────── */

describe('Detalhe do colaborador: Salario', () => {
  it('calcula_custo_total_inps_e_pago_no_ano_com_so_os_pagamentos_do_colaborador', async () => {
    await montar();
    abrir('Salario');
    await screen.findByText('Historico de pagamentos');
    const valor = (rotulo) => screen.getByText(rotulo).nextSibling.textContent;
    expect(valor('Salario base')).toBe(eur2(1000));
    expect(valor('Subsidios')).toBe(eur2(80));
    expect(valor('INPS patronal')).toBe('15%');
    expect(valor('Custo total/mes')).toBe(eur2(1230));
    expect(screen.getByText(`Pago em ${ANO}`).previousSibling.textContent).toBe(eur2(1230));
    expect(screen.getByText(`Contribuicoes INPS estimadas em ${ANO}`).previousSibling.textContent).toBe(eur2(184.5));
    const meses = screen.getAllByText(/^(Jan|Fev|Mar|Abr|Mai|Jun|Jul|Ago|Set|Out|Nov|Dez) \d{4}$/).map(e => e.textContent);
    expect(meses).toEqual([`Mar ${ANO}`, `Dez ${ANO - 1}`]); /* mais recente primeiro; sem o de s2 */
    expect(screen.getByRole('link', { name: /Editar em Financeiro/ })).toHaveAttribute('href', '/financeiro');
    expect(getSalaryConfig).toHaveBeenCalled();
  });

  it('sem_configuracao_mostra_a_instrucao_com_ligacao_e_travessao_no_inps', async () => {
    getSalaryConfig.mockResolvedValue({});
    getSalaryPayments.mockResolvedValue([]);
    await montar();
    abrir('Salario');
    expect(await screen.findByText(/Configuracao salarial ainda nao definida/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Financeiro → Salarios' })).toHaveAttribute('href', '/financeiro');
    expect(screen.getByText(`Contribuicoes INPS estimadas em ${ANO}`).previousSibling.textContent).toBe('—');
    expect(screen.getByText('Sem pagamentos registados.')).toBeInTheDocument();
  });

  it('falha_ao_carregar_o_salario_mostra_o_toast', async () => {
    getSalaryConfig.mockRejectedValue(new Error('x'));
    await montar();
    abrir('Salario');
    await waitFor(() => expect(toasts()).toContain('error:Erro ao carregar salario'));
  });
});

/* ───────────────────────── design system: estrutura, Ferias e Salario ───────────────────────── */

describe('Detalhe do colaborador com o design system (estrutura, Ferias e Salario)', () => {
  it('os_quatro_separadores_sao_tabs_com_aria_selected', async () => {
    await montar();
    expect(screen.getAllByRole('tab')).toHaveLength(4);
    expect(screen.getByRole('tab', { name: 'Ferias' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: 'Salario' }));
    expect(await screen.findByText('Historico de pagamentos')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Salario' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Ferias' })).toHaveAttribute('aria-selected', 'false');
  });

  it('os_campos_dos_modais_de_ferias_tem_nome_acessivel', async () => {
    await montar();
    await screen.findByText(`Direito (${ANO})`);
    fireEvent.click(screen.getByRole('button', { name: /Novo pedido/ }));
    let modal = within(screen.getByRole('dialog'));
    ['Tipo', 'Inicio', 'Fim', 'Notas'].forEach(r => expect(modal.getByLabelText(r)).toBeInTheDocument());
    fireEvent.click(modal.getByRole('button', { name: 'Fechar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Configurar direito' }));
    modal = within(screen.getByRole('dialog'));
    expect(modal.getByLabelText('Dias de ferias por ano')).toBeInTheDocument();
  });

  it('os_vazios_usam_EmptyState', async () => {
    listLeave.mockResolvedValue([]);
    getSalaryPayments.mockResolvedValue([]);
    await montar();
    expect(await screen.findByText('Sem pedidos registados.')).toHaveClass('font-display');
    abrir('Salario');
    expect(await screen.findByText('Sem pagamentos registados.')).toHaveClass('font-display');
  });

  it('o_aviso_e_o_botao_rejeitar_usam_tokens', async () => {
    getLeaveBalance.mockResolvedValue({ entitled_days: null, suggested_days: null });
    await montar();
    const aviso = (await screen.findByText(/O numero de dias de ferias ainda nao esta configurado/));
    expect(aviso.className).toContain('var(--warning-light)');
    expect(screen.getByRole('button', { name: 'Rejeitar' }).className).toContain('var(--error)');
  });

  it('sem_hexadecimais_cores_nomeadas_ou_text_error_em_ferias_e_salario', async () => {
    getLeaveBalance.mockResolvedValue({ entitled_days: null, suggested_days: null });
    const { container } = await montar();
    await screen.findByText(/O numero de dias de ferias ainda nao esta configurado/);
    fireEvent.click(screen.getByRole('button', { name: /Novo pedido/ }));
    let html = container.innerHTML;
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Fechar' }));
    getSalaryConfig.mockResolvedValue({});
    abrir('Salario');
    await screen.findByText(/Configuracao salarial ainda nao definida/);
    html += container.innerHTML;
    expect(html).not.toMatch(HEX);
    expect(html).not.toMatch(NOMEADAS);
    expect(html.replace(/text-error ml-0[.]5/g, '')).not.toMatch(/(?:text|bg|border)-error/);
  });
});
