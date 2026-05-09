const express = require('express');
const router = express.Router();
const { getNotifications, markNotificationRead } = require('../Controllers/notificationController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/', getNotifications);
router.patch('/:id/read', markNotificationRead);

module.exports = router;
