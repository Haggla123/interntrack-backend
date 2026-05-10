// Routes/Routes_settings.js
const express = require('express');
const router  = express.Router();

const {
  getSettings, updateSettings, addDepartment, removeDepartment,
} = require('../Controllers/settingsController');
const { protect, authorise } = require('../middleware/auth');

router.use(protect);

// GET  /api/settings  — all roles can read (so portals know totalWeeks, geofence, etc.)
router.get('/', getSettings);

// PUT  /api/settings  — admin only
router.put('/', authorise('admin'), updateSettings);

// POST   /api/settings/departments — admin only
router.post('/departments', authorise('admin'), addDepartment);

// DELETE /api/settings/departments — admin only
router.delete('/departments', authorise('admin'), removeDepartment);
router.delete('/departments/:name', authorise('admin'), removeDepartment);

module.exports = router;
