const { supabaseAdmin } = require('../config/supabase');

/* Fallback de seguranca se cms_pricing estiver vazia -- os valores reais
   vêm sempre da BD (editavel pelo admin em CMS > Precos), nunca daqui. */
const FALLBACK_PRICES = { starter: 29, business: 69, pro: 79 };

async function loadPriceMap() {
  const { data } = await supabaseAdmin.from('cms_pricing').select('plan, price_eur');
  const map = { ...FALLBACK_PRICES };
  (data || []).forEach((p) => { map[p.plan] = Number(p.price_eur); });
  return map;
}

module.exports = { loadPriceMap, FALLBACK_PRICES };
