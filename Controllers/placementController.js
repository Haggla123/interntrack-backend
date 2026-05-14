// Controllers/placementController.js
const Placement = require('../models/Placement');
const Company   = require('../models/Company');
const User      = require('../models/User');
const crypto    = require('crypto');

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const makeTempPassword = () =>
  'UENR-' + crypto.randomBytes(6).toString('base64url').slice(0, 8);

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

const sendSupervisorCredentials = async (email, name, tempPassword, company) => {
  if (!email) return;
  await sendEmail(
    email,
    `InternTrack – Your Supervisor Account for ${company.name}`,
    `<div style="font-family:sans-serif;max-width:600px;margin:auto;border:1px solid #eee;padding:24px;border-radius:10px;">
      <h2 style="color:#2c5282;text-align:center;">University of Energy and Natural Resources</h2>
      <p style="text-align:center;color:#64748b;font-size:13px;">InternTrack Portal — Industrial Supervisor Account</p>
      <hr style="border:0;border-top:1px solid #eee;" />
      <h3 style="color:#2c5282;">Hi ${name || 'Supervisor'},</h3>
      <p>A student has been placed at <strong>${company.name}</strong> and your account has been created.</p>
      <div style="background:#f7fafc;padding:16px;border-radius:6px;margin:20px 0;border-left:4px solid #3182ce;">
        <p style="margin:5px 0;"><strong>Login Email:</strong> ${email}</p>
        <p style="margin:5px 0;"><strong>Temporary Password:</strong> <span style="color:#e53e3e;font-weight:bold;">${tempPassword}</span></p>
        <p style="margin:5px 0;"><strong>Portal:</strong> <a href="${process.env.CLIENT_URL}/login">${process.env.CLIENT_URL}/login</a></p>
      </div>
      <div style="text-align:center;margin:28px 0;">
        <a href="${process.env.CLIENT_URL}/login" style="background:#3182ce;color:#fff;padding:12px 30px;text-decoration:none;border-radius:5px;font-weight:bold;display:inline-block;">Login to Supervisor Portal</a>
      </div>
      <footer style="margin-top:24px;border-top:1px solid #eee;padding-top:12px;font-size:0.8em;color:#a0aec0;text-align:center;">
        &copy; ${new Date().getFullYear()} UENR InternTrack System | Sunyani, Ghana
      </footer>
    </div>`
  );
};

const sendNewInternNotification = async (supervisor, student, company) => {
  if (!supervisor?.email) return;
  await sendEmail(
    supervisor.email,
    `InternTrack – New Intern Assigned at ${company.name}`,
    `<div style="font-family:sans-serif;max-width:600px;margin:auto;border:1px solid #eee;padding:24px;border-radius:10px;">
      <h2 style="color:#2c5282;text-align:center;">University of Energy and Natural Resources</h2>
      <h3 style="color:#2c5282;">Hi ${supervisor.name || 'Supervisor'},</h3>
      <p>A new intern has been assigned to your supervision at <strong>${company.name}</strong>.</p>
      <div style="background:#f7fafc;padding:16px;border-radius:6px;margin:20px 0;border-left:4px solid #38a169;">
        <p style="margin:5px 0;"><strong>Intern Name:</strong> ${student.name || 'N/A'}</p>
        <p style="margin:5px 0;"><strong>Index Number:</strong> ${student.indexNumber || 'N/A'}</p>
        <p style="margin:5px 0;"><strong>Company:</strong> ${company.name}</p>
      </div>
      <div style="text-align:center;margin:28px 0;">
        <a href="${process.env.CLIENT_URL}/login" style="background:#38a169;color:#fff;padding:12px 30px;text-decoration:none;border-radius:5px;font-weight:bold;display:inline-block;">Go to Supervisor Portal</a>
      </div>
      <footer style="margin-top:24px;border-top:1px solid #eee;padding-top:12px;font-size:0.8em;color:#a0aec0;text-align:center;">
        &copy; ${new Date().getFullYear()} UENR InternTrack System | Sunyani, Ghana
      </footer>
    </div>`
  );
};

