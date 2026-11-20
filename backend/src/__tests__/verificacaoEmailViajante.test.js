/* Confirmacao do email do viajante: so depois de provar que o email e seu e que a area do viajante
   mostra reservas, recibos e avaliacoes desse email. Google/Apple contam como confirmados. */
const crypto = require('crypto');

jest.mock('../helpers/emailHelper', () => ({ enviarEmail: jest.fn().mockResolvedValue({}) }));

const mockAuth = { utilizadores: {} };
jest.mock('../config/supabase', () => ({
  supabaseAdmin: {
    auth: {
      admin: {
        createUser: jest.fn(async ({ email }) => {
          const user = { id: 'novo-user', email, app_metadata: { provider: 'email', providers: ['email'] } };
          mockAuth.utilizadores[user.id] = user;
          return { data: { user }, error: null };
        }),
        getUserById: jest.fn(async (id) => ({ data: { user: mockAuth.utilizadores[id] || null }, error: mockAuth.utilizadores[id] ? null : { message: 'nao existe' } })),
        updateUserById: jest.fn(async (id, { app_metadata }) => {
          /* o GoTrue junta as chaves de app_metadata; null apaga a chave */
          const u = mockAuth.utilizadores[id];
          const meta = { ...u.app_metadata };
          Object.entries(app_metadata || {}).forEach(([k, v]) => { if (v === null) delete meta[k]; else meta[k] = v; });
          u.app_metadata = meta;
          return { data: { user: u }, error: null };
        }),
        deleteUser: jest.fn(async () => ({})),
      },
    },
    from: jest.fn(() => {
      const b = {};
      b.insert = (d) => { b.linha = { id: 'trav-1', ...d }; return b; };
      b.select = () => b;
      b.single = async () => ({ data: b.linha, error: null });
      return b;
    }),
  },
}));

const { enviarEmail } = require('../helpers/emailHelper');
const { supabaseAdmin } = require('../config/supabase');
const V = require('../helpers/verificacaoEmailViajante');
const authCtrl = require('../controllers/travelerAuthController');
const ctrl = require('../controllers/travelerController');
const requireTraveler = require('../middleware/requireTraveler');

