/* Formularios de unidade no telemovel (375px): nenhuma grelha de 3 ou mais colunas pode ser fixa.
   Num modal de ~340px, 3-4 campos lado a lado ficam ilegiveis. O jsdom nao calcula layout, por isso
   verifica-se a regra nas classes: a coluna-base (sem prefixo sm:/md:...) tem no maximo 2 colunas. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import UnitForm from '../components/units/UnitForm';
import useUiStore from '../store/uiStore';

vi.mock('../services/uploadService', () => ({
  uploadImage: vi.fn(),
  validateImageFile: vi.fn(() => null),
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
}));

beforeEach(() => { useUiStore.setState({ lang: 'pt' }); });
afterEach(cleanup);

function gradesFixas(container) {
  const fixas = [];
  container.querySelectorAll('[class*="grid-cols-"]').forEach((el) => {
    /* galeria de miniaturas do ImageUploader (3 -> 4 -> 5 por linha): miniaturas pequenas, 3 no telemovel e o desenho certo */
    if (el.classList.contains('lg:grid-cols-5')) return;
    const base = [...el.classList].find((c) => /^grid-cols-\d+$/.test(c));
    if (base && Number(base.split('-')[2]) >= 3) fixas.push(`${base} ${[...el.classList].filter((c) => c !== base).join(' ')}`.trim());
  });
  return fixas;
}

describe('formularios de unidade: grelhas no telemovel', () => {
  it.each(['hotel', 'activity', 'rentacar', 'restaurant'])('%s: sem grelhas fixas de 3+ colunas', (tipo) => {
    const { container } = render(<UnitForm operatorType={tipo} onSave={vi.fn()} onCancel={vi.fn()} />);
    expect(gradesFixas(container)).toEqual([]);
  });

  it.each(['hotel', 'activity', 'rentacar', 'restaurant'])('%s em inglês: as mesmas grelhas, sem colunas fixas de 3+', (tipo) => {
    useUiStore.setState({ lang: 'en' });
    const { container } = render(<UnitForm operatorType={tipo} onSave={vi.fn()} onCancel={vi.fn()} />);
    expect(gradesFixas(container)).toEqual([]);
  });

  it('as grelhas largas ganham colunas a partir do ecra pequeno (sm:)', () => {
    const { container } = render(<UnitForm operatorType="rentacar" onSave={vi.fn()} onCancel={vi.fn()} />);
    const classes = [...container.querySelectorAll('[class*="sm:grid-cols-"]')].map((el) => el.className);
    expect(classes.some((c) => /sm:grid-cols-4/.test(c))).toBe(true);
    expect(classes.some((c) => /sm:grid-cols-3/.test(c))).toBe(true);
  });
});
