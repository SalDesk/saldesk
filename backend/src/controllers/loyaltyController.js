const { supabaseAdmin } = require('../config/supabase');

function getOperatorId(req) {
  return req.operator?.id || req.staff?.operator_id;
}

const DEFAULT_LEVELS = [
  { name: 'Bronze', min: 0,   max: 100,  discount_pct: 5,  reward: '5% desconto em todas as reservas' },
  { name: 'Prata',  min: 101, max: 499,  discount_pct: 10, reward: '10% desconto + upgrade gratuito disponivel' },
  { name: 'Ouro',   min: 500, max: null, discount_pct: 15, reward: '15% desconto + tour gratuito por ano' },
];

/* Mesma regra usada no frontend (Loyalty.jsx getLevel) -- nivel mais alto
   cujo minimo o saldo actual ja atinge. */
function nivelDosPontos(points, levels) {
  const pts = Number(points || 0);
  return [...levels].sort((a, b) => b.min - a.min).find(l => pts >= l.min) || levels[0];
}

function gerarCodigoVoucher(nomeCliente) {
  const prefixo = (nomeCliente || 'CLI').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase() || 'CLI';
  const sufixo = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `FID-${prefixo}-${sufixo}`;
}

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

async function obterClienteDoOperador(operatorId, customerId) {
  const { data } = await supabaseAdmin
    .from('customers').select('id, name, loyalty_points')
    .eq('id', customerId).eq('operator_id', operatorId).maybeSingle();
  return data;
}

async function historicoCliente(req, res, next) {
  try {
    const operatorId = getOperatorId(req);
    const cliente = await obterClienteDoOperador(operatorId, req.params.customerId);
    if (!cliente) return res.status(404).json({ error: 'Cliente nao encontrado', code: 'NOT_FOUND' });

    const { data, error } = await supabaseAdmin
      .from('loyalty_ledger').select('*')
      .eq('customer_id', cliente.id).eq('operator_id', operatorId)
      .order('created_at', { ascending: false }).limit(50);
    if (error) throw error;
    return res.json({ data, message: 'Historico de pontos' });
  } catch (err) { next(err); }
}

async function ajustarPontos(req, res, next) {
  try {
    const operatorId = getOperatorId(req);
    const { delta, reason } = req.body;
    if (!delta || !Number.isFinite(Number(delta)) || Number(delta) === 0) {
      return res.status(400).json({ error: 'delta obrigatorio (numero diferente de zero)', code: 'MISSING_FIELDS' });
    }
    const cliente = await obterClienteDoOperador(operatorId, req.params.customerId);
    if (!cliente) return res.status(404).json({ error: 'Cliente nao encontrado', code: 'NOT_FOUND' });

    const aplicado = Math.max(-Number(cliente.loyalty_points || 0), Math.round(Number(delta)));
    const novoSaldo = Number(cliente.loyalty_points || 0) + aplicado;

    await supabaseAdmin.from('customers')
      .update({ loyalty_points: novoSaldo, updated_at: new Date().toISOString() })
      .eq('id', cliente.id);

    const { data: entry, error } = await supabaseAdmin.from('loyalty_ledger').insert({
      operator_id: operatorId, customer_id: cliente.id, type: 'manual_adjust',
      points: aplicado, balance_after: novoSaldo, reason: reason || null,
    }).select().single();
    if (error) throw error;

    return res.json({ data: { loyalty_points: novoSaldo, entry }, message: 'Pontos ajustados' });
  } catch (err) { next(err); }
}

async function resgatar(req, res, next) {
  try {
    const operatorId = getOperatorId(req);
    const cliente = await obterClienteDoOperador(operatorId, req.params.customerId);
    if (!cliente) return res.status(404).json({ error: 'Cliente nao encontrado', code: 'NOT_FOUND' });

    const saldo = Number(cliente.loyalty_points || 0);
    if (saldo <= 0) return res.status(400).json({ error: 'Sem pontos para resgatar', code: 'SEM_PONTOS' });

    const { data: config } = await supabaseAdmin
      .from('loyalty_config').select('levels').eq('operator_id', operatorId).maybeSingle();
    const nivel = nivelDosPontos(saldo, config?.levels || DEFAULT_LEVELS);

    let voucher, tentativas = 0;
    while (!voucher && tentativas < 5) {
      tentativas++;
      const { data, error } = await supabaseAdmin.from('vouchers').insert({
        operator_id: operatorId,
        code: gerarCodigoVoucher(cliente.name),
        type: 'percent',
        value: nivel.discount_pct,
        max_uses: 1,
        active: true,
        customer_id: cliente.id,
        expires_at: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
      }).select().single();
      if (error && error.code === '23505') continue;
      if (error) throw error;
      voucher = data;
    }
    if (!voucher) return res.status(500).json({ error: 'Nao foi possivel gerar um codigo de voucher unico', code: 'VOUCHER_CODE_CLASH' });

    await supabaseAdmin.from('customers')
      .update({ loyalty_points: 0, updated_at: new Date().toISOString() })
      .eq('id', cliente.id);

    const { data: entry, error: ledgerError } = await supabaseAdmin.from('loyalty_ledger').insert({
      operator_id: operatorId, customer_id: cliente.id, type: 'redeem',
      points: -saldo, balance_after: 0,
      reason: `Resgate nivel ${nivel.name}`, voucher_id: voucher.id,
    }).select().single();
    if (ledgerError) throw ledgerError;

    return res.status(201).json({ data: { voucher, entry, loyalty_points: 0 }, message: 'Pontos resgatados' });
  } catch (err) { next(err); }
}

module.exports = { obterConfig, actualizarConfig, obterConfigActiva, historicoCliente, ajustarPontos, resgatar };
