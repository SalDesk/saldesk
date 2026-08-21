const express = require('express');
const router  = express.Router();
const { getConversation, sendMessage } = require('../controllers/founderChatController');
const auth  = require('../middleware/auth');
const reqOp = require('../middleware/requireOperator');

router.use(auth);
router.use(reqOp);

router.get('/',  getConversation);
router.post('/', sendMessage);

module.exports = router;
