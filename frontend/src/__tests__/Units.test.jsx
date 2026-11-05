import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Units from '../pages/Units';
import useAuthStore from '../store/authStore';
import useUiStore from '../store/uiStore';
import {
  listUnits, createUnit, updateUnit, deleteUnit, toggleUnitStatus, updateConectStatus,
} from '../services/unitsService';
import { getQrCode } from '../services/marketingService';

/* Sem rede: todos os servicos usados pela pagina sao simulados */
vi.mock('../services/unitsService', () => ({
  listUnits: vi.fn(),
  createUnit: vi.fn(),
  updateUnit: vi.fn(),
  deleteUnit: vi.fn(),
  toggleUnitStatus: vi.fn(),
  updateConectStatus: vi.fn(),
}));
vi.mock('../services/marketingService', () => ({
  getQrCode: vi.fn(),
}));

/* O formulario real e grande e tem testes proprios; aqui um substituto expoe as props
   que a pagina lhe passa. parseTourMeta e a copia fiel da funcao real. */
vi.mock('../components/units/UnitForm', () => ({
  default: ({ unit, operatorType, onSave, onCancel, loading, error }) => (
    <div data-testid="unit-form-stub" data-operator-type={operatorType} data-unit-id={unit ? unit.id : ''} data-loading={String(!!loading)}>
      <span data-testid="unit-form-error">{error}</span>
      <button type="button" onClick={() => onSave({ name: 'Dados do formulario', base_price: 12 })}>stub-guardar</button>
      <button type="button" onClick={onCancel}>stub-cancelar</button>
    </div>
  ),
  parseTourMeta: (description) => {
    if (!description?.startsWith('{')) return {};
    try { return JSON.parse(description); } catch { return {}; }
  },
}));

/* Fixtures por tipo de operador */
function tour(over) {
  return {
    id: 't1', name: 'Tour Pedra de Lume', unit_type: 'Tour', status: 'active',
    base_price: 45, capacity: 12, category_id: 'c1', lat: 16.7, lng: -22.9, images: [],
    conect_status: 'draft',
    description: JSON.stringify({
      name_en: 'Salt Crater Tour', tour_type: 'grupo', difficulty: 'Facil', duration: '3',
      start_time: '09:00', min_age: 6, meeting_point: 'Hotel Riu', languages: ['PT', 'EN'],
      price_child: 25, price_private: 120,
    }),
    ...over,
  };
}
function quarto(over) {
  return {
    id: 'h1', name: 'Quarto Mar', unit_type: 'room', status: 'active', base_price: 80,
    price_unit: 'night', capacity: 2, category_id: 'c1', lat: 16.7, lng: -22.9, images: [],
    conect_status: 'draft', description: 'Quarto com vista para o mar', pricing_rules: [],
    ...over,
  };
}
function viatura(over) {
  return {
    id: 'v1', name: 'Suzuki Jimny', unit_type: 'car', status: 'active', base_price: 50,
    price_unit: 'day', capacity: 4, category_id: 'c1', lat: 16.7, lng: -22.9, images: [],
    conect_status: 'draft', description: '{"plate":"AA-00-AA"}', pricing_rules: [],
    ...over,
  };
}
function mesa(over) {
  return {
    id: 'm1', name: 'Mesa 3', unit_type: 'table', status: 'active', base_price: 0,
    capacity: 4, images: [], conect_status: 'draft', description: '{"number":3}',
    pricing_rules: [],
    ...over,
  };
}

const TIPOS = {
  activity:   { titulo: 'Tours & Actividades', novo: 'Novo Tour', unidade: () => tour(), nome: 'Tour Pedra de Lume' },
  hotel:      { titulo: 'Quartos & Alojamentos', novo: 'Nova Unidade', unidade: () => quarto(), nome: 'Quarto Mar' },
  rentacar:   { titulo: 'Frota', novo: 'Nova Viatura', unidade: () => viatura(), nome: 'Suzuki Jimny' },
  restaurant: { titulo: 'Mesas', novo: 'Nova Mesa', unidade: () => mesa(), nome: 'Mesa 3' },
};

function defineOperador(tipo) {
  useAuthStore.setState({ operator: tipo ? { operator_type: tipo, slug: 'op-teste' } : null });
}

function carregaServicos({ units = [] } = {}) {
  listUnits.mockReset().mockResolvedValue(units);
  /* Os servicos de escrita rejeitam formas de argumentos que a pagina nunca envia */
  createUnit.mockReset().mockImplementation(async (dados) => {
    if (!dados || typeof dados !== 'object') throw new Error('createUnit: argumentos inesperados');
    return { id: 'novo1', status: 'active', unit_type: 'Tour', base_price: 12, capacity: 1, images: [], ...dados };
  });
  updateUnit.mockReset().mockImplementation(async (id, dados) => {
    if (typeof id !== 'string' || !dados || typeof dados !== 'object') throw new Error('updateUnit: argumentos inesperados');
    const base = units.find((u) => u.id === id);
    return { ...base, ...dados };
  });
  deleteUnit.mockReset().mockImplementation(async (id) => {
    if (typeof id !== 'string') throw new Error('deleteUnit: argumentos inesperados');
  });
  toggleUnitStatus.mockReset().mockImplementation(async (id, status) => {
    if (typeof id !== 'string' || !['active', 'inactive'].includes(status)) throw new Error('toggleUnitStatus: argumentos inesperados');
    return { ...units.find((u) => u.id === id), status };
  });
  updateConectStatus.mockReset().mockImplementation(async (id, estado) => {
    if (typeof id !== 'string' || !['draft', 'pending_review'].includes(estado)) throw new Error('updateConectStatus: argumentos inesperados');
    return { ...units.find((u) => u.id === id), conect_status: estado };
  });
  getQrCode.mockReset().mockImplementation(async (params) => {
    if (!params || typeof params.unitId !== 'string') throw new Error('getQrCode: argumentos inesperados');
    return new Blob(['qr'], { type: 'image/png' });
  });
}

