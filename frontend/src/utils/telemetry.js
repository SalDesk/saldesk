import api from '../services/api';

const SESSION_KEY = 'sd_session_id';
const SOURCE_KEY  = 'sd_traffic_source';

function classifySource(referrer) {
  if (!referrer) return 'direct';
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '');
    if (host === window.location.hostname) return 'direct';
    if (/google\.|bing\.|duckduckgo\.|yahoo\./.test(host)) return 'organic';
    if (/facebook\.|instagram\.|linkedin\.|twitter\.|x\.com|tiktok\./.test(host)) return 'social';
    return 'referral';
  } catch {
    return 'direct';
  }
}

function getSessionId() {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

function getSource() {
  let source = sessionStorage.getItem(SOURCE_KEY);
  if (!source) {
    source = classifySource(document.referrer);
    sessionStorage.setItem(SOURCE_KEY, source);
  }
  return source;
}

/* Regista uma pageview da SPA para a aba "Trafego" da Analytics do fundador.
   Fogo-e-esquece: nunca deve atrasar nem quebrar a navegacao do operador. */
export function trackPageView(path) {
  api.post('/telemetry/view', { path, session_id: getSessionId(), source: getSource() }).catch(() => {});
}
