/* FRONTEND_URL pode conter varias origens separadas por virgula (usadas no
   CORS — ver server.js/socketService.js). Para construir links/redirects
   usar sempre a primeira, que e onde a app (book/:slug, etc.) e servida. */
function frontendBase() {
  const raw = process.env.FRONTEND_URL || 'https://app.saldesk.cv';
  return raw.split(',')[0].trim();
}

module.exports = { frontendBase };
