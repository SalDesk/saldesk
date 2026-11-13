/* PUT /onboarding/operator (updateOperator): validacao e gravacao de chat_auto_reply. */
jest.mock('../helpers/emailHelper', () => ({ enviarEmail: jest.fn() }));
jest.mock('../helpers/emailTemplates', () => ({ operatorWelcomeEmail: jest.fn() }));

const estado = { atualizacao: null, linhasAtualizadas: 0 };
jest.mock('../config/supabase', () => {
  const b = {};
  ['from', 'eq', 'select'].forEach((m) => { b[m] = jest.fn(() => b); });
  b.update = jest.fn((valores) => { estado.atualizacao = valores; estado.linhasAtualizadas += 1; return b; });
  b.single = jest.fn(() => Promise.resolve({ data: { id: 'op1', ...estado.atualizacao }, error: null }));
  return { supabaseAdmin: b };
});

const { supabaseAdmin } = require('../config/supabase');
const { updateOperator } = require('../controllers/onboardingController');

function resposta() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

async function guardar(corpo) {
  const req = { operator: { id: 'op1', name: 'Sal Aventura', slug: 'sal-aventura' }, body: corpo };
  const res = resposta();
  const next = jest.fn();
  await updateOperator(req, res, next);
  return { res, next };
}

beforeEach(() => {
  jest.clearAllMocks();
  estado.atualizacao = null;
  estado.linhasAtualizadas = 0;
});

describe('updateOperator: chat_auto_reply', () => {
  it('guarda a configuracao validada e normalizada', async () => {
    const { res } = await guardar({ chat_auto_reply: { enabled: true, days: [5, 1], from: '09:00', to: '17:30', message_pt: ' Ola ', message_en: '' } });
    expect(supabaseAdmin.update).toHaveBeenCalledTimes(1);
    expect(estado.atualizacao.chat_auto_reply).toEqual({ enabled: true, days: [1, 5], from: '09:00', to: '17:30', message_pt: 'Ola', message_en: '' });
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Perfil actualizado com sucesso' }));
  });

  it('null desliga e limpa a configuracao', async () => {
    await guardar({ chat_auto_reply: null });
    expect(estado.atualizacao).toHaveProperty('chat_auto_reply', null);
  });

  it('sem o campo nao mexe na configuracao existente', async () => {
    await guardar({ tagline: 'Novo' });
    expect(estado.atualizacao).not.toHaveProperty('chat_auto_reply');
  });

  it.each([
    ['horario invertido', { enabled: true, days: [1], from: '18:00', to: '09:00' }],
    ['dia invalido', { enabled: true, days: [9], from: '09:00', to: '18:00' }],
    ['ligada sem dias', { enabled: true, days: [], from: '09:00', to: '18:00' }],
    ['texto demasiado longo', { enabled: true, days: [1], from: '09:00', to: '18:00', message_pt: 'x'.repeat(501) }],
    ['formato errado', 'ligar'],
  ])('rejeita %s com 400 INVALID_CHAT_AUTO_REPLY e nao grava nada', async (_, valor) => {
    const { res, next } = await guardar({ chat_auto_reply: valor, tagline: 'nao deve gravar' });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_CHAT_AUTO_REPLY' }));
    expect(supabaseAdmin.update).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
