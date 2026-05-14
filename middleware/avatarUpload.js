const path   = require('path');
const multer = require('multer');
const fs     = require('fs');

const AVATAR_DIR = path.join(__dirname, '..', 'uploads', 'avatars');

// Ensure the avatars directory exists at startup
if (!fs.existsSync(AVATAR_DIR)) {
  fs.mkdirSync(AVATAR_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, AVATAR_DIR),
  filename:    (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safe = `avatar-${Date.now()}${ext}`;
    cb(null, safe);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
  };
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed[ext] && allowed[ext] === file.mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, PNG, WebP, GIF) are accepted.'), false);
  }
};

const avatarUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
});

module.exports = avatarUpload;
