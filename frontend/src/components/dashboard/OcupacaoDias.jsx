import { useT } from '../../i18n';
import { useLingua, formatarData } from '../../utils/formatoLingua';

/* Ocupacao por servico e dia (mapa de calor) e, em modo compacto, as barras de "Proximos 7 dias" do telemovel.
   linhas: resultado de ocupacaoDias (mareLogic.js); dias: datas YYYY-MM-DD. */

/* Quatro degraus do oceano; pct acima de 100 (overbooking) mostra o numero real mas usa o ultimo degrau.
   O texto de cada degrau e escolhido para dar contraste. */
const DEGRAUS = [
  { fundo: 'bg-ocean-50', texto: 'text-n-600' },
  { fundo: 'bg-ocean-200', texto: 'text-ocean-900' },
  { fundo: 'bg-ocean-400', texto: 'text-ocean-900' },
  { fundo: 'bg-ocean-700', texto: 'text-white' },
];
const NEUTRO = { fundo: 'bg-n-100', texto: 'text-n-600' };

function degrauDe(pct) {
  if (pct === null || pct === undefined) return NEUTRO;
  if (pct < 25) return DEGRAUS[0];
  if (pct < 50) return DEGRAUS[1];
  if (pct < 80) return DEGRAUS[2];
  return DEGRAUS[3];
}

const lista = (v) => (Array.isArray(v) ? v : []);
const semPonto = (s) => s.replace(/\.$/, '');

/* sabado e domingo: a data local YYYY-MM-DD sem deriva de fuso */
function eFimDeSemana(data) {
  const [a, m, d] = data.split('-').map(Number);
  const dia = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
  return dia === 0 || dia === 6;
}

/* Altura (%) e degrau de uma barra: com capacidade conhecida e a taxa de ocupacao; senao, o dia mais cheio da semana */
function barraDe(pessoas, capacidade, maximo) {
  const base = capacidade ? capacidade : maximo;
  const razao = base ? pessoas / base : 0;
  const pct = Math.round(razao * 100);
  return {
    altura: pessoas ? Math.max(6, Math.min(100, pct)) : 0,
    degrau: capacidade ? degrauDe(pct) : DEGRAUS[2],
  };
}

function Barras({ linhas, dias }) {
  const t = useT();
  const lang = useLingua();
  const totais = dias.map((data, i) => {
    let pessoas = 0;
    let capacidade = 0;
    linhas.forEach((l) => {
      const c = l.celulas?.[i];
      if (!c) return;
      pessoas += c.pessoas || 0;
      if (c.capacidade) capacidade += c.capacidade;
    });
    return { data, pessoas, capacidade };
  });
  const maximo = totais.reduce((m, x) => Math.max(m, x.pessoas), 0);

  return (
    <section aria-labelledby="ocupacao-semana" className="bg-white border border-n-200 rounded-md p-4 space-y-3">
      <h2 id="ocupacao-semana" className="font-display font-semibold text-sm text-n-900">{t('dashboard.activity.next7Days')}</h2>
      <div className="grid grid-cols-7 gap-1.5">
        {totais.map(({ data, pessoas, capacidade }) => {
          const { altura, degrau } = barraDe(pessoas, capacidade, maximo);
          const dia = semPonto(formatarData(data, { weekday: 'short' }, lang));
          return (
            <div key={data} className="flex flex-col items-center gap-1.5">
              <div
                role="img"
                aria-label={t('dashboard.mare.occupancy.barAria', { day: dia, people: pessoas })}
                className="w-full h-16 rounded-md bg-ocean-50 flex items-end overflow-hidden"
              >
                <div className={`w-full ${degrau.fundo}`} style={{ height: `${altura}%` }} />
              </div>
              <span className={`font-mono text-[11px] capitalize ${eFimDeSemana(data) ? 'text-n-900 font-medium' : 'text-n-600'}`}>{dia}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function OcupacaoDias({ linhas = [], dias = [], compacto = false }) {
  const t = useT();
  const lang = useLingua();
  const rows = lista(linhas);
  const days = lista(dias);

  if (compacto) return <Barras linhas={rows} dias={days} />;

  const haNeutra = rows.some((l) => lista(l.celulas).some((c) => c.pct === null || c.pct === undefined));

  return (
    <section aria-labelledby="ocupacao-titulo" className="bg-white border border-n-200 rounded-md p-4 md:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="ocupacao-titulo" className="font-display font-semibold text-base text-n-900">{t('dashboard.mare.occupancy.title')}</h2>
          <p className="text-[13px] font-body text-n-600">{t('dashboard.mare.occupancy.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-body text-n-600" data-testid="ocupacao-legenda">
          <span>{t('dashboard.mare.occupancy.legendEmpty')}</span>
          {DEGRAUS.map((d) => <span key={d.fundo} aria-hidden="true" className={`w-[18px] h-3 rounded-[3px] ${d.fundo}`} />)}
          <span>{t('dashboard.mare.occupancy.legendFull')}</span>
          {haNeutra && (
            <>
              <span aria-hidden="true" className={`ml-2 w-[18px] h-3 rounded-[3px] border border-n-200 ${NEUTRO.fundo}`} />
              <span>{t('dashboard.mare.occupancy.legendNoCapacity')}</span>
            </>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-[13px] font-body text-n-500">{t('dashboard.mare.occupancy.empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-separate border-spacing-1">
            <caption className="sr-only">{t('dashboard.mare.occupancy.caption')}</caption>
            <thead>
              <tr>
                <th scope="col" className="text-left text-xs font-body font-semibold text-n-600 pr-2">{t('dashboard.mare.occupancy.service')}</th>
                {days.map((data) => (
                  <th
                    key={data}
                    scope="col"
                    aria-label={`${formatarData(data, { weekday: 'long' }, lang)}, ${Number(data.slice(8, 10))}`}
                    className={`font-mono text-[11px] font-medium text-center ${eFimDeSemana(data) ? 'text-n-900' : 'text-n-500'}`}
                  >
                    <span className="capitalize">{semPonto(formatarData(data, { weekday: 'short' }, lang))}</span>
                    <br />
                    {Number(data.slice(8, 10))}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((linha) => (
                <tr key={linha.tourId}>
                  <th scope="row" className="text-left text-[13px] font-body font-semibold text-n-900 whitespace-nowrap pr-2">{linha.nome}</th>
                  {lista(linha.celulas).map((c) => {
                    const degrau = degrauDe(c.pct);
                    const semCapacidade = c.pct === null || c.pct === undefined;
                    return (
                      <td key={c.data} className="p-0">
                        <div
                          title={semCapacidade
                            ? t('dashboard.mare.occupancy.cellNoCapacity', { people: c.pessoas })
                            : t('dashboard.mare.occupancy.cell', { people: c.pessoas, capacity: c.capacidade })}
                          className={`h-[34px] rounded-md font-mono text-[11px] flex items-center justify-center ${degrau.fundo} ${degrau.texto}`}
                        >
                          {semCapacidade ? c.pessoas : `${c.pct}%`}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
