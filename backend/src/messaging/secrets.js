/* Segredos por operador (tokens da Cloud API), cifrados com AES-256-GCM.

   A chave (MESSAGING_ENCRYPTION_KEY, 32 bytes em base64) existe so no ambiente do servidor/worker, nunca na
   base de dados nem no repositorio. A tabela messaging_secrets guarda apenas texto cifrado, e
   messaging_config.cloud_token_ref aponta para ele. O "ref" entra como dado autenticado (AAD): um texto
   cifrado copiado para a linha de outro operador deixa de decifrar.

   Formato: v1.<iv>.<tag>.<dados>, tudo em base64url. */

const crypto = require('crypto');
const { supabaseAdmin } = require('../config/supabase');

const VERSAO = 'v1';

function erro(message, code) {
  const e = new Error(message);
  e.code = code;
  return e;
}

function chaveDoAmbiente(env = process.env) {
  const bruto = env.MESSAGING_ENCRYPTION_KEY;
  if (!bruto) throw erro('MESSAGING_ENCRYPTION_KEY nao esta definida', 'NO_ENCRYPTION_KEY');
  const chave = Buffer.from(bruto, 'base64');
  if (chave.length !== 32) throw erro('MESSAGING_ENCRYPTION_KEY tem de ter 32 bytes (base64)', 'BAD_ENCRYPTION_KEY');
  return chave;
}

function cifrar(texto, chave, aad) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', chave, iv);
  if (aad) c.setAAD(Buffer.from(aad));
  const dados = Buffer.concat([c.update(String(texto), 'utf8'), c.final()]);
  return [VERSAO, iv.toString('base64url'), c.getAuthTag().toString('base64url'), dados.toString('base64url')].join('.');
}

function decifrar(cifrado, chave, aad) {
  const partes = String(cifrado || '').split('.');
  if (partes.length !== 4 || partes[0] !== VERSAO) throw erro('Formato de segredo desconhecido', 'BAD_SECRET_FORMAT');
  try {
    const d = crypto.createDecipheriv('aes-256-gcm', chave, Buffer.from(partes[1], 'base64url'));
    if (aad) d.setAAD(Buffer.from(aad));
    d.setAuthTag(Buffer.from(partes[2], 'base64url'));
    return Buffer.concat([d.update(Buffer.from(partes[3], 'base64url')), d.final()]).toString('utf8');
  } catch (_) {
    // Chave errada, texto alterado ou ref trocado: nunca se distingue o motivo.
    throw erro('Nao foi possivel decifrar o segredo', 'DECRYPT_FAILED');
  }
}

function refDoToken(operatorId) {
  return `cloud-token:${operatorId}`;
}

/* Guarda (ou substitui) o segredo e devolve o ref para pôr em messaging_config.cloud_token_ref. */
async function guardarSegredo(operatorId, valor, { ref = refDoToken(operatorId), env = process.env } = {}) {
  const ciphertext = cifrar(valor, chaveDoAmbiente(env), ref);
  const { error } = await supabaseAdmin.from('messaging_secrets').upsert(
    { ref, operator_id: operatorId, ciphertext, updated_at: new Date().toISOString() },
    { onConflict: 'ref' },
  );
  if (error) throw error;
  return ref;
}

async function lerSegredo(ref, { env = process.env } = {}) {
  if (!ref) return null;
  const { data, error } = await supabaseAdmin.from('messaging_secrets').select('ciphertext').eq('ref', ref).maybeSingle();
  if (error) throw error;
  return data ? decifrar(data.ciphertext, chaveDoAmbiente(env), ref) : null;
}

async function apagarSegredo(ref) {
  if (!ref) return;
  await supabaseAdmin.from('messaging_secrets').delete().eq('ref', ref);
}

module.exports = { cifrar, decifrar, chaveDoAmbiente, refDoToken, guardarSegredo, lerSegredo, apagarSegredo };
