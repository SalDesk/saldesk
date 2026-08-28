const express = require('express');
const router = express.Router();
const { register, login, refresh, getMe, logout, changePassword, validateInvite, resetPassword, forgotPassword, demoLogin } = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');
const { authLimiter, demoLimiter } = require('../middleware/rateLimiters');

router.post('/register', authLimiter, validate(schemas.register), register);
router.post('/login',    authLimiter, login);
router.post('/refresh',  authLimiter, refresh);
router.post('/validate-invite', authLimiter, validate(schemas.validateInvite), validateInvite);
router.post('/reset-password', authLimiter, validate(schemas.resetPassword), resetPassword);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/demo-login', demoLimiter, demoLogin);
router.get('/me',        authMiddleware, getMe);
router.post('/logout',   authMiddleware, logout);
router.put('/password',  authMiddleware, validate(schemas.changePassword), changePassword);

module.exports = router;
