import { useT } from '../../i18n';

export default function Step3Complete({ onContinue }) {
  const t = useT();
  return (
    <div className="text-center py-4">
      <div className="text-6xl mb-4">🎉</div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">{t('onboarding.doneTitle')}</h2>
      <p className="text-gray-500 mb-6">
        {t('onboarding.doneBody')}
      </p>
      <button onClick={onContinue} className="btn-primary px-8">
        {t('onboarding.goToDashboard')}
      </button>
    </div>
  );
}