const submitPlacementRequest = async (req, res) => {
  try {
    const {
      companyName, supervisorName, supervisorEmail,
      supervisorPhone, lat, long,
    } = req.body;

    if (!companyName) {
      return res.status(400).json({ message: 'Company name is required.' });
    }

    // Block if student is already actively placed
    const studentUser = await User.findById(req.user._id).select('placementStatus');
    if (studentUser?.placementStatus === 'Active') {
      return res.status(400).json({ message: 'You are already placed at a company.' });
    }

    // One pending placement per student at a time
    const existing = await Placement.findOne({
      student: req.user._id,
      status: 'Pending',
    });
    if (existing) {
      return res.status(400).json({
        message: 'You already have a pending placement request. Please wait for admin review.',
      });
    }

    const placement = await Placement.create({
      student:         req.user._id,
      companyName:     companyName.trim(),
      supervisorName:  supervisorName  || '',
      supervisorEmail: supervisorEmail || '',
      supervisorPhone: supervisorPhone || '',
      lat:             lat  ?? null,
      long:            long ?? null,
    });

    res.status(201).json({ success: true, data: placement });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET /api/placements — admin: full queue ──────────────────────
const getPlacementRequests = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;

    const page  = Math.max(1,   parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 100);
    const skip  = (page - 1) * limit;

    const [placements, total] = await Promise.all([
      Placement.find(filter)
        .populate('student',    'name indexNumber department email')
        .populate('reviewedBy', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Placement.countDocuments(filter),
    ]);

    res.status(200).json({ success: true, data: placements, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── PUT /api/placements/:id/approve — admin approves ────────────
const approvePlacement = async (req, res) => {
  try {
    const placement = await Placement.findById(req.params.id).populate('student');
    if (!placement) return res.status(404).json({ message: 'Placement request not found.' });

    placement.status     = 'Approved';
    placement.adminNote  = req.body.note || '';
    placement.reviewedBy = req.user._id;
    placement.reviewedAt = new Date();

    const supervisorEmail = (placement.supervisorEmail || '').trim().toLowerCase();
    let emailSent = false;
    let emailNote = '';
    let existingManager = supervisorEmail
      ? await User.findOne({
          email: supervisorEmail,
          role: { $in: ['company_manager', 'industrial'] },
          isActive: true,
        })
      : null;

    // Prefer an existing company by exact name, then any company already tied
    // to the submitted HR/supervisor account.
    let company = await Company.findOne({
      name: { $regex: new RegExp(`^${escapeRegex(placement.companyName)}$`, 'i') },
    });
    if (!company && existingManager?.companyId) {
      company = await Company.findById(existingManager.companyId);
    }

    if (!company) {
      company = await Company.create({
        name:            placement.companyName,
        supervisorName:  placement.supervisorName,
        supervisorEmail: placement.supervisorEmail,
        supervisorPhone: placement.supervisorPhone,
        lat:             placement.lat,
        long:            placement.long,
        ...(existingManager?.role === 'company_manager' ? { manager: existingManager._id } : {}),
        ...(existingManager?.role === 'industrial' ? { supervisors: [existingManager._id] } : {}),
        slots:           10, // default — admin can edit later
      });
    } else {
      // Update supervisor contact details if placement has them (keeps company record fresh)
      const setUpdates = {};
      const updateOps = {};
      if (placement.supervisorName)  setUpdates.supervisorName  = placement.supervisorName;
      if (placement.supervisorEmail) setUpdates.supervisorEmail = placement.supervisorEmail;
      if (placement.supervisorPhone) setUpdates.supervisorPhone = placement.supervisorPhone;
      if (placement.lat)  setUpdates.lat  = placement.lat;
      if (placement.long) setUpdates.long = placement.long;
      if (existingManager?.role === 'company_manager' && !company.manager) {
        setUpdates.manager = existingManager._id;
      }
      if (
        existingManager?.role === 'industrial' &&
        !(company.supervisors || []).some(id => id.toString() === existingManager._id.toString())
      ) {
        updateOps.$addToSet = { supervisors: existingManager._id };
      }
      if (Object.keys(setUpdates).length) updateOps.$set = setUpdates;
      if (Object.keys(updateOps).length) {
        company = await Company.findByIdAndUpdate(company._id, updateOps, { new: true });
      }
    }

    if (!existingManager && supervisorEmail) {
      const tempPassword = makeTempPassword();
      existingManager = await User.create({
        name: placement.supervisorName || supervisorEmail,
        email: supervisorEmail,
        phone: placement.supervisorPhone || '',
        password: tempPassword,
        role: 'industrial',
        companyOrg: company.name,
        companyId: company._id,
        needsPasswordChange: true,
      });
      company = await Company.findByIdAndUpdate(
        company._id,
        { $addToSet: { supervisors: existingManager._id } },
        { new: true }
      );
      try {
        await sendSupervisorCredentials(supervisorEmail, existingManager.name, tempPassword, company);
        emailSent = true;
        emailNote = `Industrial supervisor account created and credentials sent to ${supervisorEmail}.`;
      } catch (mailErr) {
        emailNote = `Industrial supervisor account created, but credentials email failed: ${mailErr.message}`;
      }
    } else if (existingManager?.role === 'industrial') {
      try {
        await sendNewInternNotification(existingManager, placement.student, company);
        emailSent = true;
        emailNote = `Industrial supervisor notified at ${existingManager.email}.`;
      } catch (mailErr) {
        emailNote = `Placement approved, but supervisor notification failed: ${mailErr.message}`;
      }
    }

    if (existingManager && (!existingManager.companyId || existingManager.companyId.toString() !== company._id.toString())) {
      existingManager.companyId = company._id;
      existingManager.companyOrg = company.name;
      await existingManager.save({ validateBeforeSave: false });
    }

    placement.company = company._id;
    await placement.save();

    // Managers handle assignment for large companies; direct industrial contacts
    // are linked to the student immediately.
    await User.findByIdAndUpdate(placement.student._id, {
      companyName:          company.name,
      companyId:            company._id,
      placementStatus:      'Active',
      industrialSupervisor: existingManager?.role === 'industrial' ? existingManager._id : null,
    });

    res.status(200).json({
      success:   true,
      data:      placement,
      emailSent,
      emailNote,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── PUT /api/placements/:id/decline — admin declines ────────────
const declinePlacement = async (req, res) => {
  try {
    const placement = await Placement.findByIdAndUpdate(
      req.params.id,
      {
        status:      'Declined',
        adminNote:   req.body.note || '',
        reviewedBy:  req.user._id,
        reviewedAt:  new Date(),
      },
      { new: true }
    ).populate('student', 'name indexNumber');

    if (!placement) return res.status(404).json({ message: 'Placement request not found.' });

    res.status(200).json({ success: true, data: placement });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  submitPlacementRequest,
  getPlacementRequests,
  approvePlacement,
  declinePlacement,
};
