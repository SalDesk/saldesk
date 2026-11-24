/* A interpolacao troca {{x}} pelo valor tal e qual; os padroes especiais de String.replace ($&, $', $$) nao se aplicam
   a nomes de clientes. */
import { describe, expect, it } from 'vitest';
import { getT } from '../i18n';
import en from '../i18n/en.json';
import nl from '../i18n/nl.json';

const CHAVE = 'reservations.vehicleSeats'; // "{{name}} ({{n}} ...)"

describe('i18n interpolacao', () => {
  const t = getT('pt');

  it("um valor com $' fica exactamente como foi dado", () => {
    expect(t(CHAVE, { name: "Ana $' Lima", n: 4 })).toContain("Ana $' Lima");
  });

  it('um valor com $& fica exactamente como foi dado', () => {
    const r = t(CHAVE, { name: 'Ana $& Lima', n: 4 });
    expect(r).toContain('Ana $& Lima');
    expect(r).not.toContain('{{');
  });

  it('um valor com $$ nao e reduzido a um so $', () => {
    expect(t(CHAVE, { name: 'Ana $$ Lima', n: 4 })).toContain('Ana $$ Lima');
  });

  it('um valor com $` fica exactamente como foi dado', () => {
    expect(t(CHAVE, { name: 'Ana $` Lima', n: 4 })).toContain('Ana $` Lima');
  });

  it('valores numericos continuam a funcionar', () => {
    expect(t(CHAVE, { name: 'Ana', n: 4 })).toContain('4');
    expect(t(CHAVE, { name: 'Ana', n: 0 })).not.toContain('{{');
  });
});

describe('i18n no-show coerente', () => {
  it('em ingles o estado da reserva e o calendario usam o mesmo termo', () => {
    expect(getT('en')('reservations.status.no_show')).toBe('No-show');
    expect(getT('en')('calendar.noShow')).toBe('No-show');
  });

  it('em neerlandes o estado da reserva e o calendario usam o mesmo termo', () => {
    expect(nl.reservations.status.no_show).toBe(nl.calendar.noShow);
  });

  it('em portugues os rotulos ficam como eram', () => {
    expect(getT('pt')('reservations.status.no_show')).toBe('Não apareceu');
    expect(getT('pt')('calendar.noShow')).toBe('No Show');
  });

  it('nao ha "No Show" solto em ingles', () => {
    expect(JSON.stringify(en)).not.toContain('No Show');
  });
});
