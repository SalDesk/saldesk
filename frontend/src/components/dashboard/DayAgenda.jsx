import { useT } from '../../i18n';
import { estadoDoEvento, ordenarAgenda } from '../../pages/dashboard/agendaLogic';

const FIM_DO_DIA_MIN = 23 * 60 + 59;
const MAX_INICIAIS = 3;

function paraHora(minutos) {
  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
}

/* "Ana Maria Silva" -> "AS"; "Ana" -> "A" */
function iniciais(nome) {
  const partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '';
  const primeira = partes[0][0];
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return (primeira + ultima).toUpperCase();
}

/* Lotacao em percentagem (0-100), ou null sem capacidade */
function lotacao(evento) {
  if (!(evento.capacidade > 0)) return null;
  return Math.min(100, Math.round((evento.pessoas / evento.capacidade) * 100));
}

function Pilula({ tom, children }) {
  const cores = {
    sucesso: 'bg-[var(--success-light)] text-[var(--success)]',
    aviso: 'bg-[var(--warning-light)] text-[var(--warning)]',
    info: 'bg-ocean-50 text-ocean-700',
  };
  return (
    <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-body font-semibold ${cores[tom]}`}>
      {children}
    </span>
  );
}

function Evento({ evento, agoraMin, onAbrir }) {
  const t = useT();
  const estado = estadoDoEvento(evento, agoraMin);
  const pct = lotacao(evento);
  const cheio = pct !== null && pct >= 80;

  const guia = evento.guias.length > 0
    ? `${t('dashboard.agenda.guide', { name: evento.guias[0] })}${evento.guias.length > 1 ? ` +${evento.guias.length - 1}` : ''}`
    : '';
  /* Hotel, rent-a-car e restaurante trazem a linha secundaria ja composta (agendaTipos.js) */
  const detalhe = evento.detalhe || [
    evento.capacidade > 0 ? `${evento.pessoas}/${evento.capacidade}` : String(evento.pessoas),
    guia,
    evento.local,
  ].filter(Boolean).join(' · ');

  let pilula = null;
  if (estado === 'concluido') pilula = <Pilula tom="sucesso">{t('dashboard.agenda.done')}</Pilula>;
  else if (evento.pendentes > 0) pilula = <Pilula tom="aviso">{t('dashboard.agenda.toConfirm', { n: evento.pendentes })}</Pilula>;
  else if (cheio) pilula = <Pilula tom="info">{t('dashboard.agenda.nearlyFull')}</Pilula>;

  const aDecorrer = estado === 'a_decorrer';
  const clientes = evento.clientes.slice(0, MAX_INICIAIS);
  const resto = evento.clientes.length - clientes.length;

  return (
    <li className="relative">
      {/* ponto na linha do tempo */}
      <span
        aria-hidden="true"
        className={`absolute -left-[21px] top-4 w-2.5 h-2.5 rounded-full border-2 border-ocean-500 ${aDecorrer ? 'bg-ocean-500' : 'bg-white'}`}
      />
      <button
        type="button"
        data-estado={estado}
        onClick={() => onAbrir(evento)}
        className={[
          'w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-md border bg-white transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-300 hover:border-ocean-300',
          aDecorrer ? 'border-ocean-500 ring-4 ring-ocean-50' : 'border-n-200',
          estado === 'concluido' ? 'opacity-60' : '',
        ].join(' ')}
      >
        <div className="min-w-0 flex-1">
          <p className="font-display font-semibold text-[13px] text-n-900 truncate">{evento.titulo}</p>
          <p className="text-xs font-body text-n-500 truncate tabular-nums">{detalhe}</p>
          {pct !== null && (
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
              aria-label={detalhe}
              className="mt-1.5 h-1.5 max-w-[160px] rounded-full bg-n-100 overflow-hidden"
            >
              <div className={`h-full rounded-full ${cheio ? 'bg-sand-500' : 'bg-ocean-500'}`} style={{ width: `${pct}%` }} />
            </div>
          )}
          {aDecorrer && (
            <p className="mt-1 text-[11px] font-body font-semibold text-ocean-600">
              {t('dashboard.agenda.now', { time: paraHora(Math.min(evento.fimMin, FIM_DO_DIA_MIN)) })}
            </p>
          )}
        </div>
        {aDecorrer && clientes.length > 0 && (
          <span className="hidden sm:flex shrink-0" aria-hidden="true">
            {clientes.map((c, i) => (
              <span key={`${c}-${i}`} className="-ml-1.5 first:ml-0 w-6 h-6 rounded-full border-2 border-white bg-ocean-100 text-ocean-700 text-[10px] font-body font-bold grid place-items-center">
                {iniciais(c)}
              </span>
            ))}
            {resto > 0 && (
              <span className="-ml-1.5 w-6 h-6 rounded-full border-2 border-white bg-n-100 text-n-600 text-[10px] font-body font-bold grid place-items-center">
                {`+${resto}`}
              </span>
            )}
          </span>
        )}
        {pilula}
      </button>
    </li>
  );
}

/* Agenda do dia: linha do tempo vertical de eventos ja normalizados (ver agendaLogic.js).
   Nao conhece tipos de operador. */
export default function DayAgenda({ eventos, agoraMin, onAbrir, vazio, resumo }) {
  const t = useT();
  const lista = Array.isArray(eventos) ? eventos : [];
  const { semHora, comHora } = ordenarAgenda(lista);
  const pessoas = lista.reduce((s, e) => s + (Number(e.pessoas) || 0), 0);

  return (
    <section className="bg-white border border-n-200 rounded-md">
      <header className="flex items-center gap-2 px-4 py-3 border-b border-n-200">
        <h2 className="font-display font-semibold text-sm text-n-900">{t('dashboard.agenda.title')}</h2>
        {lista.length > 0 && (
          <span className="ml-auto text-xs font-body text-n-500 tabular-nums">
            {resumo || t('dashboard.agenda.summary', { tours: lista.length, people: pessoas })}
          </span>
        )}
      </header>

      {lista.length === 0 ? vazio : (
        <div className="px-4 py-3 space-y-3">
          {semHora.length > 0 && (
            <div>
              <p className="text-xs font-body font-semibold text-n-500 mb-1.5">{t('dashboard.agenda.noTime')}</p>
              <ul className="relative pl-[21px] space-y-2">
                {semHora.map((e) => <Evento key={e.id} evento={e} agoraMin={agoraMin} onAbrir={onAbrir} />)}
              </ul>
            </div>
          )}
          {comHora.length > 0 && (
            <ol className="relative space-y-2">
              {/* linha vertical */}
              <span aria-hidden="true" className="absolute left-[49px] top-3 bottom-3 w-0.5 bg-n-200" />
              {comHora.map((e) => (
                <li key={e.id} className="flex items-start gap-[22px]">
                  <span className="w-[44px] shrink-0 pt-3 text-right font-display font-semibold text-xs text-n-700 tabular-nums">{e.inicio}</span>
                  <ul className="flex-1 min-w-0 relative">
                    <Evento evento={e} agoraMin={agoraMin} onAbrir={onAbrir} />
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}
