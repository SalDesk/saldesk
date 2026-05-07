require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes        = require('./src/routes/auth');
const onboardingRoutes  = require('./src/routes/onboarding');
const unitsRoutes       = require('./src/routes/units');
const reservationsRoutes= require('./src/routes/reservations');
const calendarRoutes    = require('./src/routes/calendar');
const customersRoutes   = require('./src/routes/customers');
const automationsRoutes = require('./src/routes/automations');
const financeiroRoutes  = require('./src/routes/financeiro');
const publicRoutes      = require('./src/routes/public');
const errorHandler      = require('./src/middleware/errorHandler');
const { iniciarCron }   = require('./src/services/cronService');

const app = express();

/* Seguranca */
app.use(helmet());

/* CORS */
const corsOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map((s) => s.trim())
  : [];
app.use(cors({
  origin: process.env.NODE_ENV === 'development' ? true : corsOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '5mb' }));

/* Rate limiting nos endpoints publicos */
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas tentativas. Tente novamente mais tarde.', code: 'RATE_LIMIT' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas tentativas de autenticacao.', code: 'RATE_LIMIT' },
});

/* Health check */
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: '2.0.0', timestamp: new Date().toISOString() });
});

/* Rotas API v1 */
app.use('/api/v1/auth',         authLimiter, authRoutes);
app.use('/api/v1/onboarding',   onboardingRoutes);
app.use('/api/v1/units',        unitsRoutes);
app.use('/api/v1/reservations', reservationsRoutes);
app.use('/api/v1/calendar',     calendarRoutes);
app.use('/api/v1/customers',    customersRoutes);
app.use('/api/v1/automations',  automationsRoutes);
app.use('/api/v1/financial',    financeiroRoutes);
app.use('/api/v1/public',       publicLimiter, publicRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`SalDesk API v2 a correr na porta ${PORT} [${process.env.NODE_ENV}]`);
  if (process.env.NODE_ENV !== 'test') iniciarCron();
});

module.exports = app;
