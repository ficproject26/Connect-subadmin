require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const customerRoutes = require('./routes/customerRoutes');
const vendorRoutes = require('./routes/vendorRoutes');
const orderRoutes = require('./routes/orderRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const jobRoutes = require('./routes/jobRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const reportRoutes = require('./routes/reportRoutes');
const kycRoutes = require('./routes/kycRoutes');
const qualityRoutes = require('./routes/qualityRoutes');
const pincodeRoutes = require('./routes/pincodeRoutes');
const executiveRoutes = require('./routes/executiveRoutes');

// Newly integrated Manager Portal routes (Option A Revenue Divisions)
const locationRoutes = require('./routes/locationRoutes');
const managerDirectoryRoutes = require('./routes/managerDirectoryRoutes');
const auditRoutes = require('./routes/auditRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const shopVisitRoutes = require('./routes/shopVisitRoutes');
const qcTaskRoutes = require('./routes/qcTaskRoutes'); // QC & Task Routes
const notificationRoutes = require('./routes/notificationRoutes'); // Real-time Notifications

// Real-Time Event, Redis & WebSocket Architecture
const { initRedis } = require('./redis/redisClient');
const { initEventSubscriber } = require('./events/eventSubscriber');
const { initWebSocketServer } = require('./websocket/websocketServer');
const { getSystemRealtimeTelemetry } = require('./realtime/realtimeMetrics');
const eventPublisher = require('./events/eventPublisher');
const { initDatabase } = require('./config/db');

const app = express();
const PORT = process.env.PORT || 8006;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Core Sub-Admin Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/kyc', kycRoutes);
app.use('/api/quality', qualityRoutes);
app.use('/api/pincodes', pincodeRoutes);
app.use('/api/operations', executiveRoutes);

// Dedicated Territory-Scoped Vendor Subscription Routes
const vendorSubscriptionController = require('./controllers/vendorSubscriptionController');
const authMiddleware = require('./middleware/authMiddleware');
app.get('/api/subscriptions', authMiddleware, vendorSubscriptionController.getVendorSubscriptions);
app.post('/api/subscriptions/:id/record-payment', authMiddleware, vendorSubscriptionController.recordSubscriptionPayment);

// Unified Health Check (Public)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    service: 'Unified Hierarchical Sub-Admin & Field Manager Backend API',
    realtime: {
      engine: 'Redis Pub/Sub + WebSocket',
      targetLatency: '< 500ms'
    },
    portals: [
      { name: 'Hierarchical Admin Management Portal', defaultClient: 'http://localhost:3000' },
      { name: 'Agent & Field Manager Portal', defaultClient: 'http://localhost:5173' }
    ]
  });
});

// Integrated Field Manager Routes
app.use('/api/managers', managerDirectoryRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/shop-visits', shopVisitRoutes);
app.use('/api/qc-tasks', qcTaskRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/territory', locationRoutes);
app.use('/api', locationRoutes); // /api/states, /api/districts, /api/divisions, /api/pincodes, /api/hierarchy

// Real-Time System Telemetry & Reconnection Sync
app.get('/api/realtime/metrics', (req, res) => {
  res.json(getSystemRealtimeTelemetry());
});

app.get('/api/realtime/sync', (req, res) => {
  const { since } = req.query;
  const events = eventPublisher.getEventsSince(since);
  res.json({
    success: true,
    count: events.length,
    serverTimestamp: new Date().toISOString(),
    events
  });
});

// WebSocket Information & Probe Endpoint
app.get(['/ws', '/api/ws', '/api/realtime/info'], (req, res) => {
  res.json({
    success: true,
    websocket: true,
    message: 'Unified Real-Time WebSocket endpoint is active. Upgrade connection using Connection: Upgrade, Upgrade: websocket.',
    path: '/ws',
    serverTime: new Date().toISOString()
  });
});

// Global 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Endpoint ${req.originalUrl} not found.` });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err.stack || err.message);
  res.status(err.status || 500).json({ success: false, message: err.message || 'Internal Server Error' });
});

process.on('uncaughtException', (err) => {
  console.error('CRITICAL UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED PROMISE REJECTION:', reason);
});

// HTTP + WebSocket Server Creation
const server = http.createServer(app);

// Attach WebSocket Server
initWebSocketServer(server);

// Initialize Redis Pub/Sub & Local Bus Subscriber
initRedis().then(() => {
  initEventSubscriber();
}).catch(err => {
  console.warn('[RealTime] Event system initialization notice:', err.message);
});

if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log('================================================================');
    console.log('🚀 Unified Sub-Admin & Field Manager Backend is running!');
    console.log('📡 Local URL:   http://localhost:' + PORT);
    console.log('⚡ WebSocket:   ws://localhost:' + PORT + '/ws');
    console.log('🩺 Health Check: http://localhost:' + PORT + '/api/health');
    console.log('📊 Telemetry:   http://localhost:' + PORT + '/api/realtime/metrics');
    console.log('================================================================');

    initDatabase().catch(err => {
      console.error('Database initialization warning:', err.message);
    });
  });
}

// Unified API Server - Clean Production Ready Data Store
module.exports = app;
module.exports.server = server;
