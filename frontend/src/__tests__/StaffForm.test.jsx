import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Staff from '../pages/Staff';
import StaffForm from '../pages/staff/StaffForm';
import useAuthStore from '../store/authStore';
import { listUnits } from '../services/unitsService';
import { listStaff } from '../services/staffService';
import { listSellerCommissions } from '../services/sellerService';
import { getUnreadCount } from '../services/messageService';
import { FUTURE, COLABORADORES } from './helpers/staffFixtures';

vi.mock('socket.io-client', () => ({ io: vi.fn(() => ({ on: vi.fn(), emit: vi.fn(), disconnect: vi.fn() })) }));
vi.mock('../services/staffService', () => ({
  listStaff: vi.fn(), createStaff: vi.fn(), updateStaff: vi.fn(), deleteStaff: vi.fn(), createStaffAccount: vi.fn(),
}));
vi.mock('../services/sellerService', () => ({ listSellerCommissions: vi.fn(), markCommissionPaid: vi.fn() }));
vi.mock('../services/assignmentService', () => ({
  listAssignments: vi.fn(), startAssignment: vi.fn(), completeAssignment: vi.fn(), cancelAssignment: vi.fn(), createAssignment: vi.fn(),
}));
vi.mock('../services/reservationsService', () => ({ listReservations: vi.fn() }));
vi.mock('../services/messageService', () => ({
  listMessages: vi.fn(), sendMessage: vi.fn(), getUnreadCount: vi.fn(), listGroups: vi.fn(), createGroup: vi.fn(),
}));
vi.mock('../services/unitsService', () => ({ listUnits: vi.fn() }));

