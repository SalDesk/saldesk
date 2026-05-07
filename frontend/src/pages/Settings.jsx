import { useT } from '../i18n';
import PageHeader from '../components/layout/PageHeader';
import Card from '../components/ui/Card';
import useAuthStore from '../store/authStore';

export default function Settings() {
  const t = useT();
  const { operator } = useAuthStore();
  return (
    <div>
      <PageHeader title={t('nav.settings')} />
      <Card header={<h2 className="font-display font-semibold text-sm text-n-700">Perfil do operador</h2>}>
        <div className="space-y-2 text-sm font-body text-n-700">
          <p><span className="text-n-500 w-32 inline-block">Nome:</span> {operator?.name}</p>
          <p><span className="text-n-500 w-32 inline-block">Tipo:</span> {operator?.operator_type}</p>
          <p><span className="text-n-500 w-32 inline-block">Email:</span> {operator?.email}</p>
          <p><span className="text-n-500 w-32 inline-block">Slug:</span> /book/{operator?.slug}</p>
          <p><span className="text-n-500 w-32 inline-block">Idioma:</span> {operator?.language?.toUpperCase()}</p>
          <p><span className="text-n-500 w-32 inline-block">Moeda:</span> {operator?.currency}</p>
        </div>
      </Card>
    </div>
  );
}
