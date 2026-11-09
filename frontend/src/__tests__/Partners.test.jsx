import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

/* ───────────────────────── caracterizacao: modais ───────────────────────── */

const dialogo = () => screen.getByRole('dialog');
const campoDe = (etiqueta, tag = 'input') => within(dialogo()).getByText(etiqueta).parentElement.querySelector(tag);
const abrirNovo = async () => {
  await montar();
  fireEvent.click(screen.getAllByRole('button', { name: 'Adicionar parceiro' })[0]);
  return dialogo();
};
const segmento = (rotulo) => within(dialogo()).getByText(rotulo).closest('button');
const submeter = (rotulo) => fireEvent.click(within(dialogo()).getByRole('button', { name: rotulo }));
const OPERADOR = { id: 'o9', name: 'Hotel Oasis', operator_type: 'hotel' };

describe('Parcerias: modal de parceiro (externo)', () => {
  it('adicionar_abre_o_modal_com_parceiro_externo_por_omissao', async () => {
    const d = await abrirNovo();
    expect(within(d).getByText('Adicionar parceiro')).toBeInTheDocument();
    expect(segmento('Parceiro externo')).toBeInTheDocument();
    expect(segmento('Operador SalDesk')).toBeInTheDocument();
    expect(campoDe('Nome do parceiro')).toHaveValue('');
    expect(campoDe('Tipo de parceiro', 'select')).toHaveValue('hotel');
    expect(campoDe('Tipo de parceria', 'select')).toHaveValue('recommendation');
    expect(within(d).queryByText('Comissao (%)')).not.toBeInTheDocument();
    expect(campoDe('Mensagem de recomendacao PT', 'textarea')).toBeInTheDocument();
    expect(within(d).getByRole('button', { name: 'Adicionar' })).toBeInTheDocument();
  });

  it('criar_externo_chama_createPartner_com_nome_tipo_parceria_comissao_valor_mensagens_e_active', async () => {
    createPartner.mockResolvedValue({ id: 'n1', name: 'Novo Rent', partner_type: 'rentacar', partnership_type: 'commission', status: 'accepted', active: true });
    await abrirNovo();
    fireEvent.change(campoDe('Nome do parceiro'), { target: { value: 'Novo Rent' } });
    fireEvent.change(campoDe('Tipo de parceiro', 'select'), { target: { value: 'rentacar' } });
    fireEvent.change(campoDe('Tipo de parceria', 'select'), { target: { value: 'commission' } });
    fireEvent.change(campoDe('Comissao (%)'), { target: { value: '10' } });
    fireEvent.change(campoDe('Preco medio da reserva (€)'), { target: { value: '80' } });
    fireEvent.change(campoDe('Mensagem de recomendacao PT', 'textarea'), { target: { value: 'Ola PT' } });
    fireEvent.change(campoDe('Mensagem de recomendacao EN', 'textarea'), { target: { value: 'Hello EN' } });
    submeter('Adicionar');
    await waitFor(() => expect(createPartner).toHaveBeenCalledWith({
      name: 'Novo Rent', partner_type: 'rentacar', partnership_type: 'commission', commission_pct: 10, avg_booking_value: 80,
      message_pt: 'Ola PT', message_en: 'Hello EN', active: true,
    }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const nomes = [...document.querySelectorAll('p.font-display')].map(p => p.textContent);
    expect(nomes[0]).toContain('Novo Rent');
  });

  it('comissao_e_valor_vazios_enviam_0_e_com_desconto_cruzado_as_mensagens_ficam_ocultas', async () => {
    createPartner.mockResolvedValue({ id: 'n1', name: 'Desc', status: 'accepted', active: true });
    await abrirNovo();
    fireEvent.change(campoDe('Nome do parceiro'), { target: { value: 'Desc' } });
    fireEvent.change(campoDe('Tipo de parceria', 'select'), { target: { value: 'commission' } });
    fireEvent.change(campoDe('Tipo de parceria', 'select'), { target: { value: 'discount' } });
    expect(within(dialogo()).queryByText('Comissao (%)')).not.toBeInTheDocument();
    expect(within(dialogo()).queryByText('Mensagem de recomendacao PT')).not.toBeInTheDocument();
    submeter('Adicionar');
    await waitFor(() => expect(createPartner).toHaveBeenCalledWith({
      name: 'Desc', partner_type: 'hotel', partnership_type: 'discount', commission_pct: 0, avg_booking_value: 0,
      message_pt: '', message_en: '', active: true,
    }));
  });

  it('falha_ao_guardar_mostra_o_erro_do_servidor_ou_Erro ao guardar parceiro.', async () => {
    createPartner.mockRejectedValueOnce({ response: { data: { error: 'Nome duplicado' } } });
    await abrirNovo();
    fireEvent.change(campoDe('Nome do parceiro'), { target: { value: 'X' } });
    submeter('Adicionar');
    expect(await screen.findByText('Nome duplicado')).toBeInTheDocument();
    createPartner.mockRejectedValueOnce(new Error('x'));
    submeter('Adicionar');
    expect(await screen.findByText('Erro ao guardar parceiro.')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('editar_externo_mostra_os_valores_e_chama_updatePartner_com_o_id_e_substitui_a_linha', async () => {
    updatePartner.mockResolvedValue({ ...P2, name: 'Rent Sal 2', active: false });
    await montar();
    fireEvent.click(botoes('Rent Sal')[2]);
    const d = dialogo();
    expect(within(d).getByText('Editar parceiro')).toBeInTheDocument();
    expect(within(d).queryByText('Parceiro externo')).not.toBeInTheDocument();
    expect(campoDe('Nome do parceiro')).toHaveValue('Rent Sal');
    expect(campoDe('Tipo de parceiro', 'select')).toHaveValue('rentacar');
    fireEvent.change(campoDe('Nome do parceiro'), { target: { value: 'Rent Sal 2' } });
    submeter('Guardar');
    await waitFor(() => expect(updatePartner).toHaveBeenCalledWith('p2', {
      name: 'Rent Sal 2', partner_type: 'rentacar', partnership_type: 'recommendation', commission_pct: 0, avg_booking_value: 0,
      message_pt: '', message_en: '', active: false,
    }));
    expect(await screen.findByText('Rent Sal 2')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('cancelar_fecha_o_modal_sem_guardar', async () => {
    await abrirNovo();
    submeter('Cancelar');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(createPartner).not.toHaveBeenCalled();
  });
});

describe('Parcerias: modal de parceiro (operador SalDesk)', () => {
  it('modo_Operador_SalDesk_exige_escolher_um_operador', async () => {
    await abrirNovo();
    fireEvent.click(segmento('Operador SalDesk'));
    expect(within(dialogo()).queryByText('Nome do parceiro')).not.toBeInTheDocument();
    expect(within(dialogo()).getByText('O pedido fica pendente ate o operador escolhido o aceitar.')).toBeInTheDocument();
    expect(within(dialogo()).getByRole('button', { name: 'Enviar pedido' })).toBeInTheDocument();
    submeter('Enviar pedido');
    expect(await screen.findByText('Escolhe um operador da lista.')).toBeInTheDocument();
    expect(requestPartnership).not.toHaveBeenCalled();
  });

  async function escreverPesquisa(valor) {
    fireEvent.change(within(dialogo()).getByPlaceholderText('Pesquisar operador pelo nome...'), { target: { value: valor } });
  }
  const avancar = (ms) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

  it('pesquisa_so_dispara_com_2_letras_e_300ms_e_chama_searchOperators_com_o_texto_sem_espacos', async () => {
    let resolver;
    searchOperators.mockReturnValue(new Promise(r => { resolver = r; }));
    await abrirNovo();
    fireEvent.click(segmento('Operador SalDesk'));
    vi.useFakeTimers();
    try {
      await escreverPesquisa('a');
      await avancar(500);
      expect(searchOperators).not.toHaveBeenCalled();
      expect(screen.queryByText('Nenhum operador encontrado.')).not.toBeInTheDocument();
      await escreverPesquisa(' ab ');
      await avancar(299);
      expect(searchOperators).not.toHaveBeenCalled();
      expect(screen.getByText('A pesquisar...')).toBeInTheDocument();
      await avancar(1);
      expect(searchOperators).toHaveBeenCalledTimes(1);
      expect(searchOperators).toHaveBeenCalledWith('ab');
      resolver([OPERADOR, { id: 'o8', name: 'Tipo Estranho', operator_type: 'desconhecido' }]);
      await avancar(0);
      expect(screen.queryByText('A pesquisar...')).not.toBeInTheDocument();
      expect(screen.getByText('Hotel Oasis')).toBeInTheDocument();
      expect(screen.getAllByText('Hotel / Alojamento')).toHaveLength(2);
    } finally { vi.useRealTimers(); }
  });

  it('sem_resultados_ou_pesquisa_a_falhar_mostra_Nenhum operador encontrado.', async () => {
    searchOperators.mockResolvedValueOnce([]);
    await abrirNovo();
    fireEvent.click(segmento('Operador SalDesk'));
    vi.useFakeTimers();
    try {
      await escreverPesquisa('ab');
      await avancar(300);
      expect(screen.getByText('Nenhum operador encontrado.')).toBeInTheDocument();
      searchOperators.mockRejectedValueOnce(new Error('x'));
      await escreverPesquisa('abc');
      await avancar(300);
      expect(screen.getByText('Nenhum operador encontrado.')).toBeInTheDocument();
    } finally { vi.useRealTimers(); }
  });

  it('escolher_operador_mostra_nome_e_tipo_e_Trocar_volta_a_pesquisar', async () => {
    searchOperators.mockResolvedValue([OPERADOR]);
    await abrirNovo();
    fireEvent.click(segmento('Operador SalDesk'));
    vi.useFakeTimers();
    try {
      await escreverPesquisa('oa');
      await avancar(300);
    } finally { vi.useRealTimers(); }
    fireEvent.click(screen.getByText('Hotel Oasis').closest('button'));
    expect(within(dialogo()).getByText('Hotel Oasis')).toBeInTheDocument();
    expect(within(dialogo()).queryByPlaceholderText('Pesquisar operador pelo nome...')).not.toBeInTheDocument();
    fireEvent.click(within(dialogo()).getByRole('button', { name: 'Trocar' }));
    expect(within(dialogo()).getByPlaceholderText('Pesquisar operador pelo nome...')).toBeInTheDocument();
  });

  it('enviar_pedido_chama_requestPartnership_com_partner_operator_id_e_dados_comuns_e_adiciona_a_linha', async () => {
    searchOperators.mockResolvedValue([OPERADOR]);
    requestPartnership.mockResolvedValue({ id: 'n2', name: 'Hotel Oasis', partner_type: 'hotel', status: 'pending', requested_by_operator_id: 'op1' });
    await abrirNovo();
    fireEvent.click(segmento('Operador SalDesk'));
    vi.useFakeTimers();
    try {
      await escreverPesquisa('oa');
      await avancar(300);
    } finally { vi.useRealTimers(); }
    fireEvent.click(screen.getByText('Hotel Oasis').closest('button'));
    fireEvent.change(campoDe('Tipo de parceria', 'select'), { target: { value: 'commission' } });
    fireEvent.change(campoDe('Comissao (%)'), { target: { value: '10' } });
    submeter('Enviar pedido');
    await waitFor(() => expect(requestPartnership).toHaveBeenCalledWith({
      partner_operator_id: 'o9', partnership_type: 'commission', commission_pct: 10, avg_booking_value: 0, message_pt: '', message_en: '',
    }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(tabPedidos());
    expect(await screen.findByText('Hotel Oasis')).toBeInTheDocument();
    expect(cartao('Hotel Oasis')).toHaveTextContent('A aguardar resposta');
  });

  it('pedido_a_falhar_mostra_Erro ao guardar parceiro.', async () => {
    searchOperators.mockResolvedValue([OPERADOR]);
    requestPartnership.mockRejectedValue(new Error('x'));
    await abrirNovo();
    fireEvent.click(segmento('Operador SalDesk'));
    vi.useFakeTimers();
    try {
      await escreverPesquisa('oa');
      await avancar(300);
    } finally { vi.useRealTimers(); }
    fireEvent.click(screen.getByText('Hotel Oasis').closest('button'));
    submeter('Enviar pedido');
    expect(await screen.findByText('Erro ao guardar parceiro.')).toBeInTheDocument();
  });

  it('parceiro_real_existente_nao_deixa_trocar_o_operador_e_guarda_com_updatePartner', async () => {
    updatePartner.mockResolvedValue({ ...P1, commission_pct: 15 });
    await montar();
    fireEvent.click(botoes('Hotel Morabeza')[2]);
    const d = dialogo();
    expect(within(d).queryByText('Parceiro externo')).not.toBeInTheDocument();
    expect(within(d).queryByText('Nome do parceiro')).not.toBeInTheDocument();
    expect(within(d).getByText('Operador SalDesk')).toBeInTheDocument();
    expect(within(d).queryByText('O pedido fica pendente ate o operador escolhido o aceitar.')).not.toBeInTheDocument();
    expect(within(d).getByText('Hotel Morabeza')).toBeInTheDocument();
    fireEvent.click(within(d).getByRole('button', { name: 'Trocar' }));
    expect(within(d).getByText('Hotel Morabeza')).toBeInTheDocument();
    expect(within(d).queryByPlaceholderText('Pesquisar operador pelo nome...')).not.toBeInTheDocument();
    expect(campoDe('Comissao (%)')).toHaveValue(10);
    fireEvent.change(campoDe('Comissao (%)'), { target: { value: '15' } });
    submeter('Guardar');
    await waitFor(() => expect(updatePartner).toHaveBeenCalledWith('p1', {
      name: 'Hotel Morabeza', partner_type: 'hotel', partnership_type: 'commission', commission_pct: 15, avg_booking_value: 80,
      message_pt: 'Recomendamos o Morabeza', message_en: '', active: true,
    }));
  });
});

describe('Parcerias: registar reservas', () => {
  it('registar_chama_registerPartnerBooking_com_id_direccao_e_numero_e_fecha', async () => {
    registerPartnerBooking.mockResolvedValue({ ...P1, bookings_sent: 4 });
    await montar();
    fireEvent.click(botoes('Hotel Morabeza')[0]);
    expect(within(dialogo()).getByText('Registar reservas — Hotel Morabeza')).toBeInTheDocument();
    expect(campoDe('Numero de reservas')).toHaveValue(1);
    submeter('Registar');
    await waitFor(() => expect(registerPartnerBooking).toHaveBeenCalledWith('p1', 'sent', 1));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(cartao('Hotel Morabeza')).toHaveTextContent('4enviadas');
  });

  it('recebidas_muda_a_direccao_e_numero_invalido_vale_1', async () => {
    registerPartnerBooking.mockResolvedValue({ ...P1, bookings_received: 5 });
    await montar();
    fireEvent.click(botoes('Hotel Morabeza')[0]);
    fireEvent.click(segmento('Reserva recebida do parceiro'));
    fireEvent.change(campoDe('Numero de reservas'), { target: { value: '3' } });
    submeter('Registar');
    await waitFor(() => expect(registerPartnerBooking).toHaveBeenCalledWith('p1', 'received', 3));
    fireEvent.click(botoes('Hotel Morabeza')[0]);
    fireEvent.change(campoDe('Numero de reservas'), { target: { value: '0' } });
    submeter('Registar');
    await waitFor(() => expect(registerPartnerBooking).toHaveBeenLastCalledWith('p1', 'sent', 1));
  });

  it('cancelar_fecha_o_modal_de_reservas', async () => {
    await montar();
    fireEvent.click(botoes('Hotel Morabeza')[0]);
    submeter('Cancelar');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(registerPartnerBooking).not.toHaveBeenCalled();
  });
});

/* ───────────────────────── design system: modais ───────────────────────── */

describe('Parcerias: design system (modais)', () => {
  it('os_campos_do_modal_de_parceiro_tem_nome_acessivel', async () => {
    await abrirNovo();
    fireEvent.change(campoDe('Tipo de parceria', 'select'), { target: { value: 'commission' } });
    const d = dialogo();
    for (const etiqueta of ['Nome do parceiro', 'Tipo de parceiro', 'Tipo de parceria', 'Comissao (%)', 'Preco medio da reserva (€)']) {
      expect(within(d).getByLabelText(etiqueta)).toBeInTheDocument();
    }
    fireEvent.change(campoDe('Tipo de parceria', 'select'), { target: { value: 'recommendation' } });
    expect(within(d).getByLabelText('Mensagem de recomendacao PT')).toBeInTheDocument();
    expect(within(d).getByLabelText('Mensagem de recomendacao EN')).toBeInTheDocument();
  });

  it('os_seletores_segmentados_tem_aria_pressed', async () => {
    await abrirNovo();
    expect(within(dialogo()).getByRole('button', { name: 'Parceiro externo', pressed: true })).toBeInTheDocument();
    fireEvent.click(within(dialogo()).getByRole('button', { name: 'Operador SalDesk' }));
    expect(within(dialogo()).getByRole('button', { name: 'Operador SalDesk', pressed: true })).toBeInTheDocument();
    expect(within(dialogo()).getByRole('button', { name: 'Parceiro externo', pressed: false })).toBeInTheDocument();
  });

  it('a_pesquisa_de_operadores_e_Input_com_nome_acessivel', async () => {
    await abrirNovo();
    fireEvent.click(segmento('Operador SalDesk'));
    expect(within(dialogo()).getByLabelText('Pesquisar operador pelo nome')).toBeInTheDocument();
  });

  it('o_modal_de_reservas_tem_campo_e_seletor_acessiveis', async () => {
    await montar();
    fireEvent.click(screen.getByRole('button', { name: 'Registar reservas Hotel Morabeza' }));
    expect(within(dialogo()).getByLabelText('Numero de reservas')).toHaveValue(1);
    expect(within(dialogo()).getByRole('button', { name: 'Reserva enviada ao parceiro', pressed: true })).toBeInTheDocument();
    fireEvent.click(within(dialogo()).getByRole('button', { name: 'Reserva recebida do parceiro' }));
    expect(within(dialogo()).getByRole('button', { name: 'Reserva recebida do parceiro', pressed: true })).toBeInTheDocument();
  });

  it('sem_hexadecimais_cores_nomeadas_text_error_nem_input_solto_com_os_modais_abertos_em_cada_modo', async () => {
    searchOperators.mockResolvedValue([OPERADOR]);
    createPartner.mockRejectedValue(new Error('x'));
    await abrirNovo();
    let html = document.body.innerHTML;
    fireEvent.change(campoDe('Tipo de parceria', 'select'), { target: { value: 'commission' } });
    fireEvent.change(campoDe('Nome do parceiro'), { target: { value: 'X' } });
    submeter('Adicionar');
    await screen.findByText('Erro ao guardar parceiro.');
    html += document.body.innerHTML;
    fireEvent.click(segmento('Operador SalDesk'));
    vi.useFakeTimers();
    try {
      fireEvent.change(within(dialogo()).getByLabelText('Pesquisar operador pelo nome'), { target: { value: 'oa' } });
      await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    } finally { vi.useRealTimers(); }
    html += document.body.innerHTML;
    fireEvent.click(screen.getByText('Hotel Oasis').closest('button'));
    html += document.body.innerHTML;
    for (const input of dialogo().querySelectorAll('input')) {
      expect(input.getAttribute('aria-label')).toBeTruthy();
    }
    cleanup();
    await montar();
    fireEvent.click(screen.getByRole('button', { name: 'Registar reservas Hotel Morabeza' }));
    html += document.body.innerHTML;
    expect(html).not.toMatch(HEX);
    expect(html).not.toMatch(NOMEADAS);
    expect(html.replace(/text-error ml-0[.]5/g, '')).not.toMatch(/(?:text|bg|border)-error/);
    expect(html).not.toMatch(/bg-red-/);
  });
});
