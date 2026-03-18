// Routes/logs.js
// FIX: Changed ../controllers/ to ../Controllers/ (uppercase C) to match
// the actual folder name. On Linux servers this case mismatch crashes
// the server at startup with MODULE_NOT_FOUND.
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