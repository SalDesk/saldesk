import { useState } from 'react';
import { Check, Copy, CheckCircle2 } from 'lucide-react';
import Button from '../../components/ui/Button';

/* ── helpers ── */
export function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  function doCopy() {
    navigator.clipboard.writeText(text || '').then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <Button variant="ghost" size="sm" icon={copied ? Check : Copy} onClick={doCopy}>
      {copied ? 'Copiado' : 'Copiar'}
    </Button>
  );
}

export function SaveBanner({ saved }) {
  if (!saved) return null;
  return (
    <div className="flex items-center gap-2 text-sm font-body text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
      <CheckCircle2 size={14} strokeWidth={1.75} />
      Guardado com sucesso
    </div>
  );
}
