// Routes/grades.js
const express = require('express');
const router  = express.Router();
const {
  submitGrade, updateGrade, getMyGrades, getStudentGrade, getAllGrades,
} = require('../Controllers/gradeController');
const { protect, authorise } = require('../middleware/auth');

router.use(protect);

// Academic / industrial: submit a grade
router.post('/', authorise('academic', 'industrial'), submitGrade);

// Academic / industrial: update an existing grade record
router.put('/:id', authorise('academic', 'industrial'), updateGrade);

// GET /grades/mine — returns all grades submitted by the current user.
// Industrial supervisors use this on mount to build the evaluated/not-evaluated
// split without making N individual getStudentGrade calls.
// MUST be declared before /:id so Express doesn't treat "mine" as an ObjectId.
router.get('/mine', authorise('academic', 'industrial'), getMyGrades);

// GET /grades/student/:studentId — full grade history for one student
router.get('/student/:studentId', authorise('academic', 'industrial', 'admin'), getStudentGrade);

// Admin: full grade registry
router.get('/', authorise('admin'), getAllGrades);

module.exports = router;