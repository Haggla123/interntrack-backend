// Controllers/authController.js
const jwt        = require('jsonwebtoken');
const crypto     = require('crypto');
const User       = require('../models/User');
const nodemailer = require('nodemailer');

const createTransporter = () =>
  nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });

const makeTempPassword = () =>
  'UENR-' + crypto.randomBytes(6).toString('base64url').slice(0, 8);

const sendWelcomeEmail = async (email, name, tempPassword, role = 'student', identifier = '') => {
  const transporter = createTransporter();
  const roleLabel = role === 'student'   ? 'Student'
                  : role === 'academic'  ? 'Academic Supervisor'
                  : role === 'admin'     ? 'Administrator'
                  : 'Industrial Supervisor';
  await transporter.sendMail({
    from: `"UENR InternTrack" <${process.env.EMAIL_USER}>`,
    to:   email,
    subject: 'Your InternTrack Login Details – UENR',
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:auto;border:1px solid #eee;padding:24px;border-radius:10px;">
        <h2 style="color:#2c5282;text-align:center;">University of Energy and Natural Resources</h2>
        <p style="text-align:center;color:#64748b;font-size:13px;">InternTrack Portal — ${roleLabel} Account</p>
        <hr style="border:0;border-top:1px solid #eee;" />
        <h3 style="color:#2c5282;">Hi ${name},</h3>
        <p>Welcome to <strong>InternTrack</strong>! Your account has been created. Use the credentials below to log in.</p>
        <div style="background:#f7fafc;padding:16px;border-radius:6px;margin:20px 0;border-left:4px solid #3182ce;">
          <p style="margin:5px 0;"><strong>Login ID:</strong> ${email}</p>
          <p style="margin:5px 0;"><strong>Temporary Password:</strong> <span style="color:#e53e3e;font-weight:bold;">${tempPassword}</span></p>
          <p style="margin:5px 0;"><strong>Portal:</strong> <a href="${process.env.CLIENT_URL}/login">${process.env.CLIENT_URL}/login</a></p>
        </div>
        <div style="text-align:center;margin:28px 0;">
          <a href="${process.env.CLIENT_URL}/login"
             style="background:#3182ce;color:#fff;padding:12px 30px;text-decoration:none;border-radius:5px;font-weight:bold;display:inline-block;">
            Login to Portal
          </a>
        </div>
        <p style="font-size:0.85em;color:#718096;">
          <strong>Security Notice:</strong> Change this temporary password on your first login.
        </p>
        <footer style="margin-top:24px;border-top:1px solid #eee;padding-top:12px;font-size:0.8em;color:#a0aec0;text-align:center;">
          &copy; ${new Date().getFullYear()} UENR InternTrack System | Sunyani, Ghana
        </footer>
      </div>`,
  });
};

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const sendToken = (user, statusCode, res) => {
  const token = signToken(user);
  res.status(statusCode).json({
    token,
    user: {
      _id:                 user._id,
      name:                user.name,
      email:               user.email,
      role:                user.role,
      needsPasswordChange: user.needsPasswordChange,
      indexNumber:         user.indexNumber,
      department:          user.department,
      staffId:             user.staffId,
      placementStatus:     user.placementStatus,
      companyId:           user.companyId,
      companyName:         user.companyName,
      academicSupervisor:  user.academicSupervisor,
      companyOrg:          user.companyOrg,
    },
  });
};

// ── POST /api/auth/register  (admin only) ────────────────────────
const register = async (req, res) => {
  try {
    const {
      name, email, role, indexNumber, department,
      staffId, companyOrg, password: explicitPassword,
    } = req.body;

    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only administrators can register new accounts.' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'An account with this email already exists.' });
    }

    const tempPassword = explicitPassword || makeTempPassword();
    const needsChange  = !explicitPassword;

    // Sanitize: empty string must become undefined so the sparse unique
    // indexes on indexNumber and staffId ignore the field entirely.
    // Storing "" causes the same E11000 collision as null on non-sparse indexes.
    const safeIndexNumber = indexNumber?.trim() || undefined;
    const safeStaffId     = staffId?.trim()     || undefined;

    const user = await User.create({
      name, email, password: tempPassword, role,
      indexNumber: safeIndexNumber,
      department,
      staffId: safeStaffId,
      companyOrg,
      needsPasswordChange: needsChange,
    });

    const loginIdentifier = safeIndexNumber || safeStaffId || email;

    try {
      await sendWelcomeEmail(email, name, tempPassword, role, loginIdentifier);
    } catch (mailErr) {
      console.error('Mail Error:', mailErr.message);
      // FIX: Return the created user so the admin dashboard list updates
      // immediately even when email fails. Password is NOT included.
      return res.status(201).json({
        message: `Account created for ${name}, but the welcome email failed to send. Use "Reset Password" to resend credentials.`,
        user: {
          _id:        user._id,
          name:       user.name,
          email:      user.email,
          role:       user.role,
          indexNumber: user.indexNumber,
          department: user.department,
          staffId:    user.staffId,
          needsPasswordChange: user.needsPasswordChange,
        },
      });
    }

    // FIX: Always return the created user object so AddStudentModal /
    // AddLecturerModal / AddAdminModal can append it to the list immediately
    // without requiring a full page refresh.
    // Previously this returned only { message: '...' }, so the modals
    // received a string object from `res.user || res.data || res` and the
    // dashboard list never updated.
    res.status(201).json({
      message: `Account created for ${name}. Login details sent to ${email}.`,
      user: {
        _id:        user._id,
        name:       user.name,
        email:      user.email,
        role:       user.role,
        indexNumber: user.indexNumber,
        department: user.department,
        staffId:    user.staffId,
        needsPasswordChange: user.needsPasswordChange,
      },
    });
  } catch (err) {
    // MongoDB duplicate key — code can be number 11000 or string '11000'
    if (err.code === 11000 || err.code === '11000') {
      // keyValue is the most reliable: { indexNumber: 'UEB3214522' }
      // keyPattern is the schema field map: { indexNumber: 1 }
      // Fall back to parsing the raw error message if both are missing
      const keyValue  = err.keyValue  || {};
      const keyPattern = err.keyPattern || {};
      const field = Object.keys(keyValue)[0] || Object.keys(keyPattern)[0] || '';

      // Also try to detect from the raw message string as last resort
      const msg = err.message || '';
      const isIndexNumber = field === 'indexNumber' || msg.includes('indexNumber');
      const isStaffId     = field === 'staffId'     || msg.includes('staffId');
      const isEmail       = field === 'email'        || msg.includes('email');

      if (isIndexNumber) {
        return res.status(400).json({ message: 'This index number is already registered to another student.' });
      }
      if (isStaffId) {
        return res.status(400).json({ message: 'This staff ID is already registered to another supervisor.' });
      }
      if (isEmail) {
        return res.status(400).json({ message: 'This email address is already registered.' });
      }
      return res.status(400).json({ message: 'A user with these details already exists.' });
    }
    res.status(500).json({ message: err.message });
  }
};
const login = async (req, res) => {
  try {
    const { id, email, password } = req.body;
    const identifier = id || email;

    if (!identifier || !password) {
      return res.status(400).json({ message: 'Please provide your ID/email and password.' });
    }

    const user = await User.findOne({
      $or: [
        { email:       identifier },
        { indexNumber: identifier },
        { staffId:     identifier },
      ],
    }).select('+password');

    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Invalid credentials or account deactivated.' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    if (req.body.role) {
      const submitted = req.body.role === 'industry' ? 'industrial' : req.body.role;
      if (submitted !== user.role) {
        return res.status(403).json({
          message: `Incorrect portal selected. Please choose the ${user.role.charAt(0).toUpperCase() + user.role.slice(1)} portal to sign in.`,
        });
      }
    }

    user.lastLogin   = new Date();
    user.lastLoginIp = req.ip;
    await user.save({ validateBeforeSave: false });

    sendToken(user, 200, res);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET /api/auth/me ─────────────────────────────────────────────
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('academicSupervisor',   'name email phone department staffId')
      // FIX: industrialSupervisor was not populated so student dashboard
      // could never show the industrial supervisor's name/contact details.
      .populate('industrialSupervisor', 'name email phone companyOrg')
      .populate('companyId', 'name location category supervisorName supervisorEmail supervisorPhone lat long radius');
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.status(200).json({ user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── POST /api/auth/change-password ──────────────────────────────
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Please provide both current and new password.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters.' });
    }
    const user = await User.findById(req.user._id).select('+password');
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect.' });
    }
    user.password            = newPassword;
    user.needsPasswordChange = false;
    await user.save();
    res.status(200).json({ message: 'Password updated successfully.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── POST /api/auth/forgot-password  (public) ────────────────────
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email address is required.' });

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(200).json({ message: 'If that email is registered, a reset link has been sent.' });
    }

    const tempPassword = makeTempPassword();
    user.password            = tempPassword;
    user.needsPasswordChange = true;
    await user.save();

    try {
      await sendWelcomeEmail(email, user.name, tempPassword, user.role, user.indexNumber || user.staffId || email);
    } catch (mailErr) {
      console.error('Forgot-password mail error:', mailErr.message);
    }

    res.status(200).json({ message: 'Password reset. Check your email for the temporary password.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { register, login, getMe, changePassword, forgotPassword };