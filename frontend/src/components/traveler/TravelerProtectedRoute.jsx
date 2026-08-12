import { Navigate } from 'react-router-dom';
import useTravelerAuthStore from '../../store/travelerAuthStore';

export default function TravelerProtectedRoute({ children }) {
  const token = useTravelerAuthStore((s) => s.token);
  if (!token) return <Navigate to="/viajante/entrar" replace />;
  return children;
}
