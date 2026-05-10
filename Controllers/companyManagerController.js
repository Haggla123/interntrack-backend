// Controllers/companyManagerController.js
const User    = require('../models/User');
const Company = require('../models/Company');

// ── GET /api/company-manager/company ─────────────────────────────
// Returns the company this manager is linked to
const getMyCompany = async (req, res) => {
  try {
    const company = await Company.findOne({ manager: req.user._id })
      .populate('supervisors', 'name email phone companyOrg')
      .populate('manager', 'name email');

    if (!company) {
      return res.status(404).json({ message: 'No company linked to your account.' });
    }

    res.status(200).json({ success: true, data: company });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET /api/company-manager/interns ─────────────────────────────
// List all interns placed at the manager's company
const getInterns = async (req, res) => {
  try {
    const company = await Company.findOne({ manager: req.user._id });
    if (!company) {
      return res.status(404).json({ message: 'No company linked to your account.' });
    }

    const interns = await User.find({
      role: 'student',
      companyId: company._id,
      placementStatus: 'Active',
      isActive: true,
    })
      .select('name email indexNumber department industrialSupervisor companyName')
      .populate('industrialSupervisor', 'name email phone companyOrg');

    res.status(200).json({ success: true, data: interns });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET /api/company-manager/supervisors ─────────────────────────
// List all industrial supervisors at the manager's company
const getSupervisors = async (req, res) => {
  try {
    const company = await Company.findOne({ manager: req.user._id });
    if (!company) {
      return res.status(404).json({ message: 'No company linked to your account.' });
    }

    const supervisors = await User.find({
      role: 'industrial',
      _id: { $in: company.supervisors },
      isActive: true,
    }).select('name email phone companyOrg');

    res.status(200).json({ success: true, data: supervisors });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── PUT /api/company-manager/assign ──────────────────────────────
// Assign intern(s) to a supervisor
// Body: { assignments: [{ internId, supervisorId }] }
const assignInterns = async (req, res) => {
  try {
    const { assignments } = req.body;
    if (!Array.isArray(assignments) || assignments.length === 0) {
      return res.status(400).json({ message: 'Provide an array of assignments.' });
    }

    const company = await Company.findOne({ manager: req.user._id });
    if (!company) {
      return res.status(404).json({ message: 'No company linked to your account.' });
    }

    // Validate all supervisors belong to this company
    const validSupIds = company.supervisors.map(s => s.toString());

    const results = [];
    for (const { internId, supervisorId } of assignments) {
      // Allow null/empty supervisorId to unassign
      if (supervisorId && !validSupIds.includes(supervisorId)) {
        results.push({ internId, error: 'Supervisor not part of this company' });
        continue;
      }

      const intern = await User.findOneAndUpdate(
        {
          _id: internId,
          role: 'student',
          companyId: company._id,
          placementStatus: 'Active',
        },
        { industrialSupervisor: supervisorId || null },
        { new: true }
      ).select('name indexNumber industrialSupervisor');

      if (!intern) {
        results.push({ internId, error: 'Intern not found at this company' });
      } else {
        results.push({ internId, success: true, name: intern.name });
      }
    }

    res.status(200).json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET /api/company-manager/stats ───────────────────────────────
// Dashboard statistics for the company manager
const getStats = async (req, res) => {
  try {
    const company = await Company.findOne({ manager: req.user._id });
    if (!company) {
      return res.status(404).json({ message: 'No company linked to your account.' });
    }

    const [totalInterns, assignedInterns, supervisorCount] = await Promise.all([
      User.countDocuments({
        role: 'student',
        companyId: company._id,
        placementStatus: 'Active',
        isActive: true,
      }),
      User.countDocuments({
        role: 'student',
        companyId: company._id,
        placementStatus: 'Active',
        isActive: true,
        industrialSupervisor: { $ne: null },
      }),
      company.supervisors.length,
    ]);

    const Log = require('../models/Log');
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [logsThisWeek, pendingLogs] = await Promise.all([
      Log.countDocuments({
        company: company._id,
        date: { $gte: weekAgo },
      }),
      Log.countDocuments({
        company: company._id,
        status: 'Pending',
      }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalInterns,
        assignedInterns,
        unassignedInterns: totalInterns - assignedInterns,
        supervisorCount,
        logsThisWeek,
        pendingLogs,
        companyName: company.name,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── POST /api/company-manager/supervisors ───────────────────────
// Create a new industrial supervisor for this company
const createSupervisor = async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    if (!name || !email) {
      return res.status(400).json({ message: 'Name and email are required.' });
    }

    const company = await Company.findOne({ manager: req.user._id });
    if (!company) {
      return res.status(404).json({ message: 'No company linked to your account.' });
    }

    // Check if user already exists
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'A user with this email already exists.' });
    }

    // Create temp password
    const tempPassword = require('crypto').randomBytes(4).toString('hex');

    const supervisor = await User.create({
      name,
      email,
      phone: phone || '',
      password: 'UENR-' + tempPassword,
      role: 'industrial',
      companyId: company._id,
      companyOrg: company.name,
      needsPasswordChange: true,
    });

    // Add to company supervisors array
    company.supervisors.push(supervisor._id);
    await company.save();

    res.status(201).json({
      success: true,
      data: supervisor,
      tempPassword: 'UENR-' + tempPassword
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── PUT /api/cm/supervisors/:id ──────────────────────────────────
// Edit a supervisor's details
const updateSupervisor = async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    const company = await Company.findOne({ manager: req.user._id });
    if (!company) return res.status(404).json({ message: 'Company not found.' });

    // Ensure the supervisor belongs to this company
    if (!company.supervisors.some(id => id.toString() === req.params.id)) {
      return res.status(403).json({ message: 'You can only manage supervisors in your company.' });
    }

    const supervisor = await User.findByIdAndUpdate(
      req.params.id,
      { name, email, phone },
      { new: true, runValidators: true }
    ).select('name email phone companyOrg');

    res.status(200).json({ success: true, data: supervisor });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── DELETE /api/cm/supervisors/:id ───────────────────────────────
// Remove a supervisor from the company
const deleteSupervisor = async (req, res) => {
  try {
    const company = await Company.findOne({ manager: req.user._id });
    if (!company) return res.status(404).json({ message: 'Company not found.' });

    // Ensure the supervisor belongs to this company
    if (!company.supervisors.some(id => id.toString() === req.params.id)) {
      return res.status(403).json({ message: 'You can only manage supervisors in your company.' });
    }

    // Remove from company supervisors array
    company.supervisors = company.supervisors.filter(id => id.toString() !== req.params.id);
    await company.save();

    // Deactivate the user account (standard practice instead of full delete)
    await User.findByIdAndUpdate(req.params.id, { isActive: false, companyId: null });
    await User.updateMany(
      {
        role: 'student',
        companyId: company._id,
        industrialSupervisor: req.params.id,
      },
      { $set: { industrialSupervisor: null } }
    );

    res.status(200).json({ success: true, message: 'Supervisor removed from company.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { 
  getMyCompany, 
  getInterns, 
  getSupervisors, 
  assignInterns, 
  getStats,
  createSupervisor,
  updateSupervisor,
  deleteSupervisor
};