function resposta() {
  const res = { statusCode: 200, corpo: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (j) => { res.corpo = j; return res; };
  return res;
}
async function chamar(fn, req) {
  const res = resposta(); const next = jest.fn();
  await fn({ params: {}, query: {}, body: {}, ...req }, res, next);
  if (next.mock.calls.length) throw next.mock.calls[0][0] || new Error('next chamado');
  return res;
}
const hash = (t) => crypto.createHash('sha256').update(t).digest('hex');
function linkDoEmail() {
  const { text } = enviarEmail.mock.calls[enviarEmail.mock.calls.length - 1][0];
  return new URL(text.match(/https:\/\/\S+confirmar-email\S+/)[0]);
}

beforeEach(() => {
  mockAuth.utilizadores = { u1: { id: 'u1', email: 'ana@exemplo.cv', app_metadata: { provider: 'email', providers: ['email'] } } };
  enviarEmail.mockClear();
  supabaseAdmin.auth.admin.updateUserById.mockClear();
});

describe('regra', () => {
  it('email_e_password_nao_conta_como_confirmado_google_e_apple_contam', () => {
    expect(V.emailConfirmado({ app_metadata: { provider: 'email', providers: ['email'] } })).toBe(false);
    expect(V.emailConfirmado({ app_metadata: { provider: 'google', providers: ['google'] } })).toBe(true);
    expect(V.emailConfirmado({ app_metadata: { provider: 'email', providers: ['email', 'apple'] } })).toBe(true);
    expect(V.emailConfirmado({ app_metadata: { providers: ['email'], email_verificado: true } })).toBe(true);
    expect(V.emailConfirmado(null)).toBe(false);
  });

  it('requireTraveler_marca_o_viajante_com_o_estado_do_email', () => {
    const req = { traveler: { id: 't1' }, user: { app_metadata: { providers: ['email'] } } };
    const next = jest.fn();
    requireTraveler(req, resposta(), next);
    expect(next).toHaveBeenCalled();
    expect(req.traveler.email_verificado).toBe(false);
  });
});

describe('pedir e confirmar', () => {
  const req = () => ({
    user: mockAuth.utilizadores.u1,
    traveler: { id: 't1', name: 'Ana', email: 'ana@exemplo.cv', language: 'pt', email_verificado: false },
  });

  it('pedir_envia_o_link_e_guarda_so_o_hash_do_codigo', async () => {
    const res = await chamar(authCtrl.sendVerificationEmail, req());
    expect(res.statusCode).toBe(200);
    expect(enviarEmail).toHaveBeenCalledTimes(1);
    expect(enviarEmail.mock.calls[0][0].to).toBe('ana@exemplo.cv');
    const link = linkDoEmail();
    expect(link.pathname).toBe('/viajante/confirmar-email');
    expect(link.searchParams.get('u')).toBe('u1');
    const registo = mockAuth.utilizadores.u1.app_metadata.verificacao_email;
    expect(registo.hash).toBe(hash(link.searchParams.get('t')));
    expect(JSON.stringify(registo)).not.toContain(link.searchParams.get('t'));
  });

  it('ja_confirmado_nao_envia', async () => {
    const r = req(); r.traveler.email_verificado = true;
    const res = await chamar(authCtrl.sendVerificationEmail, r);
    expect(res.corpo.data).toEqual({ ja_confirmado: true });
    expect(enviarEmail).not.toHaveBeenCalled();
  });

  it('confirmar_com_o_codigo_certo_marca_o_email_e_apaga_o_pedido', async () => {
    await chamar(authCtrl.sendVerificationEmail, req());
    const link = linkDoEmail();
    const res = await chamar(authCtrl.confirmEmail, { body: { u: link.searchParams.get('u'), t: link.searchParams.get('t') } });
    expect(res.statusCode).toBe(200);
    expect(mockAuth.utilizadores.u1.app_metadata.email_verificado).toBe(true);
    expect(mockAuth.utilizadores.u1.app_metadata).not.toHaveProperty('verificacao_email');
    expect(mockAuth.utilizadores.u1.app_metadata.providers).toEqual(['email']);
    /* o mesmo link outra vez nao falha: o email ja esta confirmado */
    expect((await chamar(authCtrl.confirmEmail, { body: { u: 'u1', t: link.searchParams.get('t') } })).statusCode).toBe(200);
  });

  it('codigo_errado_ou_expirado_ou_utilizador_desconhecido_nao_confirma', async () => {
    await chamar(authCtrl.sendVerificationEmail, req());
    expect((await chamar(authCtrl.confirmEmail, { body: { u: 'u1', t: 'f'.repeat(64) } })).corpo.code).toBe('INVALID_TOKEN');
    expect((await chamar(authCtrl.confirmEmail, { body: { u: 'nao-existe', t: 'abc' } })).corpo.code).toBe('INVALID_TOKEN');
    expect((await chamar(authCtrl.confirmEmail, { body: {} })).corpo.code).toBe('INVALID_TOKEN');
    const t = linkDoEmail().searchParams.get('t');
    mockAuth.utilizadores.u1.app_metadata.verificacao_email.expira = new Date(Date.now() - 1000).toISOString();
    const res = await chamar(authCtrl.confirmEmail, { body: { u: 'u1', t } });
    expect(res.statusCode).toBe(400);
    expect(res.corpo.code).toBe('TOKEN_EXPIRED');
    expect(mockAuth.utilizadores.u1.app_metadata.email_verificado).toBeUndefined();
  });

  it('registar_envia_logo_o_email_de_confirmacao', async () => {
    const res = await chamar(authCtrl.register, { body: { name: 'Rui', email: 'rui@exemplo.cv', password: 'Segura123!' } });
    expect(res.statusCode).toBe(201);
    expect(enviarEmail).toHaveBeenCalledTimes(1);
    expect(enviarEmail.mock.calls[0][0].to).toBe('rui@exemplo.cv');
    expect(linkDoEmail().searchParams.get('u')).toBe('novo-user');
  });

  it('o_email_em_ingles_para_quem_escolheu_ingles', async () => {
    const r = req(); r.traveler.language = 'en';
    await chamar(authCtrl.sendVerificationEmail, r);
    expect(enviarEmail.mock.calls[0][0].subject).toBe('Confirm your email on SalDesk');
  });
});

describe('sem email confirmado', () => {
  const viajante = { id: 't1', email: 'ana@exemplo.cv', email_verificado: false };
  it('reservas_recibo_e_avaliacao_pedem_a_confirmacao', async () => {
    for (const [fn, extra] of [[ctrl.getBookings, {}], [ctrl.getBookingInvoice, { params: { id: 'r1' } }],
      [ctrl.submitReview, { params: { reservationId: 'r1' }, body: { rating: 5 } }]]) {
      const res = await chamar(fn, { traveler: viajante, ...extra });
      expect(res.statusCode).toBe(403);
      expect(res.corpo.code).toBe('EMAIL_NOT_VERIFIED');
    }
  });
});
