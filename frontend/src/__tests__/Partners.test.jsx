import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Partners from '../pages/Partners';
import useAuthStore from '../store/authStore';
import {
  listPartners, createPartner, updatePartner, deletePartner, registerPartnerBooking,
  searchOperators, requestPartnership, respondPartnership,
} from '../services/partnersService';

vi.mock('../services/partnersService', () => ({
  listPartners: vi.fn(), createPartner: vi.fn(), updatePartner: vi.fn(), deletePartner: vi.fn(),
  registerPartnerBooking: vi.fn(), searchOperators: vi.fn(), requestPartnership: vi.fn(), respondPartnership: vi.fn(),
}));

const HEX = /#[0-9A-Fa-f]{3,8}(?![0-9A-Za-z])/;
const NOMEADAS = /(?:^|[\s"'])(?:[a-z-]+:)?(?:text|bg|border|fill|ring)-(?:green|yellow|blue|red|amber)-\d/;
const norm = (t) => t.replace(/\s/g, ' ');

const P1 = { id: 'p1', name: 'Hotel Morabeza', partner_type: 'hotel', partnership_type: 'commission', commission_pct: 10, avg_booking_value: 80, bookings_sent: 3, bookings_received: 2, message_pt: 'Recomendamos o Morabeza', active: true, status: 'accepted', partner_operator_id: 'op2' };
const P2 = { id: 'p2', name: 'Rent Sal', partner_type: 'rentacar', partnership_type: 'recommendation', active: false, status: 'accepted', bookings_sent: 1 };
const P3 = { id: 'p3', name: 'Restaurante Recusado', partner_type: 'restaurant', partnership_type: 'discount', active: true, status: 'rejected', bookings_sent: 4, bookings_received: 1 };
const P4 = { id: 'p4', name: 'Tours Sal', partner_type: 'activity', partnership_type: 'recommendation', commission_pct: 5, status: 'pending', requested_by_operator_id: 'op2' };
const P5 = { id: 'p5', name: 'Surf CV', partner_type: 'activity', status: 'pending', requested_by_operator_id: 'op1' };
const P6 = { id: 'p6', name: 'Dive CV', partner_type: 'activity', partnership_type: 'commission', commission_pct: 12, status: 'pending', requested_by_operator_id: 'op3' };
const PARCEIROS = [P1, P2, P3, P4, P5, P6];

let spyErr; let spyWarn; let spyConfirm;
beforeEach(() => {
  spyErr = vi.spyOn(console, 'error').mockImplementation(() => {});
  spyWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  spyConfirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
  useAuthStore.setState({ token: 'tok', operator: { id: 'op1' } });
  listPartners.mockReset().mockResolvedValue(PARCEIROS);
  [createPartner, updatePartner, deletePartner, registerPartnerBooking, searchOperators, requestPartnership, respondPartnership].forEach(f => f.mockReset());
});
afterEach(() => {
  /* ler as contagens ANTES de restaurar os espioes */
  const erros = spyErr.mock.calls.map(c => String(c[0]).slice(0, 200));
  const avisos = spyWarn.mock.calls.map(c => String(c[0]).slice(0, 200));
  cleanup();
  vi.restoreAllMocks();
  useAuthStore.setState({ token: null, operator: null });
  expect(erros).toEqual([]);
  expect(avisos).toEqual([]);
});

async function montar(primeiro = 'Hotel Morabeza') {
  const r = render(<Partners />);
  await screen.findByText(primeiro);
  return r;
}
/* linha/cartao: o primeiro ascendente do nome que contem botoes (a linha com as acoes) */
const cartao = (nome) => {
  let e = screen.getByText(nome);
  while (e && !e.querySelector('button')) e = e.parentElement;
  return e;
};
const botoes = (nome) => within(cartao(nome)).getAllByRole('button');
const separador = (rotulo) => screen.getAllByText(rotulo).find(e => e.closest('button')).closest('button');
const tabPedidos = () => screen.getByText(/^Pedidos/).closest('button');
const metrica = (rotulo) => screen.getByText(rotulo).previousSibling.textContent;

/* ───────────────────────── caracterizacao: lista, pedidos e dashboard ───────────────────────── */

describe('Parcerias: lista', () => {
  it('lista_parceiros_com_tipo_parceria_comissao_reservas_e_mensagem', async () => {
    await montar();
    expect(screen.getByText('Parcerias Cross-Selling')).toBeInTheDocument();
    const c = cartao('Hotel Morabeza');
    expect(c).toHaveTextContent('Hotel / Alojamento · Comissao por reserva referenciada');
    expect(c).toHaveTextContent('10% comissao · reserva media €80');
    expect(c).toHaveTextContent('3enviadas');
    expect(c).toHaveTextContent('2recebidas');
    expect(c).toHaveTextContent('Recomendamos o Morabeza');
    expect(cartao('Rent Sal')).toHaveTextContent('Rent-a-Car · Recomendacao mutua (sem comissao)');
    expect(cartao('Rent Sal')).not.toHaveTextContent('comissao ·');
    expect(cartao('Rent Sal')).toHaveTextContent('1enviadas');
    expect(cartao('Rent Sal')).toHaveTextContent('0recebidas');
    expect(screen.queryByText('Tours Sal')).not.toBeInTheDocument();
  });

  it('tipo_desconhecido_cai_no_primeiro_e_comissao_sem_valor_medio_omite_a_reserva_media', async () => {
    listPartners.mockResolvedValue([{ id: 'x', name: 'Sem Tipo', status: 'accepted', active: true, commission_pct: 7 }]);
    await montar('Sem Tipo');
    const c = cartao('Sem Tipo');
    expect(c).toHaveTextContent('Hotel / Alojamento · Recomendacao mutua (sem comissao)');
    expect(c).toHaveTextContent('7% comissao');
    expect(c).not.toHaveTextContent('reserva media');
  });

  it('parceiro_real_leva_o_selo_SalDesk_e_recusado_o_selo_Recusado_e_fica_esbatido', async () => {
    await montar();
    expect(within(cartao('Hotel Morabeza')).getByText('SalDesk')).toBeInTheDocument();
    expect(within(cartao('Rent Sal')).queryByText('SalDesk')).not.toBeInTheDocument();
    expect(within(cartao('Restaurante Recusado')).getByText('Recusado')).toBeInTheDocument();
    expect(cartao('Restaurante Recusado').closest('.opacity-60')).not.toBeNull();
    expect(cartao('Rent Sal').closest('.opacity-60')).not.toBeNull();
    expect(cartao('Hotel Morabeza').closest('.opacity-60')).toBeNull();
  });

  it('o_botao_de_alternar_chama_updatePartner_com_active_invertido_e_substitui_a_linha', async () => {
    updatePartner.mockResolvedValue({ ...P2, active: true });
    await montar();
    fireEvent.click(botoes('Rent Sal')[1]);
    await waitFor(() => expect(updatePartner).toHaveBeenCalledWith('p2', { active: true }));
    await waitFor(() => expect(cartao('Rent Sal').closest('.opacity-60')).toBeNull());
  });

  it('eliminar_pede_confirmacao_e_chama_deletePartner', async () => {
    deletePartner.mockResolvedValue();
    await montar();
    spyConfirm.mockReturnValueOnce(false);
    fireEvent.click(botoes('Hotel Morabeza')[3]);
    expect(spyConfirm).toHaveBeenCalledWith('Eliminar este parceiro?');
    expect(deletePartner).not.toHaveBeenCalled();
    fireEvent.click(botoes('Hotel Morabeza')[3]);
    await waitFor(() => expect(deletePartner).toHaveBeenCalledWith('p1'));
    await waitFor(() => expect(screen.queryByText('Hotel Morabeza')).not.toBeInTheDocument());
  });

  it('sem_parceiros_mostra_o_vazio_e_o_botao_adicionar', async () => {
    listPartners.mockResolvedValue([]);
    render(<Partners />);
    expect(await screen.findByText('Sem parceiros configurados')).toBeInTheDocument();
    expect(screen.getByText('Adiciona operadores SalDesk parceiros para comecar a fazer cross-selling.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Adicionar parceiro' })).toHaveLength(2);
  });

  it('listPartners_a_falhar_ou_nulo_nao_rebenta', async () => {
    listPartners.mockRejectedValue(new Error('x'));
    render(<Partners />);
    expect(await screen.findByText('Sem parceiros configurados')).toBeInTheDocument();
    cleanup();
    listPartners.mockResolvedValue(null);
    render(<Partners />);
    expect(await screen.findByText('Sem parceiros configurados')).toBeInTheDocument();
  });

  it('em_carga_mostra_o_spinner_e_nao_os_separadores', () => {
    listPartners.mockReturnValue(new Promise(() => {}));
    const { container } = render(<Partners />);
    expect(screen.getByText('Parcerias Cross-Selling')).toBeInTheDocument();
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Adicionar parceiro' })).not.toBeInTheDocument();
  });
});

describe('Parcerias: pedidos', () => {
  it('separador_Pedidos_mostra_o_contador_so_com_pedidos_recebidos', async () => {
    await montar();
    expect(tabPedidos().textContent).toMatch(/Pedidos\D*2/);
    cleanup();
    listPartners.mockResolvedValue([P1, P5]);
    await montar();
    expect(tabPedidos().textContent).toBe('Pedidos');
  });

  it('pedidos_recebidos_e_enviados_separam_pelo_requested_by_operator_id', async () => {
    await montar();
    fireEvent.click(tabPedidos());
    expect(screen.getByText('Recebidos')).toBeInTheDocument();
    expect(screen.getByText('Enviados')).toBeInTheDocument();
    expect(cartao('Tours Sal')).toHaveTextContent('Recomendacao mutua (sem comissao) · 5% comissao');
    expect(cartao('Dive CV')).toHaveTextContent('Comissao por reserva referenciada · 12% comissao');
    expect(within(cartao('Tours Sal')).getByRole('button', { name: 'Aceitar' })).toBeInTheDocument();
    expect(within(cartao('Tours Sal')).getByRole('button', { name: 'Recusar' })).toBeInTheDocument();
    expect(cartao('Surf CV')).toHaveTextContent('A aguardar resposta');
    expect(within(cartao('Surf CV')).queryByRole('button', { name: 'Aceitar' })).not.toBeInTheDocument();
  });

  it('aceitar_chama_respondPartnership_e_o_parceiro_passa_para_a_lista', async () => {
    respondPartnership.mockResolvedValue({ ...P4, status: 'accepted', active: true });
    await montar();
    fireEvent.click(tabPedidos());
    fireEvent.click(within(cartao('Tours Sal')).getByRole('button', { name: 'Aceitar' }));
    await waitFor(() => expect(respondPartnership).toHaveBeenCalledWith('p4', 'accepted'));
    await waitFor(() => expect(screen.queryByText('Tours Sal')).not.toBeInTheDocument());
    expect(tabPedidos().textContent).toMatch(/Pedidos\D*1/);
    fireEvent.click(separador('Parceiros'));
    expect(await screen.findByText('Tours Sal')).toBeInTheDocument();
  });

  it('recusar_chama_respondPartnership_e_o_parceiro_aparece_recusado_na_lista', async () => {
    respondPartnership.mockResolvedValue({ ...P6, status: 'rejected', active: true });
    await montar();
    fireEvent.click(tabPedidos());
    fireEvent.click(within(cartao('Dive CV')).getByRole('button', { name: 'Recusar' }));
    await waitFor(() => expect(respondPartnership).toHaveBeenCalledWith('p6', 'rejected'));
    fireEvent.click(separador('Parceiros'));
    expect(within(cartao('Dive CV')).getByText('Recusado')).toBeInTheDocument();
  });

  it('cancelar_pedido_enviado_pede_confirmacao_e_chama_deletePartner', async () => {
    deletePartner.mockResolvedValue();
    await montar();
    fireEvent.click(tabPedidos());
    spyConfirm.mockReturnValueOnce(false);
    fireEvent.click(within(cartao('Surf CV')).getByRole('button'));
    expect(deletePartner).not.toHaveBeenCalled();
    fireEvent.click(within(cartao('Surf CV')).getByRole('button'));
    await waitFor(() => expect(deletePartner).toHaveBeenCalledWith('p5'));
    expect(await screen.findByText('Sem pedidos de parceria enviados.')).toBeInTheDocument();
  });

  it('pedidos_vazios_mostram_as_duas_frases', async () => {
    listPartners.mockResolvedValue([P1]);
    await montar();
    fireEvent.click(tabPedidos());
    expect(screen.getByText('Sem pedidos de parceria por responder.')).toBeInTheDocument();
    expect(screen.getByText('Sem pedidos de parceria enviados.')).toBeInTheDocument();
  });
});

describe('Parcerias: dashboard', () => {
  async function abrirDashboard(lista = PARCEIROS) {
    listPartners.mockResolvedValue(lista);
    await montar(lista[0].name);
    fireEvent.click(separador('Dashboard'));
    await screen.findByText('Reservas enviadas');
  }

  it('conta_so_parcerias_nao_pendentes_e_inclui_recusadas_nas_reservas', async () => {
    await abrirDashboard();
    expect(metrica('Reservas enviadas')).toBe('8');
    expect(metrica('Reservas recebidas')).toBe('3');
    expect(metrica('Balanco (recebidas - enviadas)')).toBe('-5');
  });

  it('parceiros_activos_exclui_inactivos_recusados_e_pendentes', async () => {
    await abrirDashboard();
    expect(metrica('Parceiros activos')).toBe('1');
  });

  it('comissoes_a_pagar_e_a_receber_so_com_tipo_comissao_e_pct_maior_que_zero', async () => {
    await abrirDashboard([P1, { id: 'p7', name: 'Pct Zero', partnership_type: 'commission', commission_pct: 0, status: 'accepted', active: true, bookings_sent: 10, bookings_received: 10, avg_booking_value: 100 }]);
    expect(screen.getByText('Comissoes a pagar').nextSibling.textContent).toBe('€24');
    expect(screen.getByText('Comissoes a receber').nextSibling.textContent).toBe('€16');
    expect(screen.getByText(/Por reservas que enviaste aos parceiros com comissao\./)).toBeInTheDocument();
  });

  it('sem_parceiros_de_comissao_nao_mostra_os_blocos_de_comissao', async () => {
    await abrirDashboard([P2]);
    expect(screen.queryByText('Comissoes a pagar')).not.toBeInTheDocument();
    expect(screen.queryByText('Comissoes a receber')).not.toBeInTheDocument();
    expect(metrica('Balanco (recebidas - enviadas)')).toBe('-1');
  });

  it('nota_sobre_automacoes', async () => {
    await abrirDashboard();
    expect(screen.getByText(/Para activar as recomendacoes automaticas/)).toBeInTheDocument();
    expect(screen.getByText('Automacoes de Comunicacao')).toBeInTheDocument();
  });
});

/* ───────────────────────── design system: separadores, lista, pedidos e dashboard ───────────────────────── */

describe('Parcerias: design system (separadores, lista, pedidos e dashboard)', () => {
  it('separadores_sao_Tabs_e_Pedidos_leva_o_contador', async () => {
    await montar();
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Parceiros' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Dashboard' })).toHaveAttribute('aria-selected', 'false');
    const pedidos = screen.getByRole('tab', { name: /Pedidos/ });
    expect(pedidos.textContent).toBe('Pedidos2');
  });

  it('os_selos_sao_Badge', async () => {
    await montar();
    expect(screen.getByText('SalDesk').className).toContain('var(--info-light)');
    expect(screen.getByText('Recusado').className).toContain('var(--error-light)');
  });

  it('os_botoes_de_icone_tem_nome_acessivel', async () => {
    await montar();
    expect(screen.getByRole('button', { name: 'Registar reservas Hotel Morabeza' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Desactivar Hotel Morabeza' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Activar Rent Sal' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar Hotel Morabeza' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Eliminar Hotel Morabeza' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Pedidos/ }));
    expect(screen.getByRole('button', { name: 'Cancelar pedido Surf CV' })).toBeInTheDocument();
  });

  it('o_vazio_e_EmptyState_com_a_accao', async () => {
    listPartners.mockResolvedValue([]);
    render(<Partners />);
    expect(await screen.findByText('Sem parceiros configurados')).toHaveClass('font-display');
  });

  it('sem_hexadecimais_cores_nomeadas_text_error_nem_bg_red_nos_tres_separadores', async () => {
    const { container } = await montar();
    let html = container.innerHTML;
    fireEvent.click(screen.getByRole('tab', { name: /Pedidos/ }));
    html += container.innerHTML;
    fireEvent.click(screen.getByRole('tab', { name: 'Dashboard' }));
    await screen.findByText('Reservas enviadas');
    html += container.innerHTML;
    expect(html).not.toMatch(HEX);
    expect(html).not.toMatch(NOMEADAS);
    expect(html).not.toMatch(/bg-red-/);
    expect(html.replace(/text-error ml-0[.]5/g, '')).not.toMatch(/(?:text|bg|border)-error/);
  });
});
