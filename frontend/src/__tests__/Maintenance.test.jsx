import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Maintenance from '../pages/Maintenance';
import { listUnits, updateUnit } from '../services/unitsService';

/* Sem rede: so os servicos da pagina sao simulados */
vi.mock('../services/unitsService', () => ({
  listUnits: vi.fn(),
  updateUnit: vi.fn(),
}));

const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };

/* Datas locais relativas a hoje (a pagina compara com o relogio, por isso as
   margens entre gravidades sao de varios dias) */
function dia(n = 0) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString('en-CA');
}
const HOJE = dia(0);

function viatura(id, name, meta) {
  return { id, name, unit_type: 'vehicle', description: meta === null ? null : typeof meta === 'string' ? meta : JSON.stringify(meta) };
}

/* v1: seguro expirado, IUC em atencao, revisao a 300 km (urgente); v2: seguro urgente, revisao atrasada */
const V1 = viatura('v1', 'Hilux 4x4', {
  brand: 'Toyota', model: 'Hilux', plate: 'AA-11-BB',
  seguro_expiry: dia(-3), iuc_expiry: dia(20), inspecao_expiry: dia(60),
  current_km: 12000, next_revision_km: 12300,
  maintenance_history: [{ id: 1, unit_id: 'v1', tipo: 'Oleo', date: dia(-40), km: '11000', cost: '80.5', notes: 'Troca de oleo' }],
});
const V2 = viatura('v2', 'Panda', {
  plate: 'CC-22-DD', seguro_expiry: dia(5), current_km: 20000, next_revision_km: 19880,
  maintenance_history: [{ id: 2, unit_id: 'v2', tipo: 'Revisao', date: dia(-10), cost: '120', next_date: dia(100) }],
});
const V3 = viatura('v3', 'Quebrada', '{');
const V4 = viatura('v4', 'Vazia', null);

function abre(units = [V1, V2, V3, V4]) {
  listUnits.mockReset().mockResolvedValue(units);
  render(
    <MemoryRouter future={FUTURE}>
      <Maintenance />
    </MemoryRouter>
  );
}

async function abrePronta(units) {
  abre(units);
  await screen.findByText(/viatura\(s\)/);
}

/* O campo de um formulario: o controlo que vem logo a seguir a etiqueta, no mesmo bloco */
function campo(dialogo, etiqueta) {
  const label = within(dialogo).getAllByText(etiqueta).find(e => e.tagName === 'LABEL');
  expect(label).toBeTruthy();
  return label.nextElementSibling;
}

function gravidades() {
  return screen.queryAllByText(/^(Expirado|Urgente|Atencao)$/).map(e => e.textContent);
}

