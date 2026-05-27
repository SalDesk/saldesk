import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send, Paperclip, Search, Users, Plus, X,
  Check, CheckCheck, ArrowLeft, MessageCircle,
} from 'lucide-react';
import { io } from 'socket.io-client';
import { listMessages, sendMessage, markRead, listGroups, createGroup } from '../services/messageService';
import { listStaff } from '../services/staffService';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import { useT } from '../i18n';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import LoadingSpinner from '../components/shared/LoadingSpinner';

function formatTime(d) {
  if (!d) return '';
  return new Date(d).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}

function ContactAvatar({ contact, online = false, size = 36 }) {
  const isGroup = contact.type === 'group';
  return (
    <div className="relative shrink-0">
      {contact.photo_url && !isGroup ? (
        <img
          src={contact.photo_url}
          alt={contact.label}
          className="rounded-full object-cover"
          style={{ width: size, height: size }}
        />
      ) : (
        <div
          className={`rounded-full flex items-center justify-center text-white font-display font-bold ${isGroup ? 'bg-sand-500' : 'bg-ocean-700'}`}
          style={{ width: size, height: size, fontSize: size * 0.38 }}
        >
          {isGroup ? <Users size={size * 0.44} strokeWidth={1.75} /> : contact.label?.[0]}
        </div>
      )}
      {!isGroup && (
        <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${online ? 'bg-green-500' : 'bg-n-300'}`} />
      )}
    </div>
  );
}

async function registerPushNotifications() {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
  if (Notification.permission === 'denied') return;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;
    const registration = await navigator.serviceWorker.ready;
    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!vapidKey) return;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidKey,
    });
    await api.post('/notifications/subscribe', { subscription });
  } catch {}
}

export default function Messages() {
  const t = useT();
  const { token, operator } = useAuthStore();

  const [staff,           setStaff]           = useState([]);
  const [groups,          setGroups]           = useState([]);
  const [search,          setSearch]           = useState('');
  const [selectedContact, setSelectedContact]  = useState(null);
  const [messages,        setMessages]         = useState([]);
  const [loadingMsgs,     setLoadingMsgs]      = useState(false);
  const [text,            setText]             = useState('');
  const [attachment,      setAttachment]       = useState(null);
  const [sending,         setSending]          = useState(false);
  const [showChat,        setShowChat]         = useState(false);
  const [onlineUsers,     setOnlineUsers]      = useState(new Set());
  const [typingContacts,  setTypingContacts]   = useState(new Set());
  const [unreadCounts,    setUnreadCounts]     = useState({});
  const [groupModal,      setGroupModal]       = useState(false);
  const [groupForm,       setGroupForm]        = useState({ name: '', members: [] });

  const bottomRef          = useRef(null);
  const fileRef            = useRef(null);
  const socketRef          = useRef(null);
  const typingTimerRef     = useRef(null);
  const isTypingRef        = useRef(false);
  const selectedContactRef = useRef(null);

  useEffect(() => { selectedContactRef.current = selectedContact; }, [selectedContact]);

  useEffect(() => {
    Promise.all([listStaff({ status: 'active' }), listGroups()])
      .then(([s, g]) => { setStaff(s || []); setGroups(g || []); })
      .catch(() => {});
    registerPushNotifications();
  }, []);

  useEffect(() => {
    if (!token || !operator) return;
    const socketUrl = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:3001';
    const socket    = io(socketUrl, { auth: { token } });
    socketRef.current = socket;

    socket.on('message:new', (msg) => {
      const cur = selectedContactRef.current;
      const isCurrent = cur && (
        (cur.type === 'staff' && msg.sender_id === cur.id) ||
        (cur.type === 'group' && msg.group_id === cur.id)
      );

      if (isCurrent) {
        setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg]);
        markRead(msg.id).catch(() => {});
      } else {
        const cid = msg.group_id || msg.sender_id;
        if (cid) setUnreadCounts(prev => ({ ...prev, [cid]: (prev[cid] || 0) + 1 }));
      }
    });

    socket.on('user:online',  ({ userId }) => setOnlineUsers(prev => new Set([...prev, userId])));
    socket.on('user:offline', ({ userId }) => setOnlineUsers(prev => { const s = new Set(prev); s.delete(userId); return s; }));

    socket.on('typing:start', ({ from }) => {
      setTypingContacts(prev => new Set([...prev, from]));
    });
    socket.on('typing:stop', ({ from }) => {
      setTypingContacts(prev => { const s = new Set(prev); s.delete(from); return s; });
    });

    return () => socket.disconnect();
  }, [token, operator]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const emitTypingStop = useCallback(() => {
    const cur = selectedContactRef.current;
    if (!cur || !socketRef.current) return;
    socketRef.current.emit('typing:stop', { to: cur.id });
    isTypingRef.current = false;
  }, []);

  function handleTextChange(e) {
    setText(e.target.value);
    const cur = selectedContactRef.current;
    if (!cur || !socketRef.current) return;

    if (!isTypingRef.current) {
      socketRef.current.emit('typing:start', { to: cur.id });
      isTypingRef.current = true;
    }
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(emitTypingStop, 2000);
  }

  async function loadMessages(contact) {
    setSelectedContact(contact);
    setShowChat(true);
    setUnreadCounts(prev => ({ ...prev, [contact.id]: 0 }));
    setLoadingMsgs(true);
    try {
      const params = contact.type === 'group'
        ? { group_id: contact.id }
        : { recipient_id: contact.id };
      const result = await listMessages(params);
      const msgs   = Array.isArray(result) ? result : (result?.data || []);
      setMessages(msgs);
      const unread = msgs.filter(m => !m.is_read && m.sender_type !== 'manager');
      unread.forEach(m => markRead(m.id).catch(() => {}));
    } finally {
      setLoadingMsgs(false);
    }
  }

  async function handleSend(e) {
    e.preventDefault();
    const content = text.trim();
    if (!content && !attachment) return;

    emitTypingStop();
    clearTimeout(typingTimerRef.current);

    setSending(true);
    try {
      const msgContent = attachment
        ? (content ? `${content}\n[Anexo: ${attachment.name}]` : `[Anexo: ${attachment.name}]`)
        : content;

      const payload = {
        content: msgContent,
        ...(selectedContact.type === 'group'
          ? { group_id: selectedContact.id, message_type: 'group', recipient_type: 'group' }
          : { recipient_id: selectedContact.id, recipient_type: 'staff', message_type: 'direct' }
        ),
      };
      const msg = await sendMessage(payload);
      if (msg) setMessages(prev => [...prev, msg]);
      setText('');
      setAttachment(null);
    } finally {
      setSending(false);
    }
  }

  async function handleCreateGroup(e) {
    e.preventDefault();
    try {
      const g = await createGroup(groupForm);
      if (g) setGroups(prev => [...prev, g]);
      setGroupModal(false);
      setGroupForm({ name: '', members: [] });
    } catch {}
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (file) setAttachment(file);
    e.target.value = '';
  }

  const contacts = [
    ...staff.map(s  => ({ ...s, type: 'staff', label: s.name, sublabel: s.role })),
    ...groups.map(g => ({ ...g, type: 'group', label: g.name, sublabel: `Grupo · ${(g.members || []).length} membros` })),
  ];

  const filteredContacts = search.trim()
    ? contacts.filter(c => c.label.toLowerCase().includes(search.toLowerCase()))
    : contacts;

  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  return (
    <div>
      <PageHeader
        title={`Mensagens${totalUnread > 0 ? ` (${totalUnread})` : ''}`}
        actions={
          <Button variant="secondary" icon={Plus} onClick={() => setGroupModal(true)}>
            Novo grupo
          </Button>
        }
      />

      <div
        className="flex bg-white rounded-md border border-n-200 shadow-sm overflow-hidden"
        style={{ height: 'calc(100vh - 168px)', minHeight: 500 }}
      >
        {/* Contacts sidebar */}
        <div className={`flex-col w-full md:w-72 border-r border-n-200 shrink-0 ${showChat ? 'hidden md:flex' : 'flex'}`}>
          <div className="px-3 py-2.5 border-b border-n-100">
            <div className="relative">
              <Search size={13} strokeWidth={1.75} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-n-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Pesquisar..."
                className="w-full h-8 pl-8 pr-3 rounded-sm border border-n-200 text-xs font-body bg-n-50 focus:outline-none focus:bg-white focus:ring-1 focus:ring-ocean-300 transition-colors"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredContacts.length === 0 ? (
              <p className="p-4 text-xs font-body text-n-400 text-center">
                {search ? 'Sem resultados' : 'Sem colaboradores ou grupos'}
              </p>
            ) : filteredContacts.map(c => {
              const isOnline  = c.type === 'staff' && onlineUsers.has(c.id);
              const unread    = unreadCounts[c.id] || 0;
              const isActive  = selectedContact?.id === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => loadMessages(c)}
                  className={`w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-n-50 transition-colors border-b border-n-100 ${isActive ? 'bg-ocean-50' : ''}`}
                >
                  <ContactAvatar contact={c} online={isOnline} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-sm font-body font-semibold text-n-900 truncate">{c.label}</p>
                      {unread > 0 && (
                        <span className="shrink-0 w-5 h-5 rounded-full bg-ocean-700 text-white text-xs font-body font-bold flex items-center justify-center">
                          {unread > 9 ? '9+' : unread}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-body text-n-400 truncate mt-0.5">
                      {c.type === 'staff' && isOnline ? (
                        <span className="text-green-600">Online</span>
                      ) : c.sublabel}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Chat panel */}
        <div className={`flex-1 flex-col overflow-hidden ${showChat ? 'flex' : 'hidden md:flex'}`}>
          {!selectedContact ? (
            <div className="flex-1 flex items-center justify-center text-n-400">
              <div className="text-center">
                <MessageCircle size={36} strokeWidth={1.25} className="mx-auto mb-2 text-n-300" />
                <p className="text-sm font-body">Seleccione uma conversa</p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="px-4 py-3 border-b border-n-200 flex items-center gap-3">
                <button
                  className="md:hidden p-1 rounded hover:bg-n-50"
                  onClick={() => setShowChat(false)}
                >
                  <ArrowLeft size={18} strokeWidth={1.75} className="text-n-600" />
                </button>
                <ContactAvatar
                  contact={selectedContact}
                  online={selectedContact.type === 'staff' && onlineUsers.has(selectedContact.id)}
                  size={32}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-display font-semibold text-sm text-n-900 truncate">{selectedContact.label}</p>
                  {typingContacts.has(selectedContact.id) ? (
                    <p className="text-xs font-body text-ocean-600 italic">esta a escrever...</p>
                  ) : (
                    <p className="text-xs font-body text-n-400 truncate">{selectedContact.sublabel}</p>
                  )}
                </div>
              </div>

              {/* Messages area */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {loadingMsgs ? (
                  <div className="flex justify-center py-8"><LoadingSpinner /></div>
                ) : messages.length === 0 ? (
                  <div className="flex justify-center py-12">
                    <p className="text-xs font-body text-n-400">Sem mensagens ainda. Comece a conversa.</p>
                  </div>
                ) : messages.map(msg => {
                  const isMe = msg.sender_type === 'manager';
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[72%] px-3 py-2 rounded-md text-sm font-body ${isMe ? 'bg-ocean-700 text-white' : 'bg-n-100 text-n-800'}`}>
                        {!isMe && (
                          <p className="text-xs font-semibold mb-1 opacity-60 capitalize">{msg.sender_name || msg.sender_type}</p>
                        )}
                        <p className="leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                        <div className={`flex items-center justify-end gap-1 mt-1 ${isMe ? 'opacity-60' : ''}`}>
                          <span className="text-xs">{formatTime(msg.created_at)}</span>
                          {isMe && (
                            msg.is_read
                              ? <CheckCheck size={12} strokeWidth={2} className="text-sand-300" />
                              : <Check size={12} strokeWidth={2} />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              {/* Input area */}
              <div className="border-t border-n-200">
                {attachment && (
                  <div className="px-4 pt-2.5 pb-0 flex items-center gap-2">
                    <div className="flex items-center gap-1.5 bg-ocean-50 border border-ocean-200 rounded-xs px-2 py-1 text-xs font-body text-ocean-700">
                      <Paperclip size={12} strokeWidth={1.75} />
                      <span className="max-w-[180px] truncate">{attachment.name}</span>
                      <button onClick={() => setAttachment(null)} className="hover:text-error">
                        <X size={12} strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                )}
                <form onSubmit={handleSend} className="px-4 py-3 flex items-center gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileChange}
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="p-2 rounded-sm text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors shrink-0"
                    title="Anexar ficheiro"
                  >
                    <Paperclip size={16} strokeWidth={1.75} />
                  </button>
                  <input
                    className="flex-1 h-9 px-3 rounded-sm border border-n-300 text-sm font-body bg-n-50 focus:outline-none focus:ring-2 focus:ring-ocean-300 focus:border-ocean-700 focus:bg-white transition-colors"
                    value={text}
                    onChange={handleTextChange}
                    placeholder="Escrever mensagem..."
                  />
                  <Button
                    type="submit"
                    loading={sending}
                    icon={Send}
                    disabled={!text.trim() && !attachment}
                    size="sm"
                  >
                    Enviar
                  </Button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>

      {/* New group modal */}
      <Modal
        open={groupModal}
        onClose={() => setGroupModal(false)}
        title="Novo grupo"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setGroupModal(false)}>Cancelar</Button>
            <Button form="group-form" type="submit">Criar grupo</Button>
          </>
        }
      >
        <form id="group-form" onSubmit={handleCreateGroup} className="space-y-4">
          <Input
            label="Nome do grupo"
            value={groupForm.name}
            onChange={e => setGroupForm({ ...groupForm, name: e.target.value })}
            required
            placeholder="Ex: Equipa Kitesurf"
          />
          {staff.length > 0 && (
            <div>
              <p className="text-xs font-body font-bold uppercase tracking-wide text-n-600 mb-2">Membros</p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {staff.map(s => (
                  <label key={s.id} className="flex items-center gap-2.5 cursor-pointer py-0.5">
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={groupForm.members.includes(s.id)}
                      onChange={e => {
                        const members = e.target.checked
                          ? [...groupForm.members, s.id]
                          : groupForm.members.filter(id => id !== s.id);
                        setGroupForm({ ...groupForm, members });
                      }}
                    />
                    <span className="text-sm font-body text-n-700">
                      {s.name}
                      <span className="text-n-400"> · {s.role}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}
