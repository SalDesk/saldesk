import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Star, CheckCircle, Clock, Link2Off, WifiOff } from 'lucide-react';
import { getT } from '../i18n';
import { useBrandColor } from '../utils/brandPalette';

/* Pagina publica do link de avaliacao (app.saldesk.cv/review/:token), sem conta.
   Dados: GET /reviews/token/:token (so o necessario); envio: POST /reviews/submit.
   Spec: docs/superpowers/specs/2026-11-18-pedido-automatico-avaliacao-design.md */
const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';
const MAX_COMENTARIO = 1000;

function dataCurta(iso, lang) {
  if (!iso) return '';
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'pt-PT', { day: 'numeric', month: 'long', year: 'numeric' });
}

function Cartao({ children }) {
  return (
    <div className="min-h-screen bg-n-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg border border-n-100 max-w-md w-full p-6 sm:p-8">{children}</div>
    </div>
  );
}

function Estado({ icon: Icon, tone, title, text, children }) {
  return (
    <div className="text-center">
      <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${tone}`}>
        <Icon size={28} strokeWidth={2} aria-hidden="true" />
      </div>
      <h1 className="font-display font-bold text-xl text-n-900 mb-2">{title}</h1>
      {text && <p className="text-sm font-body text-n-500 leading-relaxed">{text}</p>}
      {children}
    </div>
  );
}

export default function ReviewPage() {
  const { token } = useParams();
  const [fase, setFase] = useState('carregar'); // carregar | ok | obrigado | expirado | invalido | erro
  const [info, setInfo] = useState(null);
  const [lang, setLang] = useState('pt');
  const [nota, setNota] = useState(0);
  const [comentario, setComentario] = useState('');
  const [aEnviar, setAEnviar] = useState(false);
  const [erroEnvio, setErroEnvio] = useState(false);

  useBrandColor(info?.operador?.brand_color);
  const t = getT(lang);

  const carregar = useCallback(async () => {
    setFase('carregar');
    try {
      const r = await fetch(`${API}/reviews/token/${encodeURIComponent(token)}`);
      if (!r.ok) throw new Error(String(r.status));
      const { data } = await r.json();
      setInfo(data);
      if (data?.lingua === 'en' || data?.lingua === 'pt') setLang(data.lingua);
      setFase(['ok', 'expirado', 'invalido'].includes(data?.estado) ? data.estado : 'invalido');
    } catch {
      setFase('erro');
    }
  }, [token]);

  useEffect(() => { carregar(); }, [carregar]);

  async function enviar(e) {
    e.preventDefault();
    if (!nota || aEnviar) return;
    setAEnviar(true);
    setErroEnvio(false);
    try {
      const r = await fetch(`${API}/reviews/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, rating: nota, comment: comentario.trim() }),
      });
      if (r.status === 410) { setFase('expirado'); return; }
      if (r.status === 404) { setFase('invalido'); return; }
      if (!r.ok) throw new Error(String(r.status));
      setFase('obrigado');
    } catch {
      setErroEnvio(true);
    } finally {
      setAEnviar(false);
    }
  }

  const operador = info?.operador?.name || '';
  const trocaLingua = (
    <div className="flex justify-end mb-4">
      <div className="inline-flex bg-n-100 rounded-full p-0.5" role="group" aria-label="Idioma / Language">
        {['pt', 'en'].map((l) => (
          <button key={l} type="button" onClick={() => setLang(l)} aria-pressed={lang === l}
            className={`px-3 py-1 rounded-full text-xs font-display font-semibold uppercase ${lang === l ? 'bg-white text-n-900 shadow-sm' : 'text-n-500'}`}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );

  if (fase === 'carregar') {
    return <Cartao><p className="text-center text-sm font-body text-n-500" role="status">{t('review.loading')}</p></Cartao>;
  }

  if (fase === 'erro') {
    return (
      <Cartao>
        <Estado icon={WifiOff} tone="bg-n-100 text-n-500" title={t('review.errorTitle')} text={t('review.errorText')}>
          <button type="button" onClick={carregar}
            className="mt-5 inline-flex items-center justify-center h-11 px-6 rounded-full bg-brand-700 text-white font-display font-semibold text-sm hover:bg-brand-800">
            {t('review.retry')}
          </button>
        </Estado>
      </Cartao>
    );
  }

  if (fase === 'invalido') {
    return <Cartao>{trocaLingua}<Estado icon={Link2Off} tone="bg-n-100 text-n-500" title={t('review.invalid')} /></Cartao>;
  }

  if (fase === 'expirado') {
    return (
      <Cartao>
        {trocaLingua}
        <Estado icon={Clock} tone="bg-amber-50 text-amber-600" title={t('review.expiredTitle')} text={t('review.expiredText', { operator: operador })} />
      </Cartao>
    );
  }

  if (fase === 'obrigado') {
    return (
      <Cartao>
        <Estado icon={CheckCircle} tone="bg-green-50 text-green-600" title={t('review.thanksTitle')} text={t('review.thanksText', { operator: operador })}>
          {info?.operador?.slug && (
            <a href={`/book/${encodeURIComponent(info.operador.slug)}`}
              className="mt-5 inline-flex items-center justify-center h-11 px-6 rounded-full border border-n-200 text-n-800 font-display font-semibold text-sm hover:border-brand-300">
              {t('review.seeOperator', { operator: operador })}
            </a>
          )}
        </Estado>
      </Cartao>
    );
  }

  const intro = info?.unidade
    ? (info?.cliente
      ? t('review.intro', { name: info.cliente, unit: info.unidade, operator: operador })
      : t('review.introNoName', { unit: info.unidade, operator: operador }))
    : t('review.introNoUnit', { operator: operador });

  return (
    <Cartao>
      {trocaLingua}
      <p className="font-display text-xs font-bold uppercase tracking-wider text-brand-700">{operador}</p>
      <h1 className="font-display font-bold text-2xl text-n-900 mt-1">{t('review.title')}</h1>
      <p className="text-sm font-body text-n-600 leading-relaxed mt-2">{intro}</p>
      {info?.data && <p className="text-xs font-body text-n-400 mt-1">{dataCurta(info.data, lang)}</p>}

      <form onSubmit={enviar} className="mt-6 space-y-5">
        <fieldset>
          <legend className="text-sm font-display font-semibold text-n-800 mb-2">{t('review.starsLabel')}</legend>
          <div className="flex gap-1.5" role="radiogroup" aria-label={t('review.starsLabel')}>
            {[1, 2, 3, 4, 5].map((n) => {
              const activa = n <= nota;
              return (
                <button key={n} type="button" role="radio" aria-checked={nota === n}
                  aria-label={n === 1 ? t('review.star1') : t('review.starN', { n })}
                  onClick={() => setNota(n)}
                  className="p-1 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500">
                  <Star size={36} strokeWidth={1.75} aria-hidden="true"
                    className={activa ? 'fill-amber-400 text-amber-400' : 'text-n-300'} />
                </button>
              );
            })}
          </div>
        </fieldset>

        <div>
          <label htmlFor="review-comment" className="block text-sm font-display font-semibold text-n-800 mb-2">{t('review.commentLabel')}</label>
          <textarea id="review-comment" rows={4} maxLength={MAX_COMENTARIO} value={comentario}
            onChange={(e) => setComentario(e.target.value.slice(0, MAX_COMENTARIO))}
            placeholder={t('review.commentPlaceholder')}
            className="w-full rounded-xl border border-n-200 px-3 py-2.5 text-sm font-body text-n-900 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
          <p className="text-right text-xs font-body text-n-400 mt-1">{comentario.length}/{MAX_COMENTARIO}</p>
        </div>

        {erroEnvio && <p className="text-sm font-body text-red-600" role="alert">{t('review.sendError')}</p>}

        <button type="submit" disabled={!nota || aEnviar}
          className="w-full h-12 rounded-full bg-brand-700 text-white font-display font-semibold text-sm hover:bg-brand-800 disabled:opacity-40 disabled:cursor-not-allowed">
          {aEnviar ? t('review.sending') : t('review.send')}
        </button>
      </form>

      <p className="text-center text-xs font-body text-n-400 mt-6">{t('review.poweredBy')}</p>
    </Cartao>
  );
}
