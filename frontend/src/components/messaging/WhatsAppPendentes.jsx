import { useState, useEffect, useCallback } from 'react';
import { MessageCircle } from 'lucide-react';
import { listOutbox, markMessageOpened } from '../../services/messagingService';

/* Mensagens de WhatsApp preparadas (pelas automacoes) que ainda ninguem abriu.
   Com o wa.me quem envia e uma pessoa: aqui toca-se no botao e o WhatsApp abre com o texto pronto.
   Desaparece sozinho quando nao ha nada por enviar. */

const ROTULO = {
  booking_confirmed: 'Confirmação',
  reminder_d1: 'Lembrete',
  review_request: 'Avaliação',
  automation: 'Automação',
};

const MAX_VISIVEIS = 5;

function formatarData(d) {
  if (!d) return '';
  const [y, m, dia] = String(d).split('-');
  return y && m && dia ? `${dia}/${m}/${y}` : d;
}

export default function WhatsAppPendentes() {
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
          WhatsApp por enviar <span className="text-n-400 font-body font-semibold">({linhas.length})</span>
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
                {ROTULO[l.trigger] || 'Mensagem'}
                {l.display?.tourName ? ` · ${l.display.tourName}` : ''}
                {l.display?.date ? ` · ${formatarData(l.display.date)}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => abrir(l)}
              className="shrink-0 h-8 px-3 rounded-xl bg-turquoise-600 hover:bg-turquoise-700 text-white text-xs font-body font-semibold transition-colors"
            >
              Abrir WhatsApp
            </button>
          </li>
        ))}
      </ul>
      {linhas.length > MAX_VISIVEIS && (
        <p className="text-xs font-body text-n-500 mt-2">+ {linhas.length - MAX_VISIVEIS} mensagem(ns) por enviar</p>
      )}
    </div>
  );
}
