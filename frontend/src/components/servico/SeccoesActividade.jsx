/* Seccoes da pagina de actividade, pela ordem de seccoesActividade() (utils/paginaActividade.js):
   destaques, descricao (com "Ler tudo"), incluido / nao incluido, o que levar, politicas e perguntas
   frequentes sao desenhadas aqui; itinerario, ponto de encontro, avaliacoes e outros servicos vem
   prontos da pagina (`blocos`). Cada seccao tem o id usado pelo MenuSeccoes. Sem dados, nao ha seccao.
   Spec: docs/superpowers/specs/2026-11-21-pagina-servico-completa-design.md */
import { useState } from 'react';
import { Check, X, Plus, RotateCcw, BadgeCheck } from 'lucide-react';
import {
  textoEmBlocos, linhasDestaques, oQueLevar, incluidos, precisaLerTudo, porLingua,
} from '../../utils/paginaActividade';
import { textoPoliticaCancelamento } from '../../utils/politicaCancelamento';

const TITULOS = {
  destaques: ['Destaques', 'Highlights'],
  descricao: ['Descrição', 'Description'],
  incluido: ['O que está incluído', "What's included"],
  itinerario: ['Itinerário', 'Itinerary'],
  levar: ['O que levar', 'What to bring'],
  encontro: ['Ponto de encontro', 'Meeting point'],
  politicas: ['Políticas', 'Policies'],
  avaliacoes: ['Avaliações', 'Reviews'],
  perguntas: ['Perguntas frequentes', 'FAQ'],
  outros: ['Outros serviços', 'More services'],
};

export function tituloSeccao(id, lang) {
  const t = TITULOS[id];
  return t ? t[lang === 'en' ? 1 : 0] : id;
}

const FOCO = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2';

/* Texto livre em paragrafos e listas ("- ") */
function Blocos({ texto }) {
  return (
    <div className="space-y-4 font-body text-n-700 text-[15px] leading-relaxed">
      {textoEmBlocos(texto).map((b, i) => (b.tipo === 'lista' ? (
        <ul key={i} className="space-y-1.5 pl-5 list-disc marker:text-brand-500">
          {b.itens.map((it, j) => <li key={j}>{it}</li>)}
        </ul>
      ) : (
        <p key={i} className="whitespace-pre-line">{b.texto}</p>
      )))}
    </div>
  );
}

function Descricao({ texto, lang }) {
  const [aberta, setAberta] = useState(false);
  const longa = precisaLerTudo(texto);
  const fechada = longa && !aberta;
  return (
    <div>
      <div id="descricao-texto" className={`relative ${fechada ? 'max-h-64 overflow-hidden' : ''}`}>
        <Blocos texto={texto}/>
        {fechada && <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white to-transparent"/>}
      </div>
      {longa && (
        <button type="button" aria-expanded={aberta} aria-controls="descricao-texto" onClick={() => setAberta((a) => !a)}
          className={`mt-3 font-body font-semibold text-sm text-brand-700 underline underline-offset-4 hover:text-brand-800 rounded ${FOCO}`}>
          {aberta ? (lang === 'en' ? 'Read less' : 'Ler menos') : (lang === 'en' ? 'Read all' : 'Ler tudo')}
        </button>
      )}
    </div>
  );
}

function Destaques({ linhas }) {
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {linhas.map((l, i) => (
        <li key={i} className="flex items-start gap-3 p-4 rounded-2xl bg-brand-50 border border-brand-100">
          <Check size={18} strokeWidth={2.25} aria-hidden="true" className="text-brand-700 flex-shrink-0 mt-0.5"/>
          <span className="font-body font-medium text-n-800 text-sm leading-snug">{l}</span>
        </li>
      ))}
    </ul>
  );
}

