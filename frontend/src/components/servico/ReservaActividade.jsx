/* Coluna de reserva da actividade: opcao (por pessoa ou privado, so com os dois precos),
   quem vem, data e hora, e o preco calculado pelo servidor (/quote, o mesmo calculo que
   criarReserva). A pagina nunca calcula o total: mostra as linhas que o servidor devolve.
   "Reservar" entrega a seleccao a onReservar(seleccao):
   { date, time, adults, children, mode, language, voucher, quote: { lines, total, before } }. */
import { useEffect, useRef, useState } from 'react';
import { Minus, Plus, Calendar, AlertCircle } from 'lucide-react';
import CalendarioReserva, { mesDeCaboVerde, somarMes } from './CalendarioReserva';
import HorariosReserva, { horarioDisponivel } from './HorariosReserva';
import FalhaComRepetir from './FalhaComRepetir';

const MAX_ADULTOS = 20;
const MAX_CRIANCAS = 10;
const ESPERA_COTACAO = 300;
const ESPERA_MES = 300;

const focoVisivel = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1';

/* Uma resposta nao-ok (429 do publicLimiter, 500) e uma falha, nunca "sem dados" */
function lerJson(r) {
  if (!r || !r.ok) throw new Error(`HTTP ${r ? r.status : 0}`);
  return r.json();
}

function Passo({ numero, titulo, children }) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 font-display font-bold text-sm text-n-900">
        <span aria-hidden="true" className="w-6 h-6 rounded-full bg-brand-700 text-white text-xs flex items-center justify-center shrink-0">{numero}</span>
        {titulo}
      </h3>
      {children}
    </section>
  );
}

function Contador({ rotulo, valor, min, max, onMudar, menos, mais }) {
  const botao = `w-8 h-8 rounded-full border border-n-200 text-n-700 flex items-center justify-center hover:border-brand-500 hover:text-brand-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors motion-reduce:transition-none ${focoVisivel}`;
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="font-body text-sm text-n-700">{rotulo}</span>
      <div className="flex items-center gap-3">
        <button type="button" aria-label={menos} className={botao} disabled={valor <= min} onClick={() => onMudar(valor - 1)}>
          <Minus size={14} strokeWidth={2} aria-hidden="true"/>
        </button>
        <span className="w-5 text-center font-display font-bold text-sm text-n-900" aria-live="polite">{valor}</span>
        <button type="button" aria-label={mais} className={botao} disabled={valor >= max} onClick={() => onMudar(valor + 1)}>
          <Plus size={14} strokeWidth={2} aria-hidden="true"/>
        </button>
      </div>
    </div>
  );
}

/* As descricoes das linhas vem do servidor em portugues; em ingles o rotulo sai do tipo */
function rotuloDaLinha(linha, modo, voucher, en) {
  if (!en) return linha.description;
  if (linha.type === 'children') return 'Children';
  if (linha.type === 'discount') return `Discount ${voucher}`;
  return modo === 'private' ? 'Private tour' : 'Adults';
}

/* Quantidade de uma linha: "× N", ou "· N pessoas" no tour privado; o desconto nao tem */
function quantidadeDaLinha(linha, modo, en) {
  if (linha.type === 'discount' || !linha.quantity) return '';
  if (modo === 'private' && linha.type === 'tour') return ` · ${linha.quantity} ${en ? 'people' : 'pessoas'}`;
  return ` × ${linha.quantity}`;
}

/* Texto de uma linha do /quote (rotulo e quantidade); o modal de reserva usa-o na revisao */
export function textoDaLinha(linha, modo, voucher, en) {
  return `${rotuloDaLinha(linha, modo, voucher, en)}${quantidadeDaLinha(linha, modo, en)}`;
}

