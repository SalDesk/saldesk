import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import UnitForm from '../components/units/UnitForm';
import useUiStore from '../store/uiStore';
import { portuguesNoEcra, chavesCruas } from './helpers/portuguesNoEcra';

vi.mock('../services/uploadService', () => ({
  uploadImage: vi.fn(),
  validateImageFile: vi.fn(() => null),
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
}));
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div>{children}</div>,
  TileLayer: () => null,
  Marker: () => null,
  useMapEvents: () => null,
}));
vi.mock('leaflet', () => ({ default: { divIcon: () => ({}) }, divIcon: () => ({}) }));

beforeEach(() => { useUiStore.setState({ lang: 'pt' }); });
afterEach(() => { cleanup(); });

const porRotulo = (t) => screen.getByLabelText(t);
const escrever = (el, v) => fireEvent.change(el, { target: { value: v } });
const botao = (n) => screen.getByRole('button', { name: n });

function renderForm(unit) {
  const onSave = vi.fn();
  render(<UnitForm operatorType="activity" unit={unit} onSave={onSave} onCancel={() => {}} />);
  return onSave;
}

function campoPorEtiqueta(re) {
  const el = screen.getAllByText((_, e) => e.tagName === 'LABEL' && re.test(e.textContent))[0];
  return el.parentElement.querySelector('input');
}

function formularioNovo() {
  const onSave = renderForm(undefined);
  escrever(campoPorEtiqueta(/^Nome PT/), 'Passeio');
  escrever(campoPorEtiqueta(/^Capacidade máxima/), '12');
  return onSave;
}

function addOpcao(n, { nome, tipo, preco, lugares }) {
  fireEvent.click(botao('Adicionar opção'));
  escrever(porRotulo(`Nome PT da opção ${n}`), nome);
  if (tipo) escrever(porRotulo(`Tipo da opção ${n}`), tipo);
  if (preco !== undefined) escrever(porRotulo(`Preço da opção ${n}`), preco);
  if (lugares !== undefined) escrever(porRotulo(`Lugares por veículo da opção ${n}`), lugares);
}

const meta = (onSave) => JSON.parse(onSave.mock.calls[0][0].description);

