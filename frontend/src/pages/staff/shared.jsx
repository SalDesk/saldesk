/* ── Constants ── */
export const ROLES_BY_TYPE = {
  activity:   ['Guia', 'Instrutor', 'Condutor', 'Vendedor de Praia', 'Administracao', 'Gestor/Supervisor'],
  hotel:      ['Recepcionista', 'Camareira/Housekeeping', 'Porteiro', 'Manutencao', 'Administracao', 'Gestor/Supervisor'],
  rentacar:   ['Mecanico', 'Motorista', 'Lavador/Detailing', 'Inspector', 'Administracao', 'Gestor/Supervisor'],
  restaurant: ['Garcom', 'Cozinheiro/Chef', 'Sub-chef', 'Bartender', 'Caixa', 'Empregado de Limpeza', 'Administracao', 'Gestor/Supervisor'],
};
export const ROLES_DEFAULT = ['Administracao', 'Gestor/Supervisor'];
export const SELLER_ZONES = ['Santa Maria Norte', 'Santa Maria Sul', 'Praia de Santa Maria', 'Aeroporto', 'Espargos', 'Outro'];
export const DAYS  = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];
export const PRIO  = { low: 'Baixa', medium: 'Media', high: 'Alta', urgent: 'Urgente' };
export const PRIO_COLORS = {
  low:    'text-n-500 bg-n-100',
  medium: 'text-[var(--warning)] bg-[var(--warning-light)]',
  high:   'text-[var(--error)] bg-[var(--error-light)]',
  urgent: 'text-white bg-[var(--error)]',
};
export const CHECKLIST_KEY = 'saldesk_checklist_v1';
export const STARTER_STAFF_LIMIT = 2;
export const DEFAULT_TASKS = [
  'Verificar equipamento e material',
  'Confirmar reservas do dia',
  'Briefing com a equipa',
  'Verificar seguranca e primeiros socorros',
  'Comunicar horario de inicio ao grupo',
];

export const KANBAN_COLS = [
  { key: 'pending',     label: 'Pendente',    color: 'border-[var(--warning)] text-[var(--warning)] bg-[var(--warning-light)]' },
  { key: 'in_progress', label: 'Em Progresso', color: 'border-ocean-300 text-ocean-700 bg-ocean-50' },
  { key: 'completed',   label: 'Concluida',   color: 'border-[var(--success)] text-[var(--success)] bg-[var(--success-light)]' },
  { key: 'cancelled',   label: 'Bloqueada',   color: 'border-[var(--error)] text-[var(--error)] bg-[var(--error-light)]' },
];

export function tryParseNotes(str) {
  try { return JSON.parse(str || ''); } catch { return null; }
}

/* ── StaffAvatar ── */
export function StaffAvatar({ member, size = 40, showStatus = true }) {
  const initials = member.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {member.photo_url ? (
        <img src={member.photo_url} alt={member.name}
          className="w-full h-full rounded-full object-cover" />
      ) : (
        <div className="w-full h-full rounded-full bg-ocean-700 flex items-center justify-center text-white font-display font-bold"
          style={{ fontSize: Math.round(size * 0.36) }}>
          {initials}
        </div>
      )}
      {showStatus && (
        <span className={`absolute bottom-0 right-0 rounded-full border-2 border-white ${size >= 36 ? 'w-3 h-3' : 'w-2.5 h-2.5'} ${member.status === 'active' ? 'bg-[var(--success)]' : 'bg-n-300'}`} />
      )}
    </div>
  );
}
