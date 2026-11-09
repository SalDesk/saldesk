import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import PageHeader from '../components/layout/PageHeader';
import Tabs from '../components/ui/Tabs';
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
  { id: 'conta',        label: 'Conta' },
  { id: 'perfil',       label: 'Perfil Publico' },
  { id: 'pagamentos',   label: 'Pagamentos' },
  { id: 'facturacao',   label: 'Facturacao' },
  { id: 'notificacoes', label: 'Notificacoes' },
  { id: 'mensagens',    label: 'Mensagens' },
  { id: 'seguranca',    label: 'Seguranca' },
];

export default function Settings() {
  const { operator } = useAuthStore();
  const [searchParams] = useSearchParams();
  const initialTab = TABS.some(t => t.id === searchParams.get('tab')) ? searchParams.get('tab') : 'conta';
  const [tab, setTab] = useState(initialTab);

  return (
    <div>
      <PageHeader title="Definicoes" />

      <div className="mb-6">
        <Tabs tabs={TABS} value={tab} onChange={setTab} />
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
