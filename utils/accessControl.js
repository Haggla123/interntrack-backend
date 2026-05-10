const User = require('../models/User');

const idEquals = (a, b) => {
  if (!a || !b) return false;
  return a.toString() === b.toString();
};

const getUserId = (value) => {
  if (!value) return null;
  return value._id || value;
};

const canAccessStudent = (user, student) => {
  if (!user || !student) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'student') return idEquals(user._id, student._id);
  if (user.role === 'academic') {
    return idEquals(getUserId(student.academicSupervisor), user._id);
  }
  if (user.role === 'industrial') {
    return idEquals(getUserId(student.industrialSupervisor), user._id);
  }
  if (user.role === 'company_manager') {
    return user.companyId && idEquals(getUserId(student.companyId), user.companyId);
  }
  return false;
};

const loadStudentForAccess = async (studentId) =>
  User.findOne({ _id: studentId, role: 'student', isActive: true })
    .select('_id role academicSupervisor industrialSupervisor companyId');

const requireStudentAccess = async (req, res, studentId) => {
  const student = await loadStudentForAccess(studentId);
  if (!student) {
    res.status(404).json({ message: 'Student not found.' });
    return null;
  }
  if (!canAccessStudent(req.user, student)) {
    res.status(403).json({ message: 'Access denied.' });
    return null;
  }
  return student;
};

module.exports = {
  canAccessStudent,
  idEquals,
  requireStudentAccess,
};
