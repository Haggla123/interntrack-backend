const mongoose = require('mongoose');

const LogSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      default: null,
    },
    companyName: {
      type: String,
      default: '',
    },
    date: {
      type: Date,
      default: Date.now,
    },
    // ── New: checkbox-based activities ────────────────────────────
    // Array of activity-category keys selected by the student
    activities: {
      type: [String],
      default: [],
    },
    // Optional short note for additional context
    notes: {
      type: String,
      default: '',
      maxlength: [300, 'Notes cannot exceed 300 characters'],
    },
    // ── Legacy: free-text activity (kept for backward compat) ───
    activity: {
      type: String,
      default: '',
    },
    skills: {
      type: String,
      default: '',
    },
    // week is stored directly — calculated by the backend at submission time
    // so the frontend can always group by log.week reliably
    week: {
      type: Number,
      default: 1,
    },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected'],
      default: 'Pending',
    },
    supervisorNote: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

// Index to speed up per-student queries (very common)
LogSchema.index({ student: 1, date: -1 });

module.exports = mongoose.models.Log || mongoose.model('Log', LogSchema);