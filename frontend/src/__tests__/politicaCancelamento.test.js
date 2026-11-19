import { describe, expect, it } from 'vitest';
import { textoPoliticaGerada, textoPoliticaCancelamento } from '../utils/politicaCancelamento';

/* Texto da politica de cancelamento: escrito pelo operador ou gerado pelo prazo */
describe('politicaCancelamento', () => {
  it('texto_gerado_por_prazo', () => {
    expect(textoPoliticaGerada(24, 'pt')).toBe('Cancelamento gratuito até 24 horas antes do início. Depois desse prazo, o valor pago não é reembolsado.');
    expect(textoPoliticaGerada(48, 'en')).toBe('Free cancellation up to 48 hours before the start. After that, the amount paid is not refunded.');
    expect(textoPoliticaGerada(72, 'pt')).toContain('até 72 horas antes');
    expect(textoPoliticaGerada(168, 'pt')).toBe('Cancelamento gratuito até 7 dias antes do início. Depois desse prazo, o valor pago não é reembolsado.');
    expect(textoPoliticaGerada(168, 'en')).toBe('Free cancellation up to 7 days before the start. After that, the amount paid is not refunded.');
    expect(textoPoliticaGerada(0, 'pt')).toBe('Esta reserva não tem cancelamento gratuito: o valor pago não é reembolsado em caso de cancelamento.');
    expect(textoPoliticaGerada(0, 'en')).toBe('This booking has no free cancellation: the amount paid is not refunded if you cancel.');
    expect(textoPoliticaGerada(null, 'pt')).toBeNull();
    expect(textoPoliticaGerada(undefined, 'en')).toBeNull();
    expect(textoPoliticaGerada(36, 'pt')).toBeNull();
  });

  it('texto_escrito_ganha', () => {
    expect(textoPoliticaCancelamento({ cancellation_policy_pt: 'A minha', free_cancellation_hours: 24 }, 'pt')).toBe('A minha');
  });

  it('texto_escrito_noutra_lingua_ganha_ao_gerado', () => {
    expect(textoPoliticaCancelamento({ cancellation_policy_pt: 'A minha', free_cancellation_hours: 24 }, 'en')).toBe('A minha');
    expect(textoPoliticaCancelamento({ cancellation_policy_en: 'Mine', free_cancellation_hours: 24 }, 'pt')).toBe('Mine');
  });

  it('sem_texto_usa_o_gerado_e_sem_nada_da_null', () => {
    expect(textoPoliticaCancelamento({ free_cancellation_hours: 0 }, 'en')).toBe('This booking has no free cancellation: the amount paid is not refunded if you cancel.');
    expect(textoPoliticaCancelamento({ cancellation_policy_pt: '   ', free_cancellation_hours: 48 }, 'pt')).toContain('até 48 horas');
    expect(textoPoliticaCancelamento({}, 'pt')).toBeNull();
    expect(textoPoliticaCancelamento(null, 'pt')).toBeNull();
    expect(textoPoliticaCancelamento({ cancellation_policy_pt: '  ', cancellation_policy_en: '' }, 'en')).toBeNull();
  });
});
