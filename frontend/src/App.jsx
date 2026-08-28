import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/authStore';
import Layout from './components/layout/Layout';
import PlanGuard from './components/PlanGuard';
import { isVendedor, isStaff, isFounder } from './utils/userRoles';
import TravelerProtectedRoute from './components/traveler/TravelerProtectedRoute';

// Eager — critical path, must load instantly
import Login from './pages/Login';
import Register from './pages/Register';
import ResetPassword from './pages/ResetPassword';
import ImpersonateCallback from './pages/ImpersonateCallback';
import PublicBooking from './pages/PublicBooking';
import ServiceDetail from './pages/ServiceDetail';
import BookingSuccess from './pages/BookingSuccess';
import BookingCancel from './pages/BookingCancel';
import BillingSuccess from './pages/BillingSuccess';
import BillingCancel from './pages/BillingCancel';
import DemoEntry from './pages/DemoEntry';

// Lazy — dashboard pages
const Onboarding      = lazy(() => import('./pages/Onboarding'));
const Dashboard       = lazy(() => import('./pages/Dashboard'));
const Units           = lazy(() => import('./pages/Units'));
const Reservations    = lazy(() => import('./pages/Reservations'));
const Calendar        = lazy(() => import('./pages/Calendar'));
const Customers       = lazy(() => import('./pages/Customers'));
const Automations     = lazy(() => import('./pages/Automations'));
const Financial       = lazy(() => import('./pages/Financial'));
const Integrations    = lazy(() => import('./pages/Integrations'));
const Settings        = lazy(() => import('./pages/Settings'));
const PageEditor       = lazy(() => import('./pages/PageEditor'));
const Staff           = lazy(() => import('./pages/Staff'));
const StaffDetail     = lazy(() => import('./pages/StaffDetail'));
const RH              = lazy(() => import('./pages/RH'));
const Reviews         = lazy(() => import('./pages/Reviews'));
const Profile         = lazy(() => import('./pages/Profile'));
const Fleet           = lazy(() => import('./pages/Fleet'));
const Messages        = lazy(() => import('./pages/Messages'));
const FounderChat      = lazy(() => import('./pages/FounderChat'));
const Guides          = lazy(() => import('./pages/Guides'));
const Marketing       = lazy(() => import('./pages/Marketing'));
const Analytics       = lazy(() => import('./pages/Analytics'));
const Loyalty         = lazy(() => import('./pages/Loyalty'));
const Vouchers        = lazy(() => import('./pages/Vouchers'));
const Occurrences     = lazy(() => import('./pages/Occurrences'));
const Feedback        = lazy(() => import('./pages/Feedback'));
const Weather         = lazy(() => import('./pages/Weather'));
const Demand          = lazy(() => import('./pages/Demand'));
const Affiliates      = lazy(() => import('./pages/Affiliates'));
const AffiliatePortal = lazy(() => import('./pages/AffiliatePortal'));
const Groups          = lazy(() => import('./pages/Groups'));
const Packages        = lazy(() => import('./pages/Packages'));
const Partners        = lazy(() => import('./pages/Partners'));
const BeachSeller     = lazy(() => import('./pages/BeachSeller'));
const BeachSale       = lazy(() => import('./pages/BeachSale'));
const VendedorPerfil  = lazy(() => import('./pages/VendedorPerfil'));
const StaffPortal     = lazy(() => import('./pages/StaffPortal'));
const TravelerLogin         = lazy(() => import('./pages/traveler/TravelerLogin'));
const TravelerRegister      = lazy(() => import('./pages/traveler/TravelerRegister'));
const TravelerResetPassword = lazy(() => import('./pages/traveler/TravelerResetPassword'));
const TravelerOAuthCallback = lazy(() => import('./pages/traveler/TravelerOAuthCallback'));
const TravelerPortal        = lazy(() => import('./pages/traveler/TravelerPortal'));
const Housekeeping    = lazy(() => import('./pages/Housekeeping'));
const Maintenance     = lazy(() => import('./pages/Maintenance'));
const MenuDigital     = lazy(() => import('./pages/MenuDigital'));
const Pedidos         = lazy(() => import('./pages/Pedidos'));

