import {
  LayoutDashboard, Calendar, CalendarDays,
  Users, UserCheck, UsersRound, BarChart2,
  Star, MessageCircle, MessageSquare, Globe, Megaphone, Settings, Zap,
  Compass, Hotel, Car, UtensilsCrossed, ChefHat, Wrench,
  Activity, Award, Tag, FileWarning, ThumbsUp, CloudSun, LineChart,
  UserPlus, Users2, Package, Handshake, Sparkles, Layers, ClipboardList, ClipboardCheck,
} from 'lucide-react';
import { getT } from '../../i18n';

/* Seccoes da navegacao, pela ordem de apresentacao (labelKey: chave i18n do rotulo) */
export const NAV_SECTIONS = [
  { id: 'operacao',     labelKey: 'nav.sections.operacao',     defaultCollapsed: false },
  { id: 'clientes',     labelKey: 'nav.sections.clientes',     defaultCollapsed: false },
  { id: 'gestao',       labelKey: 'nav.sections.gestao',       defaultCollapsed: false },
  { id: 'crescimento',  labelKey: 'nav.sections.crescimento',  defaultCollapsed: true  },
  { id: 'configuracao', labelKey: 'nav.sections.configuracao', defaultCollapsed: true  },
];

/* Badge de plano nos itens bloqueados (nomes dos planos, iguais em todas as linguas) */
export const PLAN_BADGE = {
  business: { label: 'Business', cls: 'bg-ocean-600 text-white' },
  pro:      { label: 'Pro',      cls: 'bg-sand-500 text-white'   },
};

const ALL = ['activity', 'hotel', 'rentacar', 'restaurant'];

/* requiredPlan: plan gate | feature: chave para a descricao do UpgradeModal
   types: tipos de operador onde o item aparece | labelKeyByType: chave do rotulo especifico por tipo */
const NAV_ITEMS = [
  /* Operacao */
  { to: '/',             icon: LayoutDashboard, labelKey: 'nav.dashboard',       section: 'operacao', end: true, types: ALL },
  {
    to: '/unidades', icon: Compass, labelKey: 'nav.units', section: 'operacao', types: ALL,
    labelKeyByType: { activity: 'nav.toursActivities', hotel: 'nav.rooms', rentacar: 'nav.fleet', restaurant: 'nav.tables' },
    iconByType: { activity: Compass, hotel: Hotel, rentacar: Car, restaurant: UtensilsCrossed },
  },
  { to: '/reservas',     icon: Calendar,        labelKey: 'nav.reservations',    section: 'operacao', types: ALL },
  { to: '/calendario',   icon: CalendarDays,    labelKey: 'nav.calendar',        section: 'operacao', types: ALL },
  { to: '/guias',        icon: Users,           labelKey: 'nav.guides',          section: 'operacao', types: ['activity'], requiredPlan: 'business', feature: 'guias' },
  { to: '/frota',        icon: Car,             labelKey: 'nav.fleet',           section: 'operacao', types: ['activity'] },
  { to: '/housekeeping', icon: Sparkles,        labelKey: 'nav.housekeeping',    section: 'operacao', types: ['hotel'] },
  { to: '/manutencao',   icon: Wrench,          labelKey: 'nav.maintenance',     section: 'operacao', types: ['rentacar'] },
  { to: '/menu-digital', icon: ChefHat,         labelKey: 'nav.menu',            section: 'operacao', types: ['restaurant'] },
  { to: '/pedidos',      icon: ClipboardCheck,  labelKey: 'nav.orders',          section: 'operacao', types: ['restaurant'] },

  /* Clientes */
  { to: '/clientes',          icon: UserCheck,     labelKey: 'nav.customers',       section: 'clientes', types: ALL },
  { to: '/mensagens',         icon: MessageCircle, labelKey: 'nav.messages',        section: 'clientes', types: ALL },
  { to: '/mensagens-saldesk', icon: MessageSquare, labelKey: 'nav.messagesSaldesk', section: 'clientes', types: ALL },
  { to: '/avaliacoes',        icon: Star,          labelKey: 'nav.reviews',         section: 'clientes', types: ALL },
  { to: '/ocorrencias',       icon: FileWarning,   labelKey: 'nav.occurrences',     section: 'clientes', types: ['activity', 'rentacar'] },
  { to: '/feedback',          icon: ThumbsUp,      labelKey: 'nav.feedback',        section: 'clientes', types: ['activity'] },

  /* Gestao */
  { to: '/financeiro',    icon: BarChart2,     labelKey: 'nav.financial', section: 'gestao', types: ALL },
  { to: '/analytics',     icon: Activity,      labelKey: 'nav.analytics', section: 'gestao', types: ALL, requiredPlan: 'business', feature: 'analytics' },
  { to: '/previsao',      icon: LineChart,     labelKey: 'nav.forecast',  section: 'gestao', types: ['activity'], requiredPlan: 'pro', feature: 'previsao' },
  { to: '/meteorologia',  icon: CloudSun,      labelKey: 'nav.weather',   section: 'gestao', types: ['activity'], requiredPlan: 'business', feature: 'meteorologia' },
  { to: '/colaboradores', icon: UsersRound,    labelKey: 'nav.staff',     section: 'gestao', types: ALL, requiredPlan: 'business', feature: 'colaboradores' },
  { to: '/rh',            icon: ClipboardList, labelKey: 'nav.hr',        section: 'gestao', types: ALL, requiredPlan: 'business', feature: 'colaboradores' },

  /* Crescimento */
  { to: '/marketing',   icon: Megaphone, labelKey: 'nav.marketing',      section: 'crescimento', types: ALL, requiredPlan: 'business', feature: 'marketing' },
  { to: '/integracoes', icon: Globe,     labelKey: 'nav.channelManager', section: 'crescimento', types: ['activity'], requiredPlan: 'pro', feature: 'integracoes' },
  { to: '/automacoes',  icon: Zap,       labelKey: 'nav.automations',    section: 'crescimento', types: ALL, requiredPlan: 'pro', feature: 'automacoes' },
  { to: '/fidelidade',  icon: Award,     labelKey: 'nav.loyalty',        section: 'crescimento', types: ALL, requiredPlan: 'pro', feature: 'fidelidade' },
  { to: '/vouchers',    icon: Tag,       labelKey: 'nav.vouchers',       section: 'crescimento', types: ALL, requiredPlan: 'business', feature: 'vouchers' },
  { to: '/afiliados',   icon: UserPlus,  labelKey: 'nav.affiliates',     section: 'crescimento', types: ['activity', 'hotel', 'rentacar'], requiredPlan: 'business', feature: 'afiliados' },
  { to: '/grupos',      icon: Users2,    labelKey: 'nav.groups',         section: 'crescimento', types: ['activity', 'hotel', 'rentacar'], requiredPlan: 'pro', feature: 'grupos' },
  { to: '/pacotes',     icon: Package,   labelKey: 'nav.packages',       section: 'crescimento', types: ['activity', 'hotel', 'rentacar'], requiredPlan: 'pro', feature: 'pacotes' },
  { to: '/parcerias',   icon: Handshake, labelKey: 'nav.partnerships',   section: 'crescimento', types: ALL, requiredPlan: 'pro', feature: 'parcerias' },

  /* Configuracao */
  { to: '/editor-pagina', icon: Layers,   labelKey: 'nav.pageEditor', section: 'configuracao', types: ALL },
  { to: '/definicoes',    icon: Settings, labelKey: 'nav.settings',   section: 'configuracao', types: ALL },
];

