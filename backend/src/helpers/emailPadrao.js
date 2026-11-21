/* As reservas do viajante sao as que tem o email dele. O LIKE do PostgreSQL trata _ e % como curingas
   ("j_silva@" apanhava "jxsilva@"): escapam-se, e a igualdade exacta (sem maiusculas nem espacos) confirma. */
function padraoEmail(email) {
  return email.replace(/[\\%_]/g, (c) => `\\${c}`);
}
function mesmoEmail(emailReserva, email) {
  return typeof emailReserva === 'string' && emailReserva.trim().toLowerCase() === email;
}

module.exports = { padraoEmail, mesmoEmail };