// Lazy — admin panel
const AdminLayout     = lazy(() => import('./components/layout/AdminLayout'));
const AdminDashboard  = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminOperators  = lazy(() => import('./pages/admin/AdminOperators'));
const AdminLeads      = lazy(() => import('./pages/admin/AdminLeads'));
const AdminPipeline   = lazy(() => import('./pages/admin/AdminPipeline'));
const AdminCms        = lazy(() => import('./pages/admin/AdminCms'));
const AdminConectModeration = lazy(() => import('./pages/admin/AdminConectModeration'));
const AdminFinancial       = lazy(() => import('./pages/admin/AdminFinancial'));
const AdminCommunications  = lazy(() => import('./pages/admin/AdminCommunications'));
const AdminAnalytics       = lazy(() => import('./pages/admin/AdminAnalytics'));
const AdminImpact          = lazy(() => import('./pages/admin/AdminImpact'));
const AdminSystem     = lazy(() => import('./pages/admin/AdminSystem'));

function AppLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-n-50">
      <div className="w-8 h-8 border-2 border-ocean-700 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function ProtectedRoute({ children }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function OnboardingGuard({ children }) {
  const { token, operator, user } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  /* Um utilizador com role FUNDADOR pode tambem ter uma linha propria em
     operators (ex. usada como conta de demo/teste) -- sem esta verificacao,
     aceder a "/" directamente (sessao ja persistida, sem passar pelo
     formulario de Login.jsx que ja tem este mesmo check) caia sempre no
     Dashboard normal do operador em vez do painel /admin. */
  if (isFounder(user)) return <Navigate to="/admin" replace />;
  if (isVendedor(user)) return <Navigate to="/vendedor" replace />;
  if (isStaff(user)) return <Navigate to="/staff" replace />;
  if (!operator?.onboarding_complete) return <Navigate to="/onboarding" replace />;
  return children;
}

function BeachSellerGuard({ children }) {
  const { token, user } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  if (!isVendedor(user)) return <Navigate to="/" replace />;
  return children;
}

