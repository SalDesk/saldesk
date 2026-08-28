const express = require('express');
const router = express.Router();
const { register, login, oauthComplete, refresh, getMe, logout, session, changePassword, resetPassword, forgotPassword } = require('../controllers/travelerAuthController');
const authMiddleware = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');
const { publicLimiter, authLimiter } = require('../middleware/rateLimiters');

router.post('/register', authLimiter, validate(schemas.travelerRegister), register);
router.post('/login',    authLimiter, login);
router.post('/oauth-complete', authLimiter, oauthComplete);
router.post('/refresh',  authLimiter, refresh);
router.post('/reset-password', authLimiter, validate(schemas.resetPassword), resetPassword);
router.post('/forgot-password', authLimiter, forgotPassword);
router.get('/me',        authLimiter, authMiddleware, getMe);
router.post('/logout',   authLimiter, authMiddleware, logout);
router.put('/password',  authLimiter, authMiddleware, validate(schemas.changePassword), changePassword);

/* Chamada pelo Conect (saldesk.cv) a cada carregamento de pagina -- precisa
   do limite mais generoso do publicLimiter (100/15min), nao do authLimiter
   (20/15min), senao uma sessao activa a navegar o catalogo esgotava
   rapidamente o orcamento de tentativas de login. */
router.get('/session',   publicLimiter, session);

module.exports = router;
