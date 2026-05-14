require('dotenv').config();

// ── Safety guard — never run seed against production database ─────
if (process.env.NODE_ENV === 'production') {
  console.error('❌  Seed aborted: NODE_ENV is "production". Refusing to wipe the live database.');
  process.exit(1);
}

const mongoose  = require('mongoose');
const connectDB = require('./config/db');
const User      = require('./models/User');
const Company   = require('./models/Company');
const Placement = require('./models/Placement');   // FIX: was PlacementRequest
const Log       = require('./models/Log');          // FIX: was LogEntry
const Grade     = require('./models/Grade');
const Notification = require('./models/Notification');

const seedPasswords = {
  admin: process.env.SEED_ADMIN_PASSWORD || 'ChangeMeAdmin123!',
  lecturer: process.env.SEED_LECTURER_PASSWORD || 'ChangeMeLecturer123!',
  manager: process.env.SEED_MANAGER_PASSWORD || 'ChangeMeManager123!',
  supervisor: process.env.SEED_SUPERVISOR_PASSWORD || 'ChangeMeSupervisor123!',
  student: process.env.SEED_STUDENT_PASSWORD || 'ChangeMeStudent123!',
};

const seed = async () => {
  await connectDB();

  console.log('🗑   Clearing existing data...');
  await User.deleteMany({});
  await Company.deleteMany({});
  await Placement.deleteMany({});
  await Log.deleteMany({});
  await Grade.deleteMany({});
  await Notification.deleteMany({});

  // ── Companies ────────────────────────────────────────────────
  console.log('🏢  Seeding companies...');
  const [mtn, ecg, vodafone] = await Company.create([
    { name:'MTN Ghana',                     category:'Software/IT',  location:'Accra, Greater Accra',   lat:5.6037,  long:-0.1870,  radius:200, slots:3 },
    { name:'Electricity Company of Ghana',  category:'Electrical',   location:'Sunyani, Bono Region',   lat:7.3350,  long:-2.3259,  radius:150, slots:0 },
    { name:'Vodafone Ghana',                category:'Network Eng.', location:'Kumasi, Ashanti Region', lat:6.6885,  long:-1.6244,  radius:150, slots:2 },
  ]);

  // ── Admin ────────────────────────────────────────────────────
  console.log('👤  Seeding admin...');
  await User.create({
    name:'System Administrator', email:'admin@uenr.edu.gh',
    password:seedPasswords.admin, role:'admin', needsPasswordChange:true,
  });

  // ── Academic Supervisors ─────────────────────────────────────
  console.log('🎓  Seeding lecturers...');
  const [drFrimpong, drAmoah] = await User.create([
    { name:'Dr. S.O Frimpong', email:'frimpong@uenr.edu.gh', password:seedPasswords.lecturer, role:'academic', staffId:'UENR-LEC-001', department:'Computer Science', needsPasswordChange:true },
    { name:'Dr. K. Amoah',    email:'amoah@uenr.edu.gh',    password:seedPasswords.lecturer, role:'academic', staffId:'UENR-LEC-002', department:'ITDS',             needsPasswordChange:true },
  ]);

  // ── Company Managers ─────────────────────────────────────────
  console.log('👔  Seeding company managers...');
  const [mtnManager, ecgManager] = await User.create([
    { name:'MTN HR Manager', email:'manager@mtn.com.gh', password:seedPasswords.manager, role:'company_manager', companyId:mtn._id, companyOrg:'MTN Ghana', needsPasswordChange:true },
    { name:'ECG HR Manager', email:'manager@ecg.com.gh', password:seedPasswords.manager, role:'company_manager', companyId:ecg._id, companyOrg:'Electricity Company of Ghana', needsPasswordChange:true },
  ]);

  // Link companies to their managers
  mtn.manager = mtnManager._id;
  ecg.manager = ecgManager._id;
  await Promise.all([mtn.save(), ecg.save()]);

  // ── Industrial Supervisors ───────────────────────────────────
  console.log('🏭  Seeding industrial supervisors...');
  const [mtnSup, ecgSup] = await User.create([
    { name:'Mr. Kofi Boateng', email:'k.boateng@mtn.com',  password:seedPasswords.supervisor, role:'industrial', companyOrg:'MTN Ghana',                    companyId:mtn._id, needsPasswordChange:true },
    { name:'Eng. Ama Sarpong', email:'a.sarpong@ecg.com',  password:seedPasswords.supervisor, role:'industrial', companyOrg:'Electricity Company of Ghana', companyId:ecg._id, needsPasswordChange:true },
  ]);

  // Add supervisors to companies
  mtn.supervisors.push(mtnSup._id);
  ecg.supervisors.push(ecgSup._id);
  await Promise.all([mtn.save(), ecg.save()]);

  // ── Students ─────────────────────────────────────────────────
  console.log('🧑‍🎓  Seeding students...');
  const [kwame, abena, kofi, pending] = await User.create([
    { name:'Kwame Mensah',  email:'kwame@st.uenr.edu.gh', password:seedPasswords.student, role:'student', indexNumber:'UEB3214522', department:'Computer Science',       status:'Placed',  completedWeeks:4, totalWeeks:6, companyId:mtn._id, companyName:'MTN Ghana',                    placementStatus:'Active', academicSupervisor:drFrimpong._id, industrialSupervisor:mtnSup._id, needsPasswordChange:true },
    { name:'Abena Serwaa',  email:'abena@st.uenr.edu.gh', password:seedPasswords.student, role:'student', indexNumber:'UEB3214523', department:'ITDS',                   status:'Placed',  completedWeeks:3, totalWeeks:6, companyId:mtn._id, companyName:'MTN Ghana',                    placementStatus:'Active', academicSupervisor:drFrimpong._id, industrialSupervisor:mtnSup._id, needsPasswordChange:true },
    { name:'Kofi Asante',   email:'kofi@st.uenr.edu.gh',  password:seedPasswords.student, role:'student', indexNumber:'UEB3214524', department:'Computer Science',       status:'Graded',  completedWeeks:6, totalWeeks:6, companyId:ecg._id, companyName:'Electricity Company of Ghana', placementStatus:'Active', academicSupervisor:drAmoah._id,    industrialSupervisor:ecgSup._id, needsPasswordChange:true },
    { name:'Adwoa Darko',   email:'adwoa@st.uenr.edu.gh', password:seedPasswords.student, role:'student', indexNumber:'UEB3214525', department:'Mechanical Engineering', status:'Pending', needsPasswordChange:true },
  ]);

  // ── Logs (checkbox-based activity model) ────────────────────────
  console.log('📓  Seeding log entries...');
  // Uses: student, company, companyName, date, activities (array of keys), notes, week, status
  await Log.create([
    {
      student:kwame._id, company:mtn._id, companyName:'MTN Ghana',
      week:4, date:new Date('2025-02-23'),
      activities: ['coding', 'testing', 'meetings'],
      notes: 'Implemented authentication middleware and resolved a token expiry bug.',
      status: 'Approved',
    },
    {
      student:kwame._id, company:mtn._id, companyName:'MTN Ghana',
      week:4, date:new Date('2025-02-24'),
      activities: ['database', 'report_writing'],
      notes: 'Optimised MongoDB schema and added compound indexes.',
      status: 'Pending',
    },
    {
      student:abena._id, company:mtn._id, companyName:'MTN Ghana',
      week:3, date:new Date('2025-02-16'),
      activities: ['coding', 'team_meeting', 'mentorship'],
      notes: 'Built responsive dashboard UI and presented mockup to team lead.',
      status: 'Pending',
    },
  ]);

  // ── Placement Request (using Placement model) ─────────────────
  console.log('📋  Seeding placement request...');
  // FIX: Placement model fields — no "industry" field, uses supervisorEmail not supervisorPhone required
  await Placement.create({
    student:         pending._id,
    companyName:     'Vodafone Ghana',
    supervisorEmail: 'hr@vodafone.com.gh',
    supervisorPhone: '0302000100',
    lat:             6.6885,
    long:            -1.6244,
    status:          'Pending',
  });

  // ── Grade for Kofi ────────────────────────────────────────────
  console.log('📊  Seeding grade...');
  await Grade.create({
    student:     kofi._id,
    submittedBy: drAmoah._id,
    type:        'academic',
    grade:       'B+',
    score:       8,
    comments:    'Good technical work and consistent logbook submissions.',
  });
  await User.findByIdAndUpdate(kofi._id, { gradeStatus:'Graded', finalGrade:'B+' });

  // ── Summary ───────────────────────────────────────────────────
  console.log('\n✅  Database seeded successfully!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  PORTAL LOGIN CREDENTIALS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Admin       admin@uenr.edu.gh');
  console.log('  Lecturer 1  frimpong@uenr.edu.gh');
  console.log('  Lecturer 2  amoah@uenr.edu.gh');
  console.log('  Manager MTN manager@mtn.com.gh');
  console.log('  Manager ECG manager@ecg.com.gh');
  console.log('  Industrial  k.boateng@mtn.com');
  console.log('  Student 1   kwame@st.uenr.edu.gh    (Placed @ MTN)');
  console.log('  Student 2   abena@st.uenr.edu.gh    (Placed @ MTN)');
  console.log('  Student 3   kofi@st.uenr.edu.gh     (Graded)');
  console.log('  Student 4   adwoa@st.uenr.edu.gh    (Pending)');
  console.log('  Seed passwords are read from SEED_*_PASSWORD env vars or the local defaults in seed.js.');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  mongoose.disconnect();
};

seed().catch(err => {
  console.error('Seed failed:', err);
  mongoose.disconnect();
  process.exit(1);
});
