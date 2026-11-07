import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import {
  Plus,
  MessageSquare,
  Users,
  Send,
  X,
  Hash,
  Pin,
  CornerUpLeft,
  Megaphone,
} from 'lucide-react';
import { listMessages, sendMessage, listGroups, createGroup } from '../../services/messageService';
import useAuthStore from '../../store/authStore';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import { StaffAvatar } from './shared';

/* ── Chat Message ── */
function MessageBubble({ msg, isOwn, staffList, pinnedIds, onPin, onReply, allMessages }) {
  const sender    = staffList.find(s => s.id === msg.sender_id);
  const isPinned  = pinnedIds?.has(msg.id);
  const replyMsg  = msg.reply_to_id ? allMessages?.find(m => m.id === msg.reply_to_id) : null;
  const replySender = replyMsg ? staffList.find(s => s.id === replyMsg.sender_id) : null;

  return (
    <div className={`group flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
      {!isOwn && sender && <StaffAvatar member={sender} size={24} showStatus={false} />}
      {!isOwn && !sender && (
        <div className="w-6 h-6 rounded-full bg-n-200 flex items-center justify-center shrink-0">
          <Hash size={10} strokeWidth={1.75} className="text-n-500" />
        </div>
      )}
      <div className="flex flex-col max-w-[72%]">
        {/* Reply context */}
        {replyMsg && (
          <div className={`mb-1 px-2 py-1 rounded-sm border-l-2 border-ocean-500 ${isOwn ? 'bg-ocean-600 text-ocean-200 self-end' : 'bg-n-200 text-n-500'} text-xs font-body`}>
            <span className="font-semibold mr-1">{replySender?.name.split(' ')[0] || 'Sistema'}</span>
            <span className="truncate">{replyMsg.content?.slice(0, 60)}</span>
          </div>
        )}
        <div className={`px-3 py-2 rounded-lg text-sm font-body relative ${isOwn ? 'bg-ocean-700 text-white rounded-br-sm' : 'bg-n-100 text-n-900 rounded-bl-sm'}`}>
          {isPinned && (
            <Pin size={10} strokeWidth={1.75} className={`absolute top-1.5 ${isOwn ? 'left-2 text-ocean-300' : 'right-2 text-n-400'}`} />
          )}
          {!isOwn && sender && (
            <p className="text-xs font-mono font-semibold mb-0.5 text-ocean-700">{sender.name.split(' ')[0]}</p>
          )}
          <p>{msg.content}</p>
          <p className={`text-xs mt-1 ${isOwn ? 'text-ocean-200' : 'text-n-400'}`}>
            {new Date(msg.created_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
      {/* Action buttons on hover */}
      <div className={`flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${isOwn ? 'order-first' : ''}`}>
        <button onClick={() => onReply?.(msg)} title="Responder"
          className="p-1 rounded text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors">
          <CornerUpLeft size={12} strokeWidth={1.75} />
        </button>
        <button onClick={() => onPin?.(msg.id)} title={isPinned ? 'Desafixar' : 'Fixar'}
          className={`p-1 rounded transition-colors ${isPinned ? 'text-ocean-700 bg-ocean-50' : 'text-n-400 hover:text-ocean-700 hover:bg-ocean-50'}`}>
          <Pin size={12} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}

/* ── Chat Tab ── */
function ChatTab({ staffList }) {
  const { operator }  = useAuthStore();
  const [groups,       setGroups]      = useState([]);
  const [messages,     setMessages]    = useState([]);
  const [conversation, setConvo]       = useState(null);
  const [input,        setInput]       = useState('');
  const [loadingMsgs,  setLoadMsgs]   = useState(false);
  const [groupModal,   setGroupModal]  = useState(false);
  const [groupName,    setGroupName]   = useState('');
  const [replyTo,      setReplyTo]     = useState(null);
  const [pinnedIds,    setPinnedIds]   = useState(new Set());
  const [broadcastModal, setBroadcast] = useState(false);
  const [broadcastText,  setBroadcastText] = useState('');
  const [broadcasting,   setBroadcasting]  = useState(false);
  const socketRef      = useRef(null);
  const endRef         = useRef(null);
  const inputRef       = useRef(null);
  const conversationRef = useRef(null);

  useEffect(() => { conversationRef.current = conversation; }, [conversation]);

  useEffect(() => {
    listGroups().then(setGroups).catch(() => {});
    const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1').replace('/api/v1', '');
    const sock = io(BASE, {
      auth: { token: useAuthStore.getState().token },
      transports: ['websocket'],
      reconnectionAttempts: 3,
    });
    socketRef.current = sock;
    sock.on('message:new', msg => {
      const cur = conversationRef.current;
      if (!cur) return;
      const operatorId = useAuthStore.getState().operator?.id;
      const isRelevant =
        (cur.type === 'group' && msg.group_id === cur.id) ||
        (cur.type === 'direct' && !msg.group_id && (
          msg.sender_id === cur.id ||
          (msg.sender_id === operatorId && msg.recipient_id === cur.id)
        ));
      if (!isRelevant) return;
      setMessages(p => p.find(m => m.id === msg.id) ? p : [...p, msg]);
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
    return () => sock.disconnect();
  }, []);

  useEffect(() => {
    if (!conversation) return;
    setLoadMsgs(true);
    setPinnedIds(new Set());
    setReplyTo(null);
    const params = conversation.type === 'group'
      ? { group_id: conversation.id }
      : { recipient_id: conversation.id };
    listMessages(params)
      .then(data => {
        const msgs = data.data || [];
        setMessages(msgs);
        // restore pins from local storage
        const stored = localStorage.getItem(`saldesk_pins_${conversation.id}`);
        if (stored) { try { setPinnedIds(new Set(JSON.parse(stored))); } catch {} }
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
      })
      .catch(() => setMessages([]))
      .finally(() => setLoadMsgs(false));
  }, [conversation]);

  function handlePin(msgId) {
    setPinnedIds(prev => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId); else next.add(msgId);
      localStorage.setItem(`saldesk_pins_${conversation?.id}`, JSON.stringify([...next]));
      return next;
    });
  }

  function handleReply(msg) {
    setReplyTo(msg);
    inputRef.current?.focus();
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!input.trim() || !conversation) return;
    const payload = {
      content: input.trim(),
      message_type: conversation.type === 'group' ? 'group' : 'direct',
      reply_to_id: replyTo?.id || undefined,
      ...(conversation.type === 'group'
        ? { group_id: conversation.id }
        : { recipient_id: conversation.id, recipient_type: 'staff' }),
    };
    try {
      const msg = await sendMessage(payload);
      /* O servidor tambem reenvia esta mensagem ao proprio remetente via
         socket ("message:new") -- sem este dedup, ficava duplicada. */
      setMessages(p => p.find(m => m.id === msg.id) ? p : [...p, msg]);
      setInput('');
      setReplyTo(null);
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch (err) { console.error(err); }
  }

  async function handleCreateGroup(e) {
    e.preventDefault();
    if (!groupName.trim()) return;
    try {
      const g = await createGroup({ name: groupName.trim() });
      setGroups(p => [...p, g]);
      setGroupModal(false);
      setGroupName('');
    } catch (err) { console.error(err); }
  }

  async function handleBroadcast(e) {
    e.preventDefault();
    if (!broadcastText.trim()) return;
    setBroadcasting(true);
    try {
      await Promise.all(
        staffList.map(s =>
          sendMessage({
            content: broadcastText.trim(),
            message_type: 'direct',
            recipient_id: s.id,
            recipient_type: 'staff',
          })
        )
      );
      setBroadcastText('');
      setBroadcast(false);
    } catch (err) { console.error(err); }
    finally { setBroadcasting(false); }
  }

  const pinnedMsgs = messages.filter(m => pinnedIds.has(m.id));

  return (
    <div className="flex border border-n-200 rounded-md overflow-hidden" style={{ height: 'calc(100vh - 220px)', minHeight: 420 }}>
      {/* Sidebar */}
      <div className="w-56 shrink-0 border-r border-n-200 bg-n-50 flex flex-col">
        <div className="px-3 py-2.5 border-b border-n-200 flex items-center justify-between">
          <span className="text-xs font-mono uppercase tracking-wider text-n-500">Mensagens</span>
          <div className="flex items-center gap-0.5">
            <button onClick={() => setBroadcast(true)} title="Broadcast"
              className="p-1 rounded text-n-400 hover:text-sand-500 hover:bg-sand-50 transition-colors">
              <Megaphone size={13} strokeWidth={1.75} />
            </button>
            <button onClick={() => setGroupModal(true)} title="Novo grupo"
              className="p-1 rounded text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors">
              <Plus size={13} strokeWidth={1.75} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {groups.length > 0 && (
            <>
              <div className="px-3 pt-3 pb-1">
                <span className="text-xs font-mono text-n-400 uppercase">Grupos</span>
              </div>
              {groups.map(g => (
                <button key={g.id} onClick={() => setConvo({ type: 'group', id: g.id, name: g.name })}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white transition-colors ${conversation?.id === g.id ? 'bg-white border-r-2 border-ocean-700' : ''}`}>
                  <div className="w-7 h-7 rounded-full bg-ocean-50 flex items-center justify-center shrink-0">
                    <Users size={12} strokeWidth={1.75} className="text-ocean-700" />
                  </div>
                  <span className="text-sm font-body text-n-800 truncate">{g.name}</span>
                </button>
              ))}
            </>
          )}

          <div className="px-3 pt-3 pb-1">
            <span className="text-xs font-mono text-n-400 uppercase">Direto</span>
          </div>
          {staffList.map(s => (
            <button key={s.id} onClick={() => setConvo({ type: 'direct', id: s.id, name: s.name })}
              className={`w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white transition-colors ${conversation?.id === s.id ? 'bg-white border-r-2 border-ocean-700' : ''}`}>
              <StaffAvatar member={s} size={28} showStatus />
              <span className="text-sm font-body text-n-800 truncate">{s.name.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Chat area */}
      {conversation ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="px-4 py-3 border-b border-n-200 bg-white flex items-center gap-2 shrink-0">
            <MessageSquare size={15} strokeWidth={1.75} className="text-ocean-700" />
            <p className="font-display font-semibold text-sm text-n-900 flex-1">{conversation.name}</p>
            {pinnedMsgs.length > 0 && (
              <span className="flex items-center gap-1 text-xs font-body text-n-500">
                <Pin size={11} strokeWidth={1.75} />
                {pinnedMsgs.length} fixada(s)
              </span>
            )}
          </div>

          {/* Pinned messages bar */}
          {pinnedMsgs.length > 0 && (
            <div className="px-4 py-2 bg-ocean-50 border-b border-ocean-100 shrink-0">
              {pinnedMsgs.slice(-1).map(m => (
                <div key={m.id} className="flex items-center gap-2 text-xs font-body text-ocean-700">
                  <Pin size={10} strokeWidth={1.75} className="shrink-0" />
                  <span className="truncate">{m.content}</span>
                  <button onClick={() => handlePin(m.id)} className="ml-auto text-ocean-400 hover:text-ocean-700">
                    <X size={10} strokeWidth={2} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-n-50">
            {loadingMsgs
              ? <div className="flex justify-center pt-8"><LoadingSpinner size={24} /></div>
              : messages.length === 0
                ? <p className="text-xs font-body text-n-400 text-center pt-8">Sem mensagens ainda</p>
                : messages.map(msg => (
                  <MessageBubble key={msg.id} msg={msg}
                    isOwn={msg.sender_id === operator?.id}
                    staffList={staffList}
                    pinnedIds={pinnedIds}
                    onPin={handlePin}
                    onReply={handleReply}
                    allMessages={messages}
                  />
                ))
            }
            <div ref={endRef} />
          </div>

          {/* Reply preview */}
          {replyTo && (
            <div className="flex items-center gap-2 px-3 py-2 bg-ocean-50 border-t border-ocean-100 shrink-0">
              <CornerUpLeft size={12} strokeWidth={1.75} className="text-ocean-600 shrink-0" />
              <span className="text-xs font-body text-ocean-700 truncate flex-1">{replyTo.content?.slice(0, 80)}</span>
              <button onClick={() => setReplyTo(null)} className="text-ocean-400 hover:text-ocean-700">
                <X size={12} strokeWidth={2} />
              </button>
            </div>
          )}

          <form onSubmit={handleSend} className="p-3 border-t border-n-200 bg-white flex gap-2 shrink-0">
            <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
              placeholder="Escrever mensagem..."
              className="flex-1 h-9 px-3 rounded-sm border border-n-200 text-sm font-body bg-n-100 text-n-900 placeholder:text-n-400 focus:outline-none focus:border-ocean-700 focus:bg-white"
            />
            <button type="submit" disabled={!input.trim()}
              className="px-3 bg-ocean-700 text-white rounded-sm hover:bg-ocean-500 disabled:opacity-40 transition-colors">
              <Send size={15} strokeWidth={1.75} />
            </button>
          </form>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-n-50">
          <div className="text-center text-n-400">
            <MessageSquare size={32} strokeWidth={1.25} className="mx-auto mb-2" />
            <p className="text-sm font-body">Seleccionar uma conversa</p>
          </div>
        </div>
      )}

      {/* Create group modal */}
      <Modal open={groupModal} onClose={() => setGroupModal(false)} title="Novo grupo" size="sm">
        <form onSubmit={handleCreateGroup} className="space-y-4">
          <Input label="Nome do grupo" value={groupName} onChange={e => setGroupName(e.target.value)} required placeholder="Ex: Equipa de campo" />
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={() => setGroupModal(false)} className="flex-1">Cancelar</Button>
            <Button type="submit" className="flex-1">Criar grupo</Button>
          </div>
        </form>
      </Modal>

      {/* Broadcast modal */}
      <Modal open={broadcastModal} onClose={() => setBroadcast(false)} title="Broadcast — enviar a todos" size="sm">
        <form onSubmit={handleBroadcast} className="space-y-4">
          <div className="px-3 py-2.5 bg-sand-50 border border-sand-200 rounded-sm">
            <p className="text-xs font-body text-sand-600">
              Esta mensagem sera enviada individualmente para {staffList.length} colaborador(es) activo(s).
            </p>
          </div>
          <Input
            label="Mensagem"
            value={broadcastText}
            onChange={e => setBroadcastText(e.target.value)}
            required
            placeholder="Escrever mensagem de broadcast..."
          />
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={() => setBroadcast(false)} className="flex-1">Cancelar</Button>
            <Button type="submit" loading={broadcasting} icon={Megaphone} className="flex-1">Enviar</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default ChatTab;
