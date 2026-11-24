import { useState, useEffect, useCallback } from 'react';
import { MessageCircle } from 'lucide-react';
import { listOutbox, markMessageOpened } from '../../services/messagingService';
import { useT } from '../../i18n';
import { formatarData } from '../../utils/formatoLingua';

/* Mensagens de WhatsApp preparadas (pelas automacoes) que ainda ninguem abriu.
   Com o wa.me quem envia e uma pessoa: aqui toca-se no botao e o WhatsApp abre com o texto pronto.
   Desaparece sozinho quando nao ha nada por enviar. */

/* Gatilhos conhecidos; o rotulo vem de whatsappMessages.pending.triggers */
const GATILHOS = ['booking_confirmed', 'reminder_d1', 'review_request', 'automation'];

const MAX_VISIVEIS = 5;

/* Data AAAA-MM-DD na lingua do painel (em pt: dd/mm/aaaa); outro formato mostra-se como veio */
function dataLegivel(d) {
  if (!d) return '';
  return /^\d{4}-\d{2}-\d{2}$/.test(String(d)) ? formatarData(String(d)) : d;
}

export default function WhatsAppPendentes() {
  const t = useT();
  const [linhas, setLinhas] = useState([]);

  const carregar = useCallback(() => {
    listOutbox({ status: 'awaiting_human', limit: 50 })
      .then((rows) => setLinhas((rows || []).filter((r) => r.handoff_url && !r.opened_at)))
      .catch(() => setLinhas([])); // sem a camada de mensagens o cartao simplesmente nao aparece
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  function abrir(linha) {
    window.open(linha.handoff_url, '_blank', 'noopener,noreferrer');
    // Sai da lista logo; o registo no servidor e feito a seguir.
    setLinhas((prev) => prev.filter((l) => l.id !== linha.id));
    markMessageOpened(linha.id).catch(() => carregar());
  }

  if (linhas.length === 0) return null;
  const visiveis = linhas.slice(0, MAX_VISIVEIS);

  return (
    <div className="bg-white rounded-2xl border border-n-200 p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <MessageCircle size={16} strokeWidth={1.75} className="text-turquoise-600" />
        <h3 className="font-display font-bold text-sm text-n-900">
          {t('whatsappMessages.pending.title')} <span className="text-n-400 font-body font-semibold">({linhas.length})</span>
        </h3>
      </div>
      <ul className="divide-y divide-n-100">
        {visiveis.map((l) => (
          <li key={l.id} className="flex items-center justify-between gap-3 py-2">
            <div className="min-w-0">
              <p className="text-sm font-body font-semibold text-n-900 truncate">
                {l.display?.customerName || l.to_e164}
              </p>
              <p className="text-xs font-body text-n-500 truncate">
                {GATILHOS.includes(l.trigger) ? t(`whatsappMessages.pending.triggers.${l.trigger}`) : t('whatsappMessages.pending.message')}
                {l.display?.tourName ? ` · ${l.display.tourName}` : ''}
                {l.display?.date ? ` · ${dataLegivel(l.display.date)}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => abrir(l)}
              className="shrink-0 h-8 px-3 rounded-xl bg-turquoise-600 hover:bg-turquoise-700 text-white text-xs font-body font-semibold transition-colors"
            >
              {t('whatsappMessages.pending.open')}
            </button>
          </li>
        ))}
      </ul>
      {linhas.length > MAX_VISIVEIS && (
        <p className="text-xs font-body text-n-500 mt-2">{t('whatsappMessages.pending.more', { n: linhas.length - MAX_VISIVEIS })}</p>
      )}
    </div>
  );
}