const ROLES = ['Guia', 'Instrutor', 'Vendedor de Praia', 'Administracao'];
const HEX = /#[0-9A-Fa-f]{3,8}(?![0-9A-Za-z])/;
const NOMEADAS = /(?:^|[\s"'])(?:[a-z-]+:)?(?:text|bg|border|fill|ring)-(?:green|yellow|blue|red|amber)-\d/;
const BASE = {
  name: 'Maria Nova', role: 'Guia', phone: '', email: '', whatsapp: '', photo_url: '', hire_date: '', status: 'active',
  commission_pct: null, seller_zone: '', skills: [], schedule: [], create_access: false, seller_tour_ids: [],
};

let spyErr; let spyWarn;
beforeEach(() => {
  spyErr = vi.spyOn(console, 'error').mockImplementation(() => {});
  spyWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  listUnits.mockReset().mockResolvedValue([{ id: 'u1', name: 'Buggy Tour' }, { id: 'u2', name: 'Quad' }]);
});
afterEach(() => {
  /* ler as contagens ANTES de restaurar os espioes */
  const erros = spyErr.mock.calls.map(c => String(c[0]).slice(0, 200));
  const avisos = spyWarn.mock.calls.map(c => String(c[0]).slice(0, 200));
  cleanup();
  vi.unstubAllGlobals();
  useAuthStore.setState({ token: null, operator: null });
  vi.restoreAllMocks();
  expect(erros).toEqual([]);
  expect(avisos).toEqual([]);
});

function montar(props = {}) {
  const onSave = vi.fn(); const onCancel = vi.fn();
  const r = render(<StaffForm member={null} onSave={onSave} onCancel={onCancel} loading={false} error="" roles={ROLES} {...props} />);
  return { ...r, onSave, onCancel };
}
const nome = () => screen.getByPlaceholderText('Nome e apelido');
/* o interruptor funciona antes (botao + texto) e depois (Toggle) da migracao */
const interruptor = () => screen.getByText('Criar conta /staff').parentElement.parentElement.querySelector('button');
const submeter = (rotulo = 'Criar colaborador') => fireEvent.click(screen.getByRole('button', { name: rotulo }));

/* ───────────────────────── caracterizacao ───────────────────────── */

describe('StaffForm', () => {
  it('criar_envia_os_campos_com_commission_pct_null_quando_vazio_e_create_access_false', () => {
    const { onSave } = montar();
    fireEvent.change(nome(), { target: { value: 'Maria Nova' } });
    submeter();
    expect(onSave).toHaveBeenCalledWith(BASE);
  });

  it('preenchidos_vao_no_pedido', () => {
    const { onSave } = montar();
    fireEvent.change(nome(), { target: { value: 'Maria Nova' } });
    fireEvent.change(screen.getByPlaceholderText('nome@email.com'), { target: { value: 'maria@x.cv' } });
    const [tel, wapp] = screen.getAllByPlaceholderText('+238 900 0000');
    fireEvent.change(tel, { target: { value: '+238 991' } });
    fireEvent.change(wapp, { target: { value: '+238 992' } });
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'Instrutor' } });
    submeter();
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'Maria Nova', email: 'maria@x.cv', phone: '+238 991', whatsapp: '+238 992', role: 'Instrutor' }));
  });

  it('editar_mostra_o_estado_nao_mostra_a_conta_de_acesso_e_traz_os_valores', () => {
    const { onSave } = montar({ member: { ...COLABORADORES[0], status: 'inactive' } });
    expect(nome()).toHaveValue('Rui Lopes');
    expect(screen.queryByText('Criar conta /staff')).toBeNull();
    const estado = screen.getAllByRole('combobox')[1];
    expect(Array.from(estado.options).map(o => o.textContent)).toEqual(['Activo', 'Inactivo']);
    expect(estado).toHaveValue('inactive');
    submeter('Guardar alteracoes');
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'Rui Lopes', status: 'inactive', create_access: false, skills: [], schedule: [] }));
  });

  it('cargo_anterior_fora_da_lista_aparece_como_cargo_anterior', () => {
    montar({ member: { ...COLABORADORES[0], role: 'Mecanico' } });
    expect(screen.getByText('Mecanico (cargo anterior)')).toBeInTheDocument();
  });

  it('competencias_acrescentam_com_Enter_sem_duplicar_nem_vazias_e_removem', () => {
    const { onSave } = montar();
    const campo = screen.getByPlaceholderText('Escrever competencia + Enter');
    fireEvent.change(campo, { target: { value: 'PADI' } });
    fireEvent.keyDown(campo, { key: 'Enter' });
    expect(campo).toHaveValue('');
    fireEvent.change(campo, { target: { value: 'PADI' } });
    fireEvent.keyDown(campo, { key: 'Enter' });
    fireEvent.change(campo, { target: { value: '   ' } });
    fireEvent.keyDown(campo, { key: 'Enter' });
    fireEvent.change(campo, { target: { value: 'CPR' } });
    fireEvent.keyDown(campo, { key: 'Enter' });
    expect(screen.getAllByText('PADI')).toHaveLength(1);
    fireEvent.click(within(screen.getByText('CPR').closest('span')).getByRole('button'));
    expect(screen.queryByText('CPR')).toBeNull();
    fireEvent.change(nome(), { target: { value: 'X' } });
    submeter();
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ skills: ['PADI'] }));
  });

  it('dias_do_horario_alternam_e_vao_no_pedido', () => {
    const { onSave } = montar();
    ['Seg', 'Qua', 'Sex'].forEach(d => fireEvent.click(screen.getByRole('button', { name: d })));
    fireEvent.click(screen.getByRole('button', { name: 'Qua' }));
    fireEvent.change(nome(), { target: { value: 'X' } });
    submeter();
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ schedule: ['Seg', 'Sex'] }));
  });

  it('ao_editar_skills_e_schedule_arrancam_vazios', () => {
    const { onSave } = montar({ member: { ...COLABORADORES[0], skills: ['PADI'], schedule: ['Seg'] } });
    expect(screen.queryByText('PADI')).toBeNull();
    submeter('Guardar alteracoes');
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ skills: [], schedule: [] }));
  });

  it('vendedor_mostra_comissao_zona_e_os_tours_e_envia_os_valores', async () => {
    const { onSave } = montar();
    expect(screen.queryByText('Configuracao do Vendedor de Praia')).toBeNull();
    expect(listUnits).not.toHaveBeenCalled();
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'Vendedor de Praia' } });
    expect(await screen.findByText('Configuracao do Vendedor de Praia')).toBeInTheDocument();
    expect(await screen.findByText('Buggy Tour')).toBeInTheDocument();
    expect(listUnits).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Tours que pode vender (todos)')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Buggy Tour'));
    expect(screen.getByText('Tours que pode vender (1 seleccionado(s))')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Ex: 10'), { target: { value: '12' } });
    const zona = screen.getAllByRole('combobox')[1];
    expect(Array.from(zona.options).map(o => o.textContent)[0]).toBe('Todas as zonas');
    fireEvent.change(zona, { target: { value: 'Espargos' } });
    fireEvent.change(nome(), { target: { value: 'Zeca' } });
    submeter();
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ role: 'Vendedor de Praia', commission_pct: 12, seller_zone: 'Espargos', seller_tour_ids: ['u1'] }));
    /* dois tours seleccionados e um removido */
    fireEvent.click(screen.getByText('Quad'));
    fireEvent.click(screen.getByText('Buggy Tour'));
    submeter();
    expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ seller_tour_ids: ['u2'] }));
  });

  it('comissao_zero_vai_como_numero_e_listUnits_a_falhar_nao_rebenta', async () => {
    listUnits.mockRejectedValue(new Error('x'));
    const { onSave } = montar();
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'Vendedor de Praia' } });
    const comissao = await screen.findByPlaceholderText('Ex: 10');
    fireEvent.change(comissao, { target: { value: '0' } });
    fireEvent.change(nome(), { target: { value: 'Zeca' } });
    submeter();
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ commission_pct: 0 }));
  });

  it('criar_conta_com_o_interruptor_mostra_o_aviso_e_vai_no_pedido', () => {
    const { onSave } = montar();
    expect(screen.queryByText(/Sera criada uma conta de acesso/)).toBeNull();
    fireEvent.click(interruptor());
    expect(screen.getByText(/Sera criada uma conta de acesso/)).toBeInTheDocument();
    fireEvent.change(nome(), { target: { value: 'X' } });
    submeter();
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ create_access: true }));
    fireEvent.click(interruptor());
    expect(screen.queryByText(/Sera criada uma conta de acesso/)).toBeNull();
  });

  it('erro_loading_e_cancelar', () => {
    const { onCancel } = montar({ error: 'Erro ao guardar', loading: true });
    expect(screen.getByText('Erro ao guardar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Criar colaborador/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('foto_escolhida_mostra_a_pre_visualizacao_e_vai_no_pedido', async () => {
    vi.stubGlobal('FileReader', class {
      readAsDataURL() { this.result = 'data:image/png;base64,AAA'; this.onloadend(); }
    });
    const { onSave, container } = montar();
    const ficheiro = container.querySelector('input[type="file"]');
    fireEvent.change(ficheiro, { target: { files: [new File(['x'], 'f.png', { type: 'image/png' })] } });
    await waitFor(() => expect(container.querySelector('img')).toHaveAttribute('src', 'data:image/png;base64,AAA'));
    fireEvent.change(nome(), { target: { value: 'X' } });
    submeter();
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ photo_url: 'data:image/png;base64,AAA' }));
  });
});

