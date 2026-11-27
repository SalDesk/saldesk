import { useNavigate } from 'react-router-dom';
import {
  Pencil,
  Trash2,
  Star,
  Briefcase,
  Phone,
  Mail,
  Shield,
  CheckCircle2,
  ClipboardCheck,
} from 'lucide-react';
import { StaffAvatar, CARGO_VENDEDOR, rotuloCargo } from './shared';
import Badge from '../../components/ui/Badge';
import { IconBtn, EDIT_HOVER, DELETE_HOVER } from '../../components/shared/IconBtn';
import { useT } from '../../i18n';
import { useLingua } from '../../utils/formatoLingua';

/* Estilo Mare: cartao de pagina e figuras (contagens, notas) em mono */
const CARTAO = 'bg-white rounded-[18px] border border-mare-card p-[22px] min-w-0';
const NUM = 'font-mono tabular-nums';

/* ── StaffCard ── */
function StaffCard({ member, onEdit, onDelete, onCreateAccount, creatingAccountId }) {
  const navigate = useNavigate();
  const t = useT();
  const lang = useLingua();
  return (
    <article className={CARTAO}>
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <StaffAvatar member={member} size={44} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-display text-lg font-semibold text-ocean-900 break-words min-w-0">{member.name}</p>
              {member.role === CARGO_VENDEDOR && (
                <Badge variant="direct">{t('staff.card.sellerBadge')}</Badge>
              )}
            </div>
            <p className="text-sm font-body text-n-600 break-words">{rotuloCargo(member.role, t, lang)}</p>
          </div>
        </div>
        <div className="flex shrink-0">
          <IconBtn icon={ClipboardCheck} onClick={() => navigate(`/colaboradores/${member.id}`)}
            title={t('staff.card.hrTitle')}
            label={t('staff.card.hrAria', { name: member.name })}
            hover={EDIT_HOVER} />
          <IconBtn icon={Pencil} onClick={() => onEdit(member)}
            label={t('staff.card.editAria', { name: member.name })}
            hover={EDIT_HOVER} />
          <IconBtn icon={Trash2} onClick={() => onDelete(member)}
            label={t('staff.card.deleteAria', { name: member.name })}
            hover={DELETE_HOVER} />
        </div>
      </div>
      <div className="space-y-1.5">
        {member.phone && (
          <p className="text-sm font-body text-n-600 flex items-center gap-1.5 break-words min-w-0">
            <Phone size={13} strokeWidth={1.75} className="text-n-500 shrink-0" /><span className={NUM}>{member.phone}</span>
          </p>
        )}
        {member.email && (
          <p className="text-sm font-body text-n-600 flex items-center gap-1.5 break-all min-w-0">
            <Mail size={13} strokeWidth={1.75} className="text-n-500 shrink-0" />{member.email}
          </p>
        )}
        {member.email && (
          member.user_id ? (
            <p className="text-sm font-body text-[var(--success)] flex items-center gap-1.5">
              <CheckCircle2 size={13} strokeWidth={1.75} />{t('staff.card.accountActive')}
            </p>
          ) : (
            <button type="button" onClick={() => onCreateAccount(member)}
              disabled={creatingAccountId === member.id}
              className="min-h-11 md:min-h-0 text-sm font-body font-semibold text-ocean-700 hover:underline flex items-center gap-1.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sand-500 disabled:opacity-50">
              <Shield size={13} strokeWidth={1.75} />
              {creatingAccountId === member.id ? t('staff.card.creatingAccount') : t('staff.card.createAccount')}
            </button>
          )
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-n-100 text-sm font-body text-n-600">
        <span className="flex items-center gap-1">
          <Briefcase size={13} strokeWidth={1.75} /><span className={NUM}>{t('staff.card.jobs', { n: member.total_jobs_completed || 0 })}</span>
        </span>
        {member.average_rating > 0 && (
          <span className={`flex items-center gap-1 ${NUM}`}>
            <Star size={13} strokeWidth={1.75} className="text-sand-500 fill-sand-500" />
            {Number(member.average_rating).toFixed(1)}
          </span>
        )}
        <Badge variant={member.status === 'active' ? 'ready' : 'default'}>
          {member.status === 'active' ? t('staff.status.active') : t('staff.status.inactive')}
        </Badge>
      </div>
    </div>
    </article>
  );
}

export default StaffCard;
