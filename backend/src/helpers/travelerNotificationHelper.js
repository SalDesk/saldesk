const { supabaseAdmin } = require('../config/supabase');

/* Ponto unico para criar uma notificacao real no painel de um viajante.
   Procura a conta pelo email da reserva -- nem todo o customer_email tem
   conta de viajante associada, por isso falha em silencio (nunca lanca)
   quando nao encontra ninguem: quem chama isto nunca deve deixar de
   concluir a operacao principal (pagamento, cancelamento, etc.) so porque
   a notificacao nao teve onde ficar. Chamar sempre em modo "dispara e
   esquece" (`.catch(() => {})`), mesmo padrao ja usado por
   notifyAvailabilityChanged noutro sitio do codigo. */
async function criarNotificacaoViajante(email, type, content, link = null) {
  if (!email) return;
  const normalizado = email.trim().toLowerCase();

  const { data: traveler } = await supabaseAdmin
    .from('travelers')
    .select('id')
    .ilike('email', normalizado)
    .maybeSingle();

  if (!traveler) return;

  await supabaseAdmin
    .from('traveler_notifications')
    .insert({ traveler_id: traveler.id, type, content, link });
}

module.exports = { criarNotificacaoViajante };
