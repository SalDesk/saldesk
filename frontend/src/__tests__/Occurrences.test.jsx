import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Occurrences from '../pages/Occurrences';
import { listOccurrences, createOccurrence, updateOccurrence, deleteOccurrence } from '../services/occurrencesService';
import { listUnits } from '../services/unitsService';
import { listStaff } from '../services/staffService';
import useUiStore from '../store/uiStore';
import { portuguesNoEcra, chavesCruas } from './helpers/portuguesNoEcra';

/* Sem rede: so os servicos da pagina sao simulados */
vi.mock('../services/occurrencesService', () => ({
  listOccurrences: vi.fn(),
  createOccurrence: vi.fn(),
  updateOccurrence: vi.fn(),
  deleteOccurrence: vi.fn(),
}));
vi.mock('../services/unitsService', () => ({ listUnits: vi.fn() }));
vi.mock('../services/staffService', () => ({ listStaff: vi.fn() }));

const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };
const HOJE = new Date().toISOString().slice(0, 10);

/* "Este mês" usa a hora de agora (sem folga de dias): as do mes ficam a minutos de agora; as outras ficam a 40 e 60 dias */
function ha(minutos) { return new Date(Date.now() - minutos * 60000).toISOString(); }
function haDias(dias) { return new Date(Date.now() - dias * 86400000).toISOString(); }

const O1 = { id: 'o1', type: 'acidente', severity: 'critica', description: 'Queda de turista', unit_name: 'Buggy Tour', staff_name: 'Rui',
  actions_taken: 'Chamada ambulancia', created_at: ha(1), date: HOJE, resolved_at: null };
const O2 = { id: 'o2', type: 'atraso', severity: 'media', description: 'Atraso do transfer', unit_name: '', staff_name: '',
  actions_taken: '', created_at: ha(2), date: HOJE };
const O4 = { id: 'o4', type: 'incidente', severity: 'critica', description: 'Cortes leves', unit_name: 'Mergulho', staff_name: 'Ana',
  actions_taken: 'Penso', created_at: ha(3), date: HOJE, resolved_at: haDias(0) };
const O3 = { id: 'o3', type: 'reclamacao', severity: 'alta', description: 'Cliente reclamou', unit_name: 'Mergulho', staff_name: 'Ana',
  actions_taken: 'Pedido de desculpa', created_at: haDias(40), date: haDias(40).slice(0, 10) };
const O5 = { id: 'o5', type: 'mau_tempo', severity: 'baixa', description: 'Vento forte', unit_name: 'Buggy Tour', staff_name: 'Rui',
  actions_taken: '', created_at: haDias(60), date: haDias(60).slice(0, 10) };
const TODAS = [O3, O5, O1, O2, O4];

const UNIDADES = [{ id: 'u1', name: 'Buggy Tour' }, { id: 'u2', name: 'Mergulho' }];
const COLABORADORES = [{ id: 's1', name: 'Rui' }, { id: 's2', name: 'Ana' }];

