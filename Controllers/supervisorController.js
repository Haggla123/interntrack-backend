// Controllers/supervisorController.js
const User = require('../models/User');

// ── GET /api/supervisors ─────────────────────────────────────────
// Returns academic and industrial supervisors for the assignment UI
const getSupervisors = async (req, res) => {
  try {
    const { role } = req.query; // optional filter: ?role=academic | ?role=industrial

    const filter = {
      role: role
        ? role
        : { $in: ['academic', 'industrial'] },
      isActive: true,
    };

    const supervisors = await User.find(filter)
      .select('-password')
      .sort({ name: 1 });

    // Attach student count for load % badge shown in AdminDashboard
    const studentCounts = await User.aggregate([
      { $match: { role: 'student', isActive: true, academicSupervisor: { $ne: null } } },
      { $group: { _id: '$academicSupervisor', count: { $sum: 1 } } },
    ]);

    const countMap = {};
    studentCounts.forEach(({ _id, count }) => {
      countMap[_id.toString()] = count;
    });

    const withLoad = supervisors.map(s => ({
      ...s.toObject(),
      studentCount: countMap[s._id.toString()] || 0,
    }));

    res.status(200).json({ success: true, data: withLoad });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── PUT /api/supervisors/:id/assign — assign a student to a supervisor ─
const assignSupervisor = async (req, res) => {
  try {
    const { studentId } = req.body;
    if (!studentId) return res.status(400).json({ message: 'studentId is required.' });

    const supervisor = await User.findById(req.params.id);
    if (!supervisor || !['academic', 'industrial'].includes(supervisor.role)) {
      return res.status(404).json({ message: 'Supervisor not found.' });
    }

    const updateField = supervisor.role === 'industrial'
      ? { industrialSupervisor: req.params.id }
      : { academicSupervisor:  req.params.id };

    const student = await User.findByIdAndUpdate(
      studentId,
      updateField,
      { new: true }
    ).select('-password');

    if (!student) return res.status(404).json({ message: 'Student not found.' });

    res.status(200).json({ success: true, data: student });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── PUT /api/supervisors/:id — admin edits a supervisor ──────────
async function updateSupervisor(req, res) {
  try {
    
    const allowed = ['name', 'email', 'department', 'staffId', 'phone', 'companyOrg'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    const sup = await User.findOneAndUpdate(
      { _id: req.params.id, role: { $in: ['academic', 'industrial'] } },
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    if (!sup) return res.status(404).json({ message: 'Supervisor not found.' });
    res.status(200).json({ success: true, data: sup });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// ── DELETE /api/supervisors/:id — admin soft-deletes a supervisor ─
async function deleteSupervisor(req, res) {
  try {
    const sup = await User.findOne({
      _id: req.params.id,
      role: { $in: ['academic', 'industrial'] },
    });
    if (!sup) return res.status(404).json({ message: 'Supervisor not found.' });

    sup.isActive = false;
    await sup.save();

    res.status(200).json({ success: true, message: `${sup.name} has been deactivated.` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

module.exports = { getSupervisors, assignSupervisor, updateSupervisor, deleteSupervisor };