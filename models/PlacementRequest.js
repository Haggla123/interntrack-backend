const mongoose = require('mongoose');

// Created when a student submits "Report My Placement" in AttachmentLetters.js.
// Sits in a queue in the Admin portal until approved or declined.

const placementRequestSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Company info from the student's form (not yet a verified Company document)
  companyName:     { type: String, required: true },
  industry:        { type: String },
  supervisorEmail: { type: String, required: true },
  supervisorPhone: { type: String },

  // GPS captured by the student's browser at their office location
  lat:  { type: Number, required: true },
  long: { type: Number, required: true },

  status: {
    type: String,
    enum: ['pending', 'approved', 'declined'],
    default: 'pending',
  },

  // Set when admin approves: links to the created/matched Company document
  assignedCompany:    { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  // Set when admin approves: which lecturer supervises this student
  assignedLecturer:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  adminNotes: { type: String },

}, { timestamps: true });

module.exports = mongoose.model('PlacementRequest', placementRequestSchema);
