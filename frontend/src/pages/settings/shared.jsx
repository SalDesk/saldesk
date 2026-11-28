import { useState } from 'react';
import { Check, Copy, CheckCircle2 } from 'lucide-react';
import Button from '../../components/ui/Button';
import { useT } from '../../i18n';

/* Estilo Mare partilhado pelos separadores: cartao de pagina, caixa interna, titulo de cartao e figuras */
export const CARTAO = 'bg-white rounded-[18px] border border-mare-card p-[22px] min-w-0';
export const CAIXA  = 'rounded-[14px] bg-mare-head p-4 min-w-0';
export const TITULO = 'font-display text-lg font-semibold text-ocean-900';
export const NUM    = 'font-mono tabular-nums';

/* ── helpers ── */
export function CopyButton({ text }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  function doCopy() {
    navigator.clipboard.writeText(text || '').then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <Button variant="ghost" size="sm" className="min-h-11 md:min-h-0" icon={copied ? Check : Copy} onClick={doCopy}>
      {copied ? t('settings.shared.copied') : t('settings.shared.copy')}
    </Button>
  );
}

export function SaveBanner({ saved }) {
  const t = useT();
  if (!saved) return null;
  return (
    <div role="status" className="flex items-center gap-2 text-sm font-body text-[var(--success)] bg-[var(--success-light)] border border-n-200 rounded px-3 py-2">
      <CheckCircle2 size={14} strokeWidth={1.75} />
      {t('settings.shared.saved')}
    </div>
  );
}
