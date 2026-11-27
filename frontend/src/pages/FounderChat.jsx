import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, MessageSquare } from 'lucide-react';
import { getFounderConversation, sendFounderMessage } from '../services/founderChatService';
import PageHeader from '../components/layout/PageHeader';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import { Textarea } from '../components/ui/Input';
import { useT } from '../i18n';
import { useLingua, localeDe } from '../utils/formatoLingua';

function fmt(iso, lang) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const locale = localeDe(lang);
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

export default function FounderChat() {
  const t = useT();
  const lang = useLingua();
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
      <PageHeader eyebrow={t('nav.sections.clientes')} title={t('founderChat.title')} subtitle={t('founderChat.subtitle')} />

      {/* cartao Mare da conversa */}
      <div data-mare-conversa className="bg-white rounded-[18px] border border-mare-card flex flex-col overflow-hidden h-[calc(100vh-220px)] min-h-[420px]">
        <div className="flex-1 overflow-y-auto p-[22px] space-y-3">
          {loading && (
            <div className="flex justify-center py-10"><LoadingSpinner size={24} /></div>
          )}
          {!loading && messages.length === 0 && (
            <EmptyState
              icon={MessageSquare}
              title={t('founderChat.emptyTitle')}
              description={t('founderChat.emptyText')}
            />
          )}
          {messages.map(msg => (
            <div key={msg.id} className={`flex min-w-0 ${msg.sender_type === 'operator' ? 'justify-end' : 'justify-start'}`}>
              <div className={`min-w-0 max-w-xs lg:max-w-md break-words px-4 py-2.5 rounded-2xl text-sm ${
                msg.sender_type === 'operator'
                  ? 'bg-ocean-700 text-white rounded-br-sm'
                  : 'bg-mare-head border border-mare-card text-n-900 rounded-bl-sm'
              }`}>
                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                <p className={`font-mono tabular-nums text-xs mt-1 ${msg.sender_type === 'operator' ? 'text-ocean-100' : 'text-n-600'}`}>
                  {fmt(msg.created_at, lang)}
                </p>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="p-3 border-t border-mare-card">
          {/* caixa interior Mare da escrita */}
          <div data-mare-caixa className="flex items-end gap-2 bg-mare-head border border-mare-card rounded-[14px] p-2">
            <div className="flex-1">
              <Textarea
                rows={2}
                placeholder={t('founderChat.placeholder')}
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              />
            </div>
            <Button
              icon={Send}
              aria-label={t('founderChat.send')}
              onClick={handleSend}
              disabled={!text.trim() || sending}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
