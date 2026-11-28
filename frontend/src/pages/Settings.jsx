import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { useT } from '../i18n';
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
const TABS = ['conta', 'perfil', 'pagamentos', 'facturacao', 'notificacoes', 'mensagens', 'seguranca'];

export default function Settings() {
  const t = useT();
  const { operator } = useAuthStore();
  const [searchParams] = useSearchParams();
  const initialTab = TABS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'conta';
  const [tab, setTab] = useState(initialTab);

  return (
    <div>
      <PageHeader eyebrow={t('nav.sections.configuracao')} title={t('nav.settings')} />

      <div className="mb-6">
        <Tabs tabs={TABS.map(id => ({ id, label: t(`settings.tabs.${id}`) }))} value={tab} onChange={setTab} />
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
