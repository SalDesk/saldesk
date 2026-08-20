import { Globe2 } from 'lucide-react';

const CONECT_STATUS_LABEL = { draft: 'Nao submetido', pending_review: 'Em revisao', published: 'Publicado no Conect', paused: 'Pausado' };
const CONECT_STATUS_TONE  = { draft: 'text-n-400 bg-n-100', pending_review: 'text-ocean-700 bg-ocean-50', published: 'text-[#1A7A4A] bg-[#ECFDF5]', paused: 'text-[#B45309] bg-[#FFF7E6]' };

export default function ConectRow({ unit, onSubmitConect }) {
  if (!onSubmitConect) return null;
  const status = unit.conect_status || 'draft';
  const canSubmit = status === 'draft';
  const canWithdraw = status === 'published' || status === 'paused';
  return (
    <div className="flex items-center justify-between gap-2 pt-2 border-t border-n-100">
      <span className={`text-[11px] font-body font-semibold px-2 py-0.5 rounded-full ${CONECT_STATUS_TONE[status] || CONECT_STATUS_TONE.draft}`}>
        {CONECT_STATUS_LABEL[status] || status}
      </span>
      {(canSubmit || canWithdraw) && (
        <button
          onClick={() => onSubmitConect(unit)}
          className="flex items-center gap-1 text-xs font-body font-semibold text-ocean-700 hover:underline"
        >
          <Globe2 size={12} strokeWidth={2} />
          {canSubmit ? 'Submeter ao Conect' : 'Retirar do Conect'}
        </button>
      )}
    </div>
  );
}
