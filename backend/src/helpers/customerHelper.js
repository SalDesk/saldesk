const { supabaseAdmin } = require('../config/supabase');
const { detectarIdioma } = require('./languageHelper');

// Procura cliente existente por email+operador ou cria um novo
async function obterOuCriarCliente(operatorId, { name, email, phone, country_code }) {
  const emailNorm = email.toLowerCase().trim();
  const language = detectarIdioma(country_code);

  const { data: existente } = await supabaseAdmin
    .from('customers')
    .select('*')
    .eq('operator_id', operatorId)
    .eq('email', emailNorm)
    .maybeSingle();

  if (existente) {
    // Actualizar nome/telefone/país se a reserva trouxer dados mais recentes
    const updates = {};
    if (phone && !existente.phone) updates.phone = phone;
    if (country_code && !existente.country_code) {
      updates.country_code = country_code;
      updates.language = language;
    }

    if (Object.keys(updates).length > 0) {
      const { data: updated } = await supabaseAdmin
        .from('customers')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', existente.id)
        .select()
        .single();
      return updated || existente;
    }

    return existente;
  }

  const { data, error } = await supabaseAdmin
    .from('customers')
    .insert({
      operator_id: operatorId,
      name,
      email: emailNorm,
      phone: phone || null,
      country_code: country_code || null,
      language
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Incrementa total_visits e total_spent após checkout
async function actualizarStatsCheckout(customerId, totalPrice) {
  const { data: customer } = await supabaseAdmin
    .from('customers')
    .select('total_visits, total_spent')
    .eq('id', customerId)
    .single();

  if (!customer) return;

  await supabaseAdmin
    .from('customers')
    .update({
      total_visits: customer.total_visits + 1,
      total_spent: Number(customer.total_spent) + Number(totalPrice),
      updated_at: new Date().toISOString()
    })
    .eq('id', customerId);
}

module.exports = { obterOuCriarCliente, actualizarStatsCheckout };