/* Cartao de uma unidade: o menor bloco que contem o nome e o seu proprio botao Editar */
function cartao(nome) {
  let el = screen.getByText(nome);
  while (el && within(el).queryAllByRole('button', { name: 'Editar' }).length !== 1) el = el.parentElement;
  if (!el) throw new Error(`Cartao nao encontrado: ${nome}`);
  return el;
}

function dialogo() {
  return screen.getByRole('dialog');
}

describe('Unidades (pagina e lista)', () => {
  let errSpy;
  let warnSpy;
  let esperaErros;
  let urlOriginal;

  beforeEach(() => {
    useUiStore.setState({ lang: 'pt' });
    defineOperador('activity');
    carregaServicos();
    esperaErros = false;
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    urlOriginal = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
    URL.createObjectURL = vi.fn(() => 'blob:qr-teste');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    cleanup();
    URL.createObjectURL = urlOriginal.create;
    URL.revokeObjectURL = urlOriginal.revoke;
    /* nenhum erro ou aviso no consolo, salvo nos casos em que o servico falha de proposito */
    const erros = errSpy.mock.calls.length;
    const avisos = warnSpy.mock.calls.length;
    errSpy.mockRestore();
    warnSpy.mockRestore();
    if (!esperaErros) expect(erros).toBe(0);
    expect(avisos).toBe(0);
  });

  async function renderPagina(units, tipo = 'activity') {
    defineOperador(tipo);
    carregaServicos({ units });
    const r = render(<Units />);
    await waitFor(() => expect(listUnits).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText('Total') !== null || screen.queryByText('Sem resultados') !== null).toBe(true));
    return r;
  }

  describe('por tipo de operador', () => {
    for (const [tipo, cfg] of Object.entries(TIPOS)) {
      it(`${tipo}: titulo, subtitulo, botao de criar e a unidade listada`, async () => {
        await renderPagina([cfg.unidade()], tipo);
        expect(screen.getByRole('heading', { level: 1, name: cfg.titulo })).toBeInTheDocument();
        expect(screen.getByText(/1 .*\(.*\)/)).toBeInTheDocument();
        expect(screen.getAllByRole('button', { name: cfg.novo }).length).toBeGreaterThan(0);
        expect(screen.getByText(cfg.nome)).toBeInTheDocument();
      });
    }

    it('subtitulos com a contagem de cada tipo', async () => {
      await renderPagina([tour(), tour({ id: 't2', name: 'Outro Tour' })], 'activity');
      expect(screen.getByText('2 tour(s) disponivel(is)')).toBeInTheDocument();
      cleanup();
      await renderPagina([quarto()], 'hotel');
      expect(screen.getByText('1 unidade(s) registada(s)')).toBeInTheDocument();
      cleanup();
      await renderPagina([viatura()], 'rentacar');
      expect(screen.getByText('1 viatura(s) registada(s)')).toBeInTheDocument();
      cleanup();
      await renderPagina([mesa()], 'restaurant');
      expect(screen.getByText('1 mesa(s) registada(s)')).toBeInTheDocument();
    });

    it('operador sem tipo usa os rotulos de hotel e nao rebenta', async () => {
      defineOperador(null);
      carregaServicos({ units: [quarto()] });
      render(<Units />);
      expect(await screen.findByText('Quarto Mar')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1, name: 'Quartos & Alojamentos' })).toBeInTheDocument();
    });

    it('restaurante esconde pratos e menus de degustacao (so lista mesas)', async () => {
      await renderPagina([
        mesa(),
        mesa({ id: 'p1', name: 'Prato do dia', unit_type: 'menu_item' }),
        mesa({ id: 'p2', name: 'Menu Chef', unit_type: 'tasting_menu' }),
      ], 'restaurant');
      expect(screen.getByText('Mesa 3')).toBeInTheDocument();
      expect(screen.queryByText('Prato do dia')).not.toBeInTheDocument();
      expect(screen.queryByText('Menu Chef')).not.toBeInTheDocument();
      expect(screen.getByText('1 mesa(s) registada(s)')).toBeInTheDocument();
    });

    it('os outros tipos nao filtram por unit_type', async () => {
      await renderPagina([quarto({ id: 'x1', name: 'Item de menu', unit_type: 'menu_item' })], 'hotel');
      expect(screen.getByText('Item de menu')).toBeInTheDocument();
    });
  });

  describe('cartoes e precos formatados', () => {
    it('tour com preco base: €45/adulto, crianca e privado, metadados e etiquetas', async () => {
      await renderPagina([tour()]);
      const c = cartao('Tour Pedra de Lume');
      expect(c.textContent).toContain('€45/adulto');
      expect(c.textContent).toContain('€25 crianca');
      expect(c.textContent).toContain('€120 privado');
      expect(within(c).getByText('Salt Crater Tour')).toBeInTheDocument();
      expect(within(c).getByText('Tour')).toBeInTheDocument();
      expect(within(c).getByText('Grupo')).toBeInTheDocument();
      expect(within(c).getByText('Facil')).toBeInTheDocument();
      expect(within(c).getByText('3h')).toBeInTheDocument();
      expect(within(c).getByText('Max 12 pax')).toBeInTheDocument();
      expect(within(c).getByText('09:00')).toBeInTheDocument();
      expect(within(c).getByText('6 anos')).toBeInTheDocument();
      expect(within(c).getByText('Hotel Riu')).toBeInTheDocument();
      expect(within(c).getByText('PT')).toBeInTheDocument();
      expect(within(c).getByText('EN')).toBeInTheDocument();
    });

    it('tour sem preco base mostra "A partir de" com o escalao mais baixo', async () => {
      await renderPagina([tour({
        base_price: 0,
        description: JSON.stringify({ price_tiers: [{ pax_min: 1, pax_max: 2, price: 60 }, { pax_min: 3, pax_max: 6, price: 40 }] }),
      })]);
      expect(cartao('Tour Pedra de Lume').textContent).toContain('A partir de €40');
    });

    it('tour sem escaloes usa o preco privado como "A partir de"', async () => {
      await renderPagina([tour({ base_price: 0, description: JSON.stringify({ price_private: 150 }) })]);
      expect(cartao('Tour Pedra de Lume').textContent).toContain('A partir de €150');
    });

    it('tour sem nenhum preco mostra "Sem preço definido"', async () => {
      await renderPagina([tour({ base_price: 0, description: null })]);
      expect(cartao('Tour Pedra de Lume').textContent).toContain('Sem preço definido');
    });

    it('quarto: preco por noite, capacidade, descricao em texto e regras de preco activas (max. 2)', async () => {
      await renderPagina([quarto({
        pricing_rules: [
          { id: 'r1', name: 'Epoca alta', active: true },
          { id: 'r2', name: 'Fim de semana', active: true },
          { id: 'r3', name: 'Terceira regra', active: true },
          { id: 'r4', name: 'Regra desligada', active: false },
        ],
      })], 'hotel');
      const c = cartao('Quarto Mar');
      expect(c.textContent).toContain('€80.00/noite');
      expect(c.textContent).toContain('Cap. 2');
      expect(within(c).getByText('room')).toBeInTheDocument();
      expect(within(c).getByText('Quarto com vista para o mar')).toBeInTheDocument();
      expect(within(c).getByText('Epoca alta')).toBeInTheDocument();
      expect(within(c).getByText('Fim de semana')).toBeInTheDocument();
      expect(within(c).queryByText('Terceira regra')).not.toBeInTheDocument();
      expect(within(c).queryByText('Regra desligada')).not.toBeInTheDocument();
    });

    it('descricao em JSON nao aparece como texto', async () => {
      await renderPagina([viatura()], 'rentacar');
      expect(screen.queryByText('{"plate":"AA-00-AA"}')).not.toBeInTheDocument();
    });

    it('viatura: preco por dia; mesa: preco sem unidade de preco', async () => {
      await renderPagina([viatura()], 'rentacar');
      expect(cartao('Suzuki Jimny').textContent).toContain('€50.00/dia');
      cleanup();
      await renderPagina([mesa()], 'restaurant');
      const c = cartao('Mesa 3');
      expect(c.textContent).toContain('€0.00');
      expect(c.textContent).toContain('Cap. 4');
    });

    it('unidades de hora, sessao e pessoa usam o sufixo certo', async () => {
      await renderPagina([
        quarto({ id: 'a', name: 'Por hora', price_unit: 'hour' }),
        quarto({ id: 'b', name: 'Por sessao', price_unit: 'session' }),
        quarto({ id: 'c', name: 'Por pessoa', price_unit: 'person' }),
      ], 'hotel');
      expect(cartao('Por hora').textContent).toContain('€80.00/hora');
      expect(cartao('Por sessao').textContent).toContain('€80.00/sessao');
      expect(cartao('Por pessoa').textContent).toContain('€80.00/pessoa');
    });

    it('a primeira imagem da unidade aparece como miniatura', async () => {
      await renderPagina([quarto({ images: ['https://exemplo.test/a.jpg', 'https://exemplo.test/b.jpg'] })], 'hotel');
      const img = screen.getByAltText('Quarto Mar');
      expect(img).toHaveAttribute('src', 'https://exemplo.test/a.jpg');
    });

    it('imagem do tour tambem aparece, com o nome como texto alternativo', async () => {
      await renderPagina([tour({ images: ['https://exemplo.test/t.jpg'] })]);
      expect(screen.getByAltText('Tour Pedra de Lume')).toHaveAttribute('src', 'https://exemplo.test/t.jpg');
    });
  });

  describe('estado activo/inactivo e contadores', () => {
    it('etiquetas de estado: tours "Activo"/"Inactivo", outros tipos "Activa"/"Inactiva"', async () => {
      await renderPagina([tour(), tour({ id: 't2', name: 'Tour Parado', status: 'inactive' })]);
      expect(within(cartao('Tour Pedra de Lume')).getByText('Activo')).toBeInTheDocument();
      expect(within(cartao('Tour Parado')).getByText('Inactivo')).toBeInTheDocument();
      cleanup();
      await renderPagina([quarto(), quarto({ id: 'h2', name: 'Quarto Parado', status: 'inactive' })], 'hotel');
      expect(within(cartao('Quarto Mar')).getByText('Activa')).toBeInTheDocument();
      expect(within(cartao('Quarto Parado')).getByText('Inactiva')).toBeInTheDocument();
    });

    it('barra de totais: Total, Activos e Inactivos so quando existem inactivos', async () => {
      await renderPagina([tour(), tour({ id: 't2', name: 'Tour Parado', status: 'inactive' })]);
      const total = screen.getByText('Total');
      expect(total.nextElementSibling).toHaveTextContent('2');
      expect(screen.getByText('Activos').nextElementSibling).toHaveTextContent('1');
      expect(screen.getByText('Inactivos').nextElementSibling).toHaveTextContent('1');
      cleanup();
      await renderPagina([tour()]);
      expect(screen.getByText('Activos').nextElementSibling).toHaveTextContent('1');
      expect(screen.queryByText('Inactivos')).not.toBeInTheDocument();
    });

    it('desactivar chama toggleUnitStatus(id, "inactive") e o cartao passa a inactivo', async () => {
      await renderPagina([tour()]);
      fireEvent.click(within(cartao('Tour Pedra de Lume')).getByRole('button', { name: 'Desactivar' }));
      await waitFor(() => expect(toggleUnitStatus).toHaveBeenCalledWith('t1', 'inactive'));
      expect(await within(cartao('Tour Pedra de Lume')).findByText('Inactivo')).toBeInTheDocument();
      expect(screen.getByText('Inactivos').nextElementSibling).toHaveTextContent('1');
      expect(within(cartao('Tour Pedra de Lume')).getByRole('button', { name: 'Activar' })).toBeInTheDocument();
    });

    it('activar uma unidade inactiva chama toggleUnitStatus(id, "active")', async () => {
      await renderPagina([quarto({ status: 'inactive' })], 'hotel');
      fireEvent.click(within(cartao('Quarto Mar')).getByRole('button', { name: 'Activar' }));
      await waitFor(() => expect(toggleUnitStatus).toHaveBeenCalledWith('h1', 'active'));
      expect(await within(cartao('Quarto Mar')).findByText('Activa')).toBeInTheDocument();
      expect(within(cartao('Quarto Mar')).getByRole('button', { name: 'Desactivar' })).toBeInTheDocument();
    });

    it('se o servico de estado falha o cartao fica como estava', async () => {
      await renderPagina([tour()]);
      toggleUnitStatus.mockReset().mockRejectedValue(new Error('falhou'));
      esperaErros = true;
      fireEvent.click(within(cartao('Tour Pedra de Lume')).getByRole('button', { name: 'Desactivar' }));
      await waitFor(() => expect(toggleUnitStatus).toHaveBeenCalled());
      await waitFor(() => expect(errSpy).toHaveBeenCalled());
      expect(within(cartao('Tour Pedra de Lume')).getByText('Activo')).toBeInTheDocument();
    });
  });

  describe('lembrete de categoria/coordenadas', () => {
    it('mostra o lembrete (singular) para unidades activas sem categoria ou coordenadas', async () => {
      await renderPagina([tour({ category_id: null })]);
      expect(screen.getByText(/unidade está.*sem categoria e\/ou coordenadas/)).toBeInTheDocument();
    });

    it('plural, e as unidades inactivas nao contam', async () => {
      await renderPagina([
        tour({ lat: null }),
        tour({ id: 't2', name: 'Tour B', lng: null }),
        tour({ id: 't3', name: 'Tour C', category_id: null, status: 'inactive' }),
      ]);
      expect(screen.getByText(/unidades estão.*sem categoria e\/ou coordenadas/)).toBeInTheDocument();
      expect(screen.getByText('2', { selector: 'span.font-semibold' })).toBeInTheDocument();
    });

    it('nao aparece quando tudo esta completo nem para restaurantes', async () => {
      await renderPagina([tour()]);
      expect(screen.queryByText(/sem categoria e\/ou coordenadas/)).not.toBeInTheDocument();
      cleanup();
      await renderPagina([mesa({ category_id: null, lat: null })], 'restaurant');
      expect(screen.queryByText(/sem categoria e\/ou coordenadas/)).not.toBeInTheDocument();
    });
  });

  describe('SalDesk Conect', () => {
    it('rascunho: "Submeter ao Conect" chama updateConectStatus(id, "pending_review") e passa a Em revisao', async () => {
      await renderPagina([tour()]);
      const c = cartao('Tour Pedra de Lume');
      expect(within(c).getByText('Nao submetido')).toBeInTheDocument();
      fireEvent.click(within(c).getByRole('button', { name: 'Submeter ao Conect' }));
      await waitFor(() => expect(updateConectStatus).toHaveBeenCalledWith('t1', 'pending_review'));
      expect(await within(cartao('Tour Pedra de Lume')).findByText('Em revisao')).toBeInTheDocument();
      /* em revisao nao ha nenhuma acao */
      expect(within(cartao('Tour Pedra de Lume')).queryByRole('button', { name: /Conect/ })).not.toBeInTheDocument();
    });

    it('publicado: "Retirar do Conect" chama updateConectStatus(id, "draft")', async () => {
      await renderPagina([quarto({ conect_status: 'published' })], 'hotel');
      const c = cartao('Quarto Mar');
      expect(within(c).getByText('Publicado no Conect')).toBeInTheDocument();
      fireEvent.click(within(c).getByRole('button', { name: 'Retirar do Conect' }));
      await waitFor(() => expect(updateConectStatus).toHaveBeenCalledWith('h1', 'draft'));
      expect(await within(cartao('Quarto Mar')).findByText('Nao submetido')).toBeInTheDocument();
    });

    it('pausado tambem pode ser retirado; em revisao nao tem acao', async () => {
      await renderPagina([
        viatura({ conect_status: 'paused' }),
        viatura({ id: 'v2', name: 'Kia Picanto', conect_status: 'pending_review' }),
      ], 'rentacar');
      expect(within(cartao('Suzuki Jimny')).getByText('Pausado')).toBeInTheDocument();
      fireEvent.click(within(cartao('Suzuki Jimny')).getByRole('button', { name: 'Retirar do Conect' }));
      await waitFor(() => expect(updateConectStatus).toHaveBeenCalledWith('v1', 'draft'));
      expect(within(cartao('Kia Picanto')).queryByRole('button', { name: /Conect/ })).not.toBeInTheDocument();
    });

    it('unidade sem conect_status conta como rascunho', async () => {
      await renderPagina([mesa({ conect_status: undefined })], 'restaurant');
      expect(within(cartao('Mesa 3')).getByText('Nao submetido')).toBeInTheDocument();
    });

    it('se o servico falha nao rebenta e o estado fica como estava', async () => {
      await renderPagina([tour()]);
      updateConectStatus.mockReset().mockRejectedValue(new Error('falhou'));
      esperaErros = true;
      fireEvent.click(within(cartao('Tour Pedra de Lume')).getByRole('button', { name: 'Submeter ao Conect' }));
      await waitFor(() => expect(errSpy).toHaveBeenCalled());
      expect(within(cartao('Tour Pedra de Lume')).getByText('Nao submetido')).toBeInTheDocument();
    });
  });

  describe('editar e guardar', () => {
    it('Editar abre o modal com o formulario do tipo certo e a unidade (tour)', async () => {
      await renderPagina([tour()]);
      fireEvent.click(within(cartao('Tour Pedra de Lume')).getByRole('button', { name: 'Editar' }));
      const d = dialogo();
      expect(within(d).getByRole('heading', { name: 'Editar tour: Tour Pedra de Lume' })).toBeInTheDocument();
      const form = within(d).getByTestId('unit-form-stub');
      expect(form).toHaveAttribute('data-operator-type', 'activity');
      expect(form).toHaveAttribute('data-unit-id', 't1');
    });

    for (const tipo of ['hotel', 'rentacar', 'restaurant']) {
      it(`Editar (${tipo}) abre "Editar: nome" com operatorType ${tipo}`, async () => {
        const u = TIPOS[tipo].unidade();
        await renderPagina([u], tipo);
        fireEvent.click(within(cartao(u.name)).getByRole('button', { name: 'Editar' }));
        const d = dialogo();
        expect(within(d).getByRole('heading', { name: `Editar: ${u.name}` })).toBeInTheDocument();
        const form = within(d).getByTestId('unit-form-stub');
        expect(form).toHaveAttribute('data-operator-type', tipo);
        expect(form).toHaveAttribute('data-unit-id', u.id);
      });
    }

    it('guardar chama updateUnit(id, dados), fecha o modal e actualiza o cartao', async () => {
      await renderPagina([tour()]);
      fireEvent.click(within(cartao('Tour Pedra de Lume')).getByRole('button', { name: 'Editar' }));
      fireEvent.click(screen.getByRole('button', { name: 'stub-guardar' }));
      await waitFor(() => expect(updateUnit).toHaveBeenCalledWith('t1', { name: 'Dados do formulario', base_price: 12 }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(screen.getByText('Dados do formulario')).toBeInTheDocument();
      expect(screen.queryByText('Tour Pedra de Lume')).not.toBeInTheDocument();
    });

    it('erro do servidor aparece no formulario; sem resposta usa a mensagem generica; novo pedido limpa o erro', async () => {
      await renderPagina([tour()]);
      fireEvent.click(within(cartao('Tour Pedra de Lume')).getByRole('button', { name: 'Editar' }));
      updateUnit.mockReset().mockRejectedValueOnce({ response: { data: { error: 'Nome repetido' } } });
      fireEvent.click(screen.getByRole('button', { name: 'stub-guardar' }));
      expect(await screen.findByText('Nome repetido')).toBeInTheDocument();
      expect(dialogo()).toBeInTheDocument();
      updateUnit.mockRejectedValueOnce(new Error('rede'));
      fireEvent.click(screen.getByRole('button', { name: 'stub-guardar' }));
      expect(await screen.findByText('Ocorreu um erro. Tente novamente.')).toBeInTheDocument();
    });

    it('cancelar fecha o modal sem chamar o servico', async () => {
      await renderPagina([tour()]);
      fireEvent.click(within(cartao('Tour Pedra de Lume')).getByRole('button', { name: 'Editar' }));
      fireEvent.click(screen.getByRole('button', { name: 'stub-cancelar' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(updateUnit).not.toHaveBeenCalled();
    });

    it('Fechar (X) do modal tambem fecha', async () => {
      await renderPagina([tour()]);
      fireEvent.click(within(cartao('Tour Pedra de Lume')).getByRole('button', { name: 'Editar' }));
      fireEvent.click(within(dialogo()).getByRole('button', { name: 'Fechar' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('criar', () => {
    for (const [tipo, cfg] of Object.entries(TIPOS)) {
      it(`${cfg.novo} (${tipo}) abre o modal com o formulario de ${tipo} e sem unidade`, async () => {
        await renderPagina([cfg.unidade()], tipo);
        fireEvent.click(screen.getAllByRole('button', { name: cfg.novo })[0]);
        const d = dialogo();
        expect(within(d).getByRole('heading', { name: cfg.novo })).toBeInTheDocument();
        const form = within(d).getByTestId('unit-form-stub');
        expect(form).toHaveAttribute('data-operator-type', tipo);
        expect(form).toHaveAttribute('data-unit-id', '');
      });
    }

    it('guardar chama createUnit(dados) e a nova unidade fica no topo da lista', async () => {
      await renderPagina([tour()]);
      fireEvent.click(screen.getAllByRole('button', { name: 'Novo Tour' })[0]);
      fireEvent.click(screen.getByRole('button', { name: 'stub-guardar' }));
      await waitFor(() => expect(createUnit).toHaveBeenCalledWith({ name: 'Dados do formulario', base_price: 12 }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      const nomes = screen.getAllByText(/Dados do formulario|Tour Pedra de Lume/).map((n) => n.textContent);
      expect(nomes).toEqual(['Dados do formulario', 'Tour Pedra de Lume']);
      expect(screen.getByText('2 tour(s) disponivel(is)')).toBeInTheDocument();
    });

    it('createUnit a falhar mostra o erro no formulario', async () => {
      await renderPagina([tour()]);
      createUnit.mockReset().mockRejectedValue({ response: { data: { error: 'Plano sem espaco' } } });
      fireEvent.click(screen.getAllByRole('button', { name: 'Novo Tour' })[0]);
      fireEvent.click(screen.getByRole('button', { name: 'stub-guardar' }));
      expect(await screen.findByText('Plano sem espaco')).toBeInTheDocument();
      expect(dialogo()).toBeInTheDocument();
    });

    it('reabrir o formulario limpa o erro anterior', async () => {
      await renderPagina([tour()]);
      createUnit.mockReset().mockRejectedValue({ response: { data: { error: 'Erro antigo' } } });
      fireEvent.click(screen.getAllByRole('button', { name: 'Novo Tour' })[0]);
      fireEvent.click(screen.getByRole('button', { name: 'stub-guardar' }));
      await screen.findByText('Erro antigo');
      fireEvent.click(screen.getByRole('button', { name: 'stub-cancelar' }));
      fireEvent.click(screen.getAllByRole('button', { name: 'Novo Tour' })[0]);
      expect(screen.queryByText('Erro antigo')).not.toBeInTheDocument();
    });
  });

  describe('eliminar', () => {
    it('pede confirmacao com a mensagem do tipo e so apaga ao confirmar', async () => {
      await renderPagina([tour()]);
      fireEvent.click(within(cartao('Tour Pedra de Lume')).getByRole('button', { name: 'Eliminar' }));
      const d = dialogo();
      expect(within(d).getByRole('heading', { name: 'Confirmar' })).toBeInTheDocument();
      expect(within(d).getByText('Eliminar o tour "Tour Pedra de Lume"? As reservas associadas serao mantidas mas o tour ficara indisponivel.')).toBeInTheDocument();
      expect(deleteUnit).not.toHaveBeenCalled();
      fireEvent.click(within(d).getByRole('button', { name: 'Eliminar' }));
      await waitFor(() => expect(deleteUnit).toHaveBeenCalledWith('t1'));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(screen.queryByText('Tour Pedra de Lume')).not.toBeInTheDocument();
      expect(screen.getByText('Sem resultados')).toBeInTheDocument();
    });

    it('Cancelar fecha a confirmacao sem apagar', async () => {
      await renderPagina([tour()]);
      fireEvent.click(within(cartao('Tour Pedra de Lume')).getByRole('button', { name: 'Eliminar' }));
      fireEvent.click(within(dialogo()).getByRole('button', { name: 'Cancelar' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(deleteUnit).not.toHaveBeenCalled();
      expect(screen.getByText('Tour Pedra de Lume')).toBeInTheDocument();
    });

    it('mensagens de cada tipo', async () => {
      const casos = [
        ['hotel', 'Quarto Mar', 'Eliminar a unidade "Quarto Mar"? As reservas associadas serao mantidas mas a unidade ficara indisponivel.'],
        ['rentacar', 'Suzuki Jimny', 'Eliminar a viatura "Suzuki Jimny"? As reservas associadas serao mantidas.'],
        ['restaurant', 'Mesa 3', 'Eliminar a mesa "Mesa 3"? As reservas associadas serao mantidas.'],
      ];
      for (const [tipo, nome, msg] of casos) {
        await renderPagina([TIPOS[tipo].unidade()], tipo);
        fireEvent.click(within(cartao(nome)).getByRole('button', { name: 'Eliminar' }));
        expect(within(dialogo()).getByText(msg)).toBeInTheDocument();
        cleanup();
      }
    });

    it('se deleteUnit falha, fecha a confirmacao e a unidade continua na lista', async () => {
      await renderPagina([tour()]);
      deleteUnit.mockReset().mockRejectedValue(new Error('falhou'));
      esperaErros = true;
      fireEvent.click(within(cartao('Tour Pedra de Lume')).getByRole('button', { name: 'Eliminar' }));
      fireEvent.click(within(dialogo()).getByRole('button', { name: 'Eliminar' }));
      await waitFor(() => expect(errSpy).toHaveBeenCalled());
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(screen.getByText('Tour Pedra de Lume')).toBeInTheDocument();
    });
  });

  describe('QR das mesas', () => {
    it('so os restaurantes tem o botao "Ver QR"', async () => {
      await renderPagina([mesa()], 'restaurant');
      expect(within(cartao('Mesa 3')).getByRole('button', { name: 'Ver QR' })).toBeInTheDocument();
      for (const tipo of ['activity', 'hotel', 'rentacar']) {
        cleanup();
        const u = TIPOS[tipo].unidade();
        await renderPagina([u], tipo);
        expect(screen.queryByRole('button', { name: 'Ver QR' })).not.toBeInTheDocument();
      }
    });

    it('abre o modal com o link da mesa, pede o QR da unidade e mostra a imagem', async () => {
      await renderPagina([mesa()], 'restaurant');
      fireEvent.click(within(cartao('Mesa 3')).getByRole('button', { name: 'Ver QR' }));
      const d = dialogo();
      expect(within(d).getByRole('heading', { name: 'QR — Mesa 3' })).toBeInTheDocument();
      expect(within(d).getByText(`${window.location.origin}/book/op-teste/mesa/m1`)).toBeInTheDocument();
      await waitFor(() => expect(getQrCode).toHaveBeenCalledWith({ unitId: 'm1' }));
      expect(await within(d).findByAltText('QR code')).toHaveAttribute('src', 'blob:qr-teste');
    });

    it('Descarregar QR Code descarrega qrcode-mesa-<numero>.png', async () => {
      const cliques = [];
      const original = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function click() { cliques.push({ href: this.href, download: this.download }); };
      try {
        await renderPagina([mesa()], 'restaurant');
        fireEvent.click(within(cartao('Mesa 3')).getByRole('button', { name: 'Ver QR' }));
        await within(dialogo()).findByAltText('QR code');
        fireEvent.click(within(dialogo()).getByRole('button', { name: 'Descarregar QR Code' }));
        expect(cliques).toEqual([{ href: 'blob:qr-teste', download: 'qrcode-mesa-3.png' }]);
      } finally {
        HTMLAnchorElement.prototype.click = original;
      }
    });

    it('sem numero na descricao o ficheiro usa o id da mesa', async () => {
      const cliques = [];
      const original = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function click() { cliques.push(this.download); };
      try {
        await renderPagina([mesa({ description: null })], 'restaurant');
        fireEvent.click(within(cartao('Mesa 3')).getByRole('button', { name: 'Ver QR' }));
        await within(dialogo()).findByAltText('QR code');
        fireEvent.click(within(dialogo()).getByRole('button', { name: 'Descarregar QR Code' }));
        expect(cliques).toEqual(['qrcode-mesa-m1.png']);
      } finally {
        HTMLAnchorElement.prototype.click = original;
      }
    });

    it('o botao de copiar o link escreve o URL na area de transferencia', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      await renderPagina([mesa()], 'restaurant');
      fireEvent.click(within(cartao('Mesa 3')).getByRole('button', { name: 'Ver QR' }));
      const d = dialogo();
      await within(d).findByAltText('QR code');
      /* o botao de copiar e o unico sem texto nem etiqueta dentro do modal */
      const copiar = within(d).getAllByRole('button').find((b) => !b.textContent.trim() && b.getAttribute('aria-label') !== 'Fechar');
      fireEvent.click(copiar);
      await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/book/op-teste/mesa/m1`));
    });

    it('se o QR falha o modal abre na mesma, sem imagem', async () => {
      await renderPagina([mesa()], 'restaurant');
      getQrCode.mockReset().mockRejectedValue(new Error('sem QR'));
      fireEvent.click(within(cartao('Mesa 3')).getByRole('button', { name: 'Ver QR' }));
      await waitFor(() => expect(getQrCode).toHaveBeenCalled());
      expect(within(dialogo()).queryByAltText('QR code')).not.toBeInTheDocument();
      expect(within(dialogo()).getByRole('button', { name: 'Descarregar QR Code' })).toBeInTheDocument();
    });

    it('Fechar fecha o modal do QR', async () => {
      await renderPagina([mesa()], 'restaurant');
      fireEvent.click(within(cartao('Mesa 3')).getByRole('button', { name: 'Ver QR' }));
      /* espera pela imagem: fechar antes de o pedido terminar actualizaria estado fora do teste */
      await within(dialogo()).findByAltText('QR code');
      fireEvent.click(within(dialogo()).getByRole('button', { name: 'Fechar' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('lista vazia e servicos a falhar', () => {
    it('sem tours mostra o vazio de tours e a acao de criar do cabecalho abre o formulario', async () => {
      await renderPagina([], 'activity');
      expect(screen.getByText('Sem resultados')).toBeInTheDocument();
      expect(screen.getByText('Crie o seu primeiro tour')).toBeInTheDocument();
      expect(screen.queryByText('Total')).not.toBeInTheDocument();
      /* o primeiro botao com este nome e o do cabecalho da pagina */
      fireEvent.click(screen.getAllByRole('button', { name: 'Novo Tour' })[0]);
      expect(within(dialogo()).getByTestId('unit-form-stub')).toHaveAttribute('data-operator-type', 'activity');
    });

    for (const tipo of ['hotel', 'rentacar', 'restaurant']) {
      it(`sem unidades (${tipo}) mostra "Crie a sua primeira unidade"`, async () => {
        await renderPagina([], tipo);
        expect(screen.getByText('Sem resultados')).toBeInTheDocument();
        expect(screen.getByText('Crie a sua primeira unidade')).toBeInTheDocument();
        fireEvent.click(screen.getAllByRole('button', { name: TIPOS[tipo].novo })[0]);
        expect(within(dialogo()).getByTestId('unit-form-stub')).toHaveAttribute('data-operator-type', tipo);
      });
    }

    it('listUnits a falhar nao rebenta: mostra o vazio e o cabecalho', async () => {
      defineOperador('activity');
      carregaServicos();
      listUnits.mockReset().mockRejectedValue(new Error('sem rede'));
      esperaErros = true;
      render(<Units />);
      expect(await screen.findByText('Sem resultados')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1, name: 'Tours & Actividades' })).toBeInTheDocument();
      expect(errSpy).toHaveBeenCalled();
    });

    it('enquanto carrega nao mostra a lista nem o vazio', async () => {
      defineOperador('activity');
      carregaServicos();
      let resolver;
      listUnits.mockReset().mockReturnValue(new Promise((r) => { resolver = r; }));
      render(<Units />);
      expect(screen.queryByText('Sem resultados')).not.toBeInTheDocument();
      resolver([tour()]);
      expect(await screen.findByText('Tour Pedra de Lume')).toBeInTheDocument();
    });
  });

  describe('nomes acessiveis das acoes', () => {
    it('cada botao so com icone tem nome acessivel (tour, unidade e mesa)', async () => {
      await renderPagina([tour()], 'activity');
      const t = cartao('Tour Pedra de Lume');
      for (const nome of ['Desactivar', 'Editar', 'Eliminar']) {
        expect(within(t).getByRole('button', { name: nome })).toBeInTheDocument();
      }
      cleanup();
      await renderPagina([mesa()], 'restaurant');
      const m = cartao('Mesa 3');
      for (const nome of ['Ver QR', 'Desactivar', 'Editar', 'Eliminar']) {
        expect(within(m).getByRole('button', { name: nome })).toBeInTheDocument();
      }
    });

    it('todos os botoes da pagina tem nome acessivel', async () => {
      await renderPagina([tour(), tour({ id: 't2', name: 'Tour B', status: 'inactive', conect_status: 'published' })]);
      for (const b of screen.getAllByRole('button')) {
        expect((b.textContent || '').trim() || b.getAttribute('aria-label')).toBeTruthy();
      }
    });
  });
});

/* Acrescentado com a migracao para o design system: botoes de criar no vazio, nomes acessiveis
   e variantes dos Badge. Os testes acima ficam como foram escritos antes de migrar. */
describe('Unidades: pecas do design system', () => {
  let errSpy;
  let warnSpy;
  let urlOriginal;

  beforeEach(() => {
    useUiStore.setState({ lang: 'pt' });
    defineOperador('activity');
    carregaServicos();
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    urlOriginal = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
    URL.createObjectURL = vi.fn(() => 'blob:qr-teste');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    cleanup();
    URL.createObjectURL = urlOriginal.create;
    URL.revokeObjectURL = urlOriginal.revoke;
    const erros = errSpy.mock.calls.length;
    const avisos = warnSpy.mock.calls.length;
    errSpy.mockRestore();
    warnSpy.mockRestore();
    expect(erros).toBe(0);
    expect(avisos).toBe(0);
  });

  async function renderPagina(units, tipo = 'activity') {
    defineOperador(tipo);
    carregaServicos({ units });
    render(<Units />);
    await waitFor(() => expect(listUnits).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText('Total') !== null || screen.queryByText('Sem resultados') !== null).toBe(true));
  }

  for (const [tipo, cfg] of Object.entries(TIPOS)) {
    it(`vazio (${tipo}): o botao de criar do vazio abre o formulario de ${tipo}`, async () => {
      await renderPagina([], tipo);
      const botoes = screen.getAllByRole('button', { name: cfg.novo });
      /* cabecalho + vazio */
      expect(botoes).toHaveLength(2);
      fireEvent.click(botoes[1]);
      const form = within(dialogo()).getByTestId('unit-form-stub');
      expect(form).toHaveAttribute('data-operator-type', tipo);
      expect(form).toHaveAttribute('data-unit-id', '');
      expect(within(dialogo()).getByRole('heading', { name: cfg.novo })).toBeInTheDocument();
    });
  }

  it('vazio: abrir pelo botao do vazio limpa o erro anterior, como o do cabecalho', async () => {
    await renderPagina([], 'activity');
    createUnit.mockReset().mockRejectedValue({ response: { data: { error: 'Erro antigo' } } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Novo Tour' })[1]);
    fireEvent.click(screen.getByRole('button', { name: 'stub-guardar' }));
    await screen.findByText('Erro antigo');
    fireEvent.click(screen.getByRole('button', { name: 'stub-cancelar' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Novo Tour' })[1]);
    expect(screen.queryByText('Erro antigo')).not.toBeInTheDocument();
  });

  it('UnitList sem onCreate nao mostra botao no vazio; com onCreate chama-o e usa createLabel', async () => {
    const { default: UnitList } = await import('../components/units/UnitList');
    const base = { units: [], onEdit: vi.fn(), onDelete: vi.fn(), onToggle: vi.fn(), onSubmitConect: vi.fn() };
    const { rerender } = render(<UnitList {...base} operatorType="hotel" />);
    expect(screen.getByText('Sem resultados')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    const onCreate = vi.fn();
    rerender(<UnitList {...base} operatorType="hotel" onCreate={onCreate} createLabel="Nova Viatura" />);
    fireEvent.click(screen.getByRole('button', { name: 'Nova Viatura' }));
    expect(onCreate).toHaveBeenCalledTimes(1);
    /* sem createLabel usa o rotulo por omissao do tipo */
    rerender(<UnitList {...base} operatorType="activity" onCreate={onCreate} />);
    expect(screen.getByRole('button', { name: 'Novo Tour' })).toBeInTheDocument();
    rerender(<UnitList {...base} operatorType="hotel" onCreate={onCreate} />);
    expect(screen.getByRole('button', { name: 'Nova Unidade' })).toBeInTheDocument();
  });

  it('UnitList sem onToggle nem onSubmitConect nao rebenta ao clicar em desactivar', async () => {
    const { default: UnitList } = await import('../components/units/UnitList');
    render(<UnitList units={[quarto()]} operatorType="hotel" onEdit={vi.fn()} onDelete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Desactivar' }));
    /* sem onSubmitConect a linha do Conect nem aparece */
    expect(screen.queryByText('Nao submetido')).not.toBeInTheDocument();
  });

  it('o botao de copiar o link do QR tem nome acessivel traduzido', async () => {
    await renderPagina([mesa()], 'restaurant');
    fireEvent.click(within(cartao('Mesa 3')).getByRole('button', { name: 'Ver QR' }));
    const d = dialogo();
    await within(d).findByAltText('QR code');
    expect(within(d).getByRole('button', { name: 'Copiar link' })).toBeInTheDocument();
    for (const b of within(d).getAllByRole('button')) {
      expect((b.textContent || '').trim() || b.getAttribute('aria-label')).toBeTruthy();
    }
  });

  it('o nome acessivel do botao de copiar segue o idioma', async () => {
    useUiStore.setState({ lang: 'en' });
    await renderPagina([mesa()], 'restaurant');
    fireEvent.click(within(cartao('Mesa 3')).getByRole('button', { name: 'Ver QR' }));
    const d = dialogo();
    await within(d).findByAltText('QR code');
    expect(within(d).getByRole('button', { name: 'Copy link' })).toBeInTheDocument();
  });

  it('copiar o link mostra a confirmacao e volta ao icone de copiar', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await renderPagina([mesa()], 'restaurant');
    fireEvent.click(within(cartao('Mesa 3')).getByRole('button', { name: 'Ver QR' }));
    const d = dialogo();
    await within(d).findByAltText('QR code');
    const antes = within(d).getByRole('button', { name: 'Copiar link' }).innerHTML;
    fireEvent.click(within(d).getByRole('button', { name: 'Copiar link' }));
    await waitFor(() => expect(within(d).getByRole('button', { name: 'Copiar link' }).innerHTML).not.toBe(antes));
    await waitFor(() => expect(within(d).getByRole('button', { name: 'Copiar link' }).innerHTML).toBe(antes), { timeout: 3000 });
  });

  it('a dificuldade usa as variantes do Badge: Facil sucesso, Moderado aviso, Dificil erro', async () => {
    const mk = (id, nome, difficulty) => tour({ id, name: nome, description: JSON.stringify({ difficulty }) });
    await renderPagina([mk('a', 'Tour A', 'Facil'), mk('b', 'Tour B', 'Moderado'), mk('c', 'Tour C', 'Dificil'), mk('d', 'Tour D', 'Extremo')]);
    expect(within(cartao('Tour A')).getByText('Facil').className).toContain('--success');
    expect(within(cartao('Tour B')).getByText('Moderado').className).toContain('--warning');
    expect(within(cartao('Tour C')).getByText('Dificil').className).toContain('--error');
    /* dificuldade desconhecida: variante neutra, texto mantido */
    expect(within(cartao('Tour D')).getByText('Extremo').className).toContain('bg-n-100');
  });

  it('o estado do Conect e uma etiqueta (nao um botao) e a acao e um botao do sistema', async () => {
    await renderPagina([tour(), tour({ id: 't2', name: 'Tour B', conect_status: 'published' })]);
    const c = cartao('Tour Pedra de Lume');
    expect(within(c).queryByRole('button', { name: 'Nao submetido' })).not.toBeInTheDocument();
    expect(within(c).getByText('Nao submetido').className).toContain('bg-n-100');
    expect(within(cartao('Tour B')).getByText('Publicado no Conect').className).toContain('--success');
    expect(within(c).getByRole('button', { name: 'Submeter ao Conect' }).className).toContain('h-8');
  });

  it('as unidades inactivas ficam esbatidas e as activas nao', async () => {
    await renderPagina([quarto(), quarto({ id: 'h2', name: 'Quarto Parado', status: 'inactive' })], 'hotel');
    const classes = (nome) => {
      let el = cartao(nome);
      while (el && !el.className.includes('border-n-200')) el = el.parentElement;
      return el.className;
    };
    expect(classes('Quarto Mar')).not.toContain('opacity-70');
    expect(classes('Quarto Parado')).toContain('opacity-70');
  });
});
