import { useT } from '../i18n';
import PageHeader from '../components/layout/PageHeader';
import Card from '../components/ui/Card';

export default function Integrations() {
  const t = useT();
  return (
    <div>
      <PageHeader title={t('nav.integrations')} subtitle="Viator e GetYourGuide — disponivel na Fase 5" />
      <Card>
        <p className="text-sm font-body text-n-500">
          O Channel Manager sera implementado na Fase 5. Permitira receber reservas automaticamente
          do Viator e GetYourGuide com sincronizacao de disponibilidade em tempo real.
        </p>
      </Card>
    </div>
  );
}
