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
import { StaffAvatar } from './shared';

/* ── StaffCard ── */
function StaffCard({ member, onEdit, onDelete, onCreateAccount, creatingAccountId }) {
  const navigate = useNavigate();
  return (
    <div className="bg-white rounded-md border border-n-200 shadow-sm p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <StaffAvatar member={member} size={44} />
          <div>
            <div className="flex items-center gap-2">
              <p className="font-display font-semibold text-sm text-n-900">{member.name}</p>
              {member.role === 'Vendedor de Praia' && (
                <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 bg-sand-300 text-sand-700 rounded-xs uppercase tracking-wide">
                  Vendedor
                </span>
              )}
            </div>
            <p className="text-xs font-body text-n-500">{member.role}</p>
          </div>
        </div>
        <div className="flex gap-0.5">
          <button onClick={() => navigate(`/colaboradores/${member.id}`)}
            title="Ferias, documentos e certificacoes"
            className="p-1.5 rounded text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors">
            <ClipboardCheck size={14} strokeWidth={1.75} />
          </button>
          <button onClick={() => onEdit(member)}
            className="p-1.5 rounded text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors">
            <Pencil size={14} strokeWidth={1.75} />
          </button>
          <button onClick={() => onDelete(member)}
            className="p-1.5 rounded text-n-400 hover:text-error hover:bg-red-50 transition-colors">
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
            <p className="text-xs font-body text-green-600 flex items-center gap-1.5">
              <CheckCircle2 size={11} strokeWidth={1.75} />Conta activa
            </p>
          ) : (
            <button type="button" onClick={() => onCreateAccount(member)}
              disabled={creatingAccountId === member.id}
              className="text-xs font-body font-semibold text-ocean-700 hover:underline flex items-center gap-1.5 disabled:opacity-50">
              <Shield size={11} strokeWidth={1.75} />
              {creatingAccountId === member.id ? 'A criar conta...' : 'Criar conta'}
            </button>
          )
        )}
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-n-100 text-xs font-body text-n-500">
        <span className="flex items-center gap-1">
          <Briefcase size={11} strokeWidth={1.75} />{member.total_jobs_completed || 0} trabalhos
        </span>
        {member.average_rating > 0 && (
          <span className="flex items-center gap-1">
            <Star size={11} strokeWidth={1.75} className="text-sand-500 fill-sand-500" />
            {Number(member.average_rating).toFixed(1)}
          </span>
        )}
        <span className={`flex items-center gap-1 ${member.status === 'active' ? 'text-green-600' : 'text-n-400'}`}>
          <Circle size={7} strokeWidth={0} className={member.status === 'active' ? 'fill-green-500' : 'fill-n-300'} />
          {member.status === 'active' ? 'Activo' : 'Inactivo'}
        </span>
      </div>
    </div>
  );
}

export default StaffCard;
