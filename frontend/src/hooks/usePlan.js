import useAuthStore from '../store/authStore';

export const PLAN_LEVEL = { starter: 1, business: 2, pro: 3 };

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

export const FEATURE_DESCRIPTIONS = {
  colaboradores:         'Gere a tua equipa, atribui trabalhos e acompanha o desempenho de cada colaborador.',
  guias:                 'Cria perfis de guias, define disponibilidade e acompanha as suas avaliacoes e missoes.',
  financeiro:            'Acede a relatorios financeiros detalhados, exportacoes e analise de receitas por tour.',
  marketing:             'Cria campanhas, agenda publicacoes e monitoriza o desempenho do teu marketing digital.',
  analytics:             'Analisa tendencias, fontes de trafego e metricas de crescimento do negocio.',
  vouchers:              'Cria e gere vouchers e codigos de desconto para os teus clientes.',
  afiliados:             'Expande o teu alcance com um programa de afiliados e comissoes automaticas.',
  meteorologia:          'Consulta previsoes meteorologicas e recebe alertas para dias com tours agendados.',
  integracoes:           'Liga o teu negocio ao Viator e GetYourGuide e gere reservas de plataformas externas num so lugar.',
  automacoes:            'Configura sequencias de comunicacao automatica por email e WhatsApp para cada etapa da reserva.',
  fidelidade:            'Fideliza os teus clientes com um programa de pontos, recompensas e beneficios exclusivos.',
  grupos:                'Gere grupos corporativos, eventos especiais e reservas em grupo com faturacao centralizada.',
  pacotes:               'Cria pacotes sazonais e combina servicos para aumentar o valor medio por cliente.',
  parcerias:             'Establece parcerias de cross-selling com outros operadores e partilha comissoes automaticamente.',
  previsao:              'Usa dados historicos e condicoes externas para prever a procura e optimizar a disponibilidade.',
  'financeiro-completo': 'Controla despesas operacionais, salarios e obrigacoes fiscais com relatorios e exportacoes completos.',
  vendedor:              'Activa o modo Vendedor de Praia — colaboradores vendem tours no campo com uma app simplificada.',
};

export const PLAN_PRICES = { starter: 29, business: 69, pro: 129 };

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
