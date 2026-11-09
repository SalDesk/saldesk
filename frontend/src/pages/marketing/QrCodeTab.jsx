import { useState, useEffect } from 'react';
import { QrCode, RefreshCw, Download } from 'lucide-react';
import { getQrCode } from '../../services/marketingService';
import Button from '../../components/ui/Button';
import { Select } from '../../components/ui/Input';
import LoadingSpinner from '../../components/shared/LoadingSpinner';

const QR_COLORS     = ['#0D5470', '#062A38', '#D4A82A', '#1A7A4A', '#B91C1C', '#1A2332'];

/* ── QrCodeTab ── */
export default function QrCodeTab({ slug, units }) {
  const [selectedUnit, setSelectedUnit] = useState('');
  const [qrColor,      setQrColor]      = useState('#0D5470');
  const [qrSize,       setQrSize]       = useState('300');
  const [qrUrl,        setQrUrl]        = useState('');
  const [loading,      setLoading]      = useState(false);

  function generateQr() {
    setLoading(true);
    const params = { size: qrSize, color: qrColor.replace('#', '') };
    if (selectedUnit) params.unit_id = selectedUnit;
    getQrCode(params)
      .then(blob => setQrUrl(URL.createObjectURL(blob)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { generateQr(); }, [selectedUnit]);

  function downloadPng() {
    if (!qrUrl) return;
    const a = document.createElement('a');
    a.href = qrUrl;
    a.download = `qrcode-${selectedUnit || slug || 'saldesk'}.png`;
    a.click();
  }

  function downloadSvg() {
    if (!qrUrl) return;
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const size = parseInt(qrSize);
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      canvas.getContext('2d').drawImage(img, 0, 0, size, size);
      const base64 = canvas.toDataURL('image/png');
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${size}" height="${size}"><image width="${size}" height="${size}" xlink:href="${base64}"/></svg>`;
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `qrcode-${selectedUnit || slug || 'saldesk'}.svg`; a.click();
      URL.revokeObjectURL(url);
    };
    img.src = qrUrl;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Controls */}
      <div className="space-y-5">
        <Select label="QR Code para" value={selectedUnit} onChange={e => setSelectedUnit(e.target.value)}>
          <option value="">Perfil publico — link de reserva</option>
          {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </Select>

        <div>
          <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600 block mb-2">Cor</label>
          <div className="flex items-center gap-2 flex-wrap">
            {QR_COLORS.map(c => (
              <button key={c} onClick={() => setQrColor(c)}
                className={`w-7 h-7 rounded-sm border-2 transition-all ${qrColor === c ? 'border-n-700 scale-110' : 'border-transparent hover:scale-105'}`}
                style={{ backgroundColor: c }} />
            ))}
            <input type="color" value={qrColor} onChange={e => setQrColor(e.target.value)}
              className="w-7 h-7 rounded-sm cursor-pointer border border-n-300" />
            <span className="text-xs font-mono text-n-500">{qrColor}</span>
          </div>
        </div>

        <div>
          <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600 block mb-2">
            Tamanho — {qrSize}px
          </label>
          <input type="range" min="200" max="600" step="50" value={qrSize}
            onChange={e => setQrSize(e.target.value)}
            className="w-full accent-ocean-700" />
          <div className="flex justify-between text-[10px] font-mono text-n-400 mt-1">
            <span>200px</span><span>600px</span>
          </div>
        </div>

        <Button icon={RefreshCw} onClick={generateQr} loading={loading} variant="secondary" className="w-full justify-center">
          Gerar preview
        </Button>

        <div className="flex gap-3">
          <Button variant="secondary" icon={Download} onClick={downloadPng} disabled={!qrUrl || loading} className="flex-1">
            PNG
          </Button>
          <Button variant="secondary" icon={Download} onClick={downloadSvg} disabled={!qrUrl || loading} className="flex-1">
            SVG
          </Button>
        </div>
      </div>

      {/* Preview */}
      <div className="flex flex-col items-center gap-4">
        <p className="text-xs font-mono uppercase tracking-wider text-n-500 self-start">Preview</p>
        <div className="bg-white border border-n-200 rounded-md p-8 flex items-center justify-center w-full min-h-56">
          {loading ? (
            <LoadingSpinner size={32} />
          ) : qrUrl ? (
            <img src={qrUrl} alt="QR Code" className="max-w-48 max-h-48" />
          ) : (
            <QrCode size={64} strokeWidth={0.75} className="text-n-200" />
          )}
        </div>
        <div className="bg-n-50 border border-n-200 rounded-sm px-3 py-2 w-full">
          <p className="text-xs font-mono text-n-600 break-all text-center">
            {selectedUnit
              ? `saldesk.cv/book/${slug || '...'}/servico/${selectedUnit}`
              : `saldesk.cv/book/${slug || '...'}`}
          </p>
        </div>
      </div>
    </div>
  );
}
