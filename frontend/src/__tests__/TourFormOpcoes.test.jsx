import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import UnitForm from '../components/units/UnitForm';
import useUiStore from '../store/uiStore';

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
  escrever(campoPorEtiqueta(/^Capacidade maxima/), '12');
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

describe('TourForm: opcoes, suplemento e ofertas', () => {
  it('opcao por veiculo sem lugares mostra o erro e nao guarda', () => {
    const onSave = formularioNovo();
    addOpcao(1, { nome: 'Buggy', tipo: 'per_vehicle', preco: '50' });
    fireEvent.click(botao('Criar tour'));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Indique pelo menos 1 lugar por veículo.')).toBeTruthy();
  });

  it('opcao sem nome ou sem preco nao guarda', () => {
    const onSave = formularioNovo();
    fireEvent.click(botao('Adicionar opção'));
    fireEvent.click(botao('Criar tour'));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Indique o nome em português.')).toBeTruthy();
    expect(screen.getByText('O preço tem de ser superior a 0.')).toBeTruthy();
  });

  it('duas opcoes (40 e 30): base_price 30 e os ids mantem-se ao guardar de novo', () => {
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
    fireEvent.click(botao('Guardar alteracoes'));
    const m2 = JSON.parse(onSave2.mock.calls[0][0].description);
    expect(m2.options.map(o => o.id)).toEqual(ids);
    expect(m2.options[0].price).toBe(45);
    expect(onSave2.mock.calls[0][0].base_price).toBe(30);
  });

  it('sem opcoes nao ha chaves novas no meta', () => {
    const onSave = formularioNovo();
    fireEvent.click(botao('Criar tour'));
    const m = meta(onSave);
    expect(m).not.toHaveProperty('options');
    expect(m).not.toHaveProperty('language_surcharges');
    expect(m).not.toHaveProperty('offers');
  });

  it('o suplemento aparece so para idiomas seleccionados e guarda { ES: 20 }', () => {
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

  it('oferta com inicio depois do fim nao guarda', () => {
    const onSave = formularioNovo();
    fireEvent.click(botao('Adicionar oferta'));
    escrever(porRotulo('Desconto da oferta 1 (%)'), '25');
    escrever(porRotulo('Início da oferta 1'), '2026-12-15');
    escrever(porRotulo('Fim da oferta 1'), '2026-12-01');
    fireEvent.click(botao('Criar tour'));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('A data de início tem de ser anterior ou igual à de fim.')).toBeTruthy();
  });

  it('desconto fora de 1 a 90 nao guarda; uma oferta valida e gravada', () => {
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

  it('a nota "opcoes substituem a tabela" so aparece com opcoes', () => {
    formularioNovo();
    const nota = 'As opções substituem a tabela de preços na página pública.';
    expect(screen.queryByText(nota)).toBeNull();
    addOpcao(1, { nome: 'Normal', preco: '40' });
    expect(screen.getByText(nota)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remover opção 1' }));
    expect(screen.queryByText(nota)).toBeNull();
  });
});
