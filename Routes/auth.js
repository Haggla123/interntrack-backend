// Routes/auth.js
const express = require('express');
const router  = express.Router();

const {
  register, login, getMe, changePassword, forgotPassword,
  updateProfile, uploadAvatar,
} = require('../Controllers/authController');
const { protect }    = require('../middleware/auth');
const avatarUpload   = require('../middleware/avatarUpload');

router.post('/register',        protect, register);        // admin only (enforced in controller)
router.post('/login',           login);
router.get('/me',               protect, getMe);
router.patch('/me',             protect, updateProfile);           // update own profile
router.post('/me/avatar',       protect, avatarUpload.single('avatar'), uploadAvatar);  // upload profile picture
router.post('/change-password', protect, changePassword);
router.post('/forgot-password', forgotPassword);           // public — no token needed

module.exports = router;