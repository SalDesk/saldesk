/* helpers/brandColor: validar a cor da marca do operador (#rrggbb com texto branco legivel). */
const { validarCor, contrasteComBranco } = require('../helpers/brandColor');

describe('contrasteComBranco', () => {
  it('branco sobre preto e 21 e sobre branco e 1', () => {
    expect(contrasteComBranco('#000000')).toBeCloseTo(21, 1);
    expect(contrasteComBranco('#ffffff')).toBeCloseTo(1, 5);
  });

  it('a cor original da marca (ocean 700) passa com folga', () => {
    expect(contrasteComBranco('#0d5470')).toBeGreaterThan(7);
  });
});

describe('validarCor', () => {
  it('null, undefined e texto vazio limpam a cor', () => {
    expect(validarCor(null)).toEqual({ ok: true, cor: null });
    expect(validarCor(undefined)).toEqual({ ok: true, cor: null });
    expect(validarCor('')).toEqual({ ok: true, cor: null });
    expect(validarCor('   ')).toEqual({ ok: true, cor: null });
  });

  it('aceita #rrggbb e normaliza para minusculas', () => {
    expect(validarCor('#0D5470')).toEqual({ ok: true, cor: '#0d5470' });
    expect(validarCor(' #1A7A4A ')).toEqual({ ok: true, cor: '#1a7a4a' });
  });

  it.each([
    'red', '0d5470', '#0d547', '#0d54700', '#0d54zz', '#fff', 'rgb(1,2,3)', 'url(x)', '#0d5470;color:red',
  ])('recusa formato invalido: %s', (v) => {
    const r = validarCor(v);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/#rrggbb/);
  });

  it('recusa valores que nao sao texto', () => {
    expect(validarCor(123456).ok).toBe(false);
    expect(validarCor({}).ok).toBe(false);
    expect(validarCor(['#0d5470']).ok).toBe(false);
    expect(validarCor(true).ok).toBe(false);
  });

  it('recusa cores demasiado claras para texto branco (contraste abaixo de 4.5)', () => {
    const r = validarCor('#ffd966');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/demasiado clara/i);
    expect(validarCor('#ffffff').ok).toBe(false);
  });

  it('aceita cores medias e escuras que passam o contraste', () => {
    expect(validarCor('#c2410c').ok).toBe(true); // laranja escuro
    expect(validarCor('#1f6f43').ok).toBe(true);
    expect(validarCor('#000000').ok).toBe(true);
  });
});
