/* Router: escolhe o adapter do operador. O modulo de negocio nunca escolhe.

   - wa.me existe sempre (nao depende de nada).
   - Cloud API (oficial da Meta): so com CLOUD_API_ENABLED=true; por operador, so se cloud_status='active'.
     A decisao de consentimento (opt-in) e das automacoes sem template esta em outbox.escolherProvider.
   - OpenWA so entra no registo com OPENWA_ENABLED=true e a configuracao completa, e SO e
     devolvido ao operador interno da Wandr (WANDR_INTERNAL_OPERATOR_ID). Qualquer outro
     operador cai no wa.me, mesmo que a configuracao peca openwa: o bloqueio e aqui, no
     codigo, e nao numa definicao que alguem possa alterar. */

const wame = require('./providers/wame');
const openwa = require('./providers/openwa');
const cloudApi = require('./providers/cloudApi');
const { criarAlertador } = require('./alert');

let cache = { chave: null, registo: null };

function chaveDoAmbiente(env) {
  return JSON.stringify([env.OPENWA_ENABLED, env.OPENWA_BASE_URL, env.OPENWA_API_KEY, env.OPENWA_SESSION_ID, env.OPENWA_WEBHOOK_SECRET, env.OPENWA_ALERT_EMAIL, env.CLOUD_API_ENABLED, env.META_GRAPH_VERSION]);
}

/* Alertador por omissao: log + email ao fundador (no maximo 1 por hora). */
function alertadorPorOmissao(env) {
  let enviar = null;
  try { ({ enviarEmail: enviar } = require('../helpers/emailHelper')); } catch (_) { /* sem email: so log */ }
  return criarAlertador({ enviar, para: env.OPENWA_ALERT_EMAIL || env.BCC_EMAIL });
}

/* Providers disponiveis para este ambiente (guardado em cache enquanto o ambiente nao muda). */
function obterRegisto(env = process.env) {
  const chave = chaveDoAmbiente(env);
  if (cache.registo && cache.chave === chave) return cache.registo;
  const registo = { wame };
  const alertar = alertadorPorOmissao(env); // um so alertador: nao ha dois emails por hora so porque ha dois adapters
  const cfg = openwa.configuracao(env);
  if (cfg) registo.openwa = openwa.criarOpenWaProvider({ ...cfg, alertar });
  if (env.CLOUD_API_ENABLED === 'true') {
    const ctx = require('./cloudContext'); // so aqui: liga a base de dados
    registo.cloud_api = cloudApi.criarCloudApiProvider({
      graphVersion: env.META_GRAPH_VERSION || cloudApi.VERSAO_POR_OMISSAO,
      obterCredenciais: ctx.obterCredenciais, janelaAberta: ctx.janelaAberta, obterTemplate: ctx.obterTemplate,
      alertar,
    });
  }
  cache = { chave, registo };
  return registo;
}

function resolveProvider(cfg, { providers, env = process.env } = {}) {
  const registo = providers || obterRegisto(env);

  if (cfg?.provider === 'openwa') {
    const permitido = env.OPENWA_ENABLED === 'true'
      && !!env.WANDR_INTERNAL_OPERATOR_ID
      && cfg.operator_id === env.WANDR_INTERNAL_OPERATOR_ID;
    return permitido && registo.openwa ? registo.openwa : registo.wame; // nunca expor OpenWA a um cliente
  }
  if (cfg?.provider === 'cloud_api' && cfg.cloud_status === 'active' && registo.cloud_api) {
    return registo.cloud_api;
  }
  return registo.wame;
}

module.exports = { resolveProvider, obterRegisto };
