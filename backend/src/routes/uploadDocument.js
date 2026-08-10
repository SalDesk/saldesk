/**
 * SalDesk — Document Upload Route
 * POST /api/v1/upload/document
 *
 * Para contratos/documentos de identificacao/certificados (PDF ou digitalizacoes
 * em imagem) -- separado de upload.js porque esse esta hard-coded para imagens
 * e processa tudo com sharp (nao aplicavel a PDFs).
 */

const express  = require('express');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

const UPLOADS_DIR   = process.env.UPLOADS_DIR || '/var/www/saldesk/uploads';
const UPLOAD_ROOT   = path.join(UPLOADS_DIR, 'operators');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIMES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const EXT_BY_MIME    = {
  'application/pdf': 'pdf',
  'image/jpeg':       'jpg',
  'image/png':        'png',
  'image/webp':       'webp',
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(Object.assign(new Error('Formato invalido. Usa PDF, JPG, PNG ou WebP.'), { status: 400 }));
    }
  },
});

router.post('/document', authMiddleware, upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Nenhum ficheiro recebido.' });
    }

    const operatorId = req.operator?.id || req.user?.operator_id;
    if (!operatorId) {
      return res.status(401).json({ success: false, error: 'Operador nao identificado.' });
    }

    const docDir = path.join(UPLOAD_ROOT, operatorId, 'documents');
    fs.mkdirSync(docDir, { recursive: true });

    const ext      = EXT_BY_MIME[req.file.mimetype];
    const filename = `${Date.now()}.${ext}`;
    fs.writeFileSync(path.join(docDir, filename), req.file.buffer);

    const baseUrl = process.env.API_URL || 'https://api.saldesk.cv';
    const url = `${baseUrl}/uploads/operators/${operatorId}/documents/${filename}`;

    return res.json({ success: true, data: { url } });
  } catch (err) {
    console.error('[upload/document] Error:', err);
    if (err.status === 400) {
      return res.status(400).json({ success: false, error: err.message });
    }
    return res.status(500).json({ success: false, error: 'Erro ao processar documento.' });
  }
});

router.use((err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, error: 'Ficheiro demasiado grande. Maximo 10MB.' });
  }
  if (err.message?.includes('Formato')) {
    return res.status(400).json({ success: false, error: err.message });
  }
  return res.status(500).json({ success: false, error: 'Erro no upload.' });
});

module.exports = router;
