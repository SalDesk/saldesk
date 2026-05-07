import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingWizard from '../components/onboarding/OnboardingWizard';
import useAuthStore from '../store/authStore';

export default function Onboarding() {
  const { operator } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (operator?.onboarding_complete) navigate('/');
  }, [operator, navigate]);

  return <OnboardingWizard />;
}
