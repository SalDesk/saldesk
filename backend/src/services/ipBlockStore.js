const { supabaseAdmin } = require('../config/supabase');

/* Cache em memoria da lista de IPs bloqueados (persistida em cms_settings,
   chave 'sys_blocked_ips'). O middleware de bloqueio le sempre daqui -- nunca
   da BD por pedido -- por isso blockIp/unblockIp tem de chamar setBlocked()
   sempre que gravam, para o bloqueio ficar activo de imediato. */
let blocked = new Set();

async function refresh() {
  const { data } = await supabaseAdmin
    .from('cms_settings').select('value').eq('key', 'sys_blocked_ips').maybeSingle();
  try { blocked = new Set(JSON.parse(data?.value || '[]')); } catch { blocked = new Set(); }
}

function isBlocked(ip) {
  return blocked.has(ip);
}

function setBlocked(list) {
  blocked = new Set(list);
}

module.exports = { refresh, isBlocked, setBlocked };
