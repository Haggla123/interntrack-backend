const express = require('express');
const router  = express.Router();
const { submitLog, getMyLogs, getStudentLogs, getPendingLogs, getLogs, approveLog, rejectLog } = require('../Controllers/logController');
const { protect, authorise } = require('../middleware/auth');

router.post('/',                   protect, authorise('student'),                          submitLog);
router.get('/me',                  protect, authorise('student'),                          getMyLogs);
router.get('/pending',             protect, authorise('industrial', 'company_manager', 'admin'),  getPendingLogs);
router.get('/student/:studentId',  protect, authorise('academic', 'industrial', 'company_manager', 'admin'), getStudentLogs);
router.get('/',                    protect, authorise('admin'),                             getLogs);
router.put('/:id/approve',         protect, authorise('industrial', 'company_manager', 'admin'),  approveLog);
router.put('/:id/reject',          protect, authorise('industrial', 'company_manager', 'admin'),  rejectLog);

module.exports = router;
