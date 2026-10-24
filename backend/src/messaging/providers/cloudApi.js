/* CloudApiProvider: WhatsApp Cloud API oficial da Meta, chamada directamente (sem intermediario).

   Credenciais por operador (phone_number_id + token de sistema cifrado). Regras da Meta que este adaptador cumpre:
     - Dentro da janela de 24 h aberta por uma mensagem do cliente: texto livre.
     - Fora dela: so templates aprovados. Sem template aprovado devolve 'failed' com motivo explicito (nunca deixa
       a Meta recusar com um erro obscuro).
     - O id da outbox vai em biz_opaque_callback_data: os estados que voltam trazem-no, e da para reconciliar mesmo
       que o provider_message_id nao tenha chegado a ser gravado.
   Nunca lanca excepcao para erros esperados: devolve 'retry' ou 'failed'. Quem classifica e este adaptador, porque so
   ele conhece os codigos de erro da Meta. */

const crypto = require('crypto');
const { soDigitos } = require('../phone');

const GRAPH = 'https://graph.facebook.com';
const VERSAO_POR_OMISSAO = 'v21.0';
const TIMEOUT_MS = 10_000;
const MAX_TEXTO = 4096;
const RETRY_LONGO_MS = 10 * 60_000;
const RETRY_LIMITE_MS = 60_000;

const capabilities = {
  automatedSend: true,
  inbound: true,
  freeformOutside24h: false,
  templates: true,
  media: false, // fase 3: so texto e templates de texto
  officialApi: true,
};

/* Codigos de erro da Cloud API e o que fazer. 'falha' = definitivo; 'retry' = tentar de novo (com atraso opcional);
   'alerta' = tambem avisa o fundador. */
const ERROS_FALHA = {
  100: 'parametro_invalido',
  130472: 'experiencia_de_utilizador_bloqueada',
  131008: 'parametro_em_falta',
  131009: 'parametro_invalido',
  131021: 'destinatario_igual_ao_remetente',
  131026: 'nao_entregavel_ou_sem_whatsapp',
  131030: 'destinatario_fora_da_lista_permitida',
  131047: 'fora_da_janela_de_24h',
  131051: 'tipo_de_mensagem_nao_suportado',
  131052: 'media_invalida',
  132000: 'numero_de_parametros_do_template_errado',
  132001: 'template_inexistente',
  132005: 'traducao_do_template_demasiado_longa',
  132007: 'template_viola_politica',
  132012: 'formato_de_parametro_do_template_errado',
  132015: 'template_em_pausa',
  132016: 'template_desactivado',
};
const ERROS_RETRY = {
  130429: { motivo: 'limite_de_debito', atrasoMs: RETRY_LIMITE_MS },
  131056: { motivo: 'limite_do_par_remetente_destinatario', atrasoMs: 10 * 60_000 },
  4: { motivo: 'limite_da_api', atrasoMs: RETRY_LIMITE_MS },
  80007: { motivo: 'limite_da_conta', atrasoMs: RETRY_LIMITE_MS },
  131000: { motivo: 'erro_generico_da_meta' },
  131016: { motivo: 'servico_indisponivel' },
  1: { motivo: 'erro_desconhecido_da_meta' },
  2: { motivo: 'servico_indisponivel' },
};
// Problemas que um humano tem de ver: token expirado/revogado, conta restringida, taxa de spam.
const ERROS_ALERTA = {
  190: 'token_expirado_ou_revogado',
  10: 'permissao_negada',
  200: 'permissao_negada',
  368: 'conta_temporariamente_bloqueada',
  131031: 'conta_bloqueada',
  131042: 'problema_de_pagamento',
  131048: 'limite_de_spam',
  131053: 'media_nao_carregada',
};

/* Remove o que a Meta recusa num campo de texto de mensagem (nada: o texto livre aceita quebras de linha). */
function corpoDeTexto(msg, digitos) {
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: digitos,
    type: 'text',
    text: { preview_url: false, body: msg.text },
    biz_opaque_callback_data: String(msg.id || ''),
  };
}

