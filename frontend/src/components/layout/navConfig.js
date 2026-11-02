import {
  LayoutDashboard, Calendar, CalendarDays,
  Users, UserCheck, UsersRound, BarChart2,
  Star, MessageCircle, MessageSquare, Globe, Megaphone, Settings, Zap,
  Compass, Hotel, Car, UtensilsCrossed, ChefHat, Wrench,
  Activity, Award, Tag, FileWarning, ThumbsUp, CloudSun, LineChart,
  UserPlus, Users2, Package, Handshake, Sparkles, Layers, ClipboardList, ClipboardCheck,
} from 'lucide-react';

/* Seccoes da navegacao, pela ordem de apresentacao */
export const NAV_SECTIONS = [
  { id: 'operacao',     label: 'Operação',      defaultCollapsed: false },
  { id: 'clientes',     label: 'Clientes',      defaultCollapsed: false },
  { id: 'gestao',       label: 'Gestão',        defaultCollapsed: false },
  { id: 'crescimento',  label: 'Crescimento',   defaultCollapsed: true  },
  { id: 'configuracao', label: 'Configuração',  defaultCollapsed: true  },
];

/* Badge de plano nos itens bloqueados */
export const PLAN_BADGE = {
  business: { label: 'Business', cls: 'bg-ocean-600 text-white' },
  pro:      { label: 'Pro',      cls: 'bg-sand-500 text-white'   },
};

const ALL = ['activity', 'hotel', 'rentacar', 'restaurant'];

/* requiredPlan: plan gate | feature: chave para a descricao do UpgradeModal
   types: tipos de operador onde o item aparece | labelByType: rotulo especifico por tipo */
