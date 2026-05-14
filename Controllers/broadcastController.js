const User = require('../models/User');
const Notification = require('../models/Notification');
const { escapeHtml } = require('../utils/security');

const sendEmail = async (to, subject, html) => {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': process.env.BREVO_API_KEY },
    body: JSON.stringify({
      sender:      { name: 'UENR InternTrack', email: process.env.MAIL_ADDRESS },
      to:          [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Brevo error ${res.status}`);
  }
};

const broadcast = async (req, res) => {
  try {
    const { subject, message, targetRole = 'student', category = 'broadcast', relatedPage = '' } = req.body;
    if (!subject?.trim() || !message?.trim()) {
      return res.status(400).json({ message: 'Subject and message body are required.' });
    }
    const recipients = await User.find({ role: targetRole, isActive: true }).select('name email');
    if (recipients.length === 0) {
      return res.status(404).json({ message: `No active ${targetRole} accounts found.` });
    }
    const results = { sent: 0, failed: 0, errors: [] };
    for (const recipient of recipients) {
      const personalised = message.replace(/\{name\}/gi, recipient.name.split(' ')[0]);
      const safeSubject = escapeHtml(subject.trim());
      const safeMessage = escapeHtml(personalised.trim());
      await Notification.create({
        recipient: recipient._id,
        subject: subject.trim(),
        message: personalised.trim(),
        category,
        relatedPage,
      });
      const htmlBody = `
        <div style="font-family:sans-serif;max-width:600px;margin:auto;border:1px solid #eee;padding:24px;border-radius:10px;">
          <h2 style="color:#2c5282;margin-bottom:4px;">University of Energy and Natural Resources</h2>
          <p style="color:#94a3b8;font-size:13px;margin-top:0;">UENR InternTrack System</p>
          <hr style="border:0;border-top:1px solid #eee;margin:16px 0;" />
          <div style="white-space:pre-line;color:#334155;line-height:1.7;">${safeMessage}</div>
          <hr style="border:0;border-top:1px solid #eee;margin:24px 0 16px;" />
          <footer style="font-size:11px;color:#94a3b8;text-align:center;">
            &copy; ${new Date().getFullYear()} UENR InternTrack System | Sunyani, Ghana<br/>
            This is an automated notification — please do not reply to this email.
          </footer>
        </div>`;
      try {
        await sendEmail(recipient.email, safeSubject, htmlBody);
        results.sent++;
      } catch (mailErr) {
        results.failed++;
        results.errors.push({ email: recipient.email, error: mailErr.message });
      }
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