function FounderGuard({ children }) {
  const { token, user } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  if (user?.user_metadata?.role !== 'FUNDADOR') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<AppLoader />}>
      <Routes>
        <Route path="/login"    element={<Login />} />
        <Route path="/demo"     element={<DemoEntry />} />
        <Route path="/register"       element={<Register />} />
        <Route path="/reset-password"  element={<ResetPassword />} />
        <Route path="/impersonate-callback" element={<ImpersonateCallback />} />
        <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />

        {/* Dashboard do gestor */}
        <Route path="/" element={<OnboardingGuard><Layout /></OnboardingGuard>}>
          <Route index                element={<Dashboard />} />
          <Route path="dashboard"     element={<Dashboard />} />
          <Route path="unidades"      element={<Units />} />
          <Route path="reservas"      element={<Reservations />} />
          <Route path="calendario"    element={<Calendar />} />
          <Route path="clientes"      element={<Customers />} />
          <Route path="automacoes"    element={<PlanGuard plan="pro"      feature="automacoes">   <Automations /></PlanGuard>} />
          <Route path="financeiro"    element={<Financial />} />
          <Route path="integracoes"   element={<PlanGuard plan="pro"      feature="integracoes">  <Integrations /></PlanGuard>} />
          <Route path="guias"         element={<PlanGuard plan="business" feature="guias">        <Guides /></PlanGuard>} />
          <Route path="colaboradores" element={<Staff />} />
          <Route path="colaboradores/:staffId" element={<StaffDetail />} />
          <Route path="rh" element={<RH />} />
          <Route path="housekeeping"  element={<Housekeeping />} />
          <Route path="manutencao"    element={<Maintenance />} />
          <Route path="menu-digital"  element={<MenuDigital />} />
          <Route path="pedidos"       element={<Pedidos />} />
          <Route path="frota"         element={<Fleet />} />
          <Route path="mensagens"     element={<Messages />} />
          <Route path="mensagens-saldesk" element={<FounderChat />} />
          <Route path="avaliacoes"    element={<Reviews />} />
          <Route path="marketing"     element={<PlanGuard plan="business" feature="marketing">    <Marketing /></PlanGuard>} />
          <Route path="analytics"     element={<PlanGuard plan="business" feature="analytics">    <Analytics /></PlanGuard>} />
          <Route path="fidelidade"    element={<PlanGuard plan="pro"      feature="fidelidade">   <Loyalty /></PlanGuard>} />
          <Route path="vouchers"      element={<PlanGuard plan="business" feature="vouchers">     <Vouchers /></PlanGuard>} />
          <Route path="ocorrencias"   element={<Occurrences />} />
          <Route path="feedback"      element={<Feedback />} />
          <Route path="meteorologia"  element={<PlanGuard plan="business" feature="meteorologia"> <Weather /></PlanGuard>} />
          <Route path="previsao"      element={<PlanGuard plan="pro"      feature="previsao">     <Demand /></PlanGuard>} />
          <Route path="afiliados"     element={<PlanGuard plan="business" feature="afiliados">    <Affiliates /></PlanGuard>} />
          <Route path="grupos"        element={<PlanGuard plan="pro"      feature="grupos">       <Groups /></PlanGuard>} />
          <Route path="pacotes"       element={<PlanGuard plan="pro"      feature="pacotes">      <Packages /></PlanGuard>} />
          <Route path="parcerias"     element={<PlanGuard plan="pro"      feature="parcerias">    <Partners /></PlanGuard>} />
          <Route path="editor-pagina" element={<PageEditor />} />
          <Route path="definicoes"    element={<Settings />} />
          <Route path="perfil"        element={<Profile />} />
        </Route>

        {/* Painel do Fundador — protegido por role FUNDADOR */}
        <Route path="/admin" element={<FounderGuard><AdminLayout /></FounderGuard>}>
          <Route index                       element={<AdminDashboard />} />
          <Route path="operators"  element={<AdminOperators />} />
          <Route path="leads"      element={<AdminLeads />} />
          <Route path="pipeline"   element={<AdminPipeline />} />
          <Route path="cms"                     element={<AdminCms />} />
          <Route path="conect"                  element={<AdminConectModeration />} />
          <Route path="financeiro-plataforma"  element={<AdminFinancial />} />
          <Route path="comunicacoes"           element={<AdminCommunications />} />
          <Route path="analytics-plataforma"  element={<AdminAnalytics />} />
          <Route path="impacto"               element={<AdminImpact />} />
          <Route path="sistema"    element={<AdminSystem />} />
        </Route>

        {/* Portal do colaborador — mobile-first */}
        <Route path="/staff/*" element={<ProtectedRoute><StaffPortal /></ProtectedRoute>} />

        {/* Conta de viajante — publico, sessao completamente separada da do operador */}
        <Route path="/viajante/entrar" element={<TravelerLogin />} />
        <Route path="/viajante/registar" element={<TravelerRegister />} />
        <Route path="/viajante/recuperar-password" element={<TravelerResetPassword />} />
        <Route path="/viajante/oauth-callback" element={<TravelerOAuthCallback />} />
        <Route path="/viajante/*" element={<TravelerProtectedRoute><TravelerPortal /></TravelerProtectedRoute>} />

        {/* Portal do afiliado — publico */}
        <Route path="/afiliado/:codigo" element={<AffiliatePortal />} />

        {/* Vendedor de Praia — mobile */}
        <Route path="/vendedor" element={<BeachSellerGuard><BeachSeller /></BeachSellerGuard>} />
        <Route path="/vendedor/nova-reserva" element={<BeachSellerGuard><BeachSale /></BeachSellerGuard>} />
        <Route path="/vendedor/perfil" element={<BeachSellerGuard><VendedorPerfil /></BeachSellerGuard>} />

        {/* Motor de reserva publica */}
        <Route path="/book/success" element={<BookingSuccess />} />
        <Route path="/book/cancel" element={<BookingCancel />} />

        {/* Facturacao da subscricao SalDesk (retorno do checkout PayPal) */}
        <Route path="/definicoes/facturacao/sucesso" element={<BillingSuccess />} />
        <Route path="/definicoes/facturacao/cancelado" element={<BillingCancel />} />
        <Route path="/book/:slug" element={<PublicBooking />} />
        <Route path="/book/:slug/mesa/:tableId" element={<PublicBooking />} />
        <Route path="/book/:slug/servico/:id" element={<ServiceDetail />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