/* Devolve as seccoes (sem as vazias) com os itens do tipo de operador, ja com o rotulo traduzido por t
   (o t de useT() no componente; sem t, portugues). Cada item e seccao guarda tambem a sua labelKey.
   Tipo desconhecido ou em falta usa hotel. */
export function getNavSections(opType, t = getT('pt')) {
  const tipo = ALL.includes(opType) ? opType : 'hotel';

  const items = NAV_ITEMS
    .filter((item) => item.types.includes(tipo))
    .map(({ types, labelKeyByType, iconByType, ...item }) => {
      const labelKey = labelKeyByType?.[tipo] || item.labelKey;
      return {
        ...item,
        labelKey,
        label: t(labelKey),
        icon: iconByType?.[tipo] || item.icon,
      };
    });

  return NAV_SECTIONS
    .map((section) => ({ ...section, label: t(section.labelKey), items: items.filter((i) => i.section === section.id) }))
    .filter((section) => section.items.length > 0);
}

/* Item bloqueado pelo plano do operador */
export function isLocked(item, canAccess) {
  return !!item.requiredPlan && !canAccess(item.feature || item.requiredPlan);
}

/* Minusculas e sem acentos, para pesquisa */
function normalizar(texto) {
  return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/* Filtra itens pelo rotulo (na lingua em que foi traduzido); consulta vazia devolve tudo */
export function filterNavItems(items, query) {
  const q = normalizar(query).trim();
  if (!q) return items;
  return items.filter((item) => normalizar(item.label).includes(q));
}

/* Id da seccao cujo item corresponde a rota (igualdade ou prefixo seguido de /) */
export function sectionIdOfPath(sections, pathname) {
  for (const section of sections) {
    for (const item of section.items) {
      if (pathname === item.to) return section.id;
      if (item.to !== '/' && pathname.startsWith(`${item.to}/`)) return section.id;
    }
  }
  return null;
}