describe('Occurrences', () => {
  let errSpy;
  let warnSpy;

  beforeEach(() => {
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    listOccurrences.mockReset().mockResolvedValue(TODAS);
    listUnits.mockReset().mockResolvedValue(UNIDADES);
    listStaff.mockReset().mockResolvedValue(COLABORADORES);
    createOccurrence.mockReset().mockImplementation(async (dados) => ({ id: 'novo', ...dados }));
    updateOccurrence.mockReset().mockImplementation(async (id, dados) => ({ ...TODAS.find(o => o.id === id), ...dados }));
    deleteOccurrence.mockReset().mockResolvedValue({});
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
    render(
      <MemoryRouter future={FUTURE}>
        <Occurrences />
      </MemoryRouter>
    );
    await screen.findByRole('table');
  }

  function linhas() {
    return within(screen.getByRole('table')).getAllByRole('row').slice(1);
  }
  function celulas(linha) {
    return within(linha).getAllByRole('cell').map(c => c.textContent);
  }
  function descricoes() {
    return linhas().map(l => celulas(l)[5]);
  }
  function campo(dialogo, etiqueta) {
    const label = within(dialogo).getAllByText(etiqueta).find(e => e.tagName === 'LABEL');
    expect(label).toBeTruthy();
    return label.nextElementSibling;
  }
  function kpi(rotulo) {
    return screen.getByText(rotulo).closest('article').querySelector('p.font-display').textContent;
  }

  it('lista as ocorrências da mais recente para a mais antiga, com as colunas', async () => {
    await abre();
    const cab = within(screen.getByRole('table')).getAllByRole('columnheader').map(c => c.textContent);
    expect(cab).toEqual(['Data', 'Tipo', 'Severidade', 'Tour', 'Colaborador', 'Descrição', 'Acções tomadas', '']);
    expect(descricoes()).toEqual(['Queda de turista', 'Atraso do transfer', 'Cortes leves', 'Cliente reclamou', 'Vento forte']);
    const c1 = celulas(linhas()[0]);
    expect(c1.slice(1, 7)).toEqual(['Acidente', 'Crítica', 'Buggy Tour', 'Rui', 'Queda de turista', 'Chamada ambulancia']);
  });

  it('campos em falta mostram travessao e "Não registadas"', async () => {
    await abre();
    const c2 = celulas(linhas()[1]);
    expect(c2.slice(1, 7)).toEqual(['Atraso', 'Média', '—', '—', 'Atraso do transfer', 'Não registadas']);
  });

  it('os KPIs contam total, este mês, alta ou crítica e críticas', async () => {
    await abre();
    expect(kpi('Total registadas')).toBe('5');
    expect(kpi('Este mês')).toBe('3');
    expect(kpi('Alta / Crítica')).toBe('3');
    expect(kpi('Críticas')).toBe('2');
  });

  it('o aviso de críticas só conta as recentes e não resolvidas', async () => {
    await abre();
    expect(screen.getByText('1 ocorrência(s) crítica(s) não resolvida(s)')).toBeInTheDocument();
    const aviso = screen.getByText('1 ocorrência(s) crítica(s) não resolvida(s)').parentElement;
    expect(within(aviso).getByText('Queda de turista')).toBeInTheDocument();
  });

  it('sem críticas não ha aviso', async () => {
    listOccurrences.mockResolvedValue([O2, O3]);
    await abre();
    expect(screen.queryByText(/crítica\(s\) não resolvida/)).not.toBeInTheDocument();
  });

  it('o relatório mensal conta por tipo e por severidade e o total do mês', async () => {
    await abre();
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const agora = new Date();
    const cartao = screen.getByText(`Relatório mensal — ${meses[agora.getMonth()]} ${agora.getFullYear()}`).parentElement;
    expect(within(cartao).getByText('Por tipo')).toBeInTheDocument();
    for (const t of ['Acidente', 'Atraso', 'Incidente']) expect(within(cartao).getByText(t)).toBeInTheDocument();
    expect(within(cartao).queryByText('Mau tempo')).not.toBeInTheDocument();
    expect(within(cartao).getByText('Média')).toBeInTheDocument();
    expect(within(cartao).getByText('Crítica')).toBeInTheDocument();
    expect(within(cartao).getByText('3', { selector: 'span.font-semibold' })).toBeInTheDocument();
  });

  it('sem ocorrências este mês o relatório di-lo', async () => {
    listOccurrences.mockResolvedValue([O3, O5]);
    await abre();
    expect(screen.getByText('Sem ocorrências registadas este mês.')).toBeInTheDocument();
  });

  it('o filtro de tipo mostra só esse tipo e "Todos" repoe', async () => {
    await abre();
    fireEvent.click(screen.getByRole('button', { name: 'Atraso' }));
    expect(descricoes()).toEqual(['Atraso do transfer']);
    fireEvent.click(screen.getByRole('button', { name: 'Todos' }));
    expect(descricoes()).toHaveLength(5);
  });

  it('a severidade liga-se e desliga-se ao clicar outra vez', async () => {
    await abre();
    fireEvent.click(screen.getByRole('button', { name: 'Crítica' }));
    expect(descricoes()).toEqual(['Queda de turista', 'Cortes leves']);
    fireEvent.click(screen.getByRole('button', { name: 'Alta' }));
    expect(descricoes()).toEqual(['Cliente reclamou']);
    fireEvent.click(screen.getByRole('button', { name: 'Alta' }));
    expect(descricoes()).toHaveLength(5);
  });

  it('a pesquisa procura na descrição, no tour e no colaborador', async () => {
    await abre();
    const campoPesquisa = screen.getByPlaceholderText('Pesquisar descrição, tour, colaborador...');
    fireEvent.change(campoPesquisa, { target: { value: 'vento' } });
    expect(descricoes()).toEqual(['Vento forte']);
    fireEvent.change(campoPesquisa, { target: { value: 'mergulho' } });
    expect(descricoes()).toEqual(['Cortes leves', 'Cliente reclamou']);
    fireEvent.change(campoPesquisa, { target: { value: 'rui' } });
    expect(descricoes()).toEqual(['Queda de turista', 'Vento forte']);
  });

  it('registar chama createOccurrence com o formulário e os nomes, e a ocorrência entra na lista', async () => {
    await abre();
    fireEvent.click(screen.getByRole('button', { name: 'Registar ocorrência' }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('Registar ocorrência')).toBeInTheDocument();
    expect(campo(dialogo, 'Data da ocorrência').value).toBe(HOJE);
    expect(campo(dialogo, 'Tipo').value).toBe('incidente');
    expect(campo(dialogo, 'Severidade').value).toBe('media');
    expect([...campo(dialogo, 'Tour / Serviço').options].map(o => o.textContent)).toEqual(['Não associado a tour específico', 'Buggy Tour', 'Mergulho']);
    fireEvent.change(campo(dialogo, 'Tipo'), { target: { value: 'acidente' } });
    fireEvent.change(campo(dialogo, 'Severidade'), { target: { value: 'alta' } });
    fireEvent.change(campo(dialogo, 'Tour / Serviço'), { target: { value: 'u1' } });
    fireEvent.change(campo(dialogo, 'Colaborador / Guia responsável'), { target: { value: 's1' } });
    fireEvent.change(campo(dialogo, 'Descrição da ocorrência'), { target: { value: 'Teste novo' } });
    fireEvent.change(campo(dialogo, 'Acções tomadas'), { target: { value: 'Feito' } });
    fireEvent.change(campo(dialogo, 'URLs de fotos (separadas por virgula)'), { target: { value: 'https://a.jpg' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Registar' }));
    await waitFor(() => expect(createOccurrence).toHaveBeenCalledTimes(1));
    expect(createOccurrence).toHaveBeenCalledWith({
      unit_id: 'u1', type: 'acidente', severity: 'alta', description: 'Teste novo', staff_id: 's1',
      photo_urls: 'https://a.jpg', actions_taken: 'Feito', date: HOJE, unit_name: 'Buggy Tour', staff_name: 'Rui',
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(descricoes()).toContain('Teste novo');
    expect(kpi('Total registadas')).toBe('6');
  });

  it('se gravar falhar mostra o erro no modal', async () => {
    createOccurrence.mockRejectedValueOnce(new Error('rede'));
    await abre();
    fireEvent.click(screen.getByRole('button', { name: 'Registar ocorrência' }));
    const dialogo = await screen.findByRole('dialog');
    fireEvent.change(campo(dialogo, 'Descrição da ocorrência'), { target: { value: 'X' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Registar' }));
    expect(await within(dialogo).findByText('Erro ao guardar ocorrência.')).toBeInTheDocument();
  });

  it('editar abre o formulário preenchido e chama updateOccurrence com o id', async () => {
    await abre();
    fireEvent.click(within(linhas()[0]).getAllByRole('button')[0]);
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('Editar ocorrência')).toBeInTheDocument();
    expect(campo(dialogo, 'Descrição da ocorrência').value).toBe('Queda de turista');
    expect(campo(dialogo, 'Tipo').value).toBe('acidente');
    expect(campo(dialogo, 'Severidade').value).toBe('critica');
    fireEvent.change(campo(dialogo, 'Descrição da ocorrência'), { target: { value: 'Queda leve' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(updateOccurrence).toHaveBeenCalledTimes(1));
    expect(updateOccurrence).toHaveBeenCalledWith('o1', expect.objectContaining({
      description: 'Queda leve', type: 'acidente', severity: 'critica', actions_taken: 'Chamada ambulancia',
    }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(descricoes()).toContain('Queda leve');
    expect(descricoes()).toHaveLength(5);
  });

  it('eliminar pede confirmação: cancelar não apaga e confirmar apaga e tira a linha', async () => {
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await abre();
    fireEvent.click(within(linhas()[0]).getAllByRole('button')[1]);
    expect(confirmar).toHaveBeenCalledWith('Eliminar esta ocorrência?');
    expect(deleteOccurrence).not.toHaveBeenCalled();
    expect(descricoes()).toHaveLength(5);
    confirmar.mockReturnValue(true);
    fireEvent.click(within(linhas()[0]).getAllByRole('button')[1]);
    await waitFor(() => expect(deleteOccurrence).toHaveBeenCalledWith('o1'));
    await waitFor(() => expect(descricoes()).not.toContain('Queda de turista'));
  });

  it('o tipo e a severidade são grupos de botões com aria-pressed', async () => {
    await abre();
    expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Atraso' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Atraso' }));
    expect(screen.getByRole('button', { name: 'Atraso' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Crítica' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Crítica' }));
    expect(screen.getByRole('button', { name: 'Crítica' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Crítica' }));
    expect(screen.getByRole('button', { name: 'Crítica' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('os botões de editar e eliminar de cada linha tem nome acessível', async () => {
    await abre();
    for (const l of linhas()) {
      expect(within(l).getByRole('button', { name: 'Editar' })).toBeInTheDocument();
      expect(within(l).getByRole('button', { name: 'Eliminar' })).toBeInTheDocument();
    }
  });

  it('nenhuma cor em hexadecimal, inline ou nomeada sobra no HTML', async () => {
    await abre();
    const html = document.body.innerHTML;
    expect(html).not.toContain('[#');
    expect(html).not.toMatch(/style="[^"]*color/);
    expect(html).not.toMatch(/(?:text|bg|border)-(?:red|orange|yellow)-\d/);
    fireEvent.click(screen.getByRole('button', { name: 'Registar ocorrência' }));
    await screen.findByRole('dialog');
    expect(document.body.innerHTML).not.toContain('[#');
  });

  it('sem ocorrências mostra o vazio com a ação; com filtros sem resultado, só o texto', async () => {
    listOccurrences.mockResolvedValue([]);
    render(
      <MemoryRouter future={FUTURE}>
        <Occurrences />
      </MemoryRouter>
    );
    expect(await screen.findByText('Registe a primeira ocorrência quando necessário.')).toBeInTheDocument();
    expect(screen.getByText('Sem ocorrências')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Registar ocorrência' })).toHaveLength(2);
    cleanup();
    listOccurrences.mockResolvedValue(TODAS);
    await abre();
    fireEvent.change(screen.getByPlaceholderText('Pesquisar descrição, tour, colaborador...'), { target: { value: 'zzz' } });
    expect(screen.getByText('Nenhuma ocorrência corresponde aos filtros aplicados.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Registar ocorrência' })).toHaveLength(1);
  });

  it('serviços a falhar não rebentam', async () => {
    listOccurrences.mockRejectedValue(new Error('rede'));
    listUnits.mockRejectedValue(new Error('rede'));
    listStaff.mockRejectedValue(new Error('rede'));
    render(
      <MemoryRouter future={FUTURE}>
        <Occurrences />
      </MemoryRouter>
    );
    expect(await screen.findByText('Sem ocorrências')).toBeInTheDocument();
  });
});

/* ───────────────────────── Estilo Mare ───────────────────────── */

describe('Occurrences no estilo Mare', () => {
  beforeEach(() => {
    useUiStore.setState({ lang: 'pt' });
    listOccurrences.mockReset().mockResolvedValue(TODAS);
    listUnits.mockReset().mockResolvedValue(UNIDADES);
    listStaff.mockReset().mockResolvedValue(COLABORADORES);
  });
  afterEach(() => cleanup());

  async function abreMare() {
    render(
      <MemoryRouter future={FUTURE}>
        <Occurrences />
      </MemoryRouter>
    );
    await screen.findByRole('table');
  }
  function primeiraLinha() {
    return within(screen.getByRole('table')).getAllByRole('row')[1];
  }

  it('o cabecalho traz o eyebrow Clientes', async () => {
    await abreMare();
    expect(document.querySelector('[data-eyebrow]')).toHaveTextContent('Clientes');
  });

  it('os quatro quadros de numeros sao MareStat com os mesmos valores', async () => {
    await abreMare();
    const valores = ['Total registadas', 'Este mês', 'Alta / Crítica', 'Críticas'].map(r => {
      const q = screen.getByText(r).closest('article');
      expect(q).toHaveClass('bg-white', 'border', 'border-mare-card', 'rounded-[18px]');
      return q.querySelector('p.font-display').textContent;
    });
    expect(valores).toEqual(['5', '3', '3', '2']);
  });

  it('tipo e severidade na tabela sao selos Badge sem serem botoes', async () => {
    await abreMare();
    const linha = primeiraLinha();
    const tipo = within(linha).getByText('Acidente');
    const sev = within(linha).getByText('Crítica');
    for (const selo of [tipo, sev]) {
      expect(selo.tagName).toBe('SPAN');
      expect(selo.className).toContain('app:rounded-full');
      expect(selo.closest('button')).toBeNull();
    }
  });

  it('a escala de severidade e neutra, oceano, areia, vermelho', async () => {
    await abreMare();
    const cores = {};
    for (const nome of ['Baixa', 'Média', 'Alta', 'Crítica']) {
      const selo = screen.getAllByText(nome).find(e => e.tagName === 'SPAN' && e.className.includes('app:rounded-full'));
      cores[nome] = selo ? selo.className : null;
    }
    expect(cores['Baixa']).toContain('app:bg-n-100');
    expect(cores['Média']).toContain('app:bg-ocean-100');
    expect(cores['Alta']).toContain('app:bg-sand-100');
    expect(cores['Crítica']).toContain('app:bg-[var(--error-light)]');
  });

  it('a tabela fica num cartao Mare, com a data em font-mono', async () => {
    await abreMare();
    const cartao = screen.getByRole('table').closest('.border-mare-card');
    expect(cartao).toHaveClass('bg-white', 'border', 'border-mare-card', 'rounded-[18px]');
    const data = within(primeiraLinha()).getAllByRole('cell')[0].firstElementChild;
    expect(data).toHaveClass('font-mono', 'tabular-nums');
  });

  it('o relatorio mensal e o aviso de criticas usam cartoes Mare', async () => {
    await abreMare();
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const agora = new Date();
    const cartao = screen.getByText(`Relatório mensal — ${meses[agora.getMonth()]} ${agora.getFullYear()}`).parentElement;
    expect(cartao).toHaveClass('bg-white', 'border', 'border-mare-card', 'rounded-[18px]');
    const titulo = within(cartao).getByRole('heading');
    expect(titulo).toHaveClass('font-display', 'text-lg', 'font-semibold', 'text-ocean-900');
    const aviso = screen.getByText('1 ocorrência(s) crítica(s) não resolvida(s)').parentElement.parentElement;
    expect(aviso).toHaveClass('rounded-[14px]');
  });

  it('o modal agrupa os campos em caixas internas Mare', async () => {
    await abreMare();
    fireEvent.click(screen.getByRole('button', { name: 'Registar ocorrência' }));
    const dialogo = await screen.findByRole('dialog');
    const caixas = [...dialogo.querySelectorAll('form > div')].filter(c => c.classList.contains('rounded-[14px]'));
    expect(caixas.length).toBeGreaterThanOrEqual(2);
    caixas.forEach(c => expect(c).toHaveClass('border', 'border-mare-card', 'bg-mare-head'));
  });

  it('sem ocorrencias o vazio fica num cartao Mare', async () => {
    listOccurrences.mockResolvedValue([]);
    render(
      <MemoryRouter future={FUTURE}>
        <Occurrences />
      </MemoryRouter>
    );
    const vazio = (await screen.findByText('Sem ocorrências')).closest('.border-mare-card');
    expect(vazio).toHaveClass('bg-white', 'rounded-[18px]');
  });
});

/* ───────────────────────── Painel em ingles ───────────────────────── */

describe('Occurrences em inglês', () => {
  const DADOS = ['Queda de turista', 'Atraso do transfer', 'Cortes leves', 'Cliente reclamou', 'Vento forte', 'Chamada ambulancia',
    'Penso', 'Pedido de desculpa', 'Buggy Tour', 'Mergulho', 'Rui', 'Ana'];

  beforeEach(() => {
    useUiStore.setState({ lang: 'en' });
    listOccurrences.mockReset().mockResolvedValue(TODAS);
    listUnits.mockReset().mockResolvedValue(UNIDADES);
    listStaff.mockReset().mockResolvedValue(COLABORADORES);
    createOccurrence.mockReset().mockImplementation(async (dados) => ({ id: 'novo', ...dados }));
    deleteOccurrence.mockReset().mockResolvedValue({});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    useUiStore.setState({ lang: 'pt' });
  });

  async function abreEmIngles() {
    render(
      <MemoryRouter future={FUTURE}>
        <Occurrences />
      </MemoryRouter>
    );
    await screen.findByRole('table');
  }

  function linhasEn() {
    return within(screen.getByRole('table')).getAllByRole('row').slice(1);
  }
  function campoEn(dialogo, etiqueta) {
    const label = within(dialogo).getAllByText(etiqueta).find(e => e.tagName === 'LABEL');
    expect(label).toBeTruthy();
    return label.nextElementSibling;
  }
  function escolhe(select, rotulo) {
    const opcao = [...select.options].find(o => o.textContent === rotulo);
    expect(opcao).toBeTruthy();
    fireEvent.change(select, { target: { value: opcao.value } });
  }

  it('lista_kpis_relatorio_e_filtros_em_ingles_sem_portugues', async () => {
    await abreEmIngles();
    expect(screen.getByRole('heading', { level: 1, name: 'Incidents' })).toBeInTheDocument();
    expect(screen.getByText('Logging and management of operational incidents')).toBeInTheDocument();
    const cab = within(screen.getByRole('table')).getAllByRole('columnheader').map(c => c.textContent);
    expect(cab).toEqual(['Date', 'Type', 'Severity', 'Tour', 'Staff member', 'Description', 'Actions taken', '']);
    const c1 = within(linhasEn()[0]).getAllByRole('cell').map(c => c.textContent);
    /* data no formato en-GB */
    expect(c1[0]).toBe(new Date(HOJE).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }));
    expect(c1.slice(1, 3)).toEqual(['Accident', 'Critical']);
    expect(within(linhasEn()[1]).getAllByRole('cell').map(c => c.textContent)[6]).toBe('Not recorded');
    const kpi = (rotulo) => screen.getByText(rotulo).closest('article').querySelector('p.font-display').textContent;
    expect(kpi('Total logged')).toBe('5');
    expect(kpi('This month')).toBe('3');
    expect(kpi('High / Critical')).toBe('3');
    expect(kpi('Critical incidents')).toBe('2');
    expect(screen.getByText('1 unresolved critical incident(s)')).toBeInTheDocument();
    const meses = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const agora = new Date();
    const cartao = screen.getByText(`Monthly report — ${meses[agora.getMonth()]} ${agora.getFullYear()}`).parentElement;
    expect(within(cartao).getByText('By type')).toBeInTheDocument();
    expect(within(cartao).getByText('By severity')).toBeInTheDocument();
    expect(cartao.textContent).toContain('Total: 3 incident(s)');
    expect(screen.getByPlaceholderText('Search description, tour, staff member...')).toBeInTheDocument();
    ['All', 'Accident', 'Delay', 'Complaint', 'Incident', 'Bad weather', 'Other', 'Low', 'Medium', 'High', 'Critical']
      .forEach(n => expect(screen.getAllByRole('button', { name: n }).length).toBeGreaterThan(0));
    expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(5);
    expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(5);
    expect(portuguesNoEcra(DADOS)).toEqual([]);
    expect(chavesCruas(['occurrences', 'staff'])).toEqual([]);
  });

  it('registar_em_ingles_escolhe_pelo_rotulo_e_grava_o_valor_de_sempre', async () => {
    await abreEmIngles();
    fireEvent.click(screen.getByRole('button', { name: 'Log incident' }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByRole('heading', { name: 'Log incident' })).toBeInTheDocument();
    expect([...campoEn(dialogo, 'Type').options].map(o => [o.value, o.textContent])).toEqual([
      ['acidente', 'Accident'], ['atraso', 'Delay'], ['reclamacao', 'Complaint'],
      ['incidente', 'Incident'], ['mau_tempo', 'Bad weather'], ['outro', 'Other'],
    ]);
    expect([...campoEn(dialogo, 'Severity').options].map(o => [o.value, o.textContent])).toEqual([
      ['baixa', 'Low'], ['media', 'Medium'], ['alta', 'High'], ['critica', 'Critical'],
    ]);
    expect(campoEn(dialogo, 'Tour / Service').options[0].textContent).toBe('Not linked to a specific tour');
    expect(campoEn(dialogo, 'Staff member / Guide in charge').options[0].textContent).toBe('Not specified');
    expect(campoEn(dialogo, 'Incident date').value).toBe(HOJE);
    expect(portuguesNoEcra(DADOS, dialogo)).toEqual([]);
    expect(chavesCruas(['occurrences'], dialogo)).toEqual([]);
    escolhe(campoEn(dialogo, 'Type'), 'Complaint');
    escolhe(campoEn(dialogo, 'Severity'), 'High');
    fireEvent.change(campoEn(dialogo, 'Incident description'), { target: { value: 'Test' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Log' }));
    await waitFor(() => expect(createOccurrence).toHaveBeenCalledTimes(1));
    expect(createOccurrence.mock.calls[0][0]).toMatchObject({ type: 'reclamacao', severity: 'alta', description: 'Test' });
  });

  it('erro_ao_gravar_e_confirmacao_de_eliminar_em_ingles', async () => {
    createOccurrence.mockRejectedValueOnce(new Error('rede'));
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await abreEmIngles();
    fireEvent.click(within(linhasEn()[0]).getByRole('button', { name: 'Delete' }));
    expect(confirmar).toHaveBeenCalledWith('Delete this incident?');
    fireEvent.click(screen.getByRole('button', { name: 'Log incident' }));
    const dialogo = await screen.findByRole('dialog');
    fireEvent.change(campoEn(dialogo, 'Incident description'), { target: { value: 'X' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Log' }));
    expect(await within(dialogo).findByText('Could not save the incident.')).toBeInTheDocument();
  });

  it('vazios_em_ingles', async () => {
    listOccurrences.mockResolvedValue([]);
    render(
      <MemoryRouter future={FUTURE}>
        <Occurrences />
      </MemoryRouter>
    );
    expect(await screen.findByText('No incidents')).toBeInTheDocument();
    expect(screen.getByText('Log the first incident when needed.')).toBeInTheDocument();
    expect(screen.getByText('No incidents logged this month.')).toBeInTheDocument();
  });
});

describe('Occurrences: a data em português continua igual', () => {
  afterEach(() => cleanup());

  it('a_coluna_da_data_usa_o_formato_pt', async () => {
    useUiStore.setState({ lang: 'pt' });
    listOccurrences.mockReset().mockResolvedValue([O3]);
    listUnits.mockReset().mockResolvedValue([]);
    listStaff.mockReset().mockResolvedValue([]);
    render(
      <MemoryRouter future={FUTURE}>
        <Occurrences />
      </MemoryRouter>
    );
    await screen.findByRole('table');
    const linha = within(screen.getByRole('table')).getAllByRole('row')[1];
    expect(within(linha).getAllByRole('cell')[0].textContent)
      .toBe(new Date(O3.date).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }));
  });
});
