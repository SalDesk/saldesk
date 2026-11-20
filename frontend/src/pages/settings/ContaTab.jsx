import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { updateOperator } from '../../services/authService';
import { camposAlterados } from '../../utils/camposAlterados';
import useAuthStore from '../../store/authStore';
import useUiStore from '../../store/uiStore';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input, { Select } from '../../components/ui/Input';
import { SaveBanner } from './shared';
import { useT } from '../../i18n';

/* ─────────────────────────────────────────────────────────
   TAB 1 — CONTA
───────────────────────────────────────────────────────── */
const TIMEZONES = ['Atlantic/Cape_Verde', 'Europe/Lisbon', 'Europe/London', 'America/New_York', 'America/Sao_Paulo'];
const CURRENCIES = ['CVE', 'EUR', 'USD', 'GBP'];
const LANGS      = ['pt', 'en', 'de', 'nl', 'fr', 'es'];

export default function ContaTab({ operator, onSaved }) {
  const t = useT();
  const { setOperator } = useAuthStore();
  const startTour = useUiStore((s) => s.startTour);
  const navigate  = useNavigate();
  const [form, setForm] = useState({
    name:      operator?.name      || '',
    email:     operator?.email     || '',
    phone:     operator?.phone     || '',
    whatsapp:  operator?.whatsapp  || '',
    address:   operator?.address   || '',
    language:  operator?.language  || 'pt',
    currency:  operator?.currency  || 'CVE',
    timezone:  operator?.timezone  || 'Atlantic/Cape_Verde',
  });
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState('');
  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));
  /* valores gravados quando o separador abriu (depois, os da ultima gravacao): so se envia o que mudou */
  const baseRef = useRef(form);

  async function handleSubmit(e) {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      const alterados = camposAlterados(baseRef.current, form);
      if (Object.keys(alterados).length) {
        const updated = await updateOperator(alterados);
        setOperator(updated);
      }
      baseRef.current = form;
      setSaved(true); setTimeout(() => setSaved(false), 3000);
      onSaved?.();
    } catch (err) {
      setError(err.response?.data?.error || t('settings.conta.saveError'));
    } finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
      <Card header={<h3 className="font-display font-semibold text-sm text-n-700">{t('settings.conta.companyData')}</h3>}>
        <div className="space-y-4">
          <Input label={t('settings.conta.companyName')} aria-label={t('settings.conta.companyName')} value={form.name} onChange={set('name')} required />
          <Input label={t('settings.conta.email')} aria-label={t('settings.conta.email')} type="email" value={form.email} onChange={set('email')} required />
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('settings.conta.phone')} aria-label={t('settings.conta.phone')} type="tel" value={form.phone} onChange={set('phone')} placeholder="+238 900 0000" />
            <Input label="WhatsApp" aria-label="WhatsApp" type="tel" value={form.whatsapp} onChange={set('whatsapp')} placeholder="+238 900 0000" />
          </div>
          <Input label={t('settings.conta.address')} aria-label={t('settings.conta.address')} value={form.address} onChange={set('address')} placeholder={t('settings.conta.addressPlaceholder')} />
        </div>
      </Card>

      <Card header={<h3 className="font-display font-semibold text-sm text-n-700">{t('settings.conta.preferences')}</h3>}>
        <div className="grid grid-cols-3 gap-3">
          <Select label={t('settings.conta.language')} aria-label={t('settings.conta.language')} value={form.language} onChange={set('language')}>
            {LANGS.map(l => <option key={l} value={l}>{l.toUpperCase()}</option>)}
          </Select>
          <Select label={t('settings.conta.currency')} aria-label={t('settings.conta.currency')} value={form.currency} onChange={set('currency')}>
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Select label={t('settings.conta.timezone')} aria-label={t('settings.conta.timezone')} value={form.timezone} onChange={set('timezone')}>
            {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz.replace('_', ' ')}</option>)}
          </Select>
        </div>
      </Card>

      {error && <p className="text-sm font-body px-3 py-2 rounded bg-[var(--error-light)] text-[var(--error)]">{error}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" loading={saving}>{t('settings.conta.save')}</Button>
        <SaveBanner saved={saved} />
      </div>

      <Card header={<h3 className="font-display font-semibold text-sm text-n-700">{t('settings.conta.help')}</h3>}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-body font-medium text-n-800">{t('settings.conta.tourTitle')}</p>
            <p className="text-xs font-body text-n-500 mt-0.5">{t('settings.conta.tourHint')}</p>
          </div>
          <Button
            type="button"
            variant="secondary"
            icon={Compass}
            onClick={() => { startTour(); navigate('/'); }}
          >
            {t('settings.conta.tourButton')}
          </Button>
        </div>
      </Card>
    </form>
  );
}
