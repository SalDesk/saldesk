const express = require('express');
const router = express.Router();
const { register, login, refresh, getMe, logout, changePassword, validateInvite, resetPassword, forgotPassword } = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');

router.post('/register', validate(schemas.register), register);
router.post('/login',    login);
router.post('/refresh',  refresh);
router.post('/validate-invite', validate(schemas.validateInvite), validateInvite);
router.post('/reset-password', validate(schemas.resetPassword), resetPassword);
router.post('/forgot-password', forgotPassword);
router.get('/me',        authMiddleware, getMe);
router.post('/logout',   authMiddleware, logout);
router.put('/password',  authMiddleware, validate(schemas.changePassword), changePassword);

module.exports = router;
