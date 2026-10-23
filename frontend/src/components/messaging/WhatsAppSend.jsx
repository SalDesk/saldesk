import { useState } from 'react';
import { MessageCircle, ExternalLink } from 'lucide-react';
import { sendReservationMessage, markMessageOpened } from '../../services/messagingService';
import { useToast } from '../../store/toastStore';

/* Mensagens de WhatsApp para o cliente da reserva, por wa.me: o SalDesk prepara o texto
   (idioma do cliente, dados da reserva) e abre o WhatsApp com tudo pronto; quem envia e a pessoa.
   So aparecem as mensagens que fazem sentido para o estado da reserva. */

const ACCOES = [
  { trigger: 'booking_confirmed', label: 'Confirmação',        estados: ['confirmed', 'checked_in'] },
  { trigger: 'reminder_d1',       label: 'Lembrete',           estados: ['confirmed'] },
  { trigger: 'review_request',    label: 'Pedir avaliação',    estados: ['checked_out'] },
];

export default function WhatsAppSend({ reservationId, status, hasPhone }) {
  const toast = useToast();
  const [aEnviar, setAEnviar] = useState(null);
  const [linkManual, setLinkManual] = useState(null); // quando o navegador bloqueia o popup

  const disponiveis = ACCOES.filter((a) => a.estados.includes(status));
  if (!reservationId || disponiveis.length === 0) return null;

  const semTelefone = hasPhone === false;

  async function enviar(accao) {
    setAEnviar(accao.trigger);
    setLinkManual(null);
    // Abre a janela ja, dentro do clique, para o navegador nao a bloquear; o endereco entra depois.
    const janela = window.open('', '_blank');
    try {
      const msg = await sendReservationMessage(reservationId, accao.trigger);
      if (!msg.url) throw new Error('Sem ligação');
      if (janela) {
        janela.opener = null;
        janela.location.href = msg.url;
      } else {
        setLinkManual({ url: msg.url, id: msg.id });
      }
      markMessageOpened(msg.id).catch(() => {});
      toast.success(msg.created ? `${accao.label}: WhatsApp aberto` : `${accao.label} já estava preparada: WhatsApp aberto`);
    } catch (err) {
      if (janela) janela.close();
      toast.error(err.response?.data?.error || 'Não foi possível preparar a mensagem');
    } finally {
      setAEnviar(null);
    }
  }

  return (
    <div className="pt-4 border-t border-n-100">
      <p className="text-[10px] font-body font-semibold uppercase tracking-wide text-n-400 mb-2">WhatsApp</p>
      <div className="flex flex-wrap gap-2">
        {disponiveis.map((a) => (
          <button
            key={a.trigger}
            type="button"
            onClick={() => enviar(a)}
            disabled={semTelefone || aEnviar !== null}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-n-300 bg-white text-xs font-body font-semibold text-n-800 hover:bg-n-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <MessageCircle size={14} strokeWidth={1.75} className="text-turquoise-600" />
            {aEnviar === a.trigger ? 'A preparar…' : a.label}
          </button>
        ))}
      </div>
      {semTelefone && <p className="text-xs font-body text-n-500 mt-2">O cliente não tem telefone registado.</p>}
      {linkManual && (
        <a
          href={linkManual.url} target="_blank" rel="noopener noreferrer"
          onClick={() => markMessageOpened(linkManual.id).catch(() => {})}
          className="inline-flex items-center gap-1.5 mt-2 text-xs font-body font-semibold text-ocean-700 underline"
        >
          <ExternalLink size={13} strokeWidth={1.75} /> O navegador bloqueou a janela: abrir o WhatsApp
        </a>
      )}
    </div>
  );
}
