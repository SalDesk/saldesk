import { afterEach, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import useUiStore from '../store/uiStore';
import { formatarData, formatarNumero, linguaActual, localeDe } from '../utils/formatoLingua';
import { fmtDate, fmtDica, fmtEixo, fmtMoney } from '../pages/financial/shared';
import HeroCard from '../components/dashboard/HeroCard';
import KpiCard from '../components/financial/KpiCard';

afterEach(() => {
  cleanup();
  useUiStore.setState({ lang: 'pt' });
});

describe('formatoLingua', () => {
  it('formatarNumero segue a lingua', () => {
    expect(formatarNumero(1234, {}, 'pt')).toBe((1234).toLocaleString('pt-PT'));
    expect(formatarNumero(1234, {}, 'en')).toBe('1,234');
  });

  it('formatarData le YYYY-MM-DD como data local e usa o locale', () => {
    const en = formatarData('2026-12-05', { day: 'numeric', month: 'short' }, 'en');
    /* pt-PT com month short sai numerico neste ICU (igual ao fmtDate de hoje); long mostra o mes por extenso */
    const pt = formatarData('2026-12-05', { day: 'numeric', month: 'long' }, 'pt');
    expect(en).toContain('Dec');
    expect(en).toContain('5');
    expect(pt).toContain('dez');
    expect(pt).toContain('5');
    expect(formatarData(new Date(2026, 11, 5), { day: 'numeric' }, 'en')).toBe('5');
  });

  it('linguaActual cai em pt para lingua desconhecida', () => {
    useUiStore.setState({ lang: 'xx' });
    expect(linguaActual()).toBe('pt');
    expect(localeDe()).toBe('pt-PT');
    useUiStore.setState({ lang: 'de' });
    expect(linguaActual()).toBe('de');
  });

  it('fmtMoney, fmtEixo, fmtDica e fmtDate: pt igual a antes, en com virgula', () => {
    expect(fmtMoney(1234.4)).toBe('€' + (1234).toLocaleString('pt-PT'));
    expect(fmtDica(1234, 'EUR')).toBe('€' + (1234).toLocaleString('pt-PT'));
    expect(fmtDate('2026-12-05')).toBe(new Date('2026-12-05T00:00:00Z').toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', timeZone: 'UTC' }));
    useUiStore.setState({ lang: 'en' });
    expect(fmtMoney(1234.4)).toBe('€1,234');
    expect(fmtMoney(10, 'CVE')).toBe('1,100 CVE');
    expect(fmtDica(1234, 'CVE')).toBe('1,234 CVE');
    expect(fmtEixo(2500, 'EUR')).toBe('€3k');
    expect(fmtDate('2026-12-05')).toContain('Dec');
  });

  it('muda de lingua e o valor muda (HeroCard e KpiCard)', () => {
    const { container } = render(createElement(HeroCard, { receita: 1234, serie: [1, 2], ocupacao: 50, volume: 'v', hojeValor: 'h', hojeDetalhe: 'd', mesNome: 'M' }));
    const kpi = render(createElement(KpiCard, { label: 'Receita', value: 1234, format: 'euro' }));
    expect(container.textContent).toContain('€' + (1234).toLocaleString('pt-PT'));
    expect(kpi.container.textContent).toContain('€' + (1234).toLocaleString('pt-PT'));
    act(() => useUiStore.setState({ lang: 'en' }));
    expect(container.textContent).toContain('€1,234');
    expect(kpi.container.textContent).toContain('€1,234');
  });
});
