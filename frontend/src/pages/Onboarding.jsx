import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import AuthLayout from '../components/auth/AuthLayout';
import OnboardingWizard from '../components/onboarding/OnboardingWizard';

export default function Onboarding() {
  const { operator } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (operator?.onboarding_complete) navigate('/');
  }, [operator, navigate]);

  return (
    <AuthLayout showLangToggle>
      <OnboardingWizard />
    </AuthLayout>
  );
}
