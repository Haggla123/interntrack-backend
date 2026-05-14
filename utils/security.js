const path = require('path');

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const safeDownloadName = (filename = 'document.pdf') => {
  const base = path.basename(String(filename)).replace(/[\r\n"]/g, '_');
  return base || 'document.pdf';
};

module.exports = { escapeHtml, safeDownloadName };
