const express = require('express');
const router = express.Router();
const { register, login, refresh, getMe, logout, changePassword, resetPassword, forgotPassword } = require('../controllers/travelerAuthController');
const authMiddleware = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');

router.post('/register', validate(schemas.travelerRegister), register);
router.post('/login',    login);
router.post('/refresh',  refresh);
router.post('/reset-password', resetPassword);
router.post('/forgot-password', forgotPassword);
router.get('/me',        authMiddleware, getMe);
router.post('/logout',   authMiddleware, logout);
router.put('/password',  authMiddleware, validate(schemas.changePassword), changePassword);

module.exports = router;
