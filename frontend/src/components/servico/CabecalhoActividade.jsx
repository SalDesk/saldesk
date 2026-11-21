/* Cabecalho da pagina de actividade: caminho (Discover / ilha / titulo), titulo, estrelas so da
   classificacao propria da experiencia (unit_rating), resumo, chips (duração, recolha, cancelamento
   gratis, confirmacao imediata) e Partilhar. Cada chip so aparece com o dado real.
   Spec: docs/superpowers/specs/2026-11-21-pagina-servico-completa-design.md */
import { Star, Clock, MapPin, RotateCcw, Zap, Share2, Check } from 'lucide-react';
import { textoEmBlocos, porLingua } from '../../utils/paginaActividade';
import { textoBeneficioCancelamento } from '../../utils/politicaCancelamento';

const FOCO = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2';

/* Resumo: o texto curto do operador ou, sem ele, o primeiro paragrafo da descricao */
function resumoDe(meta, lang) {
  const curto = porLingua(meta, 'short', lang);
  if (curto) return curto;
  const primeiro = textoEmBlocos(porLingua(meta, 'desc', lang)).find((b) => b.tipo === 'p');
  return primeiro ? primeiro.texto : '';
}

function Estrelas({ media, lang }) {
  const valor = Number(media).toFixed(1);
  return (
    <span role="img" aria-label={lang === 'en' ? `${valor} out of 5` : `${valor.replace('.', ',')} de 5`} className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} size={15} strokeWidth={1.75} aria-hidden="true"
          className={i < Math.round(media) ? 'text-sand-500 fill-sand-500' : 'text-n-200'}/>
      ))}
    </span>
  );
}

export default function CabecalhoActividade({ titulo, meta, op, classificacao, lang, mostrarCaminho = true, onPartilhar, copiado = false }) {
  const en = lang === 'en';
  const m = meta || {};
  const resumo = resumoDe(m, lang);
  const ilha = op?.islands?.name || '';
  const media = Number(classificacao?.avg);
  const total = Number(classificacao?.count);
  const temClassificacao = Number.isFinite(media) && media > 0 && Number.isFinite(total) && total > 0;
  const horas = Number(m.duration);

  const chips = [
    Number.isFinite(horas) && horas > 0 && { chave: 'horas', icone: Clock, texto: `${horas} h` },
    m.pickup_included === true && { chave: 'recolha', icone: MapPin, texto: en ? 'Hotel pickup included' : 'Recolha no hotel incluída' },
    textoBeneficioCancelamento(op?.free_cancellation_hours, lang) && { chave: 'cancelamento', icone: RotateCcw, texto: textoBeneficioCancelamento(op.free_cancellation_hours, lang) },
    op?.auto_confirm_bookings === true && { chave: 'confirmacao', icone: Zap, texto: en ? 'Instant confirmation' : 'Confirmação imediata' },
  ].filter(Boolean);

  return (
    <header className="pt-6">
      {mostrarCaminho && (
        <nav aria-label={en ? 'Breadcrumb' : 'Caminho'} className="mb-3">
          <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs font-body text-n-500 min-w-0">
            <li><a href="https://saldesk.cv/discover/" className={`text-brand-700 font-semibold hover:underline rounded ${FOCO}`}>Discover</a></li>
            {ilha && (<><li aria-hidden="true">/</li><li>{ilha}</li></>)}
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-n-700 truncate max-w-[60vw] sm:max-w-md">{titulo}</li>
          </ol>
        </nav>
      )}

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-n-900 tracking-tight leading-tight break-words min-w-0">
          {titulo}
        </h1>
        <button type="button" onClick={onPartilhar}
          className={`self-start flex-shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-n-200 bg-white text-sm font-body font-semibold text-brand-700 hover:border-brand-300 transition-colors motion-reduce:transition-none ${FOCO}`}>
          {copiado ? <Check size={15} strokeWidth={2} aria-hidden="true" className="text-green-600"/> : <Share2 size={15} strokeWidth={1.75} aria-hidden="true"/>}
          {en ? 'Share' : 'Partilhar'}
        </button>
      </div>
      <p aria-live="polite" className="sr-only">{copiado ? (en ? 'Link copied' : 'Link copiado') : ''}</p>

      {temClassificacao && (
        <div className="flex items-center gap-2 mt-3">
          <Estrelas media={media} lang={lang}/>
          <span className="font-display font-bold text-n-900 text-sm">{media.toFixed(1)}</span>
          <span className="font-body text-sm text-n-500">({total} {en ? 'reviews' : 'avaliações'})</span>
        </div>
      )}

      {resumo && <p className="font-body text-n-600 text-base sm:text-lg leading-relaxed mt-3 max-w-3xl whitespace-pre-line">{resumo}</p>}

      {chips.length > 0 && (
        <ul className="flex flex-wrap gap-2 mt-4">
          {chips.map(({ chave, icone: Icone, texto }) => (
            <li key={chave} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-n-200 shadow-sm text-xs font-body font-semibold text-n-800">
              <Icone size={14} strokeWidth={1.75} aria-hidden="true" className="text-brand-600"/>
              {texto}
            </li>
          ))}
        </ul>
      )}
    </header>
  );
}
