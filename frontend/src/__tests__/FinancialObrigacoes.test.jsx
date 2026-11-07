import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ObrigacoesTab from '../pages/financial/ObrigacoesTab';
import { getObligations, setObligations } from '../services/expensesService';
import { fmtDate } from './helpers/financeFixtures';

vi.mock('../services/expensesService', () => ({ getObligations: vi.fn(), setObligations: vi.fn() }));

const SEGURO = { name: 'Seguro Frota', renewal_date: '2027-06-01', amount_annual: 400 };
const BASE = { inps_status_current: 'pending', insurances: [SEGURO] };

let spyErr; let spyWarn;
beforeEach(() => {
  spyErr = vi.spyOn(console, 'error').mockImplementation(() => {});
  spyWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  getObligations.mockResolvedValue(BASE);
  setObligations.mockResolvedValue();
});
afterEach(() => {
  /* ler as contagens ANTES de restaurar os espioes */
  const erros = spyErr.mock.calls.map(c => String(c[0]).slice(0, 200));
  const avisos = spyWarn.mock.calls.map(c => String(c[0]).slice(0, 200));
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  expect(erros).toEqual([]);
  expect(avisos).toEqual([]);
});

async function montar() {
  const r = render(<ObrigacoesTab currency="EUR" />);
  await screen.findByText('INPS — Contribuicoes mensais');
  return r;
}
/* so a data e simulada: os temporizadores reais continuam a funcionar */
function relogio(data) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(data);
}
const cartaoSeguros = () => screen.getByText('Seguros', { selector: 'h3' }).parentElement;
const botaoAdicionar = () => { const b = within(cartaoSeguros()).getAllByRole('button'); return b[b.length - 1]; };
const guardado = () => setObligations.mock.calls.at(-1)[0];

/* ───────────────────────── caracterizacao ───────────────────────── */

