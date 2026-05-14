const Company = require('../models/Company');
const User = require('../models/User');
const crypto = require('crypto');

const makeTempPassword = () =>
  'UENR-' + crypto.randomBytes(6).toString('base64url').slice(0, 8);

const sendEmail = async (to, subject, html) => {
  if (!process.env.BREVO_API_KEY || !process.env.MAIL_ADDRESS) {
    throw new Error('Brevo email settings are missing. Set BREVO_API_KEY and MAIL_ADDRESS.');
  }

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': process.env.BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: { name: 'UENR InternTrack', email: process.env.MAIL_ADDRESS },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Brevo error ${res.status}`);
  }
};

const sendSupervisorCredentials = async (email, name, tempPassword, company) => {
  if (!email) return;

  await sendEmail(
    email,
    `InternTrack - Your Company Manager Account for ${company.name}`,
    `
      <div style="font-family:sans-serif;max-width:600px;margin:auto;border:1px solid #eee;padding:24px;border-radius:10px;">
        <h2 style="color:#2c5282;text-align:center;">University of Energy and Natural Resources</h2>
        <hr style="border:0;border-top:1px solid #eee;" />
        <h3 style="color:#2c5282;">Hi ${name || 'Manager'},</h3>
        <p><strong>${company.name}</strong> has been registered on UENR InternTrack. Your Company Manager account has been created.</p>
        <p>As a manager, you can log in to assign students to supervisors and monitor logbook activity.</p>
        <div style="background:#f7fafc;padding:16px;border-radius:6px;margin:20px 0;border-left:4px solid #3182ce;">
          <p style="margin:5px 0;"><strong>Login Email:</strong> ${email}</p>
          <p style="margin:5px 0;"><strong>Temporary Password:</strong> <span style="color:#e53e3e;font-weight:bold;">${tempPassword}</span></p>
          <p style="margin:5px 0;"><strong>Portal:</strong> <a href="${process.env.CLIENT_URL}/login">${process.env.CLIENT_URL}/login</a></p>
        </div>
        <footer style="margin-top:24px;border-top:1px solid #eee;padding-top:12px;font-size:0.8em;color:#a0aec0;text-align:center;">
          &copy; ${new Date().getFullYear()} UENR InternTrack System | Sunyani, Ghana
        </footer>
      </div>`
  );
};

// GET /api/companies
const getCompanies = async (req, res) => {
  try {
    const companies = await Company.find({ isActive: true }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: companies });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/companies/:id
const getCompany = async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ message: 'Company not found.' });
    res.status(200).json({ success: true, data: company });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/companies
const createCompany = async (req, res) => {
  try {
    const {
      name, category, location, slots, lat, long, radius,
      supervisorName, supervisorEmail, supervisorPhone,
    } = req.body;

    const managerEmail = supervisorEmail?.trim().toLowerCase();

    const company = await Company.create({
      name, category, location,
      slots: Number(slots) || 0,
      lat: lat ? Number(lat) : null,
      long: long ? Number(long) : null,
      radius: Number(radius) || 150,
      supervisorName: supervisorName || '',
      supervisorEmail: managerEmail || '',
      supervisorPhone: supervisorPhone || '',
    });

    let emailWarning = null;
    if (managerEmail) {
      const existing = await User.findOne({ email: managerEmail });
      if (!existing) {
        const tempPassword = makeTempPassword();
        const managerUser = await User.create({
          name: supervisorName || managerEmail,
          email: managerEmail,
          password: tempPassword,
          role: 'company_manager',
          companyOrg: name,
          companyId: company._id,
          needsPasswordChange: true,
        });

        company.manager = managerUser._id;
        await company.save();

        try {
          await sendSupervisorCredentials(managerEmail, supervisorName, tempPassword, company);
        } catch (mailErr) {
          console.error('Manager credentials email failed:', mailErr.message);
          emailWarning = 'Company created and manager account set up, but the credentials email could not be sent.';
        }
      } else {
        emailWarning = 'Company created, but that manager email already belongs to an existing account. No temporary password was generated.';
      }
    }

    res.status(201).json({ success: true, data: company, ...(emailWarning && { warning: emailWarning }) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/companies/:id
const updateCompany = async (req, res) => {
  try {
    const fields = ['name', 'category', 'location', 'slots', 'lat', 'long', 'radius', 'supervisorName', 'supervisorEmail', 'supervisorPhone'];
    const update = {};
    fields.forEach(f => {
      if (req.body[f] !== undefined) {
        if (['slots', 'lat', 'long', 'radius'].includes(f)) {
          update[f] = req.body[f] === '' ? null : Number(req.body[f]);
        } else {
          update[f] = req.body[f];
        }
      }
    });

    if (update.supervisorEmail) {
      update.supervisorEmail = update.supervisorEmail.trim().toLowerCase();
    }

    const company = await Company.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!company) return res.status(404).json({ message: 'Company not found.' });
    res.status(200).json({ success: true, data: company });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/companies/:id
const deleteCompany = async (req, res) => {
  try {
    const company = await Company.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!company) return res.status(404).json({ message: 'Company not found.' });
    res.status(200).json({ success: true, message: 'Company removed.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/companies/:id/apply
const applyForSlot = async (req, res) => {
  try {
    const student = await User.findById(req.user._id).select('placementStatus');
    if (student?.placementStatus === 'Active') {
      return res.status(400).json({ message: 'You are already placed at a company.' });
    }

    const company = await Company.findOneAndUpdate(
      { _id: req.params.id, isActive: true, slots: { $gt: 0 } },
      { $inc: { slots: -1 } },
      { new: true }
    );

    if (!company) {
      const exists = await Company.findById(req.params.id);
      if (!exists) return res.status(404).json({ message: 'Company not found.' });
      return res.status(400).json({ message: 'No slots available at this company.' });
    }

    await User.findByIdAndUpdate(req.user._id, {
      companyId: company._id,
      companyName: company.name,
      placementStatus: 'Active',
    });

    res.status(200).json({ success: true, data: company });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getCompanies, getCompany, createCompany, updateCompany, deleteCompany, applyForSlot,
};
