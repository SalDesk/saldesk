const sgMail = require('@sendgrid/mail');
const { supabaseAdmin } = require('../config/supabase');
const {
  classificarErro, proximaTentativa, serializarPayload, desserializarPayload, destinatarioEmTexto,
} = require('./emailQueue');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

/* Pedido ao SendGrid a partir dos dados do email. Partilhado pelo envio normal e pelo reenvio automatico.
   attachments: [{ filename, content: Buffer, contentType }] -- callers
   passam sempre um Buffer real (nunca base64 pre-codificado), a conversao
   para o formato que o SendGrid exige fica so aqui, num sitio unico. */
function montarMensagem({ to, subject, html, text, attachments }) {
  const finalHtml = html || `<p style="font-family:Arial,sans-serif;line-height:1.6">${(text || '').replace(/\n/g, '<br>')}</p>`;
  const finalText = text || (html ? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '');

  /* BCC para a propria caixa de envio -- sem isto, nenhum email enviado via
     API ficava visivel em lado nenhum que o founder pudesse consultar
     directamente. O SendGrid rejeita o pedido inteiro (erro 400) se o mesmo
     endereco aparecer em "to" e "bcc" ao mesmo tempo -- ja aconteceu com
     notificacoes internas enviadas para a propria contacto@saldesk.cv (ex.
     "Nova candidatura"). So adiciona o BCC quando o destinatario ainda nao
     o inclui.
     BCC_EMAIL permite apontar a copia para outra caixa: o Hostinger
     (contacto@) rejeita o IP partilhado do SendGrid quando este entra em
     listas negras (SpamCop/Mailspike), e a copia perdia-se. */
  const bccEmail = process.env.BCC_EMAIL || process.env.SENDGRID_FROM_EMAIL;
  const toList = Array.isArray(to) ? to : [to];
  const jaIncluido = toList.some((t) => t?.toLowerCase() === bccEmail?.toLowerCase());

  return {
    to,
    ...(jaIncluido ? {} : { bcc: bccEmail }),
    from: { email: process.env.SENDGRID_FROM_EMAIL, name: 'SalDesk' },
    subject,
    text: finalText,
    html: finalHtml,
    ...(Array.isArray(attachments) && attachments.length ? {
      attachments: attachments.map((a) => ({
        filename: a.filename,
        type: a.contentType || 'application/octet-stream',
        content: a.content.toString('base64'),
        disposition: 'attachment',
      })),
    } : {}),
  };
}

/* err.message do @sendgrid/mail e so o texto generico do status HTTP
   (ex. "Unauthorized" para um 401) -- o motivo real (ex. "Maximum
   credits exceeded") so vem em err.response.body.errors, que nenhum
   caller deste helper alguma vez logava. Reconstroi a mensagem para
   que todo o "console.error(..., err.message)" ja existente no resto
   do codigo passe a mostrar o motivo real sem precisar de tocar em
   cada callsite. */
function enriquecerErro(err) {
  const detalhe = err.response?.body?.errors?.map((e) => e.message).join('; ');
  if (detalhe && !String(err.message).includes(detalhe)) err.message = `${err.message}: ${detalhe}`;
  return err;
}

/* Guarda o email que falhou, com o conteudo, para o worker o reenviar sozinho (ver services/emailRetryService.js).
   Erros permanentes ficam registados mas nao se repetem. Nunca deixa uma falha a registar a falha derrubar o
   comportamento existente do caller. */
function registarFalha(args, kind, err) {
  const { payload, anexosDescartados } = serializarPayload(args);
  const classe = classificarErro(err);
  const reenviavel = classe.retryable && !anexosDescartados;
  supabaseAdmin.from('email_failures').insert({
    context: args.subject || null,
    to_email: destinatarioEmTexto(args.to),
    error_message: err.message,
    payload,
    kind,
    status: reenviavel ? 'pending' : 'permanent',
    attempts: 1,
    next_attempt_at: reenviavel ? proximaTentativa(1).toISOString() : null,
    last_error: anexosDescartados ? 'anexos demasiado grandes para guardar: nao se reenvia' : err.message,
  }).then(({ error: logErr }) => {
    if (logErr) console.error('[EmailFailureLog] Erro ao registar falha de email:', logErr.message);
  });
}

/* kind: 'transactional' (por omissao) ou 'alert' (alertas do proprio sistema: reenviam-se, mas nunca geram outro alerta). */
async function enviarEmail({ to, subject, html, text, attachments, kind = 'transactional' }) {
  const args = { to, subject, html, text, attachments };
  try {
    await sgMail.send(montarMensagem(args));
  } catch (err) {
    enriquecerErro(err);
    registarFalha(args, kind, err);
    throw err;
  }
}

/* Reenvio a partir do conteudo guardado. Nao regista outra falha (quem chama actualiza a linha existente). */
async function reenviarGuardado(payload) {
  try {
    await sgMail.send(montarMensagem(desserializarPayload(payload)));
  } catch (err) {
    throw enriquecerErro(err);
  }
}

module.exports = { enviarEmail, reenviarGuardado, montarMensagem };
