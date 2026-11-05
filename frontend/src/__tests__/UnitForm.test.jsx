import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import UnitForm, { parseTourMeta } from '../components/units/UnitForm';
import useUiStore from '../store/uiStore';
import { uploadImage } from '../services/uploadService';

/* Sem rede: o unico servico que os formularios tocam (via ImageUploader) e o de upload */
vi.mock('../services/uploadService', () => ({
  uploadImage: vi.fn(),
  validateImageFile: vi.fn(() => null),
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
}));

/* Saida limpa: nenhum teste deve disparar console.error nem console.warn.
   Os espioes restauram-se ANTES de afirmar, para nunca ficarem presos se a afirmacao falhar. */
let errorSpy;
let warnSpy;
const urlOriginal = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };

beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  useUiStore.setState({ lang: 'pt' });
  vi.mocked(uploadImage).mockReset();
});

afterEach(() => {
  cleanup();
  const erros = errorSpy.mock.calls.slice();
  const avisos = warnSpy.mock.calls.slice();
  errorSpy.mockRestore();
  warnSpy.mockRestore();
  URL.createObjectURL = urlOriginal.create;
  URL.revokeObjectURL = urlOriginal.revoke;
  expect(erros.map(a => a.map(String).join(' ').slice(0, 400))).toEqual([]);
  expect(avisos.map(a => a.map(String).join(' ').slice(0, 400))).toEqual([]);
});

/* ---------- ajudantes ---------- */

/* O campo por baixo de uma etiqueta (a etiqueta e o campo partilham o mesmo bloco;
   o componente de campo nao liga a etiqueta por htmlFor, por isso getByLabelText nao serve) */
function campo(texto) {
  const etiquetas = screen.getAllByText(
    (_, el) => el.tagName === 'LABEL' && el.textContent.replace(/\*$/, '').trim() === texto,
  );
  if (etiquetas.length !== 1) throw new Error(`Etiqueta "${texto}" encontrada ${etiquetas.length} vezes`);
  return etiquetas[0].parentElement.querySelector('input, select, textarea');
}

function escrever(el, valor) {
  fireEvent.change(el, { target: { value: valor } });
}

function botao(nome) {
  return screen.getByRole('button', { name: nome });
}

function porPlaceholder(texto) {
  return screen.getByPlaceholderText(texto);
}

/* O botao de remover de uma linha dos editores: o primeiro ascendente do campo que
   contem um botao "Remover ..." (aria-label) e a linha; o botao e esse */
function removerDe(input) {
  for (let el = input.parentElement; el; el = el.parentElement) {
    const botaoRemover = el.querySelector('button[aria-label^="Remover"]');
    if (botaoRemover) return botaoRemover;
  }
  throw new Error('Botao de remover nao encontrado');
}

/* O selector de estado nao tem etiqueta: e o que tem a opcao "inactive" */
function seletorEstado() {
  return Array.from(document.querySelectorAll('select')).find(s => s.querySelector('option[value="inactive"]'));
}

function opcoes(select) {
  return Array.from(select.querySelectorAll('option')).map(o => [o.value, o.textContent]);
}

function renderForm(operatorType, props = {}) {
  const onSave = vi.fn();
  const onCancel = vi.fn();
  const utils = render(
    <UnitForm operatorType={operatorType} onSave={onSave} onCancel={onCancel} {...props} />,
  );
  return { onSave, onCancel, ...utils };
}

function guardar(onSave) {
  expect(onSave).toHaveBeenCalledTimes(1);
  return onSave.mock.calls[0][0];
}

/* Os campos comuns que todos os formularios enviam a seguir a "description" */
const OTA_VAZIO = { viator: null, getyourguide: null };

/* ---------- parseTourMeta (exportado e usado por outros ficheiros) ---------- */

describe('parseTourMeta', () => {
  it('devolve {} para vazio, texto simples e JSON invalido', () => {
    expect(parseTourMeta(undefined)).toEqual({});
    expect(parseTourMeta(null)).toEqual({});
    expect(parseTourMeta('')).toEqual({});
    expect(parseTourMeta('Texto simples')).toEqual({});
    expect(parseTourMeta('{nao e json')).toEqual({});
  });

  it('devolve o objeto quando a descricao e JSON', () => {
    expect(parseTourMeta('{"duration":3,"languages":["PT"]}')).toEqual({ duration: 3, languages: ['PT'] });
  });
});

/* ---------- despacho por tipo de operador ---------- */

describe('UnitForm: despacho por tipo de operador', () => {
  it.each([
    ['activity', 'Criar tour', 'Identificacao'],
    ['hotel', 'Criar quarto', 'Capacidade'],
    ['rentacar', 'Registar viatura', 'Especificacoes'],
    ['restaurant', 'Criar mesa', 'Opcoes'],
    ['transfer', 'Nova Unidade', null],
    [undefined, 'Nova Unidade', null],
  ])('operatorType %s mostra o botao "%s"', (tipo, rotulo, seccao) => {
    renderForm(tipo);
    expect(botao(rotulo)).toBeInTheDocument();
    if (seccao) expect(screen.getByText(seccao)).toBeInTheDocument();
  });

  it('cada tipo mostra campos so seus', () => {
    const { unmount } = renderForm('activity');
    expect(campo('Nome PT')).toBeInTheDocument();
    expect(screen.queryByText('Matricula')).toBeNull();
    unmount();

    const r2 = renderForm('rentacar');
    expect(campo('Matricula')).toBeInTheDocument();
    expect(screen.queryByText('Nome PT')).toBeNull();
    r2.unmount();

    renderForm('restaurant');
    expect(campo('Zona')).toBeInTheDocument();
    expect(screen.queryByText('Matricula')).toBeNull();
  });
});

/* ---------- comportamento comum aos cinco formularios ---------- */

const TODOS = [
  ['activity', 'Criar tour'],
  ['hotel', 'Criar quarto'],
  ['rentacar', 'Registar viatura'],
  ['restaurant', 'Criar mesa'],
  ['transfer', 'Nova Unidade'],
];

