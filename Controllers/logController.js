// Controllers/logController.js
const Log      = require('../models/Log');
const Settings = require('../models/Settings');
const Company  = require('../models/Company');
const { canAccessStudent, requireStudentAccess } = require('../utils/accessControl');

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
    const { activities, notes, activity, skills, companyName, companyId } = req.body;

    // Support both new checkbox format and legacy text format
    const hasCheckboxes = Array.isArray(activities) && activities.length > 0;
    const hasLegacyText = activity && activity.trim().length >= 20;

    if (!hasCheckboxes && !hasLegacyText) {
      return res.status(400).json({
        message: hasCheckboxes === false && activities
          ? 'Please select at least one activity.'
          : 'Please select at least one activity or write at least 20 characters.',
      });
    }

    // Guard: only placed students can submit logs
    if (req.user.placementStatus !== 'Active') {
      return res.status(403).json({ message: 'You must be placed at a company before submitting log entries.' });
    }

    let hasIndustrialContact = Boolean(req.user.industrialSupervisor);
    if (!hasIndustrialContact && req.user.companyId) {
      const company = await Company.findById(req.user.companyId)
        .select('manager supervisorName supervisorEmail');
      hasIndustrialContact = Boolean(
        company?.manager || company?.supervisorName || company?.supervisorEmail
      );
    }

    if (!req.user.academicSupervisor || !hasIndustrialContact) {
      return res.status(403).json({
        message: 'Your academic supervisor and industrial supervisor must be assigned before you can submit log entries.',
      });
    }

    const now = new Date();

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

    // Build a human-readable activity string from checkbox keys for backward compat
    let activityText = '';
    if (hasCheckboxes) {
      // Resolve keys to labels using the settings category list
      const catMap = {};
      (cfg.activityCategories || []).forEach(c => { catMap[c.key] = c.label; });
      const labels = activities.map(k => catMap[k] || k);
      activityText = labels.join(', ');
      if (notes && notes.trim()) activityText += ` — ${notes.trim()}`;
    } else {
      activityText = activity.trim();
    }

    const log = await Log.create({
      student:     req.user._id,
      company:     resolvedCompanyId,
      companyName: companyName || '',
      activities:  hasCheckboxes ? activities : [],
      notes:       notes ? notes.trim() : '',
      activity:    activityText,
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
    const student = await requireStudentAccess(req, res, req.params.studentId);
    if (!student) return;

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
      const User = require('../models/User');
      const myStudents = await User.find({
        role: 'student',
        industrialSupervisor: req.user._id,
        isActive: true,
      }).select('_id');

      if (myStudents.length === 0) {
        return res.status(200).json({ success: true, data: [] });
      }
      filter.student = { $in: myStudents.map(s => s._id) };
    } else if (req.user.role === 'company_manager') {
      if (req.user.companyId) {
        filter.company = req.user.companyId;
      } else {
        return res.status(200).json({ success: true, data: [] });
      }
    }

    const logs = await Log.find(filter)
      .sort({ date: -1 })
      .populate('student', 'name indexNumber department');
    res.status(200).json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getLogs = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied.' });
    }
    const limit = Math.min(500, parseInt(req.query.limit) || 500);
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const skip  = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      Log.find()
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .populate('student', 'name indexNumber department'),
      Log.countDocuments(),
    ]);
    res.status(200).json({ success: true, data: logs, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── PUT /api/logs/:id/approve ────────────────────────────────────
const approveLog = async (req, res) => {
  try {
    const log = await Log.findById(req.params.id).populate('student', '_id role academicSupervisor industrialSupervisor companyId');
    if (!log) return res.status(404).json({ message: 'Log not found.' });
    if (!canAccessStudent(req.user, log.student)) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    log.status = 'Approved';
    log.supervisorNote = req.body.note || '';
    await log.save();
    res.status(200).json({ success: true, data: log });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── PUT /api/logs/:id/reject ─────────────────────────────────────
const rejectLog = async (req, res) => {
  try {
    const log = await Log.findById(req.params.id).populate('student', '_id role academicSupervisor industrialSupervisor companyId');
    if (!log) return res.status(404).json({ message: 'Log not found.' });
    if (!canAccessStudent(req.user, log.student)) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    log.status = 'Rejected';
    log.supervisorNote = req.body.note || '';
    await log.save();
    res.status(200).json({ success: true, data: log });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  submitLog, getMyLogs, getStudentLogs, getPendingLogs, getLogs, approveLog, rejectLog,
};
