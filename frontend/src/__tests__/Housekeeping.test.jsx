import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Housekeeping from '../pages/Housekeeping';
import { listUnits } from '../services/unitsService';
import { listReservations } from '../services/reservationsService';
import api from '../services/api';

/* Sem rede: so os servicos da pagina sao simulados */
vi.mock('../services/unitsService', () => ({ listUnits: vi.fn(), updateUnit: vi.fn() }));
vi.mock('../services/reservationsService', () => ({ listReservations: vi.fn() }));
vi.mock('../services/api', () => ({ default: { get: vi.fn() } }));

const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };

/* A pagina fixa "hoje" ao carregar o modulo, em hora local */
function dia(n = 0) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString('en-CA');
}
const HOJE = dia(0);

function quarto(id, name, over) {
  return { id, name, unit_type: 'double', capacity: 2, status: 'available', description: null, ...over };
}

/* Andar 1: 101 (entrada hoje -> urgente), 102 (saida e entrada hoje -> sujo, dobro);
   Andar 2: 201 (manutencao -> bloqueado), 203 (em limpeza); Sem andar: 202 (ocupado); 301 inactivo nao aparece */
const UNIDADES = [
  quarto('h1', 'Quarto 101', { description: JSON.stringify({ floor: 1, view: 'Mar' }) }),
  quarto('h2', 'Quarto 102', { description: JSON.stringify({ floor: 1 }) }),
  quarto('h3', 'Quarto 201', { status: 'maintenance', description: JSON.stringify({ floor: 2 }) }),
  quarto('h4', 'Quarto 202'),
  quarto('h6', 'Quarto 203', { status: 'cleaning', description: JSON.stringify({ floor: 2 }) }),
  quarto('h5', 'Quarto 301', { status: 'inactive', description: JSON.stringify({ floor: 3 }) }),
];

const RESERVAS = [
  { id: 'r1', unit_id: 'h2', status: 'checked_in', check_in: dia(-2), check_out: HOJE },
  { id: 'r2', unit_id: 'h2', status: 'confirmed', check_in: HOJE, check_out: dia(2) },
  { id: 'r3', unit_id: 'h4', status: 'checked_in', check_in: dia(-1), check_out: dia(3) },
  { id: 'r4', unit_id: 'h1', status: 'confirmed', check_in: HOJE, check_out: dia(1) },
];

const COLABORADORES = [{ id: 's1', name: 'Maria' }, { id: 's2', name: 'Joao' }];

