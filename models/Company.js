// models/Company.js
const mongoose = require('mongoose');

const CompanySchema = new mongoose.Schema(
  {
    name:     { type: String, required: true, trim: true },
    category: { type: String, default: 'Engineering', trim: true },
    location: { type: String, default: '', trim: true },
    slots:    { type: Number, default: 0, min: 0 },
    lat:      { type: Number, default: null },
    long:     { type: Number, default: null },
    radius:   { type: Number, default: 150 },
    isActive: { type: Boolean, default: true },

    // Company manager / HR who assigns interns to supervisors
    manager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    // All industrial supervisors at this company
    supervisors: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],

    // Legacy single industrial supervisor (backward compat)
    supervisorName:  { type: String, default: '', trim: true },
    supervisorEmail: { type: String, default: '', trim: true },
    supervisorPhone: { type: String, default: '', trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Company || mongoose.model('Company', CompanySchema);
