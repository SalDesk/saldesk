import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Packages from '../pages/Packages';
import { listPackages, createPackage, updatePackage, deletePackage } from '../services/packagesService';
import { listUnits } from '../services/unitsService';

vi.mock('../services/packagesService', () => ({
  listPackages: vi.fn(), createPackage: vi.fn(), updatePackage: vi.fn(), deletePackage: vi.fn(),
}));
vi.mock('../services/unitsService', () => ({ listUnits: vi.fn() }));

const HEX = /#[0-9A-Fa-f]{3,8}(?![0-9A-Za-z])/;
const NOMEADAS = /(?:^|[\s"'])(?:[a-z-]+:)?(?:text|bg|border|fill|ring)-(?:green|yellow|blue|red|amber)-\d/;
const norm = (t) => t.replace(/\s/g, ' ');
function dia(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA'); }
function fmtDate(d) { return norm(new Date(d + 'T00:00:00Z').toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })); }

const UNIDADES = [
  { id: 'u1', name: 'Kite', base_price: 50 }, { id: 'u2', name: 'Mergulho', base_price: 40 },
  { id: 'u3', name: 'Quad', base_price: 30 }, { id: 'u4', name: 'Barco', base_price: 20 },
];
const PACOTES = [
  { id: 'p1', name_pt: 'Pacote Aventura', description_pt: 'Quatro tours', tour_ids: ['u1', 'u2', 'u3', 'u4'], price: 100, original_price: 140, bookings_count: 5, limit: 0, valid_from: '2026-12-01', valid_to: dia(30), photo_url: 'http://x.test/p.jpg', status: 'activo' },
  { id: 'p2', name_pt: 'Pacote Inactivo', tour_ids: ['u1'], price: 50, original_price: 0, bookings_count: 0, limit: 0, status: 'inactivo' },
  { id: 'p3', name_pt: 'Pacote Cheio', tour_ids: ['u2'], price: 60, original_price: 60, bookings_count: 10, limit: 10, status: 'activo' },
  { id: 'p4', name_pt: 'Pacote Expirado', tour_ids: ['u1', 'u9'], price: 70, original_price: 70, bookings_count: 0, limit: 0, valid_to: dia(-5), status: 'activo' },
  { id: 'p5', name_pt: 'Pacote Limitado', tour_ids: [], price: 25, original_price: 25, bookings_count: 8, limit: 20, status: 'activo' },
];

let spyErr; let spyWarn;
beforeEach(() => {
  spyErr = vi.spyOn(console, 'error').mockImplementation(() => {});
  spyWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  listPackages.mockReset().mockResolvedValue(PACOTES);
  listUnits.mockReset().mockResolvedValue(UNIDADES);
  [createPackage, updatePackage, deletePackage].forEach(f => f.mockReset());
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

async function montar(primeiro = 'Pacote Aventura') {
  const r = render(<Packages />);
  await screen.findByText(primeiro);
  return r;
}
const cartao = (nome) => screen.getByText(nome, { selector: 'p' }).closest('div.overflow-hidden');
const kpi = (rotulo) => screen.getByText(rotulo).previousSibling.textContent;
const novoPacote = () => screen.getAllByText('Novo pacote').find(e => e.closest('button')).closest('button');

/* ───────────────────────── caracterizacao ───────────────────────── */

describe('Pacotes: lista', () => {
  it('lista_os_pacotes_com_preco_tours_validade_e_reservas', async () => {
    await montar();
    const c = cartao('Pacote Aventura');
    expect(c).toHaveTextContent('Quatro tours');
    ['Kite', 'Mergulho', 'Quad'].forEach(t => expect(within(c).getByText(t)).toBeInTheDocument());
    expect(within(c).queryByText('Barco')).toBeNull();
    expect(c).toHaveTextContent('+1');
    expect(c).toHaveTextContent('€100');
    expect(c).toHaveTextContent('€140');
    expect(c).toHaveTextContent('Poupa €40');
    expect(c).toHaveTextContent(`${fmtDate('2026-12-01')} — ${fmtDate(dia(30))}`);
    expect(c).toHaveTextContent('5 reserva(s)');
    expect(c).not.toHaveTextContent('restante(s)');
    expect(c.querySelector('img')).toHaveAttribute('src', 'http://x.test/p.jpg');
  });

  it('kpis_activos_reservas_e_receita_gerada', async () => {
    await montar();
    expect(kpi('Pacotes activos')).toBe('4');
    expect(kpi('Reservas por pacotes')).toBe('23');
    expect(norm(kpi('Receita gerada'))).toBe(norm(`€${Math.round(5 * 100 + 10 * 60 + 8 * 25).toLocaleString('pt-PT')}`));
  });

  it('selo_esgotado_expirado_ou_o_estado', async () => {
    await montar();
    expect(within(cartao('Pacote Aventura')).getByText('Activo')).toBeInTheDocument();
    expect(within(cartao('Pacote Inactivo')).getByText('Inactivo')).toBeInTheDocument();
    expect(within(cartao('Pacote Cheio')).getByText('Esgotado')).toBeInTheDocument();
    expect(within(cartao('Pacote Expirado')).getByText('Expirado')).toBeInTheDocument();
  });

  it('poupanca_so_se_positiva_sem_preco_original_riscado_e_tours_inexistentes_ignorados', async () => {
    await montar();
    expect(cartao('Pacote Inactivo')).not.toHaveTextContent('Poupa');
    expect(cartao('Pacote Cheio')).not.toHaveTextContent('Poupa'); /* 60 - 60 */
    expect(within(cartao('Pacote Expirado')).queryByText('u9')).toBeNull();
    expect(within(cartao('Pacote Expirado')).getByText('Kite')).toBeInTheDocument();
  });

  it('foto_em_falta_mostra_o_marcador_e_restantes_so_com_limite', async () => {
    await montar();
    expect(cartao('Pacote Limitado').querySelector('img')).toBeNull();
    expect(cartao('Pacote Limitado')).toHaveTextContent('12 restante(s)');
    expect(cartao('Pacote Cheio')).toHaveTextContent('0 restante(s)');
  });

  it('sem_pacotes_mostra_o_vazio_e_o_botao_criar', async () => {
    listPackages.mockResolvedValue([]);
    render(<Packages />);
    expect(await screen.findByText('Sem pacotes criados')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Criar pacote/ }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Novo pacote');
  });

  it('servicos_a_falhar_nao_rebentam_e_em_carga_so_o_titulo', async () => {
    listPackages.mockRejectedValue(new Error('x'));
    listUnits.mockRejectedValue(new Error('x'));
    render(<Packages />);
    expect(await screen.findByText('Sem pacotes criados')).toBeInTheDocument();
    cleanup();
    listPackages.mockReturnValue(new Promise(() => {}));
    render(<Packages />);
    expect(screen.getByText('Pacotes Sazonais')).toBeInTheDocument();
    expect(screen.queryByText('Pacotes activos')).toBeNull();
  });
});

describe('Pacotes: accoes e formulario', () => {
  it('activar_e_desactivar_chamam_updatePackage_com_o_estado_seguinte', async () => {
    updatePackage.mockImplementation(async (id, d) => ({ ...PACOTES.find(p => p.id === id), ...d }));
    await montar();
    fireEvent.click(within(cartao('Pacote Aventura')).getByTitle('Desactivar'));
    await waitFor(() => expect(updatePackage).toHaveBeenCalledWith('p1', { status: 'inactivo' }));
    await waitFor(() => expect(within(cartao('Pacote Aventura')).getByText('Inactivo')).toBeInTheDocument());
    fireEvent.click(within(cartao('Pacote Inactivo')).getByTitle('Activar'));
    await waitFor(() => expect(updatePackage).toHaveBeenCalledWith('p2', { status: 'activo' }));
  });

  it('eliminar_pede_confirmacao_e_chama_deletePackage', async () => {
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    deletePackage.mockResolvedValue();
    await montar();
    const apagar = () => within(cartao('Pacote Aventura')).getAllByRole('button')[2];
    fireEvent.click(apagar());
    expect(confirmar).toHaveBeenCalledWith('Eliminar este pacote?');
    expect(deletePackage).not.toHaveBeenCalled();
    confirmar.mockReturnValue(true);
    fireEvent.click(apagar());
    await waitFor(() => expect(deletePackage).toHaveBeenCalledWith('p1'));
    await waitFor(() => expect(screen.queryByText('Pacote Aventura')).toBeNull());
  });

  it('criar_envia_price_numero_limit_e_original_price_e_mostra_a_soma_e_a_poupanca', async () => {
    createPackage.mockImplementation(async (d) => ({ id: 'pn', bookings_count: 0, ...d }));
    await montar();
    fireEvent.click(novoPacote());
    const dlg = screen.getByRole('dialog');
    expect(dlg).toHaveTextContent('Novo pacote');
    expect(within(dlg).getByText(/Tours incluidos \(0 seleccionado/)).toBeInTheDocument();
    fireEvent.change(within(dlg).getByPlaceholderText('Ex: Pacote Kite + Mergulho'), { target: { value: 'Pacote Novo' } });
    fireEvent.click(within(dlg).getByText('Kite'));
    fireEvent.click(within(dlg).getByText('Mergulho'));
    expect(dlg).toHaveTextContent('Soma dos tours individuais: €90');
    fireEvent.change(within(dlg).getByPlaceholderText('Ex: 85.00'), { target: { value: '70' } });
    expect(dlg).toHaveTextContent('Cliente poupa €20 vs compra individual');
    fireEvent.change(within(dlg).getByPlaceholderText('0'), { target: { value: '15' } });
    expect(within(dlg).queryByText('Estado')).toBeNull(); /* so ao editar */
    fireEvent.click(within(dlg).getByRole('button', { name: 'Criar pacote' }));
    await waitFor(() => expect(createPackage).toHaveBeenCalledTimes(1));
    expect(createPackage).toHaveBeenCalledWith(expect.objectContaining({
      name_pt: 'Pacote Novo', price: 70, limit: 15, original_price: 90, tour_ids: ['u1', 'u2'], status: 'activo',
    }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await screen.findByText('Pacote Novo')).toBeInTheDocument();
    fireEvent.click(novoPacote());
    fireEvent.change(screen.getByPlaceholderText('Ex: Pacote Kite + Mergulho'), { target: { value: 'Sem limite' } });
    fireEvent.change(screen.getByPlaceholderText('Ex: 85.00'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar pacote' }));
    await waitFor(() => expect(createPackage).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 0, original_price: 0 })));
  });

  it('editar_mostra_o_estado_e_chama_updatePackage_com_o_id', async () => {
    updatePackage.mockImplementation(async (id, d) => ({ ...PACOTES[0], ...d }));
    await montar();
    fireEvent.click(within(cartao('Pacote Aventura')).getAllByRole('button')[1]);
    const dlg = screen.getByRole('dialog');
    expect(dlg).toHaveTextContent('Editar pacote');
    expect(within(dlg).getByPlaceholderText('Ex: Pacote Kite + Mergulho')).toHaveValue('Pacote Aventura');
    const estado = within(dlg).getAllByRole('combobox')[0];
    expect(Array.from(estado.options).map(o => o.textContent)).toEqual(['Activo', 'Inactivo', 'Esgotado']);
    fireEvent.change(estado, { target: { value: 'esgotado' } });
    fireEvent.click(within(dlg).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(updatePackage).toHaveBeenCalledWith('p1', expect.objectContaining({ status: 'esgotado', price: 100 })));
  });

  it('falha_ao_guardar_mostra_o_erro_e_o_modal_fica_aberto', async () => {
    createPackage.mockRejectedValue(new Error('x'));
    await montar();
    fireEvent.click(novoPacote());
    fireEvent.change(screen.getByPlaceholderText('Ex: Pacote Kite + Mergulho'), { target: { value: 'X' } });
    fireEvent.change(screen.getByPlaceholderText('Ex: 85.00'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar pacote' }));
    expect(await screen.findByText('Erro ao guardar pacote.')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('sem_tours_no_modal_mostra_a_mensagem', async () => {
    listUnits.mockResolvedValue([]);
    await montar();
    fireEvent.click(novoPacote());
    expect(screen.getByText('Sem tours disponiveis. Cria tours primeiro em Unidades.')).toBeInTheDocument();
  });
});

/* ───────────────────────── design system ───────────────────────── */

describe('Pacotes com o design system', () => {
  it('o_selo_e_o_Badge_com_a_variante_certa', async () => {
    await montar();
    expect(within(cartao('Pacote Aventura')).getByText('Activo').className).toContain('var(--success)');
    expect(within(cartao('Pacote Cheio')).getByText('Esgotado').className).toContain('var(--warning)');
    expect(within(cartao('Pacote Expirado')).getByText('Expirado').className).toContain('bg-n-100');
    expect(within(cartao('Pacote Inactivo')).getByText('Inactivo').className).toContain('bg-n-100');
  });

  it('os_botoes_de_icone_tem_nome_acessivel', async () => {
    await montar();
    expect(screen.getByRole('button', { name: 'Desactivar Pacote Aventura' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Activar Pacote Inactivo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar Pacote Aventura' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Eliminar Pacote Aventura' })).toBeInTheDocument();
  });

  it('os_campos_do_modal_tem_nome_acessivel', async () => {
    await montar();
    fireEvent.click(within(cartao('Pacote Aventura')).getByRole('button', { name: 'Editar Pacote Aventura' }));
    const modal = within(screen.getByRole('dialog'));
    ['Nome PT', 'Nome EN', 'Descricao PT', 'Descricao EN', 'Preco do pacote (€)', 'Limite de vendas (0 = ilimitado)', 'Valido de', 'Valido ate', 'Foto (URL)', 'Estado']
      .forEach(r => expect(modal.getByLabelText(r)).toBeInTheDocument());
  });

  it('o_vazio_usa_o_EmptyState', async () => {
    listPackages.mockResolvedValue([]);
    render(<Packages />);
    expect(await screen.findByText('Sem pacotes criados')).toHaveClass('font-display');
  });

  it('sem_hexadecimais_cores_nomeadas_ou_text_error_com_todos_os_estados_e_o_erro', async () => {
    createPackage.mockRejectedValue(new Error('x'));
    const { container } = await montar();
    fireEvent.click(novoPacote());
    fireEvent.change(screen.getByPlaceholderText('Ex: Pacote Kite + Mergulho'), { target: { value: 'X' } });
    fireEvent.change(screen.getByPlaceholderText('Ex: 85.00'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar pacote' }));
    await screen.findByText('Erro ao guardar pacote.');
    const html = container.innerHTML;
    expect(html).not.toMatch(HEX);
    expect(html).not.toMatch(NOMEADAS);
    expect(html.replace(/text-error ml-0[.]5/g, '')).not.toMatch(/(?:text|bg|border)-error/);
  });
});