export default function ReservaActividade({
  api, slug, unit, meta = {}, lang, formatarPreco, desde, temPrivado, onReservar, children: extra,
}) {
  const en = lang === 'en';
  const temPorPessoa = !!unit.base_price;
  const mostrarOpcao = temPorPessoa && !!temPrivado;
  /* Sem preco por pessoa (0/vazio: o TourForm grava um preco em branco como 0) nem privado,
     reserva-se como sempre: por pessoa, com o preco a combinar com o operador */
  const semPreco = !temPorPessoa && !temPrivado;
  const linguas = Array.isArray(meta.languages) ? meta.languages.filter(Boolean) : [];
  const temHorariosNaUnidade = Array.isArray(meta.time_slots) && meta.time_slots.length > 0;
  const base = `${api}/public/${slug}/units/${unit.id}`;

  const [modo, setModo] = useState(temPorPessoa || semPreco ? 'per_person' : 'private');
  const [adultos, setAdultos] = useState(2);
  const [criancas, setCriancas] = useState(0);
  const [idioma, setIdioma] = useState('');
  const pax = adultos + criancas;

  /* ── Calendario: mes corrente em Cabo Verde; se vier vazio, avanca um mes (uma vez so).
     Mudar pessoas ou modo espera 300 ms (como a cotacao); mudar de mes ou repetir pede logo.
     Uma falha mostra-se como falha (com "Tentar de novo") e nao gasta o avanco automatico. ── */
  const [mes, setMes] = useState(() => mesDeCaboVerde(new Date()));
  const mesInicial = useRef(mes).current;
  const jaAvancou = useRef(false);
  const [dias, setDias] = useState(null);
  const [falhaMes, setFalhaMes] = useState(false);
  const [tentativaMes, setTentativaMes] = useState(0);
  const pedidoMes = useRef(null);
  const [data, setData] = useState('');

  useEffect(() => {
    let activo = true;
    const anterior = pedidoMes.current;
    pedidoMes.current = { mes, tentativa: tentativaMes };
    const esperar = !!anterior && anterior.mes === mes && anterior.tentativa === tentativaMes;
    setDias(null);
    setFalhaMes(false);
    const espera = setTimeout(() => {
      fetch(`${base}/availability-month?month=${mes}&pax=${pax}&mode=${modo}`)
        .then(lerJson)
        .then((j) => {
          if (!activo) return;
          const livres = j?.data?.days && typeof j.data.days === 'object' ? j.data.days : {};
          if (!Object.keys(livres).length && mes === mesInicial && !jaAvancou.current) {
            jaAvancou.current = true;
            setMes(somarMes(mes, 1));
            return;
          }
          setDias(livres);
        })
        .catch(() => { if (activo) setFalhaMes(true); });
    }, esperar ? ESPERA_MES : 0);
    return () => { activo = false; clearTimeout(espera); };
  }, [base, mes, pax, modo, mesInicial, tentativaMes]);

  /* Dia escolhido que deixou de ter lugar (mais pessoas, outro modo) sai da seleccao */
  useEffect(() => {
    if (data && dias && data.startsWith(mes) && !dias[data]) setData('');
  }, [dias, data, mes]);

  /* ── Horarios do dia ── */
  const [horarios, setHorarios] = useState([]);
  const [aCarregarHorarios, setACarregarHorarios] = useState(false);
  const [falhaHorarios, setFalhaHorarios] = useState(false);
  const [tentativaHorarios, setTentativaHorarios] = useState(0);
  const [hora, setHora] = useState('');

  useEffect(() => {
    setHorarios([]);
    setHora('');
    setFalhaHorarios(false);
    if (!data || !temHorariosNaUnidade) { setACarregarHorarios(false); return undefined; }
    let activo = true;
    setACarregarHorarios(true);
    fetch(`${base}/slot-availability?date=${data}`)
      .then(lerJson)
      .then((j) => {
        if (!activo) return;
        if (!Array.isArray(j?.data)) throw new Error('slot-availability sem lista');
        setHorarios(j.data);
      })
      .catch(() => { if (activo) setFalhaHorarios(true); })
      .finally(() => { if (activo) setACarregarHorarios(false); });
    return () => { activo = false; };
  }, [base, data, temHorariosNaUnidade, tentativaHorarios]);

  /* Hora que deixou de servir sai; com um so horario livre, fica escolhido */
  useEffect(() => {
    const livres = horarios.filter((h) => horarioDisponivel(h, pax, modo));
    setHora((h) => (h && livres.some((x) => x.time === h) ? h : (livres.length === 1 ? livres[0].time : '')));
  }, [horarios, pax, modo]);

  /* ── Cotacao do servidor (com espera de 300 ms entre mudancas) ── */
  const [textoVoucher, setTextoVoucher] = useState('');
  const [voucher, setVoucher] = useState('');
  const [cotacao, setCotacao] = useState(null);
  const [aCotar, setACotar] = useState(true);
  const [falhaCotacao, setFalhaCotacao] = useState(false);
  const [tentativaCotacao, setTentativaCotacao] = useState(0);

  useEffect(() => {
    let activo = true;
    setACotar(true);
    setFalhaCotacao(false);
    const espera = setTimeout(() => {
      const q = new URLSearchParams({ adults: String(adultos), children: String(criancas), mode: modo });
      if (voucher) q.set('voucher', voucher);
      fetch(`${base}/quote?${q.toString()}`)
        .then(lerJson)
        .then((j) => {
          if (!activo) return;
          if (!j?.data || typeof j.data !== 'object') throw new Error('quote sem dados');
          setCotacao(j.data);
        })
        .catch(() => { if (activo) { setCotacao(null); setFalhaCotacao(true); } })
        .finally(() => { if (activo) setACotar(false); });
    }, ESPERA_COTACAO);
    return () => { activo = false; clearTimeout(espera); };
  }, [base, adultos, criancas, modo, voucher, tentativaCotacao]);

  const erro = cotacao?.error || null;
  const voucherInvalido = erro?.code === 'INVALID_VOUCHER';
  const erroBloqueia = !!erro && !voucherInvalido;
  /* Uma unidade com time_slots precisa sempre de hora (o servidor devolve sempre os horarios
     configurados; lista vazia ou falha nunca dispensam a hora). Sem cotacao valida, nao reserva. */
  const podeReservar = !!data && !aCarregarHorarios && !falhaHorarios && (!temHorariosNaUnidade || !!hora)
    && !aCotar && !falhaCotacao && !!cotacao && !erroBloqueia;

  function aplicarVoucher(e) {
    e.preventDefault();
    setVoucher(textoVoucher.trim().toUpperCase());
  }

  function reservar() {
    if (!podeReservar) return;
    onReservar?.({
      date: data,
      time: hora || null,
      adults: adultos,
      children: criancas,
      mode: modo,
      language: idioma || (linguas.length === 1 ? linguas[0] : null),
      voucher: voucher && !voucherInvalido ? voucher : null,
      quote: { lines: cotacao.lines || [], total: cotacao.total, before: cotacao.before ?? null },
    });
  }

  const valor = (v) => {
    const n = Number(v) || 0;
    if (n === 0) return en ? 'Free' : 'Grátis';
    return n < 0 ? `-${formatarPreco(-n)}` : formatarPreco(n);
  };

  let numero = 0;
  const proximo = () => { numero += 1; return numero; };
  const opcaoBotao = (activo) => `flex-1 text-xs font-body font-semibold py-2 rounded-lg transition-colors motion-reduce:transition-none ${focoVisivel} ${activo ? 'bg-white text-brand-700 shadow-sm' : 'text-n-500 hover:text-n-700'}`;

  return (
    <div className="bg-white border border-n-200 rounded-2xl shadow-sm p-5 space-y-6">
      {desde?.valor ? (
        <p className="font-body text-sm text-n-500">
          {en ? 'From' : 'Desde'}{' '}
          <span className="font-display font-extrabold text-2xl text-brand-700">{formatarPreco(desde.valor)}</span>{' '}
          {desde.porGrupo ? (en ? 'per group' : 'por grupo') : (en ? 'per person' : 'por pessoa')}
        </p>
      ) : (
        <p className="font-display font-bold text-lg text-n-500">{en ? 'On request' : 'Consultar'}</p>
      )}

      {mostrarOpcao && (
        <Passo numero={proximo()} titulo={en ? 'Choose an option' : 'Escolha a opção'}>
          <div className="flex gap-1 p-1 bg-n-100 rounded-xl">
            <button type="button" aria-pressed={modo === 'per_person'} onClick={() => setModo('per_person')} className={opcaoBotao(modo === 'per_person')}>
              {en ? 'Per person' : 'Por pessoa'}
            </button>
            <button type="button" aria-pressed={modo === 'private'} onClick={() => setModo('private')} className={opcaoBotao(modo === 'private')}>
              {en ? 'Private / group' : 'Privado / grupo'}
            </button>
          </div>
        </Passo>
      )}

      <Passo numero={proximo()} titulo={en ? "Who's coming?" : 'Quem vem?'}>
        <Contador rotulo={en ? 'Adults' : 'Adultos'} valor={adultos} min={1} max={MAX_ADULTOS} onMudar={setAdultos}
          menos={en ? 'Fewer adults' : 'Menos adultos'} mais={en ? 'More adults' : 'Mais adultos'}/>
        <Contador rotulo={en ? 'Children' : 'Crianças'} valor={criancas} min={0} max={MAX_CRIANCAS} onMudar={setCriancas}
          menos={en ? 'Fewer children' : 'Menos crianças'} mais={en ? 'More children' : 'Mais crianças'}/>
        {linguas.length > 1 && (
          <label className="block">
            <span className="block text-xs font-body font-semibold text-n-600 mb-1">{en ? 'Guide language' : 'Idioma do guia'}</span>
            <select value={idioma} onChange={(e) => setIdioma(e.target.value)}
              className={`w-full border border-n-200 rounded-xl px-3 py-2 text-sm font-body bg-white ${focoVisivel}`}>
              <option value="">{en ? 'No preference' : 'Sem preferência'}</option>
              {linguas.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
        )}
      </Passo>

      <Passo numero={proximo()} titulo={en ? 'Choose date and time' : 'Escolha a data e a hora'}>
        <CalendarioReserva mes={mes} dias={dias} seleccionado={data} onEscolher={setData}
          onMudarMes={(n) => setMes((m) => somarMes(m, n))} podeRecuar={mes > mesInicial} lang={lang}
          falhou={falhaMes} onTentarDeNovo={() => setTentativaMes((t) => t + 1)}/>
        {data && temHorariosNaUnidade && (
          <HorariosReserva horarios={horarios} carregando={aCarregarHorarios} seleccionado={hora}
            onEscolher={setHora} pax={pax} modo={modo} lang={lang}
            falhou={falhaHorarios} onTentarDeNovo={() => setTentativaHorarios((t) => t + 1)}/>
        )}
      </Passo>

      <div data-testid="preco-reserva" aria-live="polite" className="bg-n-50 border border-n-100 rounded-xl p-4 space-y-2">
        {aCotar && !cotacao ? (
          <p className="text-xs font-body text-n-500">{en ? 'Calculating price…' : 'A calcular o preço…'}</p>
        ) : falhaCotacao ? (
          <FalhaComRepetir lang={lang} texto={en ? 'Could not calculate the price' : 'Não foi possível calcular o preço'}
            onTentar={() => setTentativaCotacao((t) => t + 1)}/>
        ) : erroBloqueia ? (
          <p role="alert" className="flex items-start gap-2 text-sm font-body text-red-700">
            <AlertCircle size={16} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0"/>
            {en ? erro.message_en : erro.message_pt}
          </p>
        ) : cotacao && semPreco ? (
          <p className="font-body font-semibold text-sm text-n-700">{en ? 'Price agreed with the operator' : 'Preço a combinar com o operador'}</p>
        ) : cotacao ? (
          <>
            <ul className="space-y-1">
              {(cotacao.lines || []).map((l, i) => (
                <li key={`${l.type}-${i}`} className={`flex justify-between gap-3 text-sm font-body ${l.type === 'discount' ? 'text-emerald-700' : 'text-n-600'}`}>
                  <span className="min-w-0">{textoDaLinha(l, modo, voucher, en)}</span>
                  <span className="shrink-0">{valor(l.total)}</span>
                </li>
              ))}
            </ul>
            <p className="flex justify-between items-baseline gap-3 border-t border-n-200 pt-2">
              <span className="font-body font-semibold text-sm text-n-700">Total</span>
              <span className="font-display font-extrabold text-xl text-brand-700">{valor(cotacao.total)}</span>
            </p>
          </>
        ) : null}
        {voucherInvalido && (
          <p role="alert" className="text-xs font-body text-red-700">{en ? erro.message_en : erro.message_pt}</p>
        )}
        {!semPreco && <form onSubmit={aplicarVoucher} className="flex gap-2 pt-1">
          <label className="sr-only" htmlFor={`voucher-${unit.id}`}>{en ? 'Discount code' : 'Código de desconto'}</label>
          <input id={`voucher-${unit.id}`} value={textoVoucher} onChange={(e) => setTextoVoucher(e.target.value)}
            placeholder={en ? 'Discount code' : 'Código de desconto'} maxLength={40}
            className={`min-w-0 flex-1 border border-n-200 rounded-lg px-3 py-2 text-sm font-body uppercase bg-white ${focoVisivel}`}/>
          <button type="submit" className={`shrink-0 border border-brand-700 text-brand-700 font-body font-semibold text-sm px-3 rounded-lg hover:bg-brand-50 transition-colors motion-reduce:transition-none ${focoVisivel}`}>
            {en ? 'Apply' : 'Aplicar'}
          </button>
        </form>}
      </div>

      <button type="button" onClick={reservar} disabled={!podeReservar}
        className="w-full bg-sand-500 text-n-900 font-body font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-sand-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors motion-reduce:transition-none text-base shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2">
        <Calendar size={18} strokeWidth={1.75} aria-hidden="true"/>
        {en ? 'Book' : 'Reservar'}
      </button>

      {extra}
    </div>
  );
}