describe.each(TODOS)('formulario comum (%s)', (tipo, rotuloCriar) => {
  it('Cancelar chama onCancel e nao grava', () => {
    const { onSave, onCancel } = renderForm(tipo);
    fireEvent.click(botao('Cancelar'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('o erro recebido por prop e mostrado, e sem erro nao ha mensagem', () => {
    const { unmount } = renderForm(tipo);
    expect(screen.queryByText('Falha ao gravar a unidade')).toBeNull();
    unmount();

    renderForm(tipo, { error: 'Falha ao gravar a unidade' });
    expect(screen.getByText('Falha ao gravar a unidade')).toBeInTheDocument();
  });

  it('com loading o botao de gravar fica desativado e mostra o indicador; Cancelar continua ativo', () => {
    const { onSave, container } = renderForm(tipo, { loading: true });
    const gravar = botao(rotuloCriar);
    expect(gravar).toBeDisabled();
    expect(container.querySelector('.animate-spin')).not.toBeNull();
    expect(botao('Cancelar')).not.toBeDisabled();
    fireEvent.click(gravar);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('sem loading o botao de gravar esta ativo e sem indicador', () => {
    const { container } = renderForm(tipo);
    expect(botao(rotuloCriar)).not.toBeDisabled();
    expect(container.querySelector('.animate-spin')).toBeNull();
  });

  it('em edicao o botao de gravar muda de nome e aparece o selector de estado', () => {
    const unit = { id: 'u1', name: 'Existente', status: 'active', capacity: 2, base_price: 10 };
    renderForm(tipo, { unit });
    const nome = tipo === 'transfer' ? 'Guardar' : 'Guardar alteracoes';
    expect(botao(nome)).toBeInTheDocument();
    expect(seletorEstado()).toBeInTheDocument();
  });

  it('na criacao nao aparece o selector de estado', () => {
    renderForm(tipo);
    expect(seletorEstado()).toBeUndefined();
  });
});

/* ---------- Tour (activity) ---------- */

describe('TourForm', () => {
  const META_VAZIA = {
    name_en: null, short_pt: null, short_en: null, desc_pt: null, desc_en: null,
    tour_type: 'grupo', duration: null, languages: ['PT', 'EN'], difficulty: 'Moderado',
    min_age: null, meeting_point: null, start_time: null, price_child: null, price_private: null,
    price_tiers: [], amenities: [], included_items: [], important_info: null, stops: [], time_slots: [],
  };

  it('minimo valido: so nome e capacidade', () => {
    const { onSave } = renderForm('activity');
    escrever(campo('Nome PT'), 'Mergulho ao Amanhecer');
    escrever(campo('Capacidade maxima'), '12');
    fireEvent.click(botao('Criar tour'));
    expect(guardar(onSave)).toStrictEqual({
      name: 'Mergulho ao Amanhecer',
      description: JSON.stringify(META_VAZIA),
      unit_type: 'Tour',
      base_price: 0,
      price_unit: 'person',
      capacity: 12,
      status: 'active',
      images: [],
      ota_product_ids: OTA_VAZIO,
      lat: null,
      lng: null,
    });
  });

  it('valores por omissao dos campos', () => {
    renderForm('activity');
    expect(campo('Nome PT').value).toBe('');
    expect(campo('Categoria').value).toBe('Tour');
    expect(campo('Modalidade').value).toBe('grupo');
    expect(campo('Dificuldade').value).toBe('Moderado');
    expect(screen.getByLabelText('PT').checked).toBe(true);
    expect(screen.getByLabelText('EN').checked).toBe(true);
    expect(screen.getByLabelText('DE').checked).toBe(false);
    expect(opcoes(campo('Categoria')).map(o => o[0])).toEqual([
      'Mergulho', 'Kitesurf', 'Snorkeling', 'Passeio de Barco', 'Quad / Buggy', 'Pesca', 'Surf',
      'Windsurf', 'Tour', 'Sessao', 'Outro',
    ]);
  });

  it('os campos obrigatorios so mostram o asterisco: o campo nao leva o atributo required e nada os impede', () => {
    const { onSave } = renderForm('activity');
    expect(campo('Nome PT')).not.toBeRequired();
    expect(campo('Capacidade maxima')).not.toBeRequired();
    expect(screen.getAllByText((_, el) => el.tagName === 'LABEL' && el.textContent === 'Nome PT*')).toHaveLength(1);
    fireEvent.click(botao('Criar tour'));
    /* vazio continua a ser o que era: nome '' e capacidade Number('') = 0 */
    expect(guardar(onSave)).toStrictEqual({
      name: '',
      description: JSON.stringify(META_VAZIA),
      unit_type: 'Tour',
      base_price: 0,
      price_unit: 'person',
      capacity: 0,
      status: 'active',
      images: [],
      ota_product_ids: OTA_VAZIO,
      lat: null,
      lng: null,
    });
  });

  it('a capacidade abaixo do minimo (min=1) e travada pelo navegador, mas o submit direto passa', () => {
    const { onSave, container } = renderForm('activity');
    escrever(campo('Nome PT'), 'Tour');
    escrever(campo('Capacidade maxima'), '0');
    fireEvent.click(botao('Criar tour'));
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.submit(container.querySelector('form'));
    expect(guardar(onSave).capacity).toBe(0);
  });

  it('todos os campos preenchidos: texto vs numeros, cortes, filtros e a ordem das chaves', () => {
    const { onSave } = renderForm('activity');
    escrever(campo('Nome PT'), 'Mergulho ao Amanhecer');
    escrever(campo('Nome EN'), 'Sunrise Dive');
    escrever(campo('Categoria'), 'Pesca');
    escrever(campo('Modalidade'), 'ambos');
    escrever(campo('Descricao curta PT'), '  Resumo PT  ');
    escrever(campo('Descricao curta EN'), 'Summary EN');
    escrever(campo('Descricao longa PT'), 'Linha um\nLinha dois');
    escrever(campo('Descricao longa EN'), 'Long description');
    escrever(campo('Duracao (horas)'), '2.5');
    escrever(campo('Dificuldade'), 'Dificil');
    escrever(campo('Idade minima'), '8');
    escrever(campo('Capacidade maxima'), '12');
    escrever(campo('Hora de inicio'), '09:30');
    escrever(campo('Ponto de encontro'), 'Marina Santa Maria');
    fireEvent.click(screen.getByLabelText('EN'));
    fireEvent.click(screen.getByLabelText('DE'));
    escrever(campo('Preco adulto (opcional se usar Preço privado/Escalões)'), '45.5');
    escrever(campo('Preco crianca'), '25');
    escrever(campo('Preco privado'), '120');

    /* escaloes: um completo, um incompleto (descartado) */
    fireEvent.click(botao('Adicionar escalão'));
    fireEvent.click(botao('Adicionar escalão'));
    const min = screen.getAllByPlaceholderText('Mín PAX');
    const max = screen.getAllByPlaceholderText('Máx PAX');
    const preco = screen.getAllByPlaceholderText('Preço (€)');
    escrever(min[0], '1'); escrever(max[0], '2'); escrever(preco[0], '80');
    escrever(min[1], '3');

    /* comodidades: a ordem do clique e a ordem gravada; ligar e desligar nao deixa rasto */
    fireEvent.click(screen.getByLabelText('Transporte'));
    fireEvent.click(screen.getByLabelText('Seguro'));
    fireEvent.click(screen.getByLabelText('Toalhas'));
    fireEvent.click(screen.getByLabelText('Toalhas'));

    /* itens incluidos: incluido, nao incluido, e um vazio (descartado) */
    fireEvent.click(botao('Adicionar item incluído'));
    fireEvent.click(botao('Adicionar item não incluído'));
    fireEvent.click(botao('Adicionar item incluído'));
    const itens = screen.getAllByPlaceholderText(/^Ex: (Pequeno-almoço|Entradas)/);
    expect(itens).toHaveLength(3);
    escrever(itens[0], 'Pequeno-almoço');
    escrever(itens[1], 'Entradas (€5/pessoa)');
    escrever(itens[2], '   ');

    /* horarios: um completo, um sem lugares e um sem hora (descartados) */
    fireEvent.click(botao('Adicionar horário'));
    fireEvent.click(botao('Adicionar horário'));
    fireEvent.click(botao('Adicionar horário'));
    const lugares = screen.getAllByPlaceholderText('Lugares');
    escrever(lugares[0].previousElementSibling, '09:00'); escrever(lugares[0], '8');
    escrever(lugares[1].previousElementSibling, '10:00');
    escrever(lugares[2], '5');

    /* paragens: com coordenadas, sem coordenadas e sem nome (descartada) */
    fireEvent.click(botao('Adicionar paragem'));
    fireEvent.click(botao('Adicionar paragem'));
    fireEvent.click(botao('Adicionar paragem'));
    const nomes = screen.getAllByPlaceholderText('Ex: Templo do Amanhecer');
    const descs = screen.getAllByPlaceholderText('Descrição curta (opcional)');
    const lats = screen.getAllByPlaceholderText('Latitude (opcional)');
    const lngs = screen.getAllByPlaceholderText('Longitude (opcional)');
    escrever(nomes[0], 'Templo'); escrever(descs[0], 'Vista incrivel'); escrever(lats[0], '16.1'); escrever(lngs[0], '-22.5');
    escrever(nomes[1], 'Sem coordenadas');
    escrever(nomes[2], '   '); escrever(descs[2], 'Descartada');

    escrever(porPlaceholder('Ex: Traga roupa confortável e protector solar.'), 'Traga protector');
    escrever(campo('ID produto Viator'), 'V123');
    escrever(campo('ID produto GetYourGuide'), 'G456');
    escrever(campo('Latitude'), '16.6013');
    escrever(campo('Longitude'), '-22.9184');

    fireEvent.click(botao('Criar tour'));

    expect(guardar(onSave)).toStrictEqual({
      name: 'Mergulho ao Amanhecer',
      description: JSON.stringify({
        name_en: 'Sunrise Dive',
        short_pt: 'Resumo PT',
        short_en: 'Summary EN',
        desc_pt: 'Linha um\nLinha dois',
        desc_en: 'Long description',
        tour_type: 'ambos',
        duration: 2.5,
        languages: ['PT', 'DE'],
        difficulty: 'Dificil',
        min_age: 8,
        meeting_point: 'Marina Santa Maria',
        start_time: '09:30',
        price_child: 25,
        price_private: 120,
        price_tiers: [{ pax_min: 1, pax_max: 2, price: 80 }],
        amenities: ['Transporte', 'Seguro'],
        included_items: [
          { label: 'Pequeno-almoço', included: true },
          { label: 'Entradas (€5/pessoa)', included: false },
        ],
        important_info: 'Traga protector',
        stops: [
          { name: 'Templo', desc: 'Vista incrivel', lat: 16.1, lng: -22.5 },
          { name: 'Sem coordenadas', desc: null, lat: null, lng: null },
        ],
        time_slots: [{ time: '09:00', capacity: 8 }],
      }),
      unit_type: 'Pesca',
      base_price: 45.5,
      price_unit: 'person',
      capacity: 12,
      status: 'active',
      images: [],
      ota_product_ids: { viator: 'V123', getyourguide: 'G456' },
      lat: 16.6013,
      lng: -22.9184,
    });
  });

  it('o contador da descricao curta acompanha o texto', () => {
    renderForm('activity');
    expect(screen.getByText('0/160 caracteres')).toBeInTheDocument();
    expect(screen.getByText('0/160 characters')).toBeInTheDocument();
    escrever(campo('Descricao curta PT'), 'Ola');
    escrever(campo('Descricao curta EN'), 'Hello!');
    expect(screen.getByText('3/160 caracteres')).toBeInTheDocument();
    expect(screen.getByText('6/160 characters')).toBeInTheDocument();
  });

  it('o preco adulto vazio grava 0 e "0" tambem', () => {
    const { onSave } = renderForm('activity');
    escrever(campo('Nome PT'), 'Tour');
    escrever(campo('Capacidade maxima'), '4');
    escrever(campo('Preco adulto (opcional se usar Preço privado/Escalões)'), '0');
    fireEvent.click(botao('Criar tour'));
    expect(guardar(onSave).base_price).toBe(0);
  });

  describe('editores', () => {
    function preencherMinimo() {
      const r = renderForm('activity');
      escrever(campo('Nome PT'), 'Tour');
      escrever(campo('Capacidade maxima'), '4');
      return r;
    }

    function metaGravada(onSave) {
      return JSON.parse(guardar(onSave).description);
    }

    it('itens incluidos: adicionar, alternar incluido/nao incluido, editar e remover', () => {
      const { onSave } = preencherMinimo();
      fireEvent.click(botao('Adicionar item incluído'));
      fireEvent.click(botao('Adicionar item incluído'));
      let itens = screen.getAllByPlaceholderText('Ex: Pequeno-almoço');
      escrever(itens[0], 'Agua');
      escrever(itens[1], 'Snack');
      /* alternar o primeiro para nao incluido muda o texto do botao e o placeholder */
      fireEvent.click(screen.getAllByTitle('Clique para alternar entre incluído e não incluído')[0]);
      expect(screen.getByText('Não incluído')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Ex: Entradas (€5/pessoa), almoço').value).toBe('Agua');
      /* remover o segundo */
      fireEvent.click(removerDe(screen.getByPlaceholderText('Ex: Pequeno-almoço')));
      itens = screen.getAllByPlaceholderText(/^Ex: (Pequeno-almoço|Entradas)/);
      expect(itens).toHaveLength(1);
      fireEvent.click(botao('Criar tour'));
      expect(metaGravada(onSave).included_items).toEqual([{ label: 'Agua', included: false }]);
    });

    it('paragens: adicionar, numerar, editar e remover; coordenadas ficam em numero', () => {
      const { onSave } = preencherMinimo();
      fireEvent.click(botao('Adicionar paragem'));
      fireEvent.click(botao('Adicionar paragem'));
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      const nomes = screen.getAllByPlaceholderText('Ex: Templo do Amanhecer');
      escrever(nomes[0], 'A');
      escrever(nomes[1], 'B');
      escrever(screen.getAllByPlaceholderText('Latitude (opcional)')[1], '10.5');
      escrever(screen.getAllByPlaceholderText('Longitude (opcional)')[1], '0');
      fireEvent.click(removerDe(nomes[0]));
      expect(screen.getAllByPlaceholderText('Ex: Templo do Amanhecer')).toHaveLength(1);
      fireEvent.click(botao('Criar tour'));
      /* "0" e uma coordenada valida: nao pode virar null */
      expect(metaGravada(onSave).stops).toEqual([{ name: 'B', desc: null, lat: 10.5, lng: 0 }]);
    });

    it('horarios: adicionar, editar e remover', () => {
      const { onSave } = preencherMinimo();
      fireEvent.click(botao('Adicionar horário'));
      fireEvent.click(botao('Adicionar horário'));
      const lugares = screen.getAllByPlaceholderText('Lugares');
      escrever(lugares[0].previousElementSibling, '08:00'); escrever(lugares[0], '4');
      escrever(lugares[1].previousElementSibling, '15:30'); escrever(lugares[1], '6');
      fireEvent.click(removerDe(lugares[0]));
      fireEvent.click(botao('Criar tour'));
      expect(metaGravada(onSave).time_slots).toEqual([{ time: '15:30', capacity: 6 }]);
    });

    it('escaloes de preco: adicionar, editar e remover; o preco aceita decimais', () => {
      const { onSave } = preencherMinimo();
      fireEvent.click(botao('Adicionar escalão'));
      fireEvent.click(botao('Adicionar escalão'));
      const min = screen.getAllByPlaceholderText('Mín PAX');
      const max = screen.getAllByPlaceholderText('Máx PAX');
      const preco = screen.getAllByPlaceholderText('Preço (€)');
      escrever(min[0], '1'); escrever(max[0], '2'); escrever(preco[0], '80');
      escrever(min[1], '3'); escrever(max[1], '4'); escrever(preco[1], '140.5');
      fireEvent.click(removerDe(preco[0]));
      fireEvent.click(botao('Criar tour'));
      expect(metaGravada(onSave).price_tiers).toEqual([{ pax_min: 3, pax_max: 4, price: 140.5 }]);
    });

    it('comodidades: ligar, desligar e religar mantem a ordem do ultimo clique', () => {
      const { onSave } = preencherMinimo();
      fireEvent.click(screen.getByLabelText('Seguro'));
      fireEvent.click(screen.getByLabelText('Vestiário'));
      fireEvent.click(screen.getByLabelText('Seguro'));
      fireEvent.click(screen.getByLabelText('Seguro'));
      expect(screen.getByLabelText('Seguro').checked).toBe(true);
      expect(screen.getByLabelText('Snacks e água').checked).toBe(false);
      fireEvent.click(botao('Criar tour'));
      expect(metaGravada(onSave).amenities).toEqual(['Vestiário', 'Seguro']);
    });

    it('idiomas: desligar todos grava lista vazia', () => {
      const { onSave } = preencherMinimo();
      fireEvent.click(screen.getByLabelText('PT'));
      fireEvent.click(screen.getByLabelText('EN'));
      fireEvent.click(botao('Criar tour'));
      expect(metaGravada(onSave).languages).toEqual([]);
    });

    it('lista as seis linguas e as oito comodidades de atividade', () => {
      renderForm('activity');
      for (const l of ['PT', 'EN', 'DE', 'NL', 'FR', 'ES']) expect(screen.getByLabelText(l)).toBeInTheDocument();
      for (const a of ['Equipamento incluído', 'Instrutor certificado', 'Seguro', 'Fotografias/Vídeo', 'Transporte', 'Snacks e água', 'Vestiário', 'Toalhas']) {
        expect(screen.getByLabelText(a)).toBeInTheDocument();
      }
    });
  });

  describe('editar uma unidade existente', () => {
    const META = {
      name_en: 'Salt Crater Tour',
      short_pt: 'Resumo',
      short_en: 'Summary',
      desc_pt: 'Descricao PT',
      desc_en: 'Description EN',
      tour_type: 'privado',
      duration: 3,
      languages: ['PT', 'NL'],
      difficulty: 'Facil',
      min_age: 0,
      meeting_point: 'Hotel Riu',
      start_time: '08:15',
      price_child: 15,
      price_private: 90,
      price_tiers: [{ pax_min: 1, pax_max: 2, price: 80 }],
      amenities: ['Seguro', 'Toalhas'],
      included_items: [{ label: 'Almoco', included: true }, { label: 'Bebidas', included: false }],
      important_info: 'Levar toalha',
      stops: [{ name: 'Praia', desc: 'Bonita', lat: 16.1, lng: -22.5 }],
      time_slots: [{ time: '08:00', capacity: 6 }],
    };
    const UNIT = {
      id: 't1',
      name: 'Tour Pedra de Lume',
      description: JSON.stringify(META),
      unit_type: 'Pesca',
      base_price: 45,
      capacity: 8,
      status: 'inactive',
      images: ['https://cdn.exemplo/1.jpg', 'https://cdn.exemplo/2.jpg'],
      ota_product_ids: { viator: 'V1', getyourguide: 'G1' },
      lat: 16.7,
      lng: -22.9,
    };

    it('pre-preenche todos os campos a partir da unidade e da descricao em JSON', () => {
      renderForm('activity', { unit: UNIT });
      expect(campo('Nome PT').value).toBe('Tour Pedra de Lume');
      expect(campo('Nome EN').value).toBe('Salt Crater Tour');
      expect(campo('Categoria').value).toBe('Pesca');
      expect(campo('Modalidade').value).toBe('privado');
      expect(campo('Descricao curta PT').value).toBe('Resumo');
      expect(campo('Descricao curta EN').value).toBe('Summary');
      expect(campo('Descricao longa PT').value).toBe('Descricao PT');
      expect(campo('Descricao longa EN').value).toBe('Description EN');
      expect(campo('Duracao (horas)').value).toBe('3');
      expect(campo('Dificuldade').value).toBe('Facil');
      expect(campo('Idade minima').value).toBe('0');
      expect(campo('Capacidade maxima').value).toBe('8');
      expect(campo('Hora de inicio').value).toBe('08:15');
      expect(campo('Ponto de encontro').value).toBe('Hotel Riu');
      expect(campo('Preco adulto (opcional se usar Preço privado/Escalões)').value).toBe('45');
      expect(campo('Preco crianca').value).toBe('15');
      expect(campo('Preco privado').value).toBe('90');
      expect(screen.getByLabelText('PT').checked).toBe(true);
      expect(screen.getByLabelText('EN').checked).toBe(false);
      expect(screen.getByLabelText('NL').checked).toBe(true);
      expect(screen.getByLabelText('Seguro').checked).toBe(true);
      expect(screen.getByLabelText('Toalhas').checked).toBe(true);
      expect(screen.getByLabelText('Transporte').checked).toBe(false);
      expect(screen.getByPlaceholderText('Mín PAX').value).toBe('1');
      expect(screen.getByPlaceholderText('Máx PAX').value).toBe('2');
      expect(screen.getByPlaceholderText('Preço (€)').value).toBe('80');
      expect(screen.getByPlaceholderText('Ex: Pequeno-almoço').value).toBe('Almoco');
      expect(screen.getByPlaceholderText('Ex: Entradas (€5/pessoa), almoço').value).toBe('Bebidas');
      expect(screen.getByPlaceholderText('Ex: Templo do Amanhecer').value).toBe('Praia');
      expect(screen.getByPlaceholderText('Descrição curta (opcional)').value).toBe('Bonita');
      expect(screen.getByPlaceholderText('Latitude (opcional)').value).toBe('16.1');
      expect(screen.getByPlaceholderText('Longitude (opcional)').value).toBe('-22.5');
      expect(screen.getByPlaceholderText('Lugares').value).toBe('6');
      expect(screen.getByPlaceholderText('Lugares').previousElementSibling.value).toBe('08:00');
      expect(porPlaceholder('Ex: Traga roupa confortável e protector solar.').value).toBe('Levar toalha');
      expect(campo('ID produto Viator').value).toBe('V1');
      expect(campo('ID produto GetYourGuide').value).toBe('G1');
      expect(campo('Latitude').value).toBe('16.7');
      expect(campo('Longitude').value).toBe('-22.9');
      expect(seletorEstado().value).toBe('inactive');
      expect(opcoes(seletorEstado())).toEqual([['active', 'Activo'], ['inactive', 'Inactivo']]);
      expect(screen.getByText('2/10')).toBeInTheDocument();
    });

    it('gravar sem mexer reenvia os mesmos dados (numeros como numeros, imagens e estado intactos)', () => {
      const { onSave } = renderForm('activity', { unit: UNIT });
      fireEvent.click(botao('Guardar alteracoes'));
      expect(guardar(onSave)).toStrictEqual({
        name: 'Tour Pedra de Lume',
        description: JSON.stringify({
          name_en: 'Salt Crater Tour',
          short_pt: 'Resumo',
          short_en: 'Summary',
          desc_pt: 'Descricao PT',
          desc_en: 'Description EN',
          tour_type: 'privado',
          duration: 3,
          languages: ['PT', 'NL'],
          difficulty: 'Facil',
          min_age: 0,
          meeting_point: 'Hotel Riu',
          start_time: '08:15',
          price_child: 15,
          price_private: 90,
          price_tiers: [{ pax_min: 1, pax_max: 2, price: 80 }],
          amenities: ['Seguro', 'Toalhas'],
          included_items: [{ label: 'Almoco', included: true }, { label: 'Bebidas', included: false }],
          important_info: 'Levar toalha',
          stops: [{ name: 'Praia', desc: 'Bonita', lat: 16.1, lng: -22.5 }],
          time_slots: [{ time: '08:00', capacity: 6 }],
        }),
        unit_type: 'Pesca',
        base_price: 45,
        price_unit: 'person',
        capacity: 8,
        status: 'inactive',
        images: ['https://cdn.exemplo/1.jpg', 'https://cdn.exemplo/2.jpg'],
        ota_product_ids: { viator: 'V1', getyourguide: 'G1' },
        lat: 16.7,
        lng: -22.9,
      });
    });

    it('mudar o estado para Activo e limpar as coordenadas e os ids de OTA', () => {
      const { onSave } = renderForm('activity', { unit: UNIT });
      escrever(seletorEstado(), 'active');
      escrever(campo('ID produto Viator'), '');
      escrever(campo('ID produto GetYourGuide'), '');
      escrever(campo('Latitude'), '');
      escrever(campo('Longitude'), '');
      fireEvent.click(botao('Guardar alteracoes'));
      const r = guardar(onSave);
      expect(r.status).toBe('active');
      expect(r.ota_product_ids).toStrictEqual({ viator: null, getyourguide: null });
      expect(r.lat).toBeNull();
      expect(r.lng).toBeNull();
    });

    it('descricao em texto simples ou JSON invalido: campos por omissao e o nome da unidade', () => {
      for (const description of ['Descricao antiga em texto', '{nao e json', null, undefined]) {
        const { onSave, unmount } = renderForm('activity', {
          unit: { id: 'x', name: 'Antigo', description, capacity: 3, base_price: 20, status: 'active' },
        });
        expect(campo('Nome PT').value).toBe('Antigo');
        expect(campo('Modalidade').value).toBe('grupo');
        expect(campo('Dificuldade').value).toBe('Moderado');
        expect(campo('Duracao (horas)').value).toBe('');
        fireEvent.click(botao('Guardar alteracoes'));
        const r = guardar(onSave);
        expect(r.description).toBe(JSON.stringify(META_VAZIA));
        expect(r).toMatchObject({ name: 'Antigo', unit_type: 'Tour', base_price: 20, capacity: 3, images: [] });
        unmount();
      }
    });

    it('capacidade 0 ou em falta numa unidade existente', () => {
      const { onSave } = renderForm('activity', {
        unit: { id: 'x', name: 'Sem capacidade', description: null, base_price: null, status: 'active' },
      });
      escrever(campo('Capacidade maxima'), '1');
      fireEvent.click(botao('Guardar alteracoes'));
      expect(guardar(onSave)).toMatchObject({ capacity: 1, base_price: 0 });
    });
  });

  describe('fotos', () => {
    it('remover uma foto existente atualiza as imagens gravadas', () => {
      const unit = {
        id: 't2', name: 'Com fotos', description: null, capacity: 2, base_price: 10, status: 'active',
        images: ['https://cdn.exemplo/a.jpg', 'https://cdn.exemplo/b.jpg'],
      };
      const { onSave } = renderForm('activity', { unit });
      fireEvent.click(screen.getAllByTitle('Remover foto')[0]);
      fireEvent.click(botao('Guardar alteracoes'));
      expect(guardar(onSave).images).toEqual(['https://cdn.exemplo/b.jpg']);
    });

    it('carregar uma foto nova acrescenta o url devolvido pelo servico', async () => {
      URL.createObjectURL = vi.fn(() => 'blob:preview');
      URL.revokeObjectURL = vi.fn();
      vi.mocked(uploadImage).mockResolvedValue({ url: 'https://cdn.exemplo/nova.jpg' });
      const { onSave, container } = renderForm('activity');
      escrever(campo('Nome PT'), 'Tour com foto');
      escrever(campo('Capacidade maxima'), '4');
      const ficheiro = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });
      await act(async () => {
        fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [ficheiro] } });
      });
      await waitFor(() => expect(uploadImage).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(screen.getByText('1/10')).toBeInTheDocument());
      fireEvent.click(botao('Criar tour'));
      expect(guardar(onSave).images).toEqual(['https://cdn.exemplo/nova.jpg']);
      /* O ImageUploader (partilhado, fora deste ficheiro) chama onChange dentro de um atualizador de
         estado e o React avisa disso. E o unico aviso esperado; limpa-se para o afterEach continuar estrito. */
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(String(errorSpy.mock.calls[0][0])).toContain('Cannot update a component');
      errorSpy.mockClear();
    });

    it('mostra a dica e o limite de 10 fotos', () => {
      renderForm('activity');
      expect(screen.getByText('Primeira foto = capa principal · max 10 fotos · 5MB cada')).toBeInTheDocument();
      expect(screen.getByText('0/10')).toBeInTheDocument();
    });
  });
});

/* ---------- Quarto de hotel ---------- */

describe('HotelRoomForm', () => {
  const META_QUARTO_VAZIA = {
    number: null, name: 'Ocean View', floor: null, view: 'Mar', capacity_kids: 0,
    amenities: [], included_items: [], important_info: null, description: null,
    price_low: null, price_mid: null, price_high: null, price_peak: null,
  };

  it('minimo valido: nome e preco base; capacidade 2 e 0 criancas por omissao', () => {
    const { onSave } = renderForm('hotel');
    escrever(campo('Nome'), 'Ocean View');
    escrever(campo('Preco base'), '80');
    fireEvent.click(botao('Criar quarto'));
    expect(guardar(onSave)).toStrictEqual({
      name: 'Ocean View',
      description: JSON.stringify(META_QUARTO_VAZIA),
      unit_type: 'Double',
      base_price: 80,
      price_unit: 'night',
      capacity: 2,
      status: 'active',
      images: [],
      ota_product_ids: OTA_VAZIO,
      lat: null,
      lng: null,
    });
  });

  it('valores por omissao e listas de opcoes', () => {
    renderForm('hotel');
    expect(campo('Tipo').value).toBe('Double');
    expect(campo('Vista').value).toBe('Mar');
    expect(campo('Adultos').value).toBe('2');
    expect(campo('Criancas').value).toBe('0');
    expect(opcoes(campo('Tipo')).map(o => o[0])).toEqual(['Single', 'Double', 'Twin', 'Suite', 'Apartamento', 'Villa', 'Bungalow']);
    expect(opcoes(campo('Vista')).map(o => o[0])).toEqual(['Mar', 'Jardim', 'Piscina', 'Cidade', 'Sem vista']);
    for (const a of ['AC', 'TV', 'WiFi', 'Cofre', 'Minibar', 'Jacuzzi', 'Varanda', 'Banheira', 'Cozinha']) {
      expect(screen.getByLabelText(a)).toBeInTheDocument();
    }
  });

  it('os campos obrigatorios so mostram o asterisco: nada impede gravar vazio (nome "", preco 0)', () => {
    const { onSave } = renderForm('hotel');
    expect(campo('Nome')).not.toBeRequired();
    expect(campo('Preco base')).not.toBeRequired();
    fireEvent.click(botao('Criar quarto'));
    expect(guardar(onSave)).toStrictEqual({
      name: '',
      description: JSON.stringify({ ...META_QUARTO_VAZIA, name: null }),
      unit_type: 'Double',
      base_price: 0,
      price_unit: 'night',
      capacity: 2,
      status: 'active',
      images: [],
      ota_product_ids: OTA_VAZIO,
      lat: null,
      lng: null,
    });
  });

  it('adultos abaixo do minimo (min=1) sao travados pelo navegador', () => {
    const { onSave } = renderForm('hotel');
    escrever(campo('Adultos'), '0');
    fireEvent.click(botao('Criar quarto'));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('todos os campos preenchidos: o numero compoe o nome ("101 — Nome") e a descricao e JSON', () => {
    const { onSave } = renderForm('hotel');
    escrever(campo('Numero'), '101');
    escrever(campo('Nome'), 'Ocean View Suite');
    escrever(campo('Tipo'), 'Suite');
    escrever(campo('Andar'), '3');
    escrever(campo('Vista'), 'Piscina');
    escrever(campo('Adultos'), '3');
    escrever(campo('Criancas'), '2');
    fireEvent.click(screen.getByLabelText('WiFi'));
    fireEvent.click(screen.getByLabelText('AC'));
    fireEvent.click(screen.getByLabelText('TV'));
    fireEvent.click(screen.getByLabelText('TV'));
    escrever(campo('Preco base'), '95.5');
    escrever(campo('Epoca baixa'), '70');
    escrever(campo('Epoca media'), '85');
    escrever(campo('Epoca alta'), '110');
    escrever(campo('Pico'), '150.25');
    escrever(porPlaceholder('Descricao do quarto...'), 'Quarto com varanda');
    fireEvent.click(botao('Adicionar item incluído'));
    fireEvent.click(botao('Adicionar item não incluído'));
    const itens = screen.getAllByPlaceholderText(/^Ex: (Pequeno-almoço|Entradas)/);
    escrever(itens[0], 'Pequeno-almoço');
    escrever(itens[1], '');
    escrever(porPlaceholder('Ex: Check-in a partir das 14h, check-out até às 12h.'), 'Check-in 14h');
    escrever(campo('ID produto Viator'), 'V9');
    escrever(campo('ID produto GetYourGuide'), 'G9');
    escrever(campo('Latitude'), '16.5');
    escrever(campo('Longitude'), '-22.9');
    fireEvent.click(botao('Criar quarto'));
    expect(guardar(onSave)).toStrictEqual({
      name: '101 — Ocean View Suite',
      description: JSON.stringify({
        number: '101',
        name: 'Ocean View Suite',
        floor: '3',
        view: 'Piscina',
        capacity_kids: 2,
        amenities: ['WiFi', 'AC'],
        included_items: [{ label: 'Pequeno-almoço', included: true }],
        important_info: 'Check-in 14h',
        description: 'Quarto com varanda',
        price_low: 70,
        price_mid: 85,
        price_high: 110,
        price_peak: 150.25,
      }),
      unit_type: 'Suite',
      base_price: 95.5,
      price_unit: 'night',
      capacity: 3,
      status: 'active',
      images: [],
      ota_product_ids: { viator: 'V9', getyourguide: 'G9' },
      lat: 16.5,
      lng: -22.9,
    });
  });

  it('criancas vazio grava 0, preco "0" grava 0 e preco vazio grava null', () => {
    const { onSave } = renderForm('hotel');
    escrever(campo('Nome'), 'Quarto');
    escrever(campo('Preco base'), '0');
    escrever(campo('Criancas'), '');
    escrever(campo('Epoca baixa'), '0');
    fireEvent.click(botao('Criar quarto'));
    const r = guardar(onSave);
    expect(r.base_price).toBe(0);
    expect(JSON.parse(r.description)).toMatchObject({ capacity_kids: 0, price_low: 0, price_mid: null });
  });

  it('sem numero o nome fica so o nome', () => {
    const { onSave } = renderForm('hotel');
    escrever(campo('Nome'), 'Sem numero');
    escrever(campo('Preco base'), '10');
    fireEvent.click(botao('Criar quarto'));
    expect(guardar(onSave).name).toBe('Sem numero');
  });

  it('itens incluidos: adicionar, editar e remover', () => {
    const { onSave } = renderForm('hotel');
    escrever(campo('Nome'), 'Quarto');
    escrever(campo('Preco base'), '10');
    fireEvent.click(botao('Adicionar item incluído'));
    fireEvent.click(botao('Adicionar item incluído'));
    const itens = screen.getAllByPlaceholderText('Ex: Pequeno-almoço');
    escrever(itens[0], 'Wifi');
    escrever(itens[1], 'Toalhas');
    fireEvent.click(removerDe(itens[0]));
    fireEvent.click(botao('Criar quarto'));
    expect(JSON.parse(guardar(onSave).description).included_items).toEqual([{ label: 'Toalhas', included: true }]);
  });

  describe('editar uma unidade existente', () => {
    const UNIT = {
      id: 'h1',
      name: '101 — Ocean View',
      description: JSON.stringify({
        number: '101', name: 'Ocean View', floor: '2', view: 'Piscina', capacity_kids: 1,
        amenities: ['AC', 'Cofre'], included_items: [{ label: 'Wifi', included: true }],
        important_info: 'Check-in 14h', description: 'Quarto amplo',
        price_low: 50, price_mid: 60, price_high: 70, price_peak: 0,
      }),
      unit_type: 'Suite',
      capacity: 3,
      base_price: 55,
      status: 'maintenance',
      images: ['https://cdn.exemplo/q1.jpg'],
      ota_product_ids: { viator: 'VH', getyourguide: 'GH' },
      lat: 16.2,
      lng: -22.6,
    };

    it('pre-preenche os campos a partir da unidade e de parseRoomMeta', () => {
      renderForm('hotel', { unit: UNIT });
      expect(campo('Numero').value).toBe('101');
      expect(campo('Nome').value).toBe('Ocean View');
      expect(campo('Tipo').value).toBe('Suite');
      expect(campo('Andar').value).toBe('2');
      expect(campo('Vista').value).toBe('Piscina');
      expect(campo('Adultos').value).toBe('3');
      expect(campo('Criancas').value).toBe('1');
      expect(screen.getByLabelText('AC').checked).toBe(true);
      expect(screen.getByLabelText('Cofre').checked).toBe(true);
      expect(screen.getByLabelText('TV').checked).toBe(false);
      expect(campo('Preco base').value).toBe('55');
      expect(campo('Epoca baixa').value).toBe('50');
      expect(campo('Epoca media').value).toBe('60');
      expect(campo('Epoca alta').value).toBe('70');
      expect(campo('Pico').value).toBe('0');
      expect(porPlaceholder('Descricao do quarto...').value).toBe('Quarto amplo');
      expect(porPlaceholder('Ex: Pequeno-almoço').value).toBe('Wifi');
      expect(porPlaceholder('Ex: Check-in a partir das 14h, check-out até às 12h.').value).toBe('Check-in 14h');
      expect(campo('ID produto Viator').value).toBe('VH');
      expect(campo('ID produto GetYourGuide').value).toBe('GH');
      expect(campo('Latitude').value).toBe('16.2');
      expect(campo('Longitude').value).toBe('-22.6');
      expect(seletorEstado().value).toBe('maintenance');
      expect(opcoes(seletorEstado())).toEqual([
        ['active', 'Activo'], ['cleaning', 'Em limpeza'], ['maintenance', 'Em manutencao'], ['inactive', 'Inactivo'],
      ]);
      expect(screen.getByText('1/10')).toBeInTheDocument();
    });

    it('gravar sem mexer volta a compor o nome uma so vez e reenvia os mesmos dados', () => {
      const { onSave } = renderForm('hotel', { unit: UNIT });
      fireEvent.click(botao('Guardar alteracoes'));
      expect(guardar(onSave)).toStrictEqual({
        name: '101 — Ocean View',
        description: JSON.stringify({
          number: '101',
          name: 'Ocean View',
          floor: '2',
          view: 'Piscina',
          capacity_kids: 1,
          amenities: ['AC', 'Cofre'],
          included_items: [{ label: 'Wifi', included: true }],
          important_info: 'Check-in 14h',
          description: 'Quarto amplo',
          price_low: 50,
          price_mid: 60,
          price_high: 70,
          price_peak: 0,
        }),
        unit_type: 'Suite',
        base_price: 55,
        price_unit: 'night',
        capacity: 3,
        status: 'maintenance',
        images: ['https://cdn.exemplo/q1.jpg'],
        ota_product_ids: { viator: 'VH', getyourguide: 'GH' },
        lat: 16.2,
        lng: -22.6,
      });
    });

    it('registo antigo sem meta.name: stripComposedPrefix remove o prefixo "numero — " uma vez', () => {
      const unit = {
        id: 'h2', name: '101 — 101 — Deluxe', capacity: 2, base_price: 40, status: 'active',
        description: JSON.stringify({ number: '101' }),
      };
      const { onSave } = renderForm('hotel', { unit });
      expect(campo('Nome').value).toBe('101 — Deluxe');
      fireEvent.click(botao('Guardar alteracoes'));
      expect(guardar(onSave).name).toBe('101 — 101 — Deluxe');
    });

    it('registo antigo: nome sem prefixo, sem numero ou sem nome fica como esta', () => {
      let r = renderForm('hotel', {
        unit: { id: 'a', name: 'Deluxe', description: JSON.stringify({ number: '101' }), capacity: 2, base_price: 1 },
      });
      expect(campo('Nome').value).toBe('Deluxe');
      r.unmount();

      r = renderForm('hotel', {
        unit: { id: 'b', name: '101 — Deluxe', description: 'texto simples', capacity: 2, base_price: 1 },
      });
      expect(campo('Nome').value).toBe('101 — Deluxe');
      expect(campo('Numero').value).toBe('');
      r.unmount();

      r = renderForm('hotel', { unit: { id: 'c', description: null, capacity: 2, base_price: 1 } });
      expect(campo('Nome').value).toBe('');
      r.unmount();
    });

    it('meta.name tem prioridade sobre o nome composto, mesmo vazio', () => {
      renderForm('hotel', {
        unit: {
          id: 'd', name: '5 — Antigo', capacity: 2, base_price: 1,
          description: JSON.stringify({ number: '5', name: '' }),
        },
      });
      expect(campo('Nome').value).toBe('');
    });

    it('mudar o estado e gravar', () => {
      const { onSave } = renderForm('hotel', { unit: UNIT });
      escrever(seletorEstado(), 'cleaning');
      fireEvent.click(botao('Guardar alteracoes'));
      expect(guardar(onSave).status).toBe('cleaning');
    });

    it('remover a foto existente grava imagens vazias', () => {
      const { onSave } = renderForm('hotel', { unit: UNIT });
      fireEvent.click(screen.getByTitle('Remover foto'));
      fireEvent.click(botao('Guardar alteracoes'));
      expect(guardar(onSave).images).toEqual([]);
    });
  });
});

/* ---------- Viatura (rentacar) ---------- */

describe('RentacarVehicleForm', () => {
  const META_VIATURA_VAZIA = {
    brand: null, model: null, year: null, plate: null, color: null, seats: 5, luggage: null,
    transmission: 'manual', fuel: 'gasolina', amenities: [], included_items: [], important_info: null,
    discount_week: null, discount_month: null, km_included: null, km_extra_cost: null,
    chauffeur_daily_rate: null, min_age: 21, license_years: 1,
    seguro_expiry: null, iuc_expiry: null, inspecao_expiry: null,
    current_km: null, next_revision_km: null, maintenance_history: [],
  };

  it('minimo valido: so o preco base; sem marca, modelo, matricula nem nome o nome e "Viatura"', () => {
    const { onSave } = renderForm('rentacar');
    escrever(campo('Preco base / dia'), '45');
    fireEvent.click(botao('Registar viatura'));
    expect(guardar(onSave)).toStrictEqual({
      name: 'Viatura',
      description: JSON.stringify(META_VIATURA_VAZIA),
      unit_type: 'Compacto',
      base_price: 45,
      price_unit: 'day',
      capacity: 5,
      status: 'active',
      images: [],
      ota_product_ids: OTA_VAZIO,
      lat: null,
      lng: null,
    });
  });

  it('valores por omissao e listas de opcoes', () => {
    renderForm('rentacar');
    expect(campo('Categoria').value).toBe('Compacto');
    expect(campo('Lugares').value).toBe('5');
    expect(campo('Transmissao').value).toBe('manual');
    expect(campo('Combustivel').value).toBe('gasolina');
    expect(campo('Idade minima').value).toBe('21');
    expect(campo('Carta ha (anos)').value).toBe('1');
    expect(opcoes(campo('Categoria')).map(o => o[0])).toEqual(['Economico', 'Compacto', 'SUV', 'Pickup', 'Moto', 'Van', 'Executivo']);
    expect(opcoes(campo('Transmissao'))).toEqual([['manual', 'Manual'], ['automatico', 'Automatico']]);
    expect(opcoes(campo('Combustivel'))).toEqual([
      ['gasolina', 'Gasolina'], ['diesel', 'Diesel'], ['electrico', 'Electrico'], ['hibrido', 'Hibrido'],
    ]);
    for (const a of ['AC', 'GPS', 'Bluetooth', 'USB', 'Cadeira bebe', '4x4', 'Teto solar', 'Camera re']) {
      expect(screen.getByLabelText(a)).toBeInTheDocument();
    }
    expect(screen.queryByText('Tarifa de motorista (por dia)')).toBeNull();
  });

  it('o preco base so mostra o asterisco: nada impede gravar vazio (preco 0)', () => {
    const { onSave } = renderForm('rentacar');
    expect(campo('Preco base / dia')).not.toBeRequired();
    fireEvent.click(botao('Registar viatura'));
    const v = guardar(onSave);
    expect(v.base_price).toBe(0);
    expect(v.name).toBe('Viatura');
  });

  it('lugares abaixo do minimo (min=1) sao travados pelo navegador', () => {
    const { onSave } = renderForm('rentacar');
    escrever(campo('Lugares'), '0');
    fireEvent.click(botao('Registar viatura'));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('todos os campos preenchidos: nome = marca + modelo, numeros vs texto, ordem das chaves', () => {
    const { onSave } = renderForm('rentacar');
    escrever(campo('Marca'), 'Toyota');
    escrever(campo('Modelo'), 'Hilux');
    escrever(campo('Ano'), '2022');
    escrever(campo('Matricula'), 'AA-00-AA');
    escrever(campo('Cor'), 'Branco');
    escrever(campo('Categoria'), 'Pickup');
    escrever(campo('Lugares'), '4');
    escrever(campo('Bagagens'), '2');
    escrever(campo('Transmissao'), 'automatico');
    escrever(campo('Combustivel'), 'diesel');
    fireEvent.click(screen.getByLabelText('GPS'));
    fireEvent.click(screen.getByLabelText('4x4'));
    fireEvent.click(screen.getByLabelText('USB'));
    fireEvent.click(screen.getByLabelText('USB'));
    escrever(campo('Preco base / dia'), '60.5');
    escrever(campo('Km incluidos / dia'), '200');
    escrever(campo('Custo km extra (€)'), '0.3');
    escrever(campo('Desc. semana (%)'), '10');
    escrever(campo('Desc. mes (%)'), '20');
    escrever(campo('Idade minima'), '23');
    escrever(campo('Carta ha (anos)'), '3');
    escrever(campo('Seguro ate'), '2027-01-31');
    escrever(campo('IUC ate'), '2027-02-28');
    escrever(campo('Inspecao ate'), '2027-03-31');
    escrever(campo('Km actuais'), '15000');
    escrever(campo('Proxima revisao (km)'), '20000');
    fireEvent.click(botao('Adicionar item incluído'));
    escrever(porPlaceholder('Ex: Pequeno-almoço'), 'Seguro basico');
    escrever(porPlaceholder('Ex: Caução exigida no levantamento, cartão de crédito obrigatório.'), 'Caucao 300');
    escrever(campo('ID produto Viator'), 'VV');
    escrever(campo('ID produto GetYourGuide'), 'GG');
    escrever(campo('Latitude'), '16.7');
    escrever(campo('Longitude'), '-22.9');
    fireEvent.click(botao('Registar viatura'));
    expect(guardar(onSave)).toStrictEqual({
      name: 'Toyota Hilux',
      description: JSON.stringify({
        brand: 'Toyota',
        model: 'Hilux',
        year: 2022,
        plate: 'AA-00-AA',
        color: 'Branco',
        seats: 4,
        luggage: '2',
        transmission: 'automatico',
        fuel: 'diesel',
        amenities: ['GPS', '4x4'],
        included_items: [{ label: 'Seguro basico', included: true }],
        important_info: 'Caucao 300',
        discount_week: 10,
        discount_month: 20,
        km_included: 200,
        km_extra_cost: 0.3,
        chauffeur_daily_rate: null,
        min_age: 23,
        license_years: 3,
        seguro_expiry: '2027-01-31',
        iuc_expiry: '2027-02-28',
        inspecao_expiry: '2027-03-31',
        current_km: 15000,
        next_revision_km: 20000,
        maintenance_history: [],
      }),
      unit_type: 'Pickup',
      base_price: 60.5,
      price_unit: 'day',
      capacity: 4,
      status: 'active',
      images: [],
      ota_product_ids: { viator: 'VV', getyourguide: 'GG' },
      lat: 16.7,
      lng: -22.9,
    });
  });

  it('o nome cai para marca, modelo, matricula e "Viatura" por esta ordem', () => {
    const casos = [
      [{ 'Marca': 'Fiat' }, 'Fiat'],
      [{ 'Modelo': 'Panda' }, 'Panda'],
      [{ 'Matricula': 'ZZ-11-ZZ' }, 'ZZ-11-ZZ'],
      [{ 'Marca': 'Fiat', 'Matricula': 'ZZ-11-ZZ' }, 'Fiat'],
      [{}, 'Viatura'],
    ];
    for (const [campos, esperado] of casos) {
      const { onSave, unmount } = renderForm('rentacar');
      for (const [k, v] of Object.entries(campos)) escrever(campo(k), v);
      escrever(campo('Preco base / dia'), '10');
      fireEvent.click(botao('Registar viatura'));
      expect(guardar(onSave).name).toBe(esperado);
      unmount();
    }
  });

  it('lugares vazio ou 0 grava capacidade 5 e seats null/0 conforme o campo', () => {
    let r = renderForm('rentacar');
    escrever(campo('Preco base / dia'), '10');
    escrever(campo('Lugares'), '');
    fireEvent.click(botao('Registar viatura'));
    let v = guardar(r.onSave);
    expect(v.capacity).toBe(5);
    expect(JSON.parse(v.description).seats).toBeNull();
    r.unmount();

    r = renderForm('rentacar');
    escrever(campo('Preco base / dia'), '10');
    escrever(campo('Lugares'), '0');
    fireEvent.submit(r.container.querySelector('form'));
    v = guardar(r.onSave);
    expect(v.capacity).toBe(5);
    expect(JSON.parse(v.description).seats).toBe(0);
  });

  it('Executivo mostra a tarifa de motorista e so entao ela e gravada', () => {
    const { onSave } = renderForm('rentacar');
    escrever(campo('Preco base / dia'), '90');
    escrever(campo('Categoria'), 'Executivo');
    expect(screen.getByText('Cobrada por dia quando o cliente escolhe "motorista incluido" na reserva.')).toBeInTheDocument();
    escrever(campo('Tarifa de motorista (por dia)'), '30');
    fireEvent.click(botao('Registar viatura'));
    let v = guardar(onSave);
    expect(v.unit_type).toBe('Executivo');
    expect(JSON.parse(v.description).chauffeur_daily_rate).toBe(30);

    /* voltar a outra categoria esconde o campo e descarta o valor escrito */
    onSave.mockClear();
    escrever(campo('Categoria'), 'SUV');
    expect(screen.queryByText('Tarifa de motorista (por dia)')).toBeNull();
    fireEvent.click(botao('Registar viatura'));
    v = guardar(onSave);
    expect(v.unit_type).toBe('SUV');
    expect(JSON.parse(v.description).chauffeur_daily_rate).toBeNull();
  });

  it('a seccao de fotos aceita ate 8 fotos', () => {
    renderForm('rentacar');
    expect(screen.getByText('Primeira foto = capa · max 8 fotos · 5MB cada')).toBeInTheDocument();
    expect(screen.getByText('0/8')).toBeInTheDocument();
  });

  describe('editar uma unidade existente', () => {
    const HISTORICO = [{ date: '2026-05-01', km: 12000, note: 'Oleo' }];
    const UNIT = {
      id: 'v1',
      name: 'Toyota Hilux',
      description: JSON.stringify({
        brand: 'Toyota', model: 'Hilux', year: 2022, plate: 'AA-11-BB', color: 'Branco',
        seats: 7, luggage: 3, transmission: 'automatico', fuel: 'diesel',
        amenities: ['GPS'], included_items: [{ label: 'Seguro basico', included: true }],
        important_info: 'Caucao', discount_week: 10, discount_month: 20, km_included: 200,
        km_extra_cost: 0.3, chauffeur_daily_rate: 30, min_age: 23, license_years: 2,
        seguro_expiry: '2027-01-31', iuc_expiry: '2027-02-28', inspecao_expiry: '2027-03-31',
        current_km: 15000, next_revision_km: 20000, maintenance_history: HISTORICO,
      }),
      unit_type: 'Executivo',
      base_price: 60,
      capacity: 7,
      status: 'breakdown',
      images: ['https://cdn.exemplo/v1.jpg'],
      ota_product_ids: { viator: 'VV1', getyourguide: 'GG1' },
      lat: 16.6,
      lng: -22.8,
    };

    it('pre-preenche os campos a partir da unidade e de parseVehicleMeta', () => {
      renderForm('rentacar', { unit: UNIT });
      expect(campo('Marca').value).toBe('Toyota');
      expect(campo('Modelo').value).toBe('Hilux');
      expect(campo('Ano').value).toBe('2022');
      expect(campo('Matricula').value).toBe('AA-11-BB');
      expect(campo('Cor').value).toBe('Branco');
      expect(campo('Categoria').value).toBe('Executivo');
      expect(campo('Lugares').value).toBe('7');
      expect(campo('Bagagens').value).toBe('3');
      expect(campo('Transmissao').value).toBe('automatico');
      expect(campo('Combustivel').value).toBe('diesel');
      expect(campo('Tarifa de motorista (por dia)').value).toBe('30');
      expect(screen.getByLabelText('GPS').checked).toBe(true);
      expect(screen.getByLabelText('AC').checked).toBe(false);
      expect(campo('Preco base / dia').value).toBe('60');
      expect(campo('Km incluidos / dia').value).toBe('200');
      expect(campo('Custo km extra (€)').value).toBe('0.3');
      expect(campo('Desc. semana (%)').value).toBe('10');
      expect(campo('Desc. mes (%)').value).toBe('20');
      expect(campo('Idade minima').value).toBe('23');
      expect(campo('Carta ha (anos)').value).toBe('2');
      expect(campo('Seguro ate').value).toBe('2027-01-31');
      expect(campo('IUC ate').value).toBe('2027-02-28');
      expect(campo('Inspecao ate').value).toBe('2027-03-31');
      expect(campo('Km actuais').value).toBe('15000');
      expect(campo('Proxima revisao (km)').value).toBe('20000');
      expect(porPlaceholder('Ex: Pequeno-almoço').value).toBe('Seguro basico');
      expect(porPlaceholder('Ex: Caução exigida no levantamento, cartão de crédito obrigatório.').value).toBe('Caucao');
      expect(campo('ID produto Viator').value).toBe('VV1');
      expect(campo('Latitude').value).toBe('16.6');
      expect(seletorEstado().value).toBe('breakdown');
      expect(opcoes(seletorEstado())).toEqual([
        ['active', 'Activo'], ['maintenance', 'Em manutencao'], ['breakdown', 'Avaria'], ['inactive', 'Inactivo'],
      ]);
      expect(screen.getByText('1/8')).toBeInTheDocument();
    });

    it('gravar sem mexer reenvia tudo, incluindo o historico de manutencao que o formulario nao edita', () => {
      const { onSave } = renderForm('rentacar', { unit: UNIT });
      fireEvent.click(botao('Guardar alteracoes'));
      expect(guardar(onSave)).toStrictEqual({
        name: 'Toyota Hilux',
        description: JSON.stringify({
          brand: 'Toyota',
          model: 'Hilux',
          year: 2022,
          plate: 'AA-11-BB',
          color: 'Branco',
          seats: 7,
          luggage: 3,
          transmission: 'automatico',
          fuel: 'diesel',
          amenities: ['GPS'],
          included_items: [{ label: 'Seguro basico', included: true }],
          important_info: 'Caucao',
          discount_week: 10,
          discount_month: 20,
          km_included: 200,
          km_extra_cost: 0.3,
          chauffeur_daily_rate: 30,
          min_age: 23,
          license_years: 2,
          seguro_expiry: '2027-01-31',
          iuc_expiry: '2027-02-28',
          inspecao_expiry: '2027-03-31',
          current_km: 15000,
          next_revision_km: 20000,
          maintenance_history: HISTORICO,
        }),
        unit_type: 'Executivo',
        base_price: 60,
        price_unit: 'day',
        capacity: 7,
        status: 'breakdown',
        images: ['https://cdn.exemplo/v1.jpg'],
        ota_product_ids: { viator: 'VV1', getyourguide: 'GG1' },
        lat: 16.6,
        lng: -22.8,
      });
    });

    it('mudar a categoria de Executivo para outra descarta a tarifa de motorista', () => {
      const { onSave } = renderForm('rentacar', { unit: UNIT });
      escrever(campo('Categoria'), 'Van');
      expect(screen.queryByText('Tarifa de motorista (por dia)')).toBeNull();
      fireEvent.click(botao('Guardar alteracoes'));
      expect(JSON.parse(guardar(onSave).description).chauffeur_daily_rate).toBeNull();
    });

    it('sem marca nem modelo usa o nome ja guardado na unidade', () => {
      const unit = { id: 'v2', name: 'Hilux Branco', description: null, base_price: 20, capacity: 5, status: 'active' };
      const { onSave } = renderForm('rentacar', { unit });
      expect(campo('Marca').value).toBe('');
      fireEvent.click(botao('Guardar alteracoes'));
      expect(guardar(onSave).name).toBe('Hilux Branco');
    });

    it('registo antigo com texto simples na descricao usa os valores por omissao', () => {
      const unit = { id: 'v3', name: 'Carro', description: 'Carro economico', base_price: 20, capacity: 4, status: 'active' };
      const { onSave } = renderForm('rentacar', { unit });
      expect(campo('Lugares').value).toBe('5');
      expect(campo('Idade minima').value).toBe('21');
      fireEvent.click(botao('Guardar alteracoes'));
      const v = guardar(onSave);
      expect(v.description).toBe(JSON.stringify(META_VIATURA_VAZIA));
      expect(v.name).toBe('Carro');
      expect(v.capacity).toBe(5);
    });

    it('mudar o estado e gravar', () => {
      const { onSave } = renderForm('rentacar', { unit: UNIT });
      escrever(seletorEstado(), 'maintenance');
      fireEvent.click(botao('Guardar alteracoes'));
      expect(guardar(onSave).status).toBe('maintenance');
    });
  });
});

/* ---------- Mesa de restaurante ---------- */

describe('RestaurantTableForm', () => {
  const META_MESA_VAZIA = {
    number: null, name: null, zone: 'interior', capacity_min: 1, capacity_max: 4, combinable: false,
    amenities: [], included_items: [], important_info: null,
  };

  it('minimo valido: nada preenchido grava a mesa "Mesa" com 1 a 4 pessoas na zona interior', () => {
    const { onSave } = renderForm('restaurant');
    fireEvent.click(botao('Criar mesa'));
    expect(guardar(onSave)).toStrictEqual({
      name: 'Mesa',
      description: JSON.stringify(META_MESA_VAZIA),
      unit_type: 'Interior',
      base_price: 0,
      price_unit: 'hour',
      capacity: 4,
      status: 'active',
      images: [],
      ota_product_ids: OTA_VAZIO,
      lat: null,
      lng: null,
    });
  });

  it('valores por omissao e listas de opcoes; sem seccao de fotos', () => {
    renderForm('restaurant');
    expect(campo('Zona').value).toBe('interior');
    expect(campo('Minimo (pessoas)').value).toBe('1');
    expect(campo('Maximo (pessoas)').value).toBe('4');
    expect(screen.getByLabelText('Mesa combinavel com outras').checked).toBe(false);
    expect(opcoes(campo('Zona'))).toEqual([
      ['interior', 'Interior'], ['esplanada', 'Esplanada'], ['terraco', 'Terraco'], ['vip', 'VIP'], ['privado', 'Privado'],
    ]);
    for (const a of ['WiFi', 'Ar condicionado', 'Vista mar', 'Terraço', 'Acesso cadeira de rodas', 'Estacionamento', 'Música ao vivo', 'Ambiente para crianças']) {
      expect(screen.getByLabelText(a)).toBeInTheDocument();
    }
    expect(screen.queryByText('Fotos')).toBeNull();
  });

  it('capacidade minima ou maxima vazia (so asterisco) cai para 1 e 4', () => {
    const { onSave } = renderForm('restaurant');
    expect(campo('Minimo (pessoas)')).not.toBeRequired();
    expect(campo('Maximo (pessoas)')).not.toBeRequired();
    escrever(campo('Minimo (pessoas)'), '');
    escrever(campo('Maximo (pessoas)'), '');
    fireEvent.click(botao('Criar mesa'));
    const v = guardar(onSave);
    expect(v.capacity).toBe(4);
    expect(JSON.parse(v.description)).toMatchObject({ capacity_min: 1, capacity_max: 4 });
  });

  it('capacidade abaixo do minimo (min=1) e travada pelo navegador', () => {
    const { onSave } = renderForm('restaurant');
    escrever(campo('Maximo (pessoas)'), '0');
    fireEvent.click(botao('Criar mesa'));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('todos os campos preenchidos: "Mesa N — Nome", unit_type pela zona e capacidade = maximo', () => {
    const { onSave } = renderForm('restaurant');
    escrever(campo('Numero'), '12');
    escrever(campo('Nome / descricao (opcional)'), 'Terraco Vista Mar');
    escrever(campo('Zona'), 'vip');
    escrever(campo('Minimo (pessoas)'), '2');
    escrever(campo('Maximo (pessoas)'), '6');
    fireEvent.click(screen.getByLabelText('Mesa combinavel com outras'));
    fireEvent.click(screen.getByLabelText('Vista mar'));
    fireEvent.click(screen.getByLabelText('WiFi'));
    fireEvent.click(screen.getByLabelText('Terraço'));
    fireEvent.click(screen.getByLabelText('Terraço'));
    fireEvent.click(botao('Adicionar item incluído'));
    fireEvent.click(botao('Adicionar item não incluído'));
    const itens = screen.getAllByPlaceholderText(/^Ex: (Pequeno-almoço|Entradas)/);
    escrever(itens[0], 'Pao');
    escrever(itens[1], 'Bebidas');
    escrever(porPlaceholder('Ex: Reserva mantida por 15 minutos após a hora marcada.'), 'Mantida 15 min');
    escrever(campo('ID produto Viator'), 'VM');
    escrever(campo('ID produto GetYourGuide'), 'GM');
    escrever(campo('Latitude'), '16.1');
    escrever(campo('Longitude'), '-22.3');
    fireEvent.click(botao('Criar mesa'));
    expect(guardar(onSave)).toStrictEqual({
      name: 'Mesa 12 — Terraco Vista Mar',
      description: JSON.stringify({
        number: '12',
        name: 'Terraco Vista Mar',
        zone: 'vip',
        capacity_min: 2,
        capacity_max: 6,
        combinable: true,
        amenities: ['Vista mar', 'WiFi'],
        included_items: [{ label: 'Pao', included: true }, { label: 'Bebidas', included: false }],
        important_info: 'Mantida 15 min',
      }),
      unit_type: 'VIP',
      base_price: 0,
      price_unit: 'hour',
      capacity: 6,
      status: 'active',
      images: [],
      ota_product_ids: { viator: 'VM', getyourguide: 'GM' },
      lat: 16.1,
      lng: -22.3,
    });
  });

  it('composicao do nome: so numero, so nome, ambos e nenhum', () => {
    const casos = [
      [{ 'Numero': '5' }, 'Mesa 5'],
      [{ 'Nome / descricao (opcional)': 'Esplanada Norte' }, 'Esplanada Norte'],
      [{ 'Numero': '5', 'Nome / descricao (opcional)': 'Norte' }, 'Mesa 5 — Norte'],
      [{}, 'Mesa'],
    ];
    for (const [campos, esperado] of casos) {
      const { onSave, unmount } = renderForm('restaurant');
      for (const [k, v] of Object.entries(campos)) escrever(campo(k), v);
      fireEvent.click(botao('Criar mesa'));
      expect(guardar(onSave).name).toBe(esperado);
      unmount();
    }
  });

  it('o unit_type vem do rotulo da zona', () => {
    const esperados = { interior: 'Interior', esplanada: 'Esplanada', terraco: 'Terraco', vip: 'VIP', privado: 'Privado' };
    for (const [zona, rotulo] of Object.entries(esperados)) {
      const { onSave, unmount } = renderForm('restaurant');
      escrever(campo('Zona'), zona);
      fireEvent.click(botao('Criar mesa'));
      const v = guardar(onSave);
      expect(v.unit_type).toBe(rotulo);
      expect(JSON.parse(v.description).zone).toBe(zona);
      unmount();
    }
  });

  it('capacidades invalidas (0) caem para 1 e 4 quando o submit passa por cima da validacao do navegador', () => {
    const { onSave, container } = renderForm('restaurant');
    escrever(campo('Minimo (pessoas)'), '0');
    escrever(campo('Maximo (pessoas)'), '0');
    fireEvent.submit(container.querySelector('form'));
    const v = guardar(onSave);
    expect(v.capacity).toBe(4);
    expect(JSON.parse(v.description)).toMatchObject({ capacity_min: 1, capacity_max: 4 });
  });

  it('a opcao combinavel liga e desliga', () => {
    const { onSave } = renderForm('restaurant');
    const caixa = screen.getByLabelText('Mesa combinavel com outras');
    fireEvent.click(caixa);
    fireEvent.click(caixa);
    fireEvent.click(botao('Criar mesa'));
    expect(JSON.parse(guardar(onSave).description).combinable).toBe(false);
  });

  it('itens incluidos: adicionar e remover', () => {
    const { onSave } = renderForm('restaurant');
    fireEvent.click(botao('Adicionar item incluído'));
    fireEvent.click(botao('Adicionar item incluído'));
    const itens = screen.getAllByPlaceholderText('Ex: Pequeno-almoço');
    escrever(itens[0], 'Agua');
    escrever(itens[1], 'Pao');
    fireEvent.click(removerDe(itens[1]));
    fireEvent.click(botao('Criar mesa'));
    expect(JSON.parse(guardar(onSave).description).included_items).toEqual([{ label: 'Agua', included: true }]);
  });

  describe('editar uma unidade existente', () => {
    const UNIT = {
      id: 'm1',
      name: 'Mesa 12 — Terraco',
      description: JSON.stringify({
        number: '12', name: 'Terraco', zone: 'esplanada', capacity_min: 2, capacity_max: 6,
        combinable: true, amenities: ['WiFi'], included_items: [{ label: 'Pao', included: true }],
        important_info: 'Mantida 15 min',
      }),
      unit_type: 'Esplanada',
      capacity: 6,
      status: 'inactive',
      images: ['https://cdn.exemplo/m1.jpg'],
      ota_product_ids: { viator: 'VM1', getyourguide: 'GM1' },
      lat: 16.3,
      lng: -22.1,
    };

    it('pre-preenche os campos a partir da unidade e de parseTableMeta', () => {
      renderForm('restaurant', { unit: UNIT });
      expect(campo('Numero').value).toBe('12');
      expect(campo('Nome / descricao (opcional)').value).toBe('Terraco');
      expect(campo('Zona').value).toBe('esplanada');
      expect(campo('Minimo (pessoas)').value).toBe('2');
      expect(campo('Maximo (pessoas)').value).toBe('6');
      expect(screen.getByLabelText('Mesa combinavel com outras').checked).toBe(true);
      expect(screen.getByLabelText('WiFi').checked).toBe(true);
      expect(screen.getByLabelText('Vista mar').checked).toBe(false);
      expect(porPlaceholder('Ex: Pequeno-almoço').value).toBe('Pao');
      expect(porPlaceholder('Ex: Reserva mantida por 15 minutos após a hora marcada.').value).toBe('Mantida 15 min');
      expect(campo('ID produto Viator').value).toBe('VM1');
      expect(campo('ID produto GetYourGuide').value).toBe('GM1');
      expect(campo('Latitude').value).toBe('16.3');
      expect(campo('Longitude').value).toBe('-22.1');
      expect(seletorEstado().value).toBe('inactive');
      expect(opcoes(seletorEstado())).toEqual([['active', 'Activa'], ['inactive', 'Bloqueada']]);
    });

    it('gravar sem mexer reenvia os mesmos dados e preserva as imagens da unidade', () => {
      const { onSave } = renderForm('restaurant', { unit: UNIT });
      fireEvent.click(botao('Guardar alteracoes'));
      expect(guardar(onSave)).toStrictEqual({
        name: 'Mesa 12 — Terraco',
        description: JSON.stringify({
          number: '12',
          name: 'Terraco',
          zone: 'esplanada',
          capacity_min: 2,
          capacity_max: 6,
          combinable: true,
          amenities: ['WiFi'],
          included_items: [{ label: 'Pao', included: true }],
          important_info: 'Mantida 15 min',
        }),
        unit_type: 'Esplanada',
        base_price: 0,
        price_unit: 'hour',
        capacity: 6,
        status: 'inactive',
        images: ['https://cdn.exemplo/m1.jpg'],
        ota_product_ids: { viator: 'VM1', getyourguide: 'GM1' },
        lat: 16.3,
        lng: -22.1,
      });
    });

    it('registo antigo sem meta.name: stripMesaPrefix remove "Mesa N — " uma vez', () => {
      const unit = {
        id: 'm2', name: 'Mesa 7 — Mesa 7 — Janela', capacity: 4, status: 'active',
        description: JSON.stringify({ number: '7' }),
      };
      const { onSave } = renderForm('restaurant', { unit });
      expect(campo('Nome / descricao (opcional)').value).toBe('Mesa 7 — Janela');
      fireEvent.click(botao('Guardar alteracoes'));
      expect(guardar(onSave).name).toBe('Mesa 7 — Mesa 7 — Janela');
    });

    it('registo antigo: nome sem prefixo, sem numero ou sem nome fica como esta', () => {
      let r = renderForm('restaurant', {
        unit: { id: 'a', name: 'Janela', description: JSON.stringify({ number: '7' }), capacity: 4 },
      });
      expect(campo('Nome / descricao (opcional)').value).toBe('Janela');
      r.unmount();

      r = renderForm('restaurant', {
        unit: { id: 'b', name: 'Mesa 7 — Janela', description: 'texto', capacity: 4 },
      });
      expect(campo('Nome / descricao (opcional)').value).toBe('Mesa 7 — Janela');
      expect(campo('Numero').value).toBe('');
      r.unmount();

      r = renderForm('restaurant', { unit: { id: 'c', description: null, capacity: 4 } });
      expect(campo('Nome / descricao (opcional)').value).toBe('');
      r.unmount();
    });

    it('sem capacity_max na descricao usa a capacidade da unidade (e 4 se nao houver)', () => {
      let r = renderForm('restaurant', {
        unit: { id: 'a', name: 'Mesa', description: JSON.stringify({ number: '1' }), capacity: 8 },
      });
      expect(campo('Maximo (pessoas)').value).toBe('8');
      expect(campo('Minimo (pessoas)').value).toBe('1');
      r.unmount();

      r = renderForm('restaurant', { unit: { id: 'b', name: 'Mesa', description: null } });
      expect(campo('Maximo (pessoas)').value).toBe('4');
      r.unmount();
    });

    it('mudar o estado para Activa e gravar', () => {
      const { onSave } = renderForm('restaurant', { unit: UNIT });
      escrever(seletorEstado(), 'active');
      fireEvent.click(botao('Guardar alteracoes'));
      expect(guardar(onSave).status).toBe('active');
    });
  });
});

/* ---------- Formulario generico (tipo de operador sem formulario proprio) ---------- */

describe('formulario generico', () => {
  it('minimo valido: nome e preco base; unit_type fica vazio porque o tipo nao tem lista', () => {
    const { onSave } = renderForm('transfer');
    escrever(campo('Nome'), 'Transfer aeroporto');
    escrever(campo('Preco base (€)'), '25');
    fireEvent.click(botao('Nova Unidade'));
    expect(guardar(onSave)).toStrictEqual({
      name: 'Transfer aeroporto',
      description: '',
      unit_type: '',
      base_price: 25,
      price_unit: 'day',
      capacity: 1,
      status: 'active',
      images: [],
      ota_product_ids: OTA_VAZIO,
      lat: null,
      lng: null,
    });
  });

  it('todos os campos preenchidos', () => {
    const { onSave } = renderForm(undefined);
    escrever(campo('Nome'), 'Transfer');
    escrever(campo('Tipo'), 'Outro');
    escrever(campo('Unidade de preco'), 'day');
    escrever(campo('Preco base (€)'), '30.5');
    escrever(campo('Capacidade'), '8');
    escrever(campo('Descricao'), 'Carrinha de 8 lugares');
    escrever(campo('ID produto Viator'), 'VT');
    escrever(campo('ID produto GetYourGuide'), 'GT');
    escrever(campo('Latitude'), '16.75');
    escrever(campo('Longitude'), '-22.95');
    fireEvent.click(botao('Nova Unidade'));
    expect(guardar(onSave)).toStrictEqual({
      name: 'Transfer',
      description: 'Carrinha de 8 lugares',
      unit_type: 'Outro',
      base_price: 30.5,
      price_unit: 'day',
      capacity: 8,
      status: 'active',
      images: [],
      ota_product_ids: { viator: 'VT', getyourguide: 'GT' },
      lat: 16.75,
      lng: -22.95,
    });
  });

  it('listas de opcoes por omissao e etiquetas traduzidas', () => {
    renderForm('transfer');
    expect(opcoes(campo('Tipo'))).toEqual([['Outro', 'Outro']]);
    expect(opcoes(campo('Unidade de preco'))).toEqual([['day', 'por dia']]);
    expect(campo('Capacidade').value).toBe('1');
  });

  it('os campos obrigatorios so mostram o asterisco: nada impede gravar vazio', () => {
    const { onSave } = renderForm('transfer');
    expect(campo('Nome')).not.toBeRequired();
    fireEvent.click(botao('Nova Unidade'));
    expect(guardar(onSave)).toStrictEqual({
      name: '',
      description: '',
      unit_type: '',
      base_price: 0,
      price_unit: 'day',
      capacity: 1,
      status: 'active',
      images: [],
      ota_product_ids: OTA_VAZIO,
      lat: null,
      lng: null,
    });
  });

  it('capacidade abaixo do minimo (min=1) e travada pelo navegador', () => {
    const { onSave } = renderForm('transfer');
    escrever(campo('Capacidade'), '0');
    fireEvent.click(botao('Nova Unidade'));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('editar: pre-preenche, mostra o estado traduzido e reenvia a descricao em texto simples', () => {
    const unit = {
      id: 'g1', name: 'Transfer', description: 'Texto simples', unit_type: 'Van', base_price: 20,
      price_unit: 'hour', capacity: 6, status: 'inactive', images: ['https://cdn.exemplo/g.jpg'],
      ota_product_ids: { viator: 'VG', getyourguide: 'GG' }, lat: 16.1, lng: -22.1,
    };
    const { onSave } = renderForm('transfer', { unit });
    expect(campo('Nome').value).toBe('Transfer');
    expect(campo('Descricao').value).toBe('Texto simples');
    expect(campo('Preco base (€)').value).toBe('20');
    expect(campo('Capacidade').value).toBe('6');
    expect(campo('ID produto Viator').value).toBe('VG');
    expect(campo('Latitude').value).toBe('16.1');
    expect(campo('Estado').value).toBe('inactive');
    expect(opcoes(campo('Estado'))).toEqual([['active', 'Activa'], ['inactive', 'Inactiva']]);
    fireEvent.click(botao('Guardar'));
    expect(guardar(onSave)).toStrictEqual({
      name: 'Transfer',
      description: 'Texto simples',
      unit_type: 'Van',
      base_price: 20,
      price_unit: 'hour',
      capacity: 6,
      status: 'inactive',
      images: ['https://cdn.exemplo/g.jpg'],
      ota_product_ids: { viator: 'VG', getyourguide: 'GG' },
      lat: 16.1,
      lng: -22.1,
    });
  });

  it('em ingles os rotulos traduzidos mudam', () => {
    useUiStore.setState({ lang: 'en' });
    renderForm('transfer');
    expect(screen.queryByText('Preco base (€)')).toBeNull();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });
});

/* ---------- Design system: etiquetas e editores do formulario de tours ---------- */

/* O Input/Select/Textarea do design system poe a etiqueta como irmao anterior do campo,
   sem htmlFor/id; e isso que se afirma (divida conhecida), nao getByLabelText */
function temEtiquetaPorCima(textos) {
  for (const texto of textos) {
    const etiqueta = screen.getByText(texto);
    expect(etiqueta.tagName).toBe('LABEL');
    expect(etiqueta.nextElementSibling).toBe(campo(texto));
  }
}

describe('TourForm com o design system', () => {
  function preencherMinimo() {
    const r = renderForm('activity');
    escrever(campo('Nome PT'), 'Tour');
    escrever(campo('Capacidade maxima'), '4');
    return r;
  }

  function metaGravada(onSave) {
    return JSON.parse(guardar(onSave).description);
  }

  it('os campos principais tem a etiqueta por cima', () => {
    renderForm('activity');
    temEtiquetaPorCima([
      'Nome PT', 'Nome EN', 'Categoria', 'Modalidade', 'Descricao curta PT', 'Descricao longa EN',
      'Duracao (horas)', 'Dificuldade', 'Capacidade maxima', 'Hora de inicio', 'Preco crianca',
      'ID produto Viator', 'Latitude', 'Longitude',
    ]);
  });

  it('os titulos de seccao existem', () => {
    renderForm('activity');
    ['Identificacao', 'Descricao', 'Idiomas', 'Comodidades', 'O que está incluído', 'Fotos'].forEach(t => {
      expect(screen.getAllByText((_, el) => el.tagName === 'P' && el.textContent === t)).toHaveLength(1);
    });
  });

  it('idiomas e comodidades continuam a ser de selecao multipla', () => {
    const { onSave } = preencherMinimo();
    fireEvent.click(screen.getByLabelText('DE'));
    fireEvent.click(screen.getByLabelText('PT'));
    fireEvent.click(screen.getByLabelText('Seguro'));
    fireEvent.click(screen.getByLabelText('Toalhas'));
    expect(screen.getByLabelText('DE').checked).toBe(true);
    expect(screen.getByLabelText('PT').checked).toBe(false);
    fireEvent.click(botao('Criar tour'));
    const meta = metaGravada(onSave);
    expect(meta.languages).toEqual(['EN', 'DE']);
    expect(meta.amenities).toEqual(['Seguro', 'Toalhas']);
  });

  it('item incluido: adicionar, editar e remover pelo botao com nome', () => {
    const { onSave } = preencherMinimo();
    fireEvent.click(botao('Adicionar item incluído'));
    fireEvent.click(botao('Adicionar item não incluído'));
    escrever(screen.getByLabelText('Item 1'), 'Agua');
    escrever(screen.getByLabelText('Item 2'), 'Almoco');
    fireEvent.click(botao('Remover item 1'));
    expect(screen.queryByLabelText('Item 2')).toBeNull();
    expect(screen.getByLabelText('Item 1').value).toBe('Almoco');
    fireEvent.click(botao('Criar tour'));
    expect(metaGravada(onSave).included_items).toEqual([{ label: 'Almoco', included: false }]);
  });

  it('paragem: adicionar, editar e remover pelo botao com nome', () => {
    const { onSave } = preencherMinimo();
    fireEvent.click(botao('Adicionar paragem'));
    fireEvent.click(botao('Adicionar paragem'));
    escrever(screen.getByLabelText('Nome da paragem 1'), 'A');
    escrever(screen.getByLabelText('Descrição da paragem 1'), 'Desc A');
    escrever(screen.getByLabelText('Latitude da paragem 1'), '16.5');
    escrever(screen.getByLabelText('Longitude da paragem 1'), '-22.9');
    escrever(screen.getByLabelText('Nome da paragem 2'), 'B');
    fireEvent.click(botao('Remover paragem 2'));
    expect(screen.queryByLabelText('Nome da paragem 2')).toBeNull();
    fireEvent.click(botao('Criar tour'));
    expect(metaGravada(onSave).stops).toEqual([{ name: 'A', desc: 'Desc A', lat: 16.5, lng: -22.9 }]);
  });

  it('horario: adicionar, editar e remover pelo botao com nome', () => {
    const { onSave } = preencherMinimo();
    fireEvent.click(botao('Adicionar horário'));
    fireEvent.click(botao('Adicionar horário'));
    escrever(screen.getByLabelText('Hora do horário 1'), '09:00');
    escrever(screen.getByLabelText('Lugares do horário 1'), '8');
    escrever(screen.getByLabelText('Hora do horário 2'), '11:00');
    escrever(screen.getByLabelText('Lugares do horário 2'), '5');
    fireEvent.click(botao('Remover horário 1'));
    expect(screen.queryByLabelText('Hora do horário 2')).toBeNull();
    fireEvent.click(botao('Criar tour'));
    expect(metaGravada(onSave).time_slots).toEqual([{ time: '11:00', capacity: 5 }]);
  });

  it('escalao: adicionar, editar e remover pelo botao com nome', () => {
    const { onSave } = preencherMinimo();
    fireEvent.click(botao('Adicionar escalão'));
    fireEvent.click(botao('Adicionar escalão'));
    escrever(screen.getByLabelText('Mínimo de pessoas do escalão 1'), '1');
    escrever(screen.getByLabelText('Máximo de pessoas do escalão 1'), '2');
    escrever(screen.getByLabelText('Preço do escalão 1'), '80');
    escrever(screen.getByLabelText('Mínimo de pessoas do escalão 2'), '3');
    escrever(screen.getByLabelText('Máximo de pessoas do escalão 2'), '4');
    escrever(screen.getByLabelText('Preço do escalão 2'), '140.5');
    fireEvent.click(botao('Remover escalão 1'));
    expect(screen.queryByLabelText('Preço do escalão 2')).toBeNull();
    fireEvent.click(botao('Criar tour'));
    expect(metaGravada(onSave).price_tiers).toEqual([{ pax_min: 3, pax_max: 4, price: 140.5 }]);
  });

  it('os botoes de adicionar e remover nao submetem o formulario', () => {
    const { onSave } = preencherMinimo();
    fireEvent.click(botao('Adicionar item incluído'));
    fireEvent.click(botao('Adicionar paragem'));
    fireEvent.click(botao('Adicionar horário'));
    fireEvent.click(botao('Adicionar escalão'));
    fireEvent.click(botao('Remover item 1'));
    fireEvent.click(botao('Remover paragem 1'));
    fireEvent.click(botao('Remover horário 1'));
    fireEvent.click(botao('Remover escalão 1'));
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('HotelRoomForm com o design system', () => {
  it('os campos tem a etiqueta por cima', () => {
    renderForm('hotel');
    temEtiquetaPorCima([
      'Numero', 'Nome', 'Tipo', 'Andar', 'Vista', 'Adultos', 'Criancas', 'Preco base', 'Epoca baixa',
      'Epoca media', 'Epoca alta', 'Pico', 'ID produto GetYourGuide',
    ]);
  });

  it('o editor de itens incluidos usa botoes com nome e a descricao continua em JSON', () => {
    const { onSave } = renderForm('hotel');
    escrever(campo('Nome'), 'Suite');
    escrever(campo('Preco base'), '90');
    escrever(campo('Epoca alta'), '120');
    fireEvent.click(botao('Adicionar item incluído'));
    fireEvent.click(botao('Adicionar item incluído'));
    escrever(screen.getByLabelText('Item 1'), 'Pequeno-almoco');
    escrever(screen.getByLabelText('Item 2'), 'Parking');
    fireEvent.click(botao('Remover item 2'));
    fireEvent.click(screen.getByLabelText('Jacuzzi'));
    fireEvent.click(screen.getByLabelText('WiFi'));
    fireEvent.click(botao('Criar quarto'));
    const gravado = guardar(onSave);
    expect(typeof gravado.description).toBe('string');
    const meta = JSON.parse(gravado.description);
    expect(meta.included_items).toEqual([{ label: 'Pequeno-almoco', included: true }]);
    expect(meta.amenities).toEqual(['Jacuzzi', 'WiFi']);
    expect(meta.price_high).toBe(120);
    expect(gravado.base_price).toBe(90);
  });
});

describe('RentacarVehicleForm com o design system', () => {
  it('os campos tem a etiqueta por cima, incluindo documentos e quilometragem', () => {
    renderForm('rentacar');
    temEtiquetaPorCima([
      'Marca', 'Modelo', 'Ano', 'Matricula', 'Cor', 'Categoria', 'Lugares', 'Bagagens', 'Transmissao',
      'Combustivel', 'Preco base / dia', 'Idade minima', 'Seguro ate', 'IUC ate', 'Inspecao ate',
      'Km actuais', 'Proxima revisao (km)',
    ]);
  });

  it('os campos de documentos sao de data e os de quilometragem numericos', () => {
    renderForm('rentacar');
    ['Seguro ate', 'IUC ate', 'Inspecao ate'].forEach(t => expect(campo(t).type).toBe('date'));
    ['Km actuais', 'Proxima revisao (km)'].forEach(t => expect(campo(t).type).toBe('number'));
  });

  it('o editor de itens incluidos remove pelo botao com nome e a tarifa de motorista so aparece em Executivo', () => {
    const { onSave } = renderForm('rentacar');
    expect(screen.queryByText('Tarifa de motorista (por dia)')).toBeNull();
    fireEvent.change(campo('Categoria'), { target: { value: 'Executivo' } });
    expect(campo('Tarifa de motorista (por dia)')).toBeInTheDocument();
    escrever(campo('Preco base / dia'), '55');
    escrever(campo('Seguro ate'), '2027-01-31');
    escrever(campo('Km actuais'), '12000');
    fireEvent.click(botao('Adicionar item não incluído'));
    escrever(screen.getByLabelText('Item 1'), 'Combustivel');
    fireEvent.click(botao('Registar viatura'));
    const gravado = guardar(onSave);
    const meta = JSON.parse(gravado.description);
    expect(meta.included_items).toEqual([{ label: 'Combustivel', included: false }]);
    expect(meta.seguro_expiry).toBe('2027-01-31');
    expect(meta.current_km).toBe(12000);
    expect(gravado.base_price).toBe(55);
    expect(gravado.unit_type).toBe('Executivo');
  });
});

describe('RestaurantTableForm com o design system', () => {
  it('os campos tem a etiqueta por cima', () => {
    renderForm('restaurant');
    temEtiquetaPorCima([
      'Numero', 'Nome / descricao (opcional)', 'Zona', 'Minimo (pessoas)', 'Maximo (pessoas)',
      'ID produto Viator', 'Latitude',
    ]);
  });

  it('a opcao combinavel continua a ser uma caixa de verificacao e as comodidades de selecao multipla', () => {
    const { onSave } = renderForm('restaurant');
    const caixa = screen.getByLabelText('Mesa combinavel com outras');
    expect(caixa.type).toBe('checkbox');
    fireEvent.click(caixa);
    fireEvent.click(screen.getByLabelText('Terraço'));
    fireEvent.click(screen.getByLabelText('WiFi'));
    fireEvent.click(botao('Adicionar item incluído'));
    escrever(screen.getByLabelText('Item 1'), 'Pao');
    fireEvent.click(botao('Criar mesa'));
    const meta = JSON.parse(guardar(onSave).description);
    expect(meta.combinable).toBe(true);
    expect(meta.amenities).toEqual(['Terraço', 'WiFi']);
    expect(meta.included_items).toEqual([{ label: 'Pao', included: true }]);
  });
});

describe('formulario generico com o design system', () => {
  it('os campos tem a etiqueta por cima', () => {
    renderForm('transfer');
    temEtiquetaPorCima(['Nome', 'Tipo', 'Preco base (€)', 'ID produto Viator', 'Latitude']);
  });

  it('o rodape tem Cancelar e o botao de gravar, e submeter grava o mesmo objeto', () => {
    const { onSave, onCancel } = renderForm('transfer');
    escrever(campo('Nome'), 'Transfer');
    escrever(campo('Preco base (€)'), '20');
    fireEvent.click(botao('Nova Unidade'));
    expect(guardar(onSave).name).toBe('Transfer');
    expect(guardar(onSave).base_price).toBe(20);
    fireEvent.click(botao('Cancelar'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
