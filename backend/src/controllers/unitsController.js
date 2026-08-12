const { supabaseAdmin } = require('../config/supabase');

function getOperatorId(req) {
  return req.operator?.id || req.staff?.operator_id;
}

/* Conect: category_id nao tem UI propria -- unit_type ja e a mesma lista
   (experience_categories foi semeada a partir do UNIT_TYPES_BY_OPERATOR
   do frontend), so procurar a categoria correspondente por label_pt.
   Sem correspondencia (ex: operador escreveu um tipo livre em "Outro") =
   category_id fica null, nunca inventa uma categoria. */
async function resolveCategoryId(unitType) {
  if (!unitType) return null;
  const { data } = await supabaseAdmin
    .from('experience_categories').select('id').eq('label_pt', unitType).maybeSingle();
  return data?.id || null;
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

    const {
      name, description, unit_type, base_price, capacity, images, ota_product_ids,
      duration_minutes, languages_offered, lat, lng,
    } = req.body;

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
        ota_product_ids: ota_product_ids || {},
        category_id: await resolveCategoryId(unit_type),
        duration_minutes: duration_minutes || null,
        languages_offered: languages_offered || [],
        lat: lat || null,
        lng: lng || null,
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

    const {
      name, description, unit_type, base_price, capacity, images, status, ota_product_ids,
      duration_minutes, languages_offered, lat, lng,
    } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (unit_type !== undefined) {
      updates.unit_type = unit_type;
      updates.category_id = await resolveCategoryId(unit_type);
    }
    if (base_price !== undefined) updates.base_price = Number(base_price);
    if (capacity !== undefined) updates.capacity = capacity;
    if (images !== undefined) updates.images = images;
    if (status !== undefined) updates.status = status;
    if (ota_product_ids !== undefined) updates.ota_product_ids = ota_product_ids;
    if (duration_minutes !== undefined) updates.duration_minutes = duration_minutes || null;
    if (languages_offered !== undefined) updates.languages_offered = languages_offered || [];
    if (lat !== undefined) updates.lat = lat || null;
    if (lng !== undefined) updates.lng = lng || null;
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

/* Conect: o operador so pode submeter (draft->pending_review) ou retirar
   (published/paused->draft) -- a aprovacao pending_review->published fica
   reservada ao admin (ver adminController.js). */
async function submeterParaConect(req, res, next) {
  try {
    if (!req.operator) {
      return res.status(403).json({ error: 'Apenas operadores podem gerir unidades', code: 'OPERATOR_ONLY' });
    }
    const { conect_status } = req.body;
    if (!['pending_review', 'draft'].includes(conect_status)) {
      return res.status(400).json({ error: 'Estado invalido', code: 'INVALID_STATUS' });
    }

    const { data: current } = await supabaseAdmin
      .from('units').select('conect_status').eq('id', req.params.id).eq('operator_id', req.operator.id).maybeSingle();
    if (!current) return res.status(404).json({ error: 'Unidade não encontrada', code: 'NOT_FOUND' });

    if (conect_status === 'pending_review' && current.conect_status !== 'draft') {
      return res.status(400).json({ error: 'Só é possível submeter unidades em rascunho', code: 'INVALID_TRANSITION' });
    }
    if (conect_status === 'draft' && !['published', 'paused'].includes(current.conect_status)) {
      return res.status(400).json({ error: 'Só é possível retirar unidades publicadas ou pausadas', code: 'INVALID_TRANSITION' });
    }

    const { data, error } = await supabaseAdmin
      .from('units').update({ conect_status, updated_at: new Date().toISOString() })
      .eq('id', req.params.id).eq('operator_id', req.operator.id)
      .select().single();
    if (error) throw error;

    return res.json({ data, message: 'Estado Conect actualizado' });
  } catch (err) { next(err); }
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
  submeterParaConect,
  createPricingRule,
  updatePricingRule,
  deletePricingRule
};
