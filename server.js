require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');

const app = express();

const requiredEnv = ['MONGO_URI', 'JWT_SECRET', 'CLIENT_URL'];
const missingEnv = requiredEnv.filter(key => !process.env[key]);
if (missingEnv.length) {
  console.error(`Missing required environment variables: ${missingEnv.join(', ')}`);
  process.exit(1);
}

if (process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET must be at least 32 characters.');
  process.exit(1);
}

// ── Database ──────────────────────────────────────────────────────
connectDB();

// ── Security Headers (helmet) ─────────────────────────────────────
// Disable crossOriginResourcePolicy to allow frontend (on different port) to load images
app.use(helmet({ crossOriginResourcePolicy: false }));

// ── CORS ──────────────────────────────────────────────────────────
// In production only CLIENT_URL is allowed.
// Localhost origins are kept for local development only.
const allowedOrigins = [
  process.env.CLIENT_URL,
  ...(process.env.NODE_ENV !== 'production'
    ? ['http://localhost:3000', 'http://localhost:5173',
      'http://127.0.0.1:3000', 'http://127.0.0.1:5173']
    : []),
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // allow curl / mobile
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

// ── Body Parsing ──────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── NoSQL Injection Sanitization ──────────────────────────────────
// Strips keys starting with $ or containing . from req.body / query / params
app.use(mongoSanitize());

// ── Compression ───────────────────────────────────────────────────
app.use(compression());

// ── Static file serving (public avatars only) ─────────
const path = require('path');
app.use('/uploads/avatars', express.static(path.join(__dirname, 'uploads', 'avatars')));

// ── Rate Limiting ─────────────────────────────────────────────────
// Strict limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again in 15 minutes.' },
});

// General API limiter — prevents flooding any endpoint
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please slow down.' },
});

app.use('/api/', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);

// ── Base Routes ───────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.status(200).json({ message: 'InternTrack API is live', documentation: '/api/health' });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── API Routes ────────────────────────────────────────────────────
app.use('/api/cm', require('./Routes/companyManager'));
app.use('/api/auth', require('./Routes/auth'));
app.use('/api/companies', require('./Routes/companies'));
app.use('/api/students', require('./Routes/students'));
app.use('/api/supervisors', require('./Routes/supervisors'));
app.use('/api/logs', require('./Routes/logs'));
app.use('/api/grades', require('./Routes/grades'));
app.use('/api/placements', require('./Routes/placements'));
app.use('/api/documents', require('./Routes/documents'));
app.use('/api/visits', require('./Routes/visits'));
app.use('/api/broadcast', require('./Routes/broadcast'));
app.use('/api/notifications', require('./Routes/notifications'));
app.use('/api/settings', require('./Routes/settings'));

// ── 404 Catch-all ─────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

// ── Global Error Handler ──────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'File exceeds 5 MB limit.' });
  }
  if (err.message === 'Only PDF files are accepted.') {
    return res.status(400).json({ message: err.message });
  }
  // Hide stack traces in production
  const isDev = process.env.NODE_ENV !== 'production';
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    message: isDev ? err.message : 'Internal server error',
    ...(isDev && { stack: err.stack }),
  });
});

// ── Start ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
// Server start - Routes refreshed
app.listen(PORT, () => console.log(`🚀  InternTrack API running on port ${PORT} [${process.env.NODE_ENV}]`));
