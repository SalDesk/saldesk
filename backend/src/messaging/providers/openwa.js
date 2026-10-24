/* OpenWAProvider: so para desenvolvimento e operacao interna da Wandr. NUNCA para operadores clientes.

   Cliente fino sobre a REST API do OpenWA (gateway nao oficial, auto-alojado), apontado para uma
   instancia isolada (127.0.0.1:2785). O router recusa este adapter a qualquer operador que nao
   seja o interno e so o regista com OPENWA_ENABLED=true e a configuracao completa.

   Assume-se perda de sessao a qualquer momento: nesses casos send() devolve 'retry' com um atraso
   longo e emite alerta; nunca falha em silencio nem desiste logo. Erros definitivos (numero
   recusado, texto demasiado longo) sao 'failed'.

   API usada (docs do OpenWA):
     POST /api/sessions/{id}/messages/send-text  { chatId: "<numero>@c.us", text }  -> 201 { messageId, timestamp }
     GET  /api/sessions/{id}                     -> { status: created|initializing|qr_ready|authenticating|ready|disconnected|action_required|failed }
     Webhooks: assinatura X-OpenWA-Signature = "sha256=" + HMAC-SHA256(corpo em bruto, segredo). */

const crypto = require('crypto');
const { soDigitos } = require('../phone');

const TIMEOUT_MS = 10_000;
const RETRY_LONGO_MS = 10 * 60_000;
const RETRY_MOTOR_MS = 2 * 60_000;
const MAX_TEXTO = 4096; // limite do OpenWA para send-text

const capabilities = {
  automatedSend: true,
  inbound: true,
  freeformOutside24h: true,
  templates: false,
  media: false,        // fase 2: so texto
  officialApi: false,  // nao conforme com os termos da Meta: ver nota acima
};

/* Mensagens de erro do OpenWA que indicam problema de sessao (e nao de numero). */
const ERRO_DE_SESSAO = /session|sess[aã]o|inactive|not (?:ready|active|started|connected)|disconnected|engine|qr/i;

/* Configuracao a partir do ambiente. So devolve algo com o adapter ligado e tudo preenchido. */
function configuracao(env = process.env) {
  if (env.OPENWA_ENABLED !== 'true') return null;
  const { OPENWA_BASE_URL: baseUrl, OPENWA_API_KEY: apiKey, OPENWA_SESSION_ID: sessionId } = env;
  if (!baseUrl || !apiKey || !sessionId) return null;
  return { baseUrl: baseUrl.replace(/\/+$/, ''), apiKey, sessionId, webhookSecret: env.OPENWA_WEBHOOK_SECRET || null };
}

/* O que fazer com o estado da sessao: nada, tentar reiniciar sozinho, ou chamar um humano
   (precisa de ler um QR / codigo outra vez, ou o WhatsApp restringiu o numero). */
function accaoParaEstado(status) {
  if (status === 'ready') return 'ok';
  if (['authenticating', 'initializing'].includes(status)) return 'aguardar';
  if (['disconnected', 'created'].includes(status)) return 'reiniciar';
  return 'humano'; // qr_ready, action_required, failed, sem resposta (null)...
}

function chatId(toE164) {
  return `${soDigitos(toE164)}@c.us`;
}

function cabecalho(headers, nome) {
  if (!headers) return undefined;
  const alvo = nome.toLowerCase();
  const chave = Object.keys(headers).find((k) => k.toLowerCase() === alvo);
  return chave ? headers[chave] : undefined;
}

