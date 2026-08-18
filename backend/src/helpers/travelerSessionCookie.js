/* Ponte de sessao entre saldesk.cv (Conect, site estatico) e app.saldesk.cv
   (onde a conta de viajante vive) -- guarda o refresh_token numa cookie
   httpOnly no dominio pai .saldesk.cv, nunca o access_token de curta
   duracao. httpOnly e deliberado: a cookie nunca e lida por JS, o que
   elimina o vector mais obvio de roubo por XSS num subdominio qualquer de
   *.saldesk.cv. Unica fonte de verdade para o nome/opcoes da cookie -- que
   Set-Cookie e clearCookie nunca dessincronizem. */

const COOKIE_NAME = 'sd_travel_rt';
const isProd = process.env.NODE_ENV === 'production';

function cookieOptions() {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    /* dominio pai so faz sentido em producao -- em dev nao ha subdominios
       *.saldesk.cv reais, e Domain=.saldesk.cv seria simplesmente ignorado
       (ou rejeitado) pelo browser em localhost. */
    ...(isProd ? { domain: '.saldesk.cv' } : {}),
    /* 30 dias fixos, independente da checkbox "Lembrar este dispositivo"
       da app (essa so controla localStorage vs sessionStorage dentro da
       propria app) -- decisao tomada com o utilizador. Revogavel a
       qualquer momento via logout. */
    maxAge: 30 * 24 * 60 * 60 * 1000,
  };
}

function setTravelerSessionCookie(res, refreshToken) {
  res.cookie(COOKIE_NAME, refreshToken, cookieOptions());
}

function clearTravelerSessionCookie(res) {
  /* clearCookie tem de receber as mesmas opcoes de domain/path/sameSite
     com que a cookie foi criada -- maxAge nao se aplica aqui. */
  const { maxAge, ...opts } = cookieOptions();
  res.clearCookie(COOKIE_NAME, opts);
}

module.exports = { COOKIE_NAME, setTravelerSessionCookie, clearTravelerSessionCookie };
