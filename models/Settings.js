
const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema(
  {
    // ── Internship Season ────────────────────────────────────────
    academicYear:       { type: String,  default: '2025/2026' },
    semester:           { type: String,  default: 'Semester 1' },
    portalOpenDate:     { type: Date,    default: null },
    submissionDeadline: { type: Date,    default: null },
    totalWeeks:         { type: Number,  default: 6 },

    // ── Grading Weights (must sum to 100) ────────────────────────
    weightIndustrial:   { type: Number,  default: 40 },
    weightAcademic:     { type: Number,  default: 30 },
    weightLogbook:      { type: Number,  default: 30 },

    // ── Geofencing ───────────────────────────────────────────────
    geofenceEnabled:    { type: Boolean, default: true },  // master switch
    geofenceRadius:     { type: Number,  default: 150 },  // metres
    attendanceMode: {
      type: String,
      enum: ['gps+timestamp', 'gps+selfie', 'manual'],
      default: 'gps+timestamp',
    },
    strictTimeWindow:   { type: Boolean, default: true },

    // ── Portal Access Flags ──────────────────────────────────────
    allowSelfPlacement:       { type: Boolean, default: true },
    industrialPortalEnabled:  { type: Boolean, default: true },

    // ── Activity Categories (for checkbox-based daily logging) ───
    activityCategories: {
      type: [{
        key:   { type: String, required: true },
        label: { type: String, required: true },
        group: { type: String, required: true },
        _id:   false,
      }],
      default: [
        // Technical Tasks
        { key: 'coding',             label: 'Coding / Programming',     group: 'Technical Tasks' },
        { key: 'database',           label: 'Database Work',            group: 'Technical Tasks' },
        { key: 'testing',            label: 'Testing / Debugging',      group: 'Technical Tasks' },
        { key: 'sysadmin',           label: 'System Administration',    group: 'Technical Tasks' },
        { key: 'hardware',           label: 'Hardware Maintenance',     group: 'Technical Tasks' },
        { key: 'networking',         label: 'Networking / IT Support',  group: 'Technical Tasks' },
        // Office & Admin
        { key: 'report_writing',     label: 'Report Writing',           group: 'Office & Admin' },
        { key: 'data_entry',         label: 'Data Entry',               group: 'Office & Admin' },
        { key: 'filing',             label: 'Filing / Documentation',   group: 'Office & Admin' },
        { key: 'meetings',           label: 'Meetings / Presentations', group: 'Office & Admin' },
        // Learning & Development
        { key: 'training',           label: 'Training Session',         group: 'Learning & Development' },
        { key: 'mentorship',         label: 'Mentorship / Shadowing',   group: 'Learning & Development' },
        { key: 'self_study',         label: 'Self-Study / Research',    group: 'Learning & Development' },
        { key: 'workshop',           label: 'Workshop Attendance',      group: 'Learning & Development' },
        // Collaboration
        { key: 'team_meeting',       label: 'Team Collaboration',       group: 'Collaboration' },
        { key: 'client_interaction', label: 'Client Interaction',       group: 'Collaboration' },
        { key: 'cross_dept',         label: 'Cross-Department Work',    group: 'Collaboration' },
        // Field Work
        { key: 'site_visit',         label: 'Site Visit',               group: 'Field Work' },
        { key: 'equipment_setup',    label: 'Equipment Setup',          group: 'Field Work' },
        { key: 'surveying',          label: 'Surveying / Inspection',   group: 'Field Work' },
      ],
    },

    // ── Departments ──────────────────────────────────────────────
    departments: {
      type: [String],
      default: ['Computer Science', 'ITDS', 'Mechanical Engineering', 'Civil Engineering'],
    },

    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

// Convenience: always returns the single settings document, creating it if absent
SettingsSchema.statics.getOrCreate = async function () {
  let doc = await this.findOne();
  if (!doc) doc = await this.create({});
  return doc;
};

module.exports = mongoose.models.Settings || mongoose.model('Settings', SettingsSchema);