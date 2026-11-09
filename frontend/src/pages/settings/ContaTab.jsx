import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { updateOperator } from '../../services/authService';
import useAuthStore from '../../store/authStore';
import useUiStore from '../../store/uiStore';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input, { Select } from '../../components/ui/Input';
import { SaveBanner } from './shared';

/* ─────────────────────────────────────────────────────────
   TAB 1 — CONTA
───────────────────────────────────────────────────────── */
const TIMEZONES = ['Atlantic/Cape_Verde', 'Europe/Lisbon', 'Europe/London', 'America/New_York', 'America/Sao_Paulo'];
const CURRENCIES = ['CVE', 'EUR', 'USD', 'GBP'];
const LANGS      = ['pt', 'en', 'de', 'nl', 'fr', 'es'];

export default function ContaTab({ operator, onSaved }) {
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

  async function handleSubmit(e) {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      const updated = await updateOperator(form);
      setOperator(updated);
      setSaved(true); setTimeout(() => setSaved(false), 3000);
      onSaved?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao guardar');
    } finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
      <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Dados da empresa</h3>}>
        <div className="space-y-4">
          <Input label="Nome da empresa" aria-label="Nome da empresa" value={form.name} onChange={set('name')} required />
          <Input label="Email" aria-label="Email" type="email" value={form.email} onChange={set('email')} required />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Telefone" aria-label="Telefone" type="tel" value={form.phone} onChange={set('phone')} placeholder="+238 900 0000" />
            <Input label="WhatsApp" aria-label="WhatsApp" type="tel" value={form.whatsapp} onChange={set('whatsapp')} placeholder="+238 900 0000" />
          </div>
          <Input label="Morada" aria-label="Morada" value={form.address} onChange={set('address')} placeholder="Rua, localidade" />
        </div>
      </Card>

      <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Preferencias</h3>}>
        <div className="grid grid-cols-3 gap-3">
          <Select label="Idioma" aria-label="Idioma" value={form.language} onChange={set('language')}>
            {LANGS.map(l => <option key={l} value={l}>{l.toUpperCase()}</option>)}
          </Select>
          <Select label="Moeda" aria-label="Moeda" value={form.currency} onChange={set('currency')}>
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Select label="Fuso horario" aria-label="Fuso horario" value={form.timezone} onChange={set('timezone')}>
            {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz.replace('_', ' ')}</option>)}
          </Select>
        </div>
      </Card>

      {error && <p className="text-sm font-body px-3 py-2 rounded bg-[var(--error-light)] text-[var(--error)]">{error}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" loading={saving}>Guardar alteracoes</Button>
        <SaveBanner saved={saved} />
      </div>

      <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Ajuda</h3>}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-body font-medium text-n-800">Tour de boas-vindas</p>
            <p className="text-xs font-body text-n-500 mt-0.5">Revê rapidamente onde encontrar cada secção principal.</p>
          </div>
          <Button
            type="button"
            variant="secondary"
            icon={Compass}
            onClick={() => { startTour(); navigate('/'); }}
          >
            Rever tour
          </Button>
        </div>
      </Card>
    </form>
  );
}
