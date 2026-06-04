/**
 * SalDesk — Image Upload Route
 * POST /api/v1/upload/image
 *
 * Dependencies (install in backend):
 *   npm install multer sharp
 */

const express  = require('express');
const multer   = require('multer');
const sharp    = require('sharp');
const path     = require('path');
const fs       = require('fs');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

/* ── Constants ── */
const UPLOAD_ROOT    = '/var/www/saldesk/uploads/operators';
const MAX_FILE_SIZE  = 5 * 1024 * 1024;  // 5MB
const ALLOWED_MIMES  = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_WIDTH      = 1200;
const THUMB_WIDTH    = 400;
const WEBP_QUALITY   = 85;
const THUMB_QUALITY  = 80;

/* ── Multer — memory storage (we process with sharp before writing) ── */
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(Object.assign(new Error('Formato invalido. Usa JPG, PNG ou WebP.'), { status: 400 }));
    }
  },
});

/* ── POST /upload/image ── */
router.post('/image', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Nenhum ficheiro recebido.' });
    }

    const operatorId  = req.operator?.id || req.user?.operator_id;
    if (!operatorId) {
      return res.status(401).json({ success: false, error: 'Operador nao identificado.' });
    }

    const operatorDir = path.join(UPLOAD_ROOT, operatorId);
    const thumbDir    = path.join(operatorDir, 'thumbnails');
    fs.mkdirSync(operatorDir, { recursive: true });
    fs.mkdirSync(thumbDir,    { recursive: true });

    const timestamp = Date.now();
    const filename  = `${timestamp}.webp`;
    const thumbname = `${timestamp}_thumb.webp`;

    /* Main image — resize to max width, convert to WebP */
    await sharp(req.file.buffer)
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toFile(path.join(operatorDir, filename));

    /* Thumbnail — 400px width */
    await sharp(req.file.buffer)
      .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
      .webp({ quality: THUMB_QUALITY })
      .toFile(path.join(thumbDir, thumbname));

    const baseUrl = process.env.API_URL || 'https://api.saldesk.cv';
    const url      = `${baseUrl}/uploads/operators/${operatorId}/${filename}`;
    const thumbUrl = `${baseUrl}/uploads/operators/${operatorId}/thumbnails/${thumbname}`;

    return res.json({
      success: true,
      data: { url, thumbnail_url: thumbUrl },
    });

  } catch (err) {
    console.error('[upload] Error:', err);
    if (err.status === 400) {
      return res.status(400).json({ success: false, error: err.message });
    }
    return res.status(500).json({ success: false, error: 'Erro ao processar imagem.' });
  }
});

/* ── Error handler for multer ── */
router.use((err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, error: 'Ficheiro demasiado grande. Maximo 5MB.' });
  }
  if (err.message?.includes('Formato')) {
    return res.status(400).json({ success: false, error: err.message });
  }
  return res.status(500).json({ success: false, error: 'Erro no upload.' });
});

module.exports = router;
