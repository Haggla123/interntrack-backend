// Controllers/visitController.js
const Visit = require('../models/Visit');
const User  = require('../models/User');
const { canAccessStudent } = require('../utils/accessControl');

// ── POST /api/visits — academic supervisor schedules a visit ─────
const scheduleVisit = async (req, res) => {
  try {
    const { studentId, date, time, company, location, notes } = req.body;

    if (!studentId) return res.status(400).json({ message: 'studentId is required.' });
    if (!date)      return res.status(400).json({ message: 'Visit date is required.' });

    const student = await User.findById(studentId).populate('companyId', 'name location');
    if (!student) return res.status(404).json({ message: 'Student not found.' });
    if (!canAccessStudent(req.user, student)) {
      return res.status(403).json({ message: 'You can only schedule visits for students assigned to you.' });
    }

    const visit = await Visit.create({
      supervisor:  req.user._id,
      student:     studentId,
      studentName: student.name,
      company:     company  || student.companyName || student.companyId?.name || '',
      location:    location || student.companyId?.location || '',
      date:        new Date(date),
      time:        time  || '',
      notes:       notes || '',
    });

    await visit.populate('student', 'name indexNumber');

    res.status(201).json({ success: true, data: visit });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET /api/visits — returns visits for the logged-in supervisor ─
const getVisits = async (req, res) => {
  try {
    let filter = {};

    if (req.user.role === 'academic') {
      // Academic supervisors only see their own scheduled visits
      filter.supervisor = req.user._id;
    } else if (req.user.role === 'student') {
      // Students can see visits scheduled for them
      filter.student = req.user._id;
    } else if (req.user.role === 'company_manager') {
      if (!req.user.companyId) return res.status(200).json({ success: true, data: [] });
      const companyStudents = await User.find({
        companyId: req.user.companyId, role: 'student', isActive: true,
      }).select('_id');
      filter.student = { $in: companyStudents.map(s => s._id) };
    } else if (req.user.role === 'industrial') {
      const byDirect = await User.find({
        industrialSupervisor: req.user._id, role: 'student', isActive: true,
      }).select('_id');
      filter.student = { $in: byDirect.map(s => s._id) };
    }
    // Admins see all visits

    if (req.query.status) filter.status = req.query.status;

    const visits = await Visit.find(filter)
      .populate({ path: 'student', select: 'name indexNumber companyName companyId', populate: { path: 'companyId', select: 'name location' } })
      .populate('supervisor', 'name')
      .sort({ date: 1 }); // ascending — upcoming first

    // Enrich visits that have empty location/company with live student data
    const enriched = visits.map(v => {
      const vObj = v.toObject();
      if (!vObj.location && v.student?.companyId) {
        vObj.location = v.student.companyId.location || '';
      }
      if (!vObj.company && v.student) {
        vObj.company = v.student.companyName || v.student.companyId?.name || '';
      }
      return vObj;
    });

    res.status(200).json({ success: true, data: enriched });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── PUT /api/visits/:id — update visit status or notes ───────────
const updateVisit = async (req, res) => {
  try {
    const { status, notes, time, date } = req.body;

    const visit = await Visit.findById(req.params.id);
    if (!visit) return res.status(404).json({ message: 'Visit not found.' });

    // Only the scheduling supervisor or admin can update
    const isOwner = visit.supervisor.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    if (status !== undefined) visit.status = status;
    if (notes  !== undefined) visit.notes  = notes;
    if (time   !== undefined) visit.time   = time;
    if (date   !== undefined) visit.date   = new Date(date);

    await visit.save();
    await visit.populate('student', 'name indexNumber');

    res.status(200).json({ success: true, data: visit });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { scheduleVisit, getVisits, updateVisit };