function criarOpenWaProvider({ baseUrl, apiKey, sessionId, webhookSecret = null, fetchImpl = fetch, alertar = async () => {}, timeoutMs = TIMEOUT_MS } = {}) {
  async function pedir(caminho, { method = 'GET', body, headers = {} } = {}) {
    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), timeoutMs);
    try {
      const res = await fetchImpl(`${baseUrl}${caminho}`, {
        method,
        headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json', ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controlador.signal,
      });
      let corpo = null;
      try { corpo = await res.json(); } catch (_) { corpo = null; }
      return { status: res.status, corpo, retryAfter: res.headers?.get?.('retry-after') ?? null };
    } finally {
      clearTimeout(temporizador);
    }
  }

  /* Sessao em baixo ou motor nao pronto: tenta de novo mais tarde e avisa. */
  async function retryComAlerta(motivo, retryAfterMs) {
    await alertar(`OpenWA indisponivel (${motivo}). As mensagens ficam em fila e voltam a tentar.`);
    return { status: 'retry', reason: motivo, retryAfterMs };
  }

  async function send(msg) {
    const digitos = soDigitos(msg?.to);
    if (digitos.length < 8) return { status: 'failed', reason: 'numero_invalido', permanent: true };
    const text = typeof msg?.text === 'string' ? msg.text.trim() : '';
    if (!text) return { status: 'failed', reason: 'mensagem_vazia', permanent: true };
    if (text.length > MAX_TEXTO) return { status: 'failed', reason: 'mensagem_demasiado_longa', permanent: true };

    let r;
    try {
      // O id da outbox vai como chave de idempotencia: um reenvio apos falha a meio nao duplica.
      r = await pedir(`/api/sessions/${encodeURIComponent(sessionId)}/messages/send-text`, {
        method: 'POST',
        body: { chatId: chatId(msg.to), text },
        headers: msg.id ? { 'Idempotency-Key': String(msg.id) } : {},
      });
    } catch (err) {
      const motivo = err.name === 'AbortError' ? 'timeout' : `rede: ${err.message}`;
      return retryComAlerta(motivo, RETRY_LONGO_MS);
    }

    const aviso = r.corpo?.message ? String(r.corpo.message) : '';

    if (r.status === 201 || r.status === 200) {
      const id = r.corpo?.messageId || r.corpo?.id;
      if (!id) return { status: 'retry', reason: 'resposta_sem_messageId' };
      return { status: 'sent', providerMessageId: String(id) };
    }
    if (r.status === 429) {
      const seg = Number(r.corpo?.retryAfterSeconds) || Number(r.retryAfter) || 30;
      return { status: 'retry', reason: r.corpo?.code || 'rate_limited', retryAfterMs: Math.min(Math.max(seg, 5), 3600) * 1000 };
    }
    if (r.status === 400) {
      if (ERRO_DE_SESSAO.test(aviso)) return retryComAlerta(`sessao: ${aviso}`, RETRY_LONGO_MS);
      return { status: 'failed', reason: `recusada: ${aviso || 'pedido invalido'}`, permanent: true };
    }
    if (r.status === 404) return retryComAlerta(`sessao_nao_encontrada: ${aviso}`, RETRY_LONGO_MS);
    if (r.status === 409) return retryComAlerta('motor_nao_pronto', RETRY_MOTOR_MS);
    if ([502, 503, 504].includes(r.status)) return retryComAlerta(`http_${r.status}`, RETRY_LONGO_MS);
    if (r.status === 401 || r.status === 403) {
      await alertar('OpenWA recusou a chave de API (401/403): verificar OPENWA_API_KEY.');
      return { status: 'retry', reason: `auth_${r.status}`, retryAfterMs: RETRY_LONGO_MS };
    }
    return { status: 'retry', reason: `http_${r.status}${aviso ? `: ${aviso}` : ''}` };
  }

  /* Estado da sessao ('ready' = ligada). null se o OpenWA nao responder. */
  async function estadoSessao() {
    try {
      const r = await pedir(`/api/sessions/${encodeURIComponent(sessionId)}`);
      if (r.status !== 200) return { status: null, httpStatus: r.status };
      return { status: r.corpo?.status || null, phone: r.corpo?.phone || null, lastError: r.corpo?.lastError || null };
    } catch (_) {
      return { status: null, httpStatus: 0 };
    }
  }

  /* Arranca (ou volta a arrancar) a sessao a partir das credenciais guardadas. Depois de reiniciar o
     contentor ou o servidor a sessao fica 'disconnected' ate alguem chamar isto. */
  async function iniciarSessao() {
    try {
      const r = await pedir(`/api/sessions/${encodeURIComponent(sessionId)}/start`, { method: 'POST' });
      return { ok: r.status >= 200 && r.status < 300, httpStatus: r.status, status: r.corpo?.status || null };
    } catch (err) {
      return { ok: false, httpStatus: 0, status: null };
    }
  }

  /* Webhook assinado: HMAC-SHA256 sobre o corpo EM BRUTO (nunca o JSON re-serializado). */
  function verifyWebhook(rawBody, headers, segredo = webhookSecret) {
    if (!segredo) return false;
    const recebido = cabecalho(headers, 'x-openwa-signature');
    if (typeof recebido !== 'string' || !recebido.startsWith('sha256=')) return false;
    const esperado = crypto.createHmac('sha256', segredo).update(rawBody).digest();
    let obtido;
    try { obtido = Buffer.from(recebido.slice(7), 'hex'); } catch (_) { return false; }
    return obtido.length === esperado.length && crypto.timingSafeEqual(obtido, esperado);
  }

  return { id: 'openwa', capabilities, send, estadoSessao, iniciarSessao, verifyWebhook, parseWebhook, alertar };
}

/* Envelope do OpenWA -> eventos normalizados. Eventos que nao interessam devolvem [].
   Envelope: { event, timestamp, sessionId, idempotencyKey, deliveryId, data } */
function parseWebhook(envelope, { operatorId = null } = {}) {
  if (!envelope || typeof envelope !== 'object') return [];
  const { event, data = {} } = envelope;
  const quando = envelope.timestamp ? new Date(envelope.timestamp) : new Date();

  if (event === 'message.received') {
    if (data.fromMe || data.isGroup) return []; // so conversas individuais, e nunca as proprias
    const de = soDigitos(String(data.from || data.chatId || '').split('@')[0]);
    if (!de || !data.id) return [];
    return [{
      type: 'message', operatorId, from: de.length ? `+${de}` : '',
      providerMessageId: String(data.id), text: typeof data.body === 'string' ? data.body : undefined,
      receivedAt: data.timestamp ? new Date(Number(data.timestamp) * 1000) : quando,
    }];
  }

  if (event === 'message.ack' || event === 'message.failed') {
    const estado = event === 'message.failed' ? 'failed' : data.status;
    if (!['sent', 'delivered', 'read', 'failed'].includes(estado)) return [];
    const ids = [data.messageId, data.id].filter(Boolean).map(String);
    if (!ids.length) return [];
    return [{ type: 'status', providerMessageId: ids[0], alternativeIds: ids.slice(1), status: estado, at: quando, error: estado === 'failed' ? 'message.failed' : undefined }];
  }

  if (['session.status', 'session.disconnected', 'session.reconnect_loop', 'session.restriction'].includes(event)) {
    return [{ type: 'session', event, status: data.status || null, at: quando }];
  }
  return [];
}

module.exports = {
  id: 'openwa', capabilities, configuracao, criarOpenWaProvider, parseWebhook, chatId, accaoParaEstado,
  TIMEOUT_MS, RETRY_LONGO_MS, RETRY_MOTOR_MS, MAX_TEXTO,
};
