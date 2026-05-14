// Controllers/settingsController.js
const Settings = require('../models/Settings');

// ── GET /api/settings ────────────────────────────────────────────
const getSettings = async (req, res) => {
  try {
    const settings = await Settings.getOrCreate();
    res.status(200).json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── PUT /api/settings ─────────────────────────────────────────────
// Admin saves the full settings form in one call
const updateSettings = async (req, res) => {
  try {
    const allowed = [
      'academicYear', 'semester', 'portalOpenDate', 'submissionDeadline', 'totalWeeks',
      'weightIndustrial', 'weightAcademic', 'weightLogbook',
      'geofenceEnabled', 'geofenceRadius', 'attendanceMode', 'strictTimeWindow',
      'allowSelfPlacement', 'industrialPortalEnabled',
      'departments', 'activityCategories',
    ];

    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    updates.updatedBy = req.user._id;

    // Validate weights sum to 100
    const settings = await Settings.getOrCreate();
    const wi = updates.weightIndustrial ?? settings.weightIndustrial;
    const wa = updates.weightAcademic   ?? settings.weightAcademic;
    const wl = updates.weightLogbook    ?? settings.weightLogbook;
    if (Math.abs(wi + wa + wl - 100) > 0.01) {
      return res.status(400).json({ message: `Grade weights must sum to 100 (currently ${wi + wa + wl}).` });
    }

    const updated = await Settings.findOneAndUpdate(
      {},
      updates,
      { new: true, upsert: true, runValidators: true }
    );

    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── POST /api/settings/departments — add a department ───────────
const addDepartment = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Department name is required.' });
    }

    const settings = await Settings.getOrCreate();
    const trimmed = name.trim();

    if (settings.departments.includes(trimmed)) {
      return res.status(400).json({ message: 'Department already exists.' });
    }

    settings.departments.push(trimmed);
    settings.updatedBy = req.user._id;
    await settings.save();

    res.status(200).json({ success: true, data: settings.departments });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── DELETE /api/settings/departments — remove a department ──────
const removeDepartment = async (req, res) => {
  try {
    const name = req.params.name || req.body.name;
    if (!name) return res.status(400).json({ message: 'Department name is required.' });

    const settings = await Settings.getOrCreate();
    settings.departments = settings.departments.filter(d => d !== name);
    settings.updatedBy = req.user._id;
    await settings.save();

    res.status(200).json({ success: true, data: settings.departments });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getSettings, updateSettings, addDepartment, removeDepartment };
