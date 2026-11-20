import { useState } from 'react';
import { Check, Copy, CheckCircle2 } from 'lucide-react';
import Button from '../../components/ui/Button';
import { useT } from '../../i18n';

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
    <Button variant="ghost" size="sm" icon={copied ? Check : Copy} onClick={doCopy}>
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
