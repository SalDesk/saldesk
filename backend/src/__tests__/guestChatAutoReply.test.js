/* sendGuestChatMessage: resposta automatica fora de horas.
   Modulos pesados do controlador simulados; a base de dados e um falso por tabela. */
jest.mock('../helpers/bookingHelpers', () => ({}));
jest.mock('../helpers/customerHelper', () => ({ obterOuCriarCliente: jest.fn() }));
jest.mock('../helpers/emailHelper', () => ({ enviarEmail: jest.fn() }));
jest.mock('../helpers/languageHelper', () => ({ detectarIdioma: jest.fn() }));
jest.mock('../helpers/emailTemplates', () => ({}));
jest.mock('../controllers/vouchersController', () => ({}));
jest.mock('../controllers/affiliatesController', () => ({}));
jest.mock('../helpers/otaSyncHelper', () => ({ dispararSyncImediato: jest.fn() }));
jest.mock('../services/discoverCatalogService', () => ({ getDiscoverCatalog: jest.fn() }));
jest.mock('../services/pushService', () => ({ notifyOperator: jest.fn(() => Promise.resolve()) }));
jest.mock('../services/socketService', () => ({ emitToOperator: jest.fn() }));

/* Estado do falso: o que cada tabela devolve e o que foi inserido */
const estado = { operador: null, recentes: [], falhaNaRespostaAutomatica: false, inseridas: [], consultasRecentes: 0, seq: 0 };

jest.mock('../config/supabase', () => {
  function construir(tabela) {
    const b = { tabela, op: 'select', linha: null };
    ['select', 'eq', 'in', 'gte', 'order', 'limit', 'or'].forEach((m) => {
      b[m] = jest.fn(() => b);
    });
    b.insert = jest.fn((linha) => { b.op = 'insert'; b.linha = linha; return b; });
    const resolver = () => {
      if (tabela === 'operators') return { data: estado.operador, error: null };
      if (tabela === 'messages' && b.op === 'insert') {
        estado.inseridas.push(b.linha);
        if (b.linha.sender_type === 'system' && estado.falhaNaRespostaAutomatica) return { data: null, error: new Error('falha na base de dados') };
        estado.seq += 1;
        return { data: { id: `m${estado.seq}`, sender_type: b.linha.sender_type, content: b.linha.content, channel: 'internal', created_at: 't' }, error: null };
      }
      if (tabela === 'messages') { estado.consultasRecentes += 1; return { data: estado.recentes, error: null }; }
      return { data: [], error: null };
    };
    b.maybeSingle = jest.fn(() => Promise.resolve(resolver()));
    b.single = jest.fn(() => Promise.resolve(resolver()));
    b.then = (ok, ko) => Promise.resolve(resolver()).then(ok, ko);
    return b;
  }
  return { supabaseAdmin: { from: jest.fn((t) => construir(t)) } };
});

const { obterOuCriarCliente } = require('../helpers/customerHelper');
const { emitToOperator } = require('../services/socketService');
const { sendGuestChatMessage } = require('../controllers/publicController');
const { TEXTO_PT, TEXTO_EN } = require('../helpers/chatAutoReply');

const DENTRO = new Date('2026-11-11T12:00:00Z'); // quarta, 11:00 em Cabo Verde
const FORA = new Date('2026-11-14T12:00:00Z');   // sabado
const CONFIG = { enabled: true, days: [1, 2, 3, 4, 5], from: '09:00', to: '18:00', message_pt: '', message_en: '' };

function resposta() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

async function enviar(corpo = {}) {
  const req = { params: { slug: 'demo' }, body: { name: 'Ana', email: 'ana@example.com', content: 'Ola, ha vagas?', ...corpo } };
  const res = resposta();
  const next = jest.fn();
  await sendGuestChatMessage(req, res, next);
  return { res, next };
}

const respostasAutomaticas = () => estado.inseridas.filter((l) => l.sender_type === 'system');

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(FORA);
  estado.operador = { id: 'op1', name: 'Sal Aventura', business_name: null, push_subscription: null, chat_auto_reply: CONFIG };
  estado.recentes = [];
  estado.falhaNaRespostaAutomatica = false;
  estado.inseridas = [];
  estado.consultasRecentes = 0;
  estado.seq = 0;
  obterOuCriarCliente.mockResolvedValue({ id: 'c1', name: 'Ana' });
});
afterEach(() => jest.useRealTimers());

describe('sendGuestChatMessage: resposta automatica', () => {
  it('fora de horas responde uma vez, como sistema, ao hospede, e devolve-a na resposta', async () => {
    const { res, next } = await enviar();
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    const auto = respostasAutomaticas();
    expect(auto).toHaveLength(1);
    expect(auto[0]).toMatchObject({
      operator_id: 'op1', sender_id: 'op1', sender_type: 'system',
      recipient_id: 'c1', recipient_type: 'guest', message_type: 'direct', channel: 'internal', content: TEXTO_PT,
    });
    const corpo = res.json.mock.calls[0][0];
    expect(corpo.data.auto_reply).toMatchObject({ sender_type: 'system', content: TEXTO_PT });
    expect(corpo.data.message.sender_type).toBe('guest');
    /* o operador ve-a no painel em directo */
    expect(emitToOperator).toHaveBeenCalledWith('op1', 'message:new', expect.objectContaining({ sender_type: 'system', recipient_id: 'c1' }));
  });

  it('dentro do horario nao responde', async () => {
    jest.setSystemTime(DENTRO);
    const { res } = await enviar();
    expect(respostasAutomaticas()).toHaveLength(0);
    expect(res.json.mock.calls[0][0].data.auto_reply).toBeUndefined();
  });

  it('desligada ou sem configuracao nao responde nem consulta as mensagens recentes', async () => {
    estado.operador.chat_auto_reply = { ...CONFIG, enabled: false };
    await enviar();
    estado.operador.chat_auto_reply = null;
    await enviar();
    expect(respostasAutomaticas()).toHaveLength(0);
    expect(estado.consultasRecentes).toBe(0);
  });

  it('se o operador ou o sistema ja falou com o hospede nas ultimas 12 horas nao repete', async () => {
    estado.recentes = [{ id: 'anterior' }];
    await enviar();
    expect(respostasAutomaticas()).toHaveLength(0);
    expect(estado.consultasRecentes).toBe(1);
  });

  it('usa o idioma do widget e o texto do operador quando existe', async () => {
    await enviar({ lang: 'en' });
    expect(respostasAutomaticas()[0].content).toBe(TEXTO_EN);
    estado.inseridas = [];
    estado.operador.chat_auto_reply = { ...CONFIG, message_pt: 'Voltamos segunda.', message_en: 'Back Monday.' };
    await enviar({ lang: 'pt' });
    expect(respostasAutomaticas()[0].content).toBe('Voltamos segunda.');
    estado.inseridas = [];
    await enviar({ lang: 'fr' });
    expect(respostasAutomaticas()[0].content).toBe('Voltamos segunda.');
  });

  it('se a resposta automatica falha a mensagem do hospede segue na mesma (201) e sem auto_reply', async () => {
    estado.falhaNaRespostaAutomatica = true;
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { res, next } = await enviar();
    errSpy.mockRestore();
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json.mock.calls[0][0].data.auto_reply).toBeUndefined();
    expect(res.json.mock.calls[0][0].data.message.sender_type).toBe('guest');
  });

  it('a mensagem do hospede e sempre a primeira a ser guardada', async () => {
    await enviar();
    expect(estado.inseridas[0]).toMatchObject({ sender_type: 'guest', content: 'Ola, ha vagas?' });
  });
});
