const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    unread: {
      type: Boolean,
      default: true,
    },
    category: {
      type: String,
      default: 'system',
      trim: true,
    },
    relatedPage: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { timestamps: true }
);

NotificationSchema.index({ recipient: 1, createdAt: -1 });

module.exports = mongoose.models.Notification || mongoose.model('Notification', NotificationSchema);
