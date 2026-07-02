require('dotenv').config();
const http    = require('http');
const path    = require('path');
const express = require('express');
const cors    = require('cors');
const { initSocket } = require('./services/socketService');

const authRoutes = require('./routes/auth');
const onboardingRoutes = require('./routes/onboarding');
const unitsRoutes = require('./routes/units');
const reservationsRoutes = require('./routes/reservations');
const calendarRoutes = require('./routes/calendar');
const customersRoutes = require('./routes/customers');
const automationsRoutes = require('./routes/automations');
const financeiroRoutes = require('./routes/financeiro');
const publicRoutes     = require('./routes/public');
const uploadRoutes     = require('./routes/upload');
const adminRoutes      = require('./routes/admin');
const fleetRoutes     = require('./routes/fleet');
const staffRoutes     = require('./routes/staff');
const messageRoutes   = require('./routes/messages');
const assignmentRoutes = require('./routes/assignments');
const errorHandler = require('./middleware/errorHandler');
const { iniciarCron } = require('./services/cronService');

const app = express();

const corsOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map((s) => s.trim())
  : [];

app.use(cors({
  origin: process.env.NODE_ENV === 'development' ? true : corsOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb', strict: false }));
app.use((req, res, next) => { req.setTimeout(30000); next(); });

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/onboarding',    onboardingRoutes);
app.use('/api/v1/onboarding', onboardingRoutes);
app.use('/api/units',         unitsRoutes);
app.use('/api/v1/units',      unitsRoutes);
app.use('/api/reservations',  reservationsRoutes);
app.use('/api/v1/reservations', reservationsRoutes);
app.use('/api/calendar',      calendarRoutes);
app.use('/api/v1/calendar',   calendarRoutes);
app.use('/api/customers',     customersRoutes);
app.use('/api/v1/customers',  customersRoutes);
app.use('/api/automations',   automationsRoutes);
app.use('/api/v1/automations',automationsRoutes);
app.use('/api/financeiro',    financeiroRoutes);
app.use('/api/v1/financeiro', financeiroRoutes);
app.use('/api/v1/upload',     uploadRoutes);
app.use('/api/admin',         adminRoutes);
app.use('/api/v1/admin',      adminRoutes);
app.use('/public',         publicRoutes);
app.use('/api/v1/public',  publicRoutes);
app.use('/api/v1/fleet',       fleetRoutes);
app.use('/api/v1/staff',       staffRoutes);
app.use('/api/v1/messages',    messageRoutes);
app.use('/api/v1/assignments', assignmentRoutes);

/* Ficheiros enviados — em producao o Nginx serve /uploads/ directamente,
   mas mantemos isto para que funcione tambem em dev sem Nginx. */
app.use('/uploads', express.static(path.resolve(process.env.UPLOADS_DIR || '/var/www/saldesk/uploads')));

app.use(errorHandler);

const PORT   = process.env.PORT || 3001;
const server = http.createServer(app);
initSocket(server);

server.listen(PORT, () => {
  console.log(`Servidor SalDesk a correr na porta ${PORT} [${process.env.NODE_ENV}]`);
  if (process.env.NODE_ENV !== 'test') iniciarCron();
});

module.exports = app;
