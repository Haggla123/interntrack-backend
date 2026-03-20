// Controllers/placementController.js
const Placement  = require('../models/Placement');
const Company    = require('../models/Company');
const User       = require('../models/User');
const nodemailer = require('nodemailer');

const createTransporter = () =>
  nodemailer.createTransport({
    host:   'smtp.gmail.com',
    port:   587,
    secure: false,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    tls: { rejectUnauthorized: false },
  });

// ── Email helper — credentials for industrial supervisor ────────
const sendSupervisorCredentials = async (email, name, tempPassword, company) => {
  if (!email) return;
  await createTransporter().sendMail({
    from: `"UENR InternTrack" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `InternTrack – Your Supervisor Account for ${company.name}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:auto;border:1px solid #eee;padding:24px;border-radius:10px;">
        <h2 style="color:#2c5282;text-align:center;">University of Energy and Natural Resources</h2>
        <p style="text-align:center;color:#64748b;font-size:13px;">InternTrack Portal — Industrial Supervisor Account</p>
        <hr style="border:0;border-top:1px solid #eee;" />
        <h3 style="color:#2c5282;">Hi ${name || 'Supervisor'},</h3>
        <p>A student has been placed at <strong>${company.name}</strong> and your account has been created on the UENR InternTrack system.</p>
        <div style="background:#f7fafc;padding:16px;border-radius:6px;margin:20px 0;border-left:4px solid #3182ce;">
          <p style="margin:5px 0;"><strong>Login Email:</strong> ${email}</p>
          <p style="margin:5px 0;"><strong>Temporary Password:</strong> <span style="color:#e53e3e;font-weight:bold;">${tempPassword}</span></p>
          <p style="margin:5px 0;"><strong>Company:</strong> ${company.name}</p>
          <p style="margin:5px 0;"><strong>Portal:</strong> <a href="${process.env.CLIENT_URL}/login">${process.env.CLIENT_URL}/login</a></p>
        </div>
        <div style="text-align:center;margin:28px 0;">
          <a href="${process.env.CLIENT_URL}/login"
             style="background:#3182ce;color:#fff;padding:12px 30px;text-decoration:none;border-radius:5px;font-weight:bold;display:inline-block;">
            Login to Supervisor Portal
          </a>
        </div>
        <p style="font-size:0.85em;color:#718096;"><strong>Security Notice:</strong> Please change this temporary password after your first login.</p>
        <footer style="margin-top:24px;border-top:1px solid #eee;padding-top:12px;font-size:0.8em;color:#a0aec0;text-align:center;">
          &copy; ${new Date().getFullYear()} UENR InternTrack System | Sunyani, Ghana
        </footer>
      </div>`,
  });
};

// ── Email helper: notify existing supervisor of a new intern assigned ──
const sendNewInternNotification = async (supervisor, student, company) => {
  if (!supervisor?.email) return;
  await createTransporter().sendMail({
    from: `"UENR InternTrack" <${process.env.EMAIL_USER}>`,
    to: supervisor.email,
    subject: `InternTrack – New Intern Assigned at ${company.name}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:auto;border:1px solid #eee;padding:24px;border-radius:10px;">
        <h2 style="color:#2c5282;text-align:center;">University of Energy and Natural Resources</h2>
        <p style="text-align:center;color:#64748b;font-size:13px;">InternTrack Portal — Industrial Supervisor</p>
        <hr style="border:0;border-top:1px solid #eee;" />
        <h3 style="color:#2c5282;">Hi ${supervisor.name || 'Supervisor'},</h3>
        <p>A new intern has been assigned to your supervision at <strong>${company.name}</strong>.</p>
        <div style="background:#f7fafc;padding:16px;border-radius:6px;margin:20px 0;border-left:4px solid #38a169;">
          <p style="margin:5px 0;"><strong>Intern Name:</strong> ${student.name || 'N/A'}</p>
          <p style="margin:5px 0;"><strong>Index Number:</strong> ${student.indexNumber || 'N/A'}</p>
          <p style="margin:5px 0;"><strong>Company:</strong> ${company.name}</p>
          <p style="margin:5px 0;"><strong>Portal:</strong> <a href="${process.env.CLIENT_URL}/login">${process.env.CLIENT_URL}/login</a></p>
        </div>
        <p>Log in to your existing supervisor account to view their logbook entries and track their progress.</p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${process.env.CLIENT_URL}/login"
             style="background:#38a169;color:#fff;padding:12px 30px;text-decoration:none;border-radius:5px;font-weight:bold;display:inline-block;">
            Go to Supervisor Portal
          </a>
        </div>
        <footer style="margin-top:24px;border-top:1px solid #eee;padding-top:12px;font-size:0.8em;color:#a0aec0;text-align:center;">
          &copy; ${new Date().getFullYear()} UENR InternTrack System | Sunyani, Ghana
        </footer>
      </div>`,
  });
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

    // Try to find or create the Company record so students show up in the companies list
    let company = await Company.findOne({
      name: { $regex: new RegExp(`^${placement.companyName}$`, 'i') },
    });

    if (!company) {
      company = await Company.create({
        name:            placement.companyName,
        supervisorName:  placement.supervisorName,
        supervisorEmail: placement.supervisorEmail,
        supervisorPhone: placement.supervisorPhone,
        lat:             placement.lat,
        long:            placement.long,
        slots:           10, // default — admin can edit later
      });
    } else {
      // Update supervisor contact details if placement has them (keeps company record fresh)
      const updates = {};
      if (placement.supervisorName)  updates.supervisorName  = placement.supervisorName;
      if (placement.supervisorEmail) updates.supervisorEmail = placement.supervisorEmail;
      if (placement.supervisorPhone) updates.supervisorPhone = placement.supervisorPhone;
      if (placement.lat)  updates.lat  = placement.lat;
      if (placement.long) updates.long = placement.long;
      if (Object.keys(updates).length) {
        company = await Company.findByIdAndUpdate(company._id, updates, { new: true });
      }
    }

    placement.company = company._id;
    await placement.save();

    // Find or create industrial supervisor account, then link student to them
    let supervisorUser = null;
    if (placement.supervisorEmail) {
      supervisorUser = await User.findOne({ email: placement.supervisorEmail, role: 'industrial' });

      let emailSent = false;
      let emailNote  = '';

      if (!supervisorUser) {
        // First student from this company — create account and send credentials
        const tempPassword = `UENR-${Math.floor(1000 + Math.random() * 9000)}`;
        supervisorUser = await User.create({
          name:                placement.supervisorName || placement.supervisorEmail,
          email:               placement.supervisorEmail,
          password:            tempPassword,
          role:                'industrial',
          companyOrg:          company.name,
          companyId:           company._id,
          needsPasswordChange: true,
        });
        try {
          await sendSupervisorCredentials(placement.supervisorEmail, placement.supervisorName, tempPassword, company);
          emailSent = true;
          emailNote  = `Credentials emailed to ${placement.supervisorEmail}.`;
        } catch (mailErr) {
          console.error('Supervisor credentials email failed:', mailErr.message);
          emailNote = `Account created but email failed — share credentials manually. Temp password: UENR-${tempPassword.split('-')[1]}`;
        }
      } else {
        // Supervisor already has an account — notify them of the new intern
        try {
          await sendNewInternNotification(supervisorUser, placement.student, company);
          emailSent = true;
          emailNote  = `Notification sent to existing supervisor (${placement.supervisorEmail}).`;
        } catch (mailErr) {
          console.error('New intern notification email failed:', mailErr.message);
          emailNote = `Supervisor account linked but notification email failed.`;
        }
      }

      placement._emailSent = emailSent;
      placement._emailNote  = emailNote;
    }

    // Stamp the student record: placed at this company, linked to this industrial supervisor
    await User.findByIdAndUpdate(placement.student._id, {
      companyName:          company.name,
      companyId:            company._id,
      placementStatus:      'Active',
      ...(supervisorUser && { industrialSupervisor: supervisorUser._id }),
    });

    res.status(200).json({
      success:   true,
      data:      placement,
      emailSent: placement._emailSent || false,
      emailNote: placement._emailNote || '',
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