describe('StaffForm: cargos por tipo de operador (na pagina)', () => {
  it.each([
    ['activity', 'Guia'], ['hotel', 'Recepcionista'], ['rentacar', 'Mecanico'], ['restaurant', 'Garcom'],
    ['outro', 'Administracao'], [undefined, 'Administracao'],
  ])('tipo_%s_comeca_em_%s', async (tipo, primeiro) => {
    useAuthStore.setState({ token: 'tok', operator: { id: 'op1', operator_type: tipo, plan: 'business' } });
    listStaff.mockReset().mockResolvedValue(COLABORADORES);
    listSellerCommissions.mockReset().mockResolvedValue([]);
    getUnreadCount.mockReset().mockResolvedValue(0);
    render(<MemoryRouter future={FUTURE}><Staff /></MemoryRouter>);
    await screen.findByText('Rui Lopes');
    fireEvent.click(screen.getByRole('button', { name: /Novo colaborador/ }));
    const cargo = within(screen.getByRole('dialog')).getAllByRole('combobox')[0];
    expect(cargo).toHaveValue(primeiro);
    expect(Array.from(cargo.options).map(o => o.value).slice(-2)).toEqual(['Administracao', 'Gestor/Supervisor']);
  });
});

/* ───────────────────────── design system ───────────────────────── */

describe('StaffForm com o design system', () => {
  it('os_campos_tem_nome_acessivel', async () => {
    montar({ member: COLABORADORES[0] });
    ['Nome completo', 'Cargo', 'Estado', 'Telefone', 'Email', 'WhatsApp', 'Data de admissao', 'Competencias e certificacoes']
      .forEach(r => expect(screen.getByLabelText(r)).toBeInTheDocument());
    cleanup();
    montar();
    fireEvent.change(screen.getByLabelText('Cargo'), { target: { value: 'Vendedor de Praia' } });
    expect(await screen.findByLabelText('Comissao (%)')).toBeInTheDocument();
    expect(screen.getByLabelText('Zona de actuacao')).toBeInTheDocument();
  });

  it('o_interruptor_e_o_Toggle_do_design_system', () => {
    montar();
    const raiz = screen.getByText('Criar conta /staff').parentElement.parentElement;
    expect(raiz.className).toContain('gap-4');
  });

  it('nenhum_campo_escrito_a_mao', async () => {
    const { container } = montar();
    fireEvent.change(screen.getByLabelText('Cargo'), { target: { value: 'Vendedor de Praia' } });
    await screen.findByLabelText('Comissao (%)');
    const soltos = [...container.querySelectorAll('input:not([type="file"]), select, textarea')].filter(e => !e.className.includes('app:bg-white'));
    expect(soltos).toHaveLength(0);
  });

  it('sem_hexadecimais_cores_nomeadas_ou_text_error_nem_com_o_vendedor_e_o_erro', async () => {
    const { container } = montar({ error: 'Erro ao guardar' });
    fireEvent.change(screen.getByLabelText('Cargo'), { target: { value: 'Vendedor de Praia' } });
    await screen.findByLabelText('Comissao (%)');
    const html = container.innerHTML;
    expect(html).not.toMatch(HEX);
    expect(html).not.toMatch(NOMEADAS);
    expect(html).not.toMatch(/sand-(?:700|200)/);
    expect(html.replace(/text-error ml-0[.]5/g, '')).not.toMatch(/(?:text|bg|border)-error/);
  });
});
