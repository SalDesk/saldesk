import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/authStore';
import Login from './pages/Login';
import Register from './pages/Register';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import Units from './pages/Units';
import Reservations from './pages/Reservations';
import Calendar from './pages/Calendar';
import Customers from './pages/Customers';
import Automations from './pages/Automations';
import Financial from './pages/Financial';
import Integrations from './pages/Integrations';
import Settings from './pages/Settings';
import Staff from './pages/Staff';
import Reviews from './pages/Reviews';
import Profile from './pages/Profile';
import Fleet from './pages/Fleet';
import Messages from './pages/Messages';
import PublicBooking from './pages/PublicBooking';
import ServiceDetail from './pages/ServiceDetail';
import StaffPortal from './pages/StaffPortal';
import AdminLayout from './components/layout/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminOperators from './pages/admin/AdminOperators';
import AdminLeads from './pages/admin/AdminLeads';
import AdminCms from './pages/admin/AdminCms';
import Layout from './components/layout/Layout';

function ProtectedRoute({ children }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function OnboardingGuard({ children }) {
  const { token, operator } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  if (!operator?.onboarding_complete) return <Navigate to="/onboarding" replace />;
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
      <Routes>
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />

        {/* Dashboard do gestor */}
        <Route path="/" element={<OnboardingGuard><Layout /></OnboardingGuard>}>
          <Route index                element={<Dashboard />} />
          <Route path="unidades"      element={<Units />} />
          <Route path="reservas"      element={<Reservations />} />
          <Route path="calendario"    element={<Calendar />} />
          <Route path="clientes"      element={<Customers />} />
          <Route path="automacoes"    element={<Automations />} />
          <Route path="financeiro"    element={<Financial />} />
          <Route path="integracoes"   element={<Integrations />} />
          <Route path="colaboradores" element={<Staff />} />
          <Route path="frota"         element={<Fleet />} />
          <Route path="mensagens"     element={<Messages />} />
          <Route path="avaliacoes"    element={<Reviews />} />
          <Route path="definicoes"    element={<Settings />} />
          <Route path="perfil"        element={<Profile />} />
        </Route>

        {/* Painel do Fundador — protegido por role FUNDADOR */}
        <Route path="/admin" element={<FounderGuard><AdminLayout /></FounderGuard>}>
          <Route index                       element={<AdminDashboard />} />
          <Route path="operators"            element={<AdminOperators />} />
          <Route path="leads"                element={<AdminLeads />} />
          <Route path="cms/featured"         element={<AdminCms type="featured" />} />
          <Route path="cms/banners"          element={<AdminCms type="banners" />} />
          <Route path="cms/experiences"      element={<AdminCms type="experiences" />} />
          <Route path="cms/events"           element={<AdminCms type="events" />} />
          <Route path="cms/articles"         element={<AdminCms type="articles" />} />
        </Route>

        {/* Portal do colaborador — mobile-first */}
        <Route path="/staff/*" element={<ProtectedRoute><StaffPortal /></ProtectedRoute>} />

        {/* Motor de reserva publica */}
        <Route path="/book/:slug" element={<PublicBooking />} />
        <Route path="/book/:slug/servico/:id" element={<ServiceDetail />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
