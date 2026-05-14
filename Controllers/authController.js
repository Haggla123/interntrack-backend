// Controllers/authController.js
const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const User   = require('../models/User');

const makeTempPassword = () =>
  'UENR-' + crypto.randomBytes(6).toString('base64url').slice(0, 8);

const sendEmail = async (to, subject, html) => {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key':      process.env.BREVO_API_KEY,
    },
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

const sendWelcomeEmail = async (email, name, tempPassword, role = 'student', identifier = '') => {
  const roleLabel = role === 'student'          ? 'Student'
                  : role === 'academic'         ? 'Academic Supervisor'
                  : role === 'admin'            ? 'Administrator'
                  : role === 'company_manager'  ? 'Company Manager'
                  : 'Industrial Supervisor';
  await sendEmail(
    email,
    'Your InternTrack Login Details – UENR',
    `<div style="font-family:sans-serif;max-width:600px;margin:auto;border:1px solid #eee;padding:24px;border-radius:10px;">
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
      <p style="font-size:0.85em;color:#718096;"><strong>Security Notice:</strong> Change this temporary password on your first login.</p>
      <footer style="margin-top:24px;border-top:1px solid #eee;padding-top:12px;font-size:0.8em;color:#a0aec0;text-align:center;">
        &copy; ${new Date().getFullYear()} UENR InternTrack System | Sunyani, Ghana
      </footer>
    </div>`
  );
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
      profilePicture:      user.profilePicture,
      lastLogin:           user.lastLogin,
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
      let submitted = req.body.role === 'industry' ? 'industrial' : req.body.role;
      // Allow company_manager users to log in via the 'industrial' tab
      const isCompatible = submitted === user.role
        || (submitted === 'industrial' && user.role === 'company_manager');
      if (!isCompatible) {
        return res.status(403).json({
          message: `Incorrect portal selected. Please choose the ${user.role === 'company_manager' ? 'Industry' : user.role.charAt(0).toUpperCase() + user.role.slice(1)} portal to sign in.`,
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
      .populate('academicSupervisor',   'name email phone department staffId profilePicture')
      // FIX: industrialSupervisor was not populated so student dashboard
      // could never show the industrial supervisor's name/contact details.
      .populate('industrialSupervisor', 'name email phone companyOrg profilePicture')
      .populate({
        path: 'companyId',
        select: 'name location category supervisorName supervisorEmail supervisorPhone lat long radius manager',
        populate: { path: 'manager', select: 'name email phone companyOrg profilePicture' },
      });
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
    const { email, role } = req.body;
    if (!email) return res.status(400).json({ message: 'Email address is required.' });

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(200).json({ message: 'If that email is registered, a reset link has been sent.' });
    }
    if (role) {
      const submitted = role === 'industry' ? 'industrial' : role;
      const isCompatible = submitted === user.role
        || (submitted === 'industrial' && user.role === 'company_manager');
      if (!isCompatible) {
        return res.status(200).json({ message: 'If that email is registered for this portal, recovery instructions have been sent.' });
      }
    }

    const tempPassword = makeTempPassword();
    const previousPassword = user.password;
    const previousNeedsPasswordChange = user.needsPasswordChange;

    user.password            = tempPassword;
    user.needsPasswordChange = true;
    await user.save();

    try {
      await sendWelcomeEmail(email, user.name, tempPassword, user.role, user.indexNumber || user.staffId || email);
    } catch (mailErr) {
      console.error('Forgot-password mail error:', mailErr.message);
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            password: previousPassword,
            needsPasswordChange: previousNeedsPasswordChange,
          },
        }
      );
      return res.status(502).json({ message: 'Recovery email could not be sent. Please try again later or contact support.' });
    }

    res.status(200).json({ message: 'Password reset. Check your email for the temporary password.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── PATCH /api/auth/me  (update own profile) ────────────────────
const updateProfile = async (req, res) => {
  try {
    // Students may only update: name, email, phone, department
    // (indexNumber is immutable — assigned by admin)
    const allowed = ['name', 'email', 'phone', 'department'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No valid fields provided for update.' });
    }

    // Prevent email collisions
    if (updates.email) {
      const exists = await User.findOne({ email: updates.email, _id: { $ne: req.user._id } });
      if (exists) return res.status(400).json({ message: 'This email is already in use by another account.' });
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true })
      .select('-password')
      .populate('academicSupervisor',   'name email phone department staffId profilePicture')
      .populate('industrialSupervisor', 'name email phone companyOrg profilePicture')
      .populate({
        path: 'companyId',
        select: 'name location category supervisorName supervisorEmail supervisorPhone lat long radius manager',
        populate: { path: 'manager', select: 'name email phone companyOrg profilePicture' },
      });

    res.status(200).json({ message: 'Profile updated.', user });
  } catch (err) {
    if (err.code === 11000 || err.code === '11000') {
      return res.status(400).json({ message: 'A user with these details already exists.' });
    }
    res.status(500).json({ message: err.message });
  }
};

// ── POST /api/auth/me/avatar  (upload profile picture) ─────────
const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No image file provided.' });

    // Store the relative path: avatars/<filename>
    const avatarPath = `avatars/${req.file.filename}`;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { profilePicture: avatarPath },
      { new: true }
    ).select('-password');

    res.status(200).json({
      message: 'Profile picture updated.',
      profilePicture: avatarPath,
      user,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { register, login, getMe, changePassword, forgotPassword, updateProfile, uploadAvatar };
