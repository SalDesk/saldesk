import { useState } from 'react';
import { Check, Copy, ExternalLink, Share2, Globe2 } from 'lucide-react';
import Card from '../../components/ui/Card';

/* ── Social planner localStorage ── */
const STORAGE_KEY = 'saldesk_social_posts_v1';
export function loadPosts() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
export function savePosts(posts) { localStorage.setItem(STORAGE_KEY, JSON.stringify(posts)); }

export const PLATFORMS = [
  { value: 'instagram', label: 'Instagram',            icon: ExternalLink },
  { value: 'facebook',  label: 'Facebook',             icon: Share2       },
  { value: 'ambos',     label: 'Instagram + Facebook', icon: Globe2       },
];

export const STATUS_CONFIG = {
  agendado:  { label: 'Agendado',  variant: 'info'      },
  publicado: { label: 'Publicado', variant: 'confirmed' },
  cancelado: { label: 'Cancelado', variant: 'cancelled' },
};

/* ── Calendar helpers (partilhados) ── */
export const MONTHS_PT = ['Janeiro','Fevereiro','Marco','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
export function postDateKey(p) { return p.scheduled_at?.slice(0, 10) || ''; }

/* ── CopyBtn ── */
export function CopyBtn({ text, small }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }
  return (
    <button type="button" onClick={copy}
      className={`flex items-center gap-1.5 transition-colors font-body font-medium ${small ? 'text-xs px-2 py-1 rounded-xs' : 'text-sm px-3 py-2 rounded-sm'} ${copied ? 'text-[var(--success)] bg-[var(--success-light)]' : 'text-ocean-700 bg-ocean-50 hover:bg-ocean-100'}`}>
      {copied ? <Check size={small ? 11 : 14} strokeWidth={2} /> : <Copy size={small ? 11 : 14} strokeWidth={1.75} />}
      {copied ? 'Copiado' : 'Copiar'}
    </button>
  );
}

/* ── KpiCard ── */
export function KpiCard({ icon: Icon, label, value, sub, loading }) {
  return (
    <Card padding="p-4 flex items-start gap-3">
      <div className="w-9 h-9 rounded-sm bg-ocean-50 flex items-center justify-center shrink-0">
        <Icon size={18} strokeWidth={1.75} className="text-ocean-700" />
      </div>
      <div>
        {loading ? <div className="h-6 w-16 bg-n-100 rounded animate-pulse" /> : (
          <p className="font-display font-bold text-xl text-n-900">{value ?? '—'}</p>
        )}
        <p className="text-xs font-body text-n-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs font-body text-n-400 mt-0.5">{sub}</p>}
      </div>
    </Card>
  );
}
