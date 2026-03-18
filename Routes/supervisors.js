// Routes/Routes_supervisors.js
const express = require('express');
const router  = express.Router();

const { getSupervisors, assignSupervisor, updateSupervisor, deleteSupervisor } = require('../Controllers/supervisorController');
const { protect, authorise } = require('../middleware/auth');

router.use(protect);

// Admin + academic: list all supervisors (with student load counts)
router.get('/', authorise('admin', 'academic'), getSupervisors);

// Admin: assign a student to a supervisor
router.put('/:id/assign',  authorise('admin'), assignSupervisor);

// Admin: edit or remove a supervisor
router.put('/:id',         authorise('admin'), updateSupervisor);
router.delete('/:id',      authorise('admin'), deleteSupervisor);

module.exports = router;