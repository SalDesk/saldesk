import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import visaLogo from '../../assets/payment-logos/visa.png';
import mastercardLogo from '../../assets/payment-logos/mastercard.png';
import amexLogo from '../../assets/payment-logos/amex.jpg';
import vinti4Logo from '../../assets/payment-logos/vinti4.png';

/* Exigencias visiveis do checklist de validacao de site da SISP (logos das
   marcas aceites + politica de cancelamento) -- ja existiam dentro do modal
   de reserva, no passo de pagamento (PO/CancelPolicyCheck em ServiceDetail.jsx),
   e no rodape das paginas ESTATICAS de marketing (website/), mas nunca na
   propria pagina publica de cada operador -- o "site" que e de facto
   submetido a SISP para validacao. Mesmo texto/fallback honesto da politica
   ja usado no checkout, para nunca divergir. */
export default function SiteComplianceFooter({ op, lang }) {
  const [open, setOpen] = useState(false);
  const policyText = (lang === 'en' ? op.cancellation_policy_en : op.cancellation_policy_pt)
    || (lang === 'en'
      ? 'This operator has not yet defined a cancellation policy. Contact them directly before booking.'
      : 'Este operador ainda não definiu uma política de cancelamento. Contacte-o directamente antes de reservar.');

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div>
        <p className="text-xs font-body font-semibold text-white/40 uppercase tracking-wide mb-2">
          {lang === 'en' ? 'Accepted payments' : 'Pagamentos aceites'}
        </p>
        <div className="flex items-center gap-3">
          <img src={vinti4Logo} alt="Vinti4" className="h-5 w-auto object-contain bg-white rounded px-1 py-0.5" />
          <img src={visaLogo} alt="Visa" className="h-5 w-auto object-contain bg-white rounded px-1 py-0.5" />
          {/* Mastercard: sem chip branco -- o wordmark "ID Check" do asset oficial
              e branco (pensado para fundo escuro), fica invisivel sobre chip branco
              (ja confirmado ao vivo nas paginas estaticas). Renderiza directo sobre
              o fundo escuro do footer, ligeiramente maior para compensar. */}
          <img src={mastercardLogo} alt="Mastercard" className="h-[22px] w-auto object-contain" />
          <img src={amexLogo} alt="Amex" className="h-5 w-auto object-contain bg-white rounded px-1 py-0.5" />
        </div>
      </div>
      <div className="w-full sm:w-auto sm:max-w-xs">
        <button type="button" onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1.5 text-xs font-body text-white/50 hover:text-white transition-colors">
          {lang === 'en' ? 'Cancellation policy' : 'Política de cancelamento'}
          {open ? <ChevronUp size={12} strokeWidth={2} /> : <ChevronDown size={12} strokeWidth={2} />}
        </button>
        {open && (
          <p className="text-xs font-body text-white/45 leading-relaxed mt-2">{policyText}</p>
        )}
      </div>
    </div>
  );
}