function corpoDeTemplate(msg, digitos, tpl) {
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: digitos,
    type: 'template',
    template: {
      name: tpl.meta_name,
      language: { code: tpl.meta_language },
      components: [{ type: 'body', parameters: msg.templateParams.map((p) => ({ type: 'text', text: p })) }],
    },
    biz_opaque_callback_data: String(msg.id || ''),
  };
}

/* O que devolver a partir de uma resposta de erro da Meta. */
function classificarErro(status, corpo) {
  const e = corpo?.error || {};
  const codigo = Number(e.code);
  const titulo = e.error_data?.details || e.message || '';
  if (ERROS_ALERTA[codigo]) {
    return { tipo: 'retry', motivo: `${ERROS_ALERTA[codigo]} (${codigo})`, atrasoMs: RETRY_LONGO_MS, alerta: true };
  }
  if (ERROS_FALHA[codigo]) {
    return { tipo: 'failed', motivo: `${ERROS_FALHA[codigo]} (${codigo})${titulo ? `: ${String(titulo).slice(0, 160)}` : ''}` };
  }
  if (ERROS_RETRY[codigo]) {
    return { tipo: 'retry', motivo: `${ERROS_RETRY[codigo].motivo} (${codigo})`, atrasoMs: ERROS_RETRY[codigo].atrasoMs };
  }
  if (status === 401) return { tipo: 'retry', motivo: 'token_recusado (401)', atrasoMs: RETRY_LONGO_MS, alerta: true };
  if (status === 429) return { tipo: 'retry', motivo: 'limite_de_debito (429)', atrasoMs: RETRY_LIMITE_MS };
  if (status >= 500) return { tipo: 'retry', motivo: `http_${status}`, atrasoMs: RETRY_LIMITE_MS };
  if (status >= 400 && status < 500) {
    return { tipo: 'failed', motivo: `recusada_pela_meta (${status}${Number.isFinite(codigo) ? `/${codigo}` : ''})${titulo ? `: ${String(titulo).slice(0, 160)}` : ''}` };
  }
  return { tipo: 'retry', motivo: `http_${status}` };
}

