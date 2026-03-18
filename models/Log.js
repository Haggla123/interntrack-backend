// models/Log.js
// This is the ONE log model. LogEntry.js was a duplicate — delete it.
// All controllers and seed.js should import from this file.
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
    activity: {
      type: String,
      required: [true, 'Activity description is required'],
      minlength: [20, 'Please write at least 20 characters'],
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