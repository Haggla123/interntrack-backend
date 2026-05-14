// Controllers/documentController.js
const path     = require('path');
const fs       = require('fs');
const Document = require('../models/Document');
const User     = require('../models/User');
const { requireStudentAccess } = require('../utils/accessControl');
const { safeDownloadName } = require('../utils/security');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

const removeStoredFile = async (storedName) => {
  if (!storedName) return;
  const filePath = path.join(UPLOAD_DIR, storedName);
  try {
    await fs.promises.unlink(filePath);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
};

// ── POST /api/documents — upload a PDF ───────────────────────────
const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded. Please attach a PDF.' });
    }

    const { type = 'attachment-letter', studentId, isPublic } = req.body;
    const requestedPublic = isPublic === true || isPublic === 'true';
    if (requestedPublic && req.user.role !== 'admin') {
      await removeStoredFile(req.file.filename);
      return res.status(403).json({ message: 'Only administrators can upload public documents.' });
    }
    if (req.user.role === 'student' && (type !== 'final-report' || studentId)) {
      await removeStoredFile(req.file.filename);
      return res.status(403).json({ message: 'Students may only upload their own final report.' });
    }

    const isPublicDoc = req.user.role === 'admin' && requestedPublic;
    const targetStudent = isPublicDoc ? null : (req.user.role === 'student' ? req.user._id : (studentId || null));
    if (!isPublicDoc && !targetStudent) {
      await removeStoredFile(req.file.filename);
      return res.status(400).json({ message: 'A student is required for private documents.' });
    }

    // Student uploading final report: replace any previous submission so there's always exactly one
    if (type === 'final-report' && !isPublicDoc) {
      const old = await Document.find({ student: targetStudent, type: 'final-report' });
      await Promise.all(old.map(d => removeStoredFile(d.storedName)));
      await Document.deleteMany({ student: targetStudent, type: 'final-report' });
    }

    // Admin uploading a public letter: replace any existing public doc with same original name
    if (isPublicDoc) {
      const old = await Document.find({ isPublic: true, filename: req.file.originalname });
      await Promise.all(old.map(d => removeStoredFile(d.storedName)));
      await Document.deleteMany({ isPublic: true, filename: req.file.originalname });
    }

    const doc = await Document.create({
      uploadedBy:  req.user._id,
      student:     targetStudent,
      type,
      filename:    req.file.originalname,
      storedName:  req.file.filename,
      mimeType:    req.file.mimetype,
      fileSize:    req.file.size,
      isPublic:    isPublicDoc,
    });

    // Return without storedName for security
    const { storedName: _, ...safe } = doc.toObject();
    res.status(201).json({ success: true, data: safe });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET /api/documents — list documents ──────────────────────────
const getDocuments = async (req, res) => {
  try {
    let filter = {};

    if (req.user.role === 'student') {
      filter.$or = [
        { student: req.user._id },
        { isPublic: true },
      ];

    } else if (req.user.role === 'admin' && req.query.public === 'true') {
      filter.isPublic = true;
      filter.student  = null;

    } else if (req.user.role === 'admin') {
      if (req.query.studentId) filter.student = req.query.studentId;

    } else if (req.user.role === 'academic') {
      const myStudents = await User.find({
        academicSupervisor: req.user._id, role: 'student', isActive: true,
      }).select('_id');

      if (req.query.studentId) {
        // Only allow access if this student is actually assigned to this supervisor
        const owns = myStudents.some(s => s._id.toString() === req.query.studentId);
        if (!owns) return res.status(403).json({ message: 'Access denied.' });
        filter.student = req.query.studentId;
      } else {
        filter.student = { $in: myStudents.map(s => s._id) };
      }
      filter.isPublic = { $ne: true };

    } else if (req.user.role === 'industrial') {
      const myStudents = await User.find({
        industrialSupervisor: req.user._id, role: 'student', isActive: true,
      }).select('_id');
      filter.student  = { $in: myStudents.map(s => s._id) };
      filter.isPublic = { $ne: true };
    } else if (req.user.role === 'company_manager') {
      if (!req.user.companyId) {
        return res.status(200).json({ success: true, data: [] });
      }
      const myStudents = await User.find({
        companyId: req.user.companyId, role: 'student', isActive: true,
      }).select('_id');
      filter.student = { $in: myStudents.map(s => s._id) };
      filter.isPublic = { $ne: true };
    }

    if (req.query.type) filter.type = req.query.type;

    const docs = await Document.find(filter)
      .select('-storedName')
      .populate('student', 'name indexNumber')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: docs });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET /api/documents/:id/download — stream the file ────────────
const downloadDocument = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Document not found.' });

    if (!doc.isPublic) {
      const student = await requireStudentAccess(req, res, doc.student);
      if (!student) return;
    }

    const filePath = path.join(UPLOAD_DIR, doc.storedName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found on server.' });
    }

    res.setHeader('Content-Type', doc.mimeType || 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeDownloadName(doc.filename)}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── DELETE /api/documents/:id ─────────────────────────────────────
const deleteDocument = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Document not found.' });

    const isOwner = doc.uploadedBy.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    // Remove file from disk
    await removeStoredFile(doc.storedName);

    await doc.deleteOne();
    res.status(200).json({ success: true, message: 'Document deleted.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { uploadDocument, getDocuments, downloadDocument, deleteDocument };
