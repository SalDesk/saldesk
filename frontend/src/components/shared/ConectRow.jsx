import { Globe2 } from 'lucide-react';
import Badge from '../ui/Badge';
import Button from '../ui/Button';

const CONECT_STATUS_LABEL = { draft: 'Nao submetido', pending_review: 'Em revisao', published: 'Publicado no Conect', paused: 'Pausado' };
/* Variante do Badge do sistema para cada estado do Conect */
const CONECT_STATUS_VARIANT = { draft: 'default', pending_review: 'info', published: 'confirmed', paused: 'pending' };

export default function ConectRow({ unit, onSubmitConect }) {
  if (!onSubmitConect) return null;
  const status = unit.conect_status || 'draft';
  const canSubmit = status === 'draft';
  const canWithdraw = status === 'published' || status === 'paused';
  return (
    <div className="flex items-center justify-between gap-2 pt-2 border-t border-n-100">
      <Badge variant={CONECT_STATUS_VARIANT[status] || 'default'}>
        {CONECT_STATUS_LABEL[status] || status}
      </Badge>
      {(canSubmit || canWithdraw) && (
        <Button
          variant="ghost"
          size="sm"
          icon={Globe2}
          onClick={() => onSubmitConect(unit)}
        >
          {canSubmit ? 'Submeter ao Conect' : 'Retirar do Conect'}
        </Button>
      )}
    </div>
  );
}
