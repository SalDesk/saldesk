const { supabaseAdmin } = require('../config/supabase');
const { isPlanActive } = require('../helpers/planoActivo');

/* Corre depois de requireOperator/requireOperatorOrStaff (precisa de
   req.operator ou req.staff ja populado). Bloqueia acesso real -- ate
   agora so o frontend esbatia o conteudo, qualquer pedido directo a API
   funcionava na mesma com trial expirado ou conta suspensa. */

async function requirePlanActive(req, res, next) {
  try {
    let operator = req.operator;

    /* Staff pertence a subscricao do operador -- se a conta do operador
       estiver suspensa/expirada, a equipa tambem fica bloqueada. */
    if (!operator && req.staff) {
      const { data } = await supabaseAdmin
        .from('operators')
        .select('plan_status, trial_ends_at, plan_paid_until')
        .eq('id', req.staff.operator_id)
        .maybeSingle();
      operator = data;
    }

    if (!isPlanActive(operator)) {
      return res.status(402).json({
        error: 'A subscricao SalDesk esta suspensa ou o periodo de avaliacao expirou. Renova o plano para continuar.',
        code: 'PLAN_INACTIVE',
      });
    }

    next();
  } catch (err) { next(err); }
}

module.exports = requirePlanActive;
