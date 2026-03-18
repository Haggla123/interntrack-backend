const mongoose = require('mongoose');


const logEntrySchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  weekNumber: { type: Number, required: true },   // which week of the internship
  day:        { type: String, required: true },   // "Monday", "Tuesday", etc.
  date:       { type: String, required: true },   // "Feb 23" display string

  activity: { type: String, required: true, minlength: 20 },
  skills:   { type: String, default: 'General' },

  // Verified by the student's GPS at submission time
  locationVerified: { type: Boolean, default: false },
  submittedLat:     { type: Number },
  submittedLong:    { type: Number },

  // Industrial supervisor review
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending',
  },
  reviewedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewNotes: { type: String },

}, { timestamps: true });

module.exports = mongoose.model('LogEntry', logEntrySchema);
