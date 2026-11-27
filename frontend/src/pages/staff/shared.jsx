/* ── Constants ── */
/* Os cargos, zonas, dias e tarefas abaixo sao valores gravados (ou comparados) tal como estao: nunca mudam
   com a lingua. O que se le no ecra passa pelos mapas de rotulos (CARGO_CHAVE, ZONA_CHAVE, DIA_CHAVE,
   TAREFA_CHAVE) e pelas chaves staff.* do i18n. */
export const CARGO_VENDEDOR = 'Vendedor de Praia';
export const ROLES_BY_TYPE = {
  activity:   ['Guia', 'Instrutor', 'Condutor', CARGO_VENDEDOR, 'Administracao', 'Gestor/Supervisor'],
  hotel:      ['Recepcionista', 'Camareira/Housekeeping', 'Porteiro', 'Manutencao', 'Administracao', 'Gestor/Supervisor'],
  rentacar:   ['Mecanico', 'Motorista', 'Lavador/Detailing', 'Inspector', 'Administracao', 'Gestor/Supervisor'],
  restaurant: ['Garcom', 'Cozinheiro/Chef', 'Sub-chef', 'Bartender', 'Caixa', 'Empregado de Limpeza', 'Administracao', 'Gestor/Supervisor'],
};
export const ROLES_DEFAULT = ['Administracao', 'Gestor/Supervisor'];
export const SELLER_ZONES = ['Santa Maria Norte', 'Santa Maria Sul', 'Praia de Santa Maria', 'Aeroporto', 'Espargos', 'Outro'];
export const DAYS  = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];

/* Cargo gravado -> chave em staff.roles (inclui as funcoes dos guias e um cargo antigo, 'Recepcao') */
export const CARGO_CHAVE = {
  'Guia': 'guia', 'Instrutor': 'instrutor', 'Condutor': 'condutor', [CARGO_VENDEDOR]: 'vendedorPraia',
  'Administracao': 'administracao', 'Gestor/Supervisor': 'gestor',
  'Recepcionista': 'recepcionista', 'Camareira/Housekeeping': 'camareira', 'Porteiro': 'porteiro', 'Manutencao': 'manutencao',
  'Mecanico': 'mecanico', 'Motorista': 'motorista', 'Lavador/Detailing': 'lavador', 'Inspector': 'inspector',
  'Garcom': 'garcom', 'Cozinheiro/Chef': 'cozinheiro', 'Sub-chef': 'subChef', 'Bartender': 'bartender', 'Caixa': 'caixa',
  'Empregado de Limpeza': 'limpeza',
  'Guia-Instrutor': 'guiaInstrutor', 'Assistente': 'assistente', 'Outro': 'outro', 'Recepcao': 'recepcao',
};
export const ZONA_CHAVE = {
  'Santa Maria Norte': 'santaMariaNorte', 'Santa Maria Sul': 'santaMariaSul', 'Praia de Santa Maria': 'praiaSantaMaria',
  'Aeroporto': 'aeroporto', 'Espargos': 'espargos', 'Outro': 'outro',
};
export const DIA_CHAVE = { Seg: 'mon', Ter: 'tue', Qua: 'wed', Qui: 'thu', Sex: 'fri', Sab: 'sat', Dom: 'sun' };
/* Indice do mes (0-11) -> chave em staff.months; MES_CHAVE e rotuloMes vivem em utils/rotuloMes.js */
export { MES_CHAVE, rotuloMes } from '../../utils/rotuloMes';

/* Rotulo de um valor gravado: em pt mostra-se o proprio valor, tal como sempre se leu (alguns estao
   gravados sem acento e o pt.json, que tem de ter acentos, nao serve aqui); nas outras linguas vai a
   traducao. Um valor que o mapa nao conhece (cargo escrito a mao, tarefa nova) mostra-se tal e qual. */
