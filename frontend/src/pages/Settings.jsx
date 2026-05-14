import { useState, useEffect } from 'react';
import { Copy, Check, Download, CreditCard, QrCode, Globe } from 'lucide-react';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import { useT } from '../i18n';
import PageHeader from '../components/layout/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

const TABS = [
  { id: 'profile',  label: 'Perfil',     icon: Globe },
  { id: 'marketing',label: 'Marketing',  icon: QrCode },
  { id: 'payments', label: 'Pagamentos', icon: CreditCard },
];

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <Button variant="ghost" size="sm" icon={copied ? Check : Copy} onClick={handleCopy}>
      {copied ? 'Copiado' : 'Copiar'}
    </Button>
  );
}

export default function Settings() {
  const t   = useT();
  const { operator } = useAuthStore();
  const [tab, setTab] = useState('profile');

  const [widget, setWidget] = useState('');
  const [bookingLink, setBookingLink] = useState('');
  const [paymentSettings, setPaymentSettings] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ paypal_client_id: '', paypal_client_secret: '', sisp_merchant_id: '', sisp_api_key: '' });
  const [savingPayments, setSavingPayments] = useState(false);
  const [paymentSaved, setPaymentSaved] = useState(false);

  useEffect(() => {
    if (tab === 'marketing') {
      api.get('/marketing/booking-link').then(r => setBookingLink(r.data.data.url));
      api.get('/marketing/widget-code').then(r => setWidget(r.data.data.html));
    }
    if (tab === 'payments') {
      api.get('/marketing/payment-settings').then(r => setPaymentSettings(r.data.data));
    }
  }, [tab]);

  async function handleSavePayments(e) {
    e.preventDefault();
    setSavingPayments(true);
    try {
      const body = {};
      if (paymentForm.paypal_client_id)     body.paypal_client_id     = paymentForm.paypal_client_id;
      if (paymentForm.paypal_client_secret) body.paypal_client_secret = paymentForm.paypal_client_secret;
      if (paymentForm.sisp_merchant_id)     body.sisp_merchant_id     = paymentForm.sisp_merchant_id;
      if (paymentForm.sisp_api_key)         body.sisp_api_key         = paymentForm.sisp_api_key;
      await api.put('/marketing/payment-settings', body);
      setPaymentSaved(true);
      setTimeout(() => setPaymentSaved(false), 3000);
      const r = await api.get('/marketing/payment-settings');
      setPaymentSettings(r.data.data);
      setPaymentForm({ paypal_client_id: '', paypal_client_secret: '', sisp_merchant_id: '', sisp_api_key: '' });
    } finally { setSavingPayments(false); }
  }

  const qrcodeUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1'}/marketing/qrcode`;

  return (
    <div>
      <PageHeader title={t('nav.settings')} />

      {/* Tabs */}
      <div className="flex gap-1 bg-n-100 rounded-sm p-0.5 mb-6 w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xs text-sm font-body font-semibold transition-colors ${tab === id ? 'bg-white text-ocean-700 shadow-sm' : 'text-n-500 hover:text-n-700'}`}>
            <Icon size={14} strokeWidth={1.75}/>{label}
          </button>
        ))}
      </div>

      {/* Perfil */}
      {tab === 'profile' && (
        <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Perfil do operador</h3>}>
          <div className="space-y-3 text-sm font-body">
            {[
              ['Nome',    operator?.name],
              ['Tipo',    operator?.operator_type],
              ['Email',   operator?.email],
              ['Slug',    `/book/${operator?.slug}`],
              ['Idioma',  operator?.language?.toUpperCase()],
              ['Moeda',   operator?.currency],
              ['Plano',   operator?.plan?.toUpperCase() || 'STARTER'],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center gap-3">
                <span className="text-n-500 w-24 shrink-0">{k}</span>
                <span className="font-semibold text-n-800">{v || '—'}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Marketing */}
      {tab === 'marketing' && (
        <div className="space-y-4">
          <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Link de reserva directa</h3>}>
            <div className="flex items-center gap-3">
              <code className="flex-1 bg-n-50 border border-n-200 rounded-sm px-3 py-2 text-sm font-mono text-ocean-700 truncate">{bookingLink}</code>
              <CopyButton text={bookingLink} />
            </div>
          </Card>

          <Card header={<h3 className="font-display font-semibold text-sm text-n-700">QR Code</h3>}>
            <div className="flex items-center gap-6">
              <img src={qrcodeUrl} alt="QR Code" className="w-32 h-32 rounded-sm border border-n-200" onError={(e) => e.target.style.display='none'}/>
              <div className="space-y-2">
                <p className="text-sm font-body text-n-600">QR Code para o link de reserva directa. Imprimir e colocar na recepção.</p>
                <a href={qrcodeUrl} download="qrcode.png">
                  <Button variant="secondary" icon={Download} size="sm">Descarregar PNG</Button>
                </a>
              </div>
            </div>
          </Card>

          <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Widget embebível</h3>}>
            <p className="text-sm font-body text-n-500 mb-3">Cole este código no seu website para mostrar o motor de reserva directamente.</p>
            <div className="bg-n-50 border border-n-200 rounded-sm p-3 font-mono text-xs text-n-700 whitespace-pre-wrap break-all mb-3">{widget || 'A carregar...'}</div>
            <CopyButton text={widget} />
          </Card>
        </div>
      )}

      {/* Pagamentos */}
      {tab === 'payments' && (
        <div className="space-y-4">
          {paymentSettings && (
            <div className="flex gap-3">
              <div className={`flex-1 rounded-sm px-4 py-3 border text-sm font-body ${paymentSettings.has_paypal ? 'bg-[var(--success-light)] border-[var(--success)] text-[var(--success)]' : 'bg-n-50 border-n-200 text-n-500'}`}>
                <p className="font-semibold">PayPal {paymentSettings.has_paypal ? '— Configurado' : '— Nao configurado'}</p>
                {paymentSettings.paypal_client_id && <p className="text-xs mt-0.5 font-mono">{paymentSettings.paypal_client_id}</p>}
              </div>
              <div className={`flex-1 rounded-sm px-4 py-3 border text-sm font-body ${paymentSettings.has_sisp ? 'bg-[var(--success-light)] border-[var(--success)] text-[var(--success)]' : 'bg-n-50 border-n-200 text-n-500'}`}>
                <p className="font-semibold">SISP Vinti4 {paymentSettings.has_sisp ? '— Configurado' : '— Nao configurado'}</p>
                {paymentSettings.sisp_merchant_id && <p className="text-xs mt-0.5 font-mono">{paymentSettings.sisp_merchant_id}</p>}
              </div>
            </div>
          )}

          <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Configurar PayPal</h3>}>
            <form onSubmit={handleSavePayments} className="space-y-3">
              <p className="text-xs font-body text-n-500">Obtenha as credenciais em <strong>developer.paypal.com</strong> → My Apps & Credentials</p>
              <Input label="PayPal Client ID" type="password" value={paymentForm.paypal_client_id}
                onChange={(e) => setPaymentForm({...paymentForm, paypal_client_id: e.target.value})}
                placeholder={paymentSettings?.paypal_client_id || 'AaBbCc...'} />
              <Input label="PayPal Client Secret" type="password" value={paymentForm.paypal_client_secret}
                onChange={(e) => setPaymentForm({...paymentForm, paypal_client_secret: e.target.value})}
                placeholder="EeFfGg..." />

              <div className="pt-2 border-t border-n-100">
                <p className="text-xs font-body text-n-500 mb-3">SISP Vinti4 — credenciais fornecidas pela SISP após contrato (sisp.cv)</p>
                <Input label="SISP Merchant ID" type="password" value={paymentForm.sisp_merchant_id}
                  onChange={(e) => setPaymentForm({...paymentForm, sisp_merchant_id: e.target.value})}
                  placeholder={paymentSettings?.sisp_merchant_id || 'MID...'} />
                <div className="mt-3">
                  <Input label="SISP API Key" type="password" value={paymentForm.sisp_api_key}
                    onChange={(e) => setPaymentForm({...paymentForm, sisp_api_key: e.target.value})}
                    placeholder="KEY..." />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button type="submit" loading={savingPayments} icon={paymentSaved ? Check : CreditCard}>
                  {paymentSaved ? 'Guardado!' : 'Guardar credenciais'}
                </Button>
                {paymentSaved && <span className="text-sm font-body text-[var(--success)]">Credenciais guardadas com segurança</span>}
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
