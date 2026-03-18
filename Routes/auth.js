// Routes/Routes_auth.js
const express = require('express');
const router  = express.Router();

const {
  register, login, getMe, changePassword, forgotPassword,
} = require('../Controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register',        protect, register);        // admin only (enforced in controller)
router.post('/login',           login);
router.get('/me',               protect, getMe);
router.post('/change-password', protect, changePassword);
router.post('/forgot-password', forgotPassword);           // public — no token needed

module.exports = router;