describe('TourForm: opções, suplemento e ofertas', () => {
  it('opção por veiculo sem lugares mostra o erro e não guarda', () => {
    const onSave = formularioNovo();
    addOpcao(1, { nome: 'Buggy', tipo: 'per_vehicle', preco: '50' });
    fireEvent.click(botao('Criar tour'));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Indique pelo menos 1 lugar por veículo.')).toBeTruthy();
  });

  it('opção sem nome ou sem preço não guarda', () => {
    const onSave = formularioNovo();
    fireEvent.click(botao('Adicionar opção'));
    fireEvent.click(botao('Criar tour'));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Indique o nome em português.')).toBeTruthy();
    expect(screen.getByText('O preço tem de ser superior a 0.')).toBeTruthy();
  });

  it('duas opções (40 e 30): base_price 30 e os ids mantem-se ao guardar de novo', () => {
    const onSave = formularioNovo();
    addOpcao(1, { nome: 'Normal', preco: '40' });
    addOpcao(2, { nome: 'Grupo', tipo: 'per_group', preco: '30' });
    fireEvent.click(botao('Criar tour'));
    const dados = onSave.mock.calls[0][0];
    const m = meta(onSave);
    expect(dados.base_price).toBe(30);
    expect(m.options).toHaveLength(2);
    expect(m.options[0]).toMatchObject({ name_pt: 'Normal', type: 'per_person', price: 40 });
    expect(m.options[1]).toMatchObject({ name_pt: 'Grupo', type: 'per_group', price: 30 });
    const ids = m.options.map(o => o.id);
    expect(ids[0]).toBeTruthy();
    expect(ids[0]).not.toBe(ids[1]);

    cleanup();
    const onSave2 = renderForm({
      name: dados.name, description: dados.description, unit_type: 'Tour',
      base_price: dados.base_price, capacity: 12, status: 'active', images: [],
    });
    escrever(porRotulo('Preço da opção 1'), '45');
    fireEvent.click(botao('Guardar alterações'));
    const m2 = JSON.parse(onSave2.mock.calls[0][0].description);
    expect(m2.options.map(o => o.id)).toEqual(ids);
    expect(m2.options[0].price).toBe(45);
    expect(onSave2.mock.calls[0][0].base_price).toBe(30);
  });

  it('sem opções não ha chaves novas no meta', () => {
    const onSave = formularioNovo();
    fireEvent.click(botao('Criar tour'));
    const m = meta(onSave);
    expect(m).not.toHaveProperty('options');
    expect(m).not.toHaveProperty('language_surcharges');
    expect(m).not.toHaveProperty('offers');
  });

  it('o suplemento aparece só para idiomas seleccionados e guarda { ES: 20 }', () => {
    const onSave = formularioNovo();
    expect(screen.queryByLabelText('Suplemento de idioma (ES)')).toBeNull();
    expect(screen.getByLabelText('Suplemento de idioma (EN)')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('ES'));
    escrever(screen.getByLabelText('Suplemento de idioma (ES)'), '20');
    escrever(screen.getByLabelText('Suplemento de idioma (EN)'), '5');
    fireEvent.click(screen.getByLabelText('EN'));
    expect(screen.queryByLabelText('Suplemento de idioma (EN)')).toBeNull();
    fireEvent.click(botao('Criar tour'));
    expect(meta(onSave).language_surcharges).toEqual({ ES: 20 });
  });

  it('oferta com início depois do fim não guarda', () => {
    const onSave = formularioNovo();
    fireEvent.click(botao('Adicionar oferta'));
    escrever(porRotulo('Desconto da oferta 1 (%)'), '25');
    escrever(porRotulo('Início da oferta 1'), '2026-12-15');
    escrever(porRotulo('Fim da oferta 1'), '2026-12-01');
    fireEvent.click(botao('Criar tour'));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('A data de início tem de ser anterior ou igual à de fim.')).toBeTruthy();
  });

  it('desconto fora de 1 a 90 não guarda; uma oferta válida e gravada', () => {
    const onSave = formularioNovo();
    fireEvent.click(botao('Adicionar oferta'));
    escrever(porRotulo('Desconto da oferta 1 (%)'), '95');
    escrever(porRotulo('Início da oferta 1'), '2026-12-01');
    escrever(porRotulo('Fim da oferta 1'), '2026-12-15');
    fireEvent.click(botao('Criar tour'));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('O desconto tem de ser um número inteiro de 1 a 90.')).toBeTruthy();
    escrever(porRotulo('Desconto da oferta 1 (%)'), '25');
    fireEvent.click(botao('Criar tour'));
    expect(meta(onSave).offers).toEqual([
      { percent: 25, from: '2026-12-01', to: '2026-12-15', label_pt: null, label_en: null },
    ]);
  });

  it('a nota "opções substituem a tabela" só aparece com opções', () => {
    formularioNovo();
    const nota = 'As opções substituem a tabela de preços na página pública.';
    expect(screen.queryByText(nota)).toBeNull();
    addOpcao(1, { nome: 'Normal', preco: '40' });
    expect(screen.getByText(nota)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remover opção 1' }));
    expect(screen.queryByText(nota)).toBeNull();
  });
});

