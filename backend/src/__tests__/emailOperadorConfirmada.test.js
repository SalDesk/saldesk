/* Email "Nova reserva" ao operador: diz quando a reserva ja ficou confirmada automaticamente */
const { notificacaoOperadorEmail } = require('../helpers/emailTemplates');

const BASE = {
  operatorName: 'Sal Aventura', tourName: 'Volta a ilha', checkIn: '2026-12-01', checkOut: '2026-12-01',
  guests: 2, total: 80, currency: 'EUR', customer: { name: 'Ana', email: 'ana@exemplo.cv' },
};
const AVISO = 'Esta reserva ficou confirmada automaticamente (pagamento no local). Não precisa de a aceitar.';

describe('notificacaoOperadorEmail', () => {
  it('reserva_ja_confirmada_avisa_no_html_e_no_texto', () => {
    const e = notificacaoOperadorEmail({ ...BASE, confirmada: true });
    expect(e.html).toContain(AVISO);
    expect(e.text).toContain(AVISO);
    expect(e.subject).toBe('Nova reserva confirmada — Volta a ilha | ' + notificacaoOperadorEmail(BASE).subject.split(' | ')[1]);
  });

  it('reserva_pendente_nao_tem_o_aviso', () => {
    const e = notificacaoOperadorEmail(BASE);
    expect(e.html).not.toContain(AVISO);
    expect(e.text).not.toContain(AVISO);
    expect(e.subject.startsWith('Nova reserva — Volta a ilha | ')).toBe(true);
  });
});
