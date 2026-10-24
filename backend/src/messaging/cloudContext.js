/* Ligacao do CloudApiProvider a base de dados: credenciais do operador, janela de 24 h e templates aprovados. */

const { supabaseAdmin } = require('../config/supabase');
const { lerSegredo } = require('./secrets');
const { soDigitos } = require('./phone');

const JANELA_MS = 24 * 60 * 60 * 1000;
const CACHE_CREDENCIAIS_MS = 60_000;

const cache = new Map(); // operatorId -> { ate, valor }

/* phone_number_id + token (decifrado) do operador, com cache curta. null se nao esta configurado. */
async function obterCredenciais(operatorId, { agora = Date.now() } = {}) {
  const c = cache.get(operatorId);
  if (c && c.ate > agora) return c.valor;
  const { data } = await supabaseAdmin
    .from('messaging_config')
    .select('cloud_phone_id, cloud_token_ref, cloud_status')
    .eq('operator_id', operatorId).maybeSingle();
  let valor = null;
  if (data?.cloud_phone_id && data?.cloud_token_ref) {
    const token = await lerSegredo(data.cloud_token_ref);
    if (token) valor = { phoneNumberId: data.cloud_phone_id, token, estado: data.cloud_status };
  }
  cache.set(operatorId, { ate: agora + CACHE_CREDENCIAIS_MS, valor });
  return valor;
}

function esquecerCredenciais(operatorId) {
  cache.delete(operatorId);
}

/* O cliente escreveu nas ultimas 24 h? Entao o texto livre e permitido. */
async function janelaAberta(operatorId, toE164, { agora = Date.now() } = {}) {
  const numero = `+${soDigitos(toE164)}`;
  const desde = new Date(agora - JANELA_MS).toISOString();
  const { data } = await supabaseAdmin
    .from('message_inbound')
    .select('id')
    .eq('operator_id', operatorId).eq('provider', 'cloud_api').eq('contact_e164', numero)
    .gte('received_at', desde)
    .limit(1);
  return !!data?.length;
}

async function obterTemplate(operatorId, trigger, locale) {
  const { data } = await supabaseAdmin
    .from('message_meta_templates')
    .select('meta_name, meta_language, meta_status')
    .eq('operator_id', operatorId).eq('trigger', trigger).eq('locale', locale)
    .maybeSingle();
  return data || null;
}

module.exports = { obterCredenciais, esquecerCredenciais, janelaAberta, obterTemplate, JANELA_MS };
