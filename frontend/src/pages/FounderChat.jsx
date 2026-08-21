import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, MessageSquare } from 'lucide-react';
import { getFounderConversation, sendFounderMessage } from '../services/founderChatService';
import PageHeader from '../components/layout/PageHeader';
import LoadingSpinner from '../components/shared/LoadingSpinner';

function fmt(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}

export default function FounderChat() {
  const [messages, setMessages] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [text,     setText]     = useState('');
  const [sending,  setSending]  = useState(false);
  const bottomRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const data = await getFounderConversation();
      setMessages(data || []);
    } catch { /* silencioso */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* Sem socket dedicado aqui -- a conversa e pouco frequente (mensagens
     da equipa SalDesk, nao chat de suporte em directo); um refresh
     periodico e suficiente e evita mais uma ligacao websocket global,
     mesmo padrao ja usado pelo sino de notificacoes no Topbar. */
  useEffect(() => {
    const id = setInterval(load, 20_000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const msg = await sendFounderMessage(text.trim());
      setMessages(m => [...m, msg]);
      setText('');
    } catch { /* silencioso */ }
    finally { setSending(false); }
  }

  return (
    <div>
      <PageHeader title="Mensagens SalDesk" subtitle="Conversa directa com a equipa SalDesk" />

      <div className="bg-white rounded-md border border-n-200 flex flex-col h-[calc(100vh-220px)] min-h-[420px]">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading && (
            <div className="flex justify-center py-10"><LoadingSpinner size={24} /></div>
          )}
          {!loading && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center py-10">
              <MessageSquare className="text-n-300 mb-3" size={36} strokeWidth={1.75} />
              <p className="text-sm text-n-500">Sem mensagens ainda</p>
              <p className="text-xs text-n-400 mt-1">Escreve aqui se precisares de contactar a equipa SalDesk</p>
            </div>
          )}
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.sender_type === 'operator' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl text-sm ${
                msg.sender_type === 'operator'
                  ? 'bg-ocean-700 text-white rounded-br-sm'
                  : 'bg-n-50 border border-n-200 text-n-900 rounded-bl-sm'
              }`}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
                <p className={`text-xs mt-1 ${msg.sender_type === 'operator' ? 'text-ocean-200' : 'text-n-400'}`}>
                  {fmt(msg.created_at)}
                </p>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="p-3 border-t border-n-200">
          <div className="flex items-end gap-2">
            <textarea
              className="flex-1 rounded-xl border border-n-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ocean-500"
              rows={2}
              placeholder="Escreve uma mensagem..."
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            />
            <button
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-ocean-700 text-white text-sm font-medium hover:bg-ocean-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleSend}
              disabled={!text.trim() || sending}
            >
              <Send size={16} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
