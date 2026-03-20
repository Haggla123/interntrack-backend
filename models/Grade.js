// models/Grade.js
const mongoose = require('mongoose');

const GradeSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    
    // Who submitted this grade
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    // 'academic' | 'industrial' | 'report'
    type: {
      type: String,
      enum: ['academic', 'industrial', 'report'],
      default: 'academic',
    },
    grade: {
      type: String,
      enum: ['A', 'B+', 'B', 'C+', 'C', 'D', 'F'],
      required: [true, 'Grade is required'],
    },

    // Numeric score (0–100) used by industrial supervisors.

    score: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    comments: {
      type: String,
      default: '',
      trim: true,
    },
    // ── Breakdown scores — 7 official UENR criteria (each /15 or /10) ────
    // Stored as the raw mark out of the criterion's maximum,
    // NOT normalised to /10, so the academic supervisor sees the real values.
    attendance:         { type: Number, min: 0, max: 15, default: null },
    punctuality:        { type: Number, min: 0, max: 15, default: null },
    cooperation:        { type: Number, min: 0, max: 10, default: null },
    aptitudeForLearning:{ type: Number, min: 0, max: 15, default: null },
    understandingOfJob: { type: Number, min: 0, max: 15, default: null },
    safetyAdherence:    { type: Number, min: 0, max: 15, default: null },
    workIndependently:  { type: Number, min: 0, max: 15, default: null },
  },
  { timestamps: true }
);

// Only one grade record per student per type
GradeSchema.index({ student: 1, type: 1 }, { unique: true });

module.exports = mongoose.models.Grade || mongoose.model('Grade', GradeSchema);