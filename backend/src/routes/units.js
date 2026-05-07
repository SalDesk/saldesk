const express = require('express');
const router = express.Router();
const {
  listUnits, createUnit, getUnit, updateUnit, deleteUnit,
  createPricingRule, updatePricingRule, deletePricingRule
} = require('../controllers/unitsController');
const authMiddleware = require('../middleware/auth');
const requireOperator = require('../middleware/requireOperator');

router.use(authMiddleware);
router.use(requireOperator);

router.get('/', listUnits);
router.post('/', createUnit);
router.get('/:id', getUnit);
router.put('/:id', updateUnit);
router.delete('/:id', deleteUnit);

router.post('/:id/pricing-rules', createPricingRule);
router.put('/:id/pricing-rules/:ruleId', updatePricingRule);
router.delete('/:id/pricing-rules/:ruleId', deletePricingRule);

module.exports = router;
