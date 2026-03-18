// Controllers/logController.js
const Log      = require('../models/Log');
const Settings = require('../models/Settings');

const isWeekday = (date) => {
  const day = date.getDay();
  return day >= 1 && day <= 5;
};

const toDateOnly = (date) => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

// Week number based on APPROVED logs only (groups of 5 = 1 week).
// Counting all logs (including Pending/Rejected) inflated the week number.
const getWeekNumber = (existingLogs) => {
  const approved = existingLogs.filter(l => l.status === 'Approved');
  const sorted   = [...approved].sort((a, b) => new Date(a.date) - new Date(b.date));
  return Math.floor(sorted.length / 5) + 1;
};

// ── POST /api/logs ───────────────────────────────────────────────
const submitLog = async (req, res) => {
  try {
    const { activity, skills, companyName, companyId } = req.body;

    if (!activity || activity.trim().length < 20) {
      return res.status(400).json({ message: 'Activity must be at least 20 characters.' });
    }

    // Guard: only placed students can submit logs
    if (req.user.placementStatus !== 'Active') {
      return res.status(403).json({ message: 'You must be placed at a company before submitting log entries.' });
    }

    const now = new Date();

    if (!isWeekday(now)) {
      return res.status(400).json({
        message: 'Logs can only be submitted on weekdays (Monday – Friday).',
      });
    }

    const cfg = await Settings.getOrCreate();
    if (cfg.strictTimeWindow) {
      const hour = now.getUTCHours();
      if (hour < 7 || hour >= 18) {
        return res.status(400).json({
          message: 'Logs can only be submitted between 07:00 and 18:00 GMT.',
        });
      }
    }

    const todayStart = toDateOnly(now);
    const todayEnd   = new Date(todayStart);
    todayEnd.setUTCHours(23, 59, 59, 999);

    const alreadyToday = await Log.findOne({
      student: req.user._id,
      date: { $gte: todayStart, $lte: todayEnd },
    });

    if (alreadyToday) {
      return res.status(400).json({
        message: 'You have already submitted a log for today. Come back tomorrow.',
      });
    }

    const existingLogs     = await Log.find({ student: req.user._id });
    const week             = getWeekNumber(existingLogs);
    const resolvedCompanyId = companyId || req.user.companyId || null;

    const log = await Log.create({
      student:     req.user._id,
      company:     resolvedCompanyId,
      companyName: companyName || '',
      activity:    activity.trim(),
      skills:      skills ? skills.trim() : '',
      week,
      date:        now,
    });

    res.status(201).json({ success: true, data: log });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET /api/logs/me ─────────────────────────────────────────────
const getMyLogs = async (req, res) => {
  try {
    const logs = await Log.find({ student: req.user._id }).sort({ date: -1 });
    res.status(200).json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET /api/logs/student/:studentId ────────────────────────────
const getStudentLogs = async (req, res) => {
  try {
    const limit = Math.min(500, parseInt(req.query.limit) || 500);
    const page  = Math.max(1,   parseInt(req.query.page)  || 1);
    const skip  = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      Log.find({ student: req.params.studentId })
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .populate('student', 'name indexNumber'),
      Log.countDocuments({ student: req.params.studentId }),
    ]);
    res.status(200).json({ success: true, data: logs, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET /api/logs/pending ────────────────────────────────────────
const getPendingLogs = async (req, res) => {
  try {
    const filter = { status: 'Pending' };

    if (req.user.role === 'industrial') {
      // Use $or: a log is visible if it belongs to a student linked by
      // company OR by direct industrialSupervisor assignment.
      // Old code used if/else — if companyId was null, it fell back to
      // industrialSupervisor only, but missed students linked by company.
      // If companyId was set, it checked only company and missed direct links.
      const User = require('../models/User');
      const orConditions = [];

      if (req.user.companyId) {
        orConditions.push({ company: req.user.companyId });
      }

      const directStudents = await User.find({
        role: 'student',
        industrialSupervisor: req.user._id,
        isActive: true,
      }).select('_id');

      if (directStudents.length > 0) {
        orConditions.push({ student: { $in: directStudents.map(s => s._id) } });
      }

      if (orConditions.length === 0) {
        return res.status(200).json({ success: true, data: [] });
      }

      filter.$or = orConditions;
    }

    const logs = await Log.find(filter)
      .sort({ date: -1 })
      .populate('student', 'name indexNumber department');
    res.status(200).json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── PUT /api/logs/:id/approve ────────────────────────────────────
const approveLog = async (req, res) => {
  try {
    const log = await Log.findByIdAndUpdate(
      req.params.id,
      { status: 'Approved', supervisorNote: req.body.note || '' },
      { new: true }
    );
    if (!log) return res.status(404).json({ message: 'Log not found.' });
    res.status(200).json({ success: true, data: log });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── PUT /api/logs/:id/reject ─────────────────────────────────────
const rejectLog = async (req, res) => {
  try {
    const log = await Log.findByIdAndUpdate(
      req.params.id,
      { status: 'Rejected', supervisorNote: req.body.note || '' },
      { new: true }
    );
    if (!log) return res.status(404).json({ message: 'Log not found.' });
    res.status(200).json({ success: true, data: log });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  submitLog, getMyLogs, getStudentLogs, getPendingLogs, approveLog, rejectLog,
};