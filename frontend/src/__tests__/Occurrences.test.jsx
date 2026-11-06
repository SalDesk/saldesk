import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Occurrences from '../pages/Occurrences';
import { listOccurrences, createOccurrence, updateOccurrence, deleteOccurrence } from '../services/occurrencesService';
import { listUnits } from '../services/unitsService';
import { listStaff } from '../services/staffService';

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

/* "Este mes" usa a hora de agora (sem folga de dias): as do mes ficam a minutos de agora; as outras ficam a 40 e 60 dias */
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
    return screen.getByText(rotulo).previousElementSibling.textContent;
  }

  it('lista as ocorrencias da mais recente para a mais antiga, com as colunas', async () => {
    await abre();
    const cab = within(screen.getByRole('table')).getAllByRole('columnheader').map(c => c.textContent);
    expect(cab).toEqual(['Data', 'Tipo', 'Severidade', 'Tour', 'Colaborador', 'Descricao', 'Accoes tomadas', '']);
    expect(descricoes()).toEqual(['Queda de turista', 'Atraso do transfer', 'Cortes leves', 'Cliente reclamou', 'Vento forte']);
    const c1 = celulas(linhas()[0]);
    expect(c1.slice(1, 7)).toEqual(['Acidente', 'Critica', 'Buggy Tour', 'Rui', 'Queda de turista', 'Chamada ambulancia']);
  });

  it('campos em falta mostram travessao e "Nao registadas"', async () => {
    await abre();
    const c2 = celulas(linhas()[1]);
    expect(c2.slice(1, 7)).toEqual(['Atraso', 'Media', '—', '—', 'Atraso do transfer', 'Nao registadas']);
  });

  it('os KPIs contam total, este mes, alta ou critica e criticas', async () => {
    await abre();
    expect(kpi('Total registadas')).toBe('5');
    expect(kpi('Este mes')).toBe('3');
    expect(kpi('Alta / Critica')).toBe('3');
    expect(kpi('Criticas')).toBe('2');
  });

  it('o aviso de criticas so conta as recentes e nao resolvidas', async () => {
    await abre();
    expect(screen.getByText('1 ocorrencia(s) critica(s) nao resolvida(s)')).toBeInTheDocument();
    const aviso = screen.getByText('1 ocorrencia(s) critica(s) nao resolvida(s)').parentElement;
    expect(within(aviso).getByText('Queda de turista')).toBeInTheDocument();
  });

  it('sem criticas nao ha aviso', async () => {
    listOccurrences.mockResolvedValue([O2, O3]);
    await abre();
    expect(screen.queryByText(/critica\(s\) nao resolvida/)).not.toBeInTheDocument();
  });

  it('o relatorio mensal conta por tipo e por severidade e o total do mes', async () => {
    await abre();
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const agora = new Date();
    const cartao = screen.getByText(`Relatorio mensal — ${meses[agora.getMonth()]} ${agora.getFullYear()}`).parentElement;
    expect(within(cartao).getByText('Por tipo')).toBeInTheDocument();
    for (const t of ['Acidente', 'Atraso', 'Incidente']) expect(within(cartao).getByText(t)).toBeInTheDocument();
    expect(within(cartao).queryByText('Mau tempo')).not.toBeInTheDocument();
    expect(within(cartao).getByText('Media')).toBeInTheDocument();
    expect(within(cartao).getByText('Critica')).toBeInTheDocument();
    expect(within(cartao).getByText('3', { selector: 'span.font-semibold' })).toBeInTheDocument();
  });

  it('sem ocorrencias este mes o relatorio di-lo', async () => {
    listOccurrences.mockResolvedValue([O3, O5]);
    await abre();
    expect(screen.getByText('Sem ocorrencias registadas este mes.')).toBeInTheDocument();
  });

  it('o filtro de tipo mostra so esse tipo e "Todos" repoe', async () => {
    await abre();
    fireEvent.click(screen.getByRole('button', { name: 'Atraso' }));
    expect(descricoes()).toEqual(['Atraso do transfer']);
    fireEvent.click(screen.getByRole('button', { name: 'Todos' }));
    expect(descricoes()).toHaveLength(5);
  });

  it('a severidade liga-se e desliga-se ao clicar outra vez', async () => {
    await abre();
    fireEvent.click(screen.getByRole('button', { name: 'Critica' }));
    expect(descricoes()).toEqual(['Queda de turista', 'Cortes leves']);
    fireEvent.click(screen.getByRole('button', { name: 'Alta' }));
    expect(descricoes()).toEqual(['Cliente reclamou']);
    fireEvent.click(screen.getByRole('button', { name: 'Alta' }));
    expect(descricoes()).toHaveLength(5);
  });

  it('a pesquisa procura na descricao, no tour e no colaborador', async () => {
    await abre();
    const campoPesquisa = screen.getByPlaceholderText('Pesquisar descricao, tour, colaborador...');
    fireEvent.change(campoPesquisa, { target: { value: 'vento' } });
    expect(descricoes()).toEqual(['Vento forte']);
    fireEvent.change(campoPesquisa, { target: { value: 'mergulho' } });
    expect(descricoes()).toEqual(['Cortes leves', 'Cliente reclamou']);
    fireEvent.change(campoPesquisa, { target: { value: 'rui' } });
    expect(descricoes()).toEqual(['Queda de turista', 'Vento forte']);
  });

  it('registar chama createOccurrence com o formulario e os nomes, e a ocorrencia entra na lista', async () => {
    await abre();
    fireEvent.click(screen.getByRole('button', { name: 'Registar ocorrencia' }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('Registar ocorrencia')).toBeInTheDocument();
    expect(campo(dialogo, 'Data da ocorrencia').value).toBe(HOJE);
    expect(campo(dialogo, 'Tipo').value).toBe('incidente');
    expect(campo(dialogo, 'Severidade').value).toBe('media');
    expect([...campo(dialogo, 'Tour / Servico').options].map(o => o.textContent)).toEqual(['Nao associado a tour especifico', 'Buggy Tour', 'Mergulho']);
    fireEvent.change(campo(dialogo, 'Tipo'), { target: { value: 'acidente' } });
    fireEvent.change(campo(dialogo, 'Severidade'), { target: { value: 'alta' } });
    fireEvent.change(campo(dialogo, 'Tour / Servico'), { target: { value: 'u1' } });
    fireEvent.change(campo(dialogo, 'Colaborador / Guia responsavel'), { target: { value: 's1' } });
    fireEvent.change(campo(dialogo, 'Descricao da ocorrencia'), { target: { value: 'Teste novo' } });
    fireEvent.change(campo(dialogo, 'Accoes tomadas'), { target: { value: 'Feito' } });
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
    fireEvent.click(screen.getByRole('button', { name: 'Registar ocorrencia' }));
    const dialogo = await screen.findByRole('dialog');
    fireEvent.change(campo(dialogo, 'Descricao da ocorrencia'), { target: { value: 'X' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Registar' }));
    expect(await within(dialogo).findByText('Erro ao guardar ocorrencia.')).toBeInTheDocument();
  });

  it('editar abre o formulario preenchido e chama updateOccurrence com o id', async () => {
    await abre();
    fireEvent.click(within(linhas()[0]).getAllByRole('button')[0]);
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('Editar ocorrencia')).toBeInTheDocument();
    expect(campo(dialogo, 'Descricao da ocorrencia').value).toBe('Queda de turista');
    expect(campo(dialogo, 'Tipo').value).toBe('acidente');
    expect(campo(dialogo, 'Severidade').value).toBe('critica');
    fireEvent.change(campo(dialogo, 'Descricao da ocorrencia'), { target: { value: 'Queda leve' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(updateOccurrence).toHaveBeenCalledTimes(1));
    expect(updateOccurrence).toHaveBeenCalledWith('o1', expect.objectContaining({
      description: 'Queda leve', type: 'acidente', severity: 'critica', actions_taken: 'Chamada ambulancia',
    }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(descricoes()).toContain('Queda leve');
    expect(descricoes()).toHaveLength(5);
  });

  it('eliminar pede confirmacao: cancelar nao apaga e confirmar apaga e tira a linha', async () => {
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await abre();
    fireEvent.click(within(linhas()[0]).getAllByRole('button')[1]);
    expect(confirmar).toHaveBeenCalledWith('Eliminar esta ocorrencia?');
    expect(deleteOccurrence).not.toHaveBeenCalled();
    expect(descricoes()).toHaveLength(5);
    confirmar.mockReturnValue(true);
    fireEvent.click(within(linhas()[0]).getAllByRole('button')[1]);
    await waitFor(() => expect(deleteOccurrence).toHaveBeenCalledWith('o1'));
    await waitFor(() => expect(descricoes()).not.toContain('Queda de turista'));
  });

  it('o tipo e a severidade sao grupos de botoes com aria-pressed', async () => {
    await abre();
    expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Atraso' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Atraso' }));
    expect(screen.getByRole('button', { name: 'Atraso' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Critica' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Critica' }));
    expect(screen.getByRole('button', { name: 'Critica' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Critica' }));
    expect(screen.getByRole('button', { name: 'Critica' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('os botoes de editar e eliminar de cada linha tem nome acessivel', async () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Registar ocorrencia' }));
    await screen.findByRole('dialog');
    expect(document.body.innerHTML).not.toContain('[#');
  });

  it('sem ocorrencias mostra o vazio com a acao; com filtros sem resultado, so o texto', async () => {
    listOccurrences.mockResolvedValue([]);
    render(
      <MemoryRouter future={FUTURE}>
        <Occurrences />
      </MemoryRouter>
    );
    expect(await screen.findByText('Registe a primeira ocorrencia quando necessario.')).toBeInTheDocument();
    expect(screen.getByText('Sem ocorrencias')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Registar ocorrencia' })).toHaveLength(2);
    cleanup();
    listOccurrences.mockResolvedValue(TODAS);
    await abre();
    fireEvent.change(screen.getByPlaceholderText('Pesquisar descricao, tour, colaborador...'), { target: { value: 'zzz' } });
    expect(screen.getByText('Nenhuma ocorrencia corresponde aos filtros aplicados.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Registar ocorrencia' })).toHaveLength(1);
  });

  it('servicos a falhar nao rebentam', async () => {
    listOccurrences.mockRejectedValue(new Error('rede'));
    listUnits.mockRejectedValue(new Error('rede'));
    listStaff.mockRejectedValue(new Error('rede'));
    render(
      <MemoryRouter future={FUTURE}>
        <Occurrences />
      </MemoryRouter>
    );
    expect(await screen.findByText('Sem ocorrencias')).toBeInTheDocument();
  });
});
