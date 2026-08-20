const { supabaseAdmin } = require('../config/supabase');

function getOperatorId(req) {
  return req.operator?.id || req.staff?.operator_id;
}

async function listar(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('vouchers')
      .select('*')
      .eq('operator_id', getOperatorId(req))
      .order('created_at', { ascending: false });
    if (error) throw error;
    return res.json({ data, message: 'Vouchers listados' });
  } catch (err) { next(err); }
}

async function criar(req, res, next) {
  try {
    const { code, type, value, min_amount, expires_at, max_uses, unit_ids, active } = req.body;
    if (!code || !type || !value) {
      return res.status(400).json({ error: 'code, type e value sao obrigatorios', code: 'MISSING_FIELDS' });
    }
    const { data, error } = await supabaseAdmin
      .from('vouchers')
      .insert({
        operator_id: getOperatorId(req),
        code: String(code).trim().toUpperCase(),
        type,
        value: Number(value),
        min_amount: min_amount ? Number(min_amount) : 0,
        expires_at: expires_at || null,
        max_uses: max_uses ? Number(max_uses) : 0,
        unit_ids: unit_ids || [],
        active: active ?? true,
      })
      .select()
      .single();
    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Ja existe um voucher com este codigo', code: 'DUPLICATE_CODE' });
      }
      throw error;
    }
    return res.status(201).json({ data, message: 'Voucher criado' });
  } catch (err) { next(err); }
}

async function actualizar(req, res, next) {
  try {
    const { code, type, value, min_amount, expires_at, max_uses, unit_ids, active } = req.body;
    const updates = { updated_at: new Date().toISOString() };
    if (code !== undefined) updates.code = String(code).trim().toUpperCase();
    if (type !== undefined) updates.type = type;
    if (value !== undefined) updates.value = Number(value);
    if (min_amount !== undefined) updates.min_amount = Number(min_amount) || 0;
    if (expires_at !== undefined) updates.expires_at = expires_at || null;
    if (max_uses !== undefined) updates.max_uses = Number(max_uses) || 0;
    if (unit_ids !== undefined) updates.unit_ids = unit_ids;
    if (active !== undefined) updates.active = active;

    const { data, error } = await supabaseAdmin
      .from('vouchers')
      .update(updates)
      .eq('id', req.params.id)
      .eq('operator_id', getOperatorId(req))
      .select()
      .maybeSingle();
    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Ja existe um voucher com este codigo', code: 'DUPLICATE_CODE' });
      }
      throw error;
    }
    if (!data) return res.status(404).json({ error: 'Voucher nao encontrado', code: 'NOT_FOUND' });
    return res.json({ data, message: 'Voucher actualizado' });
  } catch (err) { next(err); }
}

async function eliminar(req, res, next) {
  try {
    const { error } = await supabaseAdmin
      .from('vouchers')
      .delete()
      .eq('id', req.params.id)
      .eq('operator_id', getOperatorId(req));
    if (error) throw error;
    return res.json({ data: null, message: 'Voucher eliminado' });
  } catch (err) { next(err); }
}

/* Validacao usada no motor de reservas publico — devolve o desconto a
   aplicar sem expor detalhes do voucher a quem nao acertou o codigo. */
async function validarVoucher(operatorId, code, unitId, amount) {
  if (!code) return { valid: false };

  const { data: voucher } = await supabaseAdmin
    .from('vouchers')
    .select('*')
    .eq('operator_id', operatorId)
    .eq('code', String(code).trim().toUpperCase())
    .maybeSingle();

  if (!voucher) return { valid: false, error: 'Codigo invalido' };
  if (!voucher.active) return { valid: false, error: 'Codigo inactivo' };
  if (voucher.expires_at && new Date(voucher.expires_at) < new Date()) return { valid: false, error: 'Codigo expirado' };
  if (voucher.max_uses > 0 && voucher.uses_count >= voucher.max_uses) return { valid: false, error: 'Codigo esgotado' };
  if (voucher.min_amount > 0 && amount < voucher.min_amount) return { valid: false, error: `Minimo de reserva: ${voucher.min_amount}` };
  if (voucher.unit_ids?.length > 0 && unitId && !voucher.unit_ids.includes(unitId)) return { valid: false, error: 'Codigo nao aplicavel a este servico' };

  const discount = voucher.type === 'percent' ? amount * (voucher.value / 100) : Math.min(voucher.value, amount);
  return { valid: true, voucherId: voucher.id, discount: Math.round(discount * 100) / 100 };
}

/* read-then-write (SELECT + UPDATE em dois passos) tinha uma corrida real:
   duas reservas concorrentes com o mesmo codigo de uso unico podiam ambas
   passar em validarVoucher() antes de qualquer uma gravar o incremento,
   furando max_uses. registar_uso_voucher() faz o incremento condicional ao
   limite numa UNICA instrucao SQL (atomico ao nivel da linha). */
async function registarUsoVoucher(voucherId) {
  const { data: aplicado, error } = await supabaseAdmin.rpc('registar_uso_voucher', { p_voucher_id: voucherId });
  if (error) throw error;
  if (!aplicado) console.error('[Voucher] Uso nao registado -- limite max_uses ja atingido na corrida:', voucherId);
}

/* Rota publica — permite ao cliente ver o desconto antes de confirmar a
   reserva. Nao regista uso (isso so acontece na criacao da reserva). */
async function validarVoucherPublico(req, res, next) {
  try {
    const { code, unit_id, amount } = req.body;
    if (!code || amount === undefined) {
      return res.status(400).json({ error: 'code e amount sao obrigatorios', code: 'MISSING_FIELDS' });
    }
    const { data: operatorRow } = await supabaseAdmin
      .from('operators').select('id').eq('slug', req.params.slug).single();
    if (!operatorRow) return res.status(404).json({ error: 'Operador nao encontrado', code: 'NOT_FOUND' });

    const resultado = await validarVoucher(operatorRow.id, code, unit_id, Number(amount));
    return res.json({ data: resultado, message: resultado.valid ? 'Codigo valido' : 'Codigo invalido' });
  } catch (err) { next(err); }
}

module.exports = { listar, criar, actualizar, eliminar, validarVoucher, registarUsoVoucher, validarVoucherPublico };
