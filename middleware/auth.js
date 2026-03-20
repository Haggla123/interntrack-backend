const jwt  = require('jsonwebtoken');
const User = require('../models/User');

// ── protect ──────────────────────────────────────────────────────
// Reads the Bearer token from Authorization header, verifies it,
// loads the full user from MongoDB, and attaches it to req.user.
const protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Not authorised. No token provided.' });
    }

    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ message: 'User belonging to this token no longer exists.' });
    }
    if (!user.isActive) {
      return res.status(403).json({ message: 'This account has been deactivated.' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Session expired. Please log in again.' });
    }
    return res.status(401).json({ message: 'Invalid token. Please log in again.' });
  }
};

// ── authorise ────────────────────────────────────────────────────
// Factory: returns a middleware that allows only the listed roles.
// Usage: authorise('admin', 'academic')
const authorise = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authenticated.' });
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      message: `Access denied. Required role: ${roles.join(' or ')}. Your role: ${req.user.role}.`,
    });
  }
  next();
};

module.exports = { protect, authorise };