// models/Settings.js
// Single-document config — there is only ever ONE settings record.
// Use Settings.getOrCreate() to safely read/upsert.
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