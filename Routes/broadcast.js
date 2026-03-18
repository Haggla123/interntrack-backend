const express   = require('express');
const router    = express.Router();
const { broadcast } = require('../Controllers/broadcastController');
const { protect, authorise } = require('../middleware/auth');

router.post('/', protect, authorise('admin'), broadcast);

module.exports = router;