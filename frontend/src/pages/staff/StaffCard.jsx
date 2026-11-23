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
  Circle,
  ClipboardCheck,
} from 'lucide-react';
import { StaffAvatar, CARGO_VENDEDOR, rotuloCargo } from './shared';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import { useT } from '../../i18n';
import { useLingua } from '../../utils/formatoLingua';

/* ── StaffCard ── */
function StaffCard({ member, onEdit, onDelete, onCreateAccount, creatingAccountId }) {
  const navigate = useNavigate();
  const t = useT();
  const lang = useLingua();
  return (
    <Card padding="p-4">
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <StaffAvatar member={member} size={44} />
          <div>
            <div className="flex items-center gap-2">
              <p className="font-display font-semibold text-sm text-n-900">{member.name}</p>
              {member.role === CARGO_VENDEDOR && (
                <Badge variant="direct">{t('staff.card.sellerBadge')}</Badge>
              )}
            </div>
            <p className="text-xs font-body text-n-500">{rotuloCargo(member.role, t, lang)}</p>
          </div>
        </div>
        <div className="flex gap-0.5">
          <button onClick={() => navigate(`/colaboradores/${member.id}`)}
            title={t('staff.card.hrTitle')}
            aria-label={t('staff.card.hrAria', { name: member.name })}
            className="p-1.5 rounded text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors">
            <ClipboardCheck size={14} strokeWidth={1.75} />
          </button>
          <button onClick={() => onEdit(member)}
            aria-label={t('staff.card.editAria', { name: member.name })}
            className="p-1.5 rounded text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors">
            <Pencil size={14} strokeWidth={1.75} />
          </button>
          <button onClick={() => onDelete(member)}
            aria-label={t('staff.card.deleteAria', { name: member.name })}
            className="p-1.5 rounded text-n-400 hover:text-[var(--error)] hover:bg-[var(--error-light)] transition-colors">
            <Trash2 size={14} strokeWidth={1.75} />
          </button>
        </div>
      </div>
      <div className="space-y-1">
        {member.phone && (
          <p className="text-xs font-body text-n-600 flex items-center gap-1.5">
            <Phone size={11} strokeWidth={1.75} className="text-n-400" />{member.phone}
          </p>
        )}
        {member.email && (
          <p className="text-xs font-body text-n-600 flex items-center gap-1.5">
            <Mail size={11} strokeWidth={1.75} className="text-n-400" />{member.email}
          </p>
        )}
        {member.email && (
          member.user_id ? (
            <p className="text-xs font-body text-[var(--success)] flex items-center gap-1.5">
              <CheckCircle2 size={11} strokeWidth={1.75} />{t('staff.card.accountActive')}
            </p>
          ) : (
            <button type="button" onClick={() => onCreateAccount(member)}
              disabled={creatingAccountId === member.id}
              className="text-xs font-body font-semibold text-ocean-700 hover:underline flex items-center gap-1.5 disabled:opacity-50">
              <Shield size={11} strokeWidth={1.75} />
              {creatingAccountId === member.id ? t('staff.card.creatingAccount') : t('staff.card.createAccount')}
            </button>
          )
        )}
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-n-100 text-xs font-body text-n-500">
        <span className="flex items-center gap-1">
          <Briefcase size={11} strokeWidth={1.75} />{t('staff.card.jobs', { n: member.total_jobs_completed || 0 })}
        </span>
        {member.average_rating > 0 && (
          <span className="flex items-center gap-1">
            <Star size={11} strokeWidth={1.75} className="text-sand-500 fill-sand-500" />
            {Number(member.average_rating).toFixed(1)}
          </span>
        )}
        <span className={`flex items-center gap-1 ${member.status === 'active' ? 'text-[var(--success)]' : 'text-n-400'}`}>
          <Circle size={7} strokeWidth={0} className={member.status === 'active' ? 'fill-[var(--success)]' : 'fill-n-300'} />
          {member.status === 'active' ? t('staff.status.active') : t('staff.status.inactive')}
        </span>
      </div>
    </div>
    </Card>
  );
}

export default StaffCard;
