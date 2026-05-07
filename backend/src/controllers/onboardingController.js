const { supabaseAdmin } = require('../config/supabase');

const VALID_TYPES = ['hotel', 'activity', 'rentacar', 'restaurant'];

async function createOperator(req, res, next) {
  try {
    if (req.operator) {
      return res.status(409).json({ error: 'Perfil de operador já existe', code: 'OPERATOR_EXISTS' });
    }

    const { name, operator_type, phone, address, slug } = req.body;

    if (!name || !operator_type || !slug) {
      return res.status(400).json({ error: 'Nome, tipo e slug são obrigatórios', code: 'MISSING_FIELDS' });
    }

    if (!VALID_TYPES.includes(operator_type)) {
      return res.status(400).json({ error: 'Tipo de operador inválido', code: 'INVALID_TYPE' });
    }

    const slugLimpo = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');

    const { data: existente } = await supabaseAdmin
      .from('operators')
      .select('id')
      .eq('slug', slugLimpo)
      .maybeSingle();

    if (existente) {
      return res.status(409).json({ error: 'Este slug já está em uso', code: 'SLUG_TAKEN' });
    }

    const { data, error } = await supabaseAdmin
      .from('operators')
      .insert({
        user_id: req.user.id,
        name,
        operator_type,
        slug: slugLimpo,
        email: req.user.email,
        phone: phone || null,
        address: address || null,
        onboarding_complete: true
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Erro ao criar operador', code: 'DB_ERROR' });
    }

    return res.status(201).json({
      data,
      message: 'Perfil de operador criado com sucesso'
    });
  } catch (err) {
    next(err);
  }
}

async function getStatus(req, res) {
  return res.json({
    data: {
      onboarding_complete: req.operator?.onboarding_complete || false,
      operator: req.operator || null
    },
    message: 'Estado do onboarding'
  });
}

module.exports = { createOperator, getStatus };
