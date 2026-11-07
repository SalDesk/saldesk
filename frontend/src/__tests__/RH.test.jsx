import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import RH from '../pages/RH';
import useToastStore from '../store/toastStore';
import { getHrOverview, updateLeaveStatus } from '../services/staffService';

/* Sem rede: so o servico da pagina e simulado */
vi.mock('../services/staffService', () => ({
  getHrOverview: vi.fn(),
  updateLeaveStatus: vi.fn(),
}));

const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };

/* datas locais relativas a hoje, com margem de dias (Cabo Verde e UTC-1) */
function dia(deslocamento) {
  const d = new Date();
  d.setDate(d.getDate() + deslocamento);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

const PEDIDOS = [
  { id: 'l1', staff_id: 's1', staff_name: 'Ana Ferreira', type: 'vacation', start_date: '2026-12-01', end_date: '2026-12-05' },
  { id: 'l2', staff_id: 's2', staff_name: 'Rui Lopes', type: 'sick', start_date: '2026-12-10', end_date: '2026-12-10' },
  { id: 'l3', staff_id: 's3', staff_name: 'Carla Dias', type: 'viagem_especial', start_date: '2026-12-20', end_date: '2026-12-21' },
];
const A_EXPIRAR = [
  { kind: 'document', id: 'd1', name: 'Passaporte', staff_name: 'Ana Ferreira', expiry_date: dia(10) },
  { kind: 'certification', id: 'c1', name: 'Carta de Pesados', staff_name: 'Rui Lopes', expiry_date: dia(-10) },
  { kind: 'document', id: 'd2', name: 'Seguro', staff_name: 'Carla Dias', expiry_date: dia(90) },
];
const COLABORADORES = [
  { id: 's1', name: 'Ana Ferreira', role: 'Guia' },
  { id: 's2', name: 'Rui Lopes', role: 'Motorista' },
  { id: 's3', name: 'Carla Dias', role: 'Recepcao' },
  { id: 's4', name: 'bruno', role: 'Instrutor' },
];
const VISAO = { pending_leave: PEDIDOS, expiring: A_EXPIRAR, staff: COLABORADORES };

function Local() {
  const { pathname } = useLocation();
  return <p data-testid="local">{pathname}</p>;
}

describe('RH', () => {
  let errSpy;
  let warnSpy;

  beforeEach(() => {
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    useToastStore.setState({ toasts: [] });
    getHrOverview.mockReset().mockResolvedValue(VISAO);
    updateLeaveStatus.mockReset().mockResolvedValue({});
  });

  afterEach(() => {
    cleanup();
    /* a guarda conta ANTES de restaurar os espioes */
    const erros = errSpy.mock.calls.length;
    const avisos = warnSpy.mock.calls.length;
    vi.restoreAllMocks();
    expect(erros).toBe(0);
    expect(avisos).toBe(0);
  });

  async function abre() {
    const r = render(
      <MemoryRouter future={FUTURE} initialEntries={['/rh']}>
        <Routes>
          <Route path="/rh" element={<RH />} />
          <Route path="*" element={<Local />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByText('Pedidos de ferias pendentes', { selector: 'h3' });
    return r;
  }

  function mensagens() {
    return useToastStore.getState().toasts.map(t => [t.type, t.message]);
  }

  /* o cartao de numeros: o rotulo e o valor vivem no mesmo bloco */
  function cartao(rotulo) {
    return screen.getByText(rotulo, { selector: 'p' }).parentElement;
  }

  it('os_tres_cartoes_contam_pendentes_a_expirar_e_activos', async () => {
    await abre();
    expect(within(cartao('Pedidos de ferias pendentes')).getByText('3')).toBeTruthy();
    expect(within(cartao('Documentos/certificacoes a expirar')).getByText('3')).toBeTruthy();
    expect(within(cartao('Colaboradores activos')).getByText('4')).toBeTruthy();
  });

  it('pedido_mostra_nome_tipo_datas_e_dias', async () => {
    await abre();
    /* daysBetween e inclusivo: 5 dias seguidos = 5, o mesmo dia = 1 */
    const pendentes = screen.getByText('Pedidos de ferias pendentes', { selector: 'h3' }).parentElement;
    const p1 = within(pendentes).getByText('Ana Ferreira').parentElement;
    expect(p1.textContent).toContain('Ferias');
    expect(p1.textContent).toContain('2026-12-01 → 2026-12-05');
    expect(p1.textContent).toContain('(5 dias)');
    const p2 = within(pendentes).getByText('Rui Lopes').parentElement;
    expect(p2.textContent).toContain('Doenca');
    expect(p2.textContent).toContain('(1 dias)');
    /* tipo desconhecido mostra o valor tal e qual */
    const p3 = within(pendentes).getByText('Carla Dias').parentElement;
    expect(p3.textContent).toContain('viagem_especial');
    expect(p3.textContent).toContain('(2 dias)');
  });

  it('aprovar_chama_updateLeaveStatus_com_staff_leave_e_approved_e_avisa_e_recarrega', async () => {
    await abre();
    expect(getHrOverview).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getAllByRole('button', { name: 'Aprovar' })[0]);
    await waitFor(() => expect(updateLeaveStatus).toHaveBeenCalledWith('s1', 'l1', 'approved'));
    await waitFor(() => expect(getHrOverview).toHaveBeenCalledTimes(2));
    expect(mensagens()).toEqual([['success', 'Pedido aprovado']]);
    await screen.findByText('Pedidos de ferias pendentes', { selector: 'h3' });
  });

  it('rejeitar_chama_updateLeaveStatus_com_staff_leave_e_rejected_e_avisa_Pedido rejeitado', async () => {
    await abre();
    fireEvent.click(screen.getAllByRole('button', { name: 'Rejeitar' })[1]);
    await waitFor(() => expect(updateLeaveStatus).toHaveBeenCalledWith('s2', 'l2', 'rejected'));
    await waitFor(() => expect(getHrOverview).toHaveBeenCalledTimes(2));
    expect(mensagens()).toEqual([['success', 'Pedido rejeitado']]);
    await screen.findByText('Pedidos de ferias pendentes', { selector: 'h3' });
  });

  it('falha_ao_actualizar_mostra_Erro ao actualizar pedido', async () => {
    updateLeaveStatus.mockRejectedValue(new Error('x'));
    await abre();
    fireEvent.click(screen.getAllByRole('button', { name: 'Aprovar' })[0]);
    await waitFor(() => expect(mensagens()).toEqual([['error', 'Erro ao actualizar pedido']]));
    /* nao recarrega */
    expect(getHrOverview).toHaveBeenCalledTimes(1);
  });

  it('a_expirar_mostra_documento_e_certificacao_com_o_estado', async () => {
    await abre();
    const passaporte = screen.getByText('Passaporte').closest('div.flex.items-center.justify-between');
    expect(passaporte.textContent).toContain('Ana Ferreira');
    expect(passaporte.textContent).toContain(`${dia(10)} (expira em breve)`);
    const carta = screen.getByText('Carta de Pesados').closest('div.flex.items-center.justify-between');
    expect(carta.textContent).toContain('Rui Lopes');
    expect(carta.textContent).toContain(`${dia(-10)} (expirado)`);
    /* longe do prazo: so a data */
    const seguro = screen.getByText('Seguro').closest('div.flex.items-center.justify-between');
    expect(seguro.textContent).toContain(dia(90));
    expect(seguro.textContent).not.toContain('expir');
  });

  it('sem_pedidos_e_sem_a_expirar_mostram_os_textos_vazios', async () => {
    getHrOverview.mockResolvedValue({ pending_leave: [], expiring: [], staff: COLABORADORES });
    await abre();
    expect(screen.getByText('Sem pedidos pendentes.')).toBeTruthy();
    expect(screen.getByText('Nada a expirar nos proximos 30 dias.')).toBeTruthy();
    expect(within(cartao('Pedidos de ferias pendentes')).getByText('0')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Aprovar' })).toBeNull();
  });

  it('clicar_num_colaborador_navega_para_colaboradores_id', async () => {
    await abre();
    const botao = screen.getByText('Motorista').closest('button');
    /* a inicial e maiuscula */
    expect(within(botao).getByText('R')).toBeTruthy();
    fireEvent.click(botao);
    expect((await screen.findByTestId('local')).textContent).toBe('/colaboradores/s2');
  });

  it('a_inicial_do_colaborador_e_em_maiusculas', async () => {
    await abre();
    const botao = screen.getByText('Instrutor').closest('button');
    expect(within(botao).getByText('B')).toBeTruthy();
  });

  it('falha_ao_carregar_mostra_Erro ao carregar RH e a pagina fica a zeros', async () => {
    getHrOverview.mockRejectedValue(new Error('x'));
    await abre();
    expect(mensagens()).toEqual([['error', 'Erro ao carregar RH']]);
    expect(within(cartao('Pedidos de ferias pendentes')).getByText('0')).toBeTruthy();
    expect(within(cartao('Colaboradores activos')).getByText('0')).toBeTruthy();
    expect(screen.getByText('Sem pedidos pendentes.')).toBeTruthy();
  });

  it('resposta_sem_listas_dada_como_vazia', async () => {
    getHrOverview.mockResolvedValue(null);
    await abre();
    expect(within(cartao('Colaboradores activos')).getByText('0')).toBeTruthy();
  });

  /* ---- design system ---- */
  it('cartao_de_numeros_com_pendentes_usa_o_token_de_aviso', async () => {
    await abre();
    const caixa = cartao('Pedidos de ferias pendentes').previousElementSibling;
    expect(caixa.className).toContain('bg-[var(--warning-light)]');
    expect(caixa.className).toContain('text-[var(--warning)]');
    /* o cartao dos activos nao e de aviso */
    expect(cartao('Colaboradores activos').previousElementSibling.className).not.toContain('--warning');
  });

  it('cartao_sem_pendentes_nao_usa_o_token_de_aviso', async () => {
    getHrOverview.mockResolvedValue({ pending_leave: [], expiring: [], staff: COLABORADORES });
    await abre();
    expect(cartao('Pedidos de ferias pendentes').previousElementSibling.className).not.toContain('--warning');
    expect(cartao('Documentos/certificacoes a expirar').previousElementSibling.className).not.toContain('--warning');
  });

  it('nenhuma_classe_amber_nem_hexadecimal_sobra_na_pagina', async () => {
    /* o ExpiryBadge e partilhado com o portal da equipa e fica como esta: excluem-se os seus avisos */
    const { container } = await abre();
    const html = container.cloneNode(true);
    html.querySelectorAll('span.inline-flex').forEach(n => n.remove());
    expect(html.innerHTML).not.toMatch(/amber-/);
    expect(html.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('sem_itens_a_expirar_nenhuma_classe_amber_na_pagina', async () => {
    getHrOverview.mockResolvedValue({ pending_leave: PEDIDOS, expiring: [], staff: COLABORADORES });
    const { container } = await abre();
    expect(container.innerHTML).not.toMatch(/amber-/);
  });
});
