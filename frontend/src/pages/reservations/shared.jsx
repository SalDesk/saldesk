/* Helpers partilhados pelas tabelas e modais de Reservas */
import FilterChips from '../../components/ui/FilterChips';
import { useT } from '../../i18n';
import { formatarData, formatarNumero, linguaActual } from '../../utils/formatoLingua';
import { eurosDuasCasas } from '../../utils/formatoEuros';
import { rotuloMetodo } from '../financial/shared';

/* Origens com cor propria; o valor gravado nunca muda, o rotulo vem de rotuloOrigem */
export const SOURCES_FILTRO = ['direct', 'public', 'booking_com', 'airbnb', 'viator', 'getyourguide', 'manual'];

/* Nomes de marcas: iguais em todas as linguas */
const MARCAS_ORIGEM = { booking_com: 'Booking.com', airbnb: 'Airbnb', viator: 'Viator', getyourguide: 'GetYourGuide' };
const ORIGENS_TRADUZIDAS = ['direct', 'public', 'manual', 'conect', 'admin'];

/* Rotulo da origem de uma reserva; um valor desconhecido mostra-se tal e qual */
export function rotuloOrigem(origem, t) {
  if (MARCAS_ORIGEM[origem]) return MARCAS_ORIGEM[origem];
  if (ORIGENS_TRADUZIDAS.includes(origem)) return t(`reservations.sourceLabel.${origem}`);
  return origem;
}

export const SOURCE_CLASS = {
  direct:       'bg-ocean-50 text-ocean-700 border border-ocean-100',
  public:       'bg-ocean-50 text-ocean-700 border border-ocean-100',
  booking_com:  'bg-blue-50 text-blue-700 border border-blue-200',
  airbnb:       'bg-rose-50 text-rose-700 border border-rose-200',
  viator:       'bg-orange-50 text-orange-700 border border-orange-200',
  getyourguide: 'bg-[#ECFDF5] text-[#1A7A4A] border border-[#BBF7D0]',
  manual:       'bg-n-50 text-n-600 border border-n-200',
};

/* Titulo de um grupo de controlos (chips) sem campo proprio: igual a etiqueta dos campos */
export const GROUP_LABEL_CLASS =
  'text-xs font-body font-bold uppercase tracking-wide text-n-600 dark:text-n-400 app:normal-case app:tracking-normal app:text-[13px] app:text-n-700';

export const STATUS_NEXT  = { pending: 'confirmed', confirmed: 'checked_in', checked_in: 'checked_out' };

/* Rotulo do botao que avanca o estado: Confirmar, Check-in, Check-out */
export function rotuloProximoEstado(estado, t) {
  if (estado === 'pending') return t('common.confirm');
  if (estado === 'confirmed') return t('reservations.checkIn');
  if (estado === 'checked_in') return t('reservations.checkOut');
  return '';
}

/* Data AAAA-MM-DD na lingua do painel (em pt: dd/mm/aaaa, como sempre) */
export function formatDate(d) {
  if (!d) return '—';
  return formatarData(d);
}

/* Euros: em pt escreve-se como sempre (sem separador de milhares); nas outras linguas com os separadores da lingua.
   `eurosInteiros` arredonda as tabelas, `eurosDecimais` mostra sempre os centimos (o mesmo que eurosDuasCasas). */
export function eurosInteiros(valor, lang = linguaActual()) {
  const n = Number(valor || 0).toFixed(0);
  return lang === 'pt' ? `€${n}` : `€${formatarNumero(n, {}, lang)}`;
}
export function eurosDecimais(valor, lang = linguaActual()) {
  return eurosDuasCasas(valor, lang);
}

/* Metodo de pagamento no detalhe: em pt o valor gravado em maiusculas, como sempre; nas outras linguas o rotulo
   do Financeiro, e um metodo que ele nao conhece mostra-se gravado, em maiusculas */
export function rotuloMetodoReserva(metodo, t, lang = linguaActual()) {
  if (lang === 'pt') return metodo.toUpperCase();
  const rotulo = rotuloMetodo(metodo, t);
  return rotulo === metodo ? metodo.toUpperCase() : rotulo;
}

/* Texto com o nome do cliente a negrito: o nome entra onde a traducao pos {{name}} */
export function TextoComNome({ chave, nome }) {
  const t = useT();
  const [antes, depois] = t(chave, { name: '\u0000' }).split('\u0000');
  return <>{antes}<strong>{nome}</strong>{depois}</>;
}

export function SourceBadge({ source }) {
  const t = useT();
  return (
    <span className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded-xs uppercase tracking-wide whitespace-nowrap ${SOURCE_CLASS[source] || SOURCE_CLASS.manual}`}>
      {rotuloOrigem(source, t)}
    </span>
  );
}

export function parseRentacarMeta(r) {
  try { return JSON.parse(r?.notes_internal || '{}')?.rentacar || {}; } catch { return {}; }
}

/* Niveis de combustivel: o valor numerico e o que se grava; o rotulo vem de rotuloNivelCombustivel */
export const FUEL_LEVELS = [0, 1, 2, 3, 4].map((value) => ({ value }));
const FRACOES_COMBUSTIVEL = { 1: '1/4', 2: '1/2', 3: '3/4' };

export function rotuloNivelCombustivel(valor, t) {
  if (valor === 0) return t('reservations.fuel.empty');
  if (valor === 4) return t('reservations.fuel.full');
  return FRACOES_COMBUSTIVEL[valor] || String(valor);
}

export function FuelSelector({ value, onChange }) {
  const t = useT();
  const opcoes = FUEL_LEVELS.map((n) => ({ value: n.value, label: rotuloNivelCombustivel(n.value, t) }));
  return <FilterChips options={opcoes} value={value} onChange={onChange} />;
}

export function parseRestaurantMeta(r) {
  try { return JSON.parse(r?.notes_guest || '{}'); } catch { return {}; }
}

/* Turno e ocasiao gravados em notes_guest (almoco, jantar; aniversario, ...): o rotulo vem das traducoes */
const TURNO_CHAVE = { almoco: 'lunch', jantar: 'dinner' };
const OCASIAO_CHAVE = { aniversario: 'birthday', lua_de_mel: 'honeymoon', negocios: 'business', outro: 'other' };
export const rotuloTurno = (valor, t) => (TURNO_CHAVE[valor] ? t(`reservations.shift.${TURNO_CHAVE[valor]}`) : valor);
export const rotuloOcasiao = (valor, t) => (OCASIAO_CHAVE[valor] ? t(`reservations.occasion.${OCASIAO_CHAVE[valor]}`) : valor);
export const OCASIOES = Object.keys(OCASIAO_CHAVE);
