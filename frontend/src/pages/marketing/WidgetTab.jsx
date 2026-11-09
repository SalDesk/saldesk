import { useState, useMemo } from 'react';
import { Code2 } from 'lucide-react';
import { CopyBtn } from './shared';

const WIDGET_COLORS = ['#0D5470', '#062A38', '#D4A82A', '#1A7A4A', '#1480A8', '#1A2332'];

/* ── WidgetTab ── */
export default function WidgetTab({ widgetCode, slug }) {
  const [color,       setColor]       = useState('#0D5470');
  const [previewMode, setPreviewMode] = useState(false);

  const finalCode = useMemo(() => {
    const base = widgetCode || `<script src="https://saldesk.cv/widget.js" data-slug="${slug}" data-color="${color}"></script>`;
    return base.replace(/data-color="[^"]*"/, `data-color="${color}"`);
  }, [widgetCode, color, slug]);

  return (
    <div className="space-y-5">
      <div>
        <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600 block mb-2">Cor primaria</label>
        <div className="flex items-center gap-2 flex-wrap">
          {WIDGET_COLORS.map(c => (
            <button key={c} onClick={() => setColor(c)}
              className={`w-7 h-7 rounded-sm border-2 transition-all ${color === c ? 'border-n-700 scale-110' : 'border-transparent hover:scale-105'}`}
              style={{ backgroundColor: c }} />
          ))}
          <input type="color" value={color} onChange={e => setColor(e.target.value)}
            className="w-7 h-7 rounded-sm cursor-pointer border border-n-300" />
          <span className="text-xs font-mono text-n-500">{color}</span>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600">Codigo HTML</label>
          <div className="flex gap-0.5 bg-n-100 rounded-xs p-0.5">
            {['Codigo', 'Preview'].map(m => (
              <button key={m} onClick={() => setPreviewMode(m === 'Preview')}
                className={`text-xs px-3 py-1 rounded-xs font-body transition-colors ${(previewMode ? 'Preview' : 'Codigo') === m ? 'bg-white text-ocean-700 shadow-sm' : 'text-n-500 hover:text-n-700'}`}>
                {m}
              </button>
            ))}
          </div>
        </div>

        {previewMode ? (
          <div className="border border-n-200 rounded-md min-h-40 bg-n-50 flex flex-col items-center justify-center p-8 gap-3">
            <div className="w-12 h-12 rounded-sm flex items-center justify-center" style={{ backgroundColor: color }}>
              <Code2 size={22} strokeWidth={1.75} className="text-white" />
            </div>
            <p className="text-sm font-body text-n-600 text-center">
              O widget de reservas aparecera aqui quando incorporado no seu website.
            </p>
            <p className="text-xs font-body text-n-400 text-center">
              Cor primaria: <span className="font-mono">{color}</span>
            </p>
          </div>
        ) : (
          <div className="bg-n-900 rounded-md p-4 overflow-auto">
            <pre className="text-xs font-mono text-green-400 whitespace-pre-wrap break-all">{finalCode}</pre>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <CopyBtn text={finalCode} />
        <p className="text-xs font-body text-n-400 flex-1">
          Cole este codigo no HTML do seu website onde quer que o formulario apareca.
        </p>
      </div>
    </div>
  );
}
