import { describe, it, expect } from 'vitest';
import { textoAdultos, textoCriancas } from '../utils/pessoas';

describe('textoAdultos', () => {
  it('singular e plural em portugues', () => {
    expect(textoAdultos(1, 'pt')).toBe('1 adulto');
    expect(textoAdultos(2, 'pt')).toBe('2 adultos');
    expect(textoAdultos(0, 'pt')).toBe('0 adultos');
  });

  it('singular e plural em ingles', () => {
    expect(textoAdultos(1, 'en')).toBe('1 adult');
    expect(textoAdultos(2, 'en')).toBe('2 adults');
  });

  it('sem idioma conhecido usa portugues', () => {
    expect(textoAdultos(1)).toBe('1 adulto');
  });
});

describe('textoCriancas', () => {
  it('singular e plural em portugues', () => {
    expect(textoCriancas(1, 'pt')).toBe('1 criança');
    expect(textoCriancas(2, 'pt')).toBe('2 crianças');
    expect(textoCriancas(0, 'pt')).toBe('0 crianças');
  });

  it('singular e plural em ingles', () => {
    expect(textoCriancas(1, 'en')).toBe('1 child');
    expect(textoCriancas(2, 'en')).toBe('2 children');
  });
});
