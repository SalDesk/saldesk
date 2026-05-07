import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import OnboardingWizard from '../components/onboarding/OnboardingWizard';

export default function Onboarding() {
  const { operator } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (operator?.onboarding_complete) navigate('/');
  }, [operator, navigate]);

  return (
    <div className="min-h-screen bg-n-50 flex items-center justify-center p-4">
      <OnboardingWizard />
    </div>
  );
}
