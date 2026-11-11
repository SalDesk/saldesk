/* Depois de mudar a password, termina as OUTRAS sessoes do utilizador (todas menos a do token dado).
   `updateUserById` nao invalida tokens ja emitidos: sem isto, quem tinha um token/refresh token
   roubado continuava com acesso depois de o dono mudar a password.

   Melhor esforco: a password ja foi mudada, por isso uma falha aqui nao faz falhar o pedido; devolve
   false para o controlador avisar o cliente. O Supabase recebe o JWT do pedido e o scope 'others'
   (a sessao actual mantem-se, o dono nao e desligado do ecra onde acabou de mudar a password). */

async function revogarOutrasSessoes(supabaseAdmin, token) {
  if (!token) return false;
  try {
    const { error } = await supabaseAdmin.auth.admin.signOut(token, 'others');
    if (error) {
      console.error('[Sessoes] Falha ao revogar as outras sessoes:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Sessoes] Falha ao revogar as outras sessoes:', err.message);
    return false;
  }
}

module.exports = { revogarOutrasSessoes };