function criarCloudApiProvider({
  fetchImpl = fetch,
  graphVersion = VERSAO_POR_OMISSAO,
  obterCredenciais,   // async (operatorId) => { phoneNumberId, token } | null
  janelaAberta,       // async (operatorId, toE164) => boolean
  obterTemplate,      // async (operatorId, trigger, locale) => { meta_name, meta_language, meta_status } | null
  alertar = async () => {},
  timeoutMs = TIMEOUT_MS,
} = {}) {
  async function pedir(caminho, token, { method = 'GET', body } = {}) {
    const controlador = new AbortController();
    const t = setTimeout(() => controlador.abort(), timeoutMs);
    try {
      const res = await fetchImpl(`${GRAPH}/${graphVersion}/${caminho}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controlador.signal,
      });
      let corpo = null;
      try { corpo = await res.json(); } catch (_) { corpo = null; }
      return { status: res.status, corpo };
    } finally {
      clearTimeout(t);
    }
  }

  async function send(msg) {
    const digitos = soDigitos(msg?.to);
    if (digitos.length < 8) return { status: 'failed', reason: 'numero_invalido', permanent: true };
    const text = typeof msg?.text === 'string' ? msg.text.trim() : '';
    if (!text) return { status: 'failed', reason: 'mensagem_vazia', permanent: true };
    if (text.length > MAX_TEXTO) return { status: 'failed', reason: 'mensagem_demasiado_longa', permanent: true };

    const cred = await obterCredenciais(msg.operatorId);
    if (!cred?.phoneNumberId || !cred?.token) {
      await alertar(`Cloud API sem credenciais para o operador ${msg.operatorId}: nao e possivel enviar.`);
      return { status: 'retry', reason: 'credenciais_em_falta', retryAfterMs: RETRY_LONGO_MS };
    }

    let corpo;
    if (await janelaAberta(msg.operatorId, msg.to)) {
      corpo = corpoDeTexto({ ...msg, text }, digitos);
    } else {
      // Fora da janela de 24 h: so templates aprovados.
      const tpl = await obterTemplate(msg.operatorId, msg.context?.trigger, msg.locale);
      if (!tpl || tpl.meta_status !== 'approved' || !Array.isArray(msg.templateParams) || msg.templateParams.length === 0) {
        return { status: 'failed', reason: 'fora_da_janela_sem_template_aprovado', permanent: true };
      }
      corpo = corpoDeTemplate(msg, digitos, tpl);
    }

    let r;
    try {
      r = await pedir(`${encodeURIComponent(cred.phoneNumberId)}/messages`, cred.token, { method: 'POST', body: corpo });
    } catch (err) {
      return { status: 'retry', reason: err.name === 'AbortError' ? 'timeout' : `rede: ${err.message}`, retryAfterMs: RETRY_LIMITE_MS };
    }

    const id = r.corpo?.messages?.[0]?.id;
    if (r.status >= 200 && r.status < 300) {
      return id ? { status: 'sent', providerMessageId: String(id) } : { status: 'retry', reason: 'resposta_sem_id' };
    }
    const c = classificarErro(r.status, r.corpo);
    if (c.alerta) await alertar(`Cloud API (operador ${msg.operatorId}): ${c.motivo}. Verificar o token e a conta no Meta Business.`);
    return c.tipo === 'failed'
      ? { status: 'failed', reason: c.motivo, permanent: true }
      : { status: 'retry', reason: c.motivo, ...(c.atrasoMs ? { retryAfterMs: c.atrasoMs } : {}) };
  }

  /* Estado e qualidade do numero (GREEN/YELLOW/RED), usado para suspender o canal antes que a Meta o faça. */
  async function estadoNumero({ phoneNumberId, token }) {
    try {
      const r = await pedir(`${encodeURIComponent(phoneNumberId)}?fields=display_phone_number,verified_name,quality_rating,status,name_status,messaging_limit_tier`, token);
      if (r.status !== 200) return { ok: false, httpStatus: r.status, erro: r.corpo?.error?.message || null, codigo: r.corpo?.error?.code || null };
      return { ok: true, ...r.corpo };
    } catch (err) {
      return { ok: false, httpStatus: 0, erro: err.message };
    }
  }

  async function submeterTemplate({ wabaId, token }, definicao) {
    try {
      const r = await pedir(`${encodeURIComponent(wabaId)}/message_templates`, token, { method: 'POST', body: definicao });
      return { ok: r.status >= 200 && r.status < 300, httpStatus: r.status, corpo: r.corpo };
    } catch (err) {
      return { ok: false, httpStatus: 0, corpo: { error: { message: err.message } } };
    }
  }

  async function listarTemplates({ wabaId, token }) {
    try {
      const r = await pedir(`${encodeURIComponent(wabaId)}/message_templates?fields=name,language,status,category,id,rejected_reason&limit=100`, token);
      return { ok: r.status === 200, httpStatus: r.status, templates: r.corpo?.data || [], erro: r.corpo?.error?.message || null };
    } catch (err) {
      return { ok: false, httpStatus: 0, templates: [], erro: err.message };
    }
  }

  /* Subscreve a app aos eventos da conta WhatsApp Business (necessario para receber estados e mensagens). */
  async function subscreverApp({ wabaId, token }) {
    try {
      const r = await pedir(`${encodeURIComponent(wabaId)}/subscribed_apps`, token, { method: 'POST' });
      return { ok: r.status >= 200 && r.status < 300, httpStatus: r.status, erro: r.corpo?.error?.message || null };
    } catch (err) {
      return { ok: false, httpStatus: 0, erro: err.message };
    }
  }

  return { id: 'cloud_api', capabilities, send, estadoNumero, submeterTemplate, listarTemplates, subscreverApp, alertar };
}

/* Webhook da Meta: X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(corpo EM BRUTO, segredo da app). */
function verificarAssinaturaMeta(rawBody, headers, appSecret) {
  if (!appSecret || !rawBody) return false;
  const chave = headers && Object.keys(headers).find((k) => k.toLowerCase() === 'x-hub-signature-256');
  const recebido = chave ? headers[chave] : undefined;
  if (typeof recebido !== 'string' || !recebido.startsWith('sha256=')) return false;
  const esperado = crypto.createHmac('sha256', appSecret).update(rawBody).digest();
  const obtido = Buffer.from(recebido.slice(7), 'hex');
  return obtido.length === esperado.length && crypto.timingSafeEqual(obtido, esperado);
}

const ESTADOS_META = { sent: 'sent', delivered: 'delivered', read: 'read', failed: 'failed' };

/* Corpo do webhook -> eventos normalizados. Cada item e independente (um pedido pode trazer varios).
   Eventos que nao interessam devolvem []. */
function parseWebhook(payload) {
  const eventos = [];
  if (!payload || payload.object !== 'whatsapp_business_account' || !Array.isArray(payload.entry)) return eventos;

  for (const entry of payload.entry) {
    for (const change of entry.changes || []) {
      const v = change.value || {};
      const phoneNumberId = v.metadata?.phone_number_id ? String(v.metadata.phone_number_id) : null;
      const wabaId = entry.id ? String(entry.id) : null;

      if (change.field === 'messages') {
        for (const s of v.statuses || []) {
          const estado = ESTADOS_META[s.status];
          if (!estado || !s.id) continue;
          const erro = s.errors?.[0];
          eventos.push({
            type: 'status', phoneNumberId, wabaId, providerMessageId: String(s.id), status: estado,
            outboxId: s.biz_opaque_callback_data || null,
            at: s.timestamp ? new Date(Number(s.timestamp) * 1000) : new Date(),
            error: erro ? `meta_${erro.code}: ${String(erro.title || erro.message || '').slice(0, 160)}` : undefined,
          });
        }
        for (const m of v.messages || []) {
          if (!m.id || !m.from) continue;
          eventos.push({
            type: 'message', phoneNumberId, wabaId, providerMessageId: String(m.id), from: `+${soDigitos(m.from)}`,
            text: m.type === 'text' ? m.text?.body : undefined, messageType: m.type,
            receivedAt: m.timestamp ? new Date(Number(m.timestamp) * 1000) : new Date(),
          });
        }
      }

      if (change.field === 'message_template_status_update' && v.message_template_name) {
        eventos.push({
          type: 'template', wabaId, phoneNumberId, event: String(v.event || '').toUpperCase(),
          templateId: v.message_template_id ? String(v.message_template_id) : null,
          name: v.message_template_name, language: v.message_template_language || null,
          reason: v.reason && v.reason !== 'NONE' ? String(v.reason) : null,
        });
      }
    }
  }
  return eventos;
}

/* Estado do template na Meta -> estado guardado. */
function estadoDoTemplate(evento) {
  switch (String(evento).toUpperCase()) {
    case 'APPROVED': return 'approved';
    case 'REJECTED': return 'rejected';
    case 'PAUSED': return 'paused';
    case 'DISABLED': return 'disabled';
    case 'PENDING': case 'IN_APPEAL': case 'PENDING_DELETION': return 'pending';
    default: return null;
  }
}

module.exports = {
  id: 'cloud_api', capabilities, criarCloudApiProvider, verificarAssinaturaMeta, parseWebhook, classificarErro,
  estadoDoTemplate, RETRY_LONGO_MS, RETRY_LIMITE_MS, VERSAO_POR_OMISSAO,
};