const NAV_ITEMS = [
  /* Operacao */
  { to: '/',             icon: LayoutDashboard, label: 'Dashboard',           section: 'operacao', end: true, types: ALL },
  {
    to: '/unidades', icon: Compass, label: 'Unidades', section: 'operacao', types: ALL,
    labelByType: { activity: 'Tours & Atividades', hotel: 'Quartos', rentacar: 'Frota', restaurant: 'Mesas' },
    iconByType: { activity: Compass, hotel: Hotel, rentacar: Car, restaurant: UtensilsCrossed },
  },
  { to: '/reservas',     icon: Calendar,        label: 'Reservas',            section: 'operacao', types: ALL },
  { to: '/calendario',   icon: CalendarDays,    label: 'Calendário',          section: 'operacao', types: ALL },
  { to: '/guias',        icon: Users,           label: 'Guias',               section: 'operacao', types: ['activity'], requiredPlan: 'business', feature: 'guias' },
  { to: '/frota',        icon: Car,             label: 'Frota',               section: 'operacao', types: ['activity'] },
  { to: '/housekeeping', icon: Sparkles,        label: 'Housekeeping',        section: 'operacao', types: ['hotel'] },
  { to: '/manutencao',   icon: Wrench,          label: 'Manutenção',          section: 'operacao', types: ['rentacar'] },
  { to: '/menu-digital', icon: ChefHat,         label: 'Menu',                section: 'operacao', types: ['restaurant'] },
  { to: '/pedidos',      icon: ClipboardCheck,  label: 'Pedidos',             section: 'operacao', types: ['restaurant'] },

  /* Clientes */
  { to: '/clientes',          icon: UserCheck,     label: 'Clientes',          section: 'clientes', types: ALL },
  { to: '/mensagens',         icon: MessageCircle, label: 'Mensagens',         section: 'clientes', types: ALL },
  { to: '/mensagens-saldesk', icon: MessageSquare, label: 'Mensagens SalDesk', section: 'clientes', types: ALL },
  { to: '/avaliacoes',        icon: Star,          label: 'Avaliações',        section: 'clientes', types: ALL },
  { to: '/ocorrencias',       icon: FileWarning,   label: 'Ocorrências',       section: 'clientes', types: ['activity', 'rentacar'] },
  { to: '/feedback',          icon: ThumbsUp,      label: 'Feedback',          section: 'clientes', types: ['activity'] },

  /* Gestao */
  { to: '/financeiro',    icon: BarChart2,  label: 'Financeiro',    section: 'gestao', types: ALL },
  { to: '/analytics',     icon: Activity,   label: 'Analytics',     section: 'gestao', types: ALL, requiredPlan: 'business', feature: 'analytics' },
  { to: '/previsao',      icon: LineChart,  label: 'Previsão',      section: 'gestao', types: ['activity'], requiredPlan: 'pro', feature: 'previsao' },
  { to: '/meteorologia',  icon: CloudSun,   label: 'Meteorologia',  section: 'gestao', types: ['activity'], requiredPlan: 'business', feature: 'meteorologia' },
  { to: '/colaboradores', icon: UsersRound, label: 'Colaboradores', section: 'gestao', types: ALL, requiredPlan: 'business', feature: 'colaboradores' },
  { to: '/rh',            icon: ClipboardList, label: 'RH',         section: 'gestao', types: ALL, requiredPlan: 'business', feature: 'colaboradores' },

  /* Crescimento */
  { to: '/marketing',   icon: Megaphone, label: 'Marketing',       section: 'crescimento', types: ALL, requiredPlan: 'business', feature: 'marketing' },
  { to: '/integracoes', icon: Globe,     label: 'Channel Manager', section: 'crescimento', types: ['activity'], requiredPlan: 'pro', feature: 'integracoes' },
  { to: '/automacoes',  icon: Zap,       label: 'Automações',      section: 'crescimento', types: ALL, requiredPlan: 'pro', feature: 'automacoes' },
  { to: '/fidelidade',  icon: Award,     label: 'Fidelidade',      section: 'crescimento', types: ALL, requiredPlan: 'pro', feature: 'fidelidade' },
  { to: '/vouchers',    icon: Tag,       label: 'Vouchers',        section: 'crescimento', types: ALL, requiredPlan: 'business', feature: 'vouchers' },
  { to: '/afiliados',   icon: UserPlus,  label: 'Afiliados',       section: 'crescimento', types: ['activity', 'hotel', 'rentacar'], requiredPlan: 'business', feature: 'afiliados' },
  { to: '/grupos',      icon: Users2,    label: 'Grupos',          section: 'crescimento', types: ['activity', 'hotel', 'rentacar'], requiredPlan: 'pro', feature: 'grupos' },
  { to: '/pacotes',     icon: Package,   label: 'Pacotes',         section: 'crescimento', types: ['activity', 'hotel', 'rentacar'], requiredPlan: 'pro', feature: 'pacotes' },
  { to: '/parcerias',   icon: Handshake, label: 'Parcerias',       section: 'crescimento', types: ALL, requiredPlan: 'pro', feature: 'parcerias' },

  /* Configuracao */
  { to: '/editor-pagina', icon: Layers,   label: 'Editor da Página', section: 'configuracao', types: ALL },
  { to: '/definicoes',    icon: Settings, label: 'Definições',       section: 'configuracao', types: ALL },
];

/* Devolve as seccoes (sem as vazias) com os itens do tipo de operador.
   Tipo desconhecido ou em falta usa hotel. */
export function getNavSections(opType) {
  const tipo = ALL.includes(opType) ? opType : 'hotel';

  const items = NAV_ITEMS
    .filter((item) => item.types.includes(tipo))
    .map(({ types, labelByType, iconByType, ...item }) => ({
      ...item,
      label: labelByType?.[tipo] || item.label,
      icon: iconByType?.[tipo] || item.icon,
    }));

  return NAV_SECTIONS
    .map((section) => ({ ...section, items: items.filter((i) => i.section === section.id) }))
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

/* Filtra itens pelo rotulo; consulta vazia devolve tudo */
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
