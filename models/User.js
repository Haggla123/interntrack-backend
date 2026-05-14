const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

// One User collection handles all four portals.
// The `role` field controls which dashboard they see after login.

const userSchema = new mongoose.Schema({
  name:  { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },

  // Hashed with bcrypt before saving (see pre-save hook below)
  password: { type: String, required: true, minlength: 8, select: false },

  role: {
    type: String,
    enum: ['admin', 'student', 'academic', 'industrial', 'company_manager'],
    required: true,
  },

  // ── Student-specific fields ──────────────────────────────────
  indexNumber:    { type: String, sparse: true, unique: true },   // e.g. UEB3214522
  department:     { type: String },
  phone:          { type: String, default: '' },
  completedWeeks: { type: Number, default: 0 },
  totalWeeks:     { type: Number, default: 6 },
  status: {
    type: String,
    enum: ['Pending', 'Placed', 'Graded'],
    default: 'Pending',
  },
  // References set once placement is approved
  companyName:        { type: String,                                         default: '' },
  companyId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null },
  academicSupervisor: { type: mongoose.Schema.Types.ObjectId, ref: 'User',    default: null },
  industrialSupervisor: { type: mongoose.Schema.Types.ObjectId, ref: 'User',  default: null },

  placementStatus: {
    type: String,
    enum: ['Unplaced', 'Active', 'Completed'],
    default: 'Unplaced',
  },
  gradeStatus: {
    type: String,
    enum: ['Pending', 'Graded'],
    default: 'Pending',
  },
  finalGrade: { type: String, default: null },

  // ── Academic (lecturer) fields ───────────────────────────────
  staffId:    { type: String, sparse: true, unique: true },  // e.g. UENR-LEC-001

  // ── Industrial supervisor fields ─────────────────────────────
  companyOrg: { type: String },  // company name for industrial supervisors

  // When true, the frontend should force the user to the change-password
  // screen before letting them use the portal. Set to true on account
  // creation, cleared to false after they change their password.
  needsPasswordChange: { type: Boolean, default: true },

  // ── Security / meta ─────────────────────────────────────────
  profilePicture: { type: String, default: '' },  // relative path in uploads/avatars/
  isActive:     { type: Boolean, default: true },
  lastLogin:    { type: Date },
  lastLoginIp:  { type: String },

}, { timestamps: true });

// ── Hash password before every save ─────────────────────────────
userSchema.pre('save', async function (next) {
  // Only re-hash if the password field was actually changed
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ── Instance method: compare plain password to hash ─────────────
userSchema.methods.matchPassword = async function (plainPassword) {
  return bcrypt.compare(plainPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);