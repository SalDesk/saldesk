import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CreditCard, Globe, User, Bell, Shield, Wallet, MessageCircle } from 'lucide-react';
import useAuthStore from '../store/authStore';
import PageHeader from '../components/layout/PageHeader';
import TemplatesEditor from '../components/messaging/TemplatesEditor';
import ContaTab from './settings/ContaTab';
import PerfilPublicoTab from './settings/PerfilPublicoTab';
import PagamentosTab from './settings/PagamentosTab';
import FacturacaoTab from './settings/FacturacaoTab';
import NotificacoesTab from './settings/NotificacoesTab';
import SegurancaTab from './settings/SegurancaTab';

/* ─────────────────────────────────────────────────────────
   MAIN
───────────────────────────────────────────────────────── */
const TABS = [
  { id: 'conta',      label: 'Conta',          Icon: User },
  { id: 'perfil',     label: 'Perfil Publico', Icon: Globe },
  { id: 'pagamentos', label: 'Pagamentos',      Icon: CreditCard },
  { id: 'facturacao', label: 'Facturacao',      Icon: Wallet },
  { id: 'notificacoes', label: 'Notificacoes', Icon: Bell },
  { id: 'mensagens',    label: 'Mensagens',    Icon: MessageCircle },
  { id: 'seguranca',    label: 'Seguranca',    Icon: Shield },
];

export default function Settings() {
  const { operator } = useAuthStore();
  const [searchParams] = useSearchParams();
  const initialTab = TABS.some(t => t.id === searchParams.get('tab')) ? searchParams.get('tab') : 'conta';
  const [tab, setTab] = useState(initialTab);

  return (
    <div>
      <PageHeader title="Definicoes" />

      {/* Tab bar — horizontal scroll on mobile */}
      <div className="flex gap-0.5 mb-6 bg-n-100 p-1 rounded-md overflow-x-auto w-full">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-3 py-2 rounded text-sm font-display font-medium whitespace-nowrap transition-colors shrink-0 ${tab === id ? 'bg-white text-ocean-700 shadow-sm' : 'text-n-500 hover:text-n-700'}`}>
            <Icon size={14} strokeWidth={1.75} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'conta'        && <ContaTab       operator={operator} />}
      {tab === 'perfil'       && <PerfilPublicoTab operator={operator} />}
      {tab === 'pagamentos'   && <PagamentosTab />}
      {tab === 'facturacao'   && <FacturacaoTab />}
      {tab === 'notificacoes' && <NotificacoesTab />}
      {tab === 'mensagens'    && <TemplatesEditor />}
      {tab === 'seguranca'    && <SegurancaTab />}
    </div>
  );
}
