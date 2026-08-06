const express = require('express');
const multer  = require('multer');
const router = express.Router();
const { listar, obter, actualizar, segmentos, exportCsv, importarCsv } = require('../controllers/customersController');
const authMiddleware = require('../middleware/auth');
const requireOperatorOrStaff = require('../middleware/requireOperatorOrStaff');

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname?.toLowerCase().endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(Object.assign(new Error('Formato invalido. Usa um ficheiro .csv.'), { status: 400 }));
    }
  },
});

router.use(authMiddleware);
router.use(requireOperatorOrStaff);

/* Rotas literais primeiro -- "/:id" abaixo apanharia "/import" etc. */
router.get('/segments', segmentos);
router.get('/export',   exportCsv);
router.post('/import',  upload.single('file'), importarCsv);

router.get('/',    listar);
router.get('/:id', obter);
router.put('/:id', actualizar);

/* Erros do multer (tamanho/formato do CSV) */
router.use((err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'Ficheiro demasiado grande. Maximo 5MB.', code: 'FILE_TOO_LARGE' });
  }
  if (err.message?.includes('Formato')) {
    return res.status(400).json({ error: err.message, code: 'INVALID_FORMAT' });
  }
  return res.status(500).json({ error: 'Erro no upload.', code: 'UPLOAD_ERROR' });
});

module.exports = router;