function rotuloGuardado(valor, mapa, prefixo, t, lang) {
  if (!valor || lang === 'pt' || !Object.prototype.hasOwnProperty.call(mapa, valor)) return valor;
  return t(`${prefixo}.${mapa[valor]}`);
}
export const rotuloCargo = (valor, t, lang) => rotuloGuardado(valor, CARGO_CHAVE, 'staff.roles', t, lang);
export const rotuloZona = (valor, t, lang) => rotuloGuardado(valor, ZONA_CHAVE, 'staff.zones', t, lang);
/* Os dias leem-se pelas chaves staff.days, cujo pt e igual ao valor gravado */
export const rotuloDia = (valor, t) => (DIA_CHAVE[valor] ? t(`staff.days.${DIA_CHAVE[valor]}`) : valor);

/* Ferias e licencas: o tipo e o estado gravam-se em ingles (vacation, sick...; pending, approved, rejected) */
export const TIPOS_FERIAS = ['vacation', 'sick', 'maternity', 'paternity', 'unpaid', 'other'];
export const rotuloTipoFerias = (tipo, t) => (TIPOS_FERIAS.includes(tipo) ? t(`hr.leaveTypes.${tipo}`) : tipo);
/* Como sempre: o que nao e pendente nem aprovado le-se como rejeitado */
export const rotuloEstadoFerias = (estado, t) => t(`hr.leaveStatus.${estado === 'pending' || estado === 'approved' ? estado : 'rejected'}`);

/* Prioridades das tarefas (gravadas em ingles no JSON da tarefa) */
export const PRIO_NIVEIS = ['low', 'medium', 'high', 'urgent'];
export const rotuloPrio = (p, t) => (PRIO_NIVEIS.includes(p) ? t(`staff.prio.${p}`) : p);
export const PRIO_COLORS = {
  low:    'text-n-500 bg-n-100',
  medium: 'text-[var(--warning)] bg-[var(--warning-light)]',
  high:   'text-[var(--error)] bg-[var(--error-light)]',
  urgent: 'text-white bg-[var(--error)]',
};
export const CHECKLIST_KEY = 'saldesk_checklist_v1';
export const STARTER_STAFF_LIMIT = 2;
/* Tarefas por omissao da checklist: o texto e o que fica guardado no localStorage do operador */
export const DEFAULT_TASKS = [
  'Verificar equipamento e material',
  'Confirmar reservas do dia',
  'Briefing com a equipa',
  'Verificar segurança e primeiros socorros',
  'Comunicar horário de início ao grupo',
];
const TAREFA_CHAVE = {
  [DEFAULT_TASKS[0]]: 'equipamento', [DEFAULT_TASKS[1]]: 'reservas', [DEFAULT_TASKS[2]]: 'briefing',
  [DEFAULT_TASKS[3]]: 'seguranca', [DEFAULT_TASKS[4]]: 'horario',
};
export const rotuloTarefa = (valor, t, lang) => rotuloGuardado(valor, TAREFA_CHAVE, 'staff.defaultTasks', t, lang);

/* Colunas do quadro de tarefas: key e o estado gravado, rotulo a chave do i18n */
export const KANBAN_COLS = [
  { key: 'pending',     rotulo: 'staff.kanban.pending',    color: 'border-[var(--warning)] text-[var(--warning)] bg-[var(--warning-light)]' },
  { key: 'in_progress', rotulo: 'staff.kanban.inProgress', color: 'border-ocean-300 text-ocean-700 bg-ocean-50' },
  { key: 'completed',   rotulo: 'staff.kanban.completed',  color: 'border-[var(--success)] text-[var(--success)] bg-[var(--success-light)]' },
  { key: 'cancelled',   rotulo: 'staff.kanban.cancelled',  color: 'border-[var(--error)] text-[var(--error)] bg-[var(--error-light)]' },
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
        <div className="w-full h-full rounded-full bg-ocean-700 flex items-center justify-center text-white font-display font-bold app:bg-ocean-100 app:text-ocean-800"
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
