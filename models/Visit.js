// models/Visit.js
const mongoose = require('mongoose');

const VisitSchema = new mongoose.Schema(
  {
    // The academic supervisor who scheduled the visit
    supervisor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // The student being visited
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    studentName: { type: String, default: '' },
    company:     { type: String, default: '' },
    location:    { type: String, default: '' },

    date: {
      type: Date,
      required: [true, 'Visit date is required'],
    },
    time: {
      type: String,
      default: '',
    },

    // 'Scheduled' | 'Completed' | 'Cancelled'
    status: {
      type: String,
      enum: ['Scheduled', 'Completed', 'Cancelled'],
      default: 'Scheduled',
    },
    notes: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Visit || mongoose.model('Visit', VisitSchema);
