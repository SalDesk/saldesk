import { useState, useEffect, useRef } from 'react';
import { useT } from '../../i18n';
import { CopyBtn, CARTAO, CAIXA } from './shared';

/* O codigo vem do servidor (GET /marketing/widget-code): um iframe da pagina publica do operador
   (/book/<slug>?widget=1) com um pequeno script que ajusta a altura do iframe. A cor do widget e a
   cor da pagina publica do operador (Definicoes > Perfil Publico, brand_color): nao ha seletor aqui,
   o codigo nao leva a cor. O script widget.js nunca existiu. */

/* ── Pre-visualizacao: o widget real, com a altura a seguir a mensagem do proprio widget ── */
function PreviewWidget({ slug }) {
  const t = useT();
  const ref = useRef(null);

  useEffect(() => {
    function onMessage(event) {
      const quadro = ref.current;
      if (!quadro || event.source !== quadro.contentWindow) return;
      const d = event.data;
      if (d && d.type === 'saldesk-widget-resize' && Number(d.height) > 0) {
        quadro.style.height = `${Number(d.height)}px`;
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return (
    <iframe
      ref={ref}
      title={t('marketingPage.widget.previewTitle')}
      src={`/book/${encodeURIComponent(slug)}?widget=1&preview=1`}
      width="100%"
      height="500"
      className="block w-full rounded-[14px] bg-white"
      style={{ border: 'none', minHeight: 320 }}
    />
  );
}

/* ── WidgetTab ── */
export default function WidgetTab({ widgetCode, slug }) {
  const t = useT();
  const [previewMode, setPreviewMode] = useState(false);
  const codigo = typeof widgetCode === 'string' ? widgetCode : '';

  return (
    <section className={`${CARTAO} space-y-5`}>
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600">{t('marketingPage.widget.htmlCode')}</label>
          <div className="flex gap-0.5 bg-mare-head border border-mare-card rounded-full p-0.5">
            {['Codigo', 'Preview'].map(m => (
              <button key={m} type="button" aria-pressed={(previewMode ? 'Preview' : 'Codigo') === m} onClick={() => setPreviewMode(m === 'Preview')}
                className={`text-xs px-4 py-1 min-h-11 md:min-h-8 rounded-full font-body font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sand-500 ${(previewMode ? 'Preview' : 'Codigo') === m ? 'bg-white text-ocean-700 shadow-sm' : 'text-n-600 hover:text-n-800'}`}>
                {m === 'Codigo' ? t('marketingPage.widget.code') : t('marketingPage.widget.preview')}
              </button>
            ))}
          </div>
        </div>

        {previewMode ? (
          <PreviewWidget slug={slug} />
        ) : codigo ? (
          <div className="bg-mare-head border border-mare-card rounded-[14px] p-4 overflow-auto max-h-96 min-w-0">
            <pre className="text-xs font-mono text-n-800 whitespace-pre-wrap break-all">{codigo}</pre>
          </div>
        ) : (
          <div className={`${CAIXA} px-4 py-6 text-center`}>
            <p className="text-sm font-body text-n-600">{t('marketingPage.widget.failed')}</p>
          </div>
        )}
      </div>

      {codigo && (
        <div className="flex flex-wrap items-center gap-3">
          <CopyBtn text={codigo} />
          <p className="text-xs font-body text-n-600 flex-1 min-w-[12rem]">
            {t('marketingPage.widget.pasteHint')}
          </p>
        </div>
      )}

      <p className="text-xs font-body text-n-500">
        {t('marketingPage.widget.colorNote')}{' '}
        <a href="/definicoes?tab=perfil" className="font-semibold text-ocean-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sand-500 rounded-xs">{t('marketingPage.widget.settingsLink')}</a>.
      </p>

      <p className="text-xs font-body text-n-500">
        {t('marketingPage.widget.sisp')}
      </p>
    </section>
  );
}
