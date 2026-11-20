import { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, CreditCard } from 'lucide-react';
import api from '../../services/api';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { SaveBanner } from './shared';
import { useT } from '../../i18n';

/* ─────────────────────────────────────────────────────────
   TAB 3 — PAGAMENTOS
───────────────────────────────────────────────────────── */
/* cartao de estado (configurado / nao configurado) */
function EstadoCartao({ active, label }) {
  const t = useT();
  return (
    <div className={`flex items-center gap-2 px-4 py-3 rounded border text-sm font-body ${active ? 'bg-[var(--success-light)] border-n-200 text-[var(--success)]' : 'bg-n-50 border-n-200 text-n-500'}`}>
      {active ? <CheckCircle2 size={14} strokeWidth={1.75} /> : <XCircle size={14} strokeWidth={1.75} />}
      <div>
        <p className="font-semibold">{label}</p>
        <p className="text-xs mt-0.5">{active ? t('settings.pagamentos.configured') : t('settings.pagamentos.notConfigured')}</p>
      </div>
    </div>
  );
}

export default function PagamentosTab() {
  const t = useT();
  const [settings, setSettings]     = useState(null);
  const [form, setForm]             = useState({ paypal_client_id: '', paypal_client_secret: '', paypal_webhook_id: '', sisp_merchant_id: '', sisp_api_key: '' });
  const [saving,  setSaving]        = useState(false);
  const [saved,   setSaved]         = useState(false);
  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));

  useEffect(() => {
    api.get('/marketing/payment-settings').then(r => setSettings(r.data?.data)).catch(() => {});
  }, []);

  async function handleSave(e) {
    e.preventDefault(); setSaving(true);
    try {
      const body = {};
      if (form.paypal_client_id)     body.paypal_client_id     = form.paypal_client_id;
      if (form.paypal_client_secret) body.paypal_client_secret = form.paypal_client_secret;
      if (form.paypal_webhook_id)    body.paypal_webhook_id    = form.paypal_webhook_id;
      if (form.sisp_merchant_id)     body.sisp_merchant_id     = form.sisp_merchant_id;
      if (form.sisp_api_key)         body.sisp_api_key         = form.sisp_api_key;
      await api.put('/marketing/payment-settings', body);
      const r = await api.get('/marketing/payment-settings');
      setSettings(r.data?.data);
      setForm({ paypal_client_id: '', paypal_client_secret: '', paypal_webhook_id: '', sisp_merchant_id: '', sisp_api_key: '' });
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      {settings && (
        <div className="grid grid-cols-3 gap-3">
          <EstadoCartao active={settings.has_paypal} label="PayPal" />
          <EstadoCartao active={settings.has_paypal_webhook} label={t('settings.pagamentos.paypalWebhook')} />
          <EstadoCartao active={settings.has_sisp}   label="SISP Vinti4" />
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        <Card header={<h3 className="font-display font-semibold text-sm text-n-700">PayPal</h3>}>
          <div className="space-y-3">
            <p className="text-xs font-body text-n-500">
              {t('settings.pagamentos.credsIn')}<strong>developer.paypal.com</strong> → My Apps &amp; Credentials
            </p>
            <Input label="Client ID" aria-label="Client ID" type="password" value={form.paypal_client_id} onChange={set('paypal_client_id')}
              placeholder={settings?.paypal_client_id ? '••••••••••••' : 'AaBbCc...'} />
            <Input label="Client Secret" aria-label="Client Secret" type="password" value={form.paypal_client_secret} onChange={set('paypal_client_secret')}
              placeholder="EeFfGg..." />
            <div className="pt-2 border-t border-n-100">
              <p className="text-xs font-body text-n-500 mb-2">
                {t('settings.pagamentos.webhook1')}<strong>developer.paypal.com → My Apps &amp; Credentials → Webhooks</strong>
                {t('settings.pagamentos.webhook2')}<span className="font-mono text-[11px]">https://api.saldesk.cv/api/v1/payments/webhook/paypal</span>
                {t('settings.pagamentos.webhook3')}<span className="font-mono text-[11px]">PAYMENT.CAPTURE.COMPLETED</span>
                {t('settings.pagamentos.webhook4')}
              </p>
              <Input label="Webhook ID" aria-label="Webhook ID" type="password" value={form.paypal_webhook_id} onChange={set('paypal_webhook_id')}
                placeholder={settings?.paypal_webhook_id ? '••••••••••••' : t('settings.pagamentos.example', { v: '8PT597110X687430LKGECATA' })} />
            </div>
          </div>
        </Card>

        <Card header={<h3 className="font-display font-semibold text-sm text-n-700">SISP Vinti4</h3>}>
          <div className="space-y-3">
            <p className="text-xs font-body text-n-500">
              {t('settings.pagamentos.sisp1')}<strong>sisp.cv</strong>{t('settings.pagamentos.sisp2')}
            </p>
            <Input label="POS ID" aria-label="POS ID" type="password" value={form.sisp_merchant_id} onChange={set('sisp_merchant_id')}
              placeholder={settings?.sisp_merchant_id ? '••••••••••••' : t('settings.pagamentos.example', { v: '90051' })} />
            <Input label="POS Auth Code" aria-label="POS Auth Code" type="password" value={form.sisp_api_key} onChange={set('sisp_api_key')}
              placeholder={t('settings.pagamentos.example', { v: '123456789A' })} />
          </div>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" loading={saving} icon={CreditCard}>{t('settings.pagamentos.save')}</Button>
          <SaveBanner saved={saved} />
        </div>
      </form>
    </div>
  );
}
