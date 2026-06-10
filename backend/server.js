require('dotenv').config();
const http    = require('http');
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes         = require('./src/routes/auth');
const onboardingRoutes   = require('./src/routes/onboarding');
const unitsRoutes        = require('./src/routes/units');
const reservationsRoutes = require('./src/routes/reservations');
const calendarRoutes     = require('./src/routes/calendar');
const customersRoutes    = require('./src/routes/customers');
const automationsRoutes  = require('./src/routes/automations');
const financeiroRoutes   = require('./src/routes/financeiro');
const publicRoutes       = require('./src/routes/public');
const integrationRoutes  = require('./src/routes/integrations');
const staffRoutes        = require('./src/routes/staff');
const assignmentRoutes   = require('./src/routes/assignments');
const messageRoutes      = require('./src/routes/messages');
const fleetRoutes        = require('./src/routes/fleet');
const notificationRoutes = require('./src/routes/notifications');
const paymentRoutes      = require('./src/routes/payments');
const reviewRoutes       = require('./src/routes/reviews');
const adminRoutes        = require('./src/routes/admin');
const marketingRoutes    = require('./src/routes/marketing');
const seoRoutes          = require('./src/routes/seo');
const errorHandler       = require('./src/middleware/errorHandler');
const uploadRoutes       = require('./src/routes/upload');
const { iniciarCron }    = require('./src/services/cronService');
const { initQueues }     = require('./src/queues/queueManager');
const { initSocket }     = require('./src/services/socketService');

const app    = express();
const server = http.createServer(app);

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

const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 100,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Demasiadas tentativas.', code: 'RATE_LIMIT' },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 20,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Demasiadas tentativas de autenticacao.', code: 'RATE_LIMIT' },
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: '2.0.0', timestamp: new Date().toISOString() });
});

/* Rotas API v1 */
app.use('/api/v1/auth',          authLimiter,  authRoutes);
app.use('/api/v1/onboarding',    onboardingRoutes);
app.use('/api/v1/units',         unitsRoutes);
app.use('/api/v1/reservations',  reservationsRoutes);
app.use('/api/v1/calendar',      calendarRoutes);
app.use('/api/v1/customers',     customersRoutes);
app.use('/api/v1/automations',   automationsRoutes);
app.use('/api/v1/financial',     financeiroRoutes);
app.use('/api/v1/public',        publicLimiter, publicRoutes);
app.use('/api/v1/integrations',  integrationRoutes);
app.use('/api/v1/staff',         staffRoutes);
app.use('/api/v1/assignments',   assignmentRoutes);
app.use('/api/v1/messages',      messageRoutes);
app.use('/api/v1/fleet',         fleetRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/payments',     paymentRoutes);
app.use('/api/v1/reviews',      reviewRoutes);
app.use('/api/v1/upload',  uploadRoutes);
app.use('/api/v1/admin',        adminRoutes);
app.use('/api/v1/marketing',    marketingRoutes);
app.use('/',                    seoRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 3001;
server.listen(PORT, async () => {
  console.log(`SalDesk API v2 a correr na porta ${PORT} [${process.env.NODE_ENV}]`);
  if (process.env.NODE_ENV !== 'test') {
    initSocket(server);
    await initQueues();
    iniciarCron();
  }
});

module.exports = { app, server };
