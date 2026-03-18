const User       = require('../models/User');
const nodemailer = require('nodemailer');

// ── POST /api/broadcast ─────────────────────────────────────────
// Admin only. Sends a personalised email to every active student.
// Body: { subject, message, targetRole? }
// The message may include {name} which gets replaced per recipient.
const broadcast = async (req, res) => {
  try {
    const { subject, message, targetRole = 'student' } = req.body;

    if (!subject?.trim() || !message?.trim()) {
      return res.status(400).json({ message: 'Subject and message body are required.' });
    }

    // Fetch all active recipients for the target role
    const recipients = await User.find({ role: targetRole, isActive: true }).select('name email');

    if (recipients.length === 0) {
      return res.status(404).json({ message: `No active ${targetRole} accounts found.` });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });

    const results = { sent: 0, failed: 0, errors: [] };

    const sendOne = async (recipient) => {
      const personalised = message.replace(/\{name\}/gi, recipient.name.split(' ')[0]);
      const htmlBody = `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 24px; border-radius: 10px;">
          <h2 style="color: #2c5282; margin-bottom: 4px;">University of Energy and Natural Resources</h2>
          <p style="color: #94a3b8; font-size: 13px; margin-top: 0;">UENR InternTrack System</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 16px 0;" />
          <div style="white-space: pre-line; color: #334155; line-height: 1.7;">${personalised}</div>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 24px 0 16px;" />
          <footer style="font-size: 11px; color: #94a3b8; text-align: center;">
            &copy; 2026 UENR InternTrack System | Sunyani, Ghana
            <br/>This is an automated notification — please do not reply to this email.
          </footer>
        </div>
      `;
      try {
        await transporter.sendMail({
          from:    `"UENR InternTrack" <${process.env.EMAIL_USER}>`,
          to:      recipient.email,
          subject: subject.trim(),
          html:    htmlBody,
        });
        results.sent++;
      } catch (mailErr) {
        results.failed++;
        results.errors.push({ email: recipient.email, error: mailErr.message });
      }
    };

    // Send in batches of 10 concurrently — avoids Gmail SMTP throttling
    // while being ~10× faster than a sequential loop for large cohorts.
    const BATCH_SIZE = 10;
    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      await Promise.allSettled(recipients.slice(i, i + BATCH_SIZE).map(sendOne));
    }

    const statusCode = results.sent > 0 ? 200 : 500;
    res.status(statusCode).json({
      message: `Broadcast complete. ${results.sent} sent, ${results.failed} failed.`,
      ...results,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { broadcast };