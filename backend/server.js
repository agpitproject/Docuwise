


const express = require('express');
const dotenv = require('dotenv');
dotenv.config();
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const connectDB = require('./src/config/db');
const routes = require('./src/routes/index');
const errorHandler = require('./src/middleware/errorHandler');
const app = express();
const PORT = process.env.PORT || 5000;

// ─── Connect Database ─────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  connectDB();
}

// ─── Security Middleware ──────────────────────────────
<<<<<<< HEAD
app.use(helmet());
=======
app.use(helmet({
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
}));
>>>>>>> 40ca2adf759077ac7759244ca7858e32f97310c1
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// ─── Request Parsing ──────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Logging ──────────────────────────────────────────
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ─── Static (uploaded files) ──────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── API Routes ───────────────────────────────────────
app.use('/api', routes);

// ─── Health Check ─────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// ─── 404 Handler ──────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ─── Global Error Handler ─────────────────────────────
app.use(errorHandler);

// ─── Start ────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
  console.log(`\n🚀 DocuWise API running on http://localhost:${PORT}`);
  console.log(`📦 Environment: ${process.env.NODE_ENV}`);
  });
}
module.exports = app;
