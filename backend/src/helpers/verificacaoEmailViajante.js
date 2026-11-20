/* Confirmacao do email do viajante. A area do viajante mostra as reservas, recibos e avaliacoes do
   email da conta, por isso so o faz depois de a pessoa provar que o email e seu: um link enviado para
   esse email, ou entrar com Google/Apple (que ja verificam o email).
   Tudo fica em app_metadata da conta de autenticacao (so o servidor a pode escrever; o viajante nao):
     email_verificado: true                         -- confirmado
     verificacao_email: { hash, expira }            -- pedido em curso (so o hash do codigo, nunca o codigo) */
const crypto = require('crypto');
const { enviarEmail } = require('./emailHelper');
const { travelerVerifyEmail } = require('./emailTemplates');
const { frontendBase } = require('../utils/urls');

const VALIDADE_HORAS = 48;

function emailConfirmado(user) {
  const meta = (user && user.app_metadata) || {};
  if (meta.email_verificado === true) return true;
  const fornecedores = Array.isArray(meta.providers) ? meta.providers : (meta.provider ? [meta.provider] : []);
  return fornecedores.some((p) => p && p !== 'email');
}

function hashCodigo(codigo) {
  return crypto.createHash('sha256').update(String(codigo)).digest('hex');
}

function novoPedido(agora = new Date()) {
  const codigo = crypto.randomBytes(32).toString('hex');
  return {
    codigo,
    registo: { hash: hashCodigo(codigo), expira: new Date(agora.getTime() + VALIDADE_HORAS * 3600000).toISOString() },
  };
}

/* 'ok' | 'expirado' | 'invalido' */
function estadoDoCodigo(registo, codigo, agora = new Date()) {
  if (!registo || !registo.hash || !registo.expira || typeof codigo !== 'string' || !/^[0-9a-f]{64}$/.test(codigo)) return 'invalido';
  const a = Buffer.from(registo.hash, 'hex');
  const b = Buffer.from(hashCodigo(codigo), 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return 'invalido';
  if (new Date(registo.expira) <= agora) return 'expirado';
  return 'ok';
}

/* Cria um pedido novo (o anterior deixa de valer) e envia o link para o email da conta */
async function enviarPedidoVerificacao(supabase, user, { nome, idioma } = {}) {
  const { codigo, registo } = novoPedido();
  const { error } = await supabase.auth.admin.updateUserById(user.id, { app_metadata: { verificacao_email: registo } });
  if (error) throw error;
  const link = `${frontendBase()}/viajante/confirmar-email?u=${encodeURIComponent(user.id)}&t=${codigo}`;
  const { subject, html, text } = travelerVerifyEmail({ name: nome, link, lang: idioma === 'en' ? 'en' : 'pt' });
  await enviarEmail({ to: user.email, subject, html, text });
}

/* 'ok' (confirmado agora ou ja estava) | 'expirado' | 'invalido' */
async function confirmarEmail(supabase, userId, codigo) {
  if (!userId || typeof userId !== 'string') return 'invalido';
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  const user = data && data.user;
  if (error || !user) return 'invalido';
  if (emailConfirmado(user)) return 'ok';
  const estado = estadoDoCodigo(user.app_metadata && user.app_metadata.verificacao_email, codigo);
  if (estado !== 'ok') return estado;
  const { error: errUpd } = await supabase.auth.admin.updateUserById(user.id, {
    app_metadata: { email_verificado: true, verificacao_email: null },
  });
  if (errUpd) throw errUpd;
  return 'ok';
}

module.exports = { emailConfirmado, estadoDoCodigo, novoPedido, enviarPedidoVerificacao, confirmarEmail, VALIDADE_HORAS };
