import { useState } from 'react';
import { useT } from '../../i18n';
import { estadoDoEvento, ordenarAgenda } from '../../pages/dashboard/agendaLogic';
import { detalheSaida } from '../../pages/dashboard/mareLogic';
import { eurosDecimais } from '../../pages/reservations/shared';

/* Duracao em minutos -> "3 h" ou "2 h 30" (sem palavras: igual em todas as linguas) */
function duracaoTexto(evento) {
  if (evento.inicioMin == null || evento.fimMin == null) return '';
  const min = evento.fimMin - evento.inicioMin;
  if (!(min > 0)) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

/* Estado visual da saida: "sem guia" (vermelho) sobrepoe-se a tudo o que ainda nao terminou */
function estadoVisual(evento, agoraMin, guiasConhecidos) {
  const estado = estadoDoEvento(evento, agoraMin);
  /* com as atribuicoes por carregar nao se sabe quem guia: nao ha alarme de "sem guia" */
  const semGuia = guiasConhecidos && evento.guias.length === 0 && estado !== 'concluido';
  if (semGuia) return { chave: 'noGuideStatus', tom: 'alerta', estado };
  if (estado === 'a_decorrer') return { chave: 'nowStatus', tom: 'curso', estado };
  if (estado === 'concluido') return { chave: 'doneStatus', tom: 'feito', estado };
  if (estado === 'sem_hora') return { chave: 'noTimeStatus', tom: 'seguir', estado };
  return { chave: 'nextStatus', tom: 'seguir', estado };
}

const TONS = {
  alerta: { ponto: 'bg-red-600', halo: 'ring-red-100', pilula: 'bg-red-50 text-red-700' },
  curso: { ponto: 'bg-turquoise-600', halo: 'ring-turquoise-100', pilula: 'bg-turquoise-100 text-turquoise-700' },
  seguir: { ponto: 'bg-ocean-500', halo: 'ring-ocean-100', pilula: 'bg-ocean-100 text-ocean-800' },
  feito: { ponto: 'bg-n-400', halo: 'ring-n-100', pilula: 'bg-n-100 text-n-600' },
};

/* Agenda do dia das atividades: lista de saidas (esquerda) e detalhe da saida escolhida (direita;
   no telemovel fica por baixo da lista). Eventos ja normalizados por eventosAtividades.
   erro: texto de erro (as reservas ou os servicos nao carregaram) que substitui a lista e o vazio;
   guiasConhecidos: false quando as atribuicoes nao carregaram (o guia fica "—", sem alarme). */
export default function AgendaSaidas({ eventos, reservasHoje, tours, agoraMin, onAbrirManifesto, vazio, erro = null, guiasConhecidos = true }) {
  const t = useT();
  const lista = Array.isArray(eventos) ? eventos : [];
  const { semHora, comHora } = ordenarAgenda(lista);
  const ordenados = [...comHora, ...semHora];
  const [escolhidoId, setEscolhidoId] = useState(null);

  const detalhes = new Map(ordenados.map((e) => [e.id, detalheSaida(e, reservasHoje, tours)]));
  const pessoasTotal = ordenados.reduce((s, e) => s + detalhes.get(e.id).total, 0);

  /* Por omissao: a primeira saida que ainda nao terminou; se todas terminaram, a ultima */
  const porOmissao = ordenados.find((e) => estadoDoEvento(e, agoraMin) !== 'concluido') || ordenados[ordenados.length - 1];
  const escolhido = ordenados.find((e) => e.id === escolhidoId) || porOmissao;

  const pessoasTexto = (n) => t('dashboard.saidas.people', { n });

  let painel = null;
  if (escolhido) {
    const d = detalhes.get(escolhido.id);
    const pct = d.total > 0 ? Math.min(100, Math.round((d.checkin / d.total) * 100)) : 0;
    const duracao = duracaoTexto(escolhido);
    const cabecalho = [escolhido.inicio, duracao].filter(Boolean).join(' · ');
    painel = (
      <aside aria-label={t('dashboard.saidas.detail')} className="bg-ocean-50/60 border border-ocean-100 rounded-xl p-4 lg:p-5 flex flex-col gap-3.5 min-w-0">
        <div className="flex flex-col gap-1">
          {cabecalho && <span className="font-mono text-[13px] text-ocean-600">{cabecalho}</span>}
          <span className="font-display font-bold text-lg lg:text-xl text-ocean-900 leading-tight">{escolhido.titulo}</span>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-[13px] font-body text-n-700">
            <span>{t('dashboard.saidas.checkin')}</span>
            <span className="font-mono tabular-nums">{`${d.checkin} / ${d.total}`}</span>
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            aria-valuetext={t('dashboard.saidas.checkinOf', { a: d.checkin, b: d.total })}
            aria-label={t('dashboard.saidas.checkin')}
            className="h-2 rounded-full bg-ocean-100 overflow-hidden"
          >
            <div className="h-full rounded-full bg-turquoise-600" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm font-body">
          <dt className="text-n-600">{t('dashboard.saidas.guide')}</dt>
          <dd className="font-semibold text-n-900">
            {escolhido.guias.length > 0 ? escolhido.guias.join(', ') : (guiasConhecidos ? t('dashboard.saidas.toAssign') : '—')}
          </dd>
          {escolhido.local && (
            <>
              <dt className="text-n-600">{t('dashboard.saidas.meeting')}</dt>
              <dd className="text-n-900">{escolhido.local}</dd>
            </>
          )}
          <dt className="text-n-600">{t('dashboard.saidas.toReceive')}</dt>
          <dd className="font-mono tabular-nums text-n-900">{eurosDecimais(d.porReceber)}</dd>
        </dl>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onAbrirManifesto?.(escolhido)}
            className="inline-flex items-center min-h-[44px] px-4 rounded-full bg-ocean-900 text-white text-sm font-body font-semibold hover:bg-ocean-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sand-500 focus-visible:ring-offset-2"
          >
            {t('dashboard.saidas.openManifest')}
          </button>
        </div>
      </aside>
    );
  }

  return (
    <section className="bg-white border border-n-200 rounded-2xl p-4 lg:p-[22px] flex flex-col gap-3">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 className="font-display font-semibold text-base lg:text-lg text-ocean-900">{t('dashboard.agenda.title')}</h2>
        {!erro && ordenados.length > 0 && (
          <span className="text-[13px] font-body text-n-600 tabular-nums">
            {t('dashboard.agenda.summary', { tours: ordenados.length, people: pessoasTotal })}
          </span>
        )}
      </header>

      {erro ? (
        <p className="text-sm font-body text-n-600 py-4">{erro}</p>
      ) : ordenados.length === 0 ? vazio : (
        <>
          <p className="text-[13px] font-body text-n-600">{t('dashboard.saidas.hint')}</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <ul className="flex flex-col gap-0.5 min-w-0">
              {ordenados.map((e) => {
                const visual = estadoVisual(e, agoraMin, guiasConhecidos);
                const tom = TONS[visual.tom];
                const ativo = escolhido?.id === e.id;
                const d = detalhes.get(e.id);
                const sub = e.guias.length > 0
                  ? t('dashboard.saidas.withGuide', { people: pessoasTexto(d.total), guide: e.guias.join(', ') })
                  : (guiasConhecidos ? t('dashboard.saidas.withoutGuide', { people: pessoasTexto(d.total) }) : pessoasTexto(d.total));
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      aria-pressed={ativo}
                      data-estado={visual.estado}
                      onClick={() => setEscolhidoId(e.id)}
                      className={[
                        'w-full text-left grid grid-cols-[52px_12px_minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 rounded-xl transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sand-500',
                        ativo ? 'bg-ocean-50' : 'bg-transparent hover:bg-n-50',
                        visual.estado === 'concluido' ? 'opacity-70' : '',
                      ].join(' ')}
                    >
                      <span className="font-mono text-[15px] font-medium text-ocean-900 tabular-nums">{e.inicio || '—'}</span>
                      <span aria-hidden="true" className={`w-3 h-3 rounded-full ring-4 ${tom.ponto} ${tom.halo}`} />
                      <span className="flex flex-col gap-0.5 min-w-0">
                        <span className="font-body text-[15px] font-semibold text-n-900 truncate">{e.titulo}</span>
                        <span className="font-body text-[13px] text-n-600 truncate">{sub}</span>
                      </span>
                      <span className={`text-xs font-body font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${tom.pilula}`}>
                        {t(`dashboard.saidas.${visual.chave}`)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {painel}
          </div>
        </>
      )}
    </section>
  );
}
