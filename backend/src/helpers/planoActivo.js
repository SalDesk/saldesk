/* Regra da subscricao activa (sem base de dados): usada pelo middleware requirePlanActive
   e pelo pedido automatico de avaliacao. */
function isPlanActive(operator) {
  if (!operator) return true; // deixa requireOperator/requireOperatorOrStaff tratar a ausencia
  if (operator.plan_status === 'suspended' || operator.plan_status === 'cancelled') return false;
  if (operator.plan_status === 'trial') {
    const trialExpired = operator.trial_ends_at && new Date(operator.trial_ends_at) <= new Date();
    if (!trialExpired) return true;
    const coveredByPayment = operator.plan_paid_until && new Date(operator.plan_paid_until) > new Date();
    return !!coveredByPayment;
  }
  return true; // plan_status === 'active'
}

module.exports = { isPlanActive };
