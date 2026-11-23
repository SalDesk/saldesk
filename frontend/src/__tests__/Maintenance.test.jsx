import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Maintenance from '../pages/Maintenance';
import { listUnits, updateUnit } from '../services/unitsService';
import useUiStore from '../store/uiStore';
import { formatarNumero } from '../utils/formatoLingua';
import { portuguesNoEcra, chavesCruas } from './helpers/portuguesNoEcra';

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
  return screen.queryAllByText(/^(Expirado|Urgente|Atenção)$/).map(e => e.textContent);
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

  it('o subtítulo conta as viaturas e os alertas', async () => {
    await abrePronta();
    expect(screen.getByText('4 viatura(s) · 5 alerta(s)')).toBeInTheDocument();
  });

  it('os alertas vem ordenados por gravidade com o texto de dias ou de km', async () => {
    await abrePronta();
    expect(gravidades()).toEqual(['Expirado', 'Expirado', 'Urgente', 'Urgente', 'Atenção']);
    expect(screen.getByText(/^Seguro — expirado há \d+ dias$/)).toBeInTheDocument();
    expect(screen.getByText('Revisão — atrasada 120km')).toBeInTheDocument();
    expect(screen.getByText('Revisão — em 300km')).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`^Seguro — expira em \\d+ dias \\(${dia(5)}\\)$`))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`^IUC — expira em \\d+ dias \\(${dia(20)}\\)$`))).toBeInTheDocument();
    /* a etiqueta leva a matricula quando existe */
    expect(screen.getAllByText('Hilux 4x4 (AA-11-BB)').length).toBeGreaterThan(0);
  });

  it('os chips filtram os alertas urgentes e os de atenção', async () => {
    await abrePronta();
    fireEvent.click(screen.getByRole('button', { name: 'Urgentes (4)' }));
    expect(gravidades()).toEqual(['Expirado', 'Expirado', 'Urgente', 'Urgente']);
    fireEvent.click(screen.getByRole('button', { name: 'Atenção (1)' }));
    expect(gravidades()).toEqual(['Atenção']);
    fireEvent.click(screen.getByRole('button', { name: 'Todos (5)' }));
    expect(gravidades()).toHaveLength(5);
  });

  it('sem alertas mostra a frota em dia e esconde os chips', async () => {
    await abrePronta([V3, V4]);
    expect(screen.getByText('Sem alertas de documentação. Toda a frota em dia.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Todos/ })).not.toBeInTheDocument();
  });

  it('a tabela de documentação mostra datas, km e próxima revisão', async () => {
    await abrePronta();
    const linhas = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(linhas).toHaveLength(4);
    const c1 = within(linhas[0]).getAllByRole('cell').map(c => c.textContent);
    expect(c1[0]).toBe('Toyota HiluxAA-11-BB');
    expect(c1[1]).toMatch(new RegExp(`^${dia(-3)} \\(-?\\d+d\\)$`));
    expect(c1[2]).toMatch(new RegExp(`^${dia(20)} \\(\\d+d\\)$`));
    expect(c1[3]).toBe(dia(60));
    /* o conta-quilometros segue a lingua do painel (pt: pt-PT) */
    expect(c1[4]).toBe(`${formatarNumero(12000, {}, 'pt')} km`);
    expect(c1[5]).toBe('300km');
    const c2 = within(linhas[1]).getAllByRole('cell').map(c => c.textContent);
    expect(c2[0]).toBe('PandaCC-22-DD');
    expect(c2[5]).toBe('Atrasada 120km');
    /* sem documentos nem km: travessoes */
    const c4 = within(linhas[3]).getAllByRole('cell').map(c => c.textContent);
    expect(c4).toEqual(['Vazia', '—', '—', '—', '—', '—']);
  });

  it('o histórico vem por data decrescente com o total de custo', async () => {
    await abrePronta();
    expect(screen.getAllByText(/^(Revisao|Oleo)$/).map(e => e.textContent)).toEqual(['Revisao', 'Oleo']);
    expect(screen.getByText('€200.50')).toBeInTheDocument();
    expect(screen.getByText('€80.50')).toBeInTheDocument();
    expect(screen.getByText(`Prox: ${dia(100)}`)).toBeInTheDocument();
    /* o separador de milhares do ambiente pode ser um espaco especial; o matcher normaliza o texto da pagina */
    expect(screen.getByText(new RegExp(`^${formatarNumero(11000, {}, 'pt').replace(/\s/g, '\\s')} km$`))).toBeInTheDocument();
    expect(screen.getByText('Troca de oleo')).toBeInTheDocument();
  });

  it('o modal regista a intervenção: grava a descrição com o histórico novo e actualiza o seguro', async () => {
    await abrePronta();
    fireEvent.click(screen.getByRole('button', { name: 'Registar intervenção' }));
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
    expect(campo(dialogo, 'Data realização').value).toBe(HOJE);

    fireEvent.change(campo(dialogo, 'Tipo'), { target: { value: 'Seguro' } });
    fireEvent.change(campo(dialogo, 'Km actuais'), { target: { value: '12500' } });
    fireEvent.change(campo(dialogo, 'Custo (EUR)'), { target: { value: '99.9' } });
    fireEvent.change(campo(dialogo, 'Próxima data'), { target: { value: dia(200) } });
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

  it('uma revisão com próxima revisão (km) actualiza next_revision_km e deixa os documentos', async () => {
    await abrePronta();
    fireEvent.click(screen.getByRole('button', { name: 'Registar intervenção' }));
    const dialogo = await screen.findByRole('dialog');
    fireEvent.change(campo(dialogo, 'Viatura'), { target: { value: 'v2' } });
    fireEvent.change(campo(dialogo, 'Próxima revisão (km)'), { target: { value: '30000' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Registar' }));
    await waitFor(() => expect(updateUnit).toHaveBeenCalledTimes(1));
    const meta = JSON.parse(updateUnit.mock.calls[0][1].description);
    expect(meta.next_revision_km).toBe('30000');
    expect(meta.seguro_expiry).toBe(dia(5));
    expect(meta.current_km).toBe(20000);
  });

  it('cancelar fecha o modal sem gravar', async () => {
    await abrePronta();
    fireEvent.click(screen.getByRole('button', { name: 'Registar intervenção' }));
    const dialogo = await screen.findByRole('dialog');
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(updateUnit).not.toHaveBeenCalled();
  });

  it('descrição invalida ou vazia não rebenta e a viatura aparece na tabela', async () => {
    await abrePronta([V3, V4]);
    const linhas = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(linhas.map(l => within(l).getAllByRole('cell')[0].textContent)).toEqual(['Quebrada', 'Vazia']);
  });

  it('sem histórico mostra o vazio do histórico', async () => {
    await abrePronta([V3]);
    expect(screen.getByText('Nenhuma intervenção registada.')).toBeInTheDocument();
  });

  it('nenhuma cor em hexadecimal sobra no HTML (alertas, tabela, histórico, modal)', async () => {
    await abrePronta();
    expect(document.body.innerHTML).not.toContain('[#');
    fireEvent.click(screen.getByRole('button', { name: 'Registar intervenção' }));
    await screen.findByRole('dialog');
    expect(document.body.innerHTML).not.toContain('[#');
    cleanup();
    await abrePronta([V3, V4]);
    expect(document.body.innerHTML).not.toContain('[#');
  });

  it('serviços a falhar não rebentam: página vazia', async () => {
    listUnits.mockReset().mockRejectedValue(new Error('rede'));
    render(
      <MemoryRouter future={FUTURE}>
        <Maintenance />
      </MemoryRouter>
    );
    expect(await screen.findByText('0 viatura(s) · 0 alerta(s)')).toBeInTheDocument();
    expect(screen.getByText('Sem alertas de documentação. Toda a frota em dia.')).toBeInTheDocument();
    expect(screen.getByText('Nenhuma intervenção registada.')).toBeInTheDocument();
  });
});

/* ───────────────────────── Painel em ingles ───────────────────────── */

describe('Maintenance em inglês', () => {
  const DADOS = ['Hilux 4x4', 'Toyota', 'Hilux', 'Panda', 'Quebrada', 'Vazia', 'AA-11-BB', 'CC-22-DD', 'Troca de oleo'];

  beforeEach(() => {
    useUiStore.setState({ lang: 'en' });
    updateUnit.mockReset().mockResolvedValue({});
  });
  afterEach(() => {
    cleanup();
    useUiStore.setState({ lang: 'pt' });
  });

  async function abreEmIngles(units = [V1, V2, V3, V4]) {
    abre(units);
    await screen.findByText(/vehicle\(s\)/);
  }

  function gravidadesEn() {
    return screen.queryAllByText(/^(Expired|Urgent|Due soon)$/).map(e => e.textContent);
  }

  it('alertas_tabela_e_historico_em_ingles_sem_portugues', async () => {
    await abreEmIngles();
    expect(screen.getByRole('heading', { level: 1, name: 'Maintenance' })).toBeInTheDocument();
    expect(screen.getByText('4 vehicle(s) · 5 alert(s)')).toBeInTheDocument();
    expect(gravidadesEn()).toEqual(['Expired', 'Expired', 'Urgent', 'Urgent', 'Due soon']);
    expect(screen.getByText(/^Insurance — expired \d+ days ago$/)).toBeInTheDocument();
    expect(screen.getByText('Service — overdue 120km')).toBeInTheDocument();
    expect(screen.getByText('Service — in 300km')).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`^IUC — expires in \\d+ days \\(${dia(20)}\\)$`))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All (5)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Urgent (4)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Due soon (1)' })).toBeInTheDocument();
    expect(screen.getByText('Document status — fleet')).toBeInTheDocument();
    const cab = within(screen.getByRole('table')).getAllByRole('columnheader').map(c => c.textContent);
    expect(cab).toEqual(['Vehicle', 'Insurance', 'IUC', 'Inspection', 'Current km', 'Next service']);
    const linhas = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    /* o conta-quilometros segue a lingua (en-GB: virgula dos milhares) */
    expect(within(linhas[0]).getAllByRole('cell')[4].textContent).toBe('12,000 km');
    expect(within(linhas[1]).getAllByRole('cell')[5].textContent).toBe('Overdue 120km');
    expect(screen.getByText('Maintenance history')).toBeInTheDocument();
    /* tipos gravados em portugues, mostrados em ingles */
    expect(screen.getAllByText(/^(Service|Oil)$/).map(e => e.textContent)).toEqual(['Service', 'Oil']);
    expect(screen.getByText('11,000 km')).toBeInTheDocument();
    expect(screen.getByText(`Next: ${dia(100)}`)).toBeInTheDocument();
    expect(portuguesNoEcra(DADOS)).toEqual([]);
    expect(chavesCruas(['maintenance'])).toEqual([]);
  });

  it('sem_alertas_e_sem_historico_em_ingles', async () => {
    await abreEmIngles([V3]);
    expect(screen.getByText('No document alerts. The whole fleet is up to date.')).toBeInTheDocument();
    expect(screen.getByText('No maintenance recorded.')).toBeInTheDocument();
  });

  it('registar_em_ingles_grava_o_tipo_portugues_Revisao', async () => {
    await abreEmIngles();
    fireEvent.click(screen.getByRole('button', { name: 'Record maintenance' }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByRole('heading', { name: 'Record maintenance' })).toBeInTheDocument();
    const tipo = campo(dialogo, 'Type');
    expect([...tipo.options].map(o => [o.value, o.textContent])).toEqual([
      ['Revisao', 'Service'], ['Seguro', 'Insurance'], ['IUC', 'IUC'], ['Inspecao', 'Inspection'],
      ['Reparacao', 'Repair'], ['Pneus', 'Tyres'], ['Oleo', 'Oil'], ['Outro', 'Other'],
    ]);
    expect(tipo.value).toBe('Revisao');
    expect(campo(dialogo, 'Vehicle').options[0].textContent).toBe('Select vehicle...');
    ['Date performed', 'Current km', 'Cost (EUR)', 'Next date', 'Next service (km)', 'Replacement vehicle (plate)', 'Notes']
      .forEach(e => expect(campo(dialogo, e)).toBeTruthy());
    expect(campo(dialogo, 'Replacement vehicle (plate)')).toHaveAttribute('placeholder', 'Optional');
    expect(portuguesNoEcra(DADOS, dialogo)).toEqual([]);
    expect(chavesCruas(['maintenance'], dialogo)).toEqual([]);
    fireEvent.change(campo(dialogo, 'Vehicle'), { target: { value: 'v2' } });
    fireEvent.change(campo(dialogo, 'Next service (km)'), { target: { value: '30000' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Record' }));
    await waitFor(() => expect(updateUnit).toHaveBeenCalledTimes(1));
    const meta = JSON.parse(updateUnit.mock.calls[0][1].description);
    expect(meta.maintenance_history[0].tipo).toBe('Revisao');
    expect(meta.next_revision_km).toBe('30000');
  });

  it('escolher_Inspection_pelo_rotulo_grava_Inspecao_e_a_validade', async () => {
    await abreEmIngles();
    fireEvent.click(screen.getByRole('button', { name: 'Record maintenance' }));
    const dialogo = await screen.findByRole('dialog');
    fireEvent.change(campo(dialogo, 'Vehicle'), { target: { value: 'v1' } });
    const tipo = campo(dialogo, 'Type');
    const opcao = [...tipo.options].find(o => o.textContent === 'Inspection');
    fireEvent.change(tipo, { target: { value: opcao.value } });
    fireEvent.change(campo(dialogo, 'Next date'), { target: { value: dia(300) } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Record' }));
    await waitFor(() => expect(updateUnit).toHaveBeenCalledTimes(1));
    const meta = JSON.parse(updateUnit.mock.calls[0][1].description);
    expect(meta.maintenance_history[0].tipo).toBe('Inspecao');
    expect(meta.inspecao_expiry).toBe(dia(300));
  });

  it('um_tipo_desconhecido_no_historico_mostra_se_tal_e_qual', async () => {
    const V5 = viatura('v5', 'Velha', { maintenance_history: [{ id: 9, tipo: 'Lavagem', date: dia(-1) }] });
    await abreEmIngles([V5]);
    expect(screen.getByText('Lavagem')).toBeInTheDocument();
  });
});
