/* Logica pura do reenvio automatico de emails (sem rede nem base de dados).

   Quando o SendGrid falha (conta bloqueada, creditos, rede, 5xx), o email nao se perde: guarda-se o conteudo em
   email_failures e o worker volta a tentar com intervalos crescentes. So se repete o que pode vir a funcionar:
   erros permanentes (endereco invalido, pedido mal formado) nao se repetem. */

// Espera ate a proxima tentativa, depois de cada falha (minutos). Total de 8 tentativas em cerca de 2 dias (a ultima, 24 h depois da anterior).
const BACKOFF_MIN = [5, 15, 60, 180, 360, 720, 1440];

// Anexos acima disto nao se guardam (o email ficaria demasiado pesado para a tabela): nao se reenvia sem eles.
const MAX_ANEXOS_BYTES = 3 * 1024 * 1024;

const MIN = 60 * 1000;
const HORA = 60 * MIN;

// Emails com links que expiram (acesso, password, codigos): depois de passado o prazo, reenviar o mesmo link nao serve.
const ASSUNTO_COM_LINK_QUE_EXPIRA = /acesso|password|repor|recupera|c[oó]digo|verifica/i;

/* O que fazer com um erro do SendGrid. err.code e o estado HTTP; sem codigo numerico e uma falha de rede. */
function classificarErro(err) {
  const code = Number(err?.code ?? err?.response?.statusCode);
  if (!Number.isFinite(code)) return { retryable: true, motivo: 'rede' };
  if ([408, 425, 429].includes(code) || code >= 500) return { retryable: true, motivo: `http_${code}` };
  // 401/403: conta bloqueada, creditos esgotados ou chave recusada. Pode ser resolvido do lado do SendGrid: volta a tentar.
  if (code === 401 || code === 403) return { retryable: true, motivo: `conta_${code}` };
  // 400 (endereco invalido, pedido mal formado), 404, 413...: repetir daria sempre o mesmo erro.
  return { retryable: false, motivo: `http_${code}` };
}

/* Data da proxima tentativa, dado o numero de tentativas JA feitas. null = esgotadas. */
function proximaTentativa(tentativasFeitas, agora = new Date()) {
  const espera = BACKOFF_MIN[tentativasFeitas - 1];
  return espera === undefined ? null : new Date(agora.getTime() + espera * MIN);
}

/* Tempo maximo para ainda valer a pena entregar. */
function ttlDoEmail({ assunto, kind } = {}) {
  if (kind === 'alert') return 6 * HORA;
  if (ASSUNTO_COM_LINK_QUE_EXPIRA.test(String(assunto || ''))) return HORA;
  return 48 * HORA;
}

function expirado({ context, kind, created_at: criado }, agora = new Date()) {
  return agora.getTime() - new Date(criado).getTime() > ttlDoEmail({ assunto: context, kind });
}

/* Conteudo guardado para reenviar. Os anexos vao em base64; se forem demasiado grandes ficam de fora e
   anexosDescartados avisa (esse email nao se reenvia: iria sem o anexo). */
function serializarPayload({ to, subject, html, text, attachments }) {
  const lista = [];
  let total = 0;
  let descartados = false;
  for (const a of Array.isArray(attachments) ? attachments : []) {
    const buf = Buffer.isBuffer(a.content) ? a.content : Buffer.from(String(a.content ?? ''));
    total += buf.length;
    if (total > MAX_ANEXOS_BYTES) { descartados = true; break; }
    lista.push({ filename: a.filename, contentType: a.contentType || 'application/octet-stream', content_b64: buf.toString('base64') });
  }
  return {
    payload: { to, subject: subject ?? null, html: html ?? null, text: text ?? null, attachments: descartados ? [] : lista },
    anexosDescartados: descartados,
  };
}

function desserializarPayload(p) {
  return {
    to: p.to,
    subject: p.subject,
    html: p.html || undefined,
    text: p.text || undefined,
    attachments: (p.attachments || []).map((a) => ({ filename: a.filename, contentType: a.contentType, content: Buffer.from(a.content_b64, 'base64') })),
  };
}

/* Texto curto do destinatario para a tabela/alertas (to pode ser uma lista). */
function destinatarioEmTexto(to) {
  return (Array.isArray(to) ? to : [to]).filter(Boolean).join(', ') || null;
}

module.exports = {
  BACKOFF_MIN, MAX_ANEXOS_BYTES, classificarErro, proximaTentativa, ttlDoEmail, expirado,
  serializarPayload, desserializarPayload, destinatarioEmTexto,
};
