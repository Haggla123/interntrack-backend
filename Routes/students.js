// Routes/students.js
const express = require('express');
const router  = express.Router();
const {
  getStudents, getStudent, getStudentStats, updateStudent, assignStudent, unassignStudent,
  resetStudentPassword, revokePlacement, deleteStudent,
} = require('../Controllers/studentController');
const { protect, authorise } = require('../middleware/auth');

router.get('/',                    protect, authorise('admin', 'academic', 'industrial', 'company_manager'), getStudents);

// stats must be declared BEFORE /:id so Express doesn't treat
// the literal string "stats" as a MongoDB ObjectId parameter.
router.get('/stats',               protect, authorise('academic', 'admin'), getStudentStats);

router.get('/:id',                 protect, authorise('admin', 'academic', 'industrial', 'company_manager'), getStudent);
router.put('/:id',                 protect, authorise('admin'),                           updateStudent);
router.put('/:id/assign',          protect, authorise('admin'),                           assignStudent);
router.delete('/:id/assign',       protect, authorise('admin'),                           unassignStudent);
router.post('/:id/reset-password', protect, authorise('admin'),                           resetStudentPassword);
router.put('/:id/revoke',          protect, authorise('admin'),                           revokePlacement);
router.delete('/:id',              protect, authorise('admin'),                           deleteStudent);

module.exports = router;
