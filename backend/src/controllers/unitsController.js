const { supabaseAdmin } = require('../config/supabase');

function getOperatorId(req) {
  return req.operator?.id || req.staff?.operator_id;
}

async function listUnits(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('units')
      .select('*, pricing_rules(*)')
      .eq('operator_id', getOperatorId(req))
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.json({ data, message: 'Unidades listadas com sucesso' });
  } catch (err) {
    next(err);
  }
}

async function createUnit(req, res, next) {
  try {
    if (!req.operator) {
      return res.status(403).json({ error: 'Apenas operadores podem gerir unidades', code: 'OPERATOR_ONLY' });
    }

    const { name, description, unit_type, base_price, capacity, images } = req.body;

    if (!name || !unit_type || base_price === undefined || base_price === null) {
      return res.status(400).json({ error: 'Nome, tipo e preço base são obrigatórios', code: 'MISSING_FIELDS' });
    }

    if (isNaN(base_price) || Number(base_price) < 0) {
      return res.status(400).json({ error: 'Preço base inválido', code: 'INVALID_PRICE' });
    }

    const { data, error } = await supabaseAdmin
      .from('units')
      .insert({
        operator_id: req.operator.id,
        name,
        description: description || null,
        unit_type,
        base_price: Number(base_price),
        capacity: capacity || 1,
        images: images || [],
        status: 'active'
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({ data, message: 'Unidade criada com sucesso' });
  } catch (err) {
    next(err);
  }
}

async function getUnit(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('units')
      .select('*, pricing_rules(*)')
      .eq('id', req.params.id)
      .eq('operator_id', getOperatorId(req))
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Unidade não encontrada', code: 'NOT_FOUND' });
    }

    return res.json({ data, message: 'Unidade encontrada' });
  } catch (err) {
    next(err);
  }
}

async function updateUnit(req, res, next) {
  try {
    if (!req.operator) {
      return res.status(403).json({ error: 'Apenas operadores podem gerir unidades', code: 'OPERATOR_ONLY' });
    }

    const { name, description, unit_type, base_price, capacity, images, status } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (unit_type !== undefined) updates.unit_type = unit_type;
    if (base_price !== undefined) updates.base_price = Number(base_price);
    if (capacity !== undefined) updates.capacity = capacity;
    if (images !== undefined) updates.images = images;
    if (status !== undefined) updates.status = status;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('units')
      .update(updates)
      .eq('id', req.params.id)
      .eq('operator_id', req.operator.id)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Unidade não encontrada', code: 'NOT_FOUND' });
    }

    return res.json({ data, message: 'Unidade actualizada com sucesso' });
  } catch (err) {
    next(err);
  }
}

async function deleteUnit(req, res, next) {
  try {
    if (!req.operator) {
      return res.status(403).json({ error: 'Apenas operadores podem gerir unidades', code: 'OPERATOR_ONLY' });
    }

    const { error } = await supabaseAdmin
      .from('units')
      .delete()
      .eq('id', req.params.id)
      .eq('operator_id', req.operator.id);

    if (error) throw error;

    return res.json({ data: null, message: 'Unidade eliminada com sucesso' });
  } catch (err) {
    next(err);
  }
}

async function createPricingRule(req, res, next) {
  try {
    if (!req.operator) {
      return res.status(403).json({ error: 'Apenas operadores podem gerir unidades', code: 'OPERATOR_ONLY' });
    }

    const { name, price_modifier, modifier_type, start_date, end_date, days_of_week } = req.body;

    if (!name || price_modifier === undefined || !modifier_type) {
      return res.status(400).json({ error: 'Nome, modificador e tipo são obrigatórios', code: 'MISSING_FIELDS' });
    }

    if (!['percentage', 'fixed'].includes(modifier_type)) {
      return res.status(400).json({ error: 'Tipo de modificador inválido', code: 'INVALID_MODIFIER_TYPE' });
    }

    const { data: unit } = await supabaseAdmin
      .from('units')
      .select('id')
      .eq('id', req.params.id)
      .eq('operator_id', req.operator.id)
      .single();

    if (!unit) {
      return res.status(404).json({ error: 'Unidade não encontrada', code: 'NOT_FOUND' });
    }

    const { data, error } = await supabaseAdmin
      .from('pricing_rules')
      .insert({
        unit_id: req.params.id,
        name,
        price_modifier: Number(price_modifier),
        modifier_type,
        start_date: start_date || null,
        end_date: end_date || null,
        days_of_week: days_of_week || null,
        active: true
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({ data, message: 'Regra de preço criada com sucesso' });
  } catch (err) {
    next(err);
  }
}

async function updatePricingRule(req, res, next) {
  try {
    if (!req.operator) {
      return res.status(403).json({ error: 'Apenas operadores podem gerir unidades', code: 'OPERATOR_ONLY' });
    }

    const { name, price_modifier, modifier_type, start_date, end_date, days_of_week, active } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (price_modifier !== undefined) updates.price_modifier = Number(price_modifier);
    if (modifier_type !== undefined) updates.modifier_type = modifier_type;
    if (start_date !== undefined) updates.start_date = start_date;
    if (end_date !== undefined) updates.end_date = end_date;
    if (days_of_week !== undefined) updates.days_of_week = days_of_week;
    if (active !== undefined) updates.active = active;

    const { data, error } = await supabaseAdmin
      .from('pricing_rules')
      .update(updates)
      .eq('id', req.params.ruleId)
      .eq('unit_id', req.params.id)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Regra não encontrada', code: 'NOT_FOUND' });
    }

    return res.json({ data, message: 'Regra actualizada com sucesso' });
  } catch (err) {
    next(err);
  }
}

async function deletePricingRule(req, res, next) {
  try {
    if (!req.operator) {
      return res.status(403).json({ error: 'Apenas operadores podem gerir unidades', code: 'OPERATOR_ONLY' });
    }

    const { error } = await supabaseAdmin
      .from('pricing_rules')
      .delete()
      .eq('id', req.params.ruleId)
      .eq('unit_id', req.params.id);

    if (error) throw error;

    return res.json({ data: null, message: 'Regra eliminada com sucesso' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listUnits,
  createUnit,
  getUnit,
  updateUnit,
  deleteUnit,
  createPricingRule,
  updatePricingRule,
  deletePricingRule
};
