// models/Document.js
const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema(
  {
    // Who uploaded it
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // The student this document belongs to (for final reports)
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    // 'final-report' | 'attachment-letter' | 'offer-letter' | 'other'
    type: {
      type: String,
      enum: ['final-report', 'attachment-letter', 'offer-letter', 'other'],
      default: 'other',
    },
    filename: {
      type: String,
      required: true,
      trim: true,
    },
    // Base64-encoded file data
    storedName: { type: String, default: '' },  // filename on disk in /uploads/
    fileSize: {
      type: Number,
      default: 0,
    },
    mimeType: {
      type: String,
      default: 'application/pdf',
    },
    // Admin-visible only flag (e.g. for official UENR letters)
    isPublic: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Document || mongoose.model('Document', DocumentSchema);