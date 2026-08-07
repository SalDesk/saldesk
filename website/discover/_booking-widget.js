/* ══════════════════════════════════════════════════════════
   _booking-widget.js — SalDesk Connect · Modal de reserva embutido
   Abre o motor de reservas real (app.saldesk.cv) num iframe, dentro
   da propria pagina do discover, reutilizando o modo widget ja
   existente no app (ver frontend/src/utils/widgetMode.js).
   Ficheiro partilhado por index.html e pelas paginas de _lugares.js.
══════════════════════════════════════════════════════════ */
'use strict';

(function () {
  const APP = 'https://app.saldesk.cv';
  const RESIZE_TIMEOUT_MS = 4000;

  const CSS = `
  .bw-overlay{position:fixed;inset:0;background:rgba(6,42,56,.6);z-index:600;display:flex;align-items:center;justify-content:center;padding:20px;opacity:0;visibility:hidden;transition:opacity .25s,visibility .25s;backdrop-filter:blur(4px)}
  .bw-overlay.open{opacity:1;visibility:visible}
  .bw-panel{background:#fff;border-radius:20px;width:100%;max-width:480px;max-height:92vh;display:flex;flex-direction:column;overflow:hidden;transform:translateY(16px);transition:transform .25s;box-shadow:0 24px 64px rgba(6,42,56,.3)}
  .bw-overlay.open .bw-panel{transform:none}
  .bw-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;border-bottom:1px solid #E5E8EC;flex-shrink:0}
  .bw-title{font-family:'Sora',sans-serif;font-size:.9375rem;font-weight:700;color:#1A2332;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .bw-actions{display:flex;align-items:center;gap:6px;flex-shrink:0}
  .bw-ext{display:flex;align-items:center;gap:5px;font-size:.75rem;font-weight:600;color:#0D5470;background:#EBF7FB;border:none;border-radius:100px;padding:6px 10px;cursor:pointer;text-decoration:none;white-space:nowrap}
  .bw-ext:hover{background:#D6EEF5}
  .bw-close{background:none;border:none;cursor:pointer;color:#9CA3AF;padding:6px;border-radius:8px;line-height:0;transition:all .2s}
  .bw-close:hover{background:#F3F4F6;color:#374151}
  .bw-body{position:relative;flex:1;min-height:420px;overflow-y:auto}
  .bw-frame{width:100%;border:none;display:block;min-height:420px}
  .bw-frame.hidden{display:none}
  .bw-skel{position:absolute;inset:0;padding:24px;display:flex;flex-direction:column;gap:14px}
  .bw-skel-line{background:linear-gradient(90deg,#F3F4F6 25%,#E5E8EC 50%,#F3F4F6 75%);background-size:300% 100%;animation:bw-shimmer 1.6s infinite;border-radius:8px}
  @keyframes bw-shimmer{0%{background-position:-300% 0}100%{background-position:300% 0}}
  .bw-fallback{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:32px;gap:14px}
  .bw-fallback p{font-size:.875rem;color:#6B7280;max-width:280px;line-height:1.5}
  .bw-fallback a{display:inline-flex;align-items:center;gap:7px;background:#0D5470;color:#fff;border-radius:8px;padding:11px 20px;font-size:.875rem;font-weight:600;text-decoration:none}
  .bw-fallback a:hover{background:#1480A8}
  `;

  function injectStyle() {
    if (document.getElementById('bw-style')) return;
    const s = document.createElement('style');
    s.id = 'bw-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function injectMarkup() {
    if (document.getElementById('bw-overlay')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="bw-overlay" id="bw-overlay">
        <div class="bw-panel">
          <div class="bw-header">
            <span class="bw-title" id="bw-title"></span>
            <div class="bw-actions">
              <a class="bw-ext" id="bw-ext-link" target="_blank" rel="noopener">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                <span data-pt="Nova aba" data-en="New tab">Nova aba</span>
              </a>
              <button class="bw-close" id="bw-close" aria-label="Fechar">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>
          <div class="bw-body" id="bw-body">
            <div class="bw-skel" id="bw-skel">
              <div class="bw-skel-line" style="height:32px;width:70%"></div>
              <div class="bw-skel-line" style="height:180px"></div>
              <div class="bw-skel-line" style="height:44px"></div>
              <div class="bw-skel-line" style="height:44px;width:60%"></div>
            </div>
            <iframe class="bw-frame hidden" id="bw-frame" title="Reservar"></iframe>
          </div>
        </div>
      </div>`);
  }

  function currentLang() {
    return document.documentElement.dataset.lang || 'pt';
  }

  function applyLangToFallback(root) {
    root.querySelectorAll('[data-pt]').forEach(el => {
      el.textContent = currentLang() === 'en' ? el.dataset.en : el.dataset.pt;
    });
  }

  let resizeListenerAttached = false;
  let resizeTimeout = null;
  let currentIframeWindow = null;

  function attachResizeListener() {
    if (resizeListenerAttached) return;
    resizeListenerAttached = true;
    window.addEventListener('message', (event) => {
      if (event.origin !== APP) return;
      const frame = document.getElementById('bw-frame');
      if (!frame || event.source !== frame.contentWindow) return;
      if (!event.data || event.data.type !== 'saldesk-widget-resize') return;

      clearTimeout(resizeTimeout);
      const skel = document.getElementById('bw-skel');
      if (skel) skel.style.display = 'none';
      frame.classList.remove('hidden');
      /* Limite defensivo: a pagina embebida usa "min-height:100vh" no seu
         wrapper, o que pode entrar num loop de realimentacao com o proprio
         ResizeObserver (a altura reportada cresce porque a altura do
         proprio iframe -- que reflecte no 100vh do filho -- acabou de
         crescer). Sem este limite o iframe cresceria sem controlo; o
         conteudo em excesso faz scroll dentro do modal (.bw-body). */
      const MAX_FRAME_HEIGHT = 1600;
      frame.style.height = Math.max(420, Math.min(event.data.height, MAX_FRAME_HEIGHT)) + 'px';
    });
  }

  function showFallback(slug) {
    const body = document.getElementById('bw-body');
    if (!body || body.querySelector('.bw-fallback')) return;
    const skel = document.getElementById('bw-skel');
    if (skel) skel.style.display = 'none';
    body.insertAdjacentHTML('beforeend', `
      <div class="bw-fallback">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        <p data-pt="Nao foi possivel abrir a reserva aqui." data-en="Couldn't open the booking here."></p>
        <a href="${APP}/book/${slug}" target="_blank" rel="noopener" data-pt="Abrir em nova aba" data-en="Open in new tab"></a>
      </div>`);
    applyLangToFallback(body.querySelector('.bw-fallback'));
  }

  function closeBookingModal() {
    const overlay = document.getElementById('bw-overlay');
    if (!overlay) return;
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    clearTimeout(resizeTimeout);
    const frame = document.getElementById('bw-frame');
    if (frame) { frame.src = 'about:blank'; frame.classList.add('hidden'); }
    const fb = document.getElementById('bw-body')?.querySelector('.bw-fallback');
    if (fb) fb.remove();
    const skel = document.getElementById('bw-skel');
    if (skel) skel.style.display = '';
  }

  function openBookingModal(slug, operatorName, unitId) {
    if (!slug) return;
    injectStyle();
    injectMarkup();
    attachResizeListener();

    const path = unitId ? `${slug}/servico/${unitId}` : slug;

    document.getElementById('bw-title').textContent = operatorName || '';
    document.getElementById('bw-ext-link').href = `${APP}/book/${path}`;
    applyLangToFallback(document.getElementById('bw-overlay'));

    const overlay = document.getElementById('bw-overlay');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';

    const frame = document.getElementById('bw-frame');
    frame.classList.add('hidden');
    frame.src = `${APP}/book/${path}?widget=1`;
    currentIframeWindow = frame.contentWindow;

    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => showFallback(path), RESIZE_TIMEOUT_MS);
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeBookingModal();
  });

  document.addEventListener('DOMContentLoaded', () => {
    injectStyle();
    injectMarkup();
    document.getElementById('bw-close')?.addEventListener('click', closeBookingModal);
    document.getElementById('bw-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'bw-overlay') closeBookingModal();
    });
  });

  window.openBookingModal = openBookingModal;
  window.closeBookingModal = closeBookingModal;
})();
