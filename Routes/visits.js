
const express = require('express');
const router  = express.Router();

const { scheduleVisit, getVisits, updateVisit } = require('../Controllers/visitController');
const { protect, authorise } = require('../middleware/auth');

router.use(protect);

router.post('/', authorise('academic'), scheduleVisit);

// FIX: removed duplicate `protect` — already applied by router.use above
router.get('/', getVisits);

router.put('/:id', authorise('academic', 'admin'), updateVisit);

module.exports = router;