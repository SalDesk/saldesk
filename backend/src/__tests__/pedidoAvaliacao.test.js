/* Regras puras do pedido automatico de avaliacao (helpers/pedidoAvaliacao.js). */
const R = require('../helpers/pedidoAvaliacao');

const AGORA = new Date('2026-11-19T00:30:00Z'); // ainda 18 nov em Cabo Verde (UTC-1)
const JAN = { de: '2026-11-15', ate: '2026-11-17', internoId: 'int-1' };
const OP = { id: 'op1', review_auto_request: true, is_demo: false, plan_status: 'active' };
const RES = { status: 'confirmed', source: 'public', customer_email: 'a@b.cv', check_out: '2026-11-17' };

test('janela_e_hoje_menos_3_a_hoje_menos_1_em_cabo_verde', () => {
  expect(R.hojeCaboVerde(AGORA)).toBe('2026-11-18');
  expect(R.janelaPedidoAutomatico(AGORA)).toEqual({ de: '2026-11-15', ate: '2026-11-17' });
  /* viragem de mes */
  expect(R.janelaPedidoAutomatico(new Date('2026-12-02T12:00:00Z'))).toEqual({ de: '2026-11-29', ate: '2026-12-01' });
});

test('reserva_directa_na_janela_e_elegivel', () => {
  expect(R.reservaElegivel(RES, OP, JAN)).toBe(true);
  expect(R.reservaElegivel({ ...RES, source: null }, OP, JAN)).toBe(true);
  expect(R.reservaElegivel({ ...RES, status: 'checked_out', source: 'manual' }, OP, JAN)).toBe(true);
  expect(R.reservaElegivel({ ...RES, check_out: '2026-11-15', source: 'admin' }, OP, JAN)).toBe(true);
});

test('ota_nunca_e_elegivel', () => {
  ['getyourguide', 'viator', 'booking'].forEach((s) => expect(R.reservaElegivel({ ...RES, source: s }, OP, JAN)).toBe(false));
});

test('fora_da_janela_estado_ou_sem_email_nao_e_elegivel', () => {
  expect(R.reservaElegivel({ ...RES, check_out: '2026-11-18' }, OP, JAN)).toBe(false);
  expect(R.reservaElegivel({ ...RES, check_out: '2026-11-14' }, OP, JAN)).toBe(false);
  ['pending', 'cancelled', 'no_show'].forEach((st) => expect(R.reservaElegivel({ ...RES, status: st }, OP, JAN)).toBe(false));
  expect(R.reservaElegivel({ ...RES, customer_email: '  ' }, OP, JAN)).toBe(false);
  expect(R.reservaElegivel({ ...RES, customer_email: null }, OP, JAN)).toBe(false);
});

test('operador_desligado_demo_interno_ou_sem_plano_nao_e_elegivel', () => {
  expect(R.reservaElegivel(RES, { ...OP, review_auto_request: false }, JAN)).toBe(false);
  expect(R.reservaElegivel(RES, { ...OP, is_demo: true }, JAN)).toBe(false);
  expect(R.reservaElegivel(RES, { ...OP, id: 'int-1' }, JAN)).toBe(false);
  expect(R.reservaElegivel(RES, { ...OP, plan_status: 'suspended' }, JAN)).toBe(false);
  expect(R.reservaElegivel(RES, { ...OP, plan_status: 'trial', trial_ends_at: '2026-11-01T00:00:00Z' }, JAN)).toBe(false);
  expect(R.reservaElegivel(RES, { ...OP, review_auto_request: null }, JAN)).toBe(true);
  expect(R.reservaElegivel(RES, null, JAN)).toBe(false);
});

test('viajante_pode_avaliar_reserva_passada_sem_check_out', () => {
  expect(R.podeAvaliarViajante({ status: 'confirmed', check_out: '2026-11-17' }, '2026-11-18')).toBe(true);
  expect(R.podeAvaliarViajante({ status: 'checked_out', check_out: '2026-11-18' }, '2026-11-18')).toBe(false);
  expect(R.podeAvaliarViajante({ status: 'confirmed', check_out: '2026-11-18' }, '2026-11-18')).toBe(false);
  expect(R.podeAvaliarViajante({ status: 'cancelled', check_out: '2026-11-10' }, '2026-11-18')).toBe(false);
});

test('estado_do_token', () => {
  expect(R.estadoDoToken(null, AGORA)).toBe('invalido');
  expect(R.estadoDoToken({ review_token: 'x', token_expires_at: '2026-12-01T00:00:00Z' }, AGORA)).toBe('ok');
  expect(R.estadoDoToken({ review_token: 'x', token_expires_at: '2026-11-01T00:00:00Z' }, AGORA)).toBe('expirado');
  expect(R.estadoDoToken({ review_token: null, token_expires_at: null }, AGORA)).toBe('invalido');
});

test('modelo_por_omissao_e_neutro_e_preenchido', () => {
  expect(R.DEFAULT_TEMPLATE.subject_pt).toBe('Como correu? Deixe a sua avaliacao');
  expect(R.DEFAULT_TEMPLATE.subject_en).toBe('How was it? Leave your review');
  expect(R.DEFAULT_TEMPLATE.body_pt).not.toMatch(/\btour\b/i);
  expect(R.DEFAULT_TEMPLATE.body_pt).toContain('{link_avaliacao}');
  expect(R.DEFAULT_TEMPLATE.body_en).toContain('{link_avaliacao}');
  expect(R.preencherModelo('{nome_cliente}|{nome_tour}|{link_avaliacao}|{link_avaliacao}', { nome_cliente: 'Ana', nome_tour: 'Buggy', link: 'L' })).toBe('Ana|Buggy|L|L');
  expect(R.preencherModelo('{nome_cliente}', {})).toBe('');
  expect(R.VALIDADE_TOKEN_DIAS).toBe(30);
});

test('reserva_marcada_directa_e_elegivel', () => {
  /* 'direct' e a opcao "Directa" do formulario de reserva (ReservationForm) */
  expect(R.reservaElegivel({ ...RES, source: 'direct' }, OP, JAN)).toBe(true);
});
