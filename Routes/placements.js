// Routes/Routes_placements.js
const express = require('express');
const router  = express.Router();

const {
  submitPlacementRequest, getPlacementRequests,
  approvePlacement, declinePlacement,
} = require('../Controllers/placementController');
const { protect, authorise } = require('../middleware/auth');

router.use(protect);

// Student: submit their company placement report
router.post('/', authorise('student'), submitPlacementRequest);

// Admin: view queue, approve, decline
router.get('/',              authorise('admin'), getPlacementRequests);
router.put('/:id/approve',   authorise('admin'), approvePlacement);
router.put('/:id/decline',   authorise('admin'), declinePlacement);

module.exports = router;