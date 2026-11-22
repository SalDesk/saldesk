import useAuthStore from '../store/authStore';

export const PLAN_LEVEL = { starter: 1, pro: 2, business: 3 };

export const FEATURE_PLAN = {
  colaboradores:         'business',
  guias:                 'business',
  financeiro:            'business',
  marketing:             'business',
  analytics:             'business',
  vouchers:              'business',
  afiliados:             'business',
  meteorologia:          'business',
  integracoes:           'pro',
  automacoes:            'pro',
  fidelidade:            'pro',
  grupos:                'pro',
  pacotes:               'pro',
  parcerias:             'pro',
  previsao:              'pro',
  'financeiro-completo': 'pro',
  vendedor:              'pro',
};

/* Chave i18n da descricao de cada funcionalidade no aviso de upgrade (textos em plan.features.<feature>
   dos json). As chaves de FEATURE_PLAN sao ids e nao mudam. */
export const FEATURE_DESCRIPTION_KEYS = Object.fromEntries(
  Object.keys(FEATURE_PLAN).map((feature) => [feature, `plan.features.${feature}`])
);

export const PLAN_PRICES = { starter: 29, pro: 69, business: 79 };

export default function usePlan() {
  const { operator } = useAuthStore();
  const plan        = operator?.plan        || 'starter';
  const planStatus  = operator?.plan_status  || null;
  const trialEndsAt = operator?.trial_ends_at || null;

  function getPlanLevel() {
    return PLAN_LEVEL[plan] || 1;
  }

  function canAccess(feature) {
    const required = FEATURE_PLAN[feature];
    if (!required) return true;
    return getPlanLevel() >= (PLAN_LEVEL[required] || 1);
  }

  function isInTrial() {
    return planStatus === 'trial' && !!trialEndsAt && new Date(trialEndsAt) > new Date();
  }

  function isTrialExpired() {
    return planStatus === 'trial' && !!trialEndsAt && new Date(trialEndsAt) <= new Date();
  }

  function trialDaysLeft() {
    if (!trialEndsAt) return 0;
    const diff = new Date(trialEndsAt) - new Date();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  return {
    plan, planStatus, trialEndsAt,
    getPlanLevel, canAccess,
    isInTrial, isTrialExpired, trialDaysLeft,
  };
}
