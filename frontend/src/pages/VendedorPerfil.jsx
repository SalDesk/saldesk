import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Camera, Upload, Phone, MessageCircle,
  Lock, User, MapPin, Percent, Mail,
} from 'lucide-react';
import { getMyProfile, updateMyProfile } from '../services/staffService';
import { forgotPassword } from '../services/authService';
import { getSellerCommissionPct } from '../services/sellerService';
import useAuthStore from '../store/authStore';
import { useToast } from '../store/toastStore';
import Logo from '../components/shared/Logo';

export default function VendedorPerfil() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const toast = useToast();

  const sellerId   = user?.user_metadata?.staff_id || user?.id;
  const sellerName = user?.user_metadata?.name || user?.email || 'Vendedor';
  const sellerEmail = user?.email;

  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  const [profile,      setProfile]      = useState(null);
  const [phone,        setPhone]        = useState('');
  const [whatsapp,     setWhatsapp]     = useState('');
  const [photoPreview, setPhotoPreview] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    getMyProfile()
      .then(data => {
        setProfile(data);
        setPhone(data?.phone || '');
        setWhatsapp(data?.whatsapp || '');
        setPhotoPreview(data?.photo_url || null);
      })
      .catch(() => toast.error('Erro ao carregar perfil'))
      .finally(() => setLoading(false));
  }, []);

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result);
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateMyProfile({ phone, whatsapp, photo_url: photoPreview });
      toast.success('Perfil actualizado');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao actualizar perfil');
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword() {
    if (!sellerEmail) return;
    setSendingReset(true);
    try {
      await forgotPassword(sellerEmail);
      toast.success('Email enviado para definir nova password');
    } catch {
      toast.success('Email enviado para definir nova password');
    } finally {
      setSendingReset(false);
    }
  }

  const commPct = profile?.commission_pct ?? getSellerCommissionPct(sellerId, 10);

  return (
    <div className="min-h-screen bg-n-50 flex flex-col max-w-md mx-auto">
      {/* Header */}
      <header className="bg-gradient-to-br from-ocean-900 to-ocean-700 px-4 py-4 flex items-center gap-3 sticky top-0 z-10 rounded-b-3xl shadow-md">
        <button
          onClick={() => navigate('/vendedor')}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 active:scale-95 transition-colors shrink-0">
          <ChevronLeft size={20} strokeWidth={1.75} className="text-white" />
        </button>
        <p className="flex-1 font-display font-bold text-white text-base">O meu perfil</p>
        <Logo white size="sm" />
      </header>

      <main className="flex-1 px-4 py-6 space-y-6">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-3 border-ocean-200 border-t-ocean-700 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Photo */}
            <div className="flex flex-col items-center">
              <div className="relative">
                <div className="w-28 h-28 rounded-full bg-turquoise-100 flex items-center justify-center overflow-hidden border-4 border-white shadow-lg">
                  {photoPreview
                    ? <img src={photoPreview} alt={sellerName} className="w-full h-full object-cover" />
                    : <Camera size={32} strokeWidth={1.5} className="text-turquoise-400" />}
                </div>
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="absolute -bottom-1 -right-1 w-9 h-9 bg-sand-500 text-ocean-900 rounded-full flex items-center justify-center shadow-md hover:bg-sand-600 active:scale-95 transition-all">
                  <Upload size={15} strokeWidth={2} />
                </button>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
              </div>
              <p className="font-display font-bold text-xl text-n-900 mt-3">{sellerName}</p>
            </div>

            {/* Editable fields */}
            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-1.5 text-sm font-body font-semibold text-n-700 mb-2">
                  <Phone size={14} strokeWidth={1.75} />Telefone
                </label>
                <input
                  type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="+238 900 0000"
                  className="w-full h-12 px-4 rounded-2xl border-2 border-n-200 text-base font-body bg-white focus:outline-none focus:border-turquoise-500 transition-colors"
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-sm font-body font-semibold text-n-700 mb-2">
                  <MessageCircle size={14} strokeWidth={1.75} />WhatsApp
                </label>
                <input
                  type="tel" value={whatsapp} onChange={e => setWhatsapp(e.target.value)}
                  placeholder="+238 900 0000"
                  className="w-full h-12 px-4 rounded-2xl border-2 border-n-200 text-base font-body bg-white focus:outline-none focus:border-turquoise-500 transition-colors"
                />
              </div>
            </div>

            {/* Read-only info */}
            <div>
              <p className="text-xs font-mono uppercase tracking-wider text-n-400 mb-2">Definido pelo operador</p>
              <div className="bg-white rounded-2xl border border-n-200 divide-y divide-n-100">
                <ReadOnlyRow icon={User} label="Nome" value={sellerName} />
                {profile?.seller_zone && (
                  <ReadOnlyRow icon={MapPin} label="Zona de venda" value={profile.seller_zone} />
                )}
                <ReadOnlyRow icon={Percent} label="Comissão" value={`${commPct}%`} />
                {sellerEmail && <ReadOnlyRow icon={Mail} label="Email" value={sellerEmail} />}
              </div>
            </div>

            {/* Change password */}
            <button
              onClick={handleChangePassword}
              disabled={sendingReset}
              className="w-full h-14 bg-white border-2 border-n-200 text-n-700 rounded-2xl font-body font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.99] transition-all hover:border-turquoise-300 disabled:opacity-50">
              <Lock size={16} strokeWidth={1.75} />
              {sendingReset ? 'A enviar...' : 'Alterar password'}
            </button>

            {/* Save */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full h-16 bg-sand-500 text-ocean-900 rounded-full font-display font-bold text-lg flex items-center justify-center gap-2 active:scale-[0.99] transition-all hover:bg-sand-600 disabled:opacity-50">
              {saving ? (
                <span className="w-6 h-6 border-3 border-ocean-900/30 border-t-ocean-900 rounded-full animate-spin" />
              ) : (
                'Guardar alterações'
              )}
            </button>
          </>
        )}
      </main>
    </div>
  );
}

function ReadOnlyRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Icon size={15} strokeWidth={1.75} className="text-n-400 shrink-0" />
      <span className="text-sm font-body text-n-500 flex-1">{label}</span>
      <span className="text-sm font-body font-semibold text-n-800">{value}</span>
    </div>
  );
}