/* A mesma actividade em ingles e alemao: rotulos traduzidos, valores gravados iguais aos de sempre */
describe('TourForm em inglês e alemão', () => {
  const UNIDADE = {
    id: 'u1', name: 'Tour Pedra de Lume', unit_type: 'Passeio de Barco', base_price: 45, capacity: 8, status: 'active', images: [],
    description: JSON.stringify({
      name_en: 'Salt Crater Tour', difficulty: 'Moderado', tour_type: 'ambos', languages: ['PT', 'EN'],
      amenities: ['Seguro', 'Vestiário', 'Snacks e água'], pickup_included: true, meeting_point: 'Hotel Riu',
      price_tiers: [{ pax_min: 1, pax_max: 2, price: 80 }],
      included_items: [{ label: 'Almoço', included: true }, { label: 'Bebidas', included: false }],
      stops: [{ name: 'Praia', desc: 'Bonita', lat: 16.1, lng: -22.5 }],
      time_slots: [{ time: '08:00', capacity: 6 }],
      options: [{ id: 'o1', name_pt: 'Buggy', type: 'per_vehicle', price: 50, seats: 4 }],
      offers: [{ percent: 20, from: '2026-12-01', to: '2026-12-15' }],
      language_surcharges: { EN: 5 },
    }),
  };
  const DADOS = ['Tour Pedra de Lume', 'Salt Crater Tour', 'Hotel Riu', 'Praia', 'Bonita', 'Almoço', 'Bebidas', 'Buggy'];
  const emLingua = (lang) => useUiStore.setState({ lang });

  it('em inglês, o formulário e os editores não deixam português nem chaves cruas', () => {
    emLingua('en');
    renderForm(UNIDADE);
    expect(screen.getByText('Operational details')).toBeInTheDocument();
    expect(screen.getByText('Time slots with limited spots (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Time slot 1 spots')).toBeInTheDocument();
    expect(screen.getByLabelText('Tier 1 maximum guests')).toBeInTheDocument();
    expect(screen.getByLabelText('Stop 1 latitude')).toBeInTheDocument();
    expect(screen.getByText('Meeting point location')).toBeInTheDocument();
    expect(screen.getByText('Paste coordinates or a Google Maps link')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
    expect(portuguesNoEcra(DADOS)).toEqual([]);
    expect(chavesCruas(['unitForm', 'opcoesActividade', 'common'])).toEqual([]);
  });

  it('em inglês, as comodidades, a categoria e os itens mostram o rótulo inglês e gravam o valor português', () => {
    emLingua('en');
    const onSave = renderForm(UNIDADE);
    expect(screen.getByLabelText('Changing room')).toBeChecked();
    expect(screen.getByLabelText('Snacks and water')).toBeChecked();
    expect(screen.getByRole('option', { name: 'Boat trip' }).selected).toBe(true);
    expect(screen.getByRole('button', { name: /Not included/ })).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Towels'));
    fireEvent.click(botao('Save changes'));
    const dados = onSave.mock.calls[0][0];
    expect(dados.unit_type).toBe('Passeio de Barco');
    expect(JSON.parse(dados.description).amenities).toEqual(['Seguro', 'Vestiário', 'Snacks e água', 'Toalhas']);
  });

  it('em inglês, "Moderate" mostra-se para Moderado e escolher "Hard" grava Dificil', () => {
    emLingua('en');
    const onSave = renderForm(UNIDADE);
    expect(screen.getByLabelText('Difficulty').value).toBe('Moderado');
    expect(screen.getByRole('option', { name: 'Moderate' }).selected).toBe(true);
    fireEvent.change(screen.getByLabelText('Difficulty'), { target: { value: screen.getByRole('option', { name: 'Hard' }).value } });
    fireEvent.click(botao('Save changes'));
    expect(JSON.parse(onSave.mock.calls[0][0].description).difficulty).toBe('Dificil');
  });

  it('em inglês, o tipo de opção grava o id (per_group) e os erros seguem a língua', () => {
    emLingua('en');
    const onSave = formularioNovoEn();
    fireEvent.click(botao('Add option'));
    fireEvent.click(botao('Create tour'));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Enter the name in Portuguese.')).toBeTruthy();
    expect(screen.getByText('The price must be greater than 0.')).toBeTruthy();
    expect(portuguesNoEcra()).toEqual([]);
    escrever(porRotulo('Option 1 name (PT)'), 'Grupo');
    fireEvent.change(porRotulo('Option 1 type'), { target: { value: screen.getByRole('option', { name: 'Per group' }).value } });
    escrever(porRotulo('Option 1 price'), '30');
    fireEvent.click(botao('Create tour'));
    expect(meta(onSave).options[0]).toMatchObject({ name_pt: 'Grupo', type: 'per_group', price: 30 });
  });

  it('em inglês, o contador e o aviso do mapa são ingleses', () => {
    emLingua('en');
    renderForm(undefined);
    escrever(porRotulo('Short description PT'), 'abc');
    expect(screen.getByText('3/160 characters')).toBeInTheDocument();
    const colar = porRotulo('Paste coordinates or a Google Maps link');
    escrever(colar, 'xyz');
    fireEvent.blur(colar);
    expect(screen.getByText('I could not find coordinates in this text.')).toBeInTheDocument();
  });

  it('em alemão e neerlandês os editores falam a língua do painel', () => {
    emLingua('de');
    renderForm(UNIDADE);
    expect(screen.getByText('Betriebsdetails')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Mittel' }).selected).toBe(true);
    expect(screen.getByLabelText('Plätze von Zeitfenster 1')).toBeInTheDocument();
    expect(chavesCruas(['unitForm', 'opcoesActividade'])).toEqual([]);
    cleanup();
    emLingua('nl');
    renderForm(UNIDADE);
    expect(screen.getByText('Operationele details')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Gemiddeld' }).selected).toBe(true);
    expect(chavesCruas(['unitForm', 'opcoesActividade'])).toEqual([]);
  });

  it('em português tudo continua a ler como sempre', () => {
    renderForm(UNIDADE);
    expect(screen.getByText('Detalhes Operacionais')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Moderado' }).selected).toBe(true);
    expect(screen.getByRole('option', { name: 'Fácil' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Passeio de Barco' }).selected).toBe(true);
    expect(screen.getByLabelText('Vestiário')).toBeChecked();
    expect(screen.getByLabelText('Lugares do horário 1')).toBeInTheDocument();
  });
});

function formularioNovoEn() {
  const onSave = renderForm(undefined);
  escrever(campoPorEtiqueta(/^Name PT/), 'Passeio');
  escrever(campoPorEtiqueta(/^Maximum capacity/), '12');
  return onSave;
}

describe('TourForm: exemplos das opções e ofertas', () => {
  const abrir = () => {
    renderForm(undefined);
    fireEvent.click(screen.getAllByRole('button').find(b => /^(Add option|Adicionar opção)$/.test(b.textContent.trim())));
    fireEvent.click(screen.getAllByRole('button').find(b => /^(Add offer|Adicionar oferta)$/.test(b.textContent.trim())));
  };

  it('em inglês os exemplos do nome e do texto da oferta são ingleses', () => {
    useUiStore.setState({ lang: 'en' });
    abrir();
    expect(screen.getByLabelText('Option 1 name (PT)')).toHaveAttribute('placeholder', 'E.g. Double buggy');
    expect(screen.getByLabelText('Offer 1 text (PT)')).toHaveAttribute('placeholder', 'Special offer (-25%)');
    expect(portuguesNoEcra()).toEqual([]);
  });

  it('em português os exemplos são os de sempre', () => {
    abrir();
    expect(screen.getByLabelText('Nome PT da opção 1')).toHaveAttribute('placeholder', 'Ex: Buggy duplo');
    expect(screen.getByLabelText('Nome EN da opção 1')).toHaveAttribute('placeholder', 'Ex: Double buggy');
    expect(screen.getByLabelText('Texto PT da oferta 1')).toHaveAttribute('placeholder', 'Oferta especial (-25%)');
    expect(screen.getByLabelText('Texto EN da oferta 1')).toHaveAttribute('placeholder', 'Special offer (-25%)');
  });
});

describe('TourForm: estilo Maré', () => {
  const caixaInterior = (el) => el.className.includes('rounded-[14px]') && el.className.includes('border-mare-card');

  it('as secções do formulário são caixas interiores Maré', () => {
    renderForm(undefined);
    for (const titulo of ['Identificação', 'Preços (€ por pessoa)', 'Opções (variantes) da actividade', 'Fotos']) {
      const p = screen.getAllByText((_, e) => e.tagName === 'P' && e.textContent === titulo)[0];
      expect(caixaInterior(p.parentElement)).toBe(true);
    }
  });

  it('as linhas do editor de opções usam o aspecto de caixa interior', () => {
    renderForm(undefined);
    fireEvent.click(botao('Adicionar opção'));
    const linha = porRotulo('Nome PT da opção 1').closest('[class*="rounded-[14px]"]');
    expect(linha).not.toBeNull();
    expect(caixaInterior(linha)).toBe(true);
  });

  it('as linhas das ofertas também', () => {
    renderForm(undefined);
    fireEvent.click(botao('Adicionar oferta'));
    expect(caixaInterior(porRotulo('Desconto da oferta 1 (%)').closest('[class*="rounded-[14px]"]'))).toBe(true);
  });

  it('a moldura do mapa do ponto de encontro usa o aspecto de caixa interior', () => {
    const { container } = render(<UnitForm operatorType="activity" onSave={() => {}} onCancel={() => {}} />);
    const moldura = container.querySelector('.h-56');
    expect(moldura).not.toBeNull();
    expect(caixaInterior(moldura)).toBe(true);
  });

  it('as etiquetas de idioma e os botões de remover têm alvos de 44 px no telemovel', () => {
    renderForm(undefined);
    fireEvent.click(botao('Adicionar opção'));
    expect(screen.getByLabelText('DE').closest('label').className).toContain('min-h-11');
    expect(screen.getByRole('button', { name: 'Remover opção 1' }).className).toContain('min-h-11');
  });
});
