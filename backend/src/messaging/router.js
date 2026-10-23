/* Router: escolhe o adapter do operador. O modulo de negocio nunca escolhe.

   Fase 1: so existe o wa.me. Cloud API (fase 3) e OpenWA (fase 2) entram no registo
   quando existirem; ate la qualquer pedido para eles cai no wa.me, que nao depende de nada.
   Regra de seguranca (ja fixada): o OpenWA nunca e activavel por um operador cliente,
   so para o operador interno da Wandr e com OPENWA_ENABLED=true. */

const wame = require('./providers/wame');

const registo = { wame };

function resolveProvider(cfg, { providers = registo, env = process.env } = {}) {
  if (cfg?.provider === 'openwa') {
    const permitido = env.OPENWA_ENABLED === 'true'
      && env.WANDR_INTERNAL_OPERATOR_ID
      && cfg.operator_id === env.WANDR_INTERNAL_OPERATOR_ID;
    return permitido && providers.openwa ? providers.openwa : providers.wame;
  }
  if (cfg?.provider === 'cloud_api' && cfg.cloud_status === 'active' && providers.cloud_api) {
    return providers.cloud_api;
  }
  return providers.wame;
}

module.exports = { resolveProvider, registo };