describe('Maintenance', () => {
  let errSpy;
  let warnSpy;

  beforeEach(() => {
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    updateUnit.mockReset().mockResolvedValue({});
  });

  afterEach(() => {
    cleanup();
    expect(errSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('o subtitulo conta as viaturas e os alertas', async () => {
    await abrePronta();
    expect(screen.getByText('4 viatura(s) · 5 alerta(s)')).toBeInTheDocument();
  });

  it('os alertas vem ordenados por gravidade com o texto de dias ou de km', async () => {
    await abrePronta();
    expect(gravidades()).toEqual(['Expirado', 'Expirado', 'Urgente', 'Urgente', 'Atencao']);
    expect(screen.getByText(/^Seguro — expirado ha \d+ dias$/)).toBeInTheDocument();
    expect(screen.getByText('Revisao — atrasada 120km')).toBeInTheDocument();
    expect(screen.getByText('Revisao — em 300km')).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`^Seguro — expira em \\d+ dias \\(${dia(5)}\\)$`))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`^IUC — expira em \\d+ dias \\(${dia(20)}\\)$`))).toBeInTheDocument();
    /* a etiqueta leva a matricula quando existe */
    expect(screen.getAllByText('Hilux 4x4 (AA-11-BB)').length).toBeGreaterThan(0);
  });

  it('os chips filtram os alertas urgentes e os de atencao', async () => {
    await abrePronta();
    fireEvent.click(screen.getByRole('button', { name: 'Urgentes (4)' }));
    expect(gravidades()).toEqual(['Expirado', 'Expirado', 'Urgente', 'Urgente']);
    fireEvent.click(screen.getByRole('button', { name: 'Atencao (1)' }));
    expect(gravidades()).toEqual(['Atencao']);
    fireEvent.click(screen.getByRole('button', { name: 'Todos (5)' }));
    expect(gravidades()).toHaveLength(5);
  });

  it('sem alertas mostra a frota em dia e esconde os chips', async () => {
    await abrePronta([V3, V4]);
    expect(screen.getByText('Sem alertas de documentacao. Toda a frota em dia.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Todos/ })).not.toBeInTheDocument();
  });

  it('a tabela de documentacao mostra datas, km e proxima revisao', async () => {
    await abrePronta();
    const linhas = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(linhas).toHaveLength(4);
    const c1 = within(linhas[0]).getAllByRole('cell').map(c => c.textContent);
    expect(c1[0]).toBe('Toyota HiluxAA-11-BB');
    expect(c1[1]).toMatch(new RegExp(`^${dia(-3)} \\(-?\\d+d\\)$`));
    expect(c1[2]).toMatch(new RegExp(`^${dia(20)} \\(\\d+d\\)$`));
    expect(c1[3]).toBe(dia(60));
    expect(c1[4]).toBe(`${Number(12000).toLocaleString()} km`);
    expect(c1[5]).toBe('300km');
    const c2 = within(linhas[1]).getAllByRole('cell').map(c => c.textContent);
    expect(c2[0]).toBe('PandaCC-22-DD');
    expect(c2[5]).toBe('Atrasada 120km');
    /* sem documentos nem km: travessoes */
    const c4 = within(linhas[3]).getAllByRole('cell').map(c => c.textContent);
    expect(c4).toEqual(['Vazia', '—', '—', '—', '—', '—']);
  });

  it('o historico vem por data decrescente com o total de custo', async () => {
    await abrePronta();
    expect(screen.getAllByText(/^(Revisao|Oleo)$/).map(e => e.textContent)).toEqual(['Revisao', 'Oleo']);
    expect(screen.getByText('€200.50')).toBeInTheDocument();
    expect(screen.getByText('€80.50')).toBeInTheDocument();
    expect(screen.getByText(`Prox: ${dia(100)}`)).toBeInTheDocument();
    /* o separador de milhares do ambiente pode ser um espaco especial; o matcher normaliza o texto da pagina */
    expect(screen.getByText(new RegExp(`^${Number(11000).toLocaleString().replace(/\s/g, '\\s')} km$`))).toBeInTheDocument();
    expect(screen.getByText('Troca de oleo')).toBeInTheDocument();
  });

  it('o modal regista a intervencao: grava a descricao com o historico novo e actualiza o seguro', async () => {
    await abrePronta();
    fireEvent.click(screen.getByRole('button', { name: 'Registar intervencao' }));
    const dialogo = await screen.findByRole('dialog');

    const registar = within(dialogo).getByRole('button', { name: 'Registar' });
    expect(registar).toBeDisabled();

    const viaturaSel = campo(dialogo, 'Viatura');
    expect([...viaturaSel.options].map(o => o.textContent)).toEqual([
      'Seleccionar viatura...', 'Toyota Hilux — AA-11-BB', 'Panda — CC-22-DD', 'Quebrada', 'Vazia',
    ]);
    fireEvent.change(viaturaSel, { target: { value: 'v1' } });
    expect(registar).not.toBeDisabled();

    expect(campo(dialogo, 'Tipo').value).toBe('Revisao');
    expect([...campo(dialogo, 'Tipo').options].map(o => o.textContent)).toEqual(
      ['Revisao', 'Seguro', 'IUC', 'Inspecao', 'Reparacao', 'Pneus', 'Oleo', 'Outro'],
    );
    expect(campo(dialogo, 'Data realizacao').value).toBe(HOJE);

    fireEvent.change(campo(dialogo, 'Tipo'), { target: { value: 'Seguro' } });
    fireEvent.change(campo(dialogo, 'Km actuais'), { target: { value: '12500' } });
    fireEvent.change(campo(dialogo, 'Custo (EUR)'), { target: { value: '99.9' } });
    fireEvent.change(campo(dialogo, 'Proxima data'), { target: { value: dia(200) } });
    fireEvent.change(campo(dialogo, 'Notas'), { target: { value: 'Renovado' } });
    fireEvent.click(registar);

    await waitFor(() => expect(updateUnit).toHaveBeenCalledTimes(1));
    const [id, corpo] = updateUnit.mock.calls[0];
    expect(id).toBe('v1');
    expect(Object.keys(corpo)).toEqual(['description']);
    const meta = JSON.parse(corpo.description);
    expect(meta.brand).toBe('Toyota');
    expect(meta.seguro_expiry).toBe(dia(200));
    expect(meta.current_km).toBe('12500');
    expect(meta.maintenance_history).toHaveLength(2);
    expect(meta.maintenance_history[0]).toEqual({
      unit_id: 'v1', tipo: 'Seguro', date: HOJE, km: '12500', cost: '99.9',
      next_date: dia(200), next_km: '', replacement: '', notes: 'Renovado',
      id: expect.any(Number), created_at: expect.any(String),
    });
    expect(meta.maintenance_history[1].tipo).toBe('Oleo');
    /* depois de gravar recarrega a lista e fecha o modal */
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(listUnits).toHaveBeenCalledTimes(2);
  });

  it('uma revisao com proxima revisao (km) actualiza next_revision_km e deixa os documentos', async () => {
    await abrePronta();
    fireEvent.click(screen.getByRole('button', { name: 'Registar intervencao' }));
    const dialogo = await screen.findByRole('dialog');
    fireEvent.change(campo(dialogo, 'Viatura'), { target: { value: 'v2' } });
    fireEvent.change(campo(dialogo, 'Proxima revisao (km)'), { target: { value: '30000' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Registar' }));
    await waitFor(() => expect(updateUnit).toHaveBeenCalledTimes(1));
    const meta = JSON.parse(updateUnit.mock.calls[0][1].description);
    expect(meta.next_revision_km).toBe('30000');
    expect(meta.seguro_expiry).toBe(dia(5));
    expect(meta.current_km).toBe(20000);
  });

  it('cancelar fecha o modal sem gravar', async () => {
    await abrePronta();
    fireEvent.click(screen.getByRole('button', { name: 'Registar intervencao' }));
    const dialogo = await screen.findByRole('dialog');
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(updateUnit).not.toHaveBeenCalled();
  });

  it('descricao invalida ou vazia nao rebenta e a viatura aparece na tabela', async () => {
    await abrePronta([V3, V4]);
    const linhas = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(linhas.map(l => within(l).getAllByRole('cell')[0].textContent)).toEqual(['Quebrada', 'Vazia']);
  });

  it('sem historico mostra o vazio do historico', async () => {
    await abrePronta([V3]);
    expect(screen.getByText('Nenhuma intervencao registada.')).toBeInTheDocument();
  });

  it('nenhuma cor em hexadecimal sobra no HTML (alertas, tabela, historico, modal)', async () => {
    await abrePronta();
    expect(document.body.innerHTML).not.toContain('[#');
    fireEvent.click(screen.getByRole('button', { name: 'Registar intervencao' }));
    await screen.findByRole('dialog');
    expect(document.body.innerHTML).not.toContain('[#');
    cleanup();
    await abrePronta([V3, V4]);
    expect(document.body.innerHTML).not.toContain('[#');
  });

  it('servicos a falhar nao rebentam: pagina vazia', async () => {
    listUnits.mockReset().mockRejectedValue(new Error('rede'));
    render(
      <MemoryRouter future={FUTURE}>
        <Maintenance />
      </MemoryRouter>
    );
    expect(await screen.findByText('0 viatura(s) · 0 alerta(s)')).toBeInTheDocument();
    expect(screen.getByText('Sem alertas de documentacao. Toda a frota em dia.')).toBeInTheDocument();
    expect(screen.getByText('Nenhuma intervencao registada.')).toBeInTheDocument();
  });
});
