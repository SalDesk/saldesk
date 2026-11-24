import { Globe2 } from 'lucide-react';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import { useT } from '../../i18n';

/* Estados do Conect gravados em unit.conect_status; o texto vem de units.conect.<estado> */
const CONECT_STATUS_LABEL_CHAVE = ['draft', 'pending_review', 'published', 'paused'];
/* Variante do Badge do sistema para cada estado do Conect */
const CONECT_STATUS_VARIANT = { draft: 'default', pending_review: 'info', published: 'confirmed', paused: 'pending' };

export default function ConectRow({ unit, onSubmitConect }) {
  const t = useT();
  if (!onSubmitConect) return null;
  const status = unit.conect_status || 'draft';
  const canSubmit = status === 'draft';
  const canWithdraw = status === 'published' || status === 'paused';
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-n-100">
      <Badge variant={CONECT_STATUS_VARIANT[status] || 'default'} className="whitespace-nowrap">
        {CONECT_STATUS_LABEL_CHAVE.includes(status) ? t(`units.conect.${status}`) : status}
      </Badge>
      {(canSubmit || canWithdraw) && (
        <Button
          variant="ghost"
          size="sm"
          icon={Globe2}
          className="whitespace-nowrap"
          onClick={() => onSubmitConect(unit)}
        >
          {canSubmit ? t('units.conect.submit') : t('units.conect.withdraw')}
        </Button>
      )}
    </div>
  );
}
