import { useState, useRef } from 'react';
import { Camera, Save } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import { useT } from '../i18n';
import PageHeader from '../components/layout/PageHeader';
import Card from '../components/ui/Card';
import Input, { Textarea, Select } from '../components/ui/Input';
import Button from '../components/ui/Button';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
);

export default function Profile() {
  const t = useT();
  const { operator, setOperator } = useAuthStore();
  const [form, setForm] = useState({
    name:        operator?.name || '',
    phone:       operator?.phone || '',
    whatsapp:    operator?.whatsapp || '',
    address:     operator?.address || '',
    description: operator?.description || '',
    language:    operator?.language || 'pt',
    currency:    operator?.currency || 'EUR',
    timezone:    operator?.timezone || 'Atlantic/Cape_Verde',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState(operator?.logo_url || null);
  const fileRef = useRef(null);

  const set = (f) => (e) => setForm({ ...form, [f]: e.target.value });

  async function handleLogoUpload(e) {
    const file = e.target.files?.[0];
    if (!file || file.size > 2 * 1024 * 1024) return;
    setUploading(true);
    try {
      const ext  = file.name.split('.').pop();
      const path = `logos/${operator?.id}.${ext}`;
      const { error } = await supabase.storage.from('logos').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(path);
      setLogoUrl(publicUrl);
      await api.put('/onboarding/operator', { logo_url: publicUrl });
      setOperator({ ...operator, logo_url: publicUrl });
    } finally { setUploading(false); }
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.put('/onboarding/operator', form);
      setOperator(data.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally { setSaving(false); }
  }

  return (
    <div>
      <PageHeader title="Perfil do Operador" subtitle="Informacoes publicas do seu negocio"/>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Logo */}
        <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Logotipo</h3>}>
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="w-24 h-24 rounded-full object-cover border-2 border-n-200"/>
              ) : (
                <div className="w-24 h-24 rounded-full bg-ocean-100 flex items-center justify-center text-2xl font-display font-bold text-ocean-700">
                  {operator?.name?.[0]}
                </div>
              )}
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-ocean-700 text-white flex items-center justify-center hover:bg-ocean-500 transition-colors"
              >
                <Camera size={14} strokeWidth={1.75}/>
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload}/>
            <p className="text-xs font-body text-n-400 text-center">
              {uploading ? 'A carregar...' : 'PNG, JPG — max 2MB'}
            </p>
          </div>
        </Card>

        {/* Dados */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSave} className="space-y-4">
            <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Informacoes do negocio</h3>}>
              <div className="space-y-4">
                <Input label="Nome do negocio" value={form.name} onChange={set('name')} required/>
                <Textarea label="Descricao" value={form.description} onChange={set('description')} rows={3}
                  placeholder="Descreva o seu negocio para os clientes..."/>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Telefone" value={form.phone} onChange={set('phone')} type="tel"/>
                  <Input label="WhatsApp" value={form.whatsapp} onChange={set('whatsapp')} type="tel"/>
                </div>
                <Input label="Morada" value={form.address} onChange={set('address')}/>
              </div>
            </Card>

            <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Configuracoes</h3>}>
              <div className="grid grid-cols-3 gap-3">
                <Select label="Idioma padrao" value={form.language} onChange={set('language')}>
                  <option value="pt">Portugues</option>
                  <option value="en">English</option>
                </Select>
                <Select label="Moeda" value={form.currency} onChange={set('currency')}>
                  <option value="EUR">EUR — Euro</option>
                  <option value="CVE">CVE — Escudo</option>
                  <option value="USD">USD — Dolar</option>
                </Select>
                <Select label="Fuso horario" value={form.timezone} onChange={set('timezone')}>
                  <option value="Atlantic/Cape_Verde">Cabo Verde (UTC-1)</option>
                  <option value="Europe/Lisbon">Lisboa (UTC+0/+1)</option>
                  <option value="Europe/London">Londres (UTC+0/+1)</option>
                </Select>
              </div>
            </Card>

            <div className="flex items-center gap-3">
              <Button type="submit" loading={saving} icon={saved ? undefined : Save}>
                {saved ? 'Guardado!' : 'Guardar alteracoes'}
              </Button>
              {saved && <span className="text-sm font-body text-[var(--success)]">Perfil actualizado com sucesso</span>}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
