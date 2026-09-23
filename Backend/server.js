require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

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

const app = express();
const PORT = process.env.PORT || 8005;

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

// Unified Health Check (Public) - Cleaned Mock Stores
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    service: 'Unified Hierarchical Sub-Admin & Field Manager Backend API',
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
app.use('/api', locationRoutes); // /api/states, /api/districts, /api/divisions, /api/pincodes

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

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`================================================================`);
    console.log(`🚀 Unified Sub-Admin & Field Manager Backend is running!`);
    console.log(`🌐 Local URL:   http://localhost:${PORT}`);
    console.log(`📱 Network URL: http://192.168.100.236:${PORT}`);
    console.log(`⚡ Health Check: http://192.168.100.236:${PORT}/api/health`);
    console.log(`📁 Uploads:      http://192.168.100.236:${PORT}/uploads`);
    console.log(`================================================================`);
  });
}

// Unified API Server - Clean Production Ready Data Store
module.exports = app;