function Incluido({ meta, lang }) {
  const { sim, nao } = incluidos(meta);
  const en = lang === 'en';
  const grupos = [
    { itens: sim, titulo: en ? 'Included' : 'Incluído', caixa: 'bg-green-50 border-green-100', cor: 'text-green-800', icone: <Check size={16} strokeWidth={2.25} aria-hidden="true" className="text-green-600 flex-shrink-0 mt-0.5"/> },
    { itens: nao, titulo: en ? 'Not included' : 'Não incluído', caixa: 'bg-n-50 border-n-200', cor: 'text-n-600', icone: <X size={16} strokeWidth={2.25} aria-hidden="true" className="text-n-400 flex-shrink-0 mt-0.5"/> },
  ].filter((g) => g.itens.length);
  return (
    <div className={`grid grid-cols-1 ${grupos.length > 1 ? 'sm:grid-cols-2' : ''} gap-4`}>
      {grupos.map((g) => (
        <div key={g.titulo} className={`rounded-2xl border p-5 ${g.caixa}`}>
          <h3 className={`text-xs font-display font-bold uppercase tracking-wider mb-3 ${g.cor}`}>{g.titulo}</h3>
          <ul className="space-y-2">
            {g.itens.map((it, i) => (
              <li key={i} className="flex items-start gap-2.5 font-body text-sm text-n-800">{g.icone}<span>{it}</span></li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Politicas({ op, lang }) {
  const en = lang === 'en';
  const politica = textoPoliticaCancelamento(op, lang);
  const confirmacao = op?.auto_confirm_bookings === true
    ? (en ? 'Bookings are confirmed automatically, without waiting for the operator.' : 'A reserva é confirmada automaticamente, sem esperar pela resposta do operador.')
    : (en ? 'The operator confirms each booking after receiving it.' : 'O operador confirma cada reserva depois de a receber.');
  const itens = [
    politica && { icone: RotateCcw, titulo: en ? 'Cancellation' : 'Cancelamento', texto: politica },
    { icone: BadgeCheck, titulo: en ? 'Confirmation' : 'Confirmação', texto: confirmacao },
  ].filter(Boolean);
  return (
    <ul className="space-y-4">
      {itens.map(({ icone: Icone, titulo, texto }) => (
        <li key={titulo} className="flex items-start gap-3">
          <span aria-hidden="true" className="w-9 h-9 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center flex-shrink-0">
            <Icone size={17} strokeWidth={1.75}/>
          </span>
          <div className="min-w-0">
            <p className="font-body font-semibold text-n-900 text-sm">{titulo}</p>
            <p className="font-body text-sm text-n-600 leading-relaxed whitespace-pre-wrap mt-0.5">{texto}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Pergunta({ pergunta, resposta, i }) {
  const [aberta, setAberta] = useState(false);
  const idR = `pergunta-${i}-resposta`;
  return (
    <div className="border border-n-200 rounded-2xl bg-white shadow-sm">
      <h3>
        <button type="button" aria-expanded={aberta} aria-controls={idR} onClick={() => setAberta((a) => !a)}
          className={`w-full flex items-center justify-between gap-4 text-left px-5 py-4 font-body font-semibold text-n-900 text-[15px] rounded-2xl ${FOCO}`}>
          <span>{pergunta}</span>
          <span aria-hidden="true" className={`w-7 h-7 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center flex-shrink-0 transition-transform duration-200 motion-reduce:transition-none ${aberta ? 'rotate-45' : ''}`}>
            <Plus size={16} strokeWidth={2}/>
          </span>
        </button>
      </h3>
      <div id={idR} hidden={!aberta} className="px-5 pb-4 font-body text-sm text-n-600 leading-relaxed whitespace-pre-line">{resposta}</div>
    </div>
  );
}

function Perguntas({ op, lang }) {
  const lista = (Array.isArray(op?.custom_faqs) ? op.custom_faqs : [])
    .map((f) => ({ pergunta: porLingua(f, 'question', lang), resposta: porLingua(f, 'answer', lang) }))
    .filter((f) => f.pergunta);
  return (
    <div className="space-y-3">
      {lista.map((f, i) => <Pergunta key={i} i={i} pergunta={f.pergunta} resposta={f.resposta}/>)}
    </div>
  );
}

function Seccao({ id, titulo, children }) {
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="scroll-mt-32 py-8 border-t border-n-200 first:border-t-0 first:pt-6">
      <h2 id={`${id}-titulo`} tabIndex={-1} className="font-display font-bold text-xl sm:text-2xl tracking-tight text-n-900 mb-5 focus:outline-none">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

export default function SeccoesActividade({ ids, meta, op, lang, blocos = {} }) {
  function corpo(id) {
    switch (id) {
      case 'destaques': return <Destaques linhas={linhasDestaques(meta, lang)}/>;
      case 'descricao': return <Descricao texto={porLingua(meta, 'desc', lang)} lang={lang}/>;
      case 'incluido': return <Incluido meta={meta} lang={lang}/>;
      case 'levar': return <Blocos texto={oQueLevar(meta, lang)}/>;
      case 'politicas': return <Politicas op={op} lang={lang}/>;
      case 'perguntas': return <Perguntas op={op} lang={lang}/>;
      default: return blocos[id] || null;
    }
  }
  return (
    <div data-testid="seccoes-actividade">
      {(Array.isArray(ids) ? ids : []).map((id) => {
        const c = corpo(id);
        return c ? <Seccao key={id} id={id} titulo={tituloSeccao(id, lang)}>{c}</Seccao> : null;
      })}
    </div>
  );
}