describe('Obrigacoes', () => {
  it('mostra_o_inps_com_o_dia_15_e_as_contribuicoes', async () => {
    await montar();
    expect(screen.getByText('Dia 15 de cada mes')).toBeInTheDocument();
    expect(screen.getByText('15% dos salarios brutos')).toBeInTheDocument();
    expect(screen.getByText('8% dos salarios brutos')).toBeInTheDocument();
    expect(screen.getByText('IUR — Imposto Unico sobre Rendimentos')).toBeInTheDocument();
    expect(screen.getByText('Subscricao SalDesk')).toBeInTheDocument();
  });

  it('aviso_de_prazo_so_entre_1_e_5_dias_antes_do_dia_15', async () => {
    for (const [dia, esperado] of [[9, null], [10, 'Prazo em 5d'], [12, 'Prazo em 3d'], [14, 'Prazo em 1d'], [15, null], [16, null]]) {
      relogio(new Date(2026, 5, dia, 12, 0, 0));
      await montar();
      if (esperado) expect(screen.getByText(esperado)).toBeInTheDocument();
      else expect(screen.queryByText(/Prazo em/)).toBeNull();
      cleanup();
      vi.useRealTimers();
    }
  });

  it('mudar_o_estado_do_inps_grava_com_setObligations', async () => {
    await montar();
    const estado = screen.getByDisplayValue('Pendente este mes');
    expect(Array.from(estado.options).map(o => o.textContent)).toEqual(['Pendente este mes', 'Pago este mes']);
    fireEvent.change(estado, { target: { value: 'paid' } });
    expect(guardado()).toEqual({ ...BASE, inps_status_current: 'paid' });
    expect(screen.getByDisplayValue('Pago este mes')).toBeInTheDocument();
  });

  it('notas_do_iur_gravam_ao_escrever', async () => {
    await montar();
    const notas = screen.getByPlaceholderText(/Notas sobre IUR/);
    fireEvent.change(notas, { target: { value: 'Contabilista: Ana' } });
    expect(guardado()).toEqual({ ...BASE, iur_notes: 'Contabilista: Ana' });
    expect(notas).toHaveValue('Contabilista: Ana');
  });

  it('adicionar_seguro_exige_nome_grava_com_valor_numerico_e_limpa_os_campos', async () => {
    await montar();
    fireEvent.click(botaoAdicionar());
    expect(setObligations).not.toHaveBeenCalled(); /* sem nome nao faz nada */
    fireEvent.change(screen.getByPlaceholderText('Nome do seguro'), { target: { value: 'Seguro Vida' } });
    fireEvent.change(screen.getByPlaceholderText('€/ano'), { target: { value: '120' } });
    fireEvent.change(cartaoSeguros().querySelector('input[type="date"]'), { target: { value: '2027-01-15' } });
    fireEvent.click(botaoAdicionar());
    expect(guardado()).toEqual({ ...BASE, insurances: [SEGURO, { name: 'Seguro Vida', renewal_date: '2027-01-15', amount_annual: 120 }] });
    expect(screen.getByText('Seguro Vida')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Nome do seguro')).toHaveValue('');
    expect(screen.getByPlaceholderText('€/ano')).toHaveValue(null);
  });

  it('mostra_o_seguro_com_renovacao_e_valor_anual', async () => {
    await montar();
    const caixa = screen.getByText('Seguro Frota').closest('div.flex');
    expect(caixa).toHaveTextContent(`Renovacao: ${fmtDate('2027-06-01')}`);
    expect(caixa).toHaveTextContent('€400/ano');
    expect(caixa).not.toHaveTextContent(/\(\d+d\)/);
  });

  it('seguro_critico_a_30_dias_ou_menos_mostra_os_dias_e_o_aviso', async () => {
    getObligations.mockResolvedValue({ insurances: [
      { name: 'A29', renewal_date: '2026-07-09', amount_annual: 10 },
      { name: 'A30', renewal_date: '2026-07-10', amount_annual: 10 },
      { name: 'A31', renewal_date: '2026-07-11', amount_annual: 10 },
      { name: 'ASem' },
    ] });
    relogio(new Date('2026-06-10T00:00:00Z'));
    await montar();
    expect(screen.getByText('A29').closest('div.flex')).toHaveTextContent('(29d)');
    expect(screen.getByText('A30').closest('div.flex')).toHaveTextContent('(30d)');
    expect(screen.getByText('A31').closest('div.flex')).not.toHaveTextContent(/\(\d+d\)/);
    expect(screen.getByText('ASem').closest('div.flex')).toHaveTextContent('Sem data');
    expect(screen.getByText('ASem').closest('div.flex')).toHaveTextContent('—');
  });

  it('remover_seguro_grava_a_lista_sem_ele', async () => {
    await montar();
    const caixa = screen.getByText('Seguro Frota').closest('div.flex');
    fireEvent.click(within(caixa).getByRole('button'));
    expect(guardado()).toEqual({ ...BASE, insurances: [] });
    expect(screen.getByText('Sem seguros registados.')).toBeInTheDocument();
  });

  it('plano_e_renovacao_gravam', async () => {
    await montar();
    const plano = screen.getByText('Plano actual').parentElement.querySelector('select');
    expect(plano).toHaveValue('starter');
    expect(Array.from(plano.options).map(o => o.textContent)).toEqual(['Starter — €29/mes', 'Pro — €69/mes', 'Business — €79/mes']);
    fireEvent.change(plano, { target: { value: 'pro' } });
    expect(guardado()).toEqual({ ...BASE, saldesk_plan: 'pro' });
    const renovacao = screen.getByText('Data de renovacao').parentElement.querySelector('input');
    fireEvent.change(renovacao, { target: { value: '2027-02-01' } });
    expect(guardado()).toEqual({ ...BASE, saldesk_plan: 'pro', saldesk_renewal: '2027-02-01' });
  });

  it('falha_em_setObligations_nao_rebenta_e_a_pagina_mantem_o_valor', async () => {
    setObligations.mockRejectedValue(new Error('x'));
    await montar();
    fireEvent.change(screen.getByDisplayValue('Pendente este mes'), { target: { value: 'paid' } });
    await waitFor(() => expect(setObligations).toHaveBeenCalled());
    expect(screen.getByDisplayValue('Pago este mes')).toBeInTheDocument();
  });

  it('sem_seguros_mostra_o_texto_e_em_carga_o_spinner', async () => {
    getObligations.mockResolvedValue({});
    await montar();
    expect(screen.getByText('Sem seguros registados.')).toBeInTheDocument();
    cleanup();
    getObligations.mockReturnValue(new Promise(() => {}));
    render(<ObrigacoesTab currency="EUR" />);
    expect(screen.queryByText('INPS — Contribuicoes mensais')).toBeNull();
  });
});

/* ───────────────────────── design system ───────────────────────── */

describe('Obrigacoes com o design system', () => {
  it('os_campos_e_os_botoes_tem_nome_acessivel', async () => {
    await montar();
    ['Estado do INPS', 'Notas sobre IUR', 'Nome do seguro', 'Data de renovacao do seguro', 'Valor anual do seguro', 'Plano actual', 'Data de renovacao']
      .forEach(r => expect(screen.getByLabelText(r)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Adicionar seguro' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remover seguro - Seguro Frota' })).toBeInTheDocument();
  });

  it('o_aviso_de_prazo_e_o_seguro_critico_usam_tokens', async () => {
    getObligations.mockResolvedValue({ insurances: [{ name: 'A29', renewal_date: '2026-07-09' }] });
    relogio(new Date(2026, 5, 12, 12, 0, 0));
    await montar();
    expect(screen.getByText('Prazo em 3d').className).toContain('var(--error-light)');
    expect(screen.getByText('A29').closest('div.flex').className).toContain('var(--warning-light)');
  });

  it('sem_campos_escritos_a_mao_nem_hexadecimais_cores_nomeadas_ou_text_error', async () => {
    getObligations.mockResolvedValue({ insurances: [{ name: 'A29', renewal_date: '2026-07-09' }] });
    relogio(new Date(2026, 5, 12, 12, 0, 0));
    await montar();
    const html = document.body.innerHTML;
    expect(html).not.toMatch(/#[0-9A-Fa-f]{3,8}(?![0-9A-Za-z])/);
    expect(html).not.toMatch(/(?:^|[\s"'])(?:[a-z-]+:)?(?:text|bg|border)-(?:green|yellow|blue|red)-\d/);
    expect(html).not.toMatch(/text-error/);
    expect(html).not.toContain('h-8 px-2'); /* campos escritos a mao */
  });
});
