require('dotenv').config();
const http    = require('http');
const path    = require('path');
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const cookieParser = require('cookie-parser');
const { publicLimiter, authLimiter } = require('./src/middleware/rateLimiters');

const authRoutes         = require('./src/routes/auth');
const travelerAuthRoutes = require('./src/routes/travelerAuth');
const travelerRoutes     = require('./src/routes/traveler');
const onboardingRoutes   = require('./src/routes/onboarding');
const unitsRoutes        = require('./src/routes/units');
const reservationsRoutes = require('./src/routes/reservations');
const ordersRoutes       = require('./src/routes/orders');
const calendarRoutes     = require('./src/routes/calendar');
const customersRoutes    = require('./src/routes/customers');
const automationsRoutes  = require('./src/routes/automations');
const financeiroRoutes   = require('./src/routes/financeiro');
const publicRoutes       = require('./src/routes/public');
const integrationRoutes  = require('./src/routes/integrations');
const gygIntegratorRoutes = require('./src/routes/gygIntegrator');
const staffRoutes        = require('./src/routes/staff');
const sellerCommissionsRoutes = require('./src/routes/sellerCommissions');
const assignmentRoutes   = require('./src/routes/assignments');
const messageRoutes      = require('./src/routes/messages');
const fleetRoutes        = require('./src/routes/fleet');
const notificationRoutes = require('./src/routes/notifications');
const paymentRoutes      = require('./src/routes/payments');
const reviewRoutes       = require('./src/routes/reviews');
const adminRoutes        = require('./src/routes/admin');
const marketingRoutes    = require('./src/routes/marketing');
const telemetryRoutes    = require('./src/routes/telemetry');
const seoRoutes          = require('./src/routes/seo');
const voucherRoutes      = require('./src/routes/vouchers');
const loyaltyRoutes      = require('./src/routes/loyalty');
const affiliateRoutes    = require('./src/routes/affiliates');
const groupsRoutes       = require('./src/routes/groups');
const packagesRoutes     = require('./src/routes/packages');
const partnersRoutes     = require('./src/routes/partners');
const occurrencesRoutes  = require('./src/routes/occurrences');
const expensesRoutes     = require('./src/routes/expenses');
const errorHandler       = require('./src/middleware/errorHandler');
const uploadRoutes       = require('./src/routes/upload');
const uploadDocumentRoutes = require('./src/routes/uploadDocument');
const billingRoutes      = require('./src/routes/billing');
const { iniciarCron }    = require('./src/services/cronService');
const { initQueues }     = require('./src/queues/queueManager');
const { initSocket }     = require('./src/services/socketService');
const ipBlockStore       = require('./src/services/ipBlockStore');
const blockedIpMiddleware = require('./src/middleware/blockedIp');

const app    = express();
const server = http.createServer(app);

/* Em producao o Nginx fica a frente do Node -- sem isto, req.ip devolve
   sempre o IP do proprio Nginx (nao o do visitante), o que tornaria o
   bloqueio de IP (abaixo) perigoso: "bloquear" um atacante bloquearia o
   proxy inteiro, ou seja, todo o trafego. '1' confia apenas no primeiro
   hop (o Nginx imediatamente a frente), nao na cadeia X-Forwarded-For
   inteira que um cliente poderia falsificar. */
app.set('trust proxy', 1);

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
  /* Necessario para a cookie de sessao partilhada (.saldesk.cv) atravessar
     saldesk.cv <-> api.saldesk.cv -- so muda comportamento para pedidos
     que ja pecam credentials:'include'/withCredentials explicitamente, os
     fetch() anonimos existentes continuam identicos. A lista de origens
     acima ja e um array explicito (nunca '*'), por isso e seguro activar. */
  credentials: true,
}));

app.use(cookieParser());
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: '2.0.0', timestamp: new Date().toISOString() });
});

/* Bloqueio de IP (Sistema -> Seguranca) -- fora do /api/health para nao
   arriscar tirar o monitor de uptime do ar por engano. */
app.use(blockedIpMiddleware);

/* Rotas API v1 */
app.use('/api/v1/auth',          authLimiter,  authRoutes);
app.use('/api/v1/traveler-auth', travelerAuthRoutes);
app.use('/api/v1/traveler',      travelerRoutes);
app.use('/api/v1/onboarding',    onboardingRoutes);
app.use('/api/v1/units',         unitsRoutes);
app.use('/api/v1/reservations',  reservationsRoutes);
app.use('/api/v1/orders',        ordersRoutes);
app.use('/api/v1/calendar',      calendarRoutes);
app.use('/api/v1/customers',     customersRoutes);
app.use('/api/v1/automations',   automationsRoutes);
app.use('/api/v1/financial',     financeiroRoutes);
app.use('/api/v1/public',        publicLimiter, publicRoutes);
app.use('/api/v1/integrations',  integrationRoutes);
app.use('/api/v1/gyg-integrator', gygIntegratorRoutes);
app.use('/api/v1/staff',         staffRoutes);
app.use('/api/v1/seller-commissions', sellerCommissionsRoutes);
app.use('/api/v1/assignments',   assignmentRoutes);
app.use('/api/v1/messages',      messageRoutes);
app.use('/api/v1/fleet',         fleetRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/payments',     paymentRoutes);
app.use('/api/v1/reviews',      reviewRoutes);
app.use('/api/v1/upload',  uploadRoutes);
app.use('/api/v1/upload',  uploadDocumentRoutes);
app.use('/api/v1/admin',        adminRoutes);
app.use('/api/v1/marketing',    marketingRoutes);
app.use('/api/v1/telemetry',    telemetryRoutes);
app.use('/api/v1/vouchers',     voucherRoutes);
app.use('/api/v1/loyalty',      loyaltyRoutes);
app.use('/api/v1/affiliates',   affiliateRoutes);
app.use('/api/v1/groups',       groupsRoutes);
app.use('/api/v1/packages',     packagesRoutes);
app.use('/api/v1/partners',     partnersRoutes);
app.use('/api/v1/occurrences',  occurrencesRoutes);
app.use('/api/v1/expenses',     expensesRoutes);
app.use('/api/v1/billing',      billingRoutes);
app.use('/',                    seoRoutes);

/* Em producao o Nginx serve /uploads/ directamente (alias estatico); em dev
   nao ha Nginx a frente, por isso o proprio Node serve os ficheiros aqui. */
if (process.env.NODE_ENV !== 'production') {
  app.use('/uploads', express.static(path.resolve(process.env.UPLOADS_DIR || '/var/www/saldesk/uploads')));
}

app.use(errorHandler);

const PORT = process.env.PORT || 3001;
server.listen(PORT, async () => {
  console.log(`SalDesk API v2 a correr na porta ${PORT} [${process.env.NODE_ENV}]`);
  await ipBlockStore.refresh().catch((err) => console.error('[IPBlock] Falha ao carregar lista:', err.message));
  if (process.env.NODE_ENV !== 'test') {
    initSocket(server);
    await initQueues();
    iniciarCron();
  }
});

module.exports = { app, server };
