const express = require('express');
const router  = express.Router();
const { submitLog, getMyLogs, getStudentLogs, getPendingLogs, approveLog, rejectLog } = require('../Controllers/logController');
const { protect, authorise } = require('../middleware/auth');

router.post('/',                   protect, authorise('student'),                          submitLog);
router.get('/me',                  protect, authorise('student'),                          getMyLogs);
router.get('/pending',             protect, authorise('industrial', 'admin'),              getPendingLogs);
router.get('/student/:studentId',  protect, authorise('academic', 'industrial', 'admin'), getStudentLogs);
router.put('/:id/approve',         protect, authorise('industrial', 'admin'),              approveLog);
router.put('/:id/reject',          protect, authorise('industrial', 'admin'),              rejectLog);

module.exports = router;