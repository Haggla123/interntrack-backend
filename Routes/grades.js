// Routes/grades.js
const express = require('express');
const router  = express.Router();
const {
  submitGrade, updateGrade, getMyGrades, getStudentGrade, getAllGrades,
} = require('../Controllers/gradeController');
const { protect, authorise } = require('../middleware/auth');

router.use(protect);

// Academic / industrial / manager: submit a grade
router.post('/', authorise('academic', 'industrial', 'company_manager'), submitGrade);

// Academic / industrial / manager: update an existing grade record
router.put('/:id', authorise('academic', 'industrial', 'company_manager'), updateGrade);

// GET /grades/mine — returns all grades submitted by the current user.
router.get('/mine', authorise('academic', 'industrial', 'company_manager'), getMyGrades);

// GET /grades/student/:studentId — full grade history for one student
router.get('/student/:studentId', authorise('academic', 'industrial', 'company_manager', 'admin'), getStudentGrade);

// Admin: full grade registry
router.get('/', authorise('admin'), getAllGrades);

module.exports = router;