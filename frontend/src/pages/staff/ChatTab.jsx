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
import { IconBtn, EDIT_HOVER } from '../../components/shared/IconBtn';
import EmptyState from '../../components/ui/EmptyState';
import { useT } from '../../i18n';
import { localeDe, useLingua } from '../../utils/formatoLingua';

/* ── Chat Message ── */
function MessageBubble({ msg, isOwn, staffList, pinnedIds, onPin, onReply, allMessages }) {
  const t = useT();
  const lang = useLingua();
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
      <div className="flex flex-col min-w-0 max-w-[72%]">
        {/* Reply context */}
        {replyMsg && (
          <div className={`mb-1 px-2 py-1 rounded-[10px] border-l-2 border-ocean-500 min-w-0 break-words ${isOwn ? 'bg-ocean-600 text-white self-end' : 'bg-mare-head text-n-600'} text-xs font-body`}>
            <span className="font-semibold mr-1">{replySender?.name.split(' ')[0] || t('staff.chat.system')}</span>
            <span className="truncate">{replyMsg.content?.slice(0, 60)}</span>
          </div>
        )}
        <div className={`min-w-0 break-words px-3 py-2 rounded-[14px] text-sm font-body relative ${isOwn ? 'bg-ocean-700 text-white' : 'bg-mare-head border border-mare-card text-n-800'}`}>
          {isPinned && (
            <Pin size={10} strokeWidth={1.75} className={`absolute top-1.5 ${isOwn ? 'left-2 text-ocean-100' : 'right-2 text-n-600'}`} />
          )}
          {!isOwn && sender && (
            <p className="text-xs font-mono font-semibold mb-0.5 text-ocean-700">{sender.name.split(' ')[0]}</p>
          )}
          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
          <p className={`text-xs font-mono tabular-nums mt-1 ${isOwn ? 'text-ocean-100' : 'text-n-600'}`}>
            {new Date(msg.created_at).toLocaleTimeString(localeDe(lang), { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
      {/* Action buttons on hover */}
      <div className={`flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity ${isOwn ? 'order-first' : ''}`}>
        <button onClick={() => onReply?.(msg)} title={t('staff.chat.reply')} aria-label={t('staff.chat.reply')}
          className="p-1 rounded text-n-600 hover:text-ocean-700 hover:bg-ocean-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sand-500">
          <CornerUpLeft size={12} strokeWidth={1.75} />
        </button>
        <button onClick={() => onPin?.(msg.id)} title={isPinned ? t('staff.chat.unpin') : t('staff.chat.pin')} aria-label={isPinned ? t('staff.chat.unpin') : t('staff.chat.pin')}
          className={`p-1 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sand-500 ${isPinned ? 'text-ocean-700 bg-ocean-50' : 'text-n-600 hover:text-ocean-700 hover:bg-ocean-50'}`}>
          <Pin size={12} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}

/* ── Chat Tab ── */
function ChatTab({ staffList }) {
  const t = useT();
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
    <div className="flex bg-white border border-mare-card rounded-[18px] overflow-hidden" style={{ height: 'calc(100vh - 220px)', minHeight: 420 }}>
      {/* Sidebar */}
      <div className="w-56 shrink-0 border-r border-mare-card bg-mare-head flex flex-col">
        <div className="px-3 py-2.5 border-b border-mare-card flex items-center justify-between">
          <span className="text-xs font-mono uppercase tracking-wider text-n-600">{t('staff.chat.messages')}</span>
          <div className="flex items-center gap-0.5">
            <IconBtn icon={Megaphone} label={t('staff.chat.broadcast')} title={t('staff.chat.broadcast')}
              onClick={() => setBroadcast(true)} hover={EDIT_HOVER} className="text-n-600" />
            <IconBtn icon={Plus} label={t('staff.chat.newGroup')} title={t('staff.chat.newGroup')}
              onClick={() => setGroupModal(true)} hover={EDIT_HOVER} className="text-n-600" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {groups.length > 0 && (
            <>
              <div className="px-3 pt-3 pb-1">
                <span className="text-xs font-mono text-n-600 uppercase">{t('staff.chat.groups')}</span>
              </div>
              {groups.map(g => (
                <button key={g.id} onClick={() => setConvo({ type: 'group', id: g.id, name: g.name })}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 min-h-11 md:min-h-0 hover:bg-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sand-500 ${conversation?.id === g.id ? 'bg-white border-r-2 border-ocean-700' : ''}`}>
                  <div className="w-7 h-7 rounded-full bg-ocean-50 flex items-center justify-center shrink-0">
                    <Users size={12} strokeWidth={1.75} className="text-ocean-700" />
                  </div>
                  <span className="text-sm font-body text-n-800 truncate">{g.name}</span>
                </button>
              ))}
            </>
          )}

          <div className="px-3 pt-3 pb-1">
            <span className="text-xs font-mono text-n-600 uppercase">{t('staff.chat.direct')}</span>
          </div>
          {staffList.map(s => (
            <button key={s.id} onClick={() => setConvo({ type: 'direct', id: s.id, name: s.name })}
              className={`w-full flex items-center gap-2.5 px-3 py-2 min-h-11 md:min-h-0 hover:bg-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sand-500 ${conversation?.id === s.id ? 'bg-white border-r-2 border-ocean-700' : ''}`}>
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
          <div className="px-4 py-3 border-b border-mare-card bg-white flex items-center gap-2 shrink-0">
            <MessageSquare size={15} strokeWidth={1.75} className="text-ocean-700 shrink-0" />
            <p className="font-display text-lg font-semibold text-ocean-900 flex-1 min-w-0 truncate">{conversation.name}</p>
            {pinnedMsgs.length > 0 && (
              <span className="flex items-center gap-1 text-xs font-body text-n-600 shrink-0">
                <Pin size={11} strokeWidth={1.75} />
                {t('staff.chat.pinnedCount', { n: pinnedMsgs.length })}
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
                  <button onClick={() => handlePin(m.id)} aria-label={t('staff.chat.unpinPinned')} className="ml-auto text-ocean-400 hover:text-ocean-700">
                    <X size={10} strokeWidth={2} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
            {loadingMsgs
              ? <div className="flex justify-center pt-8"><LoadingSpinner size={24} /></div>
              : messages.length === 0
                ? <p className="text-xs font-body text-n-600 text-center pt-8">{t('staff.chat.noMessages')}</p>
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
              <button onClick={() => setReplyTo(null)} aria-label={t('staff.chat.cancelReply')} className="text-ocean-400 hover:text-ocean-700">
                <X size={12} strokeWidth={2} />
              </button>
            </div>
          )}

          <form onSubmit={handleSend} className="m-3 px-3 py-2 flex items-center gap-2 bg-mare-head border border-mare-card rounded-[14px] shrink-0">
            <div className="flex-1 min-w-0">
              <Input ref={inputRef} aria-label={t('staff.chat.writeLabel')} value={input} onChange={e => setInput(e.target.value)}
                placeholder={t('staff.chat.writePlaceholder')}
              />
            </div>
            <Button type="submit" aria-label={t('staff.chat.send')} icon={Send} disabled={!input.trim()} />
          </form>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-white">
          <EmptyState icon={MessageSquare} title={t('staff.chat.selectConversation')} />
        </div>
      )}

      {/* Create group modal */}
      <Modal open={groupModal} onClose={() => setGroupModal(false)} title={t('staff.chat.newGroup')} size="sm">
        <form onSubmit={handleCreateGroup} className="space-y-4">
          <Input label={t('staff.chat.groupName')} aria-label={t('staff.chat.groupName')} value={groupName} onChange={e => setGroupName(e.target.value)} required placeholder={t('staff.chat.groupPlaceholder')} />
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={() => setGroupModal(false)} className="flex-1">{t('common.cancel')}</Button>
            <Button type="submit" className="flex-1">{t('staff.chat.createGroup')}</Button>
          </div>
        </form>
      </Modal>

      {/* Broadcast modal */}
      <Modal open={broadcastModal} onClose={() => setBroadcast(false)} title={t('staff.chat.broadcastTitle')} size="sm">
        <form onSubmit={handleBroadcast} className="space-y-4">
          <div className="px-3 py-2.5 bg-[var(--sand-50)] border border-[var(--sand-300)] rounded-sm">
            <p className="text-xs font-body text-n-800">
              {t('staff.chat.broadcastInfo', { n: staffList.length })}
            </p>
          </div>
          <Input
            label={t('staff.chat.message')}
            aria-label={t('staff.chat.message')}
            value={broadcastText}
            onChange={e => setBroadcastText(e.target.value)}
            required
            placeholder={t('staff.chat.broadcastPlaceholder')}
          />
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={() => setBroadcast(false)} className="flex-1">{t('common.cancel')}</Button>
            <Button type="submit" loading={broadcasting} icon={Megaphone} className="flex-1">{t('staff.chat.send')}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default ChatTab;
