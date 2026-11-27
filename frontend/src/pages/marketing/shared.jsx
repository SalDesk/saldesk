import { useState } from 'react';
import { Check, Copy, ExternalLink, Share2, Globe2 } from 'lucide-react';
import { useT } from '../../i18n';

/* ── Estilo Mare: cartao de pagina, caixa interior calada, titulo de cartao e figuras ── */
export const CARTAO = 'bg-white rounded-[18px] border border-mare-card p-[22px] min-w-0';
export const CAIXA  = 'bg-mare-head rounded-[14px] border border-mare-card px-3.5 py-2.5 min-w-0';
export const TITULO = 'font-display text-lg font-semibold text-ocean-900';
export const NUM    = 'font-mono tabular-nums';

/* ── Social planner localStorage ── */
const STORAGE_KEY = 'saldesk_social_posts_v1';
export function loadPosts() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
export function savePosts(posts) { localStorage.setItem(STORAGE_KEY, JSON.stringify(posts)); }

/* Redes gravadas em cada post (instagram, facebook, ambos); os nomes sao marcas e iguais em todas as linguas */
export const PLATFORMS = [
  { value: 'instagram', label: 'Instagram',            icon: ExternalLink },
  { value: 'facebook',  label: 'Facebook',             icon: Share2       },
  { value: 'ambos',     label: 'Instagram + Facebook', icon: Globe2       },
];

/* Estados gravados em cada post; o rotulo vem de rotuloEstadoPost */
export const STATUS_CONFIG = {
  agendado:  { variant: 'info'      },
  publicado: { variant: 'confirmed' },
  cancelado: { variant: 'cancelled' },
};

/* Rotulo do estado de um post; um estado desconhecido mostra-se tal e qual */
export function rotuloEstadoPost(estado, t) {
  return STATUS_CONFIG[estado] ? t(`marketingPage.postStatus.${estado}`) : estado;
}

/* ── Calendar helpers (partilhados) ── */
export function postDateKey(p) { return p.scheduled_at?.slice(0, 10) || ''; }

/* ── CopyBtn ── */
export function CopyBtn({ text, small }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }
  return (
    <button type="button" onClick={copy}
      className={`flex items-center gap-1.5 transition-colors font-body font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sand-500 ${small ? 'text-xs px-2 py-1 rounded-xs' : 'text-sm px-3 py-2 min-h-11 md:min-h-0 rounded-sm'} ${copied ? 'text-[var(--success)] bg-[var(--success-light)]' : 'text-ocean-700 bg-ocean-50 hover:bg-ocean-100'}`}>
      {copied ? <Check size={small ? 11 : 14} strokeWidth={2} /> : <Copy size={small ? 11 : 14} strokeWidth={1.75} />}
      {copied ? t('marketingPage.copied') : t('marketingPage.copy')}
    </button>
  );
}

/* ── Valor de um MareStat: barra a pulsar enquanto carrega, travessao sem valor ── */
export function valorDoTile(value, loading) {
  if (loading) return <span className="block h-7 w-16 rounded bg-n-100 animate-pulse" />;
  return value ?? '—';
}
