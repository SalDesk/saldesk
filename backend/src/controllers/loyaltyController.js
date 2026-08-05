const { supabaseAdmin } = require('../config/supabase');

function getOperatorId(req) {
  return req.operator?.id || req.staff?.operator_id;
}

const DEFAULT_LEVELS = [
  { name: 'Bronze', min: 0,   max: 100,  discount_pct: 5,  reward: '5% desconto em todas as reservas' },
  { name: 'Prata',  min: 101, max: 499,  discount_pct: 10, reward: '10% desconto + upgrade gratuito disponivel' },
  { name: 'Ouro',   min: 500, max: null, discount_pct: 15, reward: '15% desconto + tour gratuito por ano' },
];

async function obterConfig(req, res, next) {
  try {
    const operatorId = getOperatorId(req);
    const { data } = await supabaseAdmin
      .from('loyalty_config').select('*').eq('operator_id', operatorId).maybeSingle();

    if (data) return res.json({ data, message: 'Configuracao de fidelidade' });

    // Ainda nao existe linha para este operador — devolver defaults sem gravar
    return res.json({
      data: { operator_id: operatorId, active: false, points_per_euro: 1, levels: DEFAULT_LEVELS },
      message: 'Configuracao de fidelidade (default)',
    });
  } catch (err) { next(err); }
}

async function actualizarConfig(req, res, next) {
  try {
    const { active, points_per_euro, levels } = req.body;
    const operatorId = getOperatorId(req);

    const updates = { operator_id: operatorId, updated_at: new Date().toISOString() };
    if (active !== undefined) updates.active = active;
    if (points_per_euro !== undefined) updates.points_per_euro = Number(points_per_euro);
    if (levels !== undefined) updates.levels = levels;

    const { data, error } = await supabaseAdmin
      .from('loyalty_config')
      .upsert(updates, { onConflict: 'operator_id' })
      .select()
      .single();
    if (error) throw error;
    return res.json({ data, message: 'Configuracao actualizada' });
  } catch (err) { next(err); }
}

/* Usado pelo customerHelper ao dar pontos apos checkout — devolve null se o
   programa nao existir/estiver inactivo (nesse caso nao se atribuem pontos). */
async function obterConfigActiva(operatorId) {
  const { data } = await supabaseAdmin
    .from('loyalty_config').select('active, points_per_euro').eq('operator_id', operatorId).maybeSingle();
  if (!data?.active) return null;
  return data;
}

module.exports = { obterConfig, actualizarConfig, obterConfigActiva };