describe('Housekeeping', () => {
  let errSpy;
  let warnSpy;

  beforeEach(() => {
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    listUnits.mockReset().mockResolvedValue(UNIDADES);
    listReservations.mockReset().mockResolvedValue(RESERVAS);
    api.get.mockReset().mockResolvedValue({ data: { data: [] } });
  });

  afterEach(() => {
    cleanup();
    expect(errSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
    warnSpy.mockRestore();
  });

  async function abre({ colaboradores = false } = {}) {
    if (colaboradores) api.get.mockResolvedValue({ data: { data: COLABORADORES } });
    render(
      <MemoryRouter future={FUTURE}>
        <Housekeeping />
      </MemoryRouter>
    );
    await screen.findByText(/^\d{2}\/\d{2}\/\d{4} · \d+ quartos$/);
  }

  /* O cartao de um quarto: o ascendente mais alto do nome que so contem os seletores desse quarto */
  function cartao(nome, seletores = 1) {
    const nomes = screen.getAllByText(nome).filter(e => e.closest('select') === null && !e.parentElement.textContent.includes('Quartos com saida'));
    let el = nomes[0];
    let melhor = el;
    while (el.parentElement) {
      const n = el.parentElement.querySelectorAll('select').length;
      if (n > seletores) break;
      el = el.parentElement;
      if (n > 0) melhor = el;
    }
    return melhor;
  }
  function seletorDeEstado(nome, seletores = 1) {
    return within(cartao(nome, seletores)).getAllByRole('combobox')[0];
  }
  function nomesDosCartoes() {
    return screen.getAllByText(/^Quarto \d+$/)
      .filter(e => !e.parentElement.textContent.includes('Quartos com saida'))
      .map(e => e.textContent);
  }
  function chip(nome) {
    return screen.getByRole('button', { name: nome });
  }
  function selo(texto, dentro = document.body) {
    return within(dentro).getAllByText(texto).find(e => e.tagName === 'SPAN');
  }

  it('o subtitulo mostra a data de hoje e os quartos activos', async () => {
    await abre();
    expect(screen.getByText(`${HOJE.split('-').reverse().join('/')} · 5 quartos`)).toBeInTheDocument();
  });

  it('agrupa por andar e deixa os quartos sem andar no fim', async () => {
    await abre();
    for (const andar of ['Andar 1', 'Andar 2', 'Sem andar']) {
      expect(screen.getByRole('button', { name: new RegExp(`^${andar}`) })).toBeInTheDocument();
    }
    const cabecalhos = screen.getAllByRole('button', { name: /^(Andar \d|Sem andar)/ }).map(b => b.textContent);
    expect(cabecalhos).toEqual(['Andar 12 quartos', 'Andar 22 quartos', 'Sem andar1 quartos']);
    expect(screen.queryByText('Quarto 301')).not.toBeInTheDocument();
  });

  it('o estado inicial vem da unidade e das reservas de hoje', async () => {
    await abre();
    expect(seletorDeEstado('Quarto 102').value).toBe('dirty');
    expect(seletorDeEstado('Quarto 101').value).toBe('clean');
    expect(seletorDeEstado('Quarto 201').value).toBe('blocked');
    expect(seletorDeEstado('Quarto 203').value).toBe('cleaning');
    expect(seletorDeEstado('Quarto 202').value).toBe('clean');
    expect(selo('Sujo', cartao('Quarto 102'))).toBeTruthy();
    expect(selo('Bloqueado', cartao('Quarto 201'))).toBeTruthy();
    expect(selo('Em limpeza', cartao('Quarto 203'))).toBeTruthy();
    expect([...seletorDeEstado('Quarto 101').options].map(o => o.textContent)).toEqual(['Limpo', 'Sujo', 'Em limpeza', 'Inspeccao', 'Bloqueado']);
  });

  it('ordena por prioridade e mostra a prioridade de cada quarto', async () => {
    await abre();
    /* por andar; dentro do andar: saida+entrada, urgente, ocupado, vago */
    expect(nomesDosCartoes()).toEqual(['Quarto 102', 'Quarto 101', 'Quarto 201', 'Quarto 203', 'Quarto 202']);
    expect(within(cartao('Quarto 102')).getByText('Saida + Entrada')).toBeInTheDocument();
    expect(within(cartao('Quarto 101')).getByText('Urgente')).toBeInTheDocument();
    expect(within(cartao('Quarto 202')).getByText('Ocupado')).toBeInTheDocument();
    expect(within(cartao('Quarto 201')).getByText('Vago')).toBeInTheDocument();
    expect(within(cartao('Quarto 101')).getByText(/Mar/)).toBeInTheDocument();
  });

  it('os chips mostram as contagens e filtram por estado', async () => {
    await abre();
    for (const rotulo of ['Todos (5)', 'Sujos (1)', 'Limpeza (1)', 'Inspeccao (0)', 'Limpos (2)']) {
      expect(chip(rotulo)).toBeInTheDocument();
    }
    fireEvent.click(chip('Sujos (1)'));
    expect(nomesDosCartoes()).toEqual(['Quarto 102']);
    fireEvent.click(chip('Limpos (2)'));
    expect(nomesDosCartoes()).toEqual(['Quarto 101', 'Quarto 202']);
    fireEvent.click(chip('Todos (5)'));
    expect(nomesDosCartoes()).toHaveLength(5);
  });

  it('avisa dos quartos com saida e entrada no mesmo dia', async () => {
    await abre();
    expect(screen.getByText('Quartos com saida e entrada no mesmo dia:')).toBeInTheDocument();
    const aviso = screen.getByText('Quartos com saida e entrada no mesmo dia:').parentElement;
    expect(within(aviso).getByText('Quarto 102')).toBeInTheDocument();
  });

  it('mudar o estado pelo seletor actualiza o selo e as contagens', async () => {
    await abre();
    fireEvent.change(seletorDeEstado('Quarto 101'), { target: { value: 'inspection' } });
    expect(selo('Inspeccao', cartao('Quarto 101'))).toBeTruthy();
    expect(chip('Inspeccao (1)')).toBeInTheDocument();
    expect(chip('Limpos (1)')).toBeInTheDocument();
  });

  it('com colaboradores cada quarto tem um seletor de atribuicao; sem eles nao tem', async () => {
    await abre();
    expect(within(cartao('Quarto 101')).getAllByRole('combobox')).toHaveLength(1);
    cleanup();
    await abre({ colaboradores: true });
    const selects = within(cartao('Quarto 101', 2)).getAllByRole('combobox');
    expect(selects).toHaveLength(2);
    expect([...selects[1].options].map(o => o.textContent)).toEqual(['Atribuir colaborador...', 'Maria', 'Joao']);
    fireEvent.change(selects[1], { target: { value: 's1' } });
    expect(within(cartao('Quarto 101', 2)).getAllByRole('combobox')[1].value).toBe('s1');
  });

  it('colaboradores a falhar nao rebentam e escondem o seletor', async () => {
    api.get.mockReset().mockRejectedValue(new Error('rede'));
    await abre();
    expect(within(cartao('Quarto 101')).getAllByRole('combobox')).toHaveLength(1);
  });

  it('a checklist abre, marca itens e mostra o progresso', async () => {
    await abre();
    const progresso = within(cartao('Quarto 101')).getByText('0/8');
    fireEvent.click(progresso.closest('button'));
    for (const item of ['Trocar roupa de cama', 'Limpar casa de banho', 'Verificar varanda']) {
      expect(screen.getByText(item)).toBeInTheDocument();
    }
    fireEvent.click(screen.getByText('Trocar roupa de cama').closest('label').querySelector('button'));
    const fechar = screen.getAllByRole('button', { name: 'Fechar' });
    fireEvent.click(fechar[fechar.length - 1]);
    expect(screen.queryByText('Trocar roupa de cama')).not.toBeInTheDocument();
    expect(within(cartao('Quarto 101')).getByText('1/8')).toBeInTheDocument();
  });

  it('"Marcar como Limpo" poe o quarto limpo e fecha a checklist', async () => {
    await abre();
    fireEvent.click(within(cartao('Quarto 102')).getByText('0/8').closest('button'));
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como Limpo' }));
    expect(screen.queryByText('Trocar roupa de cama')).not.toBeInTheDocument();
    expect(seletorDeEstado('Quarto 102').value).toBe('clean');
    expect(chip('Sujos (0)')).toBeInTheDocument();
  });

  it('"Fechar" na checklist nao altera o estado do quarto', async () => {
    await abre();
    fireEvent.click(within(cartao('Quarto 102')).getByText('0/8').closest('button'));
    const fechar = screen.getAllByRole('button', { name: 'Fechar' });
    fireEvent.click(fechar[fechar.length - 1]);
    expect(screen.queryByText('Trocar roupa de cama')).not.toBeInTheDocument();
    expect(seletorDeEstado('Quarto 102').value).toBe('dirty');
  });

  it('Escape fecha a checklist sem alterar o estado', async () => {
    await abre();
    fireEvent.click(within(cartao('Quarto 102')).getByText('0/8').closest('button'));
    expect(screen.getByText('Trocar roupa de cama')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('Trocar roupa de cama')).not.toBeInTheDocument();
    expect(seletorDeEstado('Quarto 102').value).toBe('dirty');
  });

  it('nenhuma cor em hexadecimal sobra no HTML (cartoes, aviso, checklist)', async () => {
    await abre();
    expect(document.body.innerHTML).not.toContain('[#');
    fireEvent.click(within(cartao('Quarto 102')).getByText('0/8').closest('button'));
    expect(document.body.innerHTML).not.toContain('[#');
  });

  it('recolher um andar esconde os seus quartos', async () => {
    await abre();
    expect(screen.getAllByRole('combobox')).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: /^Andar 1/ }));
    expect(screen.getAllByRole('combobox')).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: /^Andar 1/ }));
    expect(screen.getAllByRole('combobox')).toHaveLength(5);
  });

  it('pede_as_estadias_de_hoje_e_as_ocupadas_e_nao_repete_reservas_comuns_aos_dois_pedidos', async () => {
    await abre();
    /* o backend nao conhece from/to (devolvia TODAS as reservas): estadias que tocam hoje + checked_in */
    expect(listReservations).toHaveBeenCalledTimes(2);
    expect(listReservations).toHaveBeenCalledWith({ stay_from: HOJE, stay_to: HOJE });
    expect(listReservations).toHaveBeenCalledWith({ status: 'checked_in' });
    /* a mesma reserva nos dois pedidos conta uma so vez: 'Saida + Entrada' do h2 (r1 e r2) aparece uma vez */
    expect(screen.getAllByText('Saida + Entrada')).toHaveLength(1);
  });

  it('um_hospede_que_ficou_alem_da_saida_continua_a_contar_como_ocupado', async () => {
    listReservations.mockImplementation(async (f) => (f.status === 'checked_in'
      ? [{ id: 'atrasada', unit_id: 'h1', status: 'checked_in', check_in: dia(-5), check_out: dia(-1) }]
      : []));
    await abre();
    expect(screen.getAllByText('Ocupado').length).toBeGreaterThan(0);
  });

  it('sem quartos mostra o vazio', async () => {
    listUnits.mockResolvedValue([]);
    render(
      <MemoryRouter future={FUTURE}>
        <Housekeeping />
      </MemoryRouter>
    );
    expect(await screen.findByText('Nenhum quarto encontrado')).toBeInTheDocument();
  });

  it('servicos a falhar nao rebentam', async () => {
    listUnits.mockRejectedValue(new Error('rede'));
    render(
      <MemoryRouter future={FUTURE}>
        <Housekeeping />
      </MemoryRouter>
    );
    expect(await screen.findByText('Nenhum quarto encontrado')).toBeInTheDocument();
  });
});
