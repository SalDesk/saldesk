import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/authStore';
import Layout from './components/layout/Layout';
import PlanGuard from './components/PlanGuard';

// Eager — critical path, must load instantly
import Login from './pages/Login';
import Register from './pages/Register';
import ResetPassword from './pages/ResetPassword';
import PublicBooking from './pages/PublicBooking';
import ServiceDetail from './pages/ServiceDetail';

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
const Staff           = lazy(() => import('./pages/Staff'));
const Reviews         = lazy(() => import('./pages/Reviews'));
const Profile         = lazy(() => import('./pages/Profile'));
const Fleet           = lazy(() => import('./pages/Fleet'));
const Messages        = lazy(() => import('./pages/Messages'));
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
const StaffPortal     = lazy(() => import('./pages/StaffPortal'));
const Housekeeping    = lazy(() => import('./pages/Housekeeping'));

// Lazy — admin panel
const AdminLayout     = lazy(() => import('./components/layout/AdminLayout'));
const AdminDashboard  = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminOperators  = lazy(() => import('./pages/admin/AdminOperators'));
const AdminLeads      = lazy(() => import('./pages/admin/AdminLeads'));
const AdminCms        = lazy(() => import('./pages/admin/AdminCms'));
const AdminImpact     = lazy(() => import('./pages/admin/AdminImpact'));
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

function isVendedor(user) {
  return user?.user_metadata?.role === 'VENDEDOR' ||
         user?.user_metadata?.staff_role === 'Vendedor de Praia';
}

function OnboardingGuard({ children }) {
  const { token, operator, user } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  if (isVendedor(user)) return <Navigate to="/vendedor" replace />;
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
        <Route path="/register"       element={<Register />} />
        <Route path="/reset-password"  element={<ResetPassword />} />
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
          <Route path="colaboradores" element={<PlanGuard plan="business" feature="colaboradores"><Staff /></PlanGuard>} />
          <Route path="housekeeping"  element={<Housekeeping />} />
          <Route path="frota"         element={<Fleet />} />
          <Route path="mensagens"     element={<Messages />} />
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
          <Route path="definicoes"    element={<Settings />} />
          <Route path="perfil"        element={<Profile />} />
        </Route>

        {/* Painel do Fundador — protegido por role FUNDADOR */}
        <Route path="/admin" element={<FounderGuard><AdminLayout /></FounderGuard>}>
          <Route index                       element={<AdminDashboard />} />
          <Route path="operators"  element={<AdminOperators />} />
          <Route path="leads"      element={<AdminLeads />} />
          <Route path="cms"        element={<AdminCms />} />
          <Route path="impacto"    element={<AdminImpact />} />
          <Route path="sistema"    element={<AdminSystem />} />
        </Route>

        {/* Portal do colaborador — mobile-first */}
        <Route path="/staff/*" element={<ProtectedRoute><StaffPortal /></ProtectedRoute>} />

        {/* Portal do afiliado — publico */}
        <Route path="/afiliado/:codigo" element={<AffiliatePortal />} />

        {/* Vendedor de Praia — mobile */}
        <Route path="/vendedor" element={<BeachSellerGuard><PlanGuard plan="pro" feature="vendedor"><BeachSeller /></PlanGuard></BeachSellerGuard>} />
        <Route path="/vendedor/nova-reserva" element={<BeachSellerGuard><PlanGuard plan="pro" feature="vendedor"><BeachSale /></PlanGuard></BeachSellerGuard>} />

        {/* Motor de reserva publica */}
        <Route path="/book/:slug" element={<PublicBooking />} />
        <Route path="/book/:slug/servico/:id" element={<ServiceDetail />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
