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
import PublicBooking from './pages/PublicBooking';
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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <Onboarding />
            </ProtectedRoute>
          }
        />
        <Route
          path="/"
          element={
            <OnboardingGuard>
              <Layout />
            </OnboardingGuard>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="unidades" element={<Units />} />
          <Route path="reservas" element={<Reservations />} />
          <Route path="calendario" element={<Calendar />} />
          <Route path="clientes" element={<Customers />} />
          <Route path="automacoes" element={<Automations />} />
          <Route path="financeiro" element={<Financial />} />
        </Route>
        <Route path="/book/:slug" element={<PublicBooking />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
