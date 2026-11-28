import { useState, useRef, useEffect } from 'react';
import { Camera, Save, Check } from 'lucide-react';
import api from '../services/api';
import { uploadImage, validateImageFile } from '../services/uploadService';
import useAuthStore from '../store/authStore';
import { useT } from '../i18n';
import PageHeader from '../components/layout/PageHeader';
import Input, { Textarea, Select } from '../components/ui/Input';
import Button from '../components/ui/Button';
import ImageUploader from '../components/shared/ImageUploader';

/* Estilo Mare da pagina: cartao, titulo de cartao e anel de foco da marca */
const CARTAO = 'bg-white rounded-[18px] border border-mare-card p-[22px] min-w-0';
const TITULO = 'font-display text-lg font-semibold text-ocean-900';
const FOCO = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sand-500';

export default function Profile() {
  const t = useT();
  const { operator, setOperator } = useAuthStore();
  const [form, setForm] = useState({
    name:          operator?.name || '',
    business_name: operator?.business_name || '',
    tagline:       operator?.tagline || '',
    phone:         operator?.phone || '',
    whatsapp:      operator?.whatsapp || '',
    address:       operator?.address || '',
    description:   operator?.description || '',
    language:      operator?.language || 'pt',
    currency:      operator?.currency || 'EUR',
    timezone:      operator?.timezone || 'Atlantic/Cape_Verde',
  });
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [uploading,   setUploading]   = useState(false);
  const [logoUrl,     setLogoUrl]     = useState(operator?.logo_url || null);
  const [logoError,   setLogoError]   = useState('');
  const [coverImages, setCoverImages] = useState(operator?.cover_images || []);
  useEffect(() => {
    if (operator?.cover_images) setCoverImages(operator.cover_images);
  }, [operator?.id]);
  const fileRef = useRef(null);

  const set = (f) => (e) => setForm(p => ({ ...p, [f]: e.target.value }));

  async function handleLogoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateImageFile(file);
    if (err) { setLogoError(err); return; }
    setLogoError('');
    setUploading(true);
    try {
      const result = await uploadImage(file, () => {});
      setLogoUrl(result.url);
      await api.put('/onboarding/operator', { logo_url: result.url });
      setOperator({ ...operator, logo_url: result.url });
    } catch {
      setLogoError(t('settings.perfil.logoUploadError'));
    } finally {
      setUploading(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.put('/onboarding/operator', {
        ...form,
        cover_images: coverImages,
      });
      setOperator(data.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader eyebrow={t('nav.sections.configuracao')} title={t('profile.title')} subtitle={t('profile.subtitle')} />

      <div className="space-y-6">
        {/* Logo + Cover photos row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Logo */}
          <section className={CARTAO}>
            <h2 className={`${TITULO} mb-4`}>{t('profile.logo')}</h2>
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={t('profile.logoAlt')}
                    className="w-24 h-24 rounded-full object-cover border-2 border-n-200"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-ocean-100 flex items-center justify-center text-2xl font-display font-bold text-ocean-700">
                    {operator?.name?.[0]}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className={`absolute -bottom-1 -right-1 w-11 h-11 md:w-8 md:h-8 rounded-full bg-ocean-700 text-white flex items-center justify-center hover:bg-ocean-500 transition-colors disabled:opacity-50 ${FOCO}`}
                >
                  {uploading
                    ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <Camera size={14} strokeWidth={1.75} />}
                </button>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleLogoUpload}
              />
              {logoError ? (
                <p className="text-xs text-error text-center">{logoError}</p>
              ) : (
                <p className="text-xs font-body text-n-600 text-center">
                  {uploading ? t('common.loading') : t('profile.logoHint')}
                </p>
              )}
            </div>
          </section>

          {/* Cover photos */}
          <section className={`${CARTAO} lg:col-span-2`}>
            <h2 className={TITULO}>{t('profile.covers')}</h2>
            <p className="text-xs font-body text-n-600 mt-0.5 mb-4">
              {t('profile.coversIntro')}
            </p>
            <ImageUploader
              value={coverImages}
              onChange={setCoverImages}
              maxImages={5}
              hint={t('profile.coversHint')}
            />
          </section>
        </div>

        {/* Business data */}
        <form onSubmit={handleSave} className="space-y-4">
          <section className={CARTAO}>
            <h2 className={`${TITULO} mb-4`}>{t('profile.businessInfo')}</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input label={t('profile.legalName')} value={form.name} onChange={set('name')} required />
                <Input label={t('profile.tradeName')} value={form.business_name} onChange={set('business_name')} placeholder={t('profile.tradeNamePlaceholder')} />
              </div>
              <Input label={t('profile.tagline')} value={form.tagline} onChange={set('tagline')} placeholder={t('profile.taglinePlaceholder')} />
              <Textarea
                label={t('profile.description')}
                value={form.description}
                onChange={set('description')}
                rows={3}
                placeholder={t('profile.descriptionPlaceholder')}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input label={t('profile.phone')} value={form.phone} onChange={set('phone')} type="tel" />
                <Input label={t('profile.whatsapp')} value={form.whatsapp} onChange={set('whatsapp')} type="tel" />
              </div>
              <Input label={t('profile.address')} value={form.address} onChange={set('address')} />
            </div>
          </section>

          <section className={CARTAO}>
            <h2 className={`${TITULO} mb-4`}>{t('profile.settings')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Select label={t('profile.language')} value={form.language} onChange={set('language')}>
                {['pt', 'en', 'de', 'nl'].map((l) => <option key={l} value={l}>{t(`accountOptions.language.${l}`)}</option>)}
              </Select>
              <Select label={t('profile.currency')} value={form.currency} onChange={set('currency')}>
                {['EUR', 'CVE', 'USD'].map((c) => <option key={c} value={c}>{t(`accountOptions.currency.${c}`)}</option>)}
              </Select>
              <Select label={t('profile.timezone')} value={form.timezone} onChange={set('timezone')}>
                {['Atlantic/Cape_Verde', 'Europe/Lisbon', 'Europe/London'].map((z) => <option key={z} value={z}>{t(`accountOptions.timezone.${z}`)}</option>)}
              </Select>
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" loading={saving} icon={saved ? Check : Save}>
              {saved ? t('profile.saved') : t('profile.save')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
