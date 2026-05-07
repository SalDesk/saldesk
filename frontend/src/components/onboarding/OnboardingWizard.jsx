import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Hotel, Waves, Car, UtensilsCrossed, Check, ArrowLeft, ArrowRight } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { createOperator, updateOperator } from '../../services/authService';
import { useT } from '../../i18n';
import Logo from '../shared/Logo';
import Button from '../ui/Button';
import Input, { Textarea, Select } from '../ui/Input';
import LanguageToggle from '../shared/LanguageToggle';

const STEPS = [1, 2, 3, 4, 5];

const TYPE_CONFIG = {
  hotel:      { icon: Hotel },
  activity:   { icon: Waves },
  rentacar:   { icon: Car },
  restaurant: { icon: UtensilsCrossed },
};

export default function OnboardingWizard() {
  const t = useT();
  const navigate = useNavigate();
  const { user, operator, setOperator } = useAuthStore();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [data, setData] = useState({
    operator_type:     operator?.operator_type || '',
    name:              operator?.name || '',
    phone:             operator?.phone || '',
    whatsapp:          operator?.whatsapp || '',
    address:           operator?.address || '',
    description:       operator?.description || '',
    language:          operator?.language || 'pt',
    currency:          operator?.currency || 'EUR',
    timezone:          operator?.timezone || 'Atlantic/Cape_Verde',
    booking_link_slug: operator?.booking_link_slug || '',
  });

  const set = (field) => (e) => setData({ ...data, [field]: e.target.value });

  async function saveStep(nextStep) {
    setError('');
    setLoading(true);
    try {
      const payload = { ...data, user_id: user?.id };
      const updated = operator?.id
        ? await updateOperator(payload)
        : await createOperator(payload);
      setOperator(updated);
      setStep(nextStep);
    } catch (err) {
      setError(err.response?.data?.error || t('errors.generic'));
    } finally {
      setLoading(false);
    }
  }

  async function finish() {
    setError('');
    setLoading(true);
    try {
      const updated = await updateOperator({ ...data, onboarding_complete: true });
      setOperator(updated);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || t('errors.generic'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-lg">
      <div className="flex items-center justify-between mb-6">
        <Logo />
        <LanguageToggle />
      </div>

      {/* Progresso */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div
              className={[
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-display font-bold shrink-0 transition-colors',
                s < step  ? 'bg-ocean-700 text-white' :
                s === step ? 'bg-ocean-700 text-white ring-4 ring-ocean-100' :
                             'bg-n-100 text-n-400',
              ].join(' ')}
            >
              {s < step ? <Check size={12} strokeWidth={2.5} /> : s}
            </div>
            {s < STEPS.length && (
              <div className={`flex-1 h-0.5 transition-colors ${s < step ? 'bg-ocean-700' : 'bg-n-200'}`} />
            )}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-n-200 shadow-sm p-6">
        {error && (
          <div className="mb-4 px-3 py-2 rounded-sm bg-[var(--error-light)] text-[var(--error)] text-sm font-body">
            {error}
          </div>
        )}

        {/* Passo 1 — Tipo de negocio */}
        {step === 1 && (
          <div>
            <h2 className="font-display font-bold text-xl text-n-900 mb-1">{t('onboarding.step1Title')}</h2>
            <p className="text-sm font-body text-n-500 mb-6">{t('onboarding.step1Subtitle')}</p>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(TYPE_CONFIG).map(([type, { icon: Icon }]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setData({ ...data, operator_type: type })}
                  className={[
                    'flex flex-col items-center gap-3 p-4 rounded-md border-2 transition-all text-left',
                    data.operator_type === type
                      ? 'border-ocean-700 bg-ocean-50'
                      : 'border-n-200 hover:border-n-300 hover:bg-n-50',
                  ].join(' ')}
                >
                  <Icon
                    size={28}
                    strokeWidth={1.75}
                    className={data.operator_type === type ? 'text-ocean-700' : 'text-n-400'}
                  />
                  <div>
                    <p className={`text-sm font-display font-semibold ${data.operator_type === type ? 'text-ocean-700' : 'text-n-700'}`}>
                      {t(`onboarding.operatorTypes.${type}`)}
                    </p>
                    <p className="text-xs font-body text-n-500 mt-0.5 leading-relaxed">
                      {t(`onboarding.operatorDescriptions.${type}`)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Passo 2 — Dados do negocio */}
        {step === 2 && (
          <div>
            <h2 className="font-display font-bold text-xl text-n-900 mb-1">{t('onboarding.step2Title')}</h2>
            <p className="text-sm font-body text-n-500 mb-6">{t('onboarding.step2Subtitle')}</p>
            <div className="space-y-4">
              <Input label={t('onboarding.businessName')} value={data.name} onChange={set('name')} required placeholder="Ex: Sal Kite Center" />
              <div className="grid grid-cols-2 gap-3">
                <Input label={t('onboarding.phone')} value={data.phone} onChange={set('phone')} placeholder="+238 900 0000" type="tel" />
                <Input label={t('onboarding.whatsapp')} value={data.whatsapp} onChange={set('whatsapp')} placeholder="+238 900 0000" type="tel" />
              </div>
              <Input label={t('onboarding.address')} value={data.address} onChange={set('address')} placeholder="Santa Maria, Ilha do Sal" />
            </div>
          </div>
        )}

        {/* Passo 3 — Identidade */}
        {step === 3 && (
          <div>
            <h2 className="font-display font-bold text-xl text-n-900 mb-1">{t('onboarding.step3Title')}</h2>
            <p className="text-sm font-body text-n-500 mb-6">{t('onboarding.step3Subtitle')}</p>
            <div className="space-y-4">
              <Textarea
                label={t('onboarding.description')}
                value={data.description}
                onChange={set('description')}
                placeholder="Descreva o seu negocio em 2-3 frases..."
                rows={4}
              />
              <div>
                <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600 block mb-1">
                  {t('onboarding.logo')} <span className="text-n-400 normal-case font-normal">{t('common.optional')}</span>
                </label>
                <div className="border-2 border-dashed border-n-200 rounded-md p-8 flex flex-col items-center gap-2 text-center bg-n-50 hover:border-ocean-300 transition-colors cursor-pointer">
                  <p className="text-sm font-body text-n-500">{t('onboarding.uploadLogo')}</p>
                  <p className="text-xs font-body text-n-400">{t('onboarding.dragDrop')}</p>
                  <p className="text-xs font-body text-n-400">PNG, JPG — max 2MB</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Passo 4 — Configuracoes */}
        {step === 4 && (
          <div>
            <h2 className="font-display font-bold text-xl text-n-900 mb-1">{t('onboarding.step4Title')}</h2>
            <p className="text-sm font-body text-n-500 mb-6">{t('onboarding.step4Subtitle')}</p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Select label={t('onboarding.language')} value={data.language} onChange={set('language')}>
                  <option value="pt">Portugues</option>
                  <option value="en">English</option>
                </Select>
                <Select label={t('onboarding.currency')} value={data.currency} onChange={set('currency')}>
                  <option value="EUR">EUR — Euro</option>
                  <option value="CVE">CVE — Escudo</option>
                  <option value="USD">USD — Dolar</option>
                </Select>
              </div>
              <Select label={t('onboarding.timezone')} value={data.timezone} onChange={set('timezone')}>
                <option value="Atlantic/Cape_Verde">Atlantic/Cape Verde (UTC-1)</option>
                <option value="Europe/Lisbon">Europe/Lisbon (UTC+0/+1)</option>
                <option value="Europe/London">Europe/London (UTC+0/+1)</option>
              </Select>
              <Input
                label={t('onboarding.bookingSlug')}
                value={data.booking_link_slug}
                onChange={set('booking_link_slug')}
                hint={`${t('onboarding.bookingSlugHint')}${data.booking_link_slug || 'o-seu-negocio'}`}
                placeholder="o-meu-negocio"
              />
            </div>
          </div>
        )}

        {/* Passo 5 — Confirmacao */}
        {step === 5 && (
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-ocean-50 flex items-center justify-center mx-auto mb-4">
              <Check size={32} strokeWidth={1.75} className="text-ocean-700" />
            </div>
            <h2 className="font-display font-bold text-xl text-n-900 mb-2">{t('onboarding.step5Title')}</h2>
            <p className="text-sm font-body text-n-500 mb-6">{t('onboarding.step5Subtitle')}</p>
            <div className="bg-n-50 rounded-md p-4 text-left space-y-2 mb-6">
              <SummaryRow label="Tipo" value={t(`onboarding.operatorTypes.${data.operator_type}`)} />
              <SummaryRow label={t('onboarding.businessName')} value={data.name} />
              <SummaryRow label={t('onboarding.language')} value={data.language.toUpperCase()} />
              <SummaryRow label={t('onboarding.bookingSlug')} value={`/book/${data.booking_link_slug}`} />
            </div>
          </div>
        )}

        {/* Navegacao */}
        <div className={`flex mt-8 ${step > 1 ? 'justify-between' : 'justify-end'}`}>
          {step > 1 && (
            <Button variant="ghost" icon={ArrowLeft} onClick={() => setStep(step - 1)} disabled={loading}>
              {t('onboarding.back')}
            </Button>
          )}
          {step < 5 ? (
            <Button
              iconRight={ArrowRight}
              loading={loading}
              disabled={step === 1 && !data.operator_type}
              onClick={() => step === 1 ? setStep(2) : saveStep(step + 1)}
            >
              {t('onboarding.next')}
            </Button>
          ) : (
            <Button loading={loading} onClick={finish}>
              {t('onboarding.finish')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="font-body text-n-500">{label}</span>
      <span className="font-body font-semibold text-n-800">{value}</span>
    </div>
  );
}
