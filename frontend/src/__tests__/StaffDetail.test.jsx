import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import StaffDetail from '../pages/StaffDetail';
import useToastStore from '../store/toastStore';
import useUiStore from '../store/uiStore';
import en from '../i18n/en.json';
import { portuguesNoEcra, chavesCruas } from './helpers/portuguesNoEcra';
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
    abrir('Salário');
    expect(await screen.findByText('Histórico de pagamentos')).toBeInTheDocument();
    abrir('Documentos');
    expect(await screen.findByText('Contratos e documentos')).toBeInTheDocument();
    abrir('Certificações');
    expect(await screen.findByText('Formação e certificações')).toBeInTheDocument();
    abrir('Férias');
    expect(await screen.findByText('Pedidos')).toBeInTheDocument();
  });
});

describe('Detalhe do colaborador: Férias', () => {
  it('mostra_direito_usados_restantes_e_os_pedidos', async () => {
    await montar();
    expect(await screen.findByText(`Direito (${ANO})`)).toBeInTheDocument();
    expect(getLeaveBalance).toHaveBeenCalledWith('s1', ANO);
    expect(listLeave).toHaveBeenCalledWith('s1');
    expect(screen.getByText('22 dias')).toBeInTheDocument();
    expect(screen.getByText('5 dias')).toBeInTheDocument();
    expect(screen.getByText('17 dias')).toBeInTheDocument();
    expect(linha('2026-12-01 → 2026-12-05')).toHaveTextContent('Férias · 2026-12-01 → 2026-12-05 (5 dias)');
    expect(linha('2026-12-01 → 2026-12-05')).toHaveTextContent('Natal');
    expect(linha('2026-12-01 → 2026-12-05')).toHaveTextContent('Pendente');
    expect(linha('2026-11-02 → 2026-11-02')).toHaveTextContent('Doença');
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
    expect(await screen.findByText(/Sugestão com base na data de admissão.*18 dias/)).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    cleanup();
    getLeaveBalance.mockResolvedValue({ entitled_days: null, suggested_days: null });
    await montar();
    expect(await screen.findByText(/O número de dias de férias ainda não está configurado/)).toBeInTheDocument();
  });

  it('configurar_direito_chama_setLeaveBalance_com_o_ano_e_numero_e_recarrega', async () => {
    await montar();
    await screen.findByText(`Direito (${ANO})`);
    fireEvent.click(screen.getByRole('button', { name: 'Configurar direito' }));
    const dlg = screen.getByRole('dialog');
    expect(dlg).toHaveTextContent(`Direito a férias — ${ANO}`);
    expect(dlg).toHaveTextContent('Define aqui o número de dias segundo o contrato/lei aplicável.');
    const campo = within(dlg).getByRole('spinbutton');
    expect(campo).toHaveValue(22);
    fireEvent.change(campo, { target: { value: '25' } });
    fireEvent.click(within(dlg).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(setLeaveBalance).toHaveBeenCalledWith('s1', { year: ANO, entitled_days: 25 }));
    await waitFor(() => expect(toasts()).toContain('success:Saldo de férias actualizado'));
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
    expect(dlg).toHaveTextContent('Novo pedido de férias');
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
    await waitFor(() => expect(toasts()).toContain('success:Pedido de férias criado'));
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

  it('em_ingles_o_toast_traduz_o_erro_pelo_codigo_e_sem_codigo_mostra_o_texto_do_servidor', async () => {
    act(() => { useUiStore.setState({ lang: 'en' }); });
    try {
      createLeave.mockRejectedValueOnce({ response: { data: { error: 'Datas sobrepostas', code: 'INVALID_DATES' } } });
      await montar();
      /* o ecra ja esta em ingles (fase 4) */
      await screen.findByText(`Entitlement (${ANO})`);
      fireEvent.click(screen.getByRole('button', { name: /New request/ }));
      const dlg = screen.getByRole('dialog');
      const [inicio, fim] = dlg.querySelectorAll('input[type="date"]');
      fireEvent.change(inicio, { target: { value: '2027-01-10' } });
      fireEvent.change(fim, { target: { value: '2027-01-12' } });
      fireEvent.click(within(dlg).getByRole('button', { name: 'Create request' }));
      await waitFor(() => expect(toasts()).toContain(`error:${en.errors.code.INVALID_DATES}`));
      createLeave.mockRejectedValueOnce({ response: { data: { error: 'Datas sobrepostas' } } });
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Create request' }));
      await waitFor(() => expect(toasts()).toContain('error:Datas sobrepostas'));
    } finally {
      act(() => { useUiStore.setState({ lang: 'pt' }); });
    }
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
    await waitFor(() => expect(toasts()).toContain('error:Erro ao carregar férias'));
  });

  it('sem_pedidos_mostra_o_vazio', async () => {
    listLeave.mockResolvedValue([]);
    await montar();
    expect(await screen.findByText('Sem pedidos registados.')).toBeInTheDocument();
  });
});

/* ───────────────────────── caracterizacao: Salario ───────────────────────── */

describe('Detalhe do colaborador: Salário', () => {
  it('calcula_custo_total_inps_e_pago_no_ano_com_so_os_pagamentos_do_colaborador', async () => {
    await montar();
    abrir('Salário');
    await screen.findByText('Histórico de pagamentos');
    const valor = (rotulo) => screen.getByText(rotulo).nextSibling.textContent;
    expect(valor('Salário base')).toBe(eur2(1000));
    expect(valor('Subsídios')).toBe(eur2(80));
    expect(valor('INPS patronal')).toBe('15%');
    expect(valor('Custo total/mês')).toBe(eur2(1230));
    expect(screen.getByText(`Pago em ${ANO}`).closest('article').querySelector('p.font-display').textContent).toBe(eur2(1230));
    expect(screen.getByText(`Contribuições INPS estimadas em ${ANO}`).closest('article').querySelector('p.font-display').textContent).toBe(eur2(184.5));
    const meses = screen.getAllByText(/^(Jan|Fev|Mar|Abr|Mai|Jun|Jul|Ago|Set|Out|Nov|Dez) \d{4}$/).map(e => e.textContent);
    expect(meses).toEqual([`Mar ${ANO}`, `Dez ${ANO - 1}`]); /* mais recente primeiro; sem o de s2 */
    expect(screen.getByRole('link', { name: /Editar em Financeiro/ })).toHaveAttribute('href', '/financeiro');
    expect(getSalaryConfig).toHaveBeenCalled();
  });

  it('sem_configuracao_mostra_a_instrucao_com_ligacao_e_travessao_no_inps', async () => {
    getSalaryConfig.mockResolvedValue({});
    getSalaryPayments.mockResolvedValue([]);
    await montar();
    abrir('Salário');
    expect(await screen.findByText(/Configuração salarial ainda não definida/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Financeiro → Salários' })).toHaveAttribute('href', '/financeiro');
    expect(screen.getByText(`Contribuições INPS estimadas em ${ANO}`).closest('article').querySelector('p.font-display').textContent).toBe('—');
    expect(screen.getByText('Sem pagamentos registados.')).toBeInTheDocument();
  });

  it('falha_ao_carregar_o_salario_mostra_o_toast', async () => {
    getSalaryConfig.mockRejectedValue(new Error('x'));
    await montar();
    abrir('Salário');
    await waitFor(() => expect(toasts()).toContain('error:Erro ao carregar salário'));
  });
});

/* ───────────────────────── design system: estrutura, Ferias e Salario ───────────────────────── */

describe('Detalhe do colaborador com o design system (estrutura, Férias e Salário)', () => {
  it('os_quatro_separadores_sao_tabs_com_aria_selected', async () => {
    await montar();
    expect(screen.getAllByRole('tab')).toHaveLength(4);
    expect(screen.getByRole('tab', { name: 'Férias' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: 'Salário' }));
    expect(await screen.findByText('Histórico de pagamentos')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Salário' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Férias' })).toHaveAttribute('aria-selected', 'false');
  });

  it('os_campos_dos_modais_de_ferias_tem_nome_acessivel', async () => {
    await montar();
    await screen.findByText(`Direito (${ANO})`);
    fireEvent.click(screen.getByRole('button', { name: /Novo pedido/ }));
    let modal = within(screen.getByRole('dialog'));
    ['Tipo', 'Início', 'Fim', 'Notas'].forEach(r => expect(modal.getByLabelText(r)).toBeInTheDocument());
    fireEvent.click(modal.getByRole('button', { name: 'Fechar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Configurar direito' }));
    modal = within(screen.getByRole('dialog'));
    expect(modal.getByLabelText('Dias de férias por ano')).toBeInTheDocument();
  });

  it('os_vazios_usam_EmptyState', async () => {
    listLeave.mockResolvedValue([]);
    getSalaryPayments.mockResolvedValue([]);
    await montar();
    expect(await screen.findByText('Sem pedidos registados.')).toHaveClass('font-display');
    abrir('Salário');
    expect(await screen.findByText('Sem pagamentos registados.')).toHaveClass('font-display');
  });

  it('o_aviso_e_o_botao_rejeitar_usam_tokens', async () => {
    getLeaveBalance.mockResolvedValue({ entitled_days: null, suggested_days: null });
    await montar();
    const aviso = (await screen.findByText(/O número de dias de férias ainda não está configurado/));
    expect(aviso.className).toContain('var(--warning-light)');
    expect(screen.getByRole('button', { name: 'Rejeitar' }).className).toContain('var(--error)');
  });

  it('sem_hexadecimais_cores_nomeadas_ou_text_error_em_ferias_e_salario', async () => {
    getLeaveBalance.mockResolvedValue({ entitled_days: null, suggested_days: null });
    const { container } = await montar();
    await screen.findByText(/O número de dias de férias ainda não está configurado/);
    fireEvent.click(screen.getByRole('button', { name: /Novo pedido/ }));
    let html = container.innerHTML;
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Fechar' }));
    getSalaryConfig.mockResolvedValue({});
    abrir('Salário');
    await screen.findByText(/Configuração salarial ainda não definida/);
    html += container.innerHTML;
    expect(html).not.toMatch(HEX);
    expect(html).not.toMatch(NOMEADAS);
    expect(html.replace(/hover:text-error/g, '').replace(/text-error ml-0[.]5/g, '')).not.toMatch(/(?:text|bg|border)-error/);
  });
});

/* ───────────────────────── Tarefa 8: Documentos e Certificacoes ───────────────────────── */

const DOCS = [
  { id: 'd1', name: 'Contrato 2026', file_url: 'http://x.test/c.pdf', expiry_date: dia(10) },
  { id: 'd2', name: 'Bilhete de identidade', file_url: 'http://x.test/bi.pdf', expiry_date: dia(-10) },
  { id: 'd3', name: 'Seguro', file_url: 'http://x.test/s.pdf', expiry_date: dia(200) },
  { id: 'd4', name: 'Sem data', file_url: 'http://x.test/n.pdf', expiry_date: null },
];
const CERTS = [
  { id: 'c1', name: 'PADI Open Water', issuer: 'PADI', expiry_date: dia(-3) },
  { id: 'c2', name: 'Primeiros socorros', issuer: null, expiry_date: null },
];
const ficheiro = () => new File(['x'], 'contrato.pdf', { type: 'application/pdf' });
const campoFicheiro = () => document.querySelector('input[type="file"]');
const botaoAdicionar = () => screen.getByRole('button', { name: /Adicionar/ });
const linhaDe = (texto) => screen.getByText(texto, { exact: false }).closest('div.justify-between');

describe('Detalhe do colaborador: Documentos', () => {
  beforeEach(() => {
    listDocuments.mockResolvedValue(DOCS);
    createDocument.mockReset().mockResolvedValue({});
    deleteDocument.mockReset().mockResolvedValue({});
    validateDocumentFile.mockReset().mockReturnValue(null);
    uploadDocument.mockReset().mockResolvedValue({ url: 'http://up/x.pdf' });
  });
  const abrirDocumentos = async () => { await montar(); abrir('Documentos'); await screen.findByText('Contrato 2026'); };

  it('lista_com_ligacao_e_validade', async () => {
    await abrirDocumentos();
    expect(listDocuments).toHaveBeenCalledWith('s1');
    expect(screen.getByRole('link', { name: 'Contrato 2026' })).toHaveAttribute('href', 'http://x.test/c.pdf');
    expect(screen.getByRole('link', { name: 'Contrato 2026' })).toHaveAttribute('target', '_blank');
    expect(linhaDe('Contrato 2026')).toHaveTextContent(`${dia(10)} (expira em breve)`);
    expect(linhaDe('Bilhete de identidade')).toHaveTextContent(`${dia(-10)} (expirado)`);
    expect(linhaDe('Seguro')).toHaveTextContent(dia(200));
    expect(linhaDe('Seguro')).not.toHaveTextContent('(');
    expect(linhaDe('Sem data')).not.toHaveTextContent(/\d{4}-/);
  });

  it('novo_documento_exige_nome_e_ficheiro_senao_toast', async () => {
    await abrirDocumentos();
    fireEvent.click(botaoAdicionar());
    const dlg = screen.getByRole('dialog');
    expect(dlg).toHaveTextContent('Novo documento');
    fireEvent.submit(dlg.querySelector('form'));
    expect(toasts()).toContain('error:Carrega um ficheiro e dá um nome ao documento');
    expect(createDocument).not.toHaveBeenCalled();
    expect(Array.from(within(dlg).getByRole('combobox').options).map(o => o.textContent)).toEqual(['Contrato', 'Documento de identificação', 'Outro']);
  });

  it('carregar_ficheiro_valida_chama_uploadDocument_e_preenche_o_nome_e_guardar_cria', async () => {
    await abrirDocumentos();
    fireEvent.click(botaoAdicionar());
    fireEvent.change(campoFicheiro(), { target: { files: [ficheiro()] } });
    expect(await screen.findByText('Ficheiro carregado.')).toBeInTheDocument();
    expect(validateDocumentFile).toHaveBeenCalled();
    expect(uploadDocument).toHaveBeenCalledTimes(1);
    const dlg = screen.getByRole('dialog');
    expect(within(dlg).getByPlaceholderText('Ex: Contrato de trabalho 2026')).toHaveValue('contrato.pdf');
    fireEvent.change(within(dlg).getByRole('combobox'), { target: { value: 'other' } });
    fireEvent.change(dlg.querySelector('input[type="date"]'), { target: { value: '2027-05-01' } });
    fireEvent.click(within(dlg).getByRole('button', { name: 'Guardar documento' }));
    await waitFor(() => expect(createDocument).toHaveBeenCalledWith('s1', { type: 'other', name: 'contrato.pdf', file_url: 'http://up/x.pdf', expiry_date: '2027-05-01' }));
    await waitFor(() => expect(toasts()).toContain('success:Documento guardado'));
    await waitFor(() => expect(listDocuments).toHaveBeenCalledTimes(2));
  });

  it('ficheiro_invalido_ou_upload_a_falhar_mostram_o_toast', async () => {
    await abrirDocumentos();
    fireEvent.click(botaoAdicionar());
    validateDocumentFile.mockReturnValueOnce('Ficheiro demasiado grande');
    fireEvent.change(campoFicheiro(), { target: { files: [ficheiro()] } });
    await waitFor(() => expect(toasts()).toContain('error:Ficheiro demasiado grande'));
    expect(uploadDocument).not.toHaveBeenCalled();
    uploadDocument.mockRejectedValueOnce(new Error('x'));
    fireEvent.change(campoFicheiro(), { target: { files: [ficheiro()] } });
    await waitFor(() => expect(toasts()).toContain('error:Erro ao carregar ficheiro'));
  });

  it('falha_ao_guardar_e_ao_eliminar_e_ao_carregar_mostram_os_toasts', async () => {
    createDocument.mockRejectedValue(new Error('x'));
    deleteDocument.mockRejectedValue(new Error('x'));
    await abrirDocumentos();
    fireEvent.click(botaoAdicionar());
    fireEvent.change(campoFicheiro(), { target: { files: [ficheiro()] } });
    await screen.findByText('Ficheiro carregado.');
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Guardar documento' }));
    await waitFor(() => expect(toasts()).toContain('error:Erro ao guardar documento'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Fechar' }));
    fireEvent.click(within(linhaDe('Contrato 2026')).getByRole('button'));
    await waitFor(() => expect(toasts()).toContain('error:Erro ao eliminar'));
    cleanup();
    listDocuments.mockRejectedValue(new Error('x'));
    await montar();
    abrir('Documentos');
    await waitFor(() => expect(toasts()).toContain('error:Erro ao carregar documentos'));
  });

  it('eliminar_chama_deleteDocument_e_avisa', async () => {
    await abrirDocumentos();
    fireEvent.click(within(linhaDe('Contrato 2026')).getByRole('button'));
    await waitFor(() => expect(deleteDocument).toHaveBeenCalledWith('s1', 'd1'));
    await waitFor(() => expect(toasts()).toContain('success:Documento eliminado'));
  });

  it('sem_documentos_mostra_o_vazio', async () => {
    listDocuments.mockResolvedValue([]);
    await montar();
    abrir('Documentos');
    expect(await screen.findByText('Sem documentos guardados.')).toBeInTheDocument();
  });
});

describe('Detalhe do colaborador: Certificações', () => {
  beforeEach(() => {
    listCertifications.mockResolvedValue(CERTS);
    createCertification.mockReset().mockResolvedValue({});
    deleteCertification.mockReset().mockResolvedValue({});
    validateDocumentFile.mockReset().mockReturnValue(null);
    uploadDocument.mockReset().mockResolvedValue({ url: 'http://up/cert.pdf' });
  });
  const abrirCerts = async () => { await montar(); abrir('Certificações'); await screen.findByText(/PADI Open Water/); };

  it('lista_nome_emissor_e_validade', async () => {
    await abrirCerts();
    expect(listCertifications).toHaveBeenCalledWith('s1');
    expect(linhaDe('PADI Open Water')).toHaveTextContent('PADI Open Water · PADI');
    expect(linhaDe('PADI Open Water')).toHaveTextContent(`${dia(-3)} (expirado)`);
    expect(linhaDe('Primeiros socorros')).not.toHaveTextContent('·');
  });

  it('nova_certificacao_exige_nome_e_chama_createCertification', async () => {
    await abrirCerts();
    fireEvent.click(botaoAdicionar());
    const dlg = screen.getByRole('dialog');
    expect(dlg).toHaveTextContent('Nova certificação');
    fireEvent.submit(dlg.querySelector('form'));
    expect(toasts()).toContain('error:Dá um nome à certificação');
    expect(createCertification).not.toHaveBeenCalled();
    fireEvent.change(within(dlg).getByPlaceholderText('Ex: PADI Open Water'), { target: { value: 'CPR' } });
    fireEvent.change(within(dlg).getByPlaceholderText('Ex: PADI'), { target: { value: 'Cruz Vermelha' } });
    const [emissao, validade] = dlg.querySelectorAll('input[type="date"]');
    fireEvent.change(emissao, { target: { value: '2026-01-10' } });
    fireEvent.change(validade, { target: { value: '2028-01-10' } });
    fireEvent.change(campoFicheiro(), { target: { files: [ficheiro()] } });
    expect(await screen.findByText('Certificado carregado.')).toBeInTheDocument();
    fireEvent.click(within(dlg).getByRole('button', { name: 'Guardar certificação' }));
    await waitFor(() => expect(createCertification).toHaveBeenCalledWith('s1', { name: 'CPR', issuer: 'Cruz Vermelha', issued_date: '2026-01-10', expiry_date: '2028-01-10', file_url: 'http://up/cert.pdf' }));
    await waitFor(() => expect(toasts()).toContain('success:Certificação guardada'));
    await waitFor(() => expect(listCertifications).toHaveBeenCalledTimes(2));
  });

  it('eliminar_chama_deleteCertification_e_falhas_mostram_os_toasts', async () => {
    await abrirCerts();
    fireEvent.click(within(linhaDe('PADI Open Water')).getByRole('button'));
    await waitFor(() => expect(deleteCertification).toHaveBeenCalledWith('s1', 'c1'));
    await waitFor(() => expect(toasts()).toContain('success:Certificação eliminada'));
    deleteCertification.mockRejectedValueOnce(new Error('x'));
    fireEvent.click(within(linhaDe('Primeiros socorros')).getByRole('button'));
    await waitFor(() => expect(toasts()).toContain('error:Erro ao eliminar'));
    createCertification.mockRejectedValue(new Error('x'));
    fireEvent.click(botaoAdicionar());
    fireEvent.change(screen.getByPlaceholderText('Ex: PADI Open Water'), { target: { value: 'X' } });
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Guardar certificação' }));
    await waitFor(() => expect(toasts()).toContain('error:Erro ao guardar certificação'));
    cleanup();
    listCertifications.mockRejectedValue(new Error('x'));
    await montar();
    abrir('Certificações');
    await waitFor(() => expect(toasts()).toContain('error:Erro ao carregar certificações'));
  });

  it('sem_certificacoes_mostra_o_vazio', async () => {
    listCertifications.mockResolvedValue([]);
    await montar();
    abrir('Certificações');
    expect(await screen.findByText('Sem certificações registadas.')).toBeInTheDocument();
  });
});

describe('Detalhe do colaborador com o design system (Documentos e Certificações)', () => {
  beforeEach(() => {
    listDocuments.mockResolvedValue(DOCS);
    listCertifications.mockResolvedValue(CERTS);
  });

  it('os_vazios_usam_EmptyState', async () => {
    listDocuments.mockResolvedValue([]);
    listCertifications.mockResolvedValue([]);
    await montar();
    abrir('Documentos');
    expect(await screen.findByText('Sem documentos guardados.')).toHaveClass('font-display');
    abrir('Certificações');
    expect(await screen.findByText('Sem certificações registadas.')).toHaveClass('font-display');
  });

  it('os_botoes_eliminar_e_os_campos_dos_modais_tem_nome_acessivel', async () => {
    await montar();
    abrir('Documentos');
    await screen.findByText('Contrato 2026');
    expect(screen.getByRole('button', { name: 'Eliminar documento - Contrato 2026' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Eliminar documento - / })).toHaveLength(4);
    fireEvent.click(botaoAdicionar());
    let modal = within(screen.getByRole('dialog'));
    ['Tipo', 'Nome', 'Data de validade (opcional)'].forEach(r => expect(modal.getByLabelText(r)).toBeInTheDocument());
    fireEvent.click(modal.getByRole('button', { name: 'Fechar' }));
    abrir('Certificações');
    await screen.findByText(/PADI Open Water/);
    expect(screen.getByRole('button', { name: 'Eliminar certificação - PADI Open Water' })).toBeInTheDocument();
    fireEvent.click(botaoAdicionar());
    modal = within(screen.getByRole('dialog'));
    ['Nome', 'Emitido por', 'Data de emissão', 'Validade (opcional)'].forEach(r => expect(modal.getByLabelText(r)).toBeInTheDocument());
  });

  it('sem_hexadecimais_cores_nomeadas_ou_text_error_com_o_modal_aberto', async () => {
    const { container } = await montar();
    abrir('Documentos');
    await screen.findByText('Contrato 2026');
    fireEvent.click(botaoAdicionar());
    let html = container.innerHTML;
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Fechar' }));
    abrir('Certificações');
    await screen.findByText(/PADI Open Water/);
    fireEvent.click(botaoAdicionar());
    html += container.innerHTML;
    /* o ExpiryBadge (partilhado com o portal da equipa) mantem text-error e amber: ver decisao 7e do plano */
    const semBadge = html.replace(/<span class="inline-flex items-center gap-1 text-xs font-body font-semibold [^"]*">/g, '<span>');
    expect(semBadge).not.toMatch(HEX);
    expect(semBadge).not.toMatch(NOMEADAS);
    expect(semBadge.replace(/hover:text-error/g, '').replace(/text-error ml-0[.]5/g, '')).not.toMatch(/(?:text|bg|border)-error/);
  });
});

/* ───────────────────────── Painel em ingles ───────────────────────── */

describe('Detalhe do colaborador em inglês', () => {
  /* dados dos testes que ficam como estao em qualquer lingua */
  const DADOS = ['Rui Lopes', 'Natal', 'xyz', 'Contrato 2026', 'Bilhete de identidade', 'Seguro', 'Sem data', 'PADI', 'Primeiros socorros'];
  beforeEach(() => {
    useUiStore.setState({ lang: 'en' });
    listDocuments.mockResolvedValue(DOCS);
    listCertifications.mockResolvedValue(CERTS);
  });
  afterEach(() => { cleanup(); useUiStore.setState({ lang: 'pt' }); });

  it('separadores_cargo_e_ferias_em_ingles_sem_portugues', async () => {
    await montar();
    expect(screen.getByText('Guide')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Staff/ })).toBeInTheDocument();
    ['Leave', 'Salary', 'Documents', 'Certifications'].forEach(r => expect(screen.getByRole('tab', { name: r })).toBeInTheDocument());
    expect(await screen.findByText(`Entitlement (${ANO})`)).toBeInTheDocument();
    expect(screen.getByText('22 days')).toBeInTheDocument();
    expect(screen.getByText('5 days')).toBeInTheDocument();
    expect(screen.getByText('Used')).toBeInTheDocument();
    expect(screen.getByText('Remaining')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set entitlement' })).toBeInTheDocument();
    expect(linha('2026-12-01 → 2026-12-05')).toHaveTextContent('Annual leave · 2026-12-01 → 2026-12-05 (5 day(s))');
    expect(linha('2026-12-01 → 2026-12-05')).toHaveTextContent('Pending');
    expect(linha('2026-11-02 → 2026-11-02')).toHaveTextContent('Sick leave');
    expect(linha('2026-11-02 → 2026-11-02')).toHaveTextContent('Approved');
    expect(linha('2026-10-01 → 2026-10-03')).toHaveTextContent('Rejected');
    expect(screen.getAllByRole('button', { name: 'Approve' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Reject' })).toHaveLength(1);
    expect(portuguesNoEcra(DADOS)).toEqual([]);
    expect(chavesCruas(['staffDetail', 'hr', 'staff', 'common'])).toEqual([]);
  });

  it('novo_pedido_em_ingles_grava_o_tipo_sick', async () => {
    await montar();
    await screen.findByText(`Entitlement (${ANO})`);
    fireEvent.click(screen.getByRole('button', { name: 'New request' }));
    const dlg = screen.getByRole('dialog');
    expect(dlg).toHaveTextContent('New leave request');
    const tipo = within(dlg).getByLabelText('Type');
    const opcao = within(tipo).getByRole('option', { name: 'Sick leave' });
    expect(opcao.value).toBe('sick');
    fireEvent.change(tipo, { target: { value: opcao.value } });
    fireEvent.change(within(dlg).getByLabelText('Start'), { target: { value: '2026-12-10' } });
    fireEvent.change(within(dlg).getByLabelText('End'), { target: { value: '2026-12-11' } });
    expect(portuguesNoEcra(DADOS, dlg)).toEqual([]);
    fireEvent.click(within(dlg).getByRole('button', { name: 'Create request' }));
    await waitFor(() => expect(createLeave).toHaveBeenCalledWith('s1', expect.objectContaining({ type: 'sick', start_date: '2026-12-10' })));
    await waitFor(() => expect(toasts()).toContain('success:Leave request created'));
  });

  it('documentos_certificacoes_e_salario_em_ingles', async () => {
    await montar();
    abrir('Documents');
    expect(await screen.findByText('Contracts and documents')).toBeInTheDocument();
    expect(linhaDe('Contrato 2026')).toHaveTextContent(`${dia(10)} (expires soon)`);
    expect(linhaDe('Bilhete de identidade')).toHaveTextContent(`${dia(-10)} (expired)`);
    expect(screen.getByRole('button', { name: 'Delete document - Contrato 2026' })).toBeInTheDocument();
    expect(portuguesNoEcra(DADOS)).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: /Add/ }));
    let dlg = screen.getByRole('dialog');
    expect(dlg).toHaveTextContent('New document');
    expect(within(within(dlg).getByLabelText('Type')).getByRole('option', { name: 'ID document' }).value).toBe('id_document');
    ['Name', 'Expiry date (optional)'].forEach(r => expect(within(dlg).getByLabelText(r)).toBeInTheDocument());
    expect(within(dlg).getByRole('button', { name: 'Upload file' })).toBeInTheDocument();
    expect(portuguesNoEcra(DADOS, dlg)).toEqual([]);
    fireEvent.click(within(dlg).getByRole('button', { name: 'Close' }));
    abrir('Certifications');
    expect(await screen.findByText('Training and certifications')).toBeInTheDocument();
    expect(portuguesNoEcra(DADOS)).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: /Add/ }));
    dlg = screen.getByRole('dialog');
    ['Name', 'Issued by', 'Issue date', 'Expiry (optional)'].forEach(r => expect(within(dlg).getByLabelText(r)).toBeInTheDocument());
    expect(portuguesNoEcra(DADOS, dlg)).toEqual([]);
    fireEvent.click(within(dlg).getByRole('button', { name: 'Close' }));
    abrir('Salary');
    expect(await screen.findByText('Payment history')).toBeInTheDocument();
    expect(screen.getByText('Base salary')).toBeInTheDocument();
    expect(screen.getByText('Employer INPS')).toBeInTheDocument();
    expect(screen.getByText(`Mar ${ANO}`)).toBeInTheDocument();
    expect(screen.getByText(`Paid in ${ANO}`)).toBeInTheDocument();
    expect(portuguesNoEcra(DADOS)).toEqual([]);
    expect(chavesCruas(['staffDetail', 'hr', 'staff', 'common'])).toEqual([]);
  });

  it('a_falha_ao_carregar_avisa_em_ingles', async () => {
    listLeave.mockRejectedValue(new Error('x'));
    await montar();
    await waitFor(() => expect(toasts()).toContain('error:Could not load leave'));
  });
});

