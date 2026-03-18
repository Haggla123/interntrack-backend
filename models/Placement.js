// models/Placement.js
const mongoose = require('mongoose');

const PlacementSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Student-reported company details (self-placement flow)
    companyName:     { type: String, required: true, trim: true },
    supervisorName:  { type: String, default: '', trim: true },
    supervisorEmail: { type: String, default: '', trim: true },
    supervisorPhone: { type: String, default: '', trim: true },

    // GPS coordinates captured by student at the office
    lat:  { type: Number, default: null },
    long: { type: Number, default: null },

    // Admin review status
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Declined'],
      default: 'Pending',
    },
    adminNote: {
      type: String,
      default: '',
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },

    // Link to Company record once approved
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Placement || mongoose.model('Placement', PlacementSchema);
