// Controllers/gradeController.js
const Grade = require('../models/Grade');
const User  = require('../models/User');
const { canAccessStudent, requireStudentAccess } = require('../utils/accessControl');

// ── POST /api/grades ─────────────────────────────────────────────
const submitGrade = async (req, res) => {
  try {
    const {
      studentId, grade, score, comments, type,
      // All 7 UENR criteria stored as raw marks
      attendance, punctuality, cooperation,
      aptitudeForLearning, understandingOfJob,
      safetyAdherence, workIndependently,
    } = req.body;

    if (!studentId) return res.status(400).json({ message: 'studentId is required.' });
    if (!grade)     return res.status(400).json({ message: 'grade is required.' });

    const student = await User.findById(studentId);
    if (!student) return res.status(404).json({ message: 'Student not found.' });
    if (!canAccessStudent(req.user, student)) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const gradeType = type || (req.user.role === 'industrial' ? 'industrial' : 'academic');

    // ── Ownership checks ─────────────────────────────────────────
    if (req.user.role === 'industrial') {
      // Industrial supervisor may only grade students explicitly assigned to them.
      const directLink  = student.industrialSupervisor &&
        student.industrialSupervisor.toString() === req.user._id.toString();
      if (!directLink) {
        return res.status(403).json({ message: 'You can only evaluate students assigned to you.' });
      }
    } else if (req.user.role === 'academic') {
      // Academic supervisor may only grade students assigned to them
      const assigned = student.academicSupervisor &&
        student.academicSupervisor.toString() === req.user._id.toString();
      if (!assigned) {
        return res.status(403).json({ message: 'You can only grade students assigned to you.' });
      }
    }

    const record = await Grade.findOneAndUpdate(
      { student: studentId, type: gradeType },
      {
        student:      studentId,
        submittedBy:  req.user._id,
        type:         gradeType,
        grade,
        score:              score             ?? null,
        comments:           comments          || '',
        attendance:         attendance        ?? null,
        punctuality:        punctuality       ?? null,
        cooperation:        cooperation       ?? null,
        aptitudeForLearning: aptitudeForLearning ?? null,
        understandingOfJob:  understandingOfJob  ?? null,
        safetyAdherence:    safetyAdherence   ?? null,
        workIndependently:  workIndependently  ?? null,
      },
      { new: true, upsert: true, runValidators: true }
    );

    // Only mark the student as fully "Graded" when an academic or
    // report grade is submitted. Industrial scores are intermediate inputs
    // that academic supervisors use to arrive at the final grade.
    if (gradeType === 'academic' || gradeType === 'report') {
      await User.findByIdAndUpdate(studentId, {
        gradeStatus: 'Graded',
        finalGrade:  grade,
      });
    }

    res.status(200).json({ success: true, data: record });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── PUT /api/grades/:id ──────────────────────────────────────────
const updateGrade = async (req, res) => {
  try {
    const {
      grade, score, comments,
      attendance, punctuality, cooperation,
      aptitudeForLearning, understandingOfJob,
      safetyAdherence, workIndependently,
    } = req.body;

    const record = await Grade.findById(req.params.id)
      .populate('student', '_id role academicSupervisor industrialSupervisor companyId');
    if (!record) return res.status(404).json({ message: 'Grade record not found.' });
    if (!canAccessStudent(req.user, record.student)) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    if (grade               !== undefined) record.grade = grade;
    if (score               !== undefined) record.score = score;
    if (comments            !== undefined) record.comments = comments;
    if (attendance          !== undefined) record.attendance = attendance;
    if (punctuality         !== undefined) record.punctuality = punctuality;
    if (cooperation         !== undefined) record.cooperation = cooperation;
    if (aptitudeForLearning !== undefined) record.aptitudeForLearning = aptitudeForLearning;
    if (understandingOfJob  !== undefined) record.understandingOfJob = understandingOfJob;
    if (safetyAdherence     !== undefined) record.safetyAdherence = safetyAdherence;
    if (workIndependently   !== undefined) record.workIndependently = workIndependently;
    record.submittedBy = req.user._id;
    await record.save();

    // Same rule — only sync finalGrade for academic/report types
    if (grade && (record.type === 'academic' || record.type === 'report')) {
      await User.findByIdAndUpdate(record.student, {
        finalGrade:  grade,
        gradeStatus: 'Graded',
      });
    }

    res.status(200).json({ success: true, data: record });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET /api/grades/mine — supervisor's own submissions ──────────
// Returns all grades submitted by the current user.
// Industrial supervisors call this on mount so they can immediately see
// which students are already evaluated without N individual lookups.
const getMyGrades = async (req, res) => {
  try {
    const grades = await Grade.find({ submittedBy: req.user._id })
      .populate('student', 'name indexNumber department')
      .sort({ updatedAt: -1 });
    res.status(200).json({ success: true, data: grades });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET /api/grades/student/:studentId ───────────────────────────
const getStudentGrade = async (req, res) => {
  try {
    const student = await requireStudentAccess(req, res, req.params.studentId);
    if (!student) return;

    const grades = await Grade.find({ student: req.params.studentId })
      .populate('submittedBy', 'name role')
      .sort({ updatedAt: -1 });
    res.status(200).json({ success: true, data: grades });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET /api/grades ───────────────────────────────────────────────
const getAllGrades = async (req, res) => {
  try {
    const grades = await Grade.find()
      .populate('student',     'name indexNumber department')
      .populate('submittedBy', 'name role')
      .sort({ updatedAt: -1 });
    res.status(200).json({ success: true, data: grades });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { submitGrade, updateGrade, getMyGrades, getStudentGrade, getAllGrades };
