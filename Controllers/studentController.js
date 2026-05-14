// Controllers/studentController.js
const User   = require('../models/User');
const Log    = require('../models/Log');
const Grade  = require('../models/Grade');
const Company = require('../models/Company');
const crypto = require('crypto');
const { canAccessStudent } = require('../utils/accessControl');

const makeTempPassword = () =>
  'UENR-' + crypto.randomBytes(6).toString('base64url').slice(0, 8);

const sendEmail = async (to, subject, html) => {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': process.env.BREVO_API_KEY },
    body: JSON.stringify({
      sender:      { name: 'UENR InternTrack', email: process.env.MAIL_ADDRESS },
      to:          [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Brevo error ${res.status}`);
  }
};

const sendPasswordResetEmail = async (email, name, tempPassword, identifier) => {
  if (!email) return;
  await sendEmail(
    email,
    'InternTrack – Your Password Has Been Reset',
    `<div style="font-family:sans-serif;max-width:600px;margin:auto;border:1px solid #eee;padding:24px;border-radius:10px;">
      <h2 style="color:#2c5282;text-align:center;">University of Energy and Natural Resources</h2>
      <p style="text-align:center;color:#64748b;font-size:13px;">InternTrack Portal — Password Reset</p>
      <hr style="border:0;border-top:1px solid #eee;" />
      <h3 style="color:#2c5282;">Hi ${name},</h3>
      <p>Your InternTrack password has been reset by an administrator.</p>
      <div style="background:#f7fafc;padding:16px;border-radius:6px;margin:20px 0;border-left:4px solid #e53e3e;">
        <p style="margin:5px 0;"><strong>Login ID:</strong> ${email}</p>
        <p style="margin:5px 0;"><strong>Temporary Password:</strong> <span style="color:#e53e3e;font-weight:bold;font-size:18px;">${tempPassword}</span></p>
        <p style="margin:5px 0;"><strong>Portal:</strong> <a href="${process.env.CLIENT_URL}/login">${process.env.CLIENT_URL}/login</a></p>
      </div>
      <p style="font-size:0.85em;color:#718096;">You will be asked to set a new password after logging in.</p>
      <footer style="margin-top:24px;border-top:1px solid #eee;padding-top:12px;font-size:0.8em;color:#a0aec0;text-align:center;">
        &copy; ${new Date().getFullYear()} UENR InternTrack System | Sunyani, Ghana
      </footer>
    </div>`
  );
};

// ── GET /api/students ────────────────────────────────────────────
const getStudents = async (req, res) => {
  try {
    let filter = { role: 'student', isActive: true };

    if (req.user.role === 'academic') {
      filter.academicSupervisor = req.user._id;

    } else if (req.user.role === 'industrial') {
      // Industrial supervisors only see students explicitly assigned to them
      filter.industrialSupervisor = req.user._id;

    } else if (req.user.role === 'company_manager') {
      // Company managers see all students placed at their company
      if (req.user.companyId) {
        filter.companyId = req.user.companyId;
      } else {
        return res.status(200).json({ success: true, data: [] });
      }
    }

    const students = await User.find(filter)
      .select('-password')
      .populate('academicSupervisor', 'name email department staffId profilePicture')
      .populate('industrialSupervisor', 'name email phone companyOrg profilePicture')
      .populate('companyId', 'name location category lat long radius supervisorName supervisorEmail supervisorPhone')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: students });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET /api/students/stats ───────────────────────────────────────
// Batch stats: 2 MongoDB aggregations for N students in one request.
// Replaces the N+1 pattern in AcademicDashboard and MyInterns where
// each student previously required 2 separate API calls.
// Call: GET /api/students/stats?ids=id1,id2,id3&totalWeeks=6
const getStudentStats = async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const ids = (req.query.ids || '')
      .split(',')
      .filter(Boolean)
      .map(id => {
        try { return new mongoose.Types.ObjectId(id.trim()); }
        catch { return null; }
      })
      .filter(Boolean);

    if (!ids.length) {
      return res.status(200).json({ success: true, data: {} });
    }

    const totalWeeks = Math.max(1, parseInt(req.query.totalWeeks) || 6);

    let allowedIds = ids;
    if (req.user.role === 'academic') {
      const assigned = await User.find({
        _id: { $in: ids },
        role: 'student',
        isActive: true,
        academicSupervisor: req.user._id,
      }).select('_id');
      allowedIds = assigned.map(s => s._id);
    }

    if (!allowedIds.length) {
      return res.status(200).json({ success: true, data: {} });
    }

    const [logAgg, gradeAgg] = await Promise.all([
      Log.aggregate([
        { $match: { student: { $in: allowedIds }, status: 'Approved' } },
        { $group: { _id: '$student', approvedCount: { $sum: 1 } } },
      ]),
      Grade.aggregate([
        { $match: { student: { $in: allowedIds } } },
        { $sort: { updatedAt: -1 } },
        { $group: {
          _id: '$student',
          grades: { $push: { type: '$type', grade: '$grade', score: '$score', _id: '$_id' } },
        }},
      ]),
    ]);

    const logMap = {};
    logAgg.forEach(l => { logMap[l._id.toString()] = l.approvedCount; });

    const gradeMap = {};
    gradeAgg.forEach(g => {
      const indus = g.grades.find(x => x.type === 'industrial');
      const acad  = g.grades.find(x => x.type === 'academic' || x.type === 'report');
      gradeMap[g._id.toString()] = {
        indusScore: indus?.score || 0,
        gradeId:    acad?._id   || null,
        finalGrade: acad?.grade || '-',
      };
    });

    const stats = {};
    allowedIds.forEach(id => {
      const sid          = id.toString();
      const approvedCount = logMap[sid] || 0;
      const weeks        = Math.min(Math.floor(approvedCount / 5), totalWeeks);
      const progress     = Math.round((weeks / totalWeeks) * 100);
      const g            = gradeMap[sid] || {};
      stats[sid] = {
        approvedLogs: approvedCount,
        weeks,
        progress,
        indusScore: g.indusScore || 0,
        gradeId:    g.gradeId   || null,
        finalGrade: g.finalGrade || '-',
      };
    });

    res.status(200).json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET /api/students/:id ────────────────────────────────────────
const getStudent = async (req, res) => {
  try {
    const student = await User.findOne({ _id: req.params.id, role: 'student' })
      .select('-password')
      .populate('academicSupervisor', 'name email department staffId profilePicture')
      .populate('industrialSupervisor', 'name email phone companyOrg profilePicture')
      .populate('companyId', 'name location category lat long radius supervisorName supervisorEmail supervisorPhone');

    if (!student) return res.status(404).json({ message: 'Student not found.' });
    if (!canAccessStudent(req.user, student)) {
      return res.status(403).json({ message: 'Access denied.' });
    }
    res.status(200).json({ success: true, data: student });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── PUT /api/students/:id ────────────────────────────────────────
const updateStudent = async (req, res) => {
  try {
    const allowed = ['name', 'email', 'indexNumber', 'department', 'staffId'];
    const updates = {};
    allowed.forEach(k => {
      if (req.body[k] === undefined) return;
      // Sanitize sparse-indexed fields: empty string → undefined so MongoDB
      // treats the field as absent and the sparse unique index ignores it
      if ((k === 'indexNumber' || k === 'staffId') && req.body[k]?.trim() === '') {
        updates[k] = undefined;
      } else {
        updates[k] = req.body[k];
      }
    });

    const student = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'student' },
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    if (!student) return res.status(404).json({ message: 'Student not found.' });
    res.status(200).json({ success: true, data: student });
  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0] || '';
      if (field === 'indexNumber') {
        return res.status(400).json({ message: 'This index number is already registered to another student.' });
      }
      if (field === 'email') {
        return res.status(400).json({ message: 'This email address is already registered.' });
      }
      return res.status(400).json({ message: 'A user with these details already exists.' });
    }
    res.status(500).json({ message: err.message });
  }
};
const assignStudent = async (req, res) => {
  try {
    const { academicSupervisorId, companyId, companyName, industrialSupervisorId } = req.body;

    const updates = {};
    if (academicSupervisorId)  updates.academicSupervisor  = academicSupervisorId;
    if (industrialSupervisorId) updates.industrialSupervisor = industrialSupervisorId;
    if (companyId)             updates.companyId            = companyId;
    if (companyName)           updates.companyName          = companyName;
    if (companyId || companyName) updates.placementStatus   = 'Active';

    const student = await User.findByIdAndUpdate(
      req.params.id, updates, { new: true, runValidators: true }
    ).select('-password')
     .populate('academicSupervisor',  'name email department staffId')
     .populate('industrialSupervisor','name email companyOrg profilePicture')
     .populate('companyId', 'name location category lat long radius supervisorName supervisorEmail supervisorPhone');

    if (!student) return res.status(404).json({ message: 'Student not found.' });
    res.status(200).json({ success: true, data: student });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── POST /api/students/:id/reset-password ────────────────────────
const resetStudentPassword = async (req, res) => {
  try {
    const student = await User.findOne({ _id: req.params.id, role: 'student' });
    if (!student) return res.status(404).json({ message: 'Student not found.' });

    const tempPassword = makeTempPassword();
    student.password            = tempPassword;
    student.needsPasswordChange = true;
    await student.save();

    const identifier = student.indexNumber || student.email;
    let emailSent = false;
    try {
      await sendPasswordResetEmail(student.email, student.name, tempPassword, identifier);
      emailSent = true;
    } catch (mailErr) {
      console.error('Password reset email failed:', mailErr.message);
    }

    res.status(200).json({
      success: true,
      message: emailSent
        ? `Password reset for ${student.name}. New credentials emailed to ${student.email}.`
        : `Password reset for ${student.name}, but the email failed to send. Please try again.`,
      emailSent,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── PUT /api/students/:id/revoke ─────────────────────────────────
const revokePlacement = async (req, res) => {
  try {
    const existing = await User.findOne({ _id: req.params.id, role: 'student' })
      .select('companyId placementStatus');

    const student = await User.findByIdAndUpdate(
      req.params.id,
      {
        companyName: '', companyId: null, placementStatus: 'Unplaced',
        academicSupervisor: null, industrialSupervisor: null,
        gradeStatus: 'Pending', finalGrade: null,
      },
      { new: true }
    ).select('-password');

    if (!student) return res.status(404).json({ message: 'Student not found.' });
    if (existing?.placementStatus === 'Active' && existing.companyId) {
      await Company.findByIdAndUpdate(existing.companyId, { $inc: { slots: 1 } });
    }
    res.status(200).json({ success: true, data: student });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── DELETE /api/students/:id/assign ──────────────────────────────
const unassignStudent = async (req, res) => {
  try {
    const student = await User.findByIdAndUpdate(
      req.params.id,
      { $unset: { academicSupervisor: '' } },
      { new: true }
    ).select('-password')
     .populate('companyId', 'name location category lat long radius supervisorName supervisorEmail supervisorPhone');

    if (!student) return res.status(404).json({ message: 'Student not found.' });
    res.status(200).json({ success: true, data: student });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── DELETE /api/students/:id ─────────────────────────────────────
const deleteStudent = async (req, res) => {
  try {
    const student = await User.findOne({ _id: req.params.id, role: 'student' });
    if (!student) return res.status(404).json({ message: 'Student not found.' });
    const shouldRestoreSlot = student.isActive && student.placementStatus === 'Active' && student.companyId;
    student.isActive = false;
    await student.save();
    if (shouldRestoreSlot) {
      await Company.findByIdAndUpdate(student.companyId, { $inc: { slots: 1 } });
    }
    res.status(200).json({ success: true, message: `${student.name} has been deactivated.` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getStudents, getStudentStats, getStudent, updateStudent,
  assignStudent, unassignStudent, resetStudentPassword,
  revokePlacement, deleteStudent,
};