/* ───────────────────────── estilo Mare ───────────────────────── */

const MARE_CARTAO = ['rounded-[18px]', 'border-mare-card'];
const MARE_CAIXA = ['rounded-[14px]', 'border-mare-card'];

describe('Detalhe do colaborador no estilo Mare', () => {
  it('mostra_o_sobretitulo_da_area_Gestao', async () => {
    await montar();
    expect(document.querySelector('[data-eyebrow]').textContent).toBe('Gestão');
  });

  it('ferias_o_saldo_e_um_cartao_Mare_com_numeros_em_mono_e_os_pedidos_sao_caixas', async () => {
    await montar();
    const rotulo = await screen.findByText(`Direito (${ANO})`);
    const saldo = rotulo.closest('section');
    MARE_CARTAO.forEach(c => expect(saldo.className).toContain(c));
    expect(saldo.className).toContain('bg-white');
    expect(rotulo.nextSibling.className).toContain('font-mono');
    expect(rotulo.nextSibling.className).toContain('tabular-nums');
    const pedido = screen.getByText('Natal').closest('div.justify-between').parentElement;
    MARE_CAIXA.forEach(c => expect(pedido.className).toContain(c));
    expect(screen.getByText(/2026-12-01/).className).toContain('font-mono');
  });

  it('ferias_aprovar_e_rejeitar_sao_botoes_de_icone_de_44px_no_telemovel', async () => {
    await montar();
    await screen.findByText('Natal');
    ['Aprovar', 'Rejeitar'].forEach(n => expect(screen.getByRole('button', { name: n }).className).toContain('min-h-11'));
  });

  it('salario_o_resumo_e_um_cartao_e_pago_e_inps_sao_quadros_de_numero', async () => {
    await montar();
    abrir('Salário');
    await screen.findByText('Histórico de pagamentos');
    const resumo = screen.getByText('Salário base').closest('section');
    MARE_CARTAO.forEach(c => expect(resumo.className).toContain(c));
    expect(screen.getByText('Salário base').nextSibling.className).toContain('font-mono');
    const pago = screen.getByText(`Pago em ${ANO}`).closest('article');
    expect(pago.querySelector('p.font-display').textContent).toBe(eur2(1230));
    const inps = screen.getByText(`Contribuições INPS estimadas em ${ANO}`).closest('article');
    expect(inps.querySelector('p.font-display').textContent).toBe(eur2(184.5));
    const mes = screen.getByText(`Mar ${ANO}`);
    expect(mes.parentElement.parentElement.className).toContain('rounded-[14px]');
    expect(mes.nextSibling.className).toContain('font-mono');
  });

  it('documentos_e_certificacoes_listam_em_caixas_Mare_com_botao_de_eliminar_de_44px', async () => {
    listDocuments.mockResolvedValue([{ id: 'd1', name: 'Contrato 2026', file_url: 'http://x.test/c.pdf', expiry_date: null }]);
    listCertifications.mockResolvedValue([{ id: 'c1', name: 'PADI Open Water', issuer: 'PADI', expiry_date: null }]);
    await montar();
    abrir('Documentos');
    const doc = (await screen.findByRole('link', { name: 'Contrato 2026' })).closest('div.justify-between').parentElement;
    MARE_CAIXA.forEach(c => expect(doc.className).toContain(c));
    expect(screen.getByRole('button', { name: /Eliminar/ }).className).toContain('min-h-11');
    abrir('Certificações');
    const cert = (await screen.findByText(/PADI Open Water/)).closest('div.justify-between').parentElement;
    MARE_CAIXA.forEach(c => expect(cert.className).toContain(c));
  });
});
