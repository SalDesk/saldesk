const { detectarIdioma } = require('../helpers/languageHelper');

describe('detectarIdioma', () => {
  it('retorna "en" para países anglófonos', () => {
    expect(detectarIdioma('GB')).toBe('en');
    expect(detectarIdioma('US')).toBe('en');
    expect(detectarIdioma('AU')).toBe('en');
    expect(detectarIdioma('IE')).toBe('en');
  });

  it('retorna "en" para países germanófonos/nórdicos', () => {
    expect(detectarIdioma('DE')).toBe('en');
    expect(detectarIdioma('NL')).toBe('en');
    expect(detectarIdioma('SE')).toBe('en');
    expect(detectarIdioma('NO')).toBe('en');
    expect(detectarIdioma('DK')).toBe('en');
  });

  it('retorna "pt" para países lusófonos', () => {
    expect(detectarIdioma('PT')).toBe('pt');
    expect(detectarIdioma('BR')).toBe('pt');
    expect(detectarIdioma('CV')).toBe('pt');
    expect(detectarIdioma('AO')).toBe('pt');
    expect(detectarIdioma('MZ')).toBe('pt');
  });

  it('retorna "pt" para países não reconhecidos', () => {
    expect(detectarIdioma('XX')).toBe('pt');
    expect(detectarIdioma('ZZ')).toBe('pt');
  });

  it('retorna "pt" quando country_code é null ou undefined', () => {
    expect(detectarIdioma(null)).toBe('pt');
    expect(detectarIdioma(undefined)).toBe('pt');
    expect(detectarIdioma('')).toBe('pt');
  });

  it('é insensível a maiúsculas/minúsculas', () => {
    expect(detectarIdioma('gb')).toBe('en');
    expect(detectarIdioma('Gb')).toBe('en');
    expect(detectarIdioma('DE')).toBe('en');
  });
});
