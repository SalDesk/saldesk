const express = require('express');
const router = express.Router();
const {
  listUnits, createUnit, getUnit, updateUnit, deleteUnit, submeterParaConect,
  createPricingRule, updatePricingRule, deletePricingRule
} = require('../controllers/unitsController');
const authMiddleware = require('../middleware/auth');
const requireOperatorOrStaff = require('../middleware/requireOperatorOrStaff');
const requirePlanActive = require('../middleware/requirePlanActive');

router.use(authMiddleware);
router.use(requireOperatorOrStaff);
router.use(requirePlanActive);

router.get('/', listUnits);
router.post('/', createUnit);
router.get('/:id', getUnit);
router.put('/:id', updateUnit);
router.delete('/:id', deleteUnit);
router.put('/:id/conect-status', submeterParaConect);

router.post('/:id/pricing-rules', createPricingRule);
router.put('/:id/pricing-rules/:ruleId', updatePricingRule);
router.delete('/:id/pricing-rules/:ruleId', deletePricingRule);

module.exports = router;
