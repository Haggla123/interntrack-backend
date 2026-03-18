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

const seed = async () => {
  await connectDB();

  console.log('🗑   Clearing existing data...');
  await User.deleteMany({});
  await Company.deleteMany({});
  await Placement.deleteMany({});
  await Log.deleteMany({});
  await Grade.deleteMany({});

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
    password:'Admin1234!', role:'admin', needsPasswordChange:false,
  });

  // ── Academic Supervisors ─────────────────────────────────────
  console.log('🎓  Seeding lecturers...');
  const [drFrimpong, drAmoah] = await User.create([
    { name:'Dr. S.O Frimpong', email:'frimpong@uenr.edu.gh', password:'Lecturer1234!', role:'academic', staffId:'UENR-LEC-001', department:'Computer Science', needsPasswordChange:false },
    { name:'Dr. K. Amoah',    email:'amoah@uenr.edu.gh',    password:'Lecturer1234!', role:'academic', staffId:'UENR-LEC-002', department:'ITDS',             needsPasswordChange:false },
  ]);

  // ── Industrial Supervisors ───────────────────────────────────
  console.log('🏭  Seeding industrial supervisors...');
  // FIX: companyId is now set inline in User.create() rather than in a
  // separate findByIdAndUpdate() call. The two-step approach meant that if
  // the update failed (e.g. during a partial seed) the supervisor had
  // companyId:null and could never see any students.
  const [mtnSup, ecgSup] = await User.create([
    { name:'Mr. Kofi Boateng', email:'k.boateng@mtn.com',  password:'Supervisor1234!', role:'industrial', companyOrg:'MTN Ghana',                    companyId:mtn._id, needsPasswordChange:false },
    { name:'Eng. Ama Sarpong', email:'a.sarpong@ecg.com',  password:'Supervisor1234!', role:'industrial', companyOrg:'Electricity Company of Ghana', companyId:ecg._id, needsPasswordChange:false },
  ]);

  // ── Students ─────────────────────────────────────────────────
  console.log('🧑‍🎓  Seeding students...');
  const [kwame, abena, kofi, pending] = await User.create([
    { name:'Kwame Mensah',  email:'kwame@st.uenr.edu.gh', password:'Student1234!', role:'student', indexNumber:'UEB3214522', department:'Computer Science',       status:'Placed',  completedWeeks:4, totalWeeks:6, companyId:mtn._id, companyName:'MTN Ghana',                    placementStatus:'Active', academicSupervisor:drFrimpong._id, industrialSupervisor:mtnSup._id, needsPasswordChange:false },
    { name:'Abena Serwaa',  email:'abena@st.uenr.edu.gh', password:'Student1234!', role:'student', indexNumber:'UEB3214523', department:'ITDS',                   status:'Placed',  completedWeeks:3, totalWeeks:6, companyId:mtn._id, companyName:'MTN Ghana',                    placementStatus:'Active', academicSupervisor:drFrimpong._id, industrialSupervisor:mtnSup._id, needsPasswordChange:false },
    { name:'Kofi Asante',   email:'kofi@st.uenr.edu.gh',  password:'Student1234!', role:'student', indexNumber:'UEB3214524', department:'Computer Science',       status:'Graded',  completedWeeks:6, totalWeeks:6, companyId:ecg._id, companyName:'Electricity Company of Ghana', placementStatus:'Active', academicSupervisor:drAmoah._id,    industrialSupervisor:ecgSup._id, needsPasswordChange:false },
    { name:'Adwoa Darko',   email:'adwoa@st.uenr.edu.gh', password:'Student1234!', role:'student', indexNumber:'UEB3214525', department:'Mechanical Engineering', status:'Pending', needsPasswordChange:false },
  ]);

  // ── Logs (using Log model, not LogEntry) ─────────────────────
  console.log('📓  Seeding log entries...');
  // FIX: Log model uses: student, company, companyName, date, activity, skills, week, status
  await Log.create([
    { student:kwame._id, company:mtn._id, companyName:'MTN Ghana', week:4, date:new Date('2025-02-23'), activity:'Implemented JWT authentication middleware and tested all login routes via Postman. Resolved token expiry bug.', skills:'Node.js, JWT, Backend Security', status:'Approved' },
    { student:kwame._id, company:mtn._id, companyName:'MTN Ghana', week:4, date:new Date('2025-02-24'), activity:'Optimised MongoDB schema for log collection. Added compound indexes to speed up weekly queries by 60%.', skills:'MongoDB, Database Design', status:'Pending' },
    { student:abena._id, company:mtn._id, companyName:'MTN Ghana', week:3, date:new Date('2025-02-16'), activity:'Built responsive dashboard UI with Tailwind CSS. Presented mockup to team lead and incorporated feedback.', skills:'React, Tailwind CSS, UI Design', status:'Pending' },
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
  console.log('  Admin       admin@uenr.edu.gh       Admin1234!');
  console.log('  Lecturer 1  frimpong@uenr.edu.gh    Lecturer1234!');
  console.log('  Lecturer 2  amoah@uenr.edu.gh       Lecturer1234!');
  console.log('  Industrial  k.boateng@mtn.com        Supervisor1234!');
  console.log('  Student 1   kwame@st.uenr.edu.gh    Student1234!  (Placed @ MTN)');
  console.log('  Student 2   abena@st.uenr.edu.gh    Student1234!  (Placed @ MTN)');
  console.log('  Student 3   kofi@st.uenr.edu.gh     Student1234!  (Graded)');
  console.log('  Student 4   adwoa@st.uenr.edu.gh    Student1234!  (Pending)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  mongoose.disconnect();
};

seed().catch(err => {
  console.error('Seed failed:', err);
  mongoose.disconnect();
  process.exit(1);
});