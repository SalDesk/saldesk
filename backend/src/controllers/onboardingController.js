const { supabaseAdmin } = require('../config/supabase');

const VALID_TYPES = ['hotel', 'activity', 'rentacar', 'restaurant'];

function limparSlug(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

/* Gera slug unico — tenta base, depois base-XXXX com sufixo aleatorio */
async function gerarSlugUnico(base, excludeId = null) {
  let candidato = limparSlug(base);
  if (!candidato) candidato = 'operador';

  for (let tentativa = 0; tentativa < 10; tentativa++) {
    let q = supabaseAdmin.from('operators').select('id').eq('slug', candidato);
    if (excludeId) q = q.neq('id', excludeId);
    const { data } = await q.maybeSingle();
    if (!data) return candidato;
    const sufixo = Math.random().toString(36).slice(2, 6);
    candidato = `${limparSlug(base)}-${sufixo}`;
  }
  return `${limparSlug(base)}-${Date.now().toString(36)}`;
}

async function createOperator(req, res, next) {
  try {
    if (req.operator) {
      return updateOperator(req, res, next);
    }

    const { name, operator_type, phone, whatsapp, address, description,
            slug, language, currency, timezone } = req.body;

    if (!name || !operator_type) {
      return res.status(400).json({ error: 'Nome e tipo sao obrigatorios', code: 'MISSING_FIELDS' });
    }
    if (!VALID_TYPES.includes(operator_type)) {
      return res.status(400).json({ error: 'Tipo de operador invalido', code: 'INVALID_TYPE' });
    }

    const slugFinal = await gerarSlugUnico(slug || name);

    const { data, error } = await supabaseAdmin
      .from('operators')
      .insert({
        user_id:             req.user.id,
        name,
        operator_type,
        slug:                slugFinal,
        email:               req.user.email,
        phone:               phone || null,
        whatsapp:            whatsapp || null,
        address:             address || null,
        description:         description || null,
        language:            language || 'pt',
        currency:            currency || 'EUR',
        timezone:            timezone || 'Atlantic/Cape_Verde',
        onboarding_complete: false,
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Erro ao criar operador', code: 'DB_ERROR' });
    }

    return res.status(201).json({ data, message: 'Perfil criado com sucesso' });
  } catch (err) {
    next(err);
  }
}

async function updateOperator(req, res, next) {
  try {
    if (!req.operator) {
      return res.status(404).json({ error: 'Perfil de operador nao encontrado', code: 'NOT_FOUND' });
    }

    const { name, operator_type, phone, whatsapp, address, description,
            slug, language, currency, timezone, onboarding_complete, logo_url, cover_images, business_name, tagline } = req.body;

    const updates = { updated_at: new Date().toISOString() };
    if (name !== undefined)              updates.name = name;
    if (operator_type !== undefined && VALID_TYPES.includes(operator_type)) updates.operator_type = operator_type;
    if (phone !== undefined)             updates.phone = phone;
    if (whatsapp !== undefined)          updates.whatsapp = whatsapp;
    if (address !== undefined)           updates.address = address;
    if (description !== undefined)       updates.description = description;
    if (language !== undefined)          updates.language = language;
    if (currency !== undefined)          updates.currency = currency;
    if (timezone !== undefined)          updates.timezone = timezone;
    if (onboarding_complete !== undefined) updates.onboarding_complete = onboarding_complete;
    if (logo_url !== undefined)          updates.logo_url = logo_url;
    if (cover_images !== undefined)      updates.cover_images = cover_images;
    if (business_name !== undefined)     updates.business_name = business_name;
    if (tagline !== undefined)           updates.tagline = tagline;

    if (slug !== undefined) {
      const slugFinal = await gerarSlugUnico(slug || req.operator.name, req.operator.id);
      if (slugFinal !== req.operator.slug) updates.slug = slugFinal;
    }

    const { data, error } = await supabaseAdmin
      .from('operators')
      .update(updates)
      .eq('id', req.operator.id)
      .select()
      .single();

    if (error) throw error;

    return res.json({ data, message: 'Perfil actualizado com sucesso' });
  } catch (err) {
    next(err);
  }
}

async function getStatus(req, res) {
  return res.json({
    data: {
      onboarding_complete: req.operator?.onboarding_complete || false,
      operator: req.operator || null,
    },
    message: 'Estado do onboarding',
  });
}

module.exports = { createOperator, updateOperator, getStatus };
