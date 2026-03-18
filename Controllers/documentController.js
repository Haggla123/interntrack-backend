// Controllers/documentController.js
const path     = require('path');
const fs       = require('fs');
const Document = require('../models/Document');
const User     = require('../models/User');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

// ── POST /api/documents — upload a PDF ───────────────────────────
const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded. Please attach a PDF.' });
    }

    const { type = 'attachment-letter', studentId, isPublic } = req.body;
    const isPublicDoc = isPublic === true || isPublic === 'true';
    const targetStudent = isPublicDoc ? null : (studentId || req.user._id);

    // Student uploading final report: replace any previous submission so there's always exactly one
    if (type === 'final-report' && !isPublicDoc) {
      const old = await Document.find({ student: targetStudent, type: 'final-report' });
      old.forEach(d => {
        const fp = path.join(UPLOAD_DIR, d.storedName);
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      });
      await Document.deleteMany({ student: targetStudent, type: 'final-report' });
    }

    // Admin uploading a public letter: replace any existing public doc with same original name
    if (isPublicDoc) {
      const old = await Document.find({ isPublic: true, filename: req.file.originalname });
      old.forEach(d => {
        const fp = path.join(UPLOAD_DIR, d.storedName);
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      });
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
        companyId: req.user.companyId, role: 'student', isActive: true,
      }).select('_id');
      filter.student  = { $in: myStudents.map(s => s._id) };
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

    // Students can only download their own docs or public docs
    if (
      req.user.role === 'student' &&
      !doc.isPublic &&
      doc.student?.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const filePath = path.join(UPLOAD_DIR, doc.storedName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found on server.' });
    }

    res.setHeader('Content-Type', doc.mimeType || 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${doc.filename}"`);
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
    const filePath = path.join(UPLOAD_DIR, doc.storedName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await doc.deleteOne();
    res.status(200).json({ success: true, message: 'Document deleted.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { uploadDocument, getDocuments, downloadDocument, deleteDocument };