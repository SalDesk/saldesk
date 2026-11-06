import { describe, expect, it } from 'vitest';
import reservationCoversDay from '../components/calendar/reservationCoversDay';

/* Uma reserva ocupa as noites de check_in ate ao dia ANTES de check_out.
   Uma reserva de um so dia (check_in === check_out, comum em tours) ocupa apenas esse dia. */
describe('reservationCoversDay', () => {
  const multi = { check_in: '2026-03-10', check_out: '2026-03-13' };
  const umDia = { check_in: '2026-03-12', check_out: '2026-03-12' };

  it('reserva de varios dias: cobre da entrada ate ao dia antes da saida', () => {
    expect(reservationCoversDay(multi, '2026-03-10')).toBe(true);
    expect(reservationCoversDay(multi, '2026-03-11')).toBe(true);
    expect(reservationCoversDay(multi, '2026-03-12')).toBe(true);
  });

  it('reserva de varios dias: nao cobre o dia da saida nem os dias fora do intervalo', () => {
    expect(reservationCoversDay(multi, '2026-03-13')).toBe(false);
    expect(reservationCoversDay(multi, '2026-03-09')).toBe(false);
    expect(reservationCoversDay(multi, '2026-03-20')).toBe(false);
  });

  it('reserva de um so dia: cobre apenas esse dia', () => {
    expect(reservationCoversDay(umDia, '2026-03-12')).toBe(true);
  });

  it('reserva de um so dia: nao se repete nos dias seguintes nem nos anteriores', () => {
    expect(reservationCoversDay(umDia, '2026-03-13')).toBe(false);
    expect(reservationCoversDay(umDia, '2026-03-31')).toBe(false);
    expect(reservationCoversDay(umDia, '2026-03-11')).toBe(false);
  });

  it('compara tambem atraves da viragem de mes e de ano', () => {
    const virada = { check_in: '2026-12-30', check_out: '2027-01-02' };
    expect(reservationCoversDay(virada, '2026-12-31')).toBe(true);
    expect(reservationCoversDay(virada, '2027-01-01')).toBe(true);
    expect(reservationCoversDay(virada, '2027-01-02')).toBe(false);
  });

  it('sem datas ou sem reserva nao cobre nada e nao rebenta', () => {
    expect(reservationCoversDay({}, '2026-03-12')).toBe(false);
    expect(reservationCoversDay({ check_in: '2026-03-12' }, '2026-03-12')).toBe(false);
    expect(reservationCoversDay(null, '2026-03-12')).toBe(false);
    expect(reservationCoversDay(undefined, '2026-03-12')).toBe(false);
  });
});
