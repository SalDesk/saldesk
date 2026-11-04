import { afterEach, describe, expect, it, vi } from 'vitest';
import { estadiaEm, estadiaNoMes, estadiaProximosDias } from '../services/reservationRanges';

/* Relogio simulado so da Date (hora local), restaurado apos cada teste */
function hoje(ano, mes, dia) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(ano, mes - 1, dia, 12, 0, 0));
}

afterEach(() => {
  vi.useRealTimers();
});

describe('estadiaEm', () => {
  it('com um argumento usa o mesmo dia nos dois limites', () => {
    expect(estadiaEm('2026-11-03')).toEqual({ stay_from: '2026-11-03', stay_to: '2026-11-03' });
  });

  it('com dois argumentos usa ambos', () => {
    expect(estadiaEm('2026-11-03', '2026-11-10')).toEqual({ stay_from: '2026-11-03', stay_to: '2026-11-10' });
  });
});

describe('estadiaNoMes', () => {
  it('Dezembro de 2026 vai de 01 a 31', () => {
    hoje(2026, 12, 1);
    expect(estadiaNoMes()).toEqual({ stay_from: '2026-12-01', stay_to: '2026-12-31' });
  });

  it('Fevereiro de 2026 termina a 28', () => {
    hoje(2026, 2, 10);
    expect(estadiaNoMes()).toEqual({ stay_from: '2026-02-01', stay_to: '2026-02-28' });
  });

  it('Fevereiro bissexto de 2028 termina a 29', () => {
    hoje(2028, 2, 10);
    expect(estadiaNoMes()).toEqual({ stay_from: '2028-02-01', stay_to: '2028-02-29' });
  });
});

describe('estadiaProximosDias', () => {
  it('7 dias a partir de 28 Dez 2026 viram o ano', () => {
    hoje(2026, 12, 28);
    expect(estadiaProximosDias(7)).toEqual({ stay_from: '2026-12-28', stay_to: '2027-01-03' });
  });

  it('1 dia e so hoje', () => {
    hoje(2026, 11, 3);
    expect(estadiaProximosDias(1)).toEqual({ stay_from: '2026-11-03', stay_to: '2026-11-03' });
  });

  it.each([0, -1, 1.5])('%s lanca RangeError', (n) => {
    expect(() => estadiaProximosDias(n)).toThrow(RangeError);
  });
